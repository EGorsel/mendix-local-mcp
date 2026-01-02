import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MprReader } from "./mprReader.js";
import path from "path";

// Initialize Reader
const reader = new MprReader();
const cwd = process.cwd();
console.error(`Starting Mendix Local MCP Server in ${cwd}`);

const mprPath = reader.findMprFile(cwd);
if (mprPath) {
    try {
        reader.connect(mprPath);
        console.error(`Connected to Project: ${mprPath}`);
    } catch (e) {
        console.error(`Failed to connect to ${mprPath}`, e);
    }
} else {
    console.error("No .mpr file found in current directory (or subdirectories). Server running in disconnected mode.");
}

// Create MCP Server
const server = new Server(
    {
        name: "mendix-local-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

/**
 * Handler for ListTools
 */
/**
 * Handler for ListTools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "list_local_modules",
                description: "Lists all modules found in the opened .mpr file.",
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            },
            {
                name: "list_local_documents",
                description: "Lists all documents (Microflows, Pages, Snippets) found in the project. Can be filtered by module.",
                inputSchema: {
                    type: "object",
                    properties: {
                        module_name: {
                            type: "string",
                            description: "Optional: The name of the module to filter by."
                        }
                    }
                }
            },
            {
                name: "get_module_entities_sdk",
                description: "Retrieves entities from a module using the Official Mendix SDK (Requires Internet & PAT). Safer than local parsing.",
                inputSchema: {
                    type: "object",
                    properties: {
                        module_name: {
                            type: "string",
                            description: "The name of the module to inspect."
                        },
                        project_id: {
                            type: "string",
                            description: "The Mendix Project ID (App ID)."
                        },
                        branch: {
                            type: "string",
                            description: "The branch name (default: main)."
                        }
                    },
                    required: ["module_name", "project_id"]
                }
            },
            {
                name: "inspect_local_microflow",
                description: "Retrieves the simplified logical steps of a specific Microflow by name.",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Name of the microflow to inspect."
                        }
                    },
                    required: ["name"]
                }
            },
            {
                name: "get_domain_model",
                description: "Retrieves all entities and types from the Domain Model (optionally filtered by module).",
                inputSchema: {
                    type: "object",
                    properties: {
                        module_name: {
                            type: "string",
                            description: "Optional module name filter."
                        }
                    }
                }
            },
            {
                name: "inspect_database_schema",
                description: "Returns the column structure of a table in the local SQLite database. Useful for debugging Mendix internal storage.",
                inputSchema: {
                    type: "object",
                    properties: {
                        table_name: {
                            type: "string",
                            description: "Table name (default: Unit)",
                            default: "Unit"
                        }
                    }
                }
            }
        ]
    };
});

/**
 * Handler for CallTool
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        if (!reader) {
            throw new Error("Server not initialized correctly.");
        }

        if (request.params.name === "list_local_modules") {
            const modules = reader.getModules();
            return {
                content: [{ type: "text", text: JSON.stringify(modules, null, 2) }]
            };
        }

        if (request.params.name === "list_local_documents") {
            const moduleName = request.params.arguments?.module_name ? String(request.params.arguments.module_name) : undefined;
            const docs = reader.getDocuments(moduleName);
            // Return a summary (Name, Type) to save tokens
            const summary = docs.map(d => ({ name: d.name, type: d.type }));
            return {
                content: [{ type: "text", text: JSON.stringify(summary, null, 2) }]
            };
        }

        if (request.params.name === "get_module_entities_sdk") {
            const moduleName = String(request.params.arguments?.module_name);
            const projectId = String(request.params.arguments?.project_id);
            const branch = request.params.arguments?.branch ? String(request.params.arguments.branch) : "main";

            if (!process.env.MENDIX_TOKEN) {
                return {
                    content: [{ type: "text", text: "Error: MENDIX_TOKEN environment variable is not set. Cannot use SDK tools." }]
                };
            }

            try {
                // 1. Fetch App & Working Copy
                const app = client.getApp(projectId);
                const workingCopy = await app.createTemporaryWorkingCopy(branch);
                const model = await workingCopy.openModel();

                // 2. Find Module
                const domainModelInterface = model.allDomainModels().find(dm => dm.containerAsModule.name === moduleName);

                if (!domainModelInterface) {
                    return { content: [{ type: "text", text: `Module '${moduleName}' not found in project.` }] };
                }

                // 3. Load & Map
                const domainModel = await domainModelInterface.load();
                const entities = domainModel.entities.map(mapEntity);

                return {
                    content: [{ type: "text", text: JSON.stringify(entities, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{ type: "text", text: `SDK Error: ${error.message}` }]
                };
            }
        }

        if (request.params.name === "inspect_local_microflow") {
            const name = String(request.params.arguments?.name);
            const data = reader.getMicroflowJSON(name);
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
            };
        }

        if (request.params.name === "get_domain_model") {
            const moduleName = request.params.arguments?.module_name ? String(request.params.arguments.module_name) : undefined;
            const data = reader.getDomainModel(moduleName);
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
            };
        }

        if (request.params.name === "inspect_database_schema") {
            const tableName = request.params.arguments?.table_name ? String(request.params.arguments.table_name) : 'Unit';
            const data = reader.getSchema(tableName);
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
            };
        }

        throw new Error(`Tool not found: ${request.params.name}`);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error executing tool ${request.params.name}: ${errMsg}` }],
            isError: true
        };
    }
});

// Connect transport
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
    console.error("Server connection failed:", error);
    process.exit(1);
});
