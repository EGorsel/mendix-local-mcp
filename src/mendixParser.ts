
import { Buffer } from 'buffer';

export class MendixParser {

    /**
     * Safely reads a Mendix string from the buffer at the given offset.
     * Mendix strings often appear as: [TypeMarker?] [Length: 4 bytes] [Chars]
     * But often the marker is before the property name.
     * We will try to read a length-prefixed string from exactly this offset.
     */
    static readStringAt(buffer: Buffer, offset: number): { value: string, nextOffset: number } | null {
        if (offset + 4 > buffer.length) return null;

        const length = buffer.readInt32LE(offset);

        // sanity check for length. Strings are usually < 10KB.
        if (length < 0 || length > 10000) return null;
        if (offset + 4 + length > buffer.length) return null;

        const strVal = buffer.toString('utf8', offset + 4, offset + 4 + length);

        // Mendix strings usually end with null 0x00? Or just exact length?
        // From inspection: Forms$Snippet (13) had length 14. ReadMe (6) had length 7.
        // It seems to be C-style null terminated counted string.
        const cleanVal = strVal.replace(/\x00$/, '');

        return {
            value: cleanVal,
            nextOffset: offset + 4 + length
        };
    }

    /**
     * Heuristic scanner that looks for "Property Name" followed immediately by "Property Value".
     * In the blob: 02 "Name" 00..07 "ReadMe"
     * Marker 02 seems to indicate "Property Name follows".
     * Value follows immediately.
     */
    static extractProperties(buffer: Buffer): Record<string, string> {
        const result: Record<string, string> = {};
        let offset = 0;

        // We scan linearly. 
        // If we find what looks like a string, we check if it is a known property key (Name, $Type).
        // If so, we assume the NEXT thing is the value (or we search for value).
        // This is still heuristic but better than Regex because it respects length.

        while (offset < buffer.length - 8) { // 4 bytes len + min 1 byte
            try {
                // Try to read a string here
                const strObj = this.readStringAt(buffer, offset);

                if (strObj) {
                    const key = strObj.value;
                    // Is this a known key?
                    if (key === 'Name' || key === '$Type' || key === 'Caption') {
                        // The VALUE usually follows immediately?
                        // Let's look at the dump:
                        // 02 "Name" (Prop) -> 02 4E ...
                        // 00 07 00 00 00 ... len 7
                        // ... "ReadMe"

                        // Wait, in the dump:
                        // 0x9a: 02 4E 61 6D 65 (02 Name)
                        // 0x9f: 00 07 00 00 00 (Length 7)
                        // 0xa4: 52 65 61 64 4D 65 00 (ReadMe\0)
                        // Total length of "Name" block: 1 byte marker + 4 bytes len + 5 bytes "Name\0" = 10 bytes?
                        // "Name" is 4 chars. Len 5.

                        // Re-reading dump:
                        // 0x9a: 02 (Marker)
                        // 0x9b: 4E 61 6D 65 00 (Name\0) -> Wait, where is length for Name?
                        // Actually the dump shows: 
                        // 0010: ... 02 24 54 79 70 65 00 ...
                        // 02 $Type\0. 
                        // Then 0e 00 00 00 (Length 14).
                        // So Property Key is NOT length prefixed? Or maybe it is fixed or C-string?
                        // "Name" (4 chars) -> 02 4E 61 6D 65 00. (6 bytes).
                        // "Hidden" (6 chars).
                        // 48 69 64 64 65 6e 00 (Hidden\0).

                        // HYPOTHESIS: Keys are 0x02 + Null-Terminated String. Values are Length-Prefixed Strings.

                        // Let's assume we just scanned 'key' (which we did blindly).
                        // If we are at 'nextOffset', what is there?
                        // If key was "Name" (extracted from null-term string), then verify logic.

                        // Actually, blindly reading length-prefixed strings won't find keys if keys are NOT length-prefixed.
                        // Let's assume keys are just text in the blob.
                    }
                }

                offset++;
            } catch (e) {
                offset++;
            }
        }
        return result;
    }

    /**
     * Regex is actually cleaner if we accept that keys are plain text.
     * But we want to protect against binary noise.
     * 
     * Improved Strategy:
     * 1. Search for key string (e.g. "Name") in binary.
     * 2. Verify it is preceded by 0x02 (Property Marker).
     * 3. Verify it is followed by 0x00 (Null Terminator).
     * 4. Then READ the Integer immediately following.
     * 5. That Integer is the length of the Value.
     * 6. Read that many bytes as Value.
     */
    static getProperty(buffer: Buffer, key: string): string | null {
        const keyBuf = Buffer.alloc(key.length + 2);
        keyBuf.writeUInt8(0x02, 0); // Marker
        keyBuf.write(key, 1, 'utf8');
        keyBuf.writeUInt8(0x00, key.length + 1); // Null terminator

        const idx = buffer.indexOf(keyBuf);
        if (idx === -1) return null;

        // The value follows after the key.
        // Position of len: idx + keyBuf.length
        const lenOffset = idx + keyBuf.length;
        if (lenOffset + 4 > buffer.length) return null;

        const len = buffer.readInt32LE(lenOffset);
        if (len < 0 || len > 100000) return null; // Safety

        const valOffset = lenOffset + 4;
        if (valOffset + len > buffer.length) return null;

        const valStr = buffer.toString('utf8', valOffset, valOffset + len);
        // Trim null terminator
        return valStr.replace(/\x00$/, '');
    }
}
