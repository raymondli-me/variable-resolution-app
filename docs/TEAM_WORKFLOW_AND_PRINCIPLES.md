# Team Workflow & Guiding Principles

**Author:** Principal Architect (Gemini)
**Date:** October 6, 2025
**Status:** 📋 Active Team Constitution
**Audience:** Raymond (Project Lead), Consultant Agent, Implementation Agent

---

## PURPOSE

This document establishes the guiding principles, role definitions, and best practices for the human-AI development team working on the Variable Resolution App (formerly VR Collector). It serves as the **team constitution** and must be consulted for all major architectural and implementation decisions.

---

## TEAM STRUCTURE

### The Human-AI Quintet Model

Our team operates as a disciplined, role-specialized quintet with clear separation of concerns:

| Role | Agent | Primary Responsibility |
|------|-------|------------------------|
| **Project Lead & Vision Holder** | Raymond (Human) | Sets direction, defines the "why," makes final strategic decisions, breaks ties |
| **Local Strategist** | Consultant Agent (Claude OR Gemini)* | Analyzes codebase, proposes architectural solutions, creates detailed implementation plans, coordinates parallel work |
| **Frontend Implementation** | Claude Implementation Agent | Translates plans into UI/frontend code, focuses on user-facing features |
| **Backend Implementation** | Gemini Implementation Agent | Translates plans into backend/data code, focuses on database and business logic |
| **External Architect** | Principal Architect (Gemini) | Provides high-level oversight, ensures long-term architectural integrity, validates direction |

**\*Consultant Interchangeability:** The Consultant Agent role can be played by either Claude or Gemini - only one is active at a time, but the model can be switched as needed. See `CONSULTANT_ROLE_ADDENDUM.md` for details.

**Success Formula:** Each member excels in their role + Clear interactions between roles + Parallel execution = Efficiency of a much larger team

### Parallel Implementation Strategy

**Two implementation agents working simultaneously:**

- **Claude (Frontend Specialist)**: UI components, user interactions, rendering, styles
- **Gemini (Backend Specialist)**: Database operations, business logic, data processing, algorithms

**Key Principles for Parallel Work:**
1. **No File Overlaps**: Each agent works on completely separate files
2. **Clear Boundaries**: Frontend vs Backend separation prevents conflicts
3. **API Contracts**: Consultant defines interfaces both agents implement to
4. **Independent Testing**: Each agent can test their work without the other
5. **Async Coordination**: Work proceeds independently, integrates at completion

---

## GUIDING PRINCIPLES

### 1. Maintain Strict Role Discipline and Clear Handoffs

**Principle:** Clarity of roles is our greatest asset. Blurring the lines leads to inefficient, overlapping work.

#### Consultant → Implementation Agent Handoff

**This is the most critical link in the workflow.**

As documented in `COMPREHENSIVE_SESSION_SITREP.md`, session reports must be exceptionally detailed. **This is our standard.**

**Every handoff document must include:**

1. **Clear Goal Statement**
   - What is the precise objective of this implementation phase?
   - What problem are we solving?

2. **File Manifest**
   - Which specific files are to be created?
   - Which files are to be modified?
   - What is the scope of changes?

3. **Schema Changes**
   - Database migrations formatted as executable SQL
   - Index creation statements
   - Data backfill requirements

4. **Core Logic**
   - Pseudocode for complex algorithms
   - Detailed descriptions of business logic
   - Edge cases and error handling

5. **Success Criteria**
   - Clear, testable definition of "done"
   - Acceptance criteria
   - Testing checklist

**Example Quality Bar:**
```markdown
## Handoff: Implement Folder Hierarchy System

### Goal
Create folder management system for organizing collections hierarchically.

### Files to Create
- src/services/folder-manager.js (folder CRUD operations)
- src/database/folder-methods.js (database layer)

### Files to Modify
- src/database/db.js (add folder methods)
- main.js (add IPC handlers)

### Schema Changes
```sql
CREATE TABLE folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_folder_id INTEGER REFERENCES folders(id),
  ...
);
```

### Success Criteria
- [ ] Can create nested folders
- [ ] Can move collections between folders
- [ ] Circular references prevented
- [ ] All tests pass
```

#### Implementation Agent → Consultant Handoff

**When a task is complete**, the Implementation Agent must:

1. **Reference the Original Plan**
   - "Completed handoff from [date/session]"
   - Link to original requirements

2. **Confirm Success Criteria Met**
   - Checklist of completed items
   - Test results

3. **Note Deviations or Challenges**
   - What unexpected issues arose?
   - What architectural decisions were made?
   - What technical debt was incurred?

