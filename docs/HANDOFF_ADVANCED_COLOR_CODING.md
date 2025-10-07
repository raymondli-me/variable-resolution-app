# Handoff: Implement Advanced Status-Based Design

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision has Evolved.** Based on new feedback, we are upgrading our design system. Instead of just color-coding by a collection's *Type* (base, merged), we will now implement a more sophisticated system that uses multiple visual cues to communicate a collection's full status at a glance.

**The Mission:** Your task is to refactor the Collections Hub UI to implement this new, advanced **Status-Based Design System**. This will involve creating a primary theme color based on **Genre** (YouTube vs. PDF) and using other indicators for Type and Enrichments.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent unified the video collection viewer, so all video collections now use the superior `galleryViewer`.
-   A basic version of type-based color-coding was implemented.

### 2. The New Design System

Your implementation must follow this new, more detailed specification:

-   **Genre (Primary Theme Color):**
    -   YouTube Collections will have a **Blue** accent theme.
    -   PDF Collections will have a **Green** accent theme.
-   **Type (Subtle Border Color):**
    -   **Base** collections (original data) will have a neutral **Gray** left border.
    -   **Merged** collections will have a **Purple** left border.
    -   **Derived** collections (from Filter/Subsample) will have a **Teal** left border.
-   **Enrichments (Tags):**
    -   The card will display small tags for `Rated` or `BWS` if those analyses exist.

### 3. Next Immediate, Actionable Task

Your task is to implement this new, multi-faceted design system:

1.  **Refactor CSS:** In `src/styles/collections-hub.css`, remove the old color-coding logic. Create new CSS classes and variables to support the new system:
    -   Create `.genre-youtube` and `.genre-pdf` classes that set a CSS variable (e.g., `--card-accent-color`). Use this variable to theme elements like the `[View]` button.
    -   Create `.type-base`, `.type-merged`, and `.type-derived` classes that set the `border-left-color` to the appropriate color (Gray, Purple, Teal).

2.  **Refactor JavaScript:** In `src/components/collections-hub.js`, modify the `renderCard()` method. It must now determine **both** the Genre and the Type of a collection and add the two corresponding classes (e.g., `class="collection-card genre-pdf type-derived"`) to the card's HTML.

3.  **Verification:**
    -   Run the application.
    -   Verify that YouTube collections have blue accents and PDF collections have green accents.
    -   Verify that base, merged, and derived collections have the correct gray, purple, or teal left borders.
    -   Update the visual snapshots by running `npm run test:ui -- --update-snapshots`. The new screenshots showing this sophisticated color-coding will be your proof of completion.

### 4. The Big Picture

This task will result in a highly intuitive, information-rich UI that tells the user the complete story of each collection at a single glance. It is a critical step in delivering a polished, professional user experience.
