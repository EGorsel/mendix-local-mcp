
import { MendixParser } from './mendixParser.js';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const testProjectDir = 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = path.join(testProjectDir, 'test-mcp-server.mpr');

if (fs.existsSync(mprPath)) {
    const db = new Database(mprPath, { readonly: true });

    // Start with _Docs ID: 7a8670e0c94e4e42970ea39b808b99e3
    let currentId = Buffer.from('7a8670e0c94e4e42970ea39b808b99e3', 'hex');

    function swapGuid(buffer: Buffer): string {
        const p1 = buffer.slice(0, 4).reverse().toString('hex');
        const p2 = buffer.slice(4, 6).reverse().toString('hex');
        const p3 = buffer.slice(6, 8).reverse().toString('hex');
        const p4 = buffer.slice(8, 10).toString('hex');
        const p5 = buffer.slice(10, 16).toString('hex');
        return `${p1}-${p2}-${p3}-${p4}-${p5}`;
    }

    console.log("Tracing lineage upwards...");

    for (let i = 0; i < 10; i++) {
        const unit = db.prepare("SELECT * FROM Unit WHERE UnitID = ?").get(currentId) as any;
        if (!unit) {
            console.log("-> [End of Chain (Unit Not Found)]");
            break;
        }

        const guid = swapGuid(unit.UnitID);
        const hex = guid.replace(/-/g, '');
        const blobPath = path.join(path.dirname(mprPath), 'mprcontents', hex.substring(0, 2), hex.substring(2, 4), `${guid}.mxunit`);

        let name = "???";
        let type = "???";
        if (fs.existsSync(blobPath)) {
            const buf = fs.readFileSync(blobPath);
            name = MendixParser.getProperty(buf, "Name") || "(no name)";
            type = MendixParser.getProperty(buf, "$Type") || "(no type)";
        }

        console.log(`[${i}] ${name} (${type})`);
        console.log(`    ID: ${unit.UnitID.toString('hex')}`);
        console.log(`    Containment: ${unit.ContainmentName}`);
        console.log(`    ContainerID: ${unit.ContainerID ? unit.ContainerID.toString('hex') : 'NULL'}`);

        if (!unit.ContainerID) {
            console.log("-> [Root Reached]");
            break;
        }

        if (unit.ContainerID.equals(unit.UnitID)) { // Check for self-reference
            console.log("-> [Cycle Detected]");
            break;
        }

        currentId = unit.ContainerID;
    }

    db.close();
}
