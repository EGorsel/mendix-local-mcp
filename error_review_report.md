
# Error Review Report: Mendix Shadow SDK Module Filtering

## Overview
The goal was to implement `getDocuments(moduleName)` to filter documents by their containing module.
The implementation relies on identifying the `UnitID` of a module (e.g., "Administration") and then using a recursive SQL query to find all descendant units (`Documents`, `Pages`, `Microflows`) that have that `UnitID` as an ancestor.

## The Issue
Filtering returns **0 documents**, even for populated modules like `Administration` or `PgVectorKnowledgeBase`.
Debugging revealed that the linked `UnitID` for the module does not match the `ContainerID` pointers of its children.

## Diagnostic Findings

### 1. Disconnected Hierarchy
- **Module ID:** The Unit for `PgVectorKnowledgeBase` found in the `Modules` containment list has a `UnitID` starting with `f0ea3302...` (Little Endian representation of the GUID).
- **Children's Pointer:** The `_Docs` folder (a direct child of the module) has a `ContainerID` of `0233eaf0...`.

### 2. Endianness Mismatch
The two IDs are byte-swapped versions of the same GUID:
- Module `UnitID`: `f0 ea 33 02 ...`
- Child `ContainerID`: `02 33 ea f0 ...`

This confirms that the `Unit` table uses **inconsistent endianness** (or distinct representations) for the Module Definition versus the Module Container.

### 3. Trace Evidence
- **Downward Trace (Failed):** Querying children where `ContainerID = f0ea...` yields 0 results.
- **Upward Trace (Success):** Starting from a Document, the parent `_Docs` points to `0233...`. This `0233...` Unit exists and is also named `PgVectorKnowledgeBase`.

### 4. Dual Unit Hypothesis
It appears there are effectively two "nodes" for a Module:
1.  **Definition Node (`f0ea...`):** Listed in `Modules` containment. Metadata-heavy.
2.  **Structure Node (`0233...`):** Acts as the actual container for the module's contents (Folders, Documents).

## Proposed Solution
To correctly filter documents:
1.  Find the Module's `UnitID` from the `Modules` list (getting `f0ea...`).
2.  **Swap the Endianness** of this ID to generate the likely `ContainerID` (`0233...`).
3.  Use the **Swapped ID** as the root for the recursive descendant query.
4.  (Optional) Verify if the Swapped ID exists in the `Unit` table to confirm it is the correct container.

## Next Steps
- Modify `MprReader.getModuleUnitId` or `MprReader.getDocuments` to handle this endian swap.
- Re-run `verify_refactor.ts` to confirm correct filtering.
