
import { MprReader } from './mprReader.js';
import fs from 'fs';
import path from 'path';

const reader = new MprReader();
const targetDir = process.argv[2] || 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(targetDir);

if (mprPath) {
    reader.connect(mprPath);

    console.log("Picking a 'Documents' unit...");
    const units = reader.executeQuery("SELECT UnitID FROM Unit WHERE ContainmentName = 'Documents' LIMIT 1");
    if (units.length > 0) {
        // We need to access private swapGuid or duplicate logic.
        // Quick hack: just use the logic inline.
        const u = units[0];
        const buffer = u.UnitID;
        const p1 = buffer.slice(0, 4).reverse().toString('hex');
        const p2 = buffer.slice(4, 6).reverse().toString('hex');
        const p3 = buffer.slice(6, 8).reverse().toString('hex');
        const p4 = buffer.slice(8, 10).toString('hex');
        const p5 = buffer.slice(10, 16).toString('hex');
        const guid = `${p1}-${p2}-${p3}-${p4}-${p5}`;
        const hex = guid.replace(/-/g, '');

        const blobPath = path.join(path.dirname(mprPath), 'mprcontents', hex.substring(0, 2), hex.substring(2, 4), `${guid}.mxunit`);
        console.log(`Reading: ${blobPath}`);

        if (fs.existsSync(blobPath)) {
            const buf = fs.readFileSync(blobPath);
            const str = buf.toString('utf8').replace(/[^\x20-\x7E]/g, ' ');
            console.log("Snippet (first 500 chars):");
            console.log(str.substring(0, 500));
        } else {
            console.log("Blob file not found.");
        }
    }
    reader.close();
}
