# Handoff: Implement the Excerpt Detail & Analysis Panel

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** The PDF Viewer's core interactivity is now stable. The next major step is to build the UI for deep analysis of a single piece of content. We will build a new **"Excerpt Detail Panel"** that will serve as the foundation for displaying metadata, ratings, and capturing user notes for qualitative coding.

**Deferred Tasks:** The implementation of "Infinite Scroll" (Task 3 from the previous handoff) is still deferred. We are prioritizing this new feature first.

---

## Part II: Handoff to Next Agent (A Multi-Step Task)

This is a large task. Please complete the following steps in order.

### Task 1: Build the Detail Panel UI

-   **Goal:** Create the new, third panel for displaying details of a selected excerpt.
-   **Action:**
    1.  In `pdf-excerpt-viewer.js` and its associated CSS, create a new panel, hidden by default. This "Detail Panel" could appear at the bottom of the screen or as a third column.
    2.  The panel must contain three distinct sections:
        -   A section to display the **full text** of the selected excerpt.
        -   A section to display **metadata and analysis results** (e.g., "Score: 0.85", "Category: Best"). This can be placeholder data for now.
        -   A `<textarea>` for the user to enter **qualitative notes**, with a `[Save Note]` button.

### Task 2: Implement Show/Hide Logic

-   **Goal:** The new panel should appear only when an excerpt is selected.
-   **Action:**
    1.  Modify the `onExcerptClick` logic in `pdf-excerpt-viewer.js`. When an excerpt is selected, the new Detail Panel should become visible and be populated with the full text of that excerpt.
    2.  Listen for the `highlight:cleared` event. When this event is received, the Detail Panel should be hidden.

### Task 3 (Fix Deferred Bug): Implement Hover Tooltips

-   **Goal:** The hover tooltip feature from the previous handoff is still not implemented. You will implement it now as it is related to displaying analysis data.
-   **Action:**
    1.  In `src/components/pdf-highlighter.js`, implement a `mousemove` event listener on the highlight canvas.
    2.  When the mouse moves over a highlighted excerpt that has rating data, display a floating tooltip `div` next to the cursor. The tooltip must be professionally styled and display the rating `score`, `confidence`, and `reasoning`.

### Verification

-   Run the application and open a PDF collection.
-   **Verify Task 1 & 2:** Clicking an excerpt (either in the list or on the PDF) must show the new Detail Panel, populated with the excerpt's text. Clicking away must hide the panel.
-   **Verify Task 3:** Hovering over a highlight on the PDF must show a tooltip with its (currently placeholder) rating data.
-   Update the visual snapshots by running `npm run test:ui -- --update-snapshots`.

---

## The Big Picture

This new panel is the first step toward turning our viewer into a true qualitative analysis tool. It creates the dedicated space where all future rating, tagging, and annotation features will live.
