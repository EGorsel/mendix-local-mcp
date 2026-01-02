
import { MprReader } from './mprReader.js';
import path from 'path';

const reader = new MprReader();
// Assuming we run this from project root, and we look in the parent or current directory.
// We need a target directory that contains an .mpr file.
// Based on workspace or provided argument
const targetDir = process.argv[2] || 'c:/Mendix apps/Mendix_AntiGravity';

console.log(`Searching for .mpr in: ${targetDir}`);
const mprPath = reader.findMprFile(targetDir);

if (mprPath) {
    console.log(`Found .mpr: ${mprPath}`);
    try {
        reader.connect(mprPath);
        console.log("Connected successfully.");

        console.log("--- Schema Inspection ---");
        // We need to inspect the DB structure to know how to query 'Unit'.
        // This is a temporary inspection step exposed via a raw method or just running it here? 
        // Reader encapsulation prevents accessing 'db' directly. 
        // We'll use 'getProjectSummary' which logs columns currently.

        const modules = reader.getModules();
        console.log(`Found ${modules.length} modules.`);
        console.log("Modules:", modules);

        console.log("--- Domain Model Inspection (first module) ---");
        if (modules.length > 0) {
            const dm = reader.getDomainModel(modules[0]);
            console.log(`Domain Model elements in ${modules[0]}: ${dm.length}`);
        }


        console.log("--- Inspecting 'Unit' Schema ---");
        const schema = reader.getSchema('Unit');
        console.log("Schema Columns:", schema.map((c: any) => c.name));

        reader.close();

    } catch (e) {
        console.error("Connection failed:", e);
    }
} else {
    console.error("No .mpr file found.");
}
