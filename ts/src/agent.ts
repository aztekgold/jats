import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AgentableManager } from "./manager";
import { AgentableColumn } from "./schema";

export interface AgentableAgentTool {
    name: string;
    description: string;
    parameters: z.ZodObject<any>;
    execute: (args: any) => Promise<string> | string;
}

export class AgentableAgent {
    private manager: AgentableManager;

    constructor(manager: AgentableManager) {
        this.manager = manager;
    }

    /**
     * "The Eyes": Returns a markdown description of the table state.
     */
    public describeTable(): string {
        const schema = this.manager.getAgentable();
        const meta = schema.metadata;

        let output = `# ${meta.title}\n${meta.description || ""}\n\n`;

        output += `## Columns\n`;
        schema.columns.forEach(col => {
            output += `- **${col.name}** (${col.type}) [ID: ${col.id}] \n`;
            if (col.description) output += `  - Description: ${col.description}\n`;
            if (col.display?.dateFormat) output += `  - Date Format: ${col.display.dateFormat}\n`;
            if (col.constraints?.options) {
                output += `  - Options: ${col.constraints.options.map(o => o.value).join(", ")}\n`;
            }
        });

        output += `\n## Views\n`;
        if (schema.views.length === 0) {
            output += `(No views defined)\n`;
        } else {
            schema.views.forEach(view => {
                output += `- **${view.name}** [ID: ${view.id}]\n`;
            });
        }

        output += `\n## Row Count: ${schema.rows.length}\n`;

        return output;
    }

    /**
     * Generates base Zod schemas for all columns, to be used by add or update tools.
     */
    private getBaseColumnSchemas(): Record<string, z.ZodTypeAny> {
        const schemaShape: Record<string, z.ZodTypeAny> = {};
        const columns = this.manager.getAgentable().columns;

        columns.forEach((col) => {
            let fieldSchema: z.ZodTypeAny;

            switch (col.type) {
                case "number":
                    fieldSchema = z.number();
                    break;
                case "boolean":
                    fieldSchema = z.boolean();
                    break;
                case "date":
                    fieldSchema = z.string().datetime().or(z.string()); // Allow ISO strings or plain strings
                    break;
                case "select":
                    if (col.constraints?.options) {
                        const values = col.constraints.options.map((o) => o.value) as [string, ...string[]];
                        if (values.length > 0) {
                            // z.enum requires at least one value
                            fieldSchema = z.enum(values);
                        } else {
                            fieldSchema = z.string();
                        }
                    } else {
                        fieldSchema = z.string();
                    }
                    break;
                case "url":
                    fieldSchema = z.string().url();
                    break;
                default:
                    fieldSchema = z.string();
            }

            // Apply Description Metadata
            let description = `Column: ${col.name}`;
            if (col.description) description += ` - ${col.description}`;
            if (col.display?.dateFormat) description += ` (Format: ${col.display.dateFormat})`;

            if (col.type === "select" && col.constraints?.multiSelect) {
                fieldSchema = z.array(fieldSchema).describe(`List of: ${description}`);
            } else {
                fieldSchema = fieldSchema.describe(description);
            }

            // Handle Optionality 
            if (!col.constraints?.required) {
                fieldSchema = fieldSchema.optional();
            }

            schemaShape[col.id] = fieldSchema;
        });

        return schemaShape;
    }



    /**
     * Tool definition for adding a new row.
     */
    public getAddRowTool(name: string = "add_row", description: string = "Add a new row to the table. Use column IDs (col_XXX) as keys."): AgentableAgentTool {
        const parameters = z.object(this.getBaseColumnSchemas());
        return {
            name,
            description,
            parameters,
            execute: async (args: any) => {
                // Check policy
                const allow = this.manager.getAgentable().policy?.permissions?.allowAgentCreate ?? true;
                if (!allow) return "Permission Denied: Agent is not allowed to create rows.";

                try {
                    const row = this.manager.addRow(args);
                    return `Success: Added row with ID ${row.id}`;
                } catch (error: any) {
                    return `Validation Error: ${error.message}`;
                }
            }
        };
    }

    /**
     * Tool definition for updating an existing row.
     */
    public getUpdateRowTool(name: string = "update_row", description: string = "Update an existing row. Pass row_id along with the column IDs and data to update."): AgentableAgentTool {
        const baseSchemas = this.getBaseColumnSchemas();
        const optionalSchemas: Record<string, z.ZodTypeAny> = {};
        for (const [key, schema] of Object.entries(baseSchemas)) {
            optionalSchemas[key] = schema.optional();
        }

        const parameters = z.object({
            row_id: z.string().describe("The ID of the row to update"),
            ...optionalSchemas
        });

        return {
            name,
            description,
            parameters,
            execute: async (args: any) => {
                const { row_id, ...updates } = args;
                
                // Check policy
                const allow = this.manager.getAgentable().policy?.permissions?.allowAgentUpdate ?? true;
                if (!allow) return "Permission Denied: Agent is not allowed to update rows.";

                if (!row_id) return "Error: row_id is required.";

                try {
                    const row = this.manager.updateRow(row_id, updates);
                    return `Success: Updated row ${row.id}`;
                } catch (error: any) {
                    return `Validation Error: ${error.message}`;
                }
            }
        };
    }

