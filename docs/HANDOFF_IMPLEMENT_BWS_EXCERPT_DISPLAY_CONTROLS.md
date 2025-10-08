# Handoff: Implement BWS Excerpt Display & Controls

**Date:** October 8, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** The BWS Workspace now has a dual-view system, including the 'Four PDF Windows' layout. The next step is to populate these windows with actual PDF excerpts and provide basic controls for each.

**The Mission:** Your task is to display actual PDF excerpts within the four quadrants of the BWS Comparison View and provide basic controls for each.

---

## Part II: Handoff to Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent successfully implemented Ticket #505: Design the "Four PDF Windows" Layout. They also implemented a dual-view system for the BWS Workspace, including an "Experiments List View" and the "Comparison View" (four-quadrant layout).
-   A critical bug where views were not visible was also fixed.

### 2. Current Application State

-   **Does it Run?:** Yes.
-   **Known Bugs:** None.
-   **New Feature:** The BWS Workspace has a dual-view system with an experiments list and a four-quadrant comparison view.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To display actual PDF excerpts within the four quadrants of the BWS Comparison View and provide basic controls for each.
-   **My Thought Process:** When an experiment is opened, we need to fetch the first comparison set (tuple) from the database. For each excerpt in the tuple, we need to render its PDF content in one of the four quadrants. Each quadrant should also have basic controls like zoom.
-   **Relevant Files:** `src/components/bws-workspace.js` (for rendering logic), `src/renderer-advanced.js` (for PDF rendering utilities), `src/styles/bws-workspace.css` (for styling the quadrants and controls).

### 4. Next Immediate, Actionable Task

Your task is to implement Excerpt Display & Controls (Ticket #506):

1.  **Fetch Comparison Set:** When `openExperiment(experimentId)` is called, fetch the first comparison set (tuple) for that experiment from the database.
2.  **Render PDF Excerpts:** For each of the four excerpts in the comparison set:
    -   Use the existing PDF rendering utilities (e.g., `window.api.pdf.renderPage`) to display the excerpt's content within one of the four quadrants.
    -   Ensure the correct page and bounding box are used for each excerpt.
3.  **Basic Controls:** For each PDF quadrant, implement basic controls such as:
    -   **Zoom In/Out:** Buttons to adjust the zoom level of that specific PDF excerpt.
    -   **Excerpt Text Display:** A small area to show the excerpt's text content.
4.  **Styling:** Apply appropriate CSS to ensure the PDF excerpts and their controls are well-contained and visually appealing within each quadrant.

### 5. Verification

-   Run the app.
-   Open a BWS experiment.
-   Verify that four distinct PDF excerpts are displayed in the quadrants, and their respective zoom controls are functional.

### 6. `git diff HEAD`

There are no uncommitted changes. The working tree is clean. You should start your work on a new branch.
