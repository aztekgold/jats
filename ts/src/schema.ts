import { z } from "zod";

/**
 * JATS v1.0.0 - JSON Agentic Table Standard
 * Zod Schemas
 */

// --- Base Types ---

// Base32 string
export const JatsBase32Schema = z.string();

export type JatsBase32 = z.infer<typeof JatsBase32Schema>;

export const JatsColumnTypeSchema = z.enum([
    "text",
    "number",
    "select",
    "date",
    "boolean",
    "url",
]);

export type JatsColumnType = z.infer<typeof JatsColumnTypeSchema>;

export const JatsOptionSchema = z.object({
    value: z.string(),
    color: z.string().optional(), // UI hint: "red", "#ff0000", etc.
});

export type JatsOption = z.infer<typeof JatsOptionSchema>;

// --- Column Schema ---

export const JatsColumnSchema = z.object({
    id: z.custom<`col_${string}`>((val) => typeof val === "string" && val.startsWith("col_")),
    name: z.string(),
    type: JatsColumnTypeSchema,
    description: z.string().optional(), // Optional: Only provide if the Agent needs extra context
    display: z.object({
        width: z.number().optional(), // Optional: UI column width in pixels
        dateFormat: z.string().optional(), // Optional: Format string for UI display (e.g. "YYYY-MM-DD HH:mm")
    }).optional(),
    constraints: z.object({
        multiSelect: z.boolean().optional(),
        options: z.array(JatsOptionSchema).optional(),
        required: z.boolean().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().optional(),
    }).optional(),
});

export type JatsColumn = z.infer<typeof JatsColumnSchema>;

// --- Filter Schema ---

export const JatsFilterSchema = z.object({
    id: z.custom<`flt_${string}`>((val) => typeof val === "string" && val.startsWith("flt_")),
    columnId: z.string(),
    operator: z.enum(["is", "isNot", "contains", "gt", "lt", "isEmpty", "isNotEmpty"]),
    value: z.any(),
});

export type JatsFilter = z.infer<typeof JatsFilterSchema>;

// --- Sort Schema ---

export const JatsSortSchema = z.object({
    columnId: z.string(),
    direction: z.enum(["asc", "desc"]),
});

export type JatsSort = z.infer<typeof JatsSortSchema>;

// --- View Schema ---

export const JatsViewSchema = z.object({
    id: z.custom<`view_${string}`>((val) => typeof val === "string" && val.startsWith("view_")),
    name: z.string(),
    description: z.string().optional(), // Optional
    filters: z.array(JatsFilterSchema),
    sorts: z.array(JatsSortSchema),
    hiddenColumns: z.array(z.string()),
    columnOrder: z.array(z.string()),
});

export type JatsView = z.infer<typeof JatsViewSchema>;

// --- Row Schema ---

export const JatsRowSchema = z.object({
    id: JatsBase32Schema, // 10 Time + 3 Random (Crockford Base32)
    cells: z.record(z.string(), z.any()), // Keyed by col_id
});

export type JatsRow = z.infer<typeof JatsRowSchema>;

// --- Main JATS Schema ---

export const JatsSchemaSchema = z.object({
    version: z.literal("1.0.0"),
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
    columns: z.array(JatsColumnSchema),
    views: z.array(JatsViewSchema),
    rows: z.array(JatsRowSchema),
});

export type JatsSchema = z.infer<typeof JatsSchemaSchema>;
