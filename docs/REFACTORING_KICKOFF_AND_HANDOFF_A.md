# The Great Refactoring: Kickoff & Handoff for Agent A

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Agent A

---

## Part I: Strategic Overview (For All Stakeholders)

This document officially kicks off our **"Great Refactoring"** sprint. 

**The Why:** As a team, we have decided to pause new feature development to address our accumulated technical debt. This "Invest and Accelerate" sprint is a strategic move to make all future development faster, more stable, and more enjoyable. Our goal is to refactor our monolithic core files (`main.js`, `db.js`) and align the entire application with the **"Collections-First"** architecture.

**The Plan:** The full strategic vision and multi-step plan for this effort is detailed in `docs/THE_GRAND_REFACTORING_A_STRATEGIC_BLUEPRINT.md`. This handoff represents the very first step in that plan.

---

## Part II: Handoff to Agent A (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

This is the first handoff of the refactoring sprint. No code has been changed yet. The previous session concluded with the creation of the strategic blueprint that guides this work.

### 2. Current Application State

-   **Does it Run?:** Yes. The application is stable following the last bug-fixing phase.
-   **Known Bugs:** There are no known *functional* bugs. The issues we are addressing are purely architectural.
-   **Last Tested Action:** The application is ready for the User Acceptance Test outlined in `docs/INTEGRATION_TEST_PLAN_PHASE_0.md`. We are strategically choosing to perform this refactoring before that final UAT.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To begin Step 1 of the blueprint, "The Great Decomposition," by breaking up the monolithic `main.js` file.

-   **My Thought Process:** `main.js` is over 1500 lines long and contains more than 50 IPC handlers for every feature in the app. This makes it difficult to maintain and a high-risk area for regressions. The safest and most logical first step is to extract a small, well-understood group of handlers into their own module. The **folder-related handlers** are perfect for this, as they are self-contained and were recently stabilized.

-   **Relevant Files & Snippets:**
    -   The primary file you will be working in is `main.js`.
    -   You will be looking for the block of code containing the folder-related IPC handlers, which starts around line 900 and looks like this:
        ```javascript
        // in main.js
        ipcMain.handle('folders:create', async (event, name, parentFolderId, options) => { ... });
        ipcMain.handle('folders:get', async (event, folderId) => { ... });
        // ...and so on for all folder actions.
        ```
    -   You can see the full list of these handlers defined in `preload.js` under the `folders:` key.

### 4. Next Immediate, Actionable Task for Agent A

Your task is to perform the first IPC handler refactoring:

1.  Create a new directory: `src/ipc/`.
2.  Create a new file inside it: `src/ipc/folder-handlers.js`.
3.  **Cut** all IPC handlers related to folders (e.g., `ipcMain.handle('folders:create', ...)` , `ipcMain.handle('folders:get', ...)` etc.) from `main.js` and **paste** them into the new `src/ipc/folder-handlers.js` file.
4.  At the top of `folder-handlers.js`, add the necessary `require` statements that the moved functions will need (e.g., `const { ipcMain } = require('electron');`, etc.).
5.  At the bottom of `folder-handlers.js`, export a single registration function. The function should look like this:
    ```javascript
    function registerFolderHandlers(db) {
      // Paste all the ipcMain.handle(...) calls here
    }

    module.exports = { registerFolderHandlers };
    ```
6.  In `main.js`, import this new module at the top: `const { registerFolderHandlers } = require('./src/ipc/folder-handlers');`
7.  In `main.js`, find where the database `db` object is initialized. Immediately after that, call the new function to register the handlers: `registerFolderHandlers(db);`
8.  Run the application with `npm run dev` and test a folder operation (e.g., create a new folder in the UI) to verify that the functionality is completely unchanged.

### 5. The Big Picture: The Overall Goal

Remember, this small task is the critical first domino in our "Great Refactoring." The pattern you establish here—extracting handlers into a domain-specific file and exporting a registration function—will be the template we use to decompose the entire `main.js` file, making our codebase cleaner, safer, and easier to build upon.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state, ready for you to begin.
