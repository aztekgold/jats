# AGENTABLE - TypeScript

This is the official TypeScript package for [AGENTABLE](https://github.com/aztekgold/agentable), the Agentic Table Standard. It is a platform-agnostic, AI-first format for structured data tables.

## Installation

```bash
npm install @aztekgold/agentable
```

## Available Exports

This package exposes the core schemas, ID generation utilities, an agent interface wrapper, and standard table managing abstractions for AGENTABLE.

### `Manager`
An abstraction over the data store to safely manipulate rows, columns, and views while maintaining AGENTABLE schema constraints.

```typescript
import { Manager } from "agentable";

// ... initialize manager with table data ...
```

### `Agent`
A toolset used to quickly expose AGENTABLE schema logic safely to Large Language Models formatted specifically for your AI SDK.

```typescript
import { Agent } from "agentable";

// Define agent with specific read/write capabilities based on AGENTABLE policy
```

### `Types`
TypeScript interfaces for columns, rows, views, and core AGENTABLE components.

```typescript
import { Types } from "agentable";

const myColumn: Types.AgentableColumn = {
  id: "col_a1b",
  name: "Status",
  type: "select"
};
```

### Other Utilities
```typescript
import { Validate, Migrate } from "agentable";

// Apply schema validation or migrations to raw JSON parsed data
```

## Contributing
See the top-level repository for complete specification and examples.
