# Handoff: Implement Collection Card Context Menu

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Hub is Navigable.** The previous agent successfully wired up the `[View]` button, making the core of our new UI functional. 

**The Next Mission:** The Hub is beautiful and navigable, but its action buttons are not yet functional. Your task is to bring the Hub to life by implementing a functional context menu for each collection card, allowing users to access key analysis features like `Rate` and `BWS`.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The `[View]` button on collection cards now correctly opens the appropriate viewer based on the collection's genre.
-   The last commit was `ece0c0a`.

### 2. Current Application State

-   **Does it Run?:** Yes. The application is stable.
-   **Known Bugs:** The `...` menu button on collection cards only logs to the console; it does not open a menu.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To wire up the `...` menu button to open a context menu with functional actions.
-   **My Thought Process:** We have already refactored the "Create Rating Project" and "Create BWS Experiment" modals to be globally accessible. This task simply involves creating a small, dynamic menu UI and connecting its buttons to the existing modal functions (`showCreateRatingProjectModal` and `showCreateBwsModal`) that are already in `folder-browser.js`.
-   **Relevant Files:** `src/components/collections-hub.js` and `src/styles/collections-hub.css`.

### 4. Next Immediate, Actionable Task

Your task is to implement a functional context menu for the Collection Cards:

1.  **Locate the Method:** In `src/components/collections-hub.js`, find the `handleMenuClick(collectionId)` method. It currently contains a `console.log`.
2.  **Implement the Menu UI:** Inside this method, you will dynamically create and display a context menu. This should be a styled `div` containing a list of action buttons. It should appear next to the `...` button that was clicked and should close automatically if the user clicks elsewhere on the screen.
3.  **Menu Items:** The menu must contain, at a minimum, the following options:
    -   `Rate Collection`
    -   `BWS Experiment`
    -   `Export`
    -   `Duplicate`
    -   `Delete`
4.  **Implement Actions:**
    -   Clicking `Rate Collection` should call the existing `showCreateRatingProjectModal(collectionId)` method (which you will need to move from `folder-browser.js` to `collections-hub.js`).
    -   Clicking `BWS Experiment` should call the existing `showCreateBwsModal(collectionId)` method (which you will also need to move).
    -   The other actions (`Export`, `Duplicate`, `Delete`) can remain stubbed with a `console.log` for now.
5.  **Verification:**
    -   Run the application (`npm run dev`).
    -   Click the `...` button on any collection card. A menu should appear.
    -   Click "Rate Collection." The "Create New Rating Project" modal should appear with the correct collection pre-selected.
    -   Click "BWS Experiment." The "Create BWS Experiment" modal should appear with the correct collection pre-selected.

### 5. The Big Picture: The Overall Goal

Completing this task makes our core analysis workflows accessible from the new UI. This is a critical step in fully deprecating the old application structure and completing our "Collections-First" vision.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
