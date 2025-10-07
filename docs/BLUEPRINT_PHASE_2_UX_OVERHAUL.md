# Blueprint for Phase 2: UX Overhaul & Genre-Specific Workflows

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔵 **PROPOSED BLUEPRINT FOR NEXT SESSION**

---

## Part I: The Vision

With our application now architecturally sound, this phase will focus on delivering a world-class **user experience (UX)**. We will address all major UX feedback from our initial prototype, build out our genre-specific viewers, and fully integrate our analysis pipeline from data ingestion to visualization.

---

## Part II: The Roadmap - A Series of Epics

This phase is broken down into three major initiatives or "Epics."

### EPIC 1: The Polished Hub

**Goal:** To fix all remaining bugs and transform the Collections Hub into a visually stunning and fully functional central workspace.

-   **Ticket #101 (Bug):** Fix the `bws-manager.js` startup error. This "Ghost UI" bug must be resolved by finding the legacy code trying to access deleted UI elements and wrapping it in defensive null checks.
-   **Ticket #102 (UI):** Fix the theme mismatch. The Hub's color palette, spacing, and typography must be overhauled to create a single, cohesive, and professional aesthetic.
-   **Ticket #103 (Feature):** Implement the functional "Enrichment Layers." The placeholder `Enrichments: 0` text will be replaced with a real, expandable list of the Rating and BWS projects associated with each collection.

### EPIC 2: The YouTube Experience Overhaul

**Goal:** To transform the YouTube collection viewer from a basic list into an intuitive, powerful tool for browsing video data.

-   **Ticket #201 (Feature):** Build a "Video Gallery." The current list of thumbnails will be replaced with a proper gallery (either a list or grid view) that clearly displays video titles, thumbnails, and key statistics.
-   **Ticket #202 (Feature):** Re-implement Hover Previews. Users should be able to get a quick preview of a video by hovering over it in the gallery.
-   **Ticket #203 (Bug):** Isolate the Viewer. The "PDFs" tab must be removed from the YouTube viewer. A collection's viewer should only ever show content of its own genre.
-   **Ticket #204 (Feature):** Implement Comment Pagination. The comment list should support pagination or infinite scroll to handle videos with thousands of comments gracefully.

### EPIC 3: The Advanced PDF Workflow

**Goal:** To evolve the PDF viewer into a best-in-class tool for analyzing text-based documents.

-   **Ticket #301 (Feature):** Implement Multi-PDF Upload. The ingestion process must be refactored to allow users to select and process multiple PDF files into a single collection at once.
-   **Ticket #302 (Feature):** Create a "PDF Browser." For collections with multiple PDFs, a side panel must be added to allow the user to easily switch between the different documents.
-   **Ticket #303 (Feature):** Implement Bi-Directional Linking. The viewer must be enhanced so that **clicking a highlighted sentence on the PDF canvas** automatically scrolls to and highlights the corresponding excerpt in the right-hand list.
-   **Ticket #304 (Feature):** Implement Rating Tooltips. When a collection has been rated, hovering over a highlighted sentence on the PDF canvas should display a tooltip with the rating score and reasoning.
-   **Ticket #305 (QoL):** Implement Infinite Scroll for the PDF viewer itself, allowing for smooth, continuous scrolling through large documents.

---

## Part III: The First Step

We will begin with **EPIC 1: The Polished Hub**. The most critical first step is to fix the existing bugs and address the aesthetic issues you identified.

-   **Handoff for the Next Implementation Agent:**
    -   **Goal:** Address the immediate bugs and aesthetic issues in the Collections Hub.
    -   **Task:**
        1.  **Fix the `bws-manager.js` Bug:** Find the remaining code in `bws-manager.js` that is trying to access a deleted element and wrap it in a defensive null check to prevent the startup error.
        2.  **Fix the UI Theme:** Your primary task is to fix the jarring "light/dark" theme mix in the Collections Hub. Modify `src/styles/collections-hub.css` to ensure the cards and the background feel like part of a single, cohesive, and professional design.
    -   **Verification:** Use the `npm run test:discover` script. The `console-log.txt` file must be free of the `bws-manager.js` error. The new screenshots of the Hub must show a visually cohesive and polished UI.
