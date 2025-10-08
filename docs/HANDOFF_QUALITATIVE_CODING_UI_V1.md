# Handoff: Implement the Qualitative Coding Workflow (v1)

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** The "Co-Pilot" rating feature is functional but needs to evolve into a true **Qualitative Coding Workflow**. Based on user feedback, we will refactor the feature to allow users to define the variable they are rating and view the results in a more structured, dashboard-style UI.

**The Mission:** Your task is to fix the current API key bug and then overhaul the Excerpt Detail Panel to implement this new, more powerful workflow.

---

## Part II: Handoff to Next Agent (A Multi-Step Task)

This is a large task. Please complete the following steps in order.

### Task 1 (Bug Fix): Fix the API Key Detection

-   **The Bug:** The `ai:rateSingleExcerpt` handler is not correctly retrieving the Gemini API key from settings, causing the AI Co-Pilot to fail.
-   **Action:** In `src/ipc/ai-handlers.js`, debug the handler. Ensure it correctly accesses the settings to retrieve the stored API key before initializing the `GeminiRater`. 
-   **Verification:** The AI Co-Pilot panel must successfully return a rating instead of the "not configured" error.

### Task 2: Implement "Define Variable" UI

-   **The Goal:** Allow users to define what they are rating.
-   **Action:** The "Create New Rating Project" modal must be enhanced. Add two new input fields:
    1.  **"Rating Variable"**: A text input for the user to name what they are measuring (e.g., "Stigma Level," "Positive Sentiment").
    2.  **"Scale"**: A dropdown to select the rating scale (e.g., "1-5", "1-7").
-   This information must be saved with the rating project.

### Task 3: Redesign the "Dashboard" Detail Panel

-   **The Goal:** Overhaul the Detail Panel to be a clear, comparative dashboard.
-   **Action:** Redesign the HTML and CSS for the Excerpt Detail Panel. It should have two clear, parallel columns: **"Your Analysis"** and **"AI Co-Pilot Analysis."** Both columns should have the exact same fields:
    -   The name of the **Variable** being rated.
    -   An input/display for the **Score**.
    -   A textarea/display for **Reasoning/Notes**.

### Task 4: Implement Aesthetic Score Input

-   **The Goal:** Replace the scoring dropdown with modern, clickable buttons.
-   **Action:** In the "Your Analysis" column, replace the `<select>` dropdown for the score with a styled row of `<button>` elements (e.g., buttons labeled 1, 2, 3, 4, 5). Add professional styling for hover and active states.

### Verification

-   The API key bug must be fixed.
-   The "Create Rating Project" modal must have the new "Variable" and "Scale" fields.
-   When an excerpt is clicked, the new "Dashboard" style Detail Panel must appear.
-   The human rating input must use the new aesthetic buttons.
-   Run `npm run test:ui -- --update-snapshots` to save the new UI state.
