# Team Workflow & Guiding Principles

**Author:** Principal Architect (Gemini)
**Date:** October 6, 2025
**Status:** 📋 Active Team Constitution
**Audience:** Raymond (Project Lead), Consultant Agent, Implementation Agent

---

## PURPOSE

This document establishes the guiding principles, role definitions, and best practices for the human-AI development team working on the Variable Resolution App (formerly VR Collector). It serves as the **team constitution** and must be consulted for all major architectural and implementation decisions.

---

## TEAM STRUCTURE (REVISED OCT 6, 2025)

### The Human-AI Relay Team Model

Our team operates as a disciplined, sequential relay team. This model prioritizes continuity and tight integration over parallel execution.

| Role | Agent | Primary Responsibility |
|------|-------|------------------------|
| **Project Lead & Tester** | Raymond (Human) | Sets direction, defines the "why," makes final strategic decisions, and performs all UI-based testing. |
| **Consultant & Archivist** | Claude OR Gemini* | Analyzes codebase, proposes solutions, creates initial tasks, and documents all work for the team. |
| **Implementation Agent A** | Claude or Gemini | Generalist agent responsible for executing a block of work and handing off to Agent B. |
| **Implementation Agent B** | Claude or Gemini | Generalist agent responsible for continuing the work from Agent A and handing it back. |
| **External Architect** | Principal Architect (Gemini) | Provides high-level oversight, ensures long-term architectural integrity, validates direction. |

**\*Note on Interchangeability:** The Consultant and Implementation Agent roles can be played by either Claude or Gemini.

**Success Formula:** A single, continuous stream of work + Extremely detailed handoffs between agents = A tightly integrated and robust application.

---

## WORKFLOW: THE SEQUENTIAL RELAY

The team no longer works in parallel. We now use a sequential "relay race" model where work is passed between agents like a baton.

### The Workflow Cycle

1.  **Task Definition (Consultant):** The Consultant defines a high-level feature or bug to be fixed.
2.  **Agent A - Execution:** Agent A begins work, continuing until they reach a logical stopping point or their context limit.
3.  **Agent A - Handoff:** Agent A creates a **Seamless Handoff Document**.
4.  **Agent B - Execution:** Agent B reads the handoff, continues the work, and integrates the next set of features or fixes.
5.  **Agent B - Handoff:** Agent B creates its own handoff document for Agent A.
6.  **Cycle Repeats:** The `A -> B -> A -> B` cycle continues until the feature is complete.
7.  **Testing (Human-Led):** Once a feature is declared complete by the agents, the Consultant prepares a test plan for the Project Lead (Raymond) to execute.

### The Seamless Handoff Protocol

This protocol is the **most critical process** for our team. Its purpose is to transfer the *entire working context* from one agent to the next, ensuring no momentum is lost. Each handoff must be a new document titled `docs/HANDOFF_AGENT_[A/B]_YYYY-MM-DD.md`.

A handoff document **MUST** contain the following sections:

#### 1. Executive Summary of Work Completed
- **What I Did:** A high-level summary of the features or fixes implemented in this session.
- **Commits:** A list of git commit hashes produced during the session.

#### 2. Current Application State
- **Does it Run?:** Yes/No. If no, why not?
- **Known Bugs:** Is there any broken functionality or known issues the next agent should be aware of?
- **Last Tested Action:** What was the last thing you successfully did with the application? (e.g., "I was able to export a collection, but import is still broken.")

#### 3. Brain Dump: My Working Context
This is the most important section. It must be detailed enough for the next agent to "think your thoughts."
- **My Immediate Goal:** What was the very next thing you were about to do? Be specific. (e.g., "I was about to add a new `try...catch` block around the `fs.readFile` call in `collection-importer.js` on line 25.")
- **My Thought Process:** Why were you doing that? What problem were you trying to solve? (e.g., "The app was crashing on invalid import paths, and I realized the file read itself wasn't being handled.")
- **Relevant Files & Snippets:** List the files you had open and paste the specific lines of code you were looking at.

#### 4. Next Immediate, Actionable Task for [Agent A/B]
Provide a single, crystal-clear instruction for the next agent. This should be small and concrete enough to start immediately.
- **Bad:** "Finish the import feature."
- **Good:** "Your task is to add a `try...catch` block to the `fs.readFile` call in `src/services/collection-importer.js` on line 25. If an error is caught, throw a new `Error('Failed to read import file.')`."

#### 5. The Big Picture: The Overall Goal
Remind the next agent of the larger feature we are currently building.
- **Example:** "Remember, we are working towards completing the full, stable export/import feature as defined in Phase 0."

#### 6. `git diff HEAD`
Paste the complete, unedited output of `git diff HEAD` at the end of the document. This shows the next agent all uncommitted changes and is a critical part of transferring the exact state of the workspace.

