# Handoff: Design BWS "Four PDF Windows" Layout

**Date:** October 8, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** EPIC 1 and EPIC 2 of the BWS Workflow are now complete. We can define BWS variables and generate comparison sets. The next major step is to build the core interactive workspace.

**The Mission:** Your task is to design and implement the core UI layout for the BWS interactive workspace, which displays four PDF excerpts side-by-side.

---

## Part II: Handoff to Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   EPIC 1 (BWS Variable Management) is complete.
-   EPIC 2 (BWS Experiment Creation & Setup) is complete.

### 2. Current Application State

-   **Does it Run?:** Yes.
-   **Known Bugs:** None.
-   **New Feature:** BWS variables can be created, and BWS experiments can be configured and generate tuples.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To design and implement the core UI layout for the BWS interactive workspace, which displays four PDF excerpts side-by-side.
-   **My Thought Process:** This will involve creating a new view or modifying an existing one to accommodate four distinct PDF rendering areas. Each area will need to be able to display a PDF excerpt.
-   **Relevant Files:** This will likely involve creating new HTML, CSS, and JavaScript files for the BWS workspace (e.g., `src/components/bws-workspace.js`, `src/styles/bws-workspace.css`, and integrating it into `index-advanced.html` or a new route).

### 4. Next Immediate, Actionable Task

Your task is to design and implement the "Four PDF Windows" Layout (Ticket #505):

1.  **Create New View:** Create a new HTML/CSS/JS structure for the BWS workspace.
2.  **Four Quadrant Layout:** Implement a layout that clearly divides the main content area into four equal quadrants.
3.  **Placeholder PDF Renderers:** Within each quadrant, place a placeholder for a PDF renderer (e.g., a `div` with a unique ID that can later be used to mount a PDF).
4.  **Basic Styling:** Apply basic styling to make the quadrants visually distinct and ensure they fill the available space.

### 5. Verification

-   Run the app.
-   Navigate to the new BWS workspace (you might need to temporarily add a button or route to access it).
-   Verify that four distinct, equally sized quadrants are displayed, ready to host PDF excerpts.

### 6. `git diff HEAD`

There are no uncommitted changes. The working tree is clean. You should start your work on a new branch.
