# Blueprint: Refactoring & Agentic Testing

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔵 **FINAL BLUEPRINT FOR NEXT SESSION**

---

## Part I: The New Mandate

This document outlines our project's new, dual mandate, which will guide our development for the next session:

1.  **Refactor to a Headless Architecture:** We will refactor our application to have a clear, programmatic, "headless" core API that contains all business logic. Our Electron UI will become a "head" that consumes this API. This is the essence of our **"Collections-First"** vision.

2.  **Implement Agentic Testing:** We will build a robust, automated testing framework managed by a new, dedicated **QA & Testing Agent**. This will eliminate our manual testing bottleneck and dramatically increase quality.

These two goals are deeply intertwined. The headless core API is what will allow our new Testing Agent to perform powerful, automated end-to-end functional tests.

---

## Part II: The New Team & Workflow

Our team structure and workflow have been updated in `docs/TEAM_WORKFLOW_AND_PRINCIPLES.md` to reflect this new strategy. The key change is the introduction of the **QA & Testing Agent**, who is responsible for writing and executing automated tests.

The new testing workflow is as follows:

1.  **Plan:** The Consultant defines what to test.
2.  **Implement:** The Testing Agent writes the test code (using Jest for the API and Playwright for the UI).
3.  **Execute:** The Testing Agent runs the tests.
4.  **Review:** The Consultant reviews the results, and the Project Lead provides final approval on any visual changes.

---

## Part III: The Grand Refactoring Blueprint (with Testing)

This is our strategic plan. It integrates the refactoring effort with our new testing strategy.

### Step 1: The Great Decomposition & API Test Foundation

-   **Refactoring Task (Implementation Agent):** Decompose our monolithic files (`main.js`, `db.js`, `renderer-advanced.js`) into smaller, domain-specific modules as outlined in the previous blueprint. This process will naturally create the first version of our "headless core API."

-   **Testing Task (Testing Agent):** As the headless API layer begins to form, the Testing Agent will write the first **API integration tests** using Jest. For example, once a `folder-manager.js` module is created, the Testing Agent will write `folder-manager.test.js` to programmatically test its functions (`createFolder`, `renameFolder`, etc.) without ever touching the UI.

### Step 2: Modernizing Core Services & Service-Level Testing

-   **Refactoring Task (Implementation Agent):** Refactor our "Red Zone" services (Collectors, Raters, BWS) to use the new, clean architecture and patterns.

-   **Testing Task (Testing Agent):** The Testing Agent will write comprehensive Jest tests for each modernized service, ensuring they are robust and reliable before they are even connected to the UI.

### Step 3: Building the Unified UI Hub & Visual Regression Testing

-   **Refactoring Task (Implementation Agent):** Build the new, unified "Collections-First" user interface, removing the old, fragmented tabs.

-   **Testing Task (Testing Agent):** As new UI components are built, the Testing Agent will use **Playwright** to write **visual regression tests**. This involves taking baseline screenshots of what each component *should* look like. These tests will then automatically fail if any future code change accidentally alters the UI, allowing us to catch visual bugs automatically.

---

## Part IV: The Next Session - A Concrete Starting Point

Our next session will kick off both tracks of this new strategy in parallel.

-   **Task for Implementation Agent A:**
    -   **Goal:** Begin "The Great Decomposition."
    -   **Action:** Create the `src/ipc/` directory. Move the folder-related IPC handlers from `main.js` into a new `src/ipc/folder-handlers.js` file. Update `main.js` to import and use this new module. This establishes the pattern for all future decomposition work.

-   **Task for the new QA & Testing Agent:**
    -   **Goal:** Set up the testing infrastructure.
    -   **Action:** Install and configure **Jest** (for API testing) and **Playwright** (for UI testing). Create a basic placeholder test for each framework (e.g., `tests/api/placeholder.test.js`, `tests/ui/placeholder.spec.js`) and ensure you can run them successfully from the command line. This prepares our testing harness for the work ahead.

---

This concludes the strategic planning for our session. We end with a clear, powerful, and unified vision for building a high-quality, stable, and scalable application. A well-earned break is in order.
