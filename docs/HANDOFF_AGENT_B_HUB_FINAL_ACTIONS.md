# Handoff: Implement Final Hub Actions

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Hub is Feature-Complete.** The previous agent successfully wired up the core analysis actions (`Rate`, `BWS`) to the new context menu. The primary user workflow is now functional and intuitive.

**The Final Mission:** Your task is to complete the Collections Hub by implementing the remaining utility actions in the context menu: **Export, Duplicate, and Delete**.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The collection card context menu is functional, and the `Rate` and `BWS` actions are correctly wired to their respective modals.
-   The last commit was `9b4c5a3`.

### 2. Current Application State

-   **Does it Run?:** Yes. The application is stable.
-   **Known Bugs:** The `Export`, `Duplicate`, and `Delete` menu items are not yet functional.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To wire up the remaining three utility actions in the context menu.
-   **My Thought Process:** The backend logic for most of these actions already exists in our IPC handlers. This task is primarily about connecting the UI buttons to the existing `window.api` functions, adding the necessary user prompts (like file dialogs and confirmation modals), and creating one new simple handler for `delete`.
-   **Relevant Files:** `src/components/collections-hub.js`, `src/ipc/collection-handlers.js`, `preload.js`.

### 4. Next Immediate, Actionable Task

Your task is to implement the `Export`, `Duplicate`, and `Delete` actions in the Collection Card context menu:

1.  **Locate the Methods:** In `src/components/collections-hub.js`, find the placeholder methods for these actions within your context menu logic.

2.  **Implement Export:**
    -   When the 'Export' button is clicked, first use `window.api.dialog.saveFile(...)` to ask the user where to save the `.json` file.
    -   If a path is provided, call the existing `window.api.collections.exportToJSON(collectionId, outputPath)` function.
    -   Show a success toast notification upon completion.

3.  **Implement Duplicate:**
    -   When 'Duplicate' is clicked, use the existing `showInputDialog` helper to ask for the "Name of new collection."
    -   If a name is provided, call the existing `window.api.collections.duplicate(...)` function.
    -   Refresh the collections list to show the new duplicate.

4.  **Implement Delete:**
    -   This requires a new backend handler. First, in `src/ipc/collection-handlers.js`, create a new handler for `collections:delete` that takes a `collectionId` and deletes it from the database.
    -   Expose this new handler in `preload.js` as `window.api.collections.delete(collectionId)`.
    -   In the UI, when 'Delete' is clicked, first use the existing `showConfirmModal` helper to ask the user "Are you sure you want to delete this collection?".
    -   If confirmed, call your new `window.api.collections.delete(collectionId)` function and refresh the collections list.

5.  **Verification:**
    -   Run the application and verify that you can successfully Export, Duplicate, and Delete a collection from the context menu.
    -   Confirm that appropriate dialogs (save file, input, confirm) appear for each action.
    -   Ensure success/error toast notifications are displayed.

### 5. The Big Picture: The Overall Goal

Completing this task will make the Collections Hub **100% feature-complete** for all primary collection operations. This will mark the successful completion of our entire UI unification sprint.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
