
import { MprReader } from './mprReader.js';
import path from 'path';

const reader = new MprReader();
const testProjectDir = 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(testProjectDir);

if (mprPath) {
    reader.connect(mprPath);

    // Debug 1: Check Module Unit ID
    // We access private method via brute force or just copy logic.
    // Copying logic to verify.
    const moduleName = "Administration";
    console.log(`Searching for module: ${moduleName}`);

    const units = reader.executeQuery("SELECT UnitID FROM Unit WHERE ContainmentName = 'Modules'");
    let modId: any = null;

    // Helper needed for scanning blobs manually here (MprReader logic)
    // We will assume MprReader internal logic is what we are testing.
    // So let's add a public debug method or just modify MprReader temporary to log?
    // Or just trust my re-implementation here.

    // NOTE: I cannot easily verify without importing swapGuid (private).
    // I already verified MprReader.ts has getModuleUnitId logic.

    // Let's modify MprReader.ts to log to console during getDocuments?
    // No, better to test the SQL.

    // Let's check ContainerID of ChunkCollection_Insert document.
    // Find UnitID of ChunkCollection_Insert.
    // This requires scanning all documents, finding the one with name.
    console.log("Scanning documents to find 'ChunkCollection_Insert'...");
    const docs = reader.executeQuery("SELECT UnitID, ContainerID FROM Unit WHERE ContainmentName = 'Documents'");
    // This is slow (scanning blobs).

    // Let's try a different approach.
    // Get ALL modules and their UnitIDs.
    // Count descendants for each.

    console.log("--- Module UnitIDs ---");
    // We can't swapGuid easily here. 
    // Let's modify MprReader to expose `debugGetModuleId(name)` public?
    // Or I can just write a script that imports MprReader and uses `executeQuery`.
    // Actually I can just rely on the count. 970 docs in Administration seems wildly high if total project is small, or normal if it is big.
    // Total docs in project?

    const totalDocs = reader.getDocuments().length;
    console.log(`Total Documents in Project: ${totalDocs}`);

    const adminDocs = reader.getDocuments("Administration").length;
    console.log(`Documents in Administration: ${adminDocs}`);

    const pgDocs = reader.getDocuments("PgVectorKnowledgeBase").length;
    console.log(`Documents in PgVectorKnowledgeBase: ${pgDocs}`);

    if (adminDocs === totalDocs) {
        console.error("⚠️ Filter failed. Admin count equals Total count.");
    } else {
        console.log("✅ Filter seems active.");
    }

    reader.close();
}
