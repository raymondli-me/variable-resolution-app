# Handoff: Create BWS Experiment Modal

**Date:** October 8, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** The 'Manage Variables' modal now supports BWS variables. We are moving to the next step in the BWS Workflow: creating the modal to set up a BWS experiment.

**The Mission:** Your task is to implement the user interface for configuring and launching a new BWS experiment.

---

## Part II: Handoff to Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent successfully implemented Ticket #501: Enhance "Manage Variables" Modal for BWS Support. You can now define BWS variables with "Best" and "Worst" anchors.

### 2. Current Application State

-   **Does it Run?:** Yes.
-   **Known Bugs:** None.
-   **New Feature:** BWS variables can now be created and managed.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To create the UI for setting up a BWS experiment.
-   **My Thought Process:** This modal will be launched from the collection context menu. It needs to allow the user to select a BWS variable, choose a collection, and configure the experiment (e.g., tuple size, number of comparisons).
-   **Relevant Files:** `src/components/collections-hub.js` (for launching the modal), and a new modal HTML/JS.

### 4. Next Immediate, Actionable Task

Your task is to implement the "Create BWS Experiment" modal:

1.  **Modal UI:** Create the HTML and CSS for a new modal. This modal should be launched when the user clicks "BWS Experiment" from the collection context menu.
2.  **Configuration:** The modal should allow the user to configure a BWS experiment. At a minimum, it needs fields for:
    -   Selecting a **BWS Variable** (from the global variables).
    -   Selecting a **Collection** (pre-filled from the context menu).
    -   **Tuple Size** (e.g., 2-5 items per comparison).
    -   **Number of Comparisons** (or target appearances per item).
3.  **Backend Integration (Stub):** For now, clicking "Create Experiment" should simply `console.log` the experiment configuration.

### 5. Verification

-   Run the app.
-   Right-click a collection and choose "BWS Experiment."
-   The new modal should appear, allowing you to configure a BWS experiment.

### 6. `git diff HEAD`

There are uncommitted changes from the previous agent's bug fix. You should review and commit them before you begin your work to ensure the repository is in a clean state.
