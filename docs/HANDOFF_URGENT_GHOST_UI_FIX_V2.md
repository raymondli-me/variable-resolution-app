# Handoff (V2 - Urgent): Fix the "Ghost UI" Bug

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔴 **URGENT & BLOCKING** - Handoff to Next Agent

---

## Part I: Strategic Context

**The previous agent failed to fix this bug.** This is a second attempt with a more precise directive. The application is blocked until this is resolved.

**The Bug:** `bws-manager.js` is crashing on startup because it is trying to access a deleted HTML element with the ID `totalBWSExperiments`.

---

## Part II: Handoff to Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent session was unsuccessful and did not fix the bug.

### 2. Current Application State

-   **Does it Run?:** Yes, but it immediately throws a critical `TypeError` in the console, originating from `bws-manager.js`.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To stop the startup crash by adding a single null check.
-   **My Thought Process:** The error comes from line 899 of `bws-manager.js`. The script tries to get an element and then set its properties, but the element is `null`. We must wrap this logic in a conditional block.
-   **Relevant Files:** `src/bws-manager.js`.

### 4. Next Immediate, Actionable Task

Your task is to fix the "Ghost UI" bug with a precise change:

1.  Open the file `src/bws-manager.js`.
2.  Go to line 899. You will see: `const totalExpEl = document.getElementById('totalBWSExperiments');`
3.  Wrap this line and all subsequent lines that use the `totalExpEl` variable in a defensive `if` block. The final code should look like this:

    ```javascript
    const totalExpEl = document.getElementById('totalBWSExperiments');
    if (totalExpEl) {
      totalExpEl.textContent = totalBWSExperiments;
    }
    ```
    (Note: You will need to apply this `if` block to all other lines that use variables derived from the now-deleted BWS UI).

4.  **Verification:**
    -   Run the application (`npm run dev`).
    -   Open the developer console.
    -   The `TypeError: Cannot set properties of null` originating from `bws-manager.js` **must be gone.** This is the only success criterion.

### 5. The Big Picture: The Overall Goal

This task unblocks our entire project. By fixing this startup error, you will restore the application to a stable state, allowing us to resume our planned work.

### 6. `git diff HEAD`

There are uncommitted changes from a previous, failed agent session. You can choose to discard them (`git reset --hard`) or commit them, but your primary focus is fixing the bug in `bws-manager.js`.