---

## LIVING DOCUMENTATION: QUIRKS & COMMON MISTAKES

**Principle:** To prevent repeating past errors and to accelerate onboarding, we will maintain a living list of technical quirks and common mistakes encountered during development.

Every agent **must** read this section before starting a new work session. When a new, non-obvious bug is discovered and fixed, it is the **Consultant's duty** to add it to this list.

### 1. Electron Environment Quirks

-   **`prompt()`, `alert()`, `confirm()` are forbidden.**
    -   **Mistake:** Using the browser's native `prompt()` for user input (`BUG-002`).
    -   **Reason:** Electron's security model disables these functions. They will crash the renderer process.
    -   **Correct Solution:** Always build a custom HTML/CSS modal for any user input or confirmation. Use the promise-based `showPromptModal()` and `showConfirmModal()` helpers in `folder-browser.js` as a template.

-   **Benign `service_worker_storage.cc` Error.**
    -   **Quirk:** On startup, the console may log a red `ERROR:service_worker_storage.cc(2016)] Failed to delete the database: Database IO error`.
    -   **Reason:** This is a non-fatal, internal error from the underlying Chromium engine. It is **not** related to our application's SQLite database.
    -   **Correct Solution:** This error can be safely **ignored** unless it is directly correlated with a reproducible application bug. Do not waste time trying to "fix" it.

### 2. Application Logic & Data Flow

-   **Race Conditions on UI Load.**
    -   **Mistake:** Assuming data from the database (`window.api.database.*` calls) is available immediately on UI load (`BUG-003`).
    -   **Reason:** Database calls are asynchronous. The UI may try to render before the data has returned, leading to `undefined` errors and `NaN` in the display.
    -   **Correct Solution:**
        1.  Always use `async/await` when calling database functions.
        2.  Add **defensive guards** to all rendering functions to check if data exists before trying to access its properties (e.g., `if (!collection) return;`).
        3.  Use **default fallbacks** in HTML templates to prevent `NaN` (e.g., `<span>${collection.video_count || 0} items</span>`).

-   **Invalid Data in IPC Handlers.**
    -   **Mistake:** Assuming data passed to an IPC handler (e.g., `collections:import`) is always valid (`BUG-001`).
    -   **Reason:** The frontend can accidentally send `null`, `undefined`, or malformed data, especially if a file dialog is cancelled or a file is corrupted.
    -   **Correct Solution:** The **backend service** (e.g., `CollectionImporter`) is responsible for comprehensive validation. Never trust data from the frontend. Always check for `null`, validate data types, and verify required fields before processing.

### 3. File Paths

-   **Absolute Paths are Required for `fs` tools.**
    -   **Mistake:** Using a relative path like `docs/file.md` in tools like `write_file` or `read_file`.
    -   **Reason:** The tool's execution context requires absolute paths to avoid ambiguity.
    -   **Correct Solution:** Always construct the full, absolute path to a file, starting from the project root (e.g., `/Users/raymondli701/workspace_2025_09_29/vr-collector/docs/file.md`).

---

## OPERATIONAL BEST PRACTICES

### For Raymond (Project Lead)

**Your Role:**
- Set the vision ("I want collections to be filterable, shareable, and organized")
- Make strategic decisions ("Yes, implement Phase 0 first")
- Break ties when agents disagree
- Validate that implementations match your research needs

**Best Practices:**
1. **Review Architecture Documents** before approving major work
2. **Test Each Phase** before moving to the next
3. **Provide Feedback** on UX/workflow (does it match your research process?)
4. **Maintain the Vision** when agents propose shortcuts

### For Consultant Agent

**Your Role:**
- Analyze current codebase
- Propose solutions aligned with architecture
- Create detailed implementation plans
- Bridge the gap between vision and code

**Best Practices:**
1. **Always Read** `COLLECTIONS_FIRST_CLASS_ARCHITECTURE.md` before planning
2. **Reference** existing patterns in the codebase
3. **Anticipate** edge cases and failure modes
4. **Provide** complete handoff documents
5. **Ask** Raymond for clarification if vision is unclear

**Checklist Before Creating a Plan:**
- [ ] Does this align with the architecture constitution?
- [ ] Am I following the phase ordering?
- [ ] Have I considered backward compatibility?
- [ ] Is the handoff document complete?
- [ ] Are success criteria testable?

### For Implementation Agent

**Your Role:**
- Translate plans into clean, functional code
- Follow established patterns
- Write tests
- Report completion with evidence

**Best Practices:**
1. **Read the Handoff Document** completely before coding
2. **Follow the File Manifest** precisely
3. **Match Code Style** with existing codebase
4. **Test Thoroughly** before reporting completion
5. **Document Deviations** if you must diverge from plan

