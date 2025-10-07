# Handoff for Agent A: Kickoff "The Great Refactoring"

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Implementation Agent A

---

## Part I: Strategic Context (For All Stakeholders)

This document officially kicks off our **"Great Refactoring"** sprint. 

**The Why:** We are pausing new feature development to address our accumulated technical debt. This "Invest and Accelerate" sprint will make all future development faster and more stable by refactoring our monolithic core files (`main.js`, `db.js`) and aligning the application with the **"Collections-First"** architecture.

**The Plan:** The full strategic vision for this effort is detailed in `docs/BLUEPRINT_REFACTORING_AND_AGENTIC_TESTING.md`. This handoff represents the very first step in that plan.

---

## Part II: Handoff to Agent A (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

This is the first handoff of the new session. No code has been changed yet. The repository is in a clean state, ready for you to begin.

### 2. Current Application State

-   **Does it Run?:** Yes. The application is stable.
-   **Known Bugs:** There are no known *functional* bugs. The issues we are addressing are purely architectural.
-   **Last Tested Action:** The application was last verified after the `prompt()` regression was fixed.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To begin Step 1 of the blueprint, "The Great Decomposition," by breaking up the monolithic `main.js` file.
-   **My Thought Process:** `main.js` is our largest source of technical debt, containing over 50 IPC handlers. The safest first step is to extract a small, self-contained group of these handlers into their own module. The **folder-related handlers** are the perfect candidates as they are stable and well-understood.
-   **Relevant Files:** Your work will primarily involve `main.js` and the creation of a new file.

### 4. Next Immediate, Actionable Task for You (Agent A)

Your task is to perform the first IPC handler refactoring:

1.  Create a new directory: `src/ipc/`.
2.  Create a new file inside it: `src/ipc/folder-handlers.js`.
3.  **Cut** all IPC handlers related to folders (e.g., `ipcMain.handle('folders:create', ...)` , `ipcMain.handle('folders:get', ...)` etc.) from `main.js` and **paste** them into the new `src/ipc/folder-handlers.js` file.
4.  At the top of `folder-handlers.js`, add the necessary `require` statements that the moved functions will need (e.g., `const { ipcMain } = require('electron');`).
5.  At the bottom of `folder-handlers.js`, export a single registration function. The function should look like this:
    ```javascript
    function registerFolderHandlers(getDatabase) {
      // Paste all the ipcMain.handle(...) calls here
    }

    module.exports = { registerFolderHandlers };
    ```
6.  In `main.js`, import this new module at the top: `const { registerFolderHandlers } = require('./src/ipc/folder-handlers');`
7.  In `main.js`, find where the database `db` object is initialized. Immediately after that, call the new function to register the handlers: `registerFolderHandlers(getDatabase);`
8.  **Verify your work** by running the app (`npm run dev`) and testing a folder operation (e.g., create a new folder in the UI) to confirm that the functionality is unchanged.

### 5. The Big Picture: The Overall Goal

Remember, this small task is the critical first domino in our "Great Refactoring." The pattern you establish here—extracting handlers into a domain-specific file and exporting a registration function—will be the template we use to decompose the entire `main.js` file.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
