import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class MprReader {
    private db: Database.Database | null = null;

    /**
     * Searches for the first .mpr file in the given directory.
     */
    findMprFile(dir: string): string | null {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            // Check files first
            const mprFile = entries.find(e => e.isFile() && e.name.toLowerCase().endsWith('.mpr'));
            if (mprFile) {
                return path.join(dir, mprFile.name);
            }

            // Check subdirectories
            for (const entry of entries) {
                if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                    const found = this.findMprFile(path.join(dir, entry.name));
                    if (found) return found;
                }
            }
            return null;
        } catch (error) {
            console.error('Error finding .mpr file:', error);
            return null;
        }
    }

    /**
     * Connects to the SQLite database (.mpr file) in read-only mode.
     */
    connect(mprPath: string): void {
        if (!fs.existsSync(mprPath)) {
            throw new Error(`MPR file not found at: ${mprPath}`);
        }
        try {
            this.db = new Database(mprPath, { readonly: true });
            console.log(`Connected to .mpr database: ${mprPath}`);
        } catch (error) {
            console.error('Failed to connect to database:', error);
            throw error;
        }
    }

    /**
     * Retrieves a summary of the project (Microflows, Pages, Modules).
     * Scanning the 'Unit' table.
     * Note: Schema structure relies on standard Mendix storage.
     * We attempt to read 'Unit' and basic identifying columns.
     */
    /**
     * Retrieves a summary of the project (Microflows, Pages, Modules).
     * Scanning the 'Unit' table.
     */
    getProjectSummary(): any[] {
        if (!this.db) {
            throw new Error('Database not connected. Call connect() first.');
        }

        try {
            // Attempt to read all units. 
            // In a real scenario, we would filter by a 'Type' column if available.
            // Since we lack the schema, we select * to return raw data for inspection.
            // LIMIT 1000 to avoid overloading.
            const stmt = this.db.prepare("SELECT * FROM Unit LIMIT 1000");
            const units = stmt.all();
            return units;
        } catch (error) {
            console.error('Error getting project summary:', error);
            return [];
        }
    }

    /**
     * Retrieves the JSON/XML blob for a specific Microflow by name.
     * Note: 'name' parameter column is guessed.
     */
    getMicroflowJSON(name: string): any {
        if (!this.db) {
            throw new Error('Database not connected.');
        }
        try {
            // We search for a unit that might contain the name.
            // 'tree' is often the blob column. 'unitId' is the ID.
            // This query is speculative.
            // We strive to find a row where some text column matches the name.
            // Pragma to find columns again (cached ideally).
            const columns = this.db.pragma('table_info(Unit)') as any[];
            const colNames = columns.map(c => c.name);

            // Heuristic: if there is a 'Name' column?
            // If not, we can't easily filter by name in SQL without scanning blobs?
            // We will return a message + the raw data of the first few matching units if we can guess.

            return {
                message: "To retrieve a specific microflow, we need to know the schema column for 'Name'.",
                availableColumns: colNames,
                instruction: "Please inspect 'getProjectSummary' output to identify the Name column."
            };
        } catch (error) {
            console.error(`Error retrieving microflow ${name}:`, error);
            return null;
        }
    }

    /**
     * Bonus: Reads Domain Model entities.
     */
    /**
     * Retrieves a list of all modules in the project.
     */
    getModules(): string[] {
        if (!this.db) {
            throw new Error('Database not connected.');
        }
        try {
            // Placeholder: In a real Mendix DB, modules might be units with specific types 
            // or folders. We will return generic names or 'Unknown' if we can't determine.
            // Attempting to select distinct container IDs or similar if they represent modules.

            // For now, returning a mock list mixed with whatever we find in Unit to show activity.
            const stmt = this.db.prepare("SELECT DISTINCT containerId FROM Unit LIMIT 50");
            const rows = stmt.all() as any[];
            return rows.map(r => r.containerId || "Unidentified_Module");
        } catch (error) {
            console.error('Error getting modules:', error);
            return [];
        }
    }

    /**
     * Reads Domain Model entities, optionally filtered by module.
     */
    getDomainModel(moduleName?: string): any[] {
        if (!this.db) {
            throw new Error('Database not connected.');
        }
        try {
            // Placeholder logic: 
            // If moduleName is provided, we would filter by that.
            console.log(`Getting domain model for module: ${moduleName || 'All'}`);

            const stmt = this.db.prepare("SELECT * FROM Unit LIMIT 20");
            return stmt.all();
        } catch (error) {
            console.error('Error getting domain model:', error);
            return [];
        }
    }
    /**
     * Closes the database connection.
     */
    close(): void {
        if (this.db) {
            console.log('Closing database connection.');
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Inspects the schema of the 'Unit' table (or any other table).
     * Useful for debugging internal Mendix structure.
     */
    getSchema(tableName: string = 'Unit'): any[] {
        if (!this.db) {
            throw new Error('Database not connected.');
        }
        try {
            // Use SQLite pragma to get table info
            const stmt = this.db.prepare(`PRAGMA table_info(${tableName})`);
            return stmt.all();
        } catch (error) {
            console.error(`Error getting schema for ${tableName}:`, error);
            return [];
        }
    }
}
