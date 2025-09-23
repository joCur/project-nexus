# /linear-task-start

Analyzes a Linear parent ticket and its subtasks to determine the optimal implementation order and prepare a comprehensive implementation plan.

## Usage
```
/linear-task-start <ticket-id>
```

Example: `/linear-task-start NEX-109`

## Description
This command automates the workflow for implementing Linear tickets by:
1. Fetching the parent ticket and all subtasks from Linear
2. Analyzing dependencies and priorities to determine optimal order
3. Reviewing relevant codebase context
4. Identifying required specialist agents for implementation
5. Presenting a comprehensive implementation plan for approval
6. After approval, delegating all implementation work to appropriate agents
7. Coordinating the workflow and managing progress
8. Updating Linear tickets throughout the process

**IMPORTANT**: When executing this command, you will:
- **NEVER write code directly** - always delegate to specialized agents
- **Act only as a coordinator** - oversee progress and quality
- **Use Task tool extensively** - delegate all implementation to appropriate agents
- **Focus on orchestration** - manage the workflow between different agents
- **Review and test only** - verify agent outputs meet requirements
- **Update Linear continuously** - keep tickets synchronized with progress

## Workflow

### 1. Ticket Analysis Phase
- Fetch parent ticket details from Linear using `mcp__linear-server__get_issue`
- Query all subtasks (both open and in-progress) using `mcp__linear-server__list_issues`
- If no subtasks exist, work directly on the parent ticket
- **IMPORTANT**: Only ONE subtask will be worked on at a time - subsequent tasks are out of scope

### 2. Priority Determination
The command evaluates subtasks based on:
- **Priority levels**: Urgent > High > Medium > Low
- **Dependencies**: Tasks marked as prerequisites must be done first
- **Status**: Focus on "Todo" and "Backlog" items, skip completed
- **Technical dependencies**: Analyze task descriptions for "Dependencies:" or "Requires:" sections

Priority rules:
1. CRITICAL or blocking tasks always go first
2. Tasks with no dependencies before those with dependencies
3. Within same priority level, foundational work (e.g., rendering) before enhancements
4. Infrastructure before features, features before optimizations

**IMPORTANT**: Only the FIRST priority subtask will be implemented. All other subtasks are out of scope and will need separate /linear-task-start commands after the first is complete.

### 3. Codebase Context Review
Automatically review relevant files based on the ticket domain:
- For card features: Check `stores/cardStore.ts`, `types/card.types.ts`, `components/canvas/`
- For canvas features: Check `components/canvas/`, `hooks/useCanvas*.ts`
- For backend features: Check `backend/src/services/`, GraphQL operations
- Look for existing patterns, stubs, and TODOs that relate to the feature

### 4. Agent Identification & Delegation Strategy
Based on ticket requirements, determine which specialist agents are needed and delegate ALL implementation:

**Available Specialist Agents:**
- **senior-frontend-engineer**: React components, state management, UI logic, hooks, Zustand stores
- **senior-backend-engineer**: GraphQL resolvers, database operations, API endpoints, migrations
- **qa-test-automation-engineer**: Unit tests, integration tests, E2E tests, test coverage
- **ux-ui-designer**: Design system compliance, user experience, component styling
- **security-analyst**: Auth validation, data sanitization, security vulnerabilities
- **debug-specialist**: Performance issues, bug fixes, error diagnosis
- **devops-deployment-engineer**: Docker configs, CI/CD, infrastructure changes
- **system-architect**: Technical specifications, API contracts, data models
- **product-manager**: Requirements clarification, user stories, acceptance criteria

**Delegation Rules:**
1. **Never implement directly** - Use Task tool to delegate to appropriate agent
2. **Parallel execution** - Launch multiple agents simultaneously when tasks are independent
3. **Clear instructions** - Provide agents with specific files, line numbers, and requirements
4. **Quality gates** - After each agent completes, run tests and linting before proceeding
5. **Agent chaining** - Frontend work → QA tests → Security review

### 5. Implementation Plan Structure
The command generates a plan for ONLY the first priority subtask with:
- **Single task focus** - Only the highest priority subtask to be implemented
- **Branch creation** - New feature branch for this specific subtask
- **Current state analysis** showing what exists vs what needs creation
- **Agent delegation strategy** for this single task
- **Success criteria** from ticket acceptance criteria
- **Testing requirements** for the component
- **Completion workflow** - Including commit, PR, merge, and Linear update

## Output Format

```markdown
## Implementation Plan for [SUBTASK-ID]: [Title]

### Single Task Focus
**[SUBTASK-ID]** - [Title] (Priority: [Level])
[Reasoning why this is the highest priority subtask]

**Note**: Only this single subtask will be implemented. After completion (commit, PR, merge), run /linear-task-start again for the next subtask.

### Branch Creation
```bash
git checkout -b feature/[subtask-id]-[descriptive-name]
```

### Current Codebase State
- ✅ Existing: [List what's already implemented relevant to this task]
- 🔧 Stubs: [List stub methods ready for implementation]
- ❌ Missing: [List what needs to be created for this task]

### Implementation Plan

#### Task: [SUBTASK-ID] - [Name]
**Linear Actions**:
- Update [SUBTASK-ID] to "In Progress"
- Add comment with implementation plan

**Agent Delegation**:
```
Primary Implementation → senior-frontend-engineer:
  "Create CardLayer component at components/canvas/CardLayer.tsx
   that renders all cards from cardStore"

Testing → qa-test-automation-engineer:
  "Write tests for CardLayer component including rendering,
   selection, and performance tests"
