import { describe, it, expect } from "vitest";
import { JatsManager } from "../src/manager";
import { JatsAgent } from "../src/agent";
import { validateJats } from "../src/migrate";

describe("JatsManager", () => {
    it("should initialize with a default schema", () => {
        const manager = new JatsManager();
        const schema = manager.getJats();
        expect(schema.version).toBe("1.0.0");
        expect(schema.columns).toHaveLength(0);
        expect(schema.rows).toHaveLength(0);
    });

    it("should add a column successfully", () => {
        const manager = new JatsManager();
        const col = manager.addColumn({ name: "Name", type: "text" });
        expect(col.id).toMatch(/^col_[0-9A-Z]{3}$/);
        expect(manager.getJats().columns).toHaveLength(1);
    });

    it("should add a row successfully", () => {
        const manager = new JatsManager();
        const col = manager.addColumn({ name: "Name", type: "text" });
        const row = manager.addRow({ [col.id]: "Alice" });
        expect(row.id).toHaveLength(13); // 10 time + 3 random
        expect(manager.getJats().rows).toHaveLength(1);
        expect(row.cells[col.id]).toBe("Alice");
    });

    it("should CRUD columns", () => {
        const manager = new JatsManager();
        const col = manager.addColumn({ name: "Temp", type: "number" });
        expect(manager.getColumn(col.id)).toBeDefined();

        manager.updateColumn(col.id, { name: "Updated" });
        expect(manager.getColumn(col.id)?.name).toBe("Updated");

        manager.deleteColumn(col.id);
        expect(manager.getColumn(col.id)).toBeUndefined();
    });

    it("should add options to select columns", () => {
        const manager = new JatsManager();
        const col = manager.addColumn({ name: "Status", type: "select" });

        // Add new option
        manager.addOptionToColumn(col.id, "In Progress", "blue");
        const updatedCol = manager.getColumn(col.id);
        expect(updatedCol?.constraints?.options).toHaveLength(1);
        expect(updatedCol?.constraints?.options?.[0].value).toBe("In Progress");
        expect(updatedCol?.constraints?.options?.[0].color).toBe("blue");

        // Idempotency (duplicate)
        manager.addOptionToColumn(col.id, "In Progress", "red"); // Should ignore
        expect(manager.getColumn(col.id)?.constraints?.options).toHaveLength(1);

        // Error on non-select
        const numCol = manager.addColumn({ name: "Count", type: "number" });
        expect(() => manager.addOptionToColumn(numCol.id, "One")).toThrow("not a select column");
    });

    it("should delete rows", () => {
        const manager = new JatsManager();
        const row = manager.addRow({});
        expect(manager.getJats().rows).toHaveLength(1);
        manager.deleteRow(row.id);
        expect(manager.getJats().rows).toHaveLength(0);
    });

    it("should validate ISO-8601 UTC dates", () => {
        const manager = new JatsManager();
        const col = manager.addColumn({ name: "Due Date", type: "date" });

        // Valid dates
        expect(() => manager.addRow({ [col.id]: "2023-01-01T12:00:00Z" })).not.toThrow();
        expect(() => manager.addRow({ [col.id]: "2023-12-31T23:59:59.999Z" })).not.toThrow();

        // Invalid dates
        expect(() => manager.addRow({ [col.id]: "2023-01-01" })).toThrow("requires a valid ISO-8601 UTC string");
        expect(() => manager.addRow({ [col.id]: "01/01/2023" })).toThrow("requires a valid ISO-8601 UTC string");
        expect(() => manager.addRow({ [col.id]: "next tuesday" })).toThrow("requires a valid ISO-8601 UTC string");
    });
});

describe("JatsAgent", () => {
    it("should provide a markdown description", () => {
        const manager = new JatsManager();
        manager.addColumn({ name: "Status", type: "boolean", constraints: { options: [{ value: "Open" }] } });
        const agent = new JatsAgent(manager);
        const desc = agent.describeTable();
        expect(desc).toContain("# New Table");
        expect(desc).toContain("**Status** (boolean)");
        expect(desc).toContain("Options: Open");
    });

    it("should allow tool usage", () => {
        const manager = new JatsManager();
        const agent = new JatsAgent(manager);

        const result = agent.tool_addColumn("Age", "number");
        expect(result).toContain("Success");
        expect(manager.getJats().columns).toHaveLength(1);
    });
});
