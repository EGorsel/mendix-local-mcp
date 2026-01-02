
import { MprReader } from './mprReader.js';

const reader = new MprReader();
const targetDir = process.argv[2] || 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(targetDir);

if (mprPath) {
    reader.connect(mprPath);

    console.log("--- Inspecting ContainmentNames ---");
    const rows = reader.executeQuery("SELECT ContainmentName, Count(*) as c FROM Unit GROUP BY ContainmentName ORDER BY c DESC LIMIT 20");
    console.table(rows);

    console.log("\n--- Inspecting 'Microflows' container children ---");
    const folder = reader.executeQuery("SELECT UnitID FROM Unit WHERE ContainmentName = 'Microflows' LIMIT 1");
    if (folder.length > 0) {
        const folderId = folder[0].UnitID; // This returns buffer, we can't easily use it in raw query unless we format it x'...'
        // Better-sqlite3 handles buffer params.
        // We need to execute a parameterized query. MprReader.executeQuery only takes string.
        // I'll update MprReader to accept params or just rely on ContainmentName pattern.
    }

    // Check if there are units with ContainmentName that looks like a Microflow name?
    // Or if 'Microflow' is a type?

    reader.close();
}