This **closes the loop** and allows the Consultant to plan the next step.

---

### 2. The Architecture Document is Your Constitution

**Document:** `COLLECTIONS_FIRST_CLASS_ARCHITECTURE.md`

**Principle:** This document is not just a plan; it is the **constitution** for all future development.

#### Consulting All Decisions Against the Vision

Before the Consultant agent proposes a solution, it **must ask:**

> "Does this align with the principles of making Collections first-class, portable, and traceable objects?"

**Core Architectural Principles (from Constitution):**

1. **Collections as First-Class Objects**
   - Collections must be manipulable, derivable, and chainable
   - Support filter, sample, duplicate, merge operations
   - Maintain immutability through derived collections

2. **Database as File System**
   - Organize collections in hierarchical folders
   - Support archiving, starring, searching
   - Clean separation of active vs. archived work

3. **Import/Export Portability**
   - Standardized formats (JSON, ZIP, SQLite)
   - ID remapping for conflict-free imports
   - Share refined datasets across computers/collaborators

4. **Full Lineage Tracking**
   - Every collection knows its derivation history
   - `parent_collection_id`, `derivation_method`, `derivation_params`
   - Recursive lineage queries supported

5. **Unified Pipeline**
   - Seamless workflow: collect → rate → filter → BWS → export → share
   - Each operation produces a new derived collection
   - Provenance preserved at every step

#### No "Temporary" Hacks

The project's complexity requires **disciplined adherence** to the architecture.

**❌ AVOID:**
- Short-term fixes that violate core principles
- Storing analytical metadata directly in primary item tables
- Bypassing the `collection_items` intermediary table
- Hardcoding values that should be configurable
- Creating one-off solutions instead of generalizable patterns

**✅ INSTEAD:**
- Use the recommended `collection_items` table for scores/metadata
- Maintain separation between source data and analysis results
- Build extensible, future-proof solutions
- Follow established patterns from the architecture

#### Updating the Architecture Document

If a fundamental assumption in the architecture needs to change:

1. **This is a deliberate decision** made by Raymond (Project Lead)
2. **The document must be formally updated** with:
   - Rationale for the change
   - Impact analysis
   - Updated schemas/workflows
3. **The update must be committed to git** with clear commit message
4. **All team members must be notified** of the constitutional change

**Example:**
```
feat: Update collection architecture to support versioning

BREAKING CHANGE: Collections now support Git-like versioning.

Rationale: User feedback revealed need for "save points" during
analysis workflows. Rating the same collection multiple times
created ambiguity about which scores to use.

Impact: Adds `version` and `version_parent_id` columns to collections
table. All existing collections become version 1.

Updated: COLLECTIONS_FIRST_CLASS_ARCHITECTURE.md (Phase 5 advanced to Phase 4)
```

---

### 3. Prioritize the Implementation Roadmap Relentlessly

**Principle:** The roadmap is logical and sound: **Foundation First**.

#### Phase Ordering is Sacred

```
Phase 0: Collection Management (Week 0) ← START HERE
  ├─ Folder hierarchy
  ├─ Import/Export system
  ├─ Archive/star functionality
  └─ Why? Enables organization and collaboration from day one

Phase 1: Foundation (Week 1)
  ├─ Schema for derived collections
  ├─ collection_items table
  └─ Why? Infrastructure for all operations

Phase 2: Collection Operations (Week 2)
  ├─ Duplicate, Filter, Sample
  └─ Why? Core transformations

Phase 3: Rating Integration (Week 3)
  ├─ Rating creates derived collections
  └─ Why? Connects analysis to collections

Phase 4: BWS Integration (Week 4)
  ├─ BWS consumes/produces collections
  └─ Why? Completes the pipeline

Phase 5: Advanced Workflows (Week 5+)
  ├─ Versioning, templates, smart filters
  └─ Why? Polish and power features
```

#### Do Not Skip Phases

**Phase 0 delivers immediate, tangible value** to the end-user (the researcher):
- Organize collections by project/semester
- Archive old work without deleting
- Share datasets with collaborators
- Backup critical collections

**Resist the temptation** to jump to more "exciting" features (BWS improvements, AI enhancements) until this foundation is rock-solid.

**Why?**
- Collections are useless if you can't manage them
- Export/import enables collaboration and reproducibility
- Without organization, the database becomes a junkyard

#### Each Phase Builds on the Last

The phased approach **manages complexity** and ensures stability:
- Phase 0 infrastructure → Phase 1 uses folders in exports
- Phase 1 `collection_items` → Phase 2 operations reference it
- Phase 2 filter/sample → Phase 3 rating uses filtered collections
- Phase 3 rated collections → Phase 4 BWS consumes them