    /**
     * Tool definition for adding a new option to a select column.
     */
    public getAddOptionTool(name: string = "add_select_option", description: string = "Add a new option to a select column."): AgentableAgentTool {
        const parameters = z.object({
            column_id: z.string().describe("The ID of the select column"),
            value: z.string().describe("The new option value to add"),
            color: z.string().optional().describe("Optional UI color hint for the option (e.g., 'red', '#ff0000')")
        });

        return {
            name,
            description,
            parameters,
            execute: async (args: any) => {
                const { column_id, value, color } = args;
                
                // Check policy (Assume update permission is required to modify column options)
                const allow = this.manager.getAgentable().policy?.permissions?.allowAgentUpdate ?? true;
                if (!allow) return "Permission Denied: Agent is not allowed to update columns.";

                if (!column_id || !value) return "Error: column_id and value are required.";

                try {
                    this.manager.addOptionToColumn(column_id, value, color);
                    return `Success: Added option "${value}" to column ${column_id}`;
                } catch (error: any) {
                    return `Validation Error: ${error.message}`;
                }
            }
        };
    }

    /**
     * Tool definition for adding a new column.
     */
    public getAddColumnTool(name: string = "add_column", description: string = "Add a new column to the table structure."): AgentableAgentTool {
        const parameters = z.object({
            name: z.string().describe("The name of the column"),
            type: z.enum(["text", "number", "select", "date", "boolean", "url", "link"]).describe("The type of data this column stores"),
            description: z.string().optional().describe("Optional semantic description of what this column represents")
        });

        return {
            name,
            description,
            parameters,
            execute: async (args: any) => {
                const allow = this.manager.getAgentable().policy?.permissions?.allowAgentCreate ?? true;
                if (!allow) return "Permission Denied: Agent is not allowed to create columns.";

                try {
                    const col = this.manager.addColumn(args);
                    return `Success: Added column "${col.name}" with ID ${col.id}`;
                } catch (error: any) {
                    return `Error: ${error.message}`;
                }
            }
        };
    }

    /**
     * Tool definition for updating a column.
     */
    public getUpdateColumnTool(name: string = "update_column", description: string = "Update an existing column (rename, change type, or description)."): AgentableAgentTool {
        const parameters = z.object({
            column_id: z.string().describe("The ID of the column to update"),
            name: z.string().optional().describe("New name for the column"),
            type: z.enum(["text", "number", "select", "date", "boolean", "url", "link"]).optional().describe("New type for the column"),
            description: z.string().optional().describe("New description for the column")
        });

        return {
            name,
            description,
            parameters,
            execute: async (args: any) => {
                const { column_id, ...updates } = args;
                const allow = this.manager.getAgentable().policy?.permissions?.allowAgentUpdate ?? true;
                if (!allow) return "Permission Denied: Agent is not allowed to update columns.";

                try {
                    const col = this.manager.updateColumn(column_id, updates);
                    return `Success: Updated column ${col.id}`;
                } catch (error: any) {
                    return `Error: ${error.message}`;
                }
            }
        };
    }

    /**
     * Tool definition for deleting a column.
     */
    public getDeleteColumnTool(name: string = "delete_column", description: string = "Delete a column and all its data from the table."): AgentableAgentTool {
        const parameters = z.object({
            column_id: z.string().describe("The ID of the column to delete")
        });

        return {
            name,
            description,
            parameters,
            execute: async (args: any) => {
                const allow = this.manager.getAgentable().policy?.permissions?.allowAgentDelete ?? true;
                if (!allow) return "Permission Denied: Agent is not allowed to delete columns.";

                try {
                    this.manager.deleteColumn(args.column_id);
                    return `Success: Deleted column ${args.column_id}`;
                } catch (error: any) {
                    return `Error: ${error.message}`;
                }
            }
        };
    }

    /**
     * Tool definition for managing views.
     */
    public getCreateViewTool(name: string = "create_view", description: string = "Create a new saved view of the table."): AgentableAgentTool {
        const parameters = z.object({
            name: z.string().describe("The name of the view")
        });

        return {
            name,
            description,
            parameters,
            execute: async (args: any) => {
                const allow = this.manager.getAgentable().policy?.permissions?.allowAgentCreate ?? true;
                if (!allow) return "Permission Denied: Agent is not allowed to create views.";

                try {
                    const view = this.manager.createView(args.name);
                    return `Success: Created view "${view.name}" with ID ${view.id}`;
                } catch (error: any) {
                    return `Error: ${error.message}`;
                }
            }
        };
    }

