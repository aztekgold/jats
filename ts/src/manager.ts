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

export type AgentableChangeType = 
    | "metadata.update"
    | "column.add" | "column.update" | "column.delete"
    | "row.add" | "row.update" | "row.delete" | "row.move"
    | "cell.update"
    | "view.add" | "view.update" | "view.delete"
    | "view.filter.add" | "view.filter.remove"
    | "view.sort.add" | "view.sort.remove";

export interface AgentableChange {
    type: AgentableChangeType;
    id: string; // The ID of the affected Row, Column, or View
    columnId?: string; // Specific to cell.update or column-related changes
}

export interface AgentableManagerOptions {
    onChange?: (schema: AgentableSchema, change: AgentableChange) => void;
}

export class AgentableManager {
    private schema: AgentableSchema;
    private options: AgentableManagerOptions;

    constructor(initialSchema?: Partial<AgentableSchema>, options: AgentableManagerOptions = {}) {
        this.options = options;
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

    private notify(change: AgentableChange): void {
        if (this.options.onChange) {
            this.options.onChange(this.schema, change);
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
        this.notify({ type: "metadata.update", id: "metadata" });
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
        this.notify({ type: "column.add", id: newId });
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
        this.notify({ type: "column.update", id });
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
        this.notify({ type: "column.delete", id });
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
        this.notify({ type: "column.update", id: columnId });
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
        this.notify({ type: "row.add", id: newId });
        return newRow;
    }

    public duplicateRow(id: string): AgentableRow {
        const sourceIndex = this.schema.rows.findIndex(r => r.id === id);
        if (sourceIndex === -1) throw new Error(`Row ${id} not found`);

        const sourceRow = this.schema.rows[sourceIndex];
        let newId = generateRowId();
        while (this.schema.rows.find((r) => r.id === newId)) {
            newId = generateRowId();
        }

        const newRow: AgentableRow = {
            id: newId,
            cells: { ...sourceRow.cells },
        };

        // Insert after source row
        this.schema.rows.splice(sourceIndex + 1, 0, newRow);
        this.notify({ type: "row.add", id: newId });
        return newRow;
    }

    public updateRow(id: string, cells: Record<string, any>, options: { validate?: boolean } = { validate: true }): AgentableRow {
        const rowIndex = this.schema.rows.findIndex((r) => r.id === id);
        if (rowIndex === -1) {
            throw new Error(`Row with ID ${id} not found.`);
        }
        const updatedRow = {
            ...this.schema.rows[rowIndex],
            cells: { ...this.schema.rows[rowIndex].cells, ...cells }
        };

        if (options.validate) {
            this.validateRow(updatedRow);
            AgentableRowSchema.parse(updatedRow);
        }

        this.schema.rows[rowIndex] = updatedRow;
        this.notify({ type: "row.update", id });
        return updatedRow;
    }

    public setCell(rowId: string, colId: string, value: any, options: { validate?: boolean } = { validate: true }): void {
        const row = this.schema.rows.find(r => r.id === rowId);
        if (!row) throw new Error(`Row ${rowId} not found`);

        if (options.validate) {
            const col = this.getColumn(colId);
            if (!col) throw new Error(`Column ${colId} not found`);
            this.validateCell(col, value);
        }

        row.cells[colId] = value;
        this.notify({ type: "cell.update", id: rowId, columnId: colId });
    }

    public deleteRow(id: string): void {
        this.schema.rows = this.schema.rows.filter((r) => r.id !== id);
        this.notify({ type: "row.delete", id });
    }

    public moveRow(id: string, toIndex: number): void {
        const fromIndex = this.schema.rows.findIndex(r => r.id === id);
        if (fromIndex === -1) throw new Error(`Row ${id} not found`);

        const [row] = this.schema.rows.splice(fromIndex, 1);
        this.schema.rows.splice(toIndex, 0, row);
        this.notify({ type: "row.move", id });
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
        this.notify({ type: "view.update", id: viewId });
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
        this.notify({ type: "view.add", id: newId });
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
        
        const updatedView = { ...this.schema.views[viewIndex], ...updates };
        AgentableViewSchema.parse(updatedView);
        this.schema.views[viewIndex] = updatedView;
        this.notify({ type: "view.update", id });
        return updatedView;
    }

    public addFilter(viewId: string, filter: Omit<AgentableFilter, "id">): AgentableFilter {
        const view = this.getView(viewId);
        if (!view) throw new Error(`View ${viewId} not found`);

        let newId = generateFilterId();
        while (view.filters.find(f => f.id === newId)) {
            newId = generateFilterId();
        }

        const newFilter: AgentableFilter = { id: newId, ...filter };
        AgentableFilterSchema.parse(newFilter);
        view.filters.push(newFilter);
        this.notify({ type: "view.filter.add", id: viewId });
        return newFilter;
    }

    public removeFilter(viewId: string, filterId: string): void {
        const view = this.getView(viewId);
        if (!view) throw new Error(`View ${viewId} not found`);
        view.filters = view.filters.filter(f => f.id !== filterId);
        this.notify({ type: "view.filter.remove", id: viewId });
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
        this.notify({ type: "view.sort.add", id: viewId });
        return newSort;
    }

    public removeSort(viewId: string, sortId: string): void {
        const view = this.getView(viewId);
        if (!view) throw new Error(`View ${viewId} not found`);
        view.sorts = view.sorts.filter(s => s.id !== sortId);
        this.notify({ type: "view.sort.remove", id: viewId });
    }

    private validateCell(col: AgentableColumn, value: any): void {
        if (value === undefined || value === null) {
            if (col.constraints?.required) {
                throw new Error(`Column "${col.name}" is required.`);
            }
            return;
        }

        switch (col.type) {
            case "number":
                if (typeof value !== "number") throw new Error(`Column "${col.name}" requires a number.`);
                break;
            case "boolean":
                if (typeof value !== "boolean") throw new Error(`Column "${col.name}" requires a boolean.`);
                break;
            case "date":
                const isoSchema = z.string().datetime();
                if (!isoSchema.safeParse(value).success) {
                    throw new Error(`Column "${col.name}" (date) requires a valid ISO-8601 UTC string.`);
                }
                break;
            case "select":
                if (col.constraints?.options) {
                    const options = col.constraints.options.map(o => o.value);
                    if (col.constraints.multiSelect) {
                        if (!Array.isArray(value)) throw new Error(`Column "${col.name}" (multi-select) requires an array.`);
                        value.forEach(v => {
                            if (!options.includes(v)) throw new Error(`Value "${v}" not found in options for column "${col.name}".`);
                        });
                    } else {
                        if (!options.includes(value)) throw new Error(`Value "${value}" not found in options for column "${col.name}".`);
                    }
                }
                break;
            case "url":
                if (!z.string().url().safeParse(value).success) throw new Error(`Column "${col.name}" requires a valid URL.`);
                break;
        }
    }

    private validateRow(row: AgentableRow): void {
        this.schema.columns.forEach(col => {
            const value = row.cells[col.id];
            this.validateCell(col, value);
        });
    }
}
