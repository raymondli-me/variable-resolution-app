# Handoff for Agent A: Implement Global Variable Management Button

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🟢 **ACTION REQUIRED** - Handoff to Implementation Agent A

---

## Part I: Strategic Context

**The Vision:** We are beginning **Phase 2.2: Qualitative Coding Workflow (v2)**. The previous agent session implemented a "Manage Variables" button per collection card. However, based on new feedback, we are refining this approach.

**The Mission:** Your task is to implement the first step of "Global Variable Management" by removing the per-card button and adding a single, global "Manage Variables" button to the top right of the Collections Hub. The full strategic plan is in `docs/BLUEPRINT_PHASE_2_QUALITATIVE_CODING_V2.md`.

---

## Part II: Seamless Handoff Protocol

### 1. Executive Summary of Work Completed

-   The previous agent implemented a "Manage Variables" button on PDF collection cards and made several UI adjustments to the PDF viewer.

### 2. Current Application State

-   **Does it Run?:** Yes.
-   **Known Bugs:** The "Manage Variables" button appears on individual PDF collection cards, which is not the desired global management approach.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To refactor the UI to support global variable management.
-   **My Thought Process:** The user wants a single, centralized place to manage variables, not a button on every card. This requires removing the per-card button and adding a new, global button in the Collections Hub header.
-   **Relevant Files:** `src/components/collections-hub.js`, `index-advanced.html`.

### 4. Next Immediate, Actionable Task for You (Agent A)

Your task is to implement the global variable management button:

1.  **Remove Per-Card Button:** In `src/components/collections-hub.js`, remove the "Manage Variables" button from the collection card rendering logic.
2.  **Add Global Button:** In `index-advanced.html`, add a new button to the header of the Collections Hub (e.g., next to "New Collection") labeled "Manage Variables."
3.  **Stub Functionality:** For now, clicking this global button should simply `console.log("Manage Variables clicked")`.

### 5. The Big Picture: The Overall Goal

This task is the first step in centralizing variable management, aligning with our vision for global, genre-specific variables.

### 6. `git diff HEAD`

There are no uncommitted changes. The repository is in a clean state.
