
import { MprReader } from './mprReader.js';

const reader = new MprReader();
const targetDir = process.argv[2] || 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(targetDir);

if (mprPath) {
    reader.connect(mprPath);

    // Target: First part of the filename "00147b7b" (from 00147b7b-b231-483b-a9c4-9e83b1f5268d)
    // We check hex representation of blobs too
    const targetHex = "00147b7b";

    console.log(`Searching DB for ${targetHex}...`);

    const rows = reader.executeQuery("SELECT * FROM Unit LIMIT 2000");

    for (const row of rows) {
        // Iterate all keys
        for (const key of Object.keys(row)) {
            const val = row[key];
            if (!val) continue;

            let valHex = '';
            if (Buffer.isBuffer(val)) {
                valHex = val.toString('hex');
            } else if (typeof val === 'string') {
                // Check if string matches (unlikely for GUID)
                if (val.includes(targetHex)) {
                    console.log(`Match in column ${key} (String): ${val}`);
                }
                // Try base64 decode check?
                try {
                    const buf = Buffer.from(val, 'base64');
                    valHex = buf.toString('hex');
                } catch (e) { }
            }

            if (valHex.includes(targetHex)) {
                console.log(`MATCH in column ${key} (Hex): ${valHex}`);
                console.log("Full Row:", row);
            }
        }
    }

    reader.close();
}
