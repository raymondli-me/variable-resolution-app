# Handoff: PDF Gallery & Multi-PDF Upload

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** With the single-document PDF viewer now polished and feature-rich, we are expanding our focus to the **multi-document experience**. Our goal is to create a beautiful **PDF Gallery** for collections containing multiple PDFs, providing a user experience on par with our video galleries.

**The Prerequisite:** A gallery is useless without the data. Therefore, the critical first step of this phase is to implement the ability to upload multiple PDFs into a single collection.

---

## Part II: Handoff to Next Agent (A Multi-Step Task)

This is a large task. Please complete the following steps in order.

### Task 1: Implement Multi-PDF Upload

-   **Goal:** Allow a user to select and upload multiple PDF files at once when creating a new PDF collection.
-   **Action:**
    1.  Locate the `<input type="file">` element used for the PDF upload form.
    2.  Add the `multiple` attribute to this input tag to allow multi-select in the file dialog.
    3.  Refactor the corresponding JavaScript handler to process a `FileList` object instead of a single file. You must loop through the `FileList`.
    4.  For each file in the list, call the existing `window.api.pdf.upload(...)` IPC handler, adding it to the same collection.
    5.  The UI must provide clear feedback during this process (e.g., "Uploading 3 of 5 PDFs...").
-   **Verification:** You must be able to select multiple PDF files in the file dialog, and they must all be successfully processed and added to a single new collection.

### Task 2: Build the PDF Gallery Viewer

-   **Goal:** Create a new, aesthetic, gallery-style viewer for multi-PDF collections.
-   **Action:**
    1.  Create a new component file, `src/components/pdf-gallery-viewer.js`, and its corresponding CSS file.
    2.  This new component will be shown when a user clicks `[View]` on a PDF collection that contains **more than one** PDF. You will need to update the routing logic in `collections-hub.js` to handle this.
    3.  **Aesthetics are critical.** The design must be a high-quality, modern grid of cards, visually similar to the `galleryViewer` used for videos. Each card should represent one PDF and display its title, a thumbnail/icon, and key stats (e.g., page count).
    4.  When a user clicks on a PDF card within your new gallery, it must then open our existing, detailed `pdfExcerptViewer` for that specific document.
-   **Verification:** Create a collection with multiple PDFs. Clicking `[View]` on this collection in the Hub must open your new PDF Gallery. Clicking a specific PDF within the gallery must then open the side-by-side excerpt viewer.

---

## The Big Picture

Completing these tasks will create a complete, end-to-end workflow for managing and viewing multi-document PDF collections. It will bring our PDF experience to full parity with our YouTube features and deliver a polished, intuitive experience for the user.
