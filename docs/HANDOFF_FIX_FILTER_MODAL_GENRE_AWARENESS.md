# Handoff: Fix Filter Modal Genre-Awareness

**Date:** October 8, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Directive:** The Project Lead has directed us to focus exclusively on the "Filter" functionality. The current "Filter Collection" modal is showing video-specific fields even when filtering a PDF collection, which is confusing and incorrect.

**The Mission:** Your task is to make the "Filter Collection" modal dynamically adjust its fields based on the genre of the selected collection.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent implemented the "Rate All" feature and made several PDF viewer layout adjustments.

### 2. Current Application State

-   **Does it Run?:** Yes.
-   **Known Bugs:** The "Filter Collection" modal is not genre-aware. It shows video-specific fields even for PDF collections.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To modify the `showFilterForm` method in `src/components/collections-hub.js` so the modal dynamically adjusts its fields based on the genre of the selected collection.
-   **My Thought Process:** The modal's HTML needs to be conditional. When a PDF collection is selected, it should show PDF-specific filter options (e.g., page range, excerpt length, keyword search within excerpts). When a video collection is selected, it should show video-specific options.
-   **Relevant Files:** `src/components/collections-hub.js` (for the modal's UI logic) and potentially `index-advanced.html` (if the modal HTML is directly embedded there).

### 4. Next Immediate, Actionable Task

Your task is to fix the "Filter Collection" modal genre-awareness:

1.  **Locate the Method:** Find the `showFilterForm` method in `src/components/collections-hub.js`.
2.  **Implement Genre-Awareness:** Modify this method so the modal dynamically adjusts its filter fields based on the genre of the selected collection.
    -   For **PDF collections**, it should show PDF-specific filter options (e.g., page range, excerpt length, keyword search within excerpts).
    -   For **Video collections**, it should show video-specific filter options (Min Views, Min Comments, Title Keyword).
    -   You will need to add the necessary HTML for the PDF-specific filter options to the modal.
3.  **Backend Integration:** The `collections:filter` IPC handler in the backend already supports filtering by PDF-specific criteria (e.g., `page_number`, `text_content`). You will need to ensure the frontend correctly passes these parameters.

### 5. Verification

-   Run the application.
-   Right-click a **PDF collection** and choose "Filter." The modal must show PDF-specific filter options.
-   Right-click a **Video collection** and choose "Filter." The modal must show video-specific filter options.
-   Run `npm run test:e2e` to ensure no regressions.

### 6. `git diff HEAD`

There are uncommitted changes from the previous agent's bug fix. You should review and commit them before you begin your work to ensure the repository is in a clean state.
