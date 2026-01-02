# Mendix Context Bridge (Local MCP Server)

This project acts as a **Local Model Context Protocol (MCP) Server** for Mendix applications. It bridges the gap between AI Agents (like Antigravity or standard MCP clients) and your local Mendix development environment.

By reading the local SQLite database (`.mpr`) directly, it allows AI assistants to understand your project structure, domain model, and microflows **without cloud access** and with **zero latency**.

## 🚀 Key Features

*   **Privacy First**: Runs entirely locally. Your IP is not uploaded to any third-party parser service.
*   **Mendix 10 Compatible**: Fully supports modern Mendix projects using Git storage (split generic/module blobs) and binary blob parsing.
*   **Smart Caching**: Caches structure to ensure instant responses for subsequent queries.
*   **Live Inspection**:
    *   `list_local_modules`: Discovers all modules in your app.
    *   `list_local_documents`: Lists all Microflows, Pages, and Snippets.
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
    "disabled": false
  }
}
```
*Note: Adjust the path to where you cloned the repo. `${workspaceFolder}` is supported by some clients; otherwise use an absolute path.*

## 💡 Usage

Once configured, simply open your Mendix project folder in your AI editor. The server automatically detects the `.mpr` file in the root (or subdirectories).

**Example Prompts:**
*   *"Analyze the domain model of the Administration module."*
*   *"What does the Microflow 'ACT_SaveCustomer' do?"*
*   *"List all microflows in the project."*

## ⚠️ Important Notes

*   **Save Your Work**: The server reads the physical `.mpr` file on disk. Changes made in Mendix Studio Pro are only visible to the AI **after you save (Ctrl+S)**.
*   **Read-Only**: The server connects in read-only mode, so it is safe to use while Studio Pro is open.

## 🏗️ Architecture

*   **Language**: TypeScript / Node.js
*   **Database**: `better-sqlite3` for direct SQLite access.
*   **Logic**: Custom `MprReader` that reverse-engineers Mendix internal storage:
    *   Handles Endian-swapped GUIDs for file lookups.
    *   Parses binary `.mxunit` blobs using Regex-based extraction (stripping non-printable characters).
    *   Identifies Microflow Activities and Domain Model Entities dynamically.
