
import { MprReader } from './mprReader.js';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const reader = new MprReader();
const testProjectDir = 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(testProjectDir);

if (mprPath) {
    reader.connect(mprPath);
    console.log("Connected.");

    // 1. Find UnitID for 'Administration'
    const modules = reader.executeQuery("SELECT UnitID FROM Unit WHERE ContainmentName = 'Modules'");
    let adminId: any = null;

    // Helper to swap guid (copied)
    function swap(buffer: Buffer): string {
        const p1 = buffer.slice(0, 4).reverse().toString('hex');
        const p2 = buffer.slice(4, 6).reverse().toString('hex');
        const p3 = buffer.slice(6, 8).reverse().toString('hex');
        const p4 = buffer.slice(8, 10).toString('hex');
        const p5 = buffer.slice(10, 16).toString('hex');
        return `${p1}-${p2}-${p3}-${p4}-${p5}`;
    }

    function getName(buffer: Buffer): string | null {
        const idx = buffer.indexOf(Buffer.from([0x02, 0x4E, 0x61, 0x6D, 0x65, 0x00]));
        if (idx === -1) return null;
        const lenOffset = idx + 6;
        const len = buffer.readInt32LE(lenOffset);
        const valOffset = lenOffset + 4;
        return buffer.toString('utf8', valOffset, valOffset + len).replace(/\x00$/, '');
    }

    // Identify Admin ID
    for (const u of modules) {
        const guid = swap(u.UnitID);
        const hex = guid.replace(/-/g, '');
        const blobPath = path.join(path.dirname(mprPath), 'mprcontents', hex.substring(0, 2), hex.substring(2, 4), `${guid}.mxunit`);
        if (fs.existsSync(blobPath)) {
            const buf = fs.readFileSync(blobPath);
            const name = getName(buf);
            if (name === 'Administration') {
                adminId = u.UnitID;
                console.log(`Found Administration: ${guid}`);
                break;
            }
        }
    }

    if (adminId) {
        // 2. Run Recursive Query
        const sql = `
            WITH RECURSIVE Hierarchy AS (
                SELECT UnitID FROM Unit WHERE UnitID = ?
                UNION ALL
                SELECT u.UnitID FROM Unit u
                JOIN Hierarchy h ON u.ContainerID = h.UnitID
            )
            SELECT count(*) as cnt
            FROM Unit u
            JOIN Hierarchy h ON u.UnitID = h.UnitID
            WHERE u.ContainmentName = 'Documents'
        `;

        const db = new Database(mprPath, { readonly: true });

        const stmt = db.prepare(sql);
        const res = stmt.all(adminId) as any[];
        console.log("Recursive Query Result:", res);

        // Also check direct children
        const direct = db.prepare("SELECT count(*) as cnt FROM Unit WHERE ContainerID = ? AND ContainmentName = 'Documents'").all(adminId) as any[];
        console.log("Direct Children Documents:", direct);

        db.close();
    } else {
        console.error("Administration module not found.");
    }

    reader.close();
}
