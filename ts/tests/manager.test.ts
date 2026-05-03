import { describe, it, expect, vi } from "vitest";
import { AgentableManager } from "../src/manager";
import { AgentableAgent } from "../src/agent";
import { validateAgentable } from "../src/migrate";

describe("AgentableManager", () => {
    it("should initialize with a default schema", () => {
        const manager = new AgentableManager();
        const schema = manager.getAgentable();
        expect(schema.version).toBe("agentable-1.0.0");
        expect(schema.columns).toHaveLength(0);
        expect(schema.rows).toHaveLength(0);
    });

    describe("ID Collision Prevention", () => {
        it("should prevent column ID collisions", () => {
            const manager = new AgentableManager();

            // Math.random() is used to generate the 3 char suffix.
            // We'll mock it to return the same value twice, then a different value.
            let callCount = 0;
            const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
                callCount++;
                // 0.5 * 36 is 18 (s). So this produces "s" repeated 3 times.
                // e.g. "col_sss"
                if (callCount <= 6) return 0.5;
                // Then it will produce "a" repeated 3 times (0.27 * 36 = ~10 -> "a")
                return 0.27;
            });

            manager.addColumn({ name: "Col 1", type: "text" }); // Gets col_sss
            const col2 = manager.addColumn({ name: "Col 2", type: "text" }); // Collides, loops, gets col_aaa

            expect(col2.id).not.toBe("col_sss");

            randomSpy.mockRestore();
        });

        it("should prevent row ID collisions", () => {
            const manager = new AgentableManager();
            manager.addColumn({ name: "Col 1", type: "text" });

            // Date.now() controls the 9 char prefix. Math.random controls the 3 char suffix.
            const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1600000000000); // Fixed time

            let callCount = 0;
            const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
                callCount++;
                if (callCount <= 6) return 0.5; // "sss"
                return 0.27; // "aaa"
            });

            const row1 = manager.addRow({}); // Time + sss
            const row2 = manager.addRow({}); // Collides, loops, gets Time + aaa

            expect(row1.id).not.toBe(row2.id);

            nowSpy.mockRestore();
            randomSpy.mockRestore();
        });
    });

    it("should add a column successfully", () => {
        const manager = new AgentableManager();
        const col = manager.addColumn({ name: "Name", type: "text" });
        expect(col.id).toMatch(/^col_[a-z0-9]{3}$/);
        expect(manager.getAgentable().columns).toHaveLength(1);
    });

    it("should add a row successfully", () => {
        const manager = new AgentableManager();
        const col = manager.addColumn({ name: "Name", type: "text" });
        const row = manager.addRow({ [col.id]: "Alice" });
        expect(row.id).toHaveLength(12); // 9 time + 3 random
        expect(row.id).toMatch(/^[a-z0-9]+$/); // Base36
        expect(manager.getAgentable().rows).toHaveLength(1);
        expect(row.cells[col.id]).toBe("Alice");
    });

    it("should CRUD columns", () => {
        const manager = new AgentableManager();
        const col = manager.addColumn({ name: "Temp", type: "number" });
        expect(manager.getColumn(col.id)).toBeDefined();

        manager.updateColumn(col.id, { name: "Updated" });
        expect(manager.getColumn(col.id)?.name).toBe("Updated");

        manager.deleteColumn(col.id);
        expect(manager.getColumn(col.id)).toBeUndefined();
    });

    it("should add options to select columns", () => {
        const manager = new AgentableManager();
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
        const manager = new AgentableManager();
        const row = manager.addRow({});
        expect(manager.getAgentable().rows).toHaveLength(1);
        manager.deleteRow(row.id);
        expect(manager.getAgentable().rows).toHaveLength(0);
    });

    it("should move rows", () => {
        const manager = new AgentableManager();
        const r1 = manager.addRow({ name: "Row 1" });
        const r2 = manager.addRow({ name: "Row 2" });
        const r3 = manager.addRow({ name: "Row 3" });

        // Initial: [r1, r2, r3]
        manager.moveRow(r1.id, 1);
        // Result: [r2, r1, r3]
        const rows = manager.getAgentable().rows;
        expect(rows[0].id).toBe(r2.id);
        expect(rows[1].id).toBe(r1.id);
        expect(rows[2].id).toBe(r3.id);
    });

    it("should handle column visibility", () => {
        const manager = new AgentableManager();
        const col = manager.addColumn({ name: "Secret", type: "text" });
        const view = manager.createView("Public View");

        expect(view.hiddenColumns).not.toContain(col.id);
        
        manager.setColumnVisibility(view.id, col.id, false);
        expect(view.hiddenColumns).toContain(col.id);

        manager.setColumnVisibility(view.id, col.id, true);
        expect(view.hiddenColumns).not.toContain(col.id);
    });

    it("should create views and handle sorts", () => {
        const manager = new AgentableManager();
        const col = manager.addColumn({ name: "Name", type: "text" });
        const view = manager.createView("My View");
        
        expect(view.id).toMatch(/^view_[a-z0-9]{3}$/);
        expect(view.name).toBe("My View");
        expect(view.sorts).toHaveLength(0);

        // Manually add a sort (since manager doesn't have a helper yet)
        view.sorts.push({
            id: "srt_123",
            columnId: col.id,
            direction: "asc"
        });

        expect(() => validateAgentable(manager.getAgentable())).not.toThrow();
    });

    it("should validate ISO-8601 UTC dates", () => {
        const manager = new AgentableManager();
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

describe("AgentableAgent", () => {
    it("should provide a markdown description", () => {
        const manager = new AgentableManager();
        manager.addColumn({ name: "Status", type: "boolean", constraints: { options: [{ value: "Open" }] } });
        const agent = new AgentableAgent(manager);
        const desc = agent.describeTable();
        expect(desc).toContain("# New Table");
        expect(desc).toContain("**Status** (boolean)");
        expect(desc).toContain("Options: Open");
    });

    it("should allow tool usage", () => {
        const manager = new AgentableManager();
        const agent = new AgentableAgent(manager);

        const result = agent.tool_addColumn("Age", "number");
        expect(result).toContain("Success");
        expect(manager.getAgentable().columns).toHaveLength(1);
    });
});
