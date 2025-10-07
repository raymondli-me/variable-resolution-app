# Blueprint for Phase 2: The Unified Hub Refinement

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔵 **PROPOSED BLUEPRINT FOR NEXT SESSION**

---

## Part I: The Vision

**The Hardening Sprint is complete.** The application is now stable and free of critical errors. We can now, with confidence, resume our work on the user experience.

This phase will focus on transforming our functional but disjointed Collections Hub into a single, polished, and powerful component for browsing all collections, fully realizing our "Collections-First" vision.

---

## Part II: The Core Problem - The "Dual View" Bug

Our current UI is incorrectly rendering both the new **Card View** (`collections-hub.js`) and the old **List View** (`folder-browser.js`) at the same time. This is confusing, redundant, and must be fixed.

**The Vision:** We will merge these into a single, unified "Collections Hub" component that offers the user a **choice** between a "Card View" and a "List View" via a toggle button.

---

## Part III: The Roadmap - A Series of Refinement Tickets

### EPIC 1: Unify the Views

-   **Ticket #101 (Critical Bug Fix):** The first and most important task is to fix the "Dual View" bug. The `collections-hub.js` and `folder-browser.js` components must not be rendered at the same time. The agent will add a toggle button (e.g., with "Grid" and "List" icons) to the Collections Hub that switches the visibility between these two components.

### EPIC 2: Polish the Views

-   **Ticket #201 (UI Polish):** Overhaul the aesthetics of the **Card View**. The current dark-on-dark theme is not visually appealing. The task is to implement a new, professional design using lighter cards on a dark background, better shadows, typography, and spacing to create a "premium" feel.

-   **Ticket #202 (UI Polish):** Overhaul the aesthetics of the **List View**. The current folder browser is very basic. The task is to redesign it to feel like a modern file browser list, with proper alignment, icons, spacing, and hover states, matching the new aesthetic from the Card View.

---

## Part IV: The First Step

We will begin with **EPIC 1, Ticket #101**. Fixing the critical "Dual View" bug is our top priority.

-   **Handoff for the Next Implementation Agent:**
    -   **Goal:** Fix the "Dual View" bug by making the Card View and List View mutually exclusive and controllable by a new toggle button.
    -   **Task:**
        1.  In `index-advanced.html`, ensure that the `folder-browser.js` component (the List View) is initially hidden by default.
        2.  In `src/components/collections-hub.js`, add a new UI element: a **View Toggle** button (e.g., with "Grid" and "List" icons) in the Hub's header.
        3.  Implement the logic for this toggle. When the user clicks "List," the Card View (`#collection-grid`) should be hidden, and the old List View (`#folder-tree`) should be shown. When the user clicks "Grid," the reverse should happen.
    -   **Verification:** Run the app. By default, only the Card View should be visible. Clicking the new toggle buttons should correctly switch between showing the Card View and showing the List View.
