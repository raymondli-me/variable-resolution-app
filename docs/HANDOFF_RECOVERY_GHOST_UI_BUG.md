# Handoff: Fix the "Ghost UI" Bug

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔴 **URGENT & BLOCKING** - Handoff to Implementation Agent

---

## Part I: Strategic Context

**The Mission:** Our application is currently unstable due to legacy JavaScript trying to access UI elements that no longer exist. This is causing `TypeError: Cannot set properties of null` on startup. Your task is to hunt down and eliminate these errors.

This is **Task 1** of our **Recovery Plan**. All other work is on hold until this is complete.

---

## Part II: Handoff to Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The last session ended with the creation of the `FINAL_SITREP_AND_RECOVERY_PLAN.md` document.
-   The application is architecturally sound but functionally broken due to the issues identified in that report.

### 2. Current Application State

-   **Does it Run?:** Yes, but it immediately throws critical errors in the console upon startup.
-   **Known Bugs:** `bws-manager.js` is crashing because it cannot find the HTML elements from the old BWS tab which has been deleted.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To prevent startup crashes by making our legacy scripts resilient to the new, unified UI.
-   **My Thought Process:** The root cause is that old scripts are running and expecting old HTML. The fastest and safest way to fix this is to find every `document.getElementById` or `querySelector` in these old scripts and wrap them in a null check. This prevents the error without requiring a full refactor of the legacy script itself, which is out of scope for this immediate bug fix.
-   **Relevant Files:** `src/bws-manager.js` is the primary culprit. You should also check `src/renderer-advanced.js` for similar issues.

### 4. Next Immediate, Actionable Task

Your task is to fix the "Ghost UI" bug:

1.  **Locate the Errors:** Open `src/bws-manager.js`. Find all the lines that access DOM elements (e.g., `document.getElementById('bws-experiments-gallery')`).
2.  **Implement Defensive Guards:** Wrap every DOM access and subsequent manipulation in a null check. For example:
    ```javascript
    // BEFORE (crashes if element doesn't exist):
    document.getElementById('totalBWSExperiments').textContent = stats.total;

    // AFTER (safe):
    const totalEl = document.getElementById('totalBWSExperiments');
    if (totalEl) {
      totalEl.textContent = stats.total;
    }
    ```
3.  **Apply Broadly:** Apply this pattern to **all** DOM manipulations in `bws-manager.js`. Do the same for any similar startup logic you find in `renderer-advanced.js` that may be referencing old, deleted UI elements.
4.  **Verification:**
    -   Run the application (`npm run dev`).
    -   Open the developer console.
    -   **The `TypeError: Cannot set properties of null` error related to `bws-manager.js` must be gone.** This is the primary success criterion.

### 5. The Big Picture: The Overall Goal

This task is about stabilization. By making our old scripts aware that the UI has changed, you eliminate a major source of instability and unblock the next phase of our recovery plan.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
