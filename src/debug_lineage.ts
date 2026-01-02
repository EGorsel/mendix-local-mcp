
import { MprReader } from './mprReader.js';
import Database from 'better-sqlite3';

const reader = new MprReader();
const testProjectDir = 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(testProjectDir);

if (mprPath) {
    const db = new Database(mprPath, { readonly: true });

    // 1. Find a Document Unit 
    const docUnit = db.prepare("SELECT UnitID, ContainerID, ContainmentName FROM Unit WHERE ContainmentName = 'Documents' LIMIT 1").get() as any;

    if (docUnit) {
        let current = docUnit;
        console.log("--- Tracing Upwards (Raw Hex) ---");

        while (current) {
            const uHex = current.UnitID.toString('hex');
            const cHex = current.ContainerID ? current.ContainerID.toString('hex') : 'NULL';

            console.log(`Unit: ${uHex} | Container: ${cHex}`);

            if (!current.ContainerID) break;

            const parentId = current.ContainerID;
            // Query by matching UnitID = parentId
            const parent = db.prepare("SELECT UnitID, ContainerID, ContainmentName FROM Unit WHERE UnitID = ?").get(parentId) as any;

            if (!parent) {
                console.log(`❌ Parent lookup failed for blob: ${cHex}`);

                // Try to find if this blob exists ANYWHERE in UnitID column?
                // Or maybe reversed?
                // Let's check if the REVERSED blob exists.
                // Or partially reversed?
                break;
            }
            current = parent;
        }
    }

    db.close();
}
