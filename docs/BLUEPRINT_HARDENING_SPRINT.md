# Blueprint: The Hardening Sprint

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔴 **CRITICAL** - New Strategic Priority

---

## Part I: An Honest Assessment

We have a problem. While our architectural refactoring has been successful on paper, the application's stability has suffered. Recent manual testing has revealed critical, blocking bugs that cause errors on startup. Our agents have been marking tasks as complete while the console is filled with errors.

This is unacceptable. We cannot build a high-quality application on an unstable foundation.

Therefore, I am pausing all feature development. We are now entering a mandatory **"Hardening Sprint."** The only goal of this sprint is to achieve a **"Golden Master"** state: an application that starts and runs with **ZERO console errors**.

---

## Part II: The Recovery Plan

This sprint consists of three sequential tasks.

### Task 1: Fix the Invented API Call

-   **The Bug:** The application crashes while trying to load "Enrichments" because the code calls `window.api.database.query`, a function that does not exist.
-   **The Fix:** We must create a real, specific API endpoint for this purpose and update the UI to use it.

### Task 2: Exorcise the "Ghost UI" Bug (Final Attempt)

-   **The Bug:** The legacy `bws-manager.js` script is still trying to access HTML elements from the old BWS tab that we deleted, causing startup errors.
-   **The Fix:** We must find and eliminate every reference to the old UI in our legacy scripts.

### Task 3: Upgrade Our Testing Protocol

-   **The Flaw:** Our current automated tests do not fail when there are console errors.
-   **The Fix:** The E2E test script must be enhanced to listen for and **automatically fail the test run if any `console.error` messages are detected.** This will be our new quality gate.

---

## Part III: The New Definition of "Done"

From this point forward, no task is considered complete until the following conditions are met:

1.  The feature or fix is implemented.
2.  The application starts and runs without regressions.
3.  The **console is 100% free of new errors**.
4.  The full E2E test suite (`npm run test:e2e`) passes.

---

## Part IV: The First Handoff

We will begin immediately with Task 1.

-   **Handoff for the Next Implementation Agent:**
    -   **Goal:** Fix the invented API call in the Collections Hub.
    -   **Task:**
        1.  **Backend:** In `src/ipc/ai-handlers.js`, create a new IPC handler named `ai:getEnrichmentsForCollection` that accepts a `collectionId` and returns all `rating_projects` associated with it.
        2.  **Bridge:** In `preload.js`, expose this new handler as `window.api.ai.getEnrichmentsForCollection`.
        3.  **Frontend:** In `src/components/collections-hub.js`, find the `loadEnrichments` function. Replace the failing call to the non-existent `window.api.database.query` with a call to the new, real function: `window.api.ai.getEnrichmentsForCollection`.
    -   **Verification:** Run the application. The `window.api.database.query is not a function` error must be gone from the console, and the enrichment data should now load correctly.
