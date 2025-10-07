# Handoff for Agent A: Final Decomposition of main.js

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Implementation Agent A

---

## Part I: Strategic Context

The team has made incredible progress on "The Great Refactoring." All major, domain-specific IPC handlers (Folders, Collections, PDF, YouTube, AI, and BWS) have been successfully extracted from `main.js`.

Your task is to **complete Step 1 of the blueprint** by extracting the final, smaller groups of miscellaneous utility handlers. This is the final cleanup step that will leave `main.js` as a clean application orchestrator.

---

## Part II: Handoff to Agent A (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   Agent B has successfully extracted all AI and BWS handlers into `src/ipc/ai-handlers.js` and `src/ipc/bws-handlers.js`.
-   The `main.js` file has been dramatically simplified.
-   The last commit was `2353e0b`.

### 2. Current Application State

-   **Does it Run?:** Yes. The application is stable and starts without errors.
-   **Known Bugs:** No known functional bugs. We are continuing our architectural refactoring.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To complete the decomposition of `main.js` by cleaning out all remaining IPC handlers, leaving only application lifecycle code.
-   **My Thought Process:** The remaining handlers fall into a few small, logical utility groups: Database, Settings, Dialogs, and Tools/Export. We can group these into a few final modules to complete the refactoring of `main.js`.
-   **Relevant Files:** Your work will be in `main.js` and the `src/ipc/` directory.

### 4. Next Immediate, Actionable Task for You (Agent A)

Your task is to extract the final remaining IPC handlers from `main.js`:

1.  Create a new file: `src/ipc/database-handlers.js`. Move all `db:...` and `database:...` handlers into it.
2.  Create a new file: `src/ipc/settings-handlers.js`. Move all `settings:...` handlers into it.
3.  Create a new file: `src/ipc/utility-handlers.js`. Move the remaining handlers (`dialog:...`, `system:...`, `tools:...`, `export:...`) into this single file.
4.  For each new file, follow the established pattern: add the necessary `require` statements at the top and export a single registration function that accepts the dependencies it needs (e.g., `getDatabase`, `mainWindow`).
5.  In `main.js`, import these new modules and call their respective registration functions.
6.  **Verification:** Run the app (`npm run dev`). The most important checks are:
    -   The **Settings modal** opens and saves API keys correctly.
    -   The **file dialogs** for any import/export action still work.
    -   This will confirm the most critical utility handlers were refactored correctly.

### 5. The Big Picture: The Overall Goal

Completing this task will officially mark the end of **Step 1: The Great Decomposition**. `main.js` will finally be free of business logic, and we will be fully prepared to begin Step 2: Modernizing the isolated service modules.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
