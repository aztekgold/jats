import { JatsSchema, JatsSchemaSchema } from "./schema";

/**
 * Validates a JATS schema against the Zod definition.
 * Throws validation errors if the schema is invalid.
 */
export function validateJats(data: unknown): JatsSchema {
    return JatsSchemaSchema.parse(data);
}

/**
 * Basic migration function.
 * Currently, simply ensures the version is set to 1.0.0 if missing,
 * assuming the rest of the structure is compatible.
 * 
 * Future versions will include switch/case logic for v1 -> v2 upgrades.
 */
export function migrateJats(data: any): JatsSchema {
    if (!data || typeof data !== 'object') {
        throw new Error("Invalid JATS data: Input must be an object.");
    }

    // Example simple migration: add version if missing
    if (!data.version) {
        data.version = "1.0.0";
    }

    // Example: Initialize arrays if missing
    if (!data.columns) data.columns = [];
    if (!data.views) data.views = [];
    if (!data.rows) data.rows = [];
    if (!data.metadata) data.metadata = { title: "Migrated Table" };

    // Validate the final result
    try {
        return validateJats(data);
    } catch (error) {
        // Enhance error message if possible, or rethrow
        throw new Error(`Migration failed validation: ${error instanceof Error ? error.message : String(error)}`);
    }
}
