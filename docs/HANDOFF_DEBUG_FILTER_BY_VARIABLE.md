# Handoff: Debug "Filter by Rating Variable" Functionality

**Date:** October 8, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔴 **URGENT & BLOCKING** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Problem:** The "Filter" action is still not working correctly when filtering by rating variables. This is a critical bug that is blocking the implementation of our "Enrichment Pipeline."

**The Mission:** Your task is to debug and fix the `collections:filter` handler to ensure it correctly filters collections based on rating variables.

---

## Part II: Handoff to Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent fixed the `ai_excerpt_ratings` table name in the `collections:filter` handler.

### 2. Current Application State

-   **Does it Run?:** Yes.
-   **Known Bugs:** The "Filter" action still fails when attempting to filter by rating variables.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To debug and fix the `collections:filter` handler when filtering by rating variables.
-   **My Thought Process:** The table name is now correct. The issue is likely in the SQL query logic itself, or how parameters are being passed. I need to inspect the generated SQL query and the parameters to find the discrepancy.
-   **Relevant Files:** `src/ipc/collection-handlers.js`.

### 4. Next Immediate, Actionable Task

Your task is to debug and fix the `collections:filter` handler when filtering by rating variables:

1.  **Add Debug Logging:** In `src/ipc/collection-handlers.js`, inside the `ipcMain.handle('collections:filter', ...)` handler, add extensive `console.log` statements to inspect:
    -   The `query` string being built.
    -   The `queryParams` array being populated.
    -   The `params.filters` object received from the frontend.
2.  **Reproduce the Bug:** Run the application and attempt to filter a PDF collection by a rating variable (e.g., "AI Only," "Rated," or a score range).
3.  **Analyze the Logs:** Examine the console output in the main process (Electron's DevTools for the main process, or the terminal where `npm start` is running). Look for the generated SQL query and parameters.
4.  **Identify the Discrepancy:** Compare the generated SQL query with what you expect it to be. Is the `WHERE` clause correct? Are the parameters in the right order and type? Pay close attention to how `score` (which is TEXT in the database) is being compared.
5.  **Fix the Query:** Correct the SQL query logic or parameter passing to ensure it correctly filters by rating variables.

### 5. Verification

-   Run the application.
-   Successfully filter a collection by a rating variable.
-   Verify that a new, filtered collection is created with the correct items.
-   Run `npm run test:e2e` to ensure no regressions.

### 6. `git diff HEAD`

There are uncommitted changes from the previous agent's bug fix. You should review and commit them before you begin your work to ensure the repository is in a clean state.
