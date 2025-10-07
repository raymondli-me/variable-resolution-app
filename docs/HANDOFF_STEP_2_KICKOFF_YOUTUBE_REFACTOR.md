# Handoff: Kickoff Step 2 - Modernize YouTube Service

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**Milestone Achieved:** Step 1, "The Great Decomposition," is **100% complete**. The `main.js` monolith has been successfully dismantled into 9 modular IPC handlers. The codebase is now clean, organized, and ready for the next phase.

**The Next Mission:** We now begin **Step 2: Modernizing the Core Services**. Our goal is to refactor our oldest services to use modern JavaScript classes and our established best practices. We will begin with the most critical service: the **YouTube Collector**.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent successfully extracted the final IPC handlers from `main.js` and fixed a critical bug in the export function.
-   The `main.js` file is now a clean 160-line orchestrator.
-   The last relevant commit was `3d89699`.

### 2. Current Application State

-   **Does it Run?:** Yes. The application is stable.
-   **Known Bugs:** No known functional bugs.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To begin the modernization of the `youtube-handlers.js` module.
-   **My Thought Process:** The logic inside `youtube-handlers.js` is currently a large, procedural script. To make it more robust, testable, and maintainable, we must refactor it into a proper class. This class will encapsulate all the logic for collecting YouTube data and provide rich feedback to the UI, replacing all the old `console.log` statements.
-   **Relevant Files:** Your work will primarily be in `src/ipc/youtube-handlers.js` and a new file you will create, `src/services/youtube-collector.js`.

### 4. Next Immediate, Actionable Task

Your task is to refactor the `youtube-handlers.js` module into a modern, class-based service:

1.  Create a new file: `src/services/youtube-collector.js`.
2.  Inside this new file, define and export a `YouTubeCollector` class.
3.  Move all the logic (the 4 IPC handlers and their 10 helper functions) from `src/ipc/youtube-handlers.js` into methods within the new `YouTubeCollector` class.
4.  The class `constructor` should accept its dependencies, such as the `getDatabase` and `getMainWindow` functions.
5.  **Refactor the main `collect` method** to provide rich UI feedback. Replace all `console.log` statements with calls to the main window's web contents to send IPC messages that the frontend can listen for (e.g., `collection:progress`, `collection:video-complete`, `collection:error`).
6.  **Integrate the toast notification system.** When a collection process completes or fails, the service should trigger a proper toast notification in the UI.
7.  Update `src/ipc/youtube-handlers.js`. It should now be a very "thin" file. Its registration function will simply create an instance of your new `YouTubeCollector` class and have the IPC handlers call the corresponding methods on that instance.
8.  **Verification:** Run the app and perform a small YouTube collection. Confirm that the collection process works and that you see proper progress updates and toast notifications in the UI, instead of just logs in the console.

### 5. The Big Picture: The Overall Goal

This task is the template for modernizing all of our core services. By refactoring the YouTube collector into a robust, class-based service, you will establish the pattern for upgrading our AI Rater, BWS service, and more, bringing our entire application up to a professional standard.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
