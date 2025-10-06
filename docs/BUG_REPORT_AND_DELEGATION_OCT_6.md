# Bug Report & Delegation for Integration Phase 1

**Date:** October 6, 2025
**Status:** 🐞 Bugs Identified | 🛠️ Fixes Delegated

---

## 1. Summary

Initial integration testing has revealed several critical bugs that prevent the application from functioning correctly. This is an expected and productive part of the development process. The issues stem from predictable integration gaps between the frontend and backend.

I am assigning the following bugs to the appropriate agents for immediate resolution.

---

## 2. Bug Assignments

### BUG-001: Import function crashes on invalid file

- **Description:** The backend `importCollectionJSON` function throws an unhandled error (`Unsupported format version: undefined`) when triggered with invalid data.
- **Severity:** **High** (Blocks all import functionality).
- **Assignee:** **Agent A (Backend)**
- **Action Required:** In `src/services/collection-importer.js`, add a guard clause at the start of `importCollectionJSON` to validate the incoming data. If the data or its `format_version` is invalid, throw a clear, user-friendly error (e.g., `Invalid or empty import file.`).

### BUG-002: `prompt()` is not supported in Create Folder

- **Description:** The "Create Folder" feature crashes because it uses the browser's `prompt()`, which is disabled in Electron.
- **Severity:** **High** (Blocks folder creation).
- **Assignee:** **Agent B (Frontend)**
- **Action Required:** In `src/components/folder-browser.js`, replace the `prompt()` call inside the `createFolder` method. You must implement a custom modal (similar to the one you built for Special Views) to get the new folder's name from the user.

### BUG-003: Race condition on collection load

- **Description:** The UI attempts to render collection details before the data is loaded from the database, causing a `Cannot read properties of undefined (reading 'getCollection')` error and visual bugs like `NaN`.
- **Severity:** **High** (Causes UI crashes and instability).
- **Assignee:** **Agent B (Frontend)**
- **Action Required:** Add defensive guard clauses in `renderer-advanced.js` and `folder-browser.js` to ensure data exists before attempting to render it. When rendering collection properties (e.g., `collection.video_count`), use default values (`|| 0`) to prevent `NaN` from appearing.

### TASK-001: Redundant startup function calls

- **Description:** The `FFmpeg check` is logged three times on startup, indicating a minor inefficiency.
- **Severity:** Low.
- **Assignee:** **Consultant (Me)**
- **Action Required:** I will investigate the startup sequence and consolidate the redundant calls into a single one.

---

## 3. Directive

- **Agents A & B:** Please immediately begin work on your assigned **High** severity bugs. This is your top priority. Report back upon completion.
- **Raymond:** This is a normal part of the development cycle. The team is now working to fix the integration issues. I will keep you updated.
