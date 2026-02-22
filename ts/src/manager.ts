import { z } from "zod";
import {
    JatsSchema,
    JatsSchemaSchema,
    JatsColumn,
    JatsRow,
    JatsView,
    JatsColumnSchema,
    JatsRowSchema,
    JatsViewSchema,
    JatsFilter,
    JatsSort,
} from "./schema";
import { generateRowId, generateColId, generateViewId } from "./utils";

export class JatsManager {
    private schema: JatsSchema;

    constructor(initialSchema?: Partial<JatsSchema>) {
        if (initialSchema) {
            // Validate provided schema, filling in defaults if necessary
            this.schema = JatsSchemaSchema.parse({
                version: "jats-1.0.0",
                metadata: {
                    title: "Untitled Table",
                    description: "",
                },
                columns: [],
                views: [],
                rows: [],
                ...initialSchema,
            });
        } else {
            this.schema = {
                version: "jats-1.0.0",
                metadata: {
                    title: "New Table",
                    description: "Created by JatsManager",
                },
                columns: [],
                views: [],
                rows: [],
            };
        }
    }

    /**
     * Returns the current schema state.
     */
    public getJats(): JatsSchema {
        return this.schema;
    }

    // --- Column Management ---

    public addColumn(column: Omit<JatsColumn, "id">): JatsColumn {
        let newId = generateColId();
        while (this.schema.columns.find((c) => c.id === newId)) {
            newId = generateColId();
        }

        const newCol: JatsColumn = {
            id: newId,
            ...column,
        };
        // Validate
        JatsColumnSchema.parse(newCol);
        this.schema.columns.push(newCol);
        return newCol;
    }

    public getColumn(id: string): JatsColumn | undefined {
        return this.schema.columns.find((c) => c.id === id);
    }

    public updateColumn(id: string, updates: Partial<Omit<JatsColumn, "id">>): JatsColumn {
        const colIndex = this.schema.columns.findIndex((c) => c.id === id);
        if (colIndex === -1) {
            throw new Error(`Column with ID ${id} not found.`);
        }
        const updatedCol = { ...this.schema.columns[colIndex], ...updates };
        JatsColumnSchema.parse(updatedCol);
        this.schema.columns[colIndex] = updatedCol;
        return updatedCol;
    }

    public deleteColumn(id: string): void {
        this.schema.columns = this.schema.columns.filter((c) => c.id !== id);
        // Cleanup: Remove cells in rows for this column
        this.schema.rows.forEach(row => {
            delete row.cells[id];
        });
        // Cleanup: Remove from views (filters, sorts, hidden, order)
        this.schema.views.forEach(view => {
            view.filters = view.filters.filter(f => f.columnId !== id);
            view.sorts = view.sorts.filter(s => s.columnId !== id);
            view.hiddenColumns = view.hiddenColumns.filter(cid => cid !== id);
            view.columnOrder = view.columnOrder.filter(cid => cid !== id);
        });
    }

    public addOptionToColumn(columnId: string, value: string, color?: string): JatsColumn {
        const colIndex = this.schema.columns.findIndex((c) => c.id === columnId);
        if (colIndex === -1) {
            throw new Error(`Column with ID ${columnId} not found.`);
        }

        const col = this.schema.columns[colIndex];
        if (col.type !== "select") {
            throw new Error(`Column "${col.name}" is not a select column. Cannot add options.`);
        }

        // Initialize constraints if missing
        const constraints = col.constraints || {};
        const options = constraints.options || [];

        // Check for duplicate
        if (options.some(o => o.value === value)) {
            // Already exists, just return the column (idempotent)
            return col;
        }

        options.push({ value, color });

        const updatedCol = {
            ...col,
            constraints: {
                ...constraints,
                options
            }
        };

        JatsColumnSchema.parse(updatedCol);
        this.schema.columns[colIndex] = updatedCol;
        return updatedCol;
    }

    // --- Row Management ---

    public addRow(cells: Record<string, any>): JatsRow {
        let newId = generateRowId();
        while (this.schema.rows.find((r) => r.id === newId)) {
            newId = generateRowId();
        }

        const newRow: JatsRow = {
            id: newId,
            cells: cells,
        };
        // Validate against column constraints
        this.validateRow(newRow);

        JatsRowSchema.parse(newRow);
        this.schema.rows.push(newRow);
        return newRow;
    }

    public updateRow(id: string, cells: Record<string, any>): JatsRow {
        const rowIndex = this.schema.rows.findIndex((r) => r.id === id);
        if (rowIndex === -1) {
            throw new Error(`Row with ID ${id} not found.`);
        }
        const updatedRow = {
            ...this.schema.rows[rowIndex],
            cells: { ...this.schema.rows[rowIndex].cells, ...cells }
        };

        this.validateRow(updatedRow);

        JatsRowSchema.parse(updatedRow);
        this.schema.rows[rowIndex] = updatedRow;
        return updatedRow;
    }

    public deleteRow(id: string): void {
        this.schema.rows = this.schema.rows.filter((r) => r.id !== id);
    }

    // --- View Management ---

    public createView(name: string): JatsView {
        let newId = generateViewId();
        while (this.schema.views.find((v) => v.id === newId)) {
            newId = generateViewId();
        }

        const newView: JatsView = {
            id: newId,
            name,
            description: "",
            filters: [],
            sorts: [],
            hiddenColumns: [],
            columnOrder: this.schema.columns.map(c => c.id)
        };
        JatsViewSchema.parse(newView);
        this.schema.views.push(newView);
        return newView;
    }

    private validateRow(row: JatsRow): void {
        this.schema.columns.forEach(col => {
            const value = row.cells[col.id];
            if (value === undefined || value === null) return;

            if (col.type === "date") {
                // Strict ISO-8601 UTC check (simple/fast check)
                // Must look like YYYY-MM-DDTHH:mm:ss.sssZ or similar
                // We'll use Zod's datetime() to be safe and consistent with strict validation
                const isoSchema = z.string().datetime();
                const result = isoSchema.safeParse(value);

                if (!result.success) {
                    throw new Error(`Column "${col.name}" (date) requires a valid ISO-8601 UTC string (e.g. 2023-01-01T12:00:00Z). Received: "${value}"`);
                }
            }
        });
    }
}
