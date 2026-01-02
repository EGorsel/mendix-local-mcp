
import { MprReader } from './mprReader.js';

const reader = new MprReader();
const targetDir = process.argv[2] || 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(targetDir);

if (mprPath) {
    reader.connect(mprPath);

    console.log("--- Scanning Documents (Microflows/Pages) ---");
    const t1 = Date.now();
    const docs = reader.getDocuments();
    console.log(`Scan took ${Date.now() - t1}ms. Found ${docs.length} docs.`);

    const microflows = docs.filter(d => d.type === 'Microflow');
    console.log(`Microflows: ${microflows.length}`);
    if (microflows.length > 0) {
        console.log("Sample Microflows:", microflows.slice(0, 5).map(m => m.name));

        // Pick one to inspect
        const targetFlow = microflows[0].name;
        console.log(`\n--- Inspecting One Microflow: ${targetFlow} ---`);
        const json = reader.getMicroflowJSON(targetFlow);
        console.log(JSON.stringify(json, null, 2));
    }

    reader.close();
}
