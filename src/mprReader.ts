import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class MprReader {
    private db: Database.Database | null = null;

    /**
     * Searches for the first .mpr file in the given directory.
     */
    /**
     * Lists all tables in the database.
     */
    listTables(): string[] {
        if (!this.db) return [];
        const stmt = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
        return stmt.all().map((row: any) => row.name);
    }

    /**
     * Executes a raw query (DEBUG ONLY).
     */
    executeQuery(sql: string): any[] {
        if (!this.db) return [];
        return this.db.prepare(sql).all();
    }



    /**
     * Helper to swap Little Endian GUID bytes to Standard GUID string.
     */
    private swapGuid(buffer: Buffer): string {
        if (!Buffer.isBuffer(buffer) || buffer.length !== 16) return String(buffer);

        // Swap 0-3
        const p1 = buffer.slice(0, 4).reverse().toString('hex');
        // Swap 4-5
        const p2 = buffer.slice(4, 6).reverse().toString('hex');
        // Swap 6-7
        const p3 = buffer.slice(6, 8).reverse().toString('hex');
        // Keep 8-end
        const p4 = buffer.slice(8, 10).toString('hex');
        const p5 = buffer.slice(10, 16).toString('hex');

        return `${p1}-${p2}-${p3}-${p4}-${p5}`;
    }

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
        this.mprPath = mprPath;
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

    private mprPath: string = '';

    /**
     * Retrieves a summary of the project (Microflows, Pages, Modules).
     * Scanning the 'Unit' table.
     */
    getProjectSummary(): any[] {
        // ... (previous generic logic, maybe update later)
        return this.getModules().map(m => ({ name: m, type: 'Module' }));
    }

    /**
     * Retrieves the JSON/XML blob for a specific Microflow by name.
     */
    getMicroflowJSON(name: string): any {
        // Placeholder for now
        return { message: "Not implemented for this version." };
    }

    /**
     * Retrieves a list of all modules in the project.
     */
    getModules(): string[] {
        if (!this.db) {
            throw new Error('Database not connected.');
        }
        try {
            // Strategy 1: Look for Units with ContainmentName = 'Modules' (Mendix 10 Git)
            const units = this.db.prepare("SELECT UnitID FROM Unit WHERE ContainmentName = 'Modules'").all() as any[];

            if (units.length > 0) {
                const moduleNames: string[] = [];
                for (const u of units) {
                    if (u.UnitID) {
                        const guid = this.swapGuid(u.UnitID);
                        const hex = guid.replace(/-/g, '');
                        // Path: mprcontents/xx/yy/guid.mxunit
                        // Assuming this.mprPath is set
                        if (this.mprPath) {
                            const blobPath = path.join(
                                path.dirname(this.mprPath),
                                'mprcontents',
                                hex.substring(0, 2),
                                hex.substring(2, 4),
                                `${guid}.mxunit`
                            );

                            if (fs.existsSync(blobPath)) {
                                const buffer = fs.readFileSync(blobPath);
                                // Simple extraction: "Name" followed by string
                                // clean nulls
                                const clean = buffer.toString('utf8').replace(/[^\x20-\x7E]/g, ' ');
                                // Regex to find "Name ... MyModule"
                                // The layout usually has "Name" then some spaces/binary then the name.
                                // In test log: "Name     PgVectorKnowledgeBase"
                                const match = clean.match(/Name\s+([A-Za-z0-9_]+)/);
                                if (match && match[1]) {
                                    moduleNames.push(match[1]);
                                } else {
                                    moduleNames.push(`Unparsable_Module_${guid.substring(0, 8)}`);
                                }
                            }
                        }
                    }
                }
                return moduleNames;
            }

            // Strategy 2: Fallback to old placeholder logic (distinct containerId)
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
        // Placeholder remains for now
        return [];
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
