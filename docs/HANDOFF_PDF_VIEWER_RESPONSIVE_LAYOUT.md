# Handoff: Implement Flexible & Responsive PDF Viewer

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** The core features of the PDF Viewer are in place, but the user experience is too rigid. This phase will focus on transforming the viewer into a flexible and responsive workspace. We will fix all remaining state management bugs and give the user full control over the layout.

**The Mission:** Your task is to fix the outstanding bugs and implement a new, resizable panel system for the PDF Viewer.

---

## Part II: Handoff to Next Agent (A Multi-Step Task)

This is a large task. Please complete the following steps in order.

### Task 1 (Bug Fix): Fix the "Sticky Highlight"

-   **The Bug:** When clicking a new excerpt in the list, the previously selected excerpt remains highlighted green.
-   **Action:** In `pdf-excerpt-viewer.js`, modify the `onExcerptClick` method. Before you add the `active` class to the new item, you must first find all other elements with the `active` class and remove it. Ensure only one item in the list can be active at a time.

### Task 2 (Bug Fix): Implement Hover Tooltips

-   **The Bug:** The hover tooltip feature for showing rating data is still not implemented.
-   **Action:** Implement the `mousemove` logic in `pdf-highlighter.js` as described in previous handoffs. When the mouse moves over a highlighted excerpt that has rating data, display a floating, professionally-styled tooltip `div` that shows the rating score and reasoning.

### Task 3 (Feature): Implement Resizable Panels

-   **The Goal:** Allow the user to drag the borders between the PDF panel, the Excerpt List, and the bottom Detail Panel to resize them.
-   **Action:**
    1.  This will require a JavaScript-based solution. Add "resizer" or "handle" `div` elements between the panels in the HTML.
    2.  Add `mousedown`, `mousemove`, and `mouseup` event listeners to these handles to control the resizing of the panels (e.g., by dynamically updating their `flex-basis` or `width`/`height`).
    3.  The user's chosen layout dimensions should be saved to `localStorage` so they persist between sessions.

### Task 4 (QoL): Implement Adjustable Text Size

-   **The Goal:** Allow the user to control the font size within the Excerpt Detail Panel.
-   **Action:** Add `+` and `-` buttons to the Detail Panel that, when clicked, increase or decrease the `font-size` of the text within that panel.

### Verification

-   The "sticky highlight" bug must be gone.
-   Hovering over highlights must show the data tooltip.
-   The user must be able to drag the borders between all three panels to resize them.
-   The text size in the detail panel must be adjustable.
-   Run `npm run test:ui -- --update-snapshots` to save the new state of the UI.

---

## The Big Picture

Completing these tasks will elevate the PDF Viewer to a truly professional and user-friendly tool, completing the final major piece of our UX Overhaul.
