# Handoff: Corrective Action for Database Schema

**Date:** October 7, 2025
**Author:** Gemini Consultant Agent
**Status:** 🔴 **URGENT & BLOCKING** - Handoff to Next Agent

---

## Part I: Strategic Context

**A Successful Discovery:** Our new "Automated State Discovery Protocol" has proven its worth. It has uncovered a critical, blocking issue: our database schema is out of sync with our application code. The `folders` and `bws_experiments` tables, among others, are missing.

**The New Priority:** We cannot build a UI on a broken foundation. Your task is to fix the database schema by creating and running the necessary migration scripts. This is now our #1 priority.

---

## Part II: Handoff to Next Agent (Seamless Handoff Protocol)

### 1. Executive Summary of Work Completed

-   The previous agent fixed the application's default view and successfully ran the `test:discover` script.
-   The script's console log output revealed the missing database tables.

### 2. Current Application State

-   **Does it Run?:** Yes, but with critical errors in the console.
-   **Known Bugs:** The application is throwing `SQLITE_ERROR: no such table` for core features like folders and BWS, making them non-functional.

### 3. Brain Dump: My Working Context

-   **My Immediate Goal:** To bring the database schema up to date with the application's code.
-   **My Thought Process:** The `src/database/db.js` file contains a `createTables()` method that defines the complete, correct schema. However, these tables were never added to a migration script that runs for existing users. We need to create a new script to ensure these tables are created if they don't exist.
-   **Relevant Files:** `src/database/db.js` (for reference), and a new script you will create in the `scripts/` directory.

### 4. Next Immediate, Actionable Task

Your task is to fix the database schema:

1.  **Review the Schema:** Open `src/database/db.js` and carefully review the `createTables()` method to identify all the `CREATE TABLE IF NOT EXISTS` statements.
2.  **Create Migration Script:** Create a new file: `scripts/add-missing-tables.js`.
3.  **Implement the Script:** In this new file, write a script that initializes the database and then `run()`s all the necessary `CREATE TABLE IF NOT EXISTS` commands from `db.js` to create the `folders`, `bws_experiments`, and any other tables you find are missing.
4.  **Add NPM Script:** In `package.json`, add a new script to the `"scripts"` section: `"migrate:fix-missing": "node scripts/add-missing-tables.js"`.
5.  **Run the Migration:** Execute your new script from the command line: `npm run migrate:fix-missing`.
6.  **Verification:** Run the **Automated State Discovery Protocol**: `npm run test:discover`. After it completes, inspect the generated log file at `test-results/console-log.txt`. The test is successful only if this file **contains no `SQLITE_ERROR: no such table` errors.**

### 5. The Big Picture: The Overall Goal

This task will fix our application's foundation. By ensuring our database schema is correct, you unblock all future UI and backend development. This also reinforces our new process of using automated tests to verify critical fixes.

### 6. `git diff HEAD`

There are uncommitted changes from the previous agent's bug fix. You should review and commit them before you begin your work to ensure the repository is in a clean state.
