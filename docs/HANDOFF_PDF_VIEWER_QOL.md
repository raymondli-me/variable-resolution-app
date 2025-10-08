# Handoff: PDF Viewer Quality-of-Life Overhaul

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** With the Collections Hub now polished and functional, we are shifting our focus to delivering a world-class user experience *within* our genre-specific viewers. This phase is dedicated to transforming the PDF Viewer from a simple document renderer into a powerful, interactive tool for analysis.

**The Mission:** Your task is to implement a suite of high-impact, quality-of-life (QoL) features for the PDF Viewer, including infinite scroll, bi-directional linking, and data-rich hover effects.

---

## Part II: Handoff to Next Agent (A Multi-Step Task)

This is a large initiative. Please complete the following tasks in order.

### Task 1: Implement Bi-Directional Linking

-   **Goal:** Allow users to click a highlight on the PDF to select the corresponding excerpt in the list.
-   **Action:**
    1.  In `src/components/pdf-highlighter.js`, implement a `click` event listener on the highlight canvas.
    2.  On click, use the event coordinates to identify which excerpt's bounding box was clicked (a `findExcerptAtPoint` method may already exist).
    3.  When an excerpt is identified, dispatch a custom browser event (e.g., `new CustomEvent('highlight:clicked', { detail: { excerptId } })`).
    4.  In `src/components/pdf-excerpt-viewer.js`, listen for this event. On receiving it, find the corresponding excerpt element in the right-hand list and scroll it into view, marking it as active.
-   **Verification:** Clicking a highlighted sentence on the PDF canvas must now cause the excerpt list on the right to scroll to and highlight the matching item.

### Task 2: Implement Hover Tooltips with Rating Data

-   **Goal:** Show analysis results when a user hovers over highlighted text.
-   **Action:**
    1.  First, ensure the `pdf-excerpt-viewer.js` is loading the rating data for the collection and merging it with the excerpt objects.
    2.  In `src/components/pdf-highlighter.js`, implement a `mousemove` event listener on the highlight canvas.
    3.  On mouse move, determine if the cursor is over a highlighted excerpt.
    4.  If it is, and that excerpt has rating data, display a floating tooltip `div` next to the cursor. The tooltip must be professionally styled and display the rating `score`, `confidence`, and `reasoning`.
-   **Verification:** In a collection that has been rated, hovering over a highlight on the PDF must show a tooltip with the rating data.

### Task 3: Implement Infinite Scroll

-   **Goal:** Improve performance and usability for large documents by implementing infinite scroll for both the PDF canvas and the excerpt list.
-   **Action (PDF View):** Refactor `pdf-renderer.js`. Instead of a single large canvas, implement a "virtualization" system that only renders the PDF pages currently visible in the viewport (plus a small buffer). Pages should be rendered on demand as the user scrolls.
-   **Action (Excerpt List):** Refactor `pdf-excerpt-viewer.js`. The excerpt list should no longer render all items at once. Implement a virtual scrolling mechanism that only renders the excerpt items currently visible in the viewport, rendering more as the user scrolls.
-   **Verification:** Open a collection with thousands of excerpts. The application must load instantly, and scrolling through both the PDF and the excerpt list must be smooth and performant, with no UI lag.

---

## The Big Picture

These are challenging but high-impact tasks. Completing them will make our PDF viewer a best-in-class analysis tool and a major differentiator for our application.
