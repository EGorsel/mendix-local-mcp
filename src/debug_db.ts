
import { MprReader } from './mprReader.js';
import fs from 'fs';
import path from 'path';

const reader = new MprReader();
const targetDir = process.argv[2] || 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(targetDir);

function swapGuid(buffer: Buffer): string {
    if (buffer.length !== 16) return buffer.toString('hex');

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

if (mprPath) {
    reader.connect(mprPath);

    const units = reader.executeQuery("SELECT * FROM Unit WHERE ContainmentName = 'Modules' LIMIT 5");
    console.log(`Found ${units.length} modules.`);

    for (const u of units) {
        if (!u.UnitID) continue;

        let guid = '';
        if (Buffer.isBuffer(u.UnitID)) {
            guid = swapGuid(u.UnitID);
        } else {
            // If string, assume it's already hex? Or ignore.
            continue;
        }

        console.log(`UnitID (Swapped): ${guid}`);

        const hex = guid.replace(/-/g, '');
        const sub1 = hex.substring(0, 2);
        const sub2 = hex.substring(2, 4);

        const blobPath = path.join(path.dirname(mprPath), 'mprcontents', sub1, sub2, `${guid}.mxunit`);

        if (fs.existsSync(blobPath)) {
            console.log(`Reading blob: ${blobPath}`);
            const buffer = fs.readFileSync(blobPath);
            const content = buffer.toString('utf8');

            // Try to find Name
            // Look for "Name" property? Or first non-system string?
            // Clean non-printable
            const clean = content.replace(/[^\x20-\x7E]/g, ' ');
            console.log(`Content Preview: ${clean.substring(0, 300)}`);

        } else {
            console.log(`File still not found: ${blobPath}`);
        }
    }

    reader.close();
}
