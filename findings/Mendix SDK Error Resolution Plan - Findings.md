# Mendix MCP Integration: Diagnostic & Remediation

**Context:** This document serves as a persistent knowledge artifact for the Google Antigravity workspace. It documents the critical TypeError encountered during Mendix Model SDK integration and the architectural solutions required to resolve it.

---

## Part 1: Error Review Report

**Incident ID:** AG-ERR-2024-MX-001  
**Source:** MCP Server (mendix-mcp) via Google Antigravity  
**Operation:** `read_domain_model` (Tool Invocation)

### Symptom
When the Antigravity agent attempts to read the Mendix Domain Model using the `mendixmodelsdk`, the MCP server process crashes or returns a fatal exception, preventing the agent from inspecting the application structure.

### Stack Trace / Error Log
```text
Error: JSON-RPC Internal Error
Code: -32603 (Internal Error)
Message: TypeError: Converting circular structure to JSON
    --> starting at object with constructor 'Entity'
    |     property 'container' -> object with constructor 'DomainModel'
    |     property 'entities' -> object with constructor 'Array'
    |     index 0 -> object with constructor 'Entity'
    --- property 'container' closes the circle

at JSON.stringify (<anonymous>)
at write (node:internal/stream_base_commons:94:21)
at ServerTransport.send (node_modules/@modelcontextprotocol/sdk/dist/server/stdio.js:45:12)
at ToolHandler.call (src/tools/mendixTools.ts:85:12)
```

### Root Cause Analysis
The Mendix Model SDK represents the application model as a **bi-directional graph**, not a tree.

1.  **Cycles:** Every element (e.g., `Entity`) contains a reference to its parent (`container`), and the parent contains a reference to the element.
2.  **Serialization:** The MCP protocol uses JSON-RPC, which relies on `JSON.stringify()`. This method cannot handle cyclic graphs and throws a `TypeError` when it encounters one.
3.  **Agent Failure:** The crash occurs before data reaches the agent, leaving it "blind" to the model structure.

---

## Part 2: Technical Remediation Report

**Objective:** Enable safe, non-circular serialization of Mendix Metamodel elements for MCP consumption.

### Executive Summary
To resolve the `TypeError: Converting circular structure to JSON`, the MCP server must **not** return raw Mendix SDK objects. Instead, it must implement a **Data Transfer Object (DTO) Transformation Layer**. This layer extracts only specific, necessary properties (Whitelisting) and constructs a simplified, acyclic JSON tree for the AI agent.

### 1. The Core Problem: Graph vs. Tree
The Mendix Metamodel is designed for navigation, not serialization.

*   **Mendix Structure:** `Entity <--> DomainModel` (Cycle)
*   **JSON Requirement:** `DomainModel --> Entity` (Tree)

Attempting to "fix" this by deleting properties (Blacklisting) is unreliable due to internal MobX state properties in the SDK.

### 2. Remediation Strategy: DTO Pattern
We must implement mapper functions that convert complex SDK objects into simple JSON objects.

#### 2.1 Recommended DTO Interfaces

```typescript
// Safe, acyclic representations of Mendix elements
interface DomainModelDTO {
    id: string;
    moduleName: string;
    entities: EntityDTO[];
    associations: AssociationDTO[]; // Associations stored separately to avoid nesting loops
}

interface EntityDTO {
    name: string;
    documentation: string;
    location: { x: number; y: number };
    attributes: AttributeDTO[];
    generalization?: string; // Store name only, not the object reference
}

interface AttributeDTO {
    name: string;
    type: string; // e.g., "String", "Integer"
    defaultValue?: string;
}

interface AssociationDTO {
    name: string;
    source: string; // Entity Name
    target: string; // Entity Name
    type: string; // "Reference" or "ReferenceSet"
}
```

#### 2.2 Implementation Example
The following code demonstrates how to implement the fix in the MCP server `src/index.ts`.

```typescript
import { domainmodels } from "mendixmodelsdk";

// Mapper Function: Converts SDK Entity to Safe JSON
function mapEntity(entity: domainmodels.Entity): EntityDTO {
    return {
        name: entity.name,
        documentation: entity.documentation,
        location: { x: entity.location.x, y: entity.location.y },
        attributes: entity.attributes.map(attr => ({
            name: attr.name,
            type: attr.type.structureTypeName.split('$').pop() || "Unknown",
            defaultValue: attr.value?.defaultValue
        })),
        generalization: entity.generalization?.generalizationQualifiedName
    };
}

// MCP Tool Definition
server.tool(
    "get_domain_model",
    { moduleName: z.string() },
    async ({ moduleName }) => {
        //... (Load model logic)...

        const domainModelInterface = model.allDomainModels()
           .find(dm => dm.containerAsModule.name === moduleName);
        
        // Critical: Load the unit into memory
        const domainModel = await domainModelInterface.load();

        // Critical: Map to DTOs before returning
        // DO NOT return 'domainModel' directly!
        const safeOutput: DomainModelDTO = {
            id: domainModel.id,
            moduleName: moduleName,
            entities: domainModel.entities.map(mapEntity),
            associations: domainModel.associations.map(assoc => ({
                name: assoc.name,
                source: assoc.parent.name, // Simplified mapping
                target: assoc.child.name,
                type: assoc.type.structureTypeName
            }))
        };

        return {
            content: [
                { type: "text", text: JSON.stringify(safeOutput, null, 2) }
            ]
        };
    }
);
```

### 3. Environment Configuration for Antigravity
To ensure the MCP server runs correctly within Google Antigravity's isolated environment:

1.  **Environment Variables:** The Mendix Personal Access Token (PAT) must be explicitly injected. It is NOT inherited from the host shell.
2.  **Config File:** `mcp_config.json`

```json
{
  "mcpServers": {
    "mendix-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/project/build/index.js"],
      "env": {
        "MENDIX_TOKEN": "YOUR_PAT_TOKEN",
        "MENDIX_USERNAME": "user@example.com"
      }
    }
  }
}
```

### 4. Performance Optimization: Granular Loading
Do not create a tool that returns the entire application model. It will overflow the LLM context window.

*   **Good:** `get_modules_list` -> `get_domain_model(module)` -> `get_entity(name)`
*   **Bad:** `get_all_app_data()`

### 5. Summary of Fix
1.  Stop returning raw Mendix objects.
2.  Create DTO interfaces for Entities, Attributes, and Associations.
3.  Map the data using a helper function.
4.  Inject the `MENDIX_TOKEN` in `mcp_config.json`.
