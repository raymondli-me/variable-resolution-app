# Blueprint for Phase 1: The Unified Collections Hub & Agentic Testing

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔵 **PROPOSED BLUEPRINT FOR NEXT SESSION**

---

## Part I: The Vision - A Truly "Collections-First" Application

With the successful completion of "The Great Refactoring," our backend is now modern, modular, and stable. The next major phase of development is to build a user interface that reflects this new architectural clarity and fully realizes our "Collections-First" philosophy.

This phase has a dual mandate:

1.  **Build the Unified UI:** Create a single, modern, "Collections Hub" that serves as the application's homepage and central workspace.
2.  **Build the Agentic Testing Framework:** In parallel, implement the automated API and Visual testing capabilities to ensure quality and remove the human testing bottleneck.

---

## Part II: The Unified Collections Hub - A Detailed Plan

-   **Deprecation:** The "YouTube" and "PDF" tabs will be removed from the main navigation. The "Collections" tab will become the default, primary view of the application.

-   **The "Card" Design:** The main view will be a grid of "Collection Cards." Each card will display key info (Name, Genre icon, item count) and have two primary interactions:
    1.  A main `[View]` button that opens the correct **genre-specific viewer** (the Video Gallery or the new PDF Viewer).
    2.  A `...` context menu containing all other actions: `Rate`, `BWS`, `Export`, `Duplicate`, `Filter`, `Delete`.

-   **The "Create" Workflow:** A single, prominent "New Collection" button on the Hub page will open a modal that first asks for the "Genre" (YouTube, PDF), and then shows the appropriate creation form.

---

## Part III: The Agentic Testing Framework - A Parallel Task

While the UI is being built, our new **QA & Testing Agent** will establish our automated testing foundation.

-   **Track 1: API Testing (Jest):** The Testing Agent will write a comprehensive suite of automated tests for our core service classes (`YouTubeCollector`, `AiRaterService`, etc.). These tests will validate all business logic programmatically, without touching the UI.

-   **Track 2: Visual Regression Testing (Playwright):** The Testing Agent will write scripts to launch the application and take baseline "visual snapshots" of all major UI components. These tests will be run automatically in the future to catch any unintended visual changes (layout, color, etc.), allowing an agent to effectively "see" the UI.

---

## Part IV: The Roadmap & First Steps

This phase will be executed by our relay team of Implementation Agents, with the new Testing Agent working in parallel.

-   **Handoff for Implementation Agent A (First Task):**
    -   **Goal:** Begin building the Collections Hub UI.
    -   **Action:** Your first task is to deprecate the "YouTube" and "PDF" tabs. Modify `index-advanced.html` to remove them from the navigation. Create a new, empty component file `src/components/collections-hub.js` and have it display a simple "Welcome to the Collections Hub" message in the main content area. This will be the canvas for our new UI.

-   **Handoff for QA & Testing Agent (First Task):**
    -   **Goal:** Set up the testing infrastructure.
    -   **Action:** Your first task is to install and configure **Jest** (for API testing) and **Playwright** (for UI testing). Create a `tests/` directory. Inside, create a simple `api/placeholder.test.js` for Jest and `ui/placeholder.spec.js` for Playwright. Ensure you can run both test suites from the command line.

---

## Conclusion

This plan represents the culmination of all our strategic work. It will deliver a beautiful, modern, and intuitive UI, built on a rock-solid, automatically-tested foundation. This phase will transform the application from a collection of features into a single, cohesive product.
