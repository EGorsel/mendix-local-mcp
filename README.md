# Mendix Local MCP Server

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)
![MCP](https://img.shields.io/badge/protocol-MCP-green.svg)

**A powerful bridge between Mendix Applications and AI Agents.**

The **Mendix Local MCP Server** is a Model Context Protocol (MCP) server designed to empower AI tools (like Google Antigravity, Claude Desktop, or Cursor) to inspect, read, and understand the structure of Mendix projects.

It operates in a unique **Dual Mode**:
1.  **Shadow SDK (Local):** Instant, offline access to `.mpr` files via direct binary parsing.
2.  **Official SDK (Cloud):** Deep, accurate inspection using the Mendix Platform SDK.

---

## Why Use This Tool?

Integrating Low-Code platforms with AI agents is notoriously difficult due to proprietary file formats. This tool solves that problem.

*   **🚀 AI-Ready:** Exposes complex Mendix logic (Microflows, Domain Models) as clean, AI-readable JSON.
*   **⚡ Blazing Fast (Local):** Uses a custom "Shadow SDK" to parse `.mpr` SQLite databases and `.mxunit` binaries without waiting for the Model SDK to load.
*   **🛡️ Circular-Safe:** Automatically handles the notorious "Circular Structure" errors common in the Mendix SDK by applying a DTO Transformation Layer.
*   **🔒 Privacy-First:** Can operate entirely offline (Local Mode), keeping your intellectual property on your machine.

---

## Key Features

*   **Project Discovery:** Automatically detects Mendix projects in your workspace.
*   **Module Browsing:** Recursively filters documents (Microflows, Pages) by Module.
*   **Shadow Parsing:** Extracts metadata from binary blobs without the overhead of the full SDK.
*   **Official SDK Integration:** Fetches authoritative data from the Mendix Cloud when absolute precision is required.
*   **DTO Sanitization:** Maps complex Mendix objects to flat, safe JSON for AI consumption.

---

## Installation

### Prerequisites
*   **Mendix Studio Pro v10.24.13 or newer** (Required for the new SQLite-based `.mpr` format)
*   Node.js (v18 or higher)
*   A local Mendix project (Git-backed or local file)

### Setup
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/YourUsername/mendix-local-mcp.git
    cd mendix-local-mcp
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Build the Project:**
    ```bash
    npm run build
    ```

---

## Configuration

To unlock the full power of the **Official SDK** (Cloud Mode), you must configure your Mendix Personal Access Token (PAT).

Add the server to your MCP Client configuration (e.g., `mcp_config.json` for Antigravity or Claude Desktop):

```json
{
  "mcpServers": {
    "mendix-local-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mendix-local-mcp/build/server.js"],
      "env": {
        "MENDIX_TOKEN": "your_generated_pat_string",
        "MENDIX_USERNAME": "your_email@domain.com"
      }
    }
  }
}
```

> **Note:** Generate your PAT in the Mendix Developer Portal with the scope `mx:modelrepository:repo:read`.

---

## Usage

Once running, the server exposes the following tools to your AI Agent:

### Local Mode Tools (Offline)
These tools use the "Shadow SDK" and do not require a token.

*   `list_local_documents(module_name?)`
    *   Lists all documents in the project. Optional filter by module.
*   `get_domain_model(module_name)`
    *   Extracts a simplified Domain Model using parsing.
*   `inspect_local_microflow(microflow_name)`
    *   Reads binary definitions to show microflow logic.
*   `inspect_database_schema(table_name?)`
    *   (Debug) Inspects the internal `.mpr` SQLite schema.

### Cloud Mode Tools (Online)
These tools use the Official Mendix SDK.

*   `get_module_entities_sdk(module_name, project_id, branch?)`
    *   **Recommended for Refactoring.** Fetches a 100% accurate, sanitized JSON representation of the Domain Model from the Mendix Cloud.

---

## Project Structure

```text
mendix-local-mcp/
├── src/
│   ├── index.ts          # Main entry point (SDK implementation)
│   ├── server.ts         # MCP Server definition and Tool handlers
│   ├── mprReader.ts      # Shadow SDK: SQLite connection & query logic
│   ├── mendixParser.ts   # Shadow SDK: Binary stream parser for .mxunit
│   └── mappers.ts        # Official SDK: DTO definitions (Entity, Attribute...)
├── build/                # Compiled JavaScript output
├── package.json          # Dependencies & Scripts
└── tsconfig.json         # TypeScript configuration
```

---

## Contributing

Contributions are welcome! If you'd like to improve the Binary Parser or add more DTO mappers:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add some amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.
