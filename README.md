# Mendix Context Bridge (Local MCP Server)

This project acts as a **Local Model Context Protocol (MCP) Server** for Mendix applications. It bridges the gap between AI Agents (like Antigravity or standard MCP clients) and your local Mendix development environment.

By reading the local SQLite database (`.mpr`) directly, it allows AI assistants to understand your project structure, domain model, and microflows **without cloud access** and with **zero latency**.

## 🚀 Key Features

*   **Shadow SDK Architecture**: Operates as a local read-only SDK. Instead of relying on the online Model Server, it reverse-engineers the local `.mpr` database and binary blobs.
*   **Privacy First**: Runs entirely locally. Your IP is not uploaded to any third-party parser service.
*   **Mendix 10 Compatible**: Fully supports modern Mendix projects using Git storage, handling binary parsing (via custom `MendixParser`) and Guid endianness swapping.
*   **Smart Caching**: Caches structure to ensure instant responses for subsequent queries.
*   **Live Inspection**:
    *   `list_local_modules`: Discovers all modules in your app.
    *   `list_local_documents`: Lists all Microflows, Pages, and Snippets (filterable by Module).
    *   `inspect_local_microflow`: Extracts the logical structure (activities, decisions, loops) of a Microflow.
    *   `get_domain_model`: Extracts entities and associations for a specific module.
    *   `inspect_database_schema`: (Debug) Allows the AI to inspect the internal `.mpr` SQLite structure.

## 🛠️ Installation

1.  **Clone this repository** (preferably into a subfolder of your Mendix project, e.g., `tooling/mendix-local-mcp`):
    ```bash
    git clone https://github.com/EGorsel/mendix-local-mcp.git
    cd mendix-local-mcp
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Build the Server**:
    ```bash
    npm run build
    ```

## ⚙️ Configuration

To use this server with an MCP Client (like Antigravity or Claude Desktop), add it to your `mcp_config.json`.

**Recommended Configuration**:
```json
{
  "mendix-local": {
    "command": "node",
    "args": [
      "${workspaceFolder}/tooling/mendix-local-mcp/dist/server.js"
    ],
    "env": {
      "MENDIX_PROJECT_ROOT": "${workspaceFolder}"
    },
    "disabled": false
  }
}
```
*Note: Using `${workspaceFolder}` ensures the server starts relative to your active project, allowing accurate file detection.*

## 💡 Usage

Once configured, simply open your Mendix project folder in your AI editor. The server automatically detects the `.mpr` file in the root (or subdirectories).

**Example Prompts:**
*   *"Analyze the domain model of the Administration module."*
*   *"What does the Microflow 'ACT_SaveCustomer' do?"*
*   *"List all microflows in the Administration module."*

## ⚠️ Important Notes

*   **Save Your Work**: The server reads the physical `.mpr` file on disk. Changes made in Mendix Studio Pro are only visible to the AI **after you save (Ctrl+S)**.
*   **Read-Only**: The server connects in read-only mode, so it is safe to use while Studio Pro is open.

## 🏗️ Architecture

*   **Language**: TypeScript / Node.js
*   **Database**: `better-sqlite3` for direct SQLite access.
*   **Logic**: Custom `MprReader` that authenticates as a "Shadow SDK":
    *   **Unit Hierarchy**: Reconstructs module structure using recursive SQL queries on the `Unit` table.
    *   **Binary Parser**: A custom stream reader that safely extracts properties from `.mxunit` blobs by identifying property markers and length prefixes, avoiding Regex fragility.
