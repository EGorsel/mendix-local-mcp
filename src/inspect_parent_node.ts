
import { MendixParser } from './mendixParser.js';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { MprReader } from './mprReader.js';

const reader = new MprReader();
const testProjectDir = 'c:/Mendix apps/Mendix_AntiGravity/test-mcp-server';
const mprPath = reader.findMprFile(testProjectDir);

if (mprPath) {
    const db = new Database(mprPath, { readonly: true });
    
    // The ContainerID we found: 7a8670e0c94e4e42970ea39b808b99e3
    const targetId = Buffer.from('7a8670e0c94e4e42970ea39b808b99e3', 'hex');
    
    const unit = db.prepare("SELECT * FROM Unit WHERE UnitID = ?").get(targetId) as any;
    
    if (unit) {
        console.log("Unit Found:");
        console.log(`- ID: ${unit.UnitID.toString('hex')}`);
        console.log(`- ContainmentName: ${unit.ContainmentName}`);
        console.log(`- ContainerID: ${unit.ContainerID ? unit.ContainerID.toString('hex') : 'NULL'}`);
        
        // Load Blob
        const guid = reader['swapGuid'](unit.UnitID);
        const hex = guid.replace(/-/g, '');
        const blobPath = path.join(path.dirname(mprPath), 'mprcontents', hex.substring(0, 2), hex.substring(2, 4), `${guid}.mxunit`);
        
        if (fs.existsSync(blobPath)) {
            const buf = fs.readFileSync(blobPath);
            console.log(`- Blob Size: ${buf.length}`);
            
            const name = MendixParser.getProperty(buf, "Name");
            const type = MendixParser.getProperty(buf, "$Type");
            
            console.log(`- Name: ${name}`);
            console.log(`- Type: ${type}`);
        } else {
             console.log("- Blob not found.");
        }
        
    } else {
        console.error("Target Unit not found.");
    }
    
    db.close();
}