**Checklist Before Starting:**
- [ ] Do I understand the goal?
- [ ] Do I have all necessary context?
- [ ] Are schema changes clear?
- [ ] Do I know what "done" looks like?

**Checklist Before Completion:**
- [ ] All success criteria met?
- [ ] Code tested manually?
- [ ] No console errors?
- [ ] Git commit made with clear message?
- [ ] Handoff report written?

### For Principal Architect (Gemini)

**Your Role:**
- Validate architectural direction
- Ensure long-term integrity
- Provide strategic oversight
- Catch design flaws early

**Best Practices:**
1. **Review Major Proposals** before implementation
2. **Challenge** solutions that violate principles
3. **Suggest** alternatives when design is flawed
4. **Validate** phase ordering and dependencies

---

## CONFLICT RESOLUTION

When disagreements arise:

### Level 1: Agent Discussion
- Consultant and Implementation agents discuss technical approach
- Reference architecture document
- Propose alternatives

### Level 2: Architectural Review
- Escalate to Principal Architect (Gemini)
- Present options with trade-offs
- Get architectural ruling

### Level 3: Project Lead Decision
- Raymond makes final call
- Decision is documented
- Architecture may be updated

**Example:**
```
Consultant: "I propose we add scores directly to video_chunks table."
Implementation: "Architecture says use collection_items intermediary."
Consultant: "You're right, let me revise the plan."

[If still uncertain]
→ Ask Principal Architect for validation
→ If architectural change needed, ask Raymond
```

---

## SUCCESS METRICS

### For the Team

**We are successful when:**
1. ✅ Each phase completes on schedule (1 week per phase)
2. ✅ No major rework required between phases
3. ✅ Documentation is complete and current
4. ✅ Architecture principles are upheld
5. ✅ Raymond can use the app for real research

### For Individual Roles

**Consultant Success:**
- Implementation agent rarely asks for clarification
- Plans are detailed enough to execute directly
- Proposals align with architecture constitution

**Implementation Success:**
- Code works first time (minimal debugging)
- Success criteria all met
- No architectural violations

**Raymond Success:**
- Each phase delivers tangible research value
- Workflow feels natural and productive
- Can share datasets with collaborators

---

## COMMUNICATION PATTERNS

### Starting a New Session

**Raymond:**
```
"I need [feature X]. Here's why: [research need].
Check the architecture doc and propose a plan."
```

**Consultant:**
```
"I've reviewed the architecture. This fits in Phase [N].
Here's my proposed approach: [detailed plan].
Aligns with principle [X] from the constitution.
Ready for implementation?"
```

**Raymond:**
```
"Approved. Implementation agent, proceed with consultant's plan."
```

### During Implementation

**Implementation:**
```
"Working on [task]. Question: [specific technical detail]?"
```

**Consultant:**
```
"Answer: [specific guidance]. Reference: [file:line]."
```

### Completing Implementation

**Implementation:**
```
"Task complete. Success criteria met: [checklist].
Deviations: [none/list]. Next steps: [from original plan]."
```

**Consultant:**
```
"Verified. Moving to next task: [description]."
```

---

## ANTI-PATTERNS (AVOID THESE)

### ❌ Skipping Phases
"Let's do BWS improvements before folder system."
→ **Breaks foundation-first principle**

### ❌ Incomplete Handoffs
"Just add a filter feature."
→ **No schema, no success criteria, no file manifest**

### ❌ Architectural Violations
"Let's store scores in video_chunks for now."
→ **Violates collection_items separation principle**

### ❌ Undocumented Decisions
"I changed the approach mid-implementation."
→ **Breaks communication chain, loses context**

### ❌ Scope Creep
"While implementing folders, I also added search."
→ **Complicates testing, violates single-task principle**

---

## CONCLUSION

This human-AI team structure is **powerful** when executed with discipline:

- **Clear roles** prevent overlap and confusion
- **Detailed handoffs** ensure continuity across sessions
- **Architecture constitution** maintains long-term integrity
- **Phased approach** manages complexity and delivers incremental value
- **Comprehensive documentation** preserves knowledge and rationale

By adhering to these principles, this team can operate with the **clarity, discipline, and foresight** of a much larger, traditional development team.

**We have:**
- ✅ A powerful vision (first-class collections)
- ✅ A solid plan (6-phase roadmap)
- ✅ A capable team (human + AI specialists)
- ✅ A constitution (this document + architecture doc)

**This structure enables us to execute effectively.**

---

**Next Step:** Begin Phase 0 (Collection Management) with full adherence to these principles.

**Remember:** Documentation is not overhead—it's the multiplier that makes this team work.

---

*"Success depends on each member excelling in their role and interacting effectively."*
— Principal Architect
