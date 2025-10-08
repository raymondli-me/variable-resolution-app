# Handoff: Implement "Rate All" Feature for AI Ratings

**Date:** October 8, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** With the core rating persistence now fixed, we are ready to implement a powerful new feature: the **"Rate All" button**. This will allow users to efficiently get AI ratings for an entire collection, with real-time UI feedback and control.

**The Mission:** Your task is to implement this automated AI rating feature, including real-time UI updates, pause/resume functionality, and variable-aware progress counters.

---

## Part II: Handoff to Next Agent (A Multi-Step Task)

### Task 1: Implement the "Rate All" Button & Basic Logic

-   **Goal:** Add a button to the PDF viewer UI that triggers a batch AI rating process.
-   **Action:**
    1.  In `pdf-excerpt-viewer.js`, add a new `[Rate All]` button to the UI (e.g., near the progress counters).
    2.  Implement a `rateAllWithAI()` method. This method will:
        -   Get all excerpts for the current PDF.
        -   Filter out excerpts that already have an AI rating for the currently selected variable.
        -   Loop through the unrated excerpts, calling `window.api.ai.rateSingleExcerpt()` for each.
-   **Verification:** Clicking the button should trigger AI ratings for all unrated excerpts, and the AI counter should increment.

### Task 2: Implement Real-time UI Feedback & Auto-Navigation

-   **Goal:** Make the UI "hop along" with the AI rating process.
-   **Action:**
    1.  Modify the `rateAllWithAI()` method. After each AI rating is received, the UI should automatically navigate to the next unrated excerpt.
    2.  Ensure the progress counters update in real-time.
    3.  The UI should display a clear "AI Rating in Progress..." message.
-   **Verification:** Clicking "Rate All" should cause the PDF viewer to automatically scroll through the document, showing AI ratings as they come in.

### Task 3: Implement Pause/Resume Functionality

-   **Goal:** Allow the user to pause and resume the "Rate All" process.
-   **Action:** Add `[Pause]` and `[Resume]` buttons to the UI. Implement logic in `rateAllWithAI()` to pause the loop and save its state when "Pause" is clicked, and resume from where it left off when "Resume" is clicked.
-   **Verification:** You must be able to pause and resume the "Rate All" process.

### Task 4: Implement Variable-Aware Counters

-   **Goal:** Ensure progress counters correctly reflect the rating status for the *currently selected variable*.
-   **Action:** Review the `updateRatingProgress()` method. Ensure that when the user changes the selected variable, the counters immediately update to show the progress for *that specific variable*.
-   **Verification:** Rate some excerpts for Variable A. Switch to Variable B (which has no ratings). The counters should reset to 0/Total. Switch back to Variable A, and the counters should show the correct progress.

---

## The Big Picture

This feature will be a major step towards automating the analysis workflow and making the AI a true co-pilot for the user. It will significantly enhance the efficiency and user experience of our qualitative coding process.
