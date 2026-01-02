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
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "list_local_modules",
                description: "Geeft een overzicht van alle modules in het geopende .mpr bestand.",
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            },
            {
                name: "inspect_local_microflow",
                description: "Zoekt een microflow op naam en geeft de logische stappen terug.",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Naam van de microflow"
                        }
                    },
                    required: ["name"]
                }
            },
            {
                name: "get_domain_model",
                description: "Geeft een overzicht van alle entiteiten en types in een specifieke module.",
                inputSchema: {
                    type: "object",
                    properties: {
                        module_name: {
                            type: "string",
                            description: "De naam van de module waarvan je het domeinmodel wilt zien."
                        }
                    },
                    required: ["module_name"]
                }
            },
            {
                name: "inspect_database_schema",
                description: "Geeft de kolomstructuur van een tabel in de lokale database terug. Handig om te begrijpen hoe Mendix data opslaat.",
                inputSchema: {
                    type: "object",
                    properties: {
                        table_name: {
                            type: "string",
                            description: "Naam van de tabel (standaard: Unit)",
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
        if (request.params.name === "list_local_modules") {
            const modules = reader.getModules();
            return {
                content: [{ type: "text", text: JSON.stringify(modules, null, 2) }]
            };
        }

        if (request.params.name === "inspect_local_microflow") {
            const name = String(request.params.arguments?.name);
            const data = reader.getMicroflowJSON(name);
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
            };
        }

        if (request.params.name === "get_domain_model") {
            const moduleName = String(request.params.arguments?.module_name);
            const data = reader.getDomainModel(moduleName);
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
