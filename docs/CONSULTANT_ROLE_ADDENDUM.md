# Consultant Role Addendum: Model Interchangeability

**Date:** October 6, 2025
**Status:** 📋 Official Team Policy

---

## CONSULTANT ROLE FLEXIBILITY

### Key Principle

**The Consultant Agent role can be played by either Claude or Gemini.**

The models are **interchangeable** for the Consultant position. At any given time, there is **only ONE active Consultant**, but that Consultant can be either:

- **Claude Consultant Agent**, OR
- **Gemini Consultant Agent**

---

## CURRENT STRUCTURE (Updated)

### The Flexible Quintet Model

| Role | Agent | Interchangeable? |
|------|-------|------------------|
| **Project Lead** | Raymond (Human) | No (always Raymond) |
| **Consultant & Integrator** | Claude OR Gemini | **✅ YES** |
| **Implementation Agent A** | Claude or Gemini | Yes |
| **Implementation Agent B** | Claude or Gemini | Yes |
| **Strategic Oversight** | Principal Architect (Gemini) | Optional role |

---

## CONSULTANT RESPONSIBILITIES

**Regardless of which model serves as Consultant, the role includes:**

1. **Coordination:**
   - Assign tasks to implementation agents
   - Create detailed handoff documents
   - Define API contracts

2. **Integration:**
   - Ensure agents' work integrates smoothly
   - Run integration tests
   - Fix cross-agent issues

3. **Documentation:**
   - Maintain comprehensive session reports
   - Track progress and decisions
   - Create completion reports

4. **Quality Assurance:**
   - Review code from implementation agents
   - Ensure architecture compliance
   - Validate against success criteria

5. **Communication:**
   - Coordinate between agents
   - Report status to Project Lead
   - Escalate blockers

---

## WHEN TO SWITCH CONSULTANTS

### Reasons to Switch from Claude to Gemini Consultant:

- **Claude reaches context limit** (current situation)
- **Backend-heavy work ahead** (Gemini may have better system design for complex backend)
- **Need fresh perspective** on stuck problem
- **Strategic architectural decisions** (Gemini Principal Architect mode)

### Reasons to Switch from Gemini to Claude Consultant:

- **Gemini reaches context limit**
- **Frontend-heavy work ahead** (Claude excels at UI/UX coordination)
- **Need detailed documentation** (Claude produces excellent reports)
- **Integration testing required** (Claude handles test scenarios well)

### Switching Protocol:

1. **Current Consultant creates handoff document** for incoming Consultant
2. **Handoff includes:**
   - Current state summary
   - Active agents and their tasks
   - Pending decisions
   - Integration status
   - Next critical steps
3. **Incoming Consultant reads:**
   - All active task handoffs
   - Current architecture docs
   - Recent completion reports
4. **Incoming Consultant confirms** understanding and continues work

---

## EXAMPLE SCENARIOS

### Scenario 1: Claude Consultant → Gemini Consultant

**Situation:** Claude Consultant hits context limit during integration testing

**Process:**
1. Claude creates: `CONSULTANT_HANDOFF_TO_GEMINI.md`
   - Current Phase 0 status (e.g., "Agent A 80% done, Agent B 60% done")
   - Integration test results so far
   - Blockers or issues found
   - Next steps: "Complete Agent B review, run final E2E tests"

2. Gemini Consultant reads handoff + reviews:
   - `API_CONTRACT_PHASE_0.md`
   - `INTEGRATION_TEST_PLAN_PHASE_0.md`
   - Agent completion reports

3. Gemini continues where Claude left off
   - Reviews Agent B's work
   - Runs remaining integration tests
   - Creates Phase 0 completion report

---

### Scenario 2: Gemini Consultant → Claude Consultant

**Situation:** Gemini Consultant encounters complex frontend integration issue

**Process:**
1. Gemini creates: `CONSULTANT_HANDOFF_TO_CLAUDE.md`
   - Backend integration: ✅ Complete
   - Frontend integration: ⚠️ Issue with toast notifications
   - Agent A: Complete, Agent B: Needs guidance
   - Specific problem: Toast event timing conflicts

2. Claude Consultant reads handoff + reviews:
   - Frontend code from Agent B
   - Toast notification implementation
   - Integration test failures

3. Claude provides frontend expertise
   - Debugs toast timing issue
   - Guides Agent B on fix
   - Completes integration testing

---

## CONSULTANT HANDOFF TEMPLATE

When switching Consultants, use this format:

