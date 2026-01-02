import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { MendixParser } from './mendixParser.js';

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
                            const name = MendixParser.getProperty(buffer, "Name");
                            if (name) {
                                moduleNames.push(name);
                            }
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

        // Note: DomainModel blob usually DOES NOT contain Entity definitions directly in the same way.
        // DomainModel unit contains the canvas.
        // Entities are *children* of DomainModel in the Unit table?
        // Wait, current regex `getDomainModel` was scanning `mprcontents` of `DomainModel` unit.
        // If Entities are defined INSIDE that blob (Mendix 10), then parser should work.
        // If Entities are separate units (Mendix 9/10 split), we should query Unit table.
        // The report says: "Mprv2 ... datadefinities geextraheerd naar mprcontents".

        // Let's rely on what worked before (scanning the blob) but use the Parser?
        // Issue: MendixParser keys are "Name" and "$Type".
        // Entities in DomainModel blob might be an array.
        // The current Parser is `getProperty`. It finds ONE instance.
        // If there are multiple entities, `getProperty` only finds the first "Name".
        // We need `scanProperties` or recursive scan.
        // For now, let's keep the Regex for *Arrays* of entities because MendixParser isn't a full traverser yet.
        // OR better: Entities *are* likely separate Units in MPv2.
        // Let's check if there are units with ContainmentName='Entities'?
        // No, `inspect_containment` showed `DomainModel` (19).

        // Regex is still safer for *lists* until MendixParser supports iteration.
        // But we can use MendixParser to cleanup the stream? No, `getProperty` takes buffer.
        // Let's stick to Regex for DomainModel for now (since it worked for 146 entities) 
        // BUT use the cleaning strategy from the report if needed, or simply the one I have.
        // I will optimize `getDocuments` first which is 1-to-1.

        return this.getDomainModelRegex(moduleName);
    }

    // Fallback for lists (until Parser supports iteration)
    private getDomainModelRegex(moduleName?: string): any[] {
        try {
            const units = this.db!.prepare("SELECT UnitID FROM Unit WHERE ContainmentName = 'DomainModel'").all() as any[];
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
        } catch (e) { return []; }
    }

    getDocuments(moduleName?: string): any[] {
        if (!this.db || !this.mprPath) return [];
        try {
            // TODO: Filter by ModuleName using TreePath or ContainerID hierarchy.
            // For now, scan all.
            const units = this.db.prepare("SELECT UnitID FROM Unit WHERE ContainmentName = 'Documents'").all() as any[];
            const docs: any[] = [];

            for (const u of units) {
                if (!u.UnitID) continue;
                const guid = this.swapGuid(u.UnitID);
                const hex = guid.replace(/-/g, '');
                const blobPath = path.join(path.dirname(this.mprPath), 'mprcontents', hex.substring(0, 2), hex.substring(2, 4), `${guid}.mxunit`);

                if (fs.existsSync(blobPath)) {
                    const buffer = fs.readFileSync(blobPath);
                    // Use Binary Parser
                    const type = MendixParser.getProperty(buffer, "$Type");
                    const name = MendixParser.getProperty(buffer, "Name");

                    if (name && type) {
                        let shortType = 'Unknown';
                        if (type.includes('Microflows$Microflow')) shortType = 'Microflow';
                        else if (type.includes('Pages$Page')) shortType = 'Page';
                        else if (type.includes('Forms$Snippet')) shortType = 'Snippet';
                        else if (type.includes('JavaActions$JavaAction')) shortType = 'JavaAction';

                        if (shortType !== 'Unknown') {
                            docs.push({ name: name, type: shortType, guid: guid });
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
        const doc = docs.find(d => d.name === name && d.type === 'Microflow');

        if (!doc) return { error: `Microflow '${name}' not found.` };

        try {
            const hex = doc.guid.replace(/-/g, '');
            const blobPath = path.join(path.dirname(this.mprPath), 'mprcontents', hex.substring(0, 2), hex.substring(2, 4), `${doc.guid}.mxunit`);

            if (fs.existsSync(blobPath)) {
                // Return structure using Regex for now (activities list), as we haven't built a list scanner in Parser yet.
                const buffer = fs.readFileSync(blobPath);
                const content = buffer.toString('utf8').replace(/[^\x20-\x7E]/g, ' ');
                const activities: any[] = [];
                const regex = /\$Type\s+Microflows\$([A-Za-z0-9_]+)/g;
                let match;
                while ((match = regex.exec(content)) !== null) {
                    const activityType = match[1];
                    if (activityType === 'Microflow') continue;
                    activities.push({ type: activityType });
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
