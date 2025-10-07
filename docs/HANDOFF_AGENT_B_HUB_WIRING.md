# Handoff: Implement 'View' Action for Collections Hub

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The UI is Polished.** The previous agent successfully completed the visual overhaul of the Collections Hub. We now have a beautiful, modern, card-style gallery.

**The Next Mission:** The Hub is beautiful, but its buttons are not yet functional. Your task is to bring the UI to life by implementing the logic for the most important action: the **[View]** button. This action must be "genre-aware," opening the correct viewer based on the collection's data type.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The Collections Hub UI has been polished with a professional design and micro-interactions.
-   The last commit was `4c1535d`.

### 2. Current Application State

-   **Does it Run?:** Yes. The application displays a polished but non-interactive card gallery.
-   **Known Bugs:** The `[View]` buttons on collection cards only log to the console; they do not open the collection.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To wire up the `[View]` button on each collection card to open the correct viewer.
-   **My Thought Process:** We have two primary viewers: the standard `collectionViewer` for YouTube collections and the advanced `pdfExcerptViewer` for PDF collections. The `handleViewClick` method in `collections-hub.js` needs to determine the collection's genre and call the appropriate global viewer instance.
-   **Relevant Files:** `src/components/collections-hub.js`, and for reference, `src/components/collection-viewer.js` and `src/components/pdf-excerpt-viewer.js`.

### 4. Next Immediate, Actionable Task

Your task is to implement the logic for the `[View]` button on the Collection Cards:

1.  **Locate the Method:** In `src/components/collections-hub.js`, find the `handleViewClick(collectionId)` method. It currently contains a `console.log`.
2.  **Fetch the Collection:** Inside this method, you will first need to get the full collection object from your `this.collections` array by finding the one that matches the passed `collectionId`.
3.  **Determine the Genre:** Using the collection object, inspect its `settings` property to determine if it is a `'youtube'` or `'pdf'` collection. You can reuse the logic from the `getGenreIcon` method for this.
4.  **Implement Routing Logic:**
    -   **If the genre is 'pdf'**: Call the global PDF viewer instance: `window.pdfExcerptViewer.show(collectionId)`.
    -   **If the genre is 'youtube'** (or default): Call the global collection viewer instance: `window.collectionViewer.show(collectionId)`.
5.  **Verification:**
    -   Run the application (`npm run dev`).
    -   Click the `[View]` button on a **PDF collection**. The advanced, side-by-side PDF viewer should open.
    -   Close the viewer, then click the `[View]` button on a **YouTube collection**. The standard video/comment collection viewer should open.
    -   Ensure the existing `npm run test:ui` tests still pass.

### 5. The Big Picture: The Overall Goal

Completing this task connects our new central Hub to our powerful, genre-specific viewers. It makes the core navigation of our "Collections-First" application functional for the first time and delivers a massive improvement to the user experience.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