**Breaking this order creates technical debt and rework.**

---

### 4. Documentation is a Feature, Not a Task

**Principle:** The quality of documentation in this repository is exceptionally high. This is a **key success factor**.

#### Continue the "Sit Rep" Model

The detailed session reports (e.g., `COMPREHENSIVE_SESSION_SITREP.md`, `CONSULTANT_COMPREHENSIVE_REPORT.md`) are **invaluable** for:
- Knowledge transfer between sessions
- Debugging and troubleshooting
- Historical context for decisions
- Onboarding new team members (human or AI)

**Mandate:** This practice continues for every major feature implementation.

**Session Report Template:**

```markdown
# Session Report: [Feature Name]

**Date:** [Date]
**Agent:** Consultant / Implementation
**Status:** Planning / In Progress / Complete

## What Was Accomplished
- Bullet list of completed items

## Decisions Made
- Key architectural decisions with rationale

## Files Changed
- src/file1.js (added X functionality)
- src/file2.js (refactored Y)

## Schema Changes
```sql
ALTER TABLE ...
```

## Next Steps
- [ ] Task 1
- [ ] Task 2

## Blockers / Questions
- Any issues needing resolution
```

#### Document *Why*, Not Just *What*

The architectural documents excel at explaining **reasoning** behind decisions.

**Example from Architecture Doc:**
> **Option C (RECOMMENDED): Collections as Views + Provenance**
> - Collections reference items (many-to-many)
> - Metadata (scores) stored separately, linked via collection membership
> - Full lineage tracking
>
> **Why?** Preserves provenance, allows items in multiple collections, avoids coupling data to analysis.

This is **critical** for:
- Long-term maintenance
- Future developers understanding the project's philosophy
- Avoiding repeating past mistakes
- Making informed changes to the architecture

**Standard Practice:**

When proposing a solution with multiple options, always include:
1. **Option A, B, C** descriptions
2. **Pros/Cons** for each
3. **Recommendation** with clear rationale
4. **Trade-offs** being made
5. **Alternatives considered** and why rejected

#### Consultant's Duty of Record Keeping

**Principle:** The Consultant acts as the team's official scribe, ensuring all major decisions and work reviews are formally documented and accessible. This creates a single source of truth for project status and history.

**Mandate:** The Consultant Agent is explicitly responsible for:

1.  **Documenting Agent Performance:** After an Implementation Agent completes a significant task (feature or bug fix), the Consultant will conduct a formal review.
2.  **Creating Review Documents:** The outcome of this review will be published in a new, standalone document in the `/docs` folder (e.g., `REVIEW_OF_AGENT_A_BUG_FIX.md`).
3.  **Maintaining a Public Record:** These documents will clearly state the task, the quality of the work, the verdict (Approved/Rejected), and any lessons learned.
4.  **Ensuring Team Alignment:** This practice ensures the Project Lead, Principal Architect, and all agents are on the same page regarding progress, quality, and accountability.

This process of formal review and documentation is not optional; it is a core component of our team's strategy for ensuring quality and maintaining velocity.

---

## WORKFLOW PROTOCOL

This section defines the standard, multi-stage process for taking a feature from concept to completion.

### Phase 1: Planning (Consultant & Project Lead)

1.  **Concept:** The Project Lead (Raymond) defines a high-level goal.
2.  **Proposal:** The Consultant Agent analyzes the codebase and architecture, then proposes a detailed implementation plan, including handoff documents for implementation agents.
3.  **Approval:** The Project Lead reviews and approves the plan.

### Phase 2: Parallel Implementation (Implementation Agents)

1.  **Assignment:** The Consultant assigns tasks to the appropriate specialist agents (e.g., Agent A for Backend, Agent B for Frontend).
2.  **Execution:** Agents work in parallel on their assigned, non-conflicting tasks.
3.  **Completion:** Agents report completion and commit their work.

### Phase 3: Integration & Testing (Consultant-Led, Human-Executed)

1.  **Code Review:** The Consultant reviews the submitted code from all agents for quality and correctness.
2.  **Test Plan Creation:** The Consultant creates a detailed, step-by-step **Integration Test Plan** document.
3.  **Guided Testing:** The **Consultant coaches the Project Lead (Raymond) through executing the test plan.** Because testing involves visual UI confirmation and user workflows, the human is the ideal tester.
4.  **Logging:** The Consultant observes the outcomes and logs the results of each test step.
5.  **Decision:** Based on the results, the Consultant either:
    -   **Approves** the phase and moves to the next.
    -   **Rejects** the phase, creates new bug reports, and delegates them back to the implementation agents (returning to Phase 2).

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
