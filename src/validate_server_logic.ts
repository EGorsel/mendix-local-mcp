
import { MprReader } from './mprReader.js';
import path from 'path';

async function validate() {
    console.log("=== Validating Mendix Local MCP Server Logic ===");

    // 1. Setup
    const reader = new MprReader();
    const testProjectDir = 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
    const mprPath = reader.findMprFile(testProjectDir);

    if (!mprPath) {
        console.error(`❌ Could not find .mpr file in ${testProjectDir}`);
        process.exit(1);
    }

    console.log(`✅ Found MPR: ${mprPath}`);
    reader.connect(mprPath);

    // 2. Test Module Listing
    console.log("\n--- [1] Testing list_local_modules ---");
    const modules = reader.getModules();
    console.log(`Found ${modules.length} modules.`);
    if (modules.length > 0) {
        console.log(`Sample: ${modules.slice(0, 5).join(', ')}`);
        if (modules.includes("Administration")) {
            console.log("✅ 'Administration' module found.");
        } else {
            console.warn("⚠️ 'Administration' module NOT found (Expected).");
        }
    } else {
        console.error("❌ No modules found.");
    }

    // 3. Test Document Listing (Filtered)
    const targetModule = "Administration";
    console.log(`\n--- [2] Testing list_local_documents (Module: ${targetModule}) ---`);
    const docs = reader.getDocuments(targetModule);
    console.log(`Found ${docs.length} documents in ${targetModule}.`);

    const micros = docs.filter(d => d.type === 'Microflow');
    console.log(`Microflows: ${micros.length}, Pages: ${docs.filter(d => d.type === 'Page').length}`);

    if (micros.length > 0) {
        console.log(`Sample Microflow: ${micros[0].name}`);

        // 4. Test Microflow Inspection
        console.log(`\n--- [3] Testing inspect_local_microflow (${micros[0].name}) ---`);
        const flowData = reader.getMicroflowJSON(micros[0].name);
        if (flowData.error) {
            console.error(`❌ Error: ${flowData.error}`);
        } else {
            console.log("✅ Microflow extracted successfully.");
            console.log(`Activities found: ${flowData.activities.length}`);
            if (flowData.activities.length > 0) {
                console.log("First activity type: " + flowData.activities[0].type);
            }
        }
    }

    // 5. Test Domain Model
    console.log(`\n--- [4] Testing get_domain_model (${targetModule}) ---`);
    // Note: getDomainModel implementation might not support filtering yet perfectly if regex based, checking current state.
    const entities = reader.getDomainModel(targetModule);
    console.log(`Found ${entities.length} entities (Total/Filtered).`);
    if (entities.length > 0) {
        console.log(`Sample: ${entities[0].name}`);
    }

    reader.close();
    console.log("\n=== Validation Complete ===");
}

validate();
