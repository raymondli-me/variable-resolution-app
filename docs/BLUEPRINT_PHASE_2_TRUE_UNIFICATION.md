# Blueprint for Phase 2.1: True Unification & Status-Based Design

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔵 **PROPOSED BLUEPRINT - SUPERSEDES PREVIOUS**

---

## Part I: The Vision - A Truly Unified Hub

Based on new feedback from the Project Lead, we are refining our vision for the Collections Hub. The previous implementation, which created a special card type for "Merged Collections," was a misstep. 

**The New Mandate:** A collection is a collection. There will only be **one, universal collection card** component. A collection's type or history (e.g., Merged, Rated, PDF-based) will be communicated via a new **Color-Coding and Tagging System**, not by a different UI structure.

---

## Part II: The Color-Coding & Tagging System

We will implement a system of subtle visual cues on the universal card:

-   **Genre (Icon):** This is already implemented and is correct. (📹 for YouTube, 📄 for PDF).
-   **Type (Subtle Border Color):** We will use the card's left border to indicate its fundamental type.
    -   `border-left-color: #5586E0;` (Blue) -> **Base Collection** (from an original data source).
    -   `border-left-color: #8B5CF6;` (Purple) -> **Merged Collection**.
    -   `border-left-color: #10B981;` (Green) -> **Derived Collection** (the result of a Filter or Subsample).
-   **Enrichments (Tags/Badges):** The "Enrichments" section will display small, clear tags for any analyses performed.
    -   `Rated` tag will appear if the collection has rating layers.
    -   `BWS` tag will appear if it has BWS experiments.

---

## Part III: The Roadmap

### EPIC 1: Deprecate Old & Redundant UI

-   **Ticket #301:** Remove the "Saved Collections" and "Merged Collections" tabs that appear below the card grid.
-   **Ticket #302:** Remove the separate "Create Merge" button from the header of the old Merged Collections view.

### EPIC 2: Unify the Card Component & Actions

-   **Ticket #303:** Refactor `collections-hub.js` to use a single `renderCard()` method for all collection types. Remove the special purple-themed card for merges.
-   **Ticket #304:** Implement the Color-Coding system via CSS classes based on collection properties.
-   **Ticket #305:** Unify the context menu. Ensure the *exact same* context menu options (`Rate`, `BWS`, `Filter`, etc.) are available for *all* collection cards, regardless of type.

### EPIC 3: Unify the Creation Workflow

-   **Ticket #306:** Add a "Merge Collections" action to the main application flow, likely by allowing multi-select in the Hub and providing a "Merge" option in the context menu.

---

## Part IV: The First Handoff

Our first priority is to fix the UI fragmentation and align the codebase with the new, unified vision.

-   **Handoff for the Next Implementation Agent:**
    -   **Goal:** Begin "True Unification" by removing redundant UI and unifying the card component.
    -   **Task:**
        1.  **Remove Redundant UI:** In `index-advanced.html` and its related scripts, find and **delete** the "Saved Collections" and "Merged Collections" tabs that appear below the main card grid. Also delete the standalone "Create Merge" button.
        2.  **Unify Card Rendering:** In `src/components/collections-hub.js`, refactor the code to use a **single `renderCard()` method** for both regular and merged collections. Remove the special purple styling and "MERGED" badge for now.
        3.  **The Goal:** At the end of this task, all collections, including merged ones, should appear in the same grid and look **identical**. The old tabs and buttons must be gone.
    -   **Verification:** Run the app. The UI should be clean, showing only the main card grid. Merged collections should be indistinguishable from regular collections.
