# Handoff: Kickoff Step 3 - Unify the UI

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**Milestone Achieved:** Step 2, "Modernizing the Core Services," is **100% COMPLETE**. Our entire backend is now a collection of robust, modular, and maintainable services.

**The Next Mission:** We now begin the final and most impactful phase, **Step 3: Building the Unified UI Hub**. Your task is to refactor the application's user interface to align with our "Collections-First" architecture. This will resolve the core architectural confusion and make the application's workflow logical and intuitive.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent successfully modernized the BWS Service, completing our backend refactoring effort.
-   The application is stable, and the backend architecture is now clean and modular.
-   The last commit was `c529154`.

### 2. Current Application State

-   **Does it Run?:** Yes. The application is stable.
-   **Known Bugs:** The primary "bug" is the confusing UI, which we are about to fix.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To begin unifying the UI by removing the separate, confusing top-level tabs and integrating their functionality directly into the main "Collections" view.
-   **My Thought Process:** The user should never have to ask, "Which tab do I go to?" All actions should originate from the data itself. The first and most impactful step is to remove the "AI Analysis" tab and allow users to launch a rating project directly from a collection.
-   **Relevant Files:** Your work will primarily be in `index-advanced.html` and `src/components/folder-browser.js`.

### 4. Next Immediate, Actionable Task

Your task is to take the first step in unifying the UI: **deprecate the "AI Analysis" tab and move its functionality into the "Collections" view.**

1.  **Remove the Navigation:** In `index-advanced.html`, find the main navigation sidebar (`<nav class="nav">`) and **delete the button** for "AI Analysis."
2.  **Remove the View:** In that same file, find and **delete the entire `<div id="ai-analysisView" class="view">...</div>`**. This will remove the now-orphaned page.
3.  **Add a New Context Menu Item:** In `src/components/folder-browser.js`, find the `showContextMenu` method. Add a new `'rate'` action to the list of actions available for the `'collection'` item type.
4.  **Implement the Action:** In the `handleContextMenuAction` method, add a new `case` for the `'rate'` action. When triggered, it should call a new method, for example `this.showCreateRatingProjectModal(id)`.
5.  **Move the Modal Logic:** Find the HTML for the "Create New Rating Project" modal (it is currently inside the `ai-analysisView` div you deleted). Move this modal HTML to the main `index-advanced.html` body so it can be accessed globally. Find the JavaScript logic that shows this modal (likely in `renderer-advanced.js` or a related file) and move it into your new `showCreateRatingProjectModal` method in `folder-browser.js`.
6.  **Pre-fill the Collection:** When the modal opens, it should automatically have the collection that was right-clicked pre-selected in its dropdown menu.
7.  **Verification:** Run the app. The "AI Analysis" tab should be gone. You should be able to right-click on any collection in the folder browser, choose a new "Rate" option, and see the "Create New Rating Project" modal appear with that collection already selected.

### 5. The Big Picture: The Overall Goal

This is the first and most important step in creating our unified, intuitive user experience. The pattern you establish here—moving functionality from a separate tab into a context-sensitive action on a collection—will be the template for fully realizing our "Collections-First" vision.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
