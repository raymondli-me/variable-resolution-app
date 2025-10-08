# Handoff: Implement Robust PDF Subsampling

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** We are beginning a new "mini-phase" focused on building an interactive, AI-assisted rating experience within the PDF viewer. The full blueprint for this is in `docs/BLUEPRINT_MINIPHASE_INTERACTIVE_RATING.md` (which will be created after this task).

**The Prerequisite:** Before we build the new rating features, we must ensure all existing collection transformation tools are fully functional for PDF collections. Your task is to implement the **Subsample** action for PDFs.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent successfully stabilized the PDF viewer and implemented a robust, event-driven auto-refresh system for the Collections Hub.

### 2. Current Application State

-   **Does it Run?:** Yes. The application is stable.
-   **Known Bugs:** The "Subsample" action in the collection context menu does not work for PDF collections.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To refactor the `collections:subsample` IPC handler to correctly process PDF collections.
-   **My Thought Process:** The existing handler is designed for video collections. It needs to be updated with logic to query the `pdf_excerpts` table, create a random sample of those excerpts, and then create a new derived collection containing only the sampled excerpts.
-   **Relevant Files:** `src/ipc/collection-handlers.js` (for the backend logic) and `src/components/collections-hub.js` (for the UI modal).

### 4. Next Immediate, Actionable Task

Your task is to implement the `Subsample` action for PDF collections:

1.  **Review Existing Code:** Examine the `collections:subsample` IPC handler in `src/ipc/collection-handlers.js`. Note how it currently handles video collections.
2.  **Refactor for PDFs:** Modify the handler to be "genre-aware." It must check the type of the source collection. If it is a PDF collection, it must:
    -   Fetch all excerpts from the source collection via the `pdf_excerpts` table.
    -   Create a random subsample of those excerpt records.
    -   Create a new **derived collection** (setting `parent_collection_id` and `derivation_info`).
    -   Insert the sampled excerpts into the new collection.
3.  **UI Integration:** The `Subsample` button in the context menu and its modal are already implemented in `collections-hub.js`. Ensure they correctly pass all necessary data (source collection ID, sample size, new name) to the backend.
4.  **Verification:**
    -   Create a PDF collection with a large number of excerpts.
    -   Use the "Subsample" action from the context menu to create a new, smaller collection.
    -   Verify that the new derived collection appears in the Hub.
    -   View the new collection and confirm it contains the correct number of excerpts.
    -   As per our workflow, run `npm run test:e2e` to ensure no regressions.

### 5. The Big Picture

This task completes our suite of collection transformation tools and ensures all data genres are treated as first-class citizens. It is the final prerequisite before we begin building the exciting new "co-pilot" rating interface.