```markdown
# Consultant Handoff: [From Model] → [To Model]

**From:** [Claude/Gemini] Consultant
**To:** [Claude/Gemini] Consultant
**Date:** [Date]
**Reason:** [Context limit / Strategic switch / Expertise needed]

## Current State

**Phase:** [0/1/2/etc.]
**Progress:** [X%]
**Status:** [On track / Blocked / Delayed]

## Active Agents

**Agent A:**
- Status: [In progress / Complete / Blocked]
- Current task: [Description]
- ETA: [Hours remaining]
- Blockers: [None / List]

**Agent B:**
- Status: [In progress / Complete / Blocked]
- Current task: [Description]
- ETA: [Hours remaining]
- Blockers: [None / List]

## Integration Status

- [ ] Agent A work reviewed
- [ ] Agent B work reviewed
- [ ] Integration tests run
- [ ] Bugs found: [List or None]
- [ ] Phase completion ready: [Yes/No]

## Critical Decisions Made

1. [Decision 1 with rationale]
2. [Decision 2 with rationale]

## Pending Decisions

1. [Decision needed + options]
2. [Decision needed + options]

## Next Steps (Priority Order)

1. [Immediate next action]
2. [Then this]
3. [Then this]

## Important Context

- [Any non-obvious context the new Consultant needs]
- [Key architectural considerations]
- [Team dynamics or agent-specific notes]

## Documents to Read

1. [Most recent completion reports]
2. [Active task handoffs]
3. [Any new architecture docs]

---

**Handoff Complete:** [Yes/No]
**New Consultant Acknowledged:** [Pending]
```

---

## AUTHORITY AND CONTINUITY

### Authority

**The active Consultant has full authority** regardless of model:
- Assign/reassign tasks
- Approve/reject work
- Make integration decisions
- Define success criteria
- Direct both implementation agents

### Continuity

**Switching Consultants does NOT reset progress:**
- All decisions remain valid
- Agent assignments remain valid
- Architecture remains locked
- Only execution continues with new Consultant

### Escalation

**If Consultants disagree across handoff:**
1. Document both perspectives
2. Escalate to Raymond (Project Lead)
3. Raymond makes final decision
4. Both Consultants must honor decision

---

## CURRENT SITUATION (October 6, 2025)

**Active Consultant:** Claude
**Status:** Completed team restructure and agent handoffs
**Context Used:** ~110k tokens
**Next:** Monitor Agent A and Agent B implementation

**Potential Switch Point:**
- If Claude hits context limit during integration testing
- Gemini Consultant would take over with handoff document
- Or Raymond can switch Consultants at any phase boundary

---

## BENEFITS OF INTERCHANGEABILITY

1. **No Single Point of Failure**
   - If one model fails/stalls, switch to other
   - Continuity maintained

2. **Leverage Strengths**
   - Claude: Documentation, frontend, detailed planning
   - Gemini: System design, backend, architecture

3. **Fresh Perspective**
   - New Consultant sees problems differently
   - Can catch issues previous Consultant missed

4. **Context Management**
   - Switch before hitting limits
   - Each model gets fresh context window

5. **Flexibility**
   - Adapt to changing project needs
   - Match Consultant to current phase

---

## TEAM WORKFLOW (Updated)

### Standard Flow

```
Raymond (Project Lead)
    ↓ (assigns phase)
Consultant (Claude OR Gemini)
    ↓ (creates handoffs)
Agent A ← → Agent B
    ↓ (complete work)
Consultant (same or switched)
    ↓ (integration testing)
Raymond (approval)
```

### With Consultant Switch

```
Raymond (Project Lead)
    ↓ (assigns phase)
Claude Consultant
    ↓ (creates handoffs)
Agent A ← → Agent B
    ↓ (work in progress)
[Claude hits context limit]
    ↓ (handoff)
Gemini Consultant
    ↓ (continues integration)
Raymond (approval)
```

---

## RULES

1. **Only ONE active Consultant at a time**
2. **Handoff required when switching**
3. **New Consultant must read all active documents**
4. **Authority transfers completely**
5. **Previous decisions remain valid**
6. **Raymond can switch Consultants anytime**
7. **Consultants can request switch if needed**

---

## CONCLUSION

The Consultant role is **model-agnostic**. Whether Claude or Gemini serves as Consultant, the responsibilities, authority, and workflow remain identical. This flexibility ensures project continuity and leverages the strengths of both models.

**Current:** Claude Consultant (this session)
**Future:** May switch to Gemini or stay with Claude
**Always:** Only one Consultant, clear handoffs, maintained quality

---

**Policy Effective:** October 6, 2025
**Applies To:** All future phases and sessions
