# Handoff: Implement Collection Transform Actions

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Prerequisite:** We are about to begin building our comprehensive "E2E Data Pipeline Test." However, this test requires the ability to programmatically transform collections using actions like `Subsample` and `Filter`. These actions are currently non-functional stubs in the UI.

**The Mission:** Your task is to implement the final two stubbed actions in the Collections Hub context menu: **Subsample** and **Filter**. This is the last prerequisite before our Testing Agent can begin building the E2E test.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The Collections Hub UI is complete, and all actions except for `Subsample` and `Filter` are functional.

### 2. Current Application State

-   **Does it Run?:** Yes. The application is stable.
-   **Known Bugs:** The 'Subsample' and 'Filter' context menu items are non-functional (`console.log` stubs).

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To wire up the `Subsample` and `Filter` context menu actions to their corresponding backend IPC handlers.
-   **My Thought Process:** The backend logic and IPC handlers for these transformations (`collections:subsample`, `collections:filter`) already exist. This task involves creating the necessary modals to gather user input (e.g., sample size, filter criteria) and then calling the existing API functions.
-   **Relevant Files:** `src/components/collections-hub.js`, `preload.js` (for API reference).

### 4. Next Immediate, Actionable Task

Your task is to implement the `Subsample` and `Filter` actions:

1.  **Locate the Stubs:** In `src/components/collections-hub.js`, find the `handleContextMenuAction` method and the placeholder cases for `'subsample'` and `'filter'`.

2.  **Implement Subsample:**
    -   When 'Subsample' is clicked, create and show a new modal that asks the user for the "Sample Size" and the "New Collection Name."
    -   On submit, call the existing `window.api.collections.subsample(...)` function with the correct parameters.
    -   Upon success, refresh the Collections Hub to show the new derived collection and display a success toast.

3.  **Implement Filter:**
    -   When 'Filter' is clicked, create and show a new modal that provides inputs for the filter criteria (e.g., min views, keywords) and the "New Collection Name."
    -   On submit, call the existing `window.api.collections.filter(...)` function.
    -   Upon success, refresh the Collections Hub and display a success toast.

4.  **Verification:**
    -   Run the application.
    -   Verify that you can successfully create a new collection via both the "Subsample" and "Filter" actions in the context menu.
    -   Verify that the new derived collections appear correctly in the Hub.

### 5. The Big Picture: The Overall Goal

Completing this task makes our Collections Hub 100% feature-complete for all collection operations. It fully unblocks the creation of our E2E test, which is the final goal of this phase.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
