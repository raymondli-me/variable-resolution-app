# Blueprint: The E2E Data Pipeline Test Protocol

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔵 **PROPOSED BLUEPRINT FOR NEXT SESSION**

---

## Part I: The Vision - A Fully Automated E2E Test

With our backend modernized and our UI unified, the next evolution in our process is to create a comprehensive, end-to-end (E2E) testing protocol. This protocol will simulate a complete user story, from data ingestion to final analysis, and automatically generate a full dossier of visual and functional results.

This **"E2E Data Pipeline Test"** will become our ultimate quality gate and the primary method for any agent to get a holistic understanding of the application's current state.

---

## Part II: The Protocol - How It Works

We will create a single, powerful Playwright script (`tests/e2e/full-pipeline.spec.js`) and a corresponding npm command (`npm run test:e2e`). When run, this script will:

1.  **Use Standardized Data:** It will start with a small, static set of test data (e.g., a `sample-collection.json` file) to ensure tests are fast and deterministic.

2.  **Execute a Full User Story:** The script will programmatically perform a sequence of actions that mimics a real user workflow:
    -   **Import** the sample collection.
    -   **Verify** the new collection card appears correctly in the Hub (Screenshot #1).
    -   **View** the collection, opening the genre-specific viewer (Screenshot #2).
    -   **Initiate an Analysis** (e.g., "Rate Collection"), capturing the modal (Screenshot #3).
    -   **Verify the Analysis**, checking that the "Enrichment Layer" appears on the card (Screenshot #4).
    -   **Perform a Transformation** (e.g., "Subsample") to create a new derived collection.
    -   **Verify the Transformation**, checking that a second collection card appears (Screenshot #5).

3.  **Generate a Comprehensive Dossier:** Throughout the entire run, the script will:
    -   **Capture Screenshots** at every key step.
    -   **Record All Console Output** (logs, warnings, and errors).
    -   Save all artifacts to a timestamped directory in `test-results/`.

---

## Part III: The Implementation Plan

This is a new development effort. We will execute it with our standard sequential handoff process.

### Prerequisite: Implement Stubbed Actions

The full E2E test requires actions like `Subsample` and `Filter` to be functional. The agent who implemented the context menu left these as stubs. The first step will be to implement them.

-   **Task for Next Agent:** Your first task is to implement the `Duplicate`, `Subsample`, and `Filter` actions. The logic for these already exists in the backend; you simply need to wire them up in the `collections-hub.js` component, including any necessary modals for user input.

### Step 1: Create the Test Fixture

-   **Task:** Create the small, static JSON data file that will be used as the input for our E2E test (e.g., `tests/fixtures/sample-youtube-collection.json`).

### Step 2: Build the E2E Test Script

-   **Task:** Create the new Playwright script (`tests/e2e/full-pipeline.spec.js`) that executes the full user story described above.

### Step 3: Integrate into Team Workflow

-   **Task:** Add the `test:e2e` script to `package.json` and update our `TEAM_WORKFLOW_AND_PRINCIPLES.md` document to make running this test a required quality gate before any major release.

---

## Conclusion

This protocol represents the pinnacle of our "Agentic Testing" strategy. It provides a complete feedback loop, removes the human bottleneck, and will give us unparalleled confidence in our application's quality. This will be the primary focus of our next development session.
