
import { MprReader } from './mprReader.js';

const reader = new MprReader();
const testProjectDir = 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(testProjectDir);

if (mprPath) {
    reader.connect(mprPath);
    console.log("Connected.");

    // Check PgVectorKnowledgeBase (known to have docs)
    const docs = reader.getDocuments("PgVectorKnowledgeBase");
    console.log(`PgVectorKnowledgeBase Documents: ${docs.length}`);
    if (docs.length > 0) {
        console.log("✅ Filtering Works! Found docs:", docs.map(d => d.name).join(", "));
    } else {
        console.log("❌ Filtering Failed (0 docs found).");
    }

    // Check Administration (might be empty but check anyway)
    const adminDocs = reader.getDocuments("Administration");
    console.log(`Administration Documents: ${adminDocs.length}`);

    reader.close();
}
