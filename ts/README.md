# AGENTABLE - TypeScript

This is the official TypeScript package for [AGENTABLE](https://github.com/aztekgold/agentable), the Agentic Table Standard. It is a platform-agnostic, AI-first format for structured data tables.

## Installation

```bash
npm install @aztekgold/agentable
```

## Available Exports

This package exposes the core schemas, ID generation utilities, an agent interface wrapper, and standard table managing abstractions for AGENTABLE.

### `AgentableManager`
An abstraction over the data store to safely manipulate rows, columns, and views while maintaining AGENTABLE schema constraints.

```typescript
import { AgentableManager } from "agentable";

// ... initialize manager with table data ...
```

### `AgentableAgent`
A toolset used to quickly expose AGENTABLE schema logic safely to Large Language Models formatted specifically for your AI SDK.

```typescript
import { AgentableAgent } from "agentable";

// Define agent with specific read/write capabilities based on AGENTABLE policy
```

### `AgentableTypes`
TypeScript interfaces for columns, rows, views, and core AGENTABLE components.

```typescript
import { AgentableTypes } from "agentable";

const myColumn: AgentableTypes.AgentableColumn = {
  id: "col_a1b",
  name: "Status",
  type: "select"
};
```

### Other Utilities
```typescript
import { validateAgentable, migrateAgentable } from "agentable";

// Apply schema validation or migrations to raw JSON parsed data
```

## Contributing
See the top-level repository for complete specification and examples.