```

**Key Files**:
- To Create: [List of new files]
- To Update: [List of existing files]

### Testing Strategy
- Unit tests for: [Components/functions]
- Integration tests if needed: [Features]

### Completion Workflow

**After Implementation:**
1. **Quality checks**: `npm run type-check && npm run lint && npm test`
2. **Commit changes**: `git commit -m "feat: [description] ([SUBTASK-ID])"`
3. **Push branch**: `git push -u origin feature/[subtask-id]-[name]`
4. **Create PR**: `gh pr create --title "feat: [description] ([SUBTASK-ID])"`
5. **Update Linear**: Move to "In Review", add PR link
6. **After merge**: Update to "Done" with completion summary

### Next Steps (Out of Scope)
After this subtask is complete and merged:
- Run `/linear-task-start [PARENT-ID]` again to work on the next priority subtask
- The next subtask will get its own branch and implementation cycle
```

## Implementation Logic

The command follows this workflow:

### Step 1: Initialize Tracking
Create a TodoWrite list to track progress:
- Fetch parent ticket from Linear
- Identify highest priority subtask
- Review codebase context for that specific task
- Identify required agents for the single task
- Generate implementation plan for one subtask only

### Step 2: Fetch Ticket Data
- Get parent ticket details using `mcp__linear-server__get_issue`
- List all subtasks using `mcp__linear-server__list_issues`
- Include both "Todo" and "In Progress" status tickets

### Step 3: Determine Single Priority Task
Select ONLY the highest priority task based on:
- **Critical/Blocking**: Tasks marked "CRITICAL" always go first
- **Dependencies**: Check for "Dependencies:" or "Requires:" in descriptions
- **Priority Level**: Urgent → High → Medium → Low
- **Technical Order**: Infrastructure before features
- **STOP**: Only select ONE task - all others are out of scope

### Step 4: Create Feature Branch
Create a new branch specifically for this single subtask:
```bash
git checkout -b feature/[subtask-id]-[descriptive-name]
```

### Step 5: Analyze Codebase for Single Task
Review relevant files based on the specific subtask domain:
- Card features: `stores/cardStore.ts`, `types/card.types.ts`
- Canvas features: `components/canvas/`, `hooks/useCanvas*.ts`
- Backend features: `backend/src/services/`, GraphQL operations

### Step 6: Identify Required Agents for Single Task
Map the single task to specialist agents based on requirements:
- Frontend components → `senior-frontend-engineer`
- Backend/API → `senior-backend-engineer`
- Testing → `qa-test-automation-engineer`
- Design compliance → `ux-ui-designer`

### Step 7: Generate Single Task Implementation Plan
Create structured plan for ONE subtask with:
- Branch creation command
- Agent delegation strategy for this task
- Files to create and update
- Testing requirements
- Complete workflow including commit, PR, and merge

### Step 8: Present Plan for Approval
Output the single-task plan and wait for user confirmation before proceeding.

**After approval, you will coordinate implementation by:**
1. Create feature branch for this specific subtask
2. Update Linear subtask to "In Progress" immediately
3. Delegate all code writing to specialist agents
4. Add progress comments to Linear for this subtask
5. Review agent outputs for quality
6. Run tests and linting after implementation
7. Commit with reference to subtask ID
8. Create PR with subtask ID in title
9. Move subtask to "In Review" when PR is created
10. Update subtask to "Done" only after PR is merged
11. **STOP** - Do not proceed to next subtask

## Examples

### Example 1: Parent with Subtasks
```
/linear-task-start NEX-109

Output:
## Implementation Plan for NEX-192: Implement Visual Card Rendering on Canvas

### Single Task Focus
**NEX-192** - Implement Visual Card Rendering on Canvas (Priority: Urgent)
Must be completed first as all other subtasks depend on cards being visible.

**Note**: Only this single subtask will be implemented. After completion, run /linear-task-start NEX-109 again for the next subtask.

### Branch Creation
```bash
git checkout -b feature/nex-192-visual-card-rendering
```

### Implementation Plan
[Details for ONLY NEX-192...]

### Next Steps (Out of Scope)
After NEX-192 is complete and merged:
- Run `/linear-task-start NEX-109` again to work on NEX-193
```

### Example 2: Standalone Ticket
```
/linear-task-start NEX-150

Output:
## Implementation Plan for NEX-150: Add Dark Mode Support

### Single Task Focus
**NEX-150** - Add Dark Mode Support (Priority: Medium)
No subtasks found. Implementing parent ticket directly.

### Branch Creation
```bash
git checkout -b feature/nex-150-dark-mode-support
```

### Current Codebase State
- ✅ Existing: Tailwind CSS with dark: variants configured
- ✅ Existing: Theme provider in _app.tsx
[...]
```

## Best Practices

1. **One subtask at a time** - Complete and merge before starting next
2. **Always create new branch** - Each subtask gets its own feature branch
3. **Delegation is mandatory** - Never write code yourself, always use Task tool with agents
4. **Linear updates are required** - Update ticket status and add comments throughout implementation
5. **Complete workflow** - Commit, PR, merge before moving to next task
6. **Always check dependencies** - Read task descriptions for explicit dependencies
7. **Consider technical order** - Infrastructure before features
8. **Identify blockers early** - Surface any missing prerequisites and update Linear
9. **Plan for testing** - Include test implementation for the single task
10. **Track progress in Linear** - Add comments after implementation complete
11. **Quality checks after agents** - Always run `npm run type-check`, `npm run lint`, and tests
12. **Clear agent instructions** - Provide specific file paths, line numbers, and requirements
13. **PR workflow** - Update ticket to "In Review" when PR created, "Done" after merge
14. **Stop after completion** - Do not automatically continue to next subtask

## Error Handling

- If ticket not found: "Error: Ticket [ID] not found. Please check the ticket ID."
- If no access: "Error: Unable to access Linear. Please check MCP connection."
- If circular dependencies: "Warning: Circular dependency detected between [IDs]"