    /**
     * Tool definition for adding a filter to a view.
     */
    public getAddFilterTool(name: string = "add_view_filter", description: string = "Add a filter to a specific view."): AgentableAgentTool {
        const parameters = z.object({
            view_id: z.string().describe("The ID of the view"),
            column_id: z.string().describe("The ID of the column to filter by"),
            operator: z.enum(["is", "isNot", "contains", "startsWith", "endsWith", "gt", "lt", "isEmpty", "isNotEmpty"]).describe("The filter operator"),
            value: z.any().describe("The value to compare against")
        });

        return {
            name,
            description,
            parameters,
            execute: async (args: any) => {
                const { view_id, column_id, operator, value } = args;
                const allow = this.manager.getAgentable().policy?.permissions?.allowAgentUpdate ?? true;
                if (!allow) return "Permission Denied: Agent is not allowed to update views.";

                try {
                    const filter = this.manager.addFilter(view_id, { columnId: column_id, operator, value });
                    return `Success: Added filter to view ${view_id}`;
                } catch (error: any) {
                    return `Error: ${error.message}`;
                }
            }
        };
    }

    /**
     * Tool definition for adding a sort to a view.
     */
    public getAddSortTool(name: string = "add_view_sort", description: string = "Add a sorting rule to a specific view."): AgentableAgentTool {
        const parameters = z.object({
            view_id: z.string().describe("The ID of the view"),
            column_id: z.string().describe("The ID of the column to sort by"),
            direction: z.enum(["asc", "desc"]).describe("Sort direction")
        });

        return {
            name,
            description,
            parameters,
            execute: async (args: any) => {
                const { view_id, column_id, direction } = args;
                const allow = this.manager.getAgentable().policy?.permissions?.allowAgentUpdate ?? true;
                if (!allow) return "Permission Denied: Agent is not allowed to update views.";

                try {
                    const sort = this.manager.addSort(view_id, { columnId: column_id, direction });
                    return `Success: Added sort to view ${view_id}`;
                } catch (error: any) {
                    return `Error: ${error.message}`;
                }
            }
        };
    }

    /**
     * Tool definition for updating table metadata.
     */
    public getUpdateMetadataTool(name: string = "update_table_metadata", description: string = "Update the table title or description."): AgentableAgentTool {
        const parameters = z.object({
            title: z.string().optional().describe("The new title for the table"),
            description: z.string().optional().describe("The new description for the table")
        });

        return {
            name,
            description,
            parameters,
            execute: async (args: any) => {
                const allow = this.manager.getAgentable().policy?.permissions?.allowAgentUpdate ?? true;
                if (!allow) return "Permission Denied: Agent is not allowed to update table metadata.";

                try {
                    this.manager.updateMetadata(args);
                    return "Success: Updated table metadata";
                } catch (error: any) {
                    return `Error: ${error.message}`;
                }
            }
        };
    }

    /**
     * Vercel AI SDK Wrapper
     */
    public toVercel(tool: AgentableAgentTool) {
        return {
            description: tool.description,
            parameters: tool.parameters,
            execute: tool.execute,
        };
    }

    /**
     * OpenAI Function Wrapper (Strict Mode)
     */
    public toOpenAI(tool: AgentableAgentTool) {
        const jsonSchema = zodToJsonSchema(tool.parameters as any, { target: "openAi" });

        return {
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: jsonSchema,
                strict: true
            }
        };
    }

    /**
     * Anthropic Tool Wrapper
     */
    public toAnthropic(tool: AgentableAgentTool) {
        const jsonSchema = zodToJsonSchema(tool.parameters as any);

        // Remove $schema if present, as Anthropic doesn't strictly need it in input_schema
        // @ts-ignore
        delete jsonSchema.$schema;

        return {
            name: tool.name,
            description: tool.description,
            input_schema: jsonSchema
        };
    }

    // --- Legacy / Internal Tools ---

    public tool_addColumn(name: string, type: "text" | "number" | "select" | "date" | "boolean" | "url", description?: string): string {
        try {
            const col = this.manager.addColumn({ name, type, description });
            return `Success: Added column "${col.name}" with ID ${col.id}`;
        } catch (e: any) {
            return `Error: ${e.message}`;
        }
    }

    public tool_deleteRow(rowId: string): string {
        try {
            this.manager.deleteRow(rowId);
            return `Success: Deleted row ${rowId}`;
        } catch (e: any) {
            return `Error: ${e.message}`;
        }
    }
}
