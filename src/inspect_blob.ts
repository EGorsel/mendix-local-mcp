
import { MprReader } from './mprReader.js';
import fs from 'fs';
import path from 'path';

const reader = new MprReader();
const targetDir = process.argv[2] || 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(targetDir);

if (mprPath) {
    reader.connect(mprPath);

    console.log("Searching for a Domain Model unit...");
    // We can assume ContainmentName = 'DomainModel' for units that are domain models
    const units = reader.executeQuery("SELECT * FROM Unit WHERE ContainmentName = 'DomainModel' LIMIT 1");

    if (units.length > 0) {
        const u = units[0];
        console.log("Found Domain Model Unit ID:", u.UnitID);
        // We know MprReader has swapGuid but it's private. We'll duplicate snippet here for debug.
        const swapGuid = (buffer: any) => {
            if (!Buffer.isBuffer(buffer) || buffer.length !== 16) return String(buffer);
            const p1 = buffer.slice(0, 4).reverse().toString('hex');
            const p2 = buffer.slice(4, 6).reverse().toString('hex');
            const p3 = buffer.slice(6, 8).reverse().toString('hex');
            const p4 = buffer.slice(8, 10).toString('hex');
            const p5 = buffer.slice(10, 16).toString('hex');
            return `${p1}-${p2}-${p3}-${p4}-${p5}`;
        }

        const guid = swapGuid(u.UnitID);
        const hex = guid.replace(/-/g, '');
        const blobPath = path.join(
            path.dirname(mprPath),
            'mprcontents',
            hex.substring(0, 2),
            hex.substring(2, 4),
            `${guid}.mxunit`
        );

        if (fs.existsSync(blobPath)) {
            console.log(`Reading blob: ${blobPath}`);
            const buffer = fs.readFileSync(blobPath);

            // Try to detect JSON
            const str = buffer.toString('utf8');

            // Check for JSON start
            const jsonStart = str.indexOf('{');
            if (jsonStart >= 0) {
                console.log("Potential JSON detected at index " + jsonStart);
                console.log("Snippet:", str.substring(jsonStart, jsonStart + 500));
            } else {
                console.log("No clear JSON start found.");
                console.log("Raw Start:", str.substring(0, 500).replace(/[^\x20-\x7E]/g, ' '));
            }
        }
    } else {
        console.log("No DomainModel unit found.");
    }

    reader.close();
}
