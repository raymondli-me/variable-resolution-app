# Blueprint for Phase 3: The Interactive BWS Workflow

**Date:** October 8, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔵 **PROPOSED BLUEPRINT FOR NEXT SESSION**

---

## Part I: The Vision - A Visual BWS Workspace

With the core rating system now stable and functional, we are ready to implement the next major analysis feature: a full-featured, interactive Best-Worst Scaling (BWS) experiment workflow, specifically for PDFs.

**The Goal:** To create a dedicated BWS interface that allows for intuitive, visual comparison of PDF excerpts, with real-time human and AI feedback. This will be a powerful tool for fine-grained qualitative analysis.

---

## Part II: The Roadmap - A Series of Epics

### EPIC 1: BWS Variable Management

-   **Ticket #501:** Enhance "Manage Variables" Modal. Add a new "Variable Type: BWS" option. When selected, the form should change to accept "Anchor for Best" and "Anchor for Worst" instead of a numerical scale.
-   **Ticket #502:** Update Backend for BWS Variables. The `global_rating_variables` table and its CRUD operations need to support this new variable type, storing the "Best" and "Worst" anchors.

### EPIC 2: BWS Experiment Creation & Setup

-   **Ticket #503:** Create "Create BWS Experiment" Modal. This modal will be launched from the collection context menu. It will allow the user to select a BWS variable, choose a collection, and configure the experiment (e.g., tuple size, number of comparisons).
-   **Ticket #504:** Implement BWS Tuple Generation. The backend needs to generate comparison sets (tuples) of PDF excerpts based on the selected collection and BWS variable.

### EPIC 3: The Interactive BWS Workspace UI

-   **Ticket #505:** Design the "Four PDF Windows" Layout. This will be the core UI. It will display 4 PDF excerpts side-by-side, each in its own quadrant.
-   **Ticket #506:** Implement Excerpt Display & Controls. Each PDF window will show the excerpt with highlighting and have its own zoom controls.
-   **Ticket #507:** Implement Comparison Set Browser. A list on the right to navigate between comparison sets (tuples), indexed with numbers, with visual indicators for rated/unrated/AI-rated sets.
-   **Ticket #508:** Implement Human Input (Click-to-Rate). Allow the user to click a PDF window to mark it as "Best" (dashed green outline) or "Worst" (dashed red outline).
-   **Ticket #509:** Implement AI Co-Pilot for BWS. AI will also rate, with its rating displayed as a "solid green or red" highlight, slightly offset from the human rating.
-   **Ticket #510:** Implement Automation & Control. Add "Auto Rate," "Rate All," "Pause," "Resume" buttons, and progress counters for the BWS experiment.

---

## Part III: The First Step

We will begin by enabling the creation of BWS-specific variables.

-   **Handoff for the Next Implementation Agent:**
    -   **Goal:** Enhance the "Manage Variables" modal to support BWS variable types.
    -   **Task:**
        1.  In `src/components/collections-hub.js` (or wherever the 'Manage Variables' modal logic resides), modify the modal's UI.
        2.  Add a new input field: "Variable Type" (e.g., a radio button or dropdown with options 'Rating' and 'BWS').
        3.  If 'BWS' is selected, the "Scale" input should disappear, and two new text inputs should appear: "Anchor for Best" and "Anchor for Worst."
        4.  Ensure the data from these new fields is correctly passed to the `createGlobalRatingVariable` IPC handler.
    -   **Verification:** Open the "Manage Variables" modal. You should be able to select "BWS" as a variable type and enter "Anchor for Best" and "Anchor for Worst" values.
