# Handoff: Implement BWS Human Input (Click-to-Rate)

**Date:** October 8, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** The BWS Workspace now displays PDF excerpts and lists experiments. The next crucial step is to enable users to interactively rate comparison sets by marking excerpts as 'Best' or 'Worst'.

**The Mission:** Your task is to implement the interactive rating mechanism where users click on a PDF quadrant to mark an excerpt as "Best" or "Worst."

---

## Part II: Handoff to Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent successfully implemented Ticket #507: Implement Comparison Set Browser (as the experiments list view). BWS experiments are now correctly loaded and displayed in the BWS Workspace.

### 2. Current Application State

-   **Does it Run?:** Yes.
-   **Known Bugs:** None.
-   **New Feature:** BWS experiments are listed and can be opened. The comparison view shows four PDF excerpts.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To implement the interactive rating mechanism where users click on a PDF quadrant to mark an excerpt as "Best" or "Worst."
-   **My Thought Process:** Each of the four PDF quadrants needs to be clickable. The first click should mark an excerpt as "Best," and the second click (on a different excerpt) should mark it as "Worst." Visual feedback (dashed outlines) is required. This rating needs to be saved to the database.
-   **Relevant Files:** `src/components/bws-workspace.js` (for click handlers, state management, and database calls), `src/styles/bws-workspace.css` (for visual feedback).

### 4. Next Immediate, Actionable Task

Your task is to implement Human Input (Click-to-Rate) (Ticket #508):

1.  **Click Handlers:** Add click event listeners to each of the four PDF excerpt quadrants in the BWS Comparison View.
2.  **Rating Logic:**
    -   The first click on an excerpt in a comparison set should mark it as "Best."
    -   The second click on a *different* excerpt in the same comparison set should mark it as "Worst."
    -   If an excerpt is already marked "Best" or "Worst," clicking it again should clear its selection.
    -   Ensure only one "Best" and one "Worst" can be selected per comparison set.
3.  **Visual Feedback:**
    -   When an excerpt is marked "Best," apply a dashed green outline to its quadrant.
    -   When an excerpt is marked "Worst," apply a dashed red outline to its quadrant.
    -   Clear outlines when selections are cleared.
4.  **Database Persistence:** When a "Best" and "Worst" pair is selected for a comparison set, save this rating to the database. You will need a new database table (e.g., `bws_human_ratings`) to store these.
5.  **IPC Handler:** Create a new IPC handler (e.g., `bws:saveHumanRating`) to handle saving the rating to the database.

### 5. Verification

-   Run the app.
-   Open a BWS experiment and navigate to a comparison set.
-   Click on two different PDF excerpts. Verify that one gets a dashed green outline ("Best") and the other gets a dashed red outline ("Worst").
-   Verify that the rating is saved to the database.

### 6. `git diff HEAD`

There are no uncommitted changes. The working tree is clean. You should start your work on a new branch.
