import { z } from "zod";

/**
 * AGENTABLE v1.0.0 - JSON Agentic Table Standard
 * Zod Schemas
 */

// --- Base Types ---

// Base36 string
export const AgentableBase36Schema = z.string().length(12).regex(/^[a-z0-9]+$/);

export type AgentableBase36 = z.infer<typeof AgentableBase36Schema>;

export const AgentableColumnTypeSchema = z.enum([
    "text",
    "number",
    "select",
    "date",
    "boolean",
    "url",
]);

export type AgentableColumnType = z.infer<typeof AgentableColumnTypeSchema>;

export const AgentableOptionSchema = z.object({
    value: z.string(),
    color: z.string().optional(), // UI hint: "red", "#ff0000", etc.
});

export type AgentableOption = z.infer<typeof AgentableOptionSchema>;

// --- Column Schema ---

export const AgentableColumnSchema = z.object({
    id: z.custom<`col_${string}`>((val) => typeof val === "string" && val.startsWith("col_")),
    name: z.string(),
    type: AgentableColumnTypeSchema,
    description: z.string().optional(), // Optional: Only provide if the Agent needs extra context
    display: z.object({
        width: z.number().optional(), // Optional: UI column width in pixels
        dateFormat: z.string().optional(), // Optional: Format string for UI display (e.g. "YYYY-MM-DD HH:mm")
    }).optional(),
    constraints: z.object({
        multiSelect: z.boolean().optional(),
        options: z.array(AgentableOptionSchema).optional(),
        required: z.boolean().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().optional(),
    }).optional(),
});

export type AgentableColumn = z.infer<typeof AgentableColumnSchema>;

// --- Filter Schema ---

export const AgentableFilterSchema = z.object({
    id: z.custom<`flt_${string}`>((val) => typeof val === "string" && val.startsWith("flt_")),
    columnId: z.string(),
    operator: z.enum(["is", "isNot", "contains", "gt", "lt", "isEmpty", "isNotEmpty"]),
    value: z.any(),
});

export type AgentableFilter = z.infer<typeof AgentableFilterSchema>;

// --- Sort Schema ---

export const AgentableSortSchema = z.object({
    columnId: z.string(),
    direction: z.enum(["asc", "desc"]),
});

export type AgentableSort = z.infer<typeof AgentableSortSchema>;

// --- View Schema ---

export const AgentableViewSchema = z.object({
    id: z.custom<`view_${string}`>((val) => typeof val === "string" && val.startsWith("view_")),
    name: z.string(),
    description: z.string().optional(), // Optional
    filters: z.array(AgentableFilterSchema),
    sorts: z.array(AgentableSortSchema),
    hiddenColumns: z.array(z.string()),
    columnOrder: z.array(z.string()),
});

export type AgentableView = z.infer<typeof AgentableViewSchema>;

// --- Row Schema ---

export const AgentableRowSchema = z.object({
    id: AgentableBase36Schema, // 9 Time + 3 Random (Base36 alphanumeric)
    cells: z.record(z.string(), z.any()), // Keyed by col_id
});

export type AgentableRow = z.infer<typeof AgentableRowSchema>;

// --- Main AGENTABLE Schema ---

export const AgentableSchemaSchema = z.object({
    version: z.literal("agentable-1.0.0"),
    metadata: z.object({
        title: z.string(),
        description: z.string().optional(),
    }),
    policy: z.object({
        permissions: z.object({
            allowAgentRead: z.boolean().optional(),
            allowAgentCreate: z.boolean().optional(),
            allowAgentUpdate: z.boolean().optional(),
            allowAgentDelete: z.boolean().optional(),
        }).optional(),
    }).optional(),
    columns: z.array(AgentableColumnSchema),
    views: z.array(AgentableViewSchema),
    rows: z.array(AgentableRowSchema),
});

export type AgentableSchema = z.infer<typeof AgentableSchemaSchema>;
