# Blueprint for Phase 2: The Enrichment Pipeline

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔵 **PROPOSED BLUEPRINT FOR NEXT SESSION**

---

## Part I: The Vision - Collections That Learn

With our application now stable and architecturally sound, we can begin building the core analysis features that were our original goal. This next major phase of development will be dedicated to building the **Enrichment Pipeline**.

The goal is to fully realize our "Collections-First" philosophy. Actions like "Rate" or "Filter" will no longer be disconnected operations; they will be transformations that produce **new, derived collections**. Each new collection will be explicitly linked to its parent, creating a clear, traceable **lineage** of analysis. This makes our application a true tool for rigorous, reproducible research.

---

## Part II: The Technical Plan

To achieve this vision, we will execute the following steps in our next development session:

### Step 1: Database Schema for Lineage

-   **Task:** We must first update our database to support the concept of derived collections.
-   **Action:** Add two new columns to the `collections` table:
    1.  `parent_collection_id` (INTEGER): A foreign key that links a derived collection to its parent.
    2.  `derivation_info` (TEXT): A JSON blob to store the details of the operation that created this collection (e.g., `{ "method": "filter", "parameters": { "min_score": 0.8 } }`).

### Step 2: Refactor Core Services for Derivation

-   **Task:** We will update our modernized backend services to use this new schema.
-   **Action:** The `AiRaterService`, and the `collections:filter` and `collections:subsample` handlers will be modified. Instead of just performing an action, their final step will be to create a *new* collection record in the database, setting its `parent_collection_id` and `derivation_info` to record the operation.

### Step 3: Visualize the Lineage in the UI

-   **Task:** The UI must be updated to display these new relationships.
-   **Action:** The Collections Hub will be enhanced to visually represent parent-child relationships between collections, perhaps using an indented tree-like structure or visual connectors. The "Enrichment Layers" section on each card will be made functional, listing the analyses that have been run and the derived collections that have been created.

---

## Part III: The First Task for the Next Session

We will begin with the foundational database work.

-   **Handoff for the Next Implementation Agent:**
    -   **Goal:** Implement the database schema changes required for derived collections.
    -   **Task:**
        1.  Create a new migration script in the `scripts/` directory.
        2.  In this script, add the `parent_collection_id` (INTEGER) and `derivation_info` (TEXT) columns to the `collections` table.
        3.  Run the migration and verify that the columns have been successfully added to the database schema.
        4.  Update the relevant database manager class (e.g., `collection-manager.js`) to support creating and updating collections with these new fields.

---

## Conclusion

This phase will be incredibly rewarding. It will take our stable, well-architected application and build our core, value-adding analysis features on top of it. By the end of this phase, the application will not just be a data collector, but a true data analysis and exploration platform.
