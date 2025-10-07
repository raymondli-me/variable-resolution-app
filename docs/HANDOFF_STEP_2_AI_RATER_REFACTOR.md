# Handoff: Modernize the AI Rating Service

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**Milestone Achieved:** The `YouTubeCollector` service has been successfully modernized, proving our refactoring strategy is effective. We are making excellent progress on **Step 2: Modernizing the Core Services**.

**The Next Mission:** Your task is to apply the exact same pattern to our next most critical service: the **AI Rating Service**. You will refactor the procedural logic currently in `src/ipc/ai-handlers.js` into a robust, class-based service.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent successfully refactored the YouTube service into the new `src/services/youtube-collector.js` class.
-   The pattern of creating a modern service and leaving a thin IPC wrapper is now established.
-   The last commit was `7ee7908`.

### 2. Current Application State

-   **Does it Run?:** Yes. The application is stable.
-   **Known Bugs:** No known functional bugs.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To continue modernizing our "Red Zone" services by refactoring the AI Rating logic.
-   **My Thought Process:** The `ai-handlers.js` file contains all the logic for creating, running, and viewing AI rating projects. It needs to be encapsulated within a class to improve maintainability and to properly integrate its feedback (progress, errors, completion) with the main UI.
-   **Relevant Files:** Your work will primarily be in `src/ipc/ai-handlers.js` and a new file you will create, `src/services/ai-rater-service.js`.

### 4. Next Immediate, Actionable Task

Your task is to refactor the `ai-handlers.js` module into a modern, class-based service:

1.  Create a new file: `src/services/ai-rater-service.js`.
2.  Inside this new file, define and export an `AiRaterService` class.
3.  Move all the logic from `src/ipc/ai-handlers.js` into methods within this new `AiRaterService` class (e.g., `getRatingProjects()`, `startRating()`, etc.).
4.  The class `constructor` should accept its dependencies (e.g., `getDatabase`, `getMainWindow`).
5.  **Refactor the `startRating` method** to provide rich UI feedback via IPC messages (e.g., `ai:progress`, `ai:complete`, `ai:error`) instead of relying on `console.log`.
6.  **Integrate the toast notification system** for when a rating project is fully completed or fails unexpectedly.
7.  Update `src/ipc/ai-handlers.js` to be a **thin wrapper**. Its registration function will simply create an instance of your new `AiRaterService` and have the IPC handlers call the corresponding methods on that instance.
8.  **Verification:** Run the app (`npm run dev`). The primary verification for this task is to **ensure the application starts without any errors in the console.** A full functional test of the AI rating flow is not required for this step, as we are primarily improving the architecture and feedback mechanisms.

### 5. The Big Picture: The Overall Goal

By giving the AI Rating service the same treatment as the YouTube Collector, we will have modernized another critical piece of our application. This leaves only the BWS service as the final component to be refactored, bringing us to the brink of completing our entire backend modernization effort.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
