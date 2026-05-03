import { AgentableManager } from "./manager";
import { AgentableAgent } from "./agent";
import { validateAgentable, migrateAgentable } from "./migrate";
import * as AgentableTypes from "./schema";

export {
    AgentableManager as Manager,
    AgentableAgent as Agent,
    validateAgentable as Validate,
    migrateAgentable as Migrate,
    AgentableTypes as Types
};

export const createTable = (initialSchema?: Partial<AgentableTypes.AgentableSchema>) => new AgentableManager(initialSchema);
