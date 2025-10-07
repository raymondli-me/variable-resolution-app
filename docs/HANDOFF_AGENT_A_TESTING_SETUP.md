# Handoff: Establish the Agentic Testing Framework

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Next Agent

---

## Part I: Strategic Context

**Course Correction:** We are pausing further UI development to address a critical tooling gap. The previous agent's work highlighted that we cannot efficiently build and verify a high-quality UI without an automated visual testing framework. 

**The New #1 Priority:** Your task is to establish this framework. You will install and configure the **Playwright** testing tool, which will empower our agents to programmatically launch the application, interact with the UI, and take screenshots for visual verification. This is the foundational step for our entire "Agentic Testing" strategy.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent created a functional but aesthetically and architecturally incomplete first version of the Collections Hub. We are putting that work on hold.
-   The codebase is stable and ready for this new tooling task.

### 2. Current Application State

-   **Does it Run?:** Yes.
-   **Known Bugs:** The Collections Hub UI is incomplete.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To install and configure the Playwright testing framework to work with our Electron application.
-   **My Thought Process:** We need a way for agents to "see" their work. Playwright is the industry-standard tool for this. By setting it up now, all subsequent UI development can be automatically tested for visual correctness, removing the human bottleneck and ensuring a higher quality result.
-   **Relevant Files:** `package.json`, and a new `tests/` directory that you will create.

### 4. Next Immediate, Actionable Task

Your task is to set up the Playwright testing framework:

1.  **Install Playwright:** Run `npm install --save-dev @playwright/test`.
2.  **Initialize Playwright:** You may need to create a `playwright.config.js` file manually. Research and implement the correct configuration to make Playwright target our Electron application. The key is to correctly configure the `_electron` object within the Playwright config.
3.  **Create Test Directory:** Create a new top-level directory named `tests/ui/`.
4.  **Write a "Smoke Test":** Create a new test file: `tests/ui/smoke-test.spec.js`. Inside this file, write a simple test that:
    -   Launches the Electron application.
    -   Waits for the main window to appear and be ready.
    -   Takes a screenshot and saves it to a `test-results/` directory.
    -   Asserts that the main window's title is "VR Data Collector".
5.  **Add NPM Script:** In `package.json`, add a new script to the `"scripts"` section: `"test:ui": "playwright test"`.
6.  **Verification:** Run the test from the command line using `npm run test:ui`. Verify that it passes and that a screenshot of the application window is successfully created in the `test-results` directory.

### 5. The Big Picture: The Overall Goal

This task is the foundation for our entire Agentic Testing strategy. Once complete, all future UI work can be automatically verified for visual correctness. This unblocks the UI development and is the first step toward a truly automated, high-quality development process.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
