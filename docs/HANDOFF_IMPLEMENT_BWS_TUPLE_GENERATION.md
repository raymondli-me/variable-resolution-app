# Handoff: Implement BWS Tuple Generation

**Date:** October 8, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** The 'Create BWS Experiment' modal is now implemented. The next step is to integrate this modal with the backend to generate the comparison sets (tuples) for the BWS experiment.

**The Mission:** Your task is to implement the backend logic for generating BWS tuples and integrate it with the frontend modal, storing the generated experiment data in the database.

---

## Part II: Handoff to Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent successfully implemented Ticket #503: Create "Create BWS Experiment" Modal. The UI for configuring a BWS experiment is now in place.

### 2. Current Application State

-   **Does it Run?:** Yes.
-   **Known Bugs:** None.
-   **New Feature:** The "Create BWS Experiment" modal is implemented.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To implement the backend logic for generating BWS tuples and integrate it with the frontend modal.
-   **My Thought Process:** The modal collects the necessary parameters (BWS variable, collection, tuple size, number of comparisons). The backend needs a new IPC handler to receive these parameters, fetch excerpts from the collection, and generate the comparison sets. These comparison sets should then be stored in the database.
-   **Relevant Files:** `src/components/collections-hub.js` (for the modal's "Create Experiment" button handler), `src/ipc/bws-handlers.js` (new file for BWS IPC), `src/database/db.js` (for new database methods and table for BWS experiments/tuples).

### 4. Next Immediate, Actionable Task

Your task is to implement BWS Tuple Generation (Ticket #504):

1.  **Backend IPC Handler:** Create a new IPC handler (e.g., `bws:createExperiment`) in `src/ipc/bws-handlers.js`. This handler will receive the experiment configuration from the frontend.
2.  **Database Schema:** Define a new database table (e.g., `bws_experiments`) to store the experiment configuration and the generated comparison sets (tuples). Each tuple will consist of 4 excerpt IDs.
3.  **Tuple Generation Logic:** Implement the logic within the IPC handler to:
    -   Fetch all relevant PDF excerpts from the selected collection.
    -   Randomly select excerpts to form comparison sets of 4 (tuple size is fixed at 4).
    -   Store these generated comparison sets in the `bws_experiments` table.
4.  **Frontend Integration:** Update the "Create Experiment" button handler in `src/components/collections-hub.js` to call this new IPC handler and pass the collected configuration.

### 5. Verification

-   Run the app.
-   Open the "Create BWS Experiment" modal, configure an experiment, and click "Create Experiment."
-   Check the console logs for confirmation that the IPC handler was called and that comparison sets were generated and stored in the database.

### 6. `git diff HEAD`

There are uncommitted changes from the previous agent's bug fix. You should review and commit them before you begin your work to ensure the repository is in a clean state.
