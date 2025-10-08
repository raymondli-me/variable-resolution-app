# Blueprint for Phase 2.2: Qualitative Coding Workflow (v2)

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔵 **PROPOSED BLUEPRINT FOR NEXT SESSION**

---

## Part I: The Vision - Global, Genre-Specific Variables

The previous agent session implemented a "Manage Variables" button per collection card. However, based on new feedback from the Project Lead, we are refining this approach. Variables will be managed globally and applied to collections based on their genre.

**The Goal:** To create a centralized system for defining and managing qualitative coding variables. These variables will be defined once, and then applied to collections based on their genre (e.g., a "Stigma" variable for YouTube collections, a "Methodology" variable for PDF collections).

**The UI:** A single, global "Manage Variables" button will be located in the top right of the Collections Hub.

---

## Part II: The Roadmap

### EPIC 1: Global Variable Management

-   **Ticket #401 (Critical Refactor):** Remove the per-card "Manage Variables" button. Add a single, global "Manage Variables" button to the top right of the Collections Hub.
-   **Ticket #402 (Feature):** Create a "Manage Variables" modal. This modal will allow users to:
    -   Create new variables (Name, Description, Scale, Genre).
    -   Edit existing variables.
    -   Delete variables.
-   **Ticket #403 (Backend):** Update the database schema to store these global, genre-specific variables.

### EPIC 2: Enhanced PDF Viewer Layout

-   **Ticket #404 (Feature):** Implement Vertical Resizers. Allow the user to drag the border between the PDF viewer and the bottom Detail Panel to adjust its height.
-   **Ticket #405 (Feature):** Implement Adjustable Text Size. Add controls to the PDF viewer to allow the user to increase/decrease the font size of the excerpt text.
-   **Ticket #406 (UI Polish):** Ensure the entire PDF viewer UI (left panel, right panel, bottom panel) is responsive and adjusts gracefully to different window sizes.

---

## Part III: The First Handoff

Our first priority is to fix the UI fragmentation and align the codebase with the new, unified model.

-   **Handoff for the Next Implementation Agent:**
    -   **Goal:** Begin "Global Variable Management" by removing the per-card button and adding a global one.
    -   **Task:**
        1.  **Remove Per-Card Button:** In `src/components/collections-hub.js`, remove the "Manage Variables" button from the collection card rendering logic.
        2.  **Add Global Button:** In `index-advanced.html`, add a new button to the header of the Collections Hub (e.g., next to "New Collection") labeled "Manage Variables."
        3.  **Stub Functionality:** For now, clicking this global button should simply `console.log("Manage Variables clicked")`.
    -   **Verification:** Run the app. The "Manage Variables" button must be gone from individual collection cards and a single button must appear in the header. The UI should be clean.
