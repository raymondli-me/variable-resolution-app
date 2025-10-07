# Handoff: Final UI Unification - Deprecate BWS Tab

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The First Step was a Success:** The previous agent successfully deprecated the "AI Analysis" tab and integrated its functionality into the collection context menu. Our UI is now simpler and more intuitive.

**The Final Mission:** Your task is to complete **Step 3: Building the Unified UI Hub**. You will apply the exact same pattern to the final separate tab: the **BWS Tab**.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The "AI Analysis" tab has been removed.
-   Users can now launch a rating project by right-clicking a collection.
-   The application is stable and the pattern for this refactoring is established.
-   The last commit was `3070cf9`.

### 2. Current Application State

-   **Does it Run?:** Yes.
-   **Known Bugs:** The "BWS" tab remains, representing the last piece of our fragmented UI.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To complete the UI unification by removing the BWS tab and integrating its functionality into the collection context menu, right alongside the "Rate" action.
-   **My Thought Process:** The workflow for creating a BWS experiment should be identical to creating a rating project. The user finds the data they want to analyze (the collection), right-clicks, and chooses the desired action.
-   **Relevant Files:** Your work will be in `index-advanced.html` and `src/components/folder-browser.js`.

### 4. Next Immediate, Actionable Task

Your task is to complete the UI unification by deprecating the "BWS" tab:

1.  **Remove the Navigation:** In `index-advanced.html`, find the main navigation sidebar and **delete the button** for "BWS."
2.  **Remove the View:** In that same file, find and **delete the entire `div`** for the "bwsTab."
3.  **Relocate the Modal:** Find the HTML for the "Create BWS Experiment" modal within the code you just deleted and move it to the main `index-advanced.html` body so it can be accessed globally.
4.  **Add Context Menu Item:** In `src/components/folder-browser.js`, add a new `'bws'` action to the collection context menu, right below the `'rate'` action.
5.  **Implement the Action:** In the `handleContextMenuAction` method, add a `case` for `'bws'`. This should call a new method, `showCreateBwsModal(collectionId)`.
6.  **Move the Modal Logic:** Find and move the JavaScript logic that shows and manages the BWS modal into your new `showCreateBwsModal` method in `folder-browser.js`.
7.  **Pre-fill the Collection:** When the modal opens, it should automatically have the correct collection pre-selected.
8.  **Verification:** Run the app. The "BWS" tab should be gone. You should be able to right-click a collection, choose a new "BWS" option, and see the "Create BWS Experiment" modal appear.

### 5. The Big Picture: The Overall Goal

Completing this task will fully unify our UI. All major analysis actions will originate directly from the collections themselves, fulfilling our core architectural vision of a simple, powerful, data-centric application.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
