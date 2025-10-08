# Handoff: Implement the "Co-Pilot" Rating UI

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**The Vision:** With all prerequisite features now complete, we will begin building the core feature of our "Interactive Rating" mini-phase: the **"Co-Pilot" Rating UI**. When a user selects an excerpt for analysis, the AI will act as their co-pilot, providing an instant, simultaneous rating for comparison and context. This transforms the viewer from a passive tool into an active analysis partner.

**The Mission:** Your task is to implement this interactive rating feature within the PDF Viewer's "Excerpt Detail Panel."

---

## Part II: Handoff to Next Agent (A Multi-Step Task)

### Task 1: Enhance the Detail Panel for Human Input

-   **Goal:** Upgrade the existing notes panel to a structured input form for human ratings.
-   **Action:** In `pdf-excerpt-viewer.js`, modify the "Qualitative Notes" section of the detail panel. Replace the simple `<textarea>` with a more structured form that includes:
    -   Radio buttons or a dropdown for a human to enter a score (e.g., 1-5).
    -   A textarea for the human's notes.
    -   A `[Submit My Rating]` button.

### Task 2: Create the AI "Co-Pilot" Display

-   **Goal:** Add a dedicated area to the Detail Panel to show the AI's analysis.
-   **Action:** Add a new, distinct section to the detail panel for the AI's rating. It should have clearly labeled placeholders for "AI Score," "AI Confidence," and "AI Reasoning."

### Task 3: Implement the Backend Logic

-   **Goal:** Create a new, fast IPC handler for rating a single item.
-   **Action:**
    1.  In `src/ipc/ai-handlers.js`, create a new IPC handler: `ai:rateSingleExcerpt`.
    2.  This handler should accept an excerpt's text and the research intent.
    3.  It will call our existing `gemini-rater.js` service to get a rating for that single piece of text.
    4.  It must return the full rating object (score, confidence, reasoning).
    5.  Expose this new handler in `preload.js` as `window.api.ai.rateSingleExcerpt`.

### Task 4: Wire up the "Co-Pilot" Workflow

-   **Goal:** Trigger the AI rating and display the results when a user clicks an excerpt.
-   **Action:** In `pdf-excerpt-viewer.js`, modify the `onExcerptClick` handler (or equivalent). When an excerpt is clicked, it must now do two things **in parallel**:
    a) Show the Detail Panel with the human rating input form.
    b) Call the new `window.api.ai.rateSingleExcerpt(...)` function.
-   When the AI's rating promise resolves, populate the "AI Co-Pilot" display area with the returned score and reasoning.

### Verification

-   Run the application and open a PDF collection.
-   Click on any excerpt.
-   **The Detail Panel must appear**, showing both the input form for your human rating AND, after a short delay, the results from the AI's simultaneous rating in the co-pilot section.
-   Run `npm run test:e2e` to ensure no regressions.
