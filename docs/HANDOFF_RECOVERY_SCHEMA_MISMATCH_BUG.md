# Handoff: Final Recovery Task - Fix Schema Mismatch Bug

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔴 **URGENT & BLOCKING** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Final Step to Stability:** The "Ghost UI" bug is fixed. This is the last remaining task in our mandatory "Hardening Sprint." The application is still considered broken until this is resolved.

**The Bug:** The "Filter" action crashes with a `SQLITE_ERROR: table videos has no column named video_id`. The code is referencing a database column that does not exist.

---

## Part II: Handoff to Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent successfully fixed the `bws-manager.js` startup error.

### 2. Current Application State

-   **Does it Run?:** Yes, but core functionality is broken.
-   **Known Bugs:** Using the "Filter" action on a collection will cause a fatal database error.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To fix the broken SQL query in the Filter action handler.
-   **My Thought Process:** This is a simple but critical bug. An agent wrote a query assuming a column name (`video_id`) that is incorrect. The fix is to find that query and replace it with the correct column name (`id`).
-   **Relevant Files:** The error originates in the backend, so the file to modify is likely `src/ipc/collection-handlers.js`.

### 4. Next Immediate, Actionable Task

Your task is to fix the Schema Mismatch bug:

1.  **Locate the Handler:** Open the `src/ipc/collection-handlers.js` file.
2.  **Find the Bug:** Inside the `ipcMain.handle('collections:filter', ...)` handler, find the SQL query that is performed on the `videos` table.
3.  **Correct the Query:** The query is likely referencing `video_id` in a `WHERE` clause or a `JOIN`. You must change this to reference the correct primary key for the `videos` table, which is simply `id`.
4.  **Verification:**
    -   Run the application (`npm run dev`).
    -   Right-click on any collection and use the "Filter" action.
    -   **The action must complete successfully without any `SQLITE_ERROR` in the console.** A new, filtered collection should appear in the Hub.
    -   As per our workflow, run the full E2E test (`npm run test:e2e`) to ensure your fix has not caused any regressions.

### 5. The Big Picture: The Overall Goal

By fixing this bug, you will complete our Hardening Sprint. The application will be stable, error-free, and finally ready for the exciting new feature work in the UX Overhaul phase.

### 6. `git diff HEAD`

There are uncommitted changes from the previous agent's bug fix. You should review and commit them before you begin your work to ensure the repository is in a clean state.
