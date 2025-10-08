# Handoff: Qualitative Coding Workflow - Cleanup & Completion

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**Progress Made, But New Issues:** The previous agent made good progress on global variable management and PDF viewer layout. However, a critical bug was introduced, and the main task of implementing the qualitative coding workflow was left incomplete.

**The Mission:** Your task is to fix the newly introduced bug, correctly place the code, and then complete the original vision for the Qualitative Coding Workflow (v1).

---

## Part II: Handoff to Next Agent (A Multi-Step Task)

### Task 1 (Critical Bug Fix): Fix `TypeError: getSettings(...).get is not a function`

-   **The Bug:** The AI suggestion feature is broken because the `ai:suggestVariableDefinition` handler in `src/ipc/ai-handlers.js` is incorrectly trying to access settings.
-   **Action:** In `src/ipc/ai-handlers.js`, locate the code that retrieves the Gemini API key. The `getSettings` function should return the entire settings object, and you should then access properties directly (e.g., `settings.apiKeys.gemini`). Correct the usage of `getSettings` to properly retrieve the Gemini API key.
-   **Verification:** The AI Co-Pilot panel must successfully return a rating instead of the "not configured" error.

### Task 2 (Code Relocation): Relocate Global Variable IPC Handlers

-   **The Bug:** The `global_rating_variables` IPC handlers were incorrectly placed in `src/ipc/pdf-handlers.js`.
-   **Action:** Move the `createGlobalRatingVariable`, `getGlobalRatingVariables`, and `deleteGlobalRatingVariable` IPC handlers from `src/ipc/pdf-handlers.js` to `src/ipc/ai-handlers.js`. Update `preload.js` and `src/components/collections-hub.js` to reflect this change.

### Task 3 (Feature Completion): Implement the "Dashboard" Detail Panel

-   **The Goal:** Redesign the Excerpt Detail Panel to be a comparative dashboard.
-   **Action:** Overhaul the HTML and CSS for the Excerpt Detail Panel. It should have two clear, parallel columns: **"Your Analysis"** and **"AI Co-Pilot Analysis."** Both columns should have the exact same fields:
    -   The name of the **Variable** being rated.
    -   An input/display for the **Score**.
    -   A textarea/display for **Reasoning/Notes**.

### Task 4 (Feature Completion): Implement Aesthetic Score Input

-   **The Goal:** Replace the scoring dropdown with modern, clickable buttons.
-   **Action:** In the "Your Analysis" column, replace the `<select>` dropdown for the score with a styled row of `<button>` elements (e.g., buttons labeled 1, 2, 3, 4, 5). Add professional styling for hover and active states.

### Task 5 (UX Improvement): Implement Vertical Resizer for Detail Panel

-   **The Goal:** Allow the user to adjust the height of the bottom Detail Panel.
-   **Action:** Implement a vertical resizer between the PDF viewer and the bottom Detail Panel, allowing the user to drag its border up and down to adjust its height.

### Verification

-   The `getSettings().get` error must be gone.
-   The "Manage Variables" modal should still work.
-   The Excerpt Detail Panel should now be a comparative dashboard with human and AI sections.
-   The human score input should use buttons.
-   The Detail Panel should be vertically resizable.
-   Run `npm run test:ui -- --update-snapshots` to save the new UI state.

---

## The Big Picture

This task addresses all immediate issues and completes the first version of our Qualitative Coding Workflow. It will deliver a stable, functional, and user-friendly interface for interactive analysis.
