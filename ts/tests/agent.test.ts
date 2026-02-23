import { describe, it, expect } from "vitest";
import { AgentableManager } from "../src/manager";
import { AgentableAgent } from "../src/agent";

describe("AgentableAgent Dynamic Tooling", () => {
    it("should generate correct parameters for OpenAI", () => {
        const manager = new AgentableManager();
        manager.addColumn({ name: "Task", type: "text", constraints: { required: true } });
        manager.addColumn({ name: "Count", type: "number" });

        const agent = new AgentableAgent(manager);
        const tool = agent.toOpenAI(agent.getAddRowTool("add_row", "Add a row"));

        expect(tool.function.name).toBe("add_row");
        expect(tool.function.strict).toBe(true);

        const params = tool.function.parameters as any;
        expect(params.type).toBe("object");
        expect(params.additionalProperties).toBe(false);

        // Check properties
        const props = params.properties;
        const colIds = manager.getAgentable().columns.map(c => c.id);

        expect(props[colIds[0]].type).toBe("string");
        expect(props[colIds[1]].type).toEqual(["number", "null"]);

        // Strict mode requires all properties to be in required array
        expect(params.required).toContain(colIds[0]);
    });

    it("should generate correct parameters for Anthropic", () => {
        const manager = new AgentableManager();
        manager.addColumn({
            name: "Status",
            type: "select",
            constraints: {
                options: [{ value: "todo" }, { value: "done" }],
                multiSelect: true
            }
        });

        const agent = new AgentableAgent(manager);
        const tool = agent.toAnthropic(agent.getAddRowTool("update_status", "Update status"));

        const props = (tool.input_schema as any).properties;
        const colId = manager.getAgentable().columns[0].id;

        expect(props[colId].type).toBe("array");
        expect(props[colId].description).toContain("List of: Column: Status");
    });

    it("should include date format in table description", () => {
        const manager = new AgentableManager();
        manager.addColumn({
            name: "Deadline",
            type: "date",
            display: { dateFormat: "YYYY-MM-DD" }
        });

        const agent = new AgentableAgent(manager);
        const desc = agent.describeTable();

        expect(desc).toContain("**Deadline** (date)");
        expect(desc).toContain("Date Format: YYYY-MM-DD");
    });

    describe("Update Row Tool", () => {
        it("should generate update_row parameters correctly", () => {
            const manager = new AgentableManager();
            manager.addColumn({ name: "Task", type: "text", constraints: { required: true } });

            const agent = new AgentableAgent(manager);
            const tool = agent.getUpdateRowTool();

            // Should contain row_id and optional Task column
            const props = (tool.parameters as any).shape;
            expect(props.row_id).toBeDefined();

            const colId = manager.getAgentable().columns[0].id;
            expect(props[colId].isOptional()).toBe(true);
        });

        it("should allow update when permissions are true or default", async () => {
            const manager = new AgentableManager();
            const col = manager.addColumn({ name: "Task", type: "text" });
            const row = manager.addRow({ [col.id]: "Initial" });

            const agent = new AgentableAgent(manager);
            const tool = agent.getUpdateRowTool();

            const result = await tool.execute({
                row_id: row.id,
                [col.id]: "Updated"
            });

            expect(result).toContain("Success");
            expect(manager.getAgentable().rows[0].cells[col.id]).toBe("Updated");
        });

        it("should deny update when permissions explicitly false", async () => {
            const manager = new AgentableManager({
                policy: {
                    permissions: {
                        allowAgentUpdate: false
                    }
                }
            });
            const col = manager.addColumn({ name: "Task", type: "text" });
            const row = manager.addRow({ [col.id]: "Initial" });

            const agent = new AgentableAgent(manager);
            const tool = agent.getUpdateRowTool();

            const result = await tool.execute({
                row_id: row.id,
                [col.id]: "Updated"
            });

            expect(result).toContain("Permission Denied");
            expect(manager.getAgentable().rows[0].cells[col.id]).toBe("Initial");
        });
    });

    describe("Add Select Option Tool", () => {
        it("should generate add_select_option parameters correctly", () => {
            const manager = new AgentableManager();
            const agent = new AgentableAgent(manager);
            const tool = agent.getAddOptionTool();

            const props = (tool.parameters as any).shape;
            expect(props.column_id).toBeDefined();
            expect(props.value).toBeDefined();
            expect(props.color.isOptional()).toBe(true);
        });

        it("should allow adding an option when permissions are true", async () => {
            const manager = new AgentableManager();
            const col = manager.addColumn({ name: "Status", type: "select" });

            const agent = new AgentableAgent(manager);
            const tool = agent.getAddOptionTool();

            const result = await tool.execute({
                column_id: col.id,
                value: "In Progress",
                color: "blue"
            });

            expect(result).toContain("Success");
            expect(manager.getAgentable().columns[0].constraints?.options?.[0]).toMatchObject({
                value: "In Progress",
                color: "blue"
            });
        });

        it("should deny adding an option when permissions explicitly false", async () => {
            const manager = new AgentableManager({
                policy: {
                    permissions: { allowAgentUpdate: false }
                }
            });
            const col = manager.addColumn({ name: "Status", type: "select" });

            const agent = new AgentableAgent(manager);
            const tool = agent.getAddOptionTool();

            const result = await tool.execute({
                column_id: col.id,
                value: "In Progress"
            });

            expect(result).toContain("Permission Denied");
            expect(manager.getAgentable().columns[0].constraints?.options).toBeUndefined();
        });
    });
});
