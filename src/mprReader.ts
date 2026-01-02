import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class MprReader {
    private db: Database.Database | null = null;
    private mprPath: string = '';
    private moduleCache: string[] | null = null;
    private lastMtime: number = 0;

    listTables(): string[] {
        if (!this.db) return [];
        const stmt = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
        return stmt.all().map((row: any) => row.name);
    }

    executeQuery(sql: string): any[] {
        if (!this.db) return [];
        return this.db.prepare(sql).all();
    }

    private swapGuid(buffer: Buffer): string {
        if (!Buffer.isBuffer(buffer) || buffer.length !== 16) return String(buffer);
        const p1 = buffer.slice(0, 4).reverse().toString('hex');
        const p2 = buffer.slice(4, 6).reverse().toString('hex');
        const p3 = buffer.slice(6, 8).reverse().toString('hex');
        const p4 = buffer.slice(8, 10).toString('hex');
        const p5 = buffer.slice(10, 16).toString('hex');
        return `${p1}-${p2}-${p3}-${p4}-${p5}`;
    }

    findMprFile(dir: string): string | null {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const mprFile = entries.find(e => e.isFile() && e.name.toLowerCase().endsWith('.mpr'));
            if (mprFile) return path.join(dir, mprFile.name);

            for (const entry of entries) {
                const name = entry.name;
                if (entry.isDirectory() &&
                    name !== 'node_modules' &&
                    name !== '.git' &&
                    name !== 'deployment' &&
                    name !== 'widgets') {
                    const found = this.findMprFile(path.join(dir, name));
                    if (found) return found;
                }
            }
            return null;
        } catch (error) {
            console.error('Error finding .mpr file:', error);
            return null;
        }
    }

    connect(mprPath: string): void {
        this.mprPath = mprPath;
        if (!fs.existsSync(mprPath)) throw new Error(`MPR file not found at: ${mprPath}`);
        try {
            this.db = new Database(mprPath, { readonly: true });
            console.log(`Connected to .mpr database: ${mprPath}`);
            this.moduleCache = null;
            this.lastMtime = 0;
        } catch (error) {
            console.error('Failed to connect to database:', error);
            throw error;
        }
    }

    getProjectSummary(): any[] {
        return this.getModules().map(m => ({ name: m, type: 'Module' }));
    }

    getModules(): string[] {
        if (!this.db || !this.mprPath) throw new Error('Database not connected.');

        try {
            const stats = fs.statSync(this.mprPath);
            if (this.moduleCache && this.lastMtime === stats.mtimeMs) return this.moduleCache;
            this.lastMtime = stats.mtimeMs;
        } catch (e) { }

        try {
            const units = this.db.prepare("SELECT UnitID FROM Unit WHERE ContainmentName = 'Modules'").all() as any[];

            if (units.length > 0) {
                const moduleNames: string[] = [];
                for (const u of units) {
                    if (u.UnitID) {
                        const guid = this.swapGuid(u.UnitID);
                        const hex = guid.replace(/-/g, '');
                        const blobPath = path.join(path.dirname(this.mprPath), 'mprcontents', hex.substring(0, 2), hex.substring(2, 4), `${guid}.mxunit`);

                        if (fs.existsSync(blobPath)) {
                            const buffer = fs.readFileSync(blobPath);
                            const clean = buffer.toString('utf8').replace(/[^\x20-\x7E]/g, ' ');
                            const match = clean.match(/Name\s+([A-Za-z0-9_]+)/);
                            if (match && match[1]) moduleNames.push(match[1]);
                        }
                    }
                }
                this.moduleCache = moduleNames;
                return moduleNames;
            }

            const stmt = this.db.prepare("SELECT DISTINCT containerId FROM Unit LIMIT 50");
            const rows = stmt.all() as any[];
            const result = rows.map(r => r.containerId || "Unidentified_Module");
            this.moduleCache = result;
            return result;
        } catch (error) {
            console.error('Error getting modules:', error);
            return [];
        }
    }

    getDomainModel(moduleName?: string): any[] {
        if (!this.db || !this.mprPath) return [];

        try {
            const units = this.db.prepare("SELECT UnitID FROM Unit WHERE ContainmentName = 'DomainModel'").all() as any[];
            const entities: any[] = [];

            for (const u of units) {
                if (!u.UnitID) continue;
                const guid = this.swapGuid(u.UnitID);
                const hex = guid.replace(/-/g, '');
                const blobPath = path.join(path.dirname(this.mprPath), 'mprcontents', hex.substring(0, 2), hex.substring(2, 4), `${guid}.mxunit`);

                if (fs.existsSync(blobPath)) {
                    const buffer = fs.readFileSync(blobPath);
                    const content = buffer.toString('utf8').replace(/[^\x20-\x7E]/g, ' ');

                    const typeRegex = /\$Type\s+DomainModels\$EntityImpl/g;
                    let match;
                    while ((match = typeRegex.exec(content)) !== null) {
                        const startIndex = match.index;
                        const nameRegex = /Name\s+([A-Za-z0-9_]+)/g;
                        nameRegex.lastIndex = startIndex;
                        const nameMatch = nameRegex.exec(content);
                        if (nameMatch && (nameMatch.index - startIndex < 500) && nameMatch[1].length > 2) {
                            entities.push({ name: nameMatch[1], type: 'Entity' });
                        }
                    }
                }
            }
            return entities;
        } catch (error) {
            console.error('Error getting domain model:', error);
            return [];
        }
    }

    getDocuments(): any[] {
        if (!this.db || !this.mprPath) return [];
        try {
            const units = this.db.prepare("SELECT UnitID FROM Unit WHERE ContainmentName = 'Documents'").all() as any[];
            const docs: any[] = [];

            for (const u of units) {
                if (!u.UnitID) continue;
                const guid = this.swapGuid(u.UnitID);
                const hex = guid.replace(/-/g, '');
                const blobPath = path.join(path.dirname(this.mprPath), 'mprcontents', hex.substring(0, 2), hex.substring(2, 4), `${guid}.mxunit`);

                if (fs.existsSync(blobPath)) {
                    const buffer = fs.readFileSync(blobPath);
                    const content = buffer.toString('utf8').replace(/[^\x20-\x7E]/g, ' ');

                    let type = 'Unknown';
                    // Use Regex to handle variable spacing and $ prefix
                    if (/\$Type\s+Microflows\$Microflow/.test(content)) type = 'Microflow';
                    else if (/\$Type\s+Pages\$Page/.test(content)) type = 'Page';
                    else if (/\$Type\s+Forms\$Snippet/.test(content)) type = 'Snippet';

                    if (type !== 'Unknown') {
                        const nameMatch = content.match(/Name\s+([A-Za-z0-9_]+)/);
                        if (nameMatch && nameMatch[1].length > 1) {
                            docs.push({ name: nameMatch[1], type: type, guid: guid });
                        }
                    }
                }
            }
            return docs;
        } catch (error) {
            console.error('Error scanning documents:', error);
            return [];
        }
    }

    getMicroflowJSON(name: string): any {
        const docs = this.getDocuments();
        const doc = docs.find(d => d.name === name);

        if (!doc) return { error: `Microflow '${name}' not found.` };
        if (doc.type !== 'Microflow') return { error: `'${name}' is a ${doc.type}, not a Microflow.` };

        try {
            const hex = doc.guid.replace(/-/g, '');
            const blobPath = path.join(path.dirname(this.mprPath), 'mprcontents', hex.substring(0, 2), hex.substring(2, 4), `${doc.guid}.mxunit`);

            if (fs.existsSync(blobPath)) {
                const buffer = fs.readFileSync(blobPath);
                const content = buffer.toString('utf8').replace(/[^\x20-\x7E]/g, ' ');

                const activities: any[] = [];
                // Look for things like $Type Microflows$RetrieveAction
                const regex = /\$Type\s+Microflows\$([A-Za-z0-9_]+)/g;
                let match;
                while ((match = regex.exec(content)) !== null) {
                    const activityType = match[1];
                    if (activityType === 'Microflow') continue;

                    const sub = content.substring(match.index, match.index + 500);
                    const capMatch = sub.match(/Caption\s+([A-Za-z0-9_\s]+)/);

                    activities.push({
                        type: activityType,
                        caption: capMatch ? capMatch[1].trim() : undefined
                    });
                }

                return { name: doc.name, activities: activities };
            }
        } catch (e) { console.error(e); }
        return { error: "Could not read microflow content" };
    }

    close(): void {
        if (this.db) {
            console.log('Closing database connection.');
            this.db.close();
            this.db = null;
        }
    }

    getSchema(tableName: string = 'Unit'): any[] {
        if (!this.db) throw new Error('Database not connected.');
        try {
            return this.db.prepare(`PRAGMA table_info(${tableName})`).all();
        } catch (error) {
            return [];
        }
    }
}
