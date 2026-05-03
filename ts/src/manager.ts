import { z } from "zod";
import {
    AgentableSchema,
    AgentableSchemaSchema,
    AgentableColumn,
    AgentableRow,
    AgentableView,
    AgentableColumnSchema,
    AgentableRowSchema,
    AgentableViewSchema,
    AgentableFilter,
    AgentableSort,
    AgentableFilterSchema,
    AgentableSortSchema,
} from "./schema";
import { generateRowId, generateColId, generateViewId, generateFilterId, generateSortId } from "./utils";

export class AgentableManager {
    private schema: AgentableSchema;

    constructor(initialSchema?: Partial<AgentableSchema>) {
        if (initialSchema) {
            // Validate provided schema, filling in defaults if necessary
            this.schema = AgentableSchemaSchema.parse({
                version: "agentable-1.0.0",
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
                version: "agentable-1.0.0",
                metadata: {
                    title: "New Table",
                    description: "Created by AgentableManager",
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
    public getAgentable(): AgentableSchema {
        return this.schema;
    }

    // --- Metadata Management ---

    public updateMetadata(updates: Partial<AgentableSchema["metadata"]>): void {
        this.schema.metadata = { ...this.schema.metadata, ...updates };
        // We don't need full schema validation here as metadata is simple, 
        // but we could call AgentableSchemaSchema.parse(this.schema) if we wanted to be strict.
    }

    // --- Column Management ---

    public addColumn(column: Omit<AgentableColumn, "id">): AgentableColumn {
        let newId = generateColId();
        while (this.schema.columns.find((c) => c.id === newId)) {
            newId = generateColId();
        }

        const newCol: AgentableColumn = {
            id: newId,
            ...column,
        };
        // Validate
        AgentableColumnSchema.parse(newCol);
        this.schema.columns.push(newCol);
        return newCol;
    }

    public getColumn(id: string): AgentableColumn | undefined {
        return this.schema.columns.find((c) => c.id === id);
    }

    public updateColumn(id: string, updates: Partial<Omit<AgentableColumn, "id">>): AgentableColumn {
        const colIndex = this.schema.columns.findIndex((c) => c.id === id);
        if (colIndex === -1) {
            throw new Error(`Column with ID ${id} not found.`);
        }
        const updatedCol = { ...this.schema.columns[colIndex], ...updates };
        AgentableColumnSchema.parse(updatedCol);
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

    public addOptionToColumn(columnId: string, value: string, color?: string): AgentableColumn {
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

        AgentableColumnSchema.parse(updatedCol);
        this.schema.columns[colIndex] = updatedCol;
        return updatedCol;
    }

    // --- Row Management ---

    public addRow(cells: Record<string, any>): AgentableRow {
        let newId = generateRowId();
        while (this.schema.rows.find((r) => r.id === newId)) {
            newId = generateRowId();
        }

        const newRow: AgentableRow = {
            id: newId,
            cells: cells,
        };
        // Validate against column constraints
        this.validateRow(newRow);

        AgentableRowSchema.parse(newRow);
        this.schema.rows.push(newRow);
        return newRow;
    }

    public updateRow(id: string, cells: Record<string, any>): AgentableRow {
        const rowIndex = this.schema.rows.findIndex((r) => r.id === id);
        if (rowIndex === -1) {
            throw new Error(`Row with ID ${id} not found.`);
        }
        const updatedRow = {
            ...this.schema.rows[rowIndex],
            cells: { ...this.schema.rows[rowIndex].cells, ...cells }
        };

        this.validateRow(updatedRow);

        AgentableRowSchema.parse(updatedRow);
        this.schema.rows[rowIndex] = updatedRow;
        return updatedRow;
    }

    public deleteRow(id: string): void {
        this.schema.rows = this.schema.rows.filter((r) => r.id !== id);
    }

    public moveRow(id: string, toIndex: number): void {
        const fromIndex = this.schema.rows.findIndex(r => r.id === id);
        if (fromIndex === -1) throw new Error(`Row ${id} not found`);

        const [row] = this.schema.rows.splice(fromIndex, 1);
        this.schema.rows.splice(toIndex, 0, row);
    }

    public setColumnVisibility(viewId: string, columnId: string, visible: boolean): void {
        const view = this.getView(viewId);
        if (!view) throw new Error(`View ${viewId} not found`);

        if (visible) {
            view.hiddenColumns = view.hiddenColumns.filter(id => id !== columnId);
        } else {
            if (!view.hiddenColumns.includes(columnId)) {
                view.hiddenColumns.push(columnId);
            }
        }
    }

    // --- View Management ---

    public createView(name: string): AgentableView {
        let newId = generateViewId();
        while (this.schema.views.find((v) => v.id === newId)) {
            newId = generateViewId();
        }

        const newView: AgentableView = {
            id: newId,
            name,
            description: "",
            filters: [],
            sorts: [],
            hiddenColumns: [],
            columnOrder: this.schema.columns.map(c => c.id)
        };
        AgentableViewSchema.parse(newView);
        this.schema.views.push(newView);
        return newView;
    }

    public getView(id: string): AgentableView | undefined {
        return this.schema.views.find(v => v.id === id);
    }

    public updateView(id: string, updates: Partial<Omit<AgentableView, "id" | "filters" | "sorts">>): AgentableView {
        const viewIndex = this.schema.views.findIndex(v => v.id === id);
        if (viewIndex === -1) {
            throw new Error(`View with ID ${id} not found.`);
        }
        
        // Note: We omit filters and sorts from direct view updates to encourage 
        // using the dedicated add/remove helper methods for those lists.
        const updatedView = { ...this.schema.views[viewIndex], ...updates };
        AgentableViewSchema.parse(updatedView);
        this.schema.views[viewIndex] = updatedView;
        return updatedView;
    }

    public addFilter(viewId: string, filter: Omit<AgentableFilter, "id">): AgentableFilter {
        const view = this.getView(viewId);
        if (!view) throw new Error(`View ${viewId} not found`);

        let newId = generateFilterId();
        // Check for collision across all filters in this view
        while (view.filters.find(f => f.id === newId)) {
            newId = generateFilterId();
        }

        const newFilter: AgentableFilter = { id: newId, ...filter };
        AgentableFilterSchema.parse(newFilter);
        view.filters.push(newFilter);
        return newFilter;
    }

    public removeFilter(viewId: string, filterId: string): void {
        const view = this.getView(viewId);
        if (!view) throw new Error(`View ${viewId} not found`);
        view.filters = view.filters.filter(f => f.id !== filterId);
    }

    public addSort(viewId: string, sort: Omit<AgentableSort, "id">): AgentableSort {
        const view = this.getView(viewId);
        if (!view) throw new Error(`View ${viewId} not found`);

        let newId = generateSortId();
        while (view.sorts.find(s => s.id === newId)) {
            newId = generateSortId();
        }

        const newSort: AgentableSort = { id: newId, ...sort };
        AgentableSortSchema.parse(newSort);
        view.sorts.push(newSort);
        return newSort;
    }

    public removeSort(viewId: string, sortId: string): void {
        const view = this.getView(viewId);
        if (!view) throw new Error(`View ${viewId} not found`);
        view.sorts = view.sorts.filter(s => s.id !== sortId);
    }

    private validateRow(row: AgentableRow): void {
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
