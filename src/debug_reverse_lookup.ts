
import { MprReader } from './mprReader.js';
import Database from 'better-sqlite3';

const reader = new MprReader();
const testProjectDir = 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(testProjectDir);

if (mprPath) {
    const db = new Database(mprPath, { readonly: true });
    
    // 1. Get a document's container ID
    const docUnit = db.prepare("SELECT UnitID, ContainerID FROM Unit WHERE ContainmentName = 'Documents' LIMIT 1").get() as any;
    
    if (docUnit && docUnit.ContainerID) {
        const cid = docUnit.ContainerID as Buffer;
        const uid = docUnit.UnitID as Buffer;
        
        console.log(`Document: ${uid.toString('hex')}`);
        console.log(`ContainerID (Raw): ${cid.toString('hex')}`);
        
        // Try direct match
        const p1 = db.prepare("SELECT UnitID FROM Unit WHERE UnitID = ?").get(cid);
        if (p1) console.log("✅ Match found (Direct)!");
        else console.log("❌ No match (Direct).");
        
        // Try Reversed? (Byte per byte reverse)
        const reversed = Buffer.from(cid).reverse();
        console.log(`ContainerID (Reversed): ${reversed.toString('hex')}`);
        const p2 = db.prepare("SELECT UnitID FROM Unit WHERE UnitID = ?").get(reversed);
        if (p2) console.log("✅ Match found (Reversed)!");
        else console.log("❌ No match (Reversed).");
        
        // Try GUID Swap? (4-2-2-8)
        // If ContainerID is BE, and UnitID is LE.
        // We need to swap BE -> LE.
        // Swap logic:
        const swap = (b: Buffer) => {
             const p1 = b.slice(0, 4).reverse();
             const p2 = b.slice(4, 6).reverse();
             const p3 = b.slice(6, 8).reverse();
             const p4 = b.slice(8, 16); // last 8 bytes usually not valid? Or 8-10, 10-16.
             // Standard GUID swap affects first 3 parts.
             // Let's use the reader's swap method logic but return Buffer.
             const res = Buffer.alloc(16);
             p1.copy(res, 0);
             p2.copy(res, 4);
             p3.copy(res, 6);
             b.slice(8, 16).copy(res, 8); // No reverse for variants usually?
             return res;
        };
        const swapped = swap(cid);
         console.log(`ContainerID (Swapped): ${swapped.toString('hex')}`);
        const p3 = db.prepare("SELECT UnitID FROM Unit WHERE UnitID = ?").get(swapped);
        if (p3) console.log("✅ Match found (Swapped)!");
        else console.log("❌ No match (Swapped).");
    }
    
    db.close();
}
