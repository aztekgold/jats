import * as fs from 'fs';
import * as path from 'path';
import { AgentableSchema, AgentableSchemaSchema, AgentableColumn, AgentableRow, AgentableColumnType, AgentableOption } from '../schema';
import { generateRowId, generateColId } from '../utils';

function upgradeTable(inputPath: string, outputPath: string) {
    console.log(`Reading legacy v0.1 file from ${inputPath}...`);
    const rawData = fs.readFileSync(inputPath, 'utf8');
    const legacyData = JSON.parse(rawData);

    console.log(`Found ${legacyData.columns?.length || 0} columns and ${legacyData.rows?.length || 0} rows.`);

    const newColumns: AgentableColumn[] = [];
    const colTypes: Record<string, string> = {};
    const idMap: Record<string, string> = {};

    // Map columns
    for (const legacyCol of legacyData.columns || []) {
        let newType: AgentableColumnType = "text";
        let multiSelect = false;

        if (legacyCol.type === "dropdown") {
            newType = "select";
        } else if (legacyCol.type === "multiselect") {
            newType = "select";
            multiSelect = true;
        } else if (legacyCol.type === "checkbox") {
            newType = "boolean";
        } else if (legacyCol.type === "date") {
            newType = "date";
        } else if (legacyCol.type === "number") {
            newType = "number";
        } else if (legacyCol.type === "text" || legacyCol.type === "notelink") {
            newType = "text";
        }

        colTypes[legacyCol.id] = legacyCol.type;
        const normalizedId = generateColId();
        idMap[legacyCol.id] = normalizedId;

        const options: AgentableOption[] = (legacyCol.typeOptions?.options || []).map((opt: any) => ({
            value: opt.value,
            color: opt.style // Map style to color
        }));

        const newCol: AgentableColumn = {
            id: normalizedId as `col_${string}`,
            name: legacyCol.name,
            type: newType,
            display: {
                width: legacyCol.width,
            }
        };

        if (legacyCol.typeOptions?.dateFormat) {
            newCol.display!.dateFormat = legacyCol.typeOptions.dateFormat;
        }

        if (options.length > 0 || multiSelect) {
            newCol.constraints = {};
            if (options.length > 0) newCol.constraints.options = options;
            if (multiSelect) newCol.constraints.multiSelect = true;
        }

        newColumns.push(newCol);
    }

    // Map rows
    const newRows: AgentableRow[] = [];
    for (const legacyRow of legacyData.rows || []) {
        const cells: Record<string, any> = {};

        for (const cell of legacyRow) {
            let val = cell.value;
            const lType = colTypes[cell.column];
            const normalizedColId = idMap[cell.column] || cell.column;

            // Clean up values based on type
            if (lType === "checkbox") {
                val = val === "true" || val === true;
            } else if (val === "") {
                val = undefined;
            }

            if (val !== undefined) {
                cells[normalizedColId] = val;
            }
        }

        newRows.push({
            id: generateRowId(),
            cells
        });
    }

    // Construct final schema
    const atsData: AgentableSchema = {
        version: "agentable-1.0.0",
        metadata: {
            title: "Migrated Table",
            description: "Upgraded from v0.1 format"
        },
        columns: newColumns,
        views: [],
        rows: newRows
    };

    // Validate
    console.log("Validating upgraded schema...");
    const parsedData = AgentableSchemaSchema.parse({
        $schema: "https://raw.githubusercontent.com/aztekgold/agentable/main/schema.json",
        ...atsData
    });

    // Write output
    fs.writeFileSync(outputPath, JSON.stringify(parsedData, null, 4));
    console.log(`Successfully wrote v1.0.0 table strictly matching schema to ${outputPath} !`);
}

const inputPath = process.argv[2] || path.join(__dirname, '../../../tmp/v0.1.table.json');
const outputPath = process.argv[3] || path.join(__dirname, '../../../tmp/v1.0.table.json');

try {
    upgradeTable(inputPath, outputPath);
} catch (e: any) {
    if (e.errors) {
        console.error("Validation failed:\n", JSON.stringify(e.errors, null, 2));
    } else {
        console.error("Migration failed:", e.message || e);
    }
    process.exit(1);
}
