# Phase 0 Integration Test Plan

**Date:** October 6, 2025
**Objective:** To perform a full end-to-end test of the Collection Management features, verifying that the backend services and frontend UI work together correctly after the recent bug fixes.

**Tester:** Raymond (Project Lead)
**Coach:** Gemini Consultant Agent

---

## Instructions for Tester

Please launch the application (`npm run dev`) and perform the following steps in order. Report the outcome of each step (e.g., "Pass" or "Fail"). If a step fails, please provide any console errors and a description of what happened.

---

## Test Suite

### Test Case 1: Folder Management (Verifies BUG-002 fix)

- **1.1: Create Folder:**
  - In the folder browser, click the "+" button to create a new folder.
  - A modal dialog should appear asking for a name.
  - Enter `Test Project` and click "OK".
  - **Expected Result:** A new folder named "Test Project" appears.

- **1.2: Create Sub-Folder:**
  - Right-click on "Test Project" and select "New Folder".
  - Enter `Analysis Results`.
  - **Expected Result:** A new sub-folder appears inside "Test Project".

- **1.3: Rename Folder:**
  - Right-click on "Analysis Results" and select "Rename".
  - Enter `Final Analysis`.
  - **Expected Result:** The folder is renamed to "Final Analysis".

- **1.4: Move Collection:**
  - Drag an existing collection from the root into the "Final Analysis" folder.
  - **Expected Result:** The collection disappears from the root and the count on the folder updates.

- **1.5: Delete Folder:**
  - Right-click on "Final Analysis" and select "Delete".
  - A confirmation modal should appear.
  - Click "Delete".
  - **Expected Result:** The folder is deleted, and the collection it contained moves back to the parent ("Test Project").

### Test Case 2: Collection Export

- **2.1: Trigger Export:**
  - Right-click the collection you used in step 1.4 and select "Export".
  - **Expected Result:** A native "Save File" dialog appears.

- **2.2: Save File:**
  - Save the file to your Desktop as `test_export.json`.
  - **Expected Result:** A success toast notification appears in the corner of the app.

- **2.3: Verify File:**
  - Check your Desktop.
  - **Expected Result:** The file `test_export.json` exists.

### Test Case 3: Collection Import (Verifies BUG-001 fix)

- **3.1: Trigger Import:**
  - In the folder browser, click the main context menu (three dots) and select "Import Collection".
  - **Expected Result:** A native "Open File" dialog appears.

- **3.2: Import Valid File:**
  - Select the `test_export.json` file from your Desktop.
  - **Expected Result:** A new collection appears in the folder list, and a success toast is shown.

- **3.3: Import INVALID File:**
  - Create a new, empty text file on your Desktop named `empty.json`.
  - Attempt to import `empty.json`.
  - **Expected Result:** The application does **not** crash. An error toast appears with a user-friendly message like "Import file is empty or invalid".

### Test Case 4: Special Views (Verifies BUG-003 fix)

- **4.1: Star Collection:**
  - Right-click the newly imported collection and select "Star".
  - **Expected Result:** The star icon next to the collection turns yellow.

- **4.2: Open Starred View:**
  - Click on the "Starred Collections" special view at the top of the browser.
  - **Expected Result:** A modal appears, listing the collection you just starred. The UI should be stable with no `NaN` or `undefined` values.

- **4.3: Open Collection from Modal:**
  - Click on the collection inside the modal.
  - **Expected Result:** The modal closes, and the collection is loaded in the main viewer area.

---

## Reporting

Please provide the results for each step. I will stand by to record the outcome and plan our next actions based on your findings.