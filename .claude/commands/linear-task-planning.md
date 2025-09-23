# /linear-task-planning

Breaks down a Linear ticket into detailed implementation sub-tasks by analyzing requirements and existing codebase.

## Usage
```
/linear-task-planning <ticket-id>
```

**Example:** `/linear-task-planning NEX-109`

## Description

This command automates the process of taking a complex Linear ticket and breaking it down into detailed, actionable sub-tasks with comprehensive implementation plans. It analyzes both the ticket requirements and the existing codebase to create realistic, well-documented sub-tasks.

## Process

When this command is invoked with a Linear ticket ID, Claude will automatically:

### 1. Fetch and Analyze the Ticket
- Use `mcp__linear-server__get_issue` to get full ticket details
- Extract acceptance criteria and technical requirements
- Identify the scope and complexity of the feature

### 2. Comprehensive Codebase Analysis
Using Grep, Glob, and Read tools to discover:
- **Existing implementations** that can be reused
- **Related patterns and utilities** already in the codebase
- **Store structures and state management** relevant to the feature
- **GraphQL operations and mutations** that exist
- **UI components and patterns** to reference
- **Type definitions** that are already available
- **Performance utilities** like debouncing, batching, etc.
- **Error handling patterns** to follow

### 3. Identify Logical Sub-Tasks
Break down the main ticket into implementation units based on:
- Dependencies between components
- Logical development order
- Separation of concerns
- Testing requirements

### 4. Generate Detailed Sub-Task Documentation
For each sub-task, create comprehensive descriptions including:

#### What Already Exists (with specifics)
- Exact file paths and line numbers
- Existing methods and interfaces to reuse
- Patterns to follow from similar implementations
- Store state and methods available
- GraphQL operations already defined

#### What Needs to Be Created
- New files required with clear naming
- New methods to implement
- UI components needed
- Integration points

#### Implementation Requirements
- Technical specifications
- Performance requirements (<100ms feedback, etc.)
- Integration patterns
- Error handling approaches

#### Dependencies
- Which sub-tasks must be completed first
- How sub-tasks interact with each other
- Integration points between tasks

#### Acceptance Criteria
- Specific, testable requirements
- User experience expectations
- Performance benchmarks
- Accessibility requirements

#### Testing Requirements
- Unit test specifications
- Integration test needs
- Performance test criteria
- User interaction tests

### 5. Create Sub-Tasks in Linear
Use `mcp__linear-server__create_issue` to create each sub-task with:
- **Detailed descriptions** with all analysis included
- **Proper priorities** based on dependencies and importance
- **Parent link** to the original ticket
- **Appropriate labels** (Feature, Frontend, Backend, etc.)
- **Clear titles** that describe the specific work

## Example Output

The command produces sub-tasks similar to what was created for NEX-109:
- NEX-192: Implement Visual Card Rendering on Canvas (Priority: Urgent)
- NEX-193: Create Inline Editing Components for Cards (Priority: Urgent)
- NEX-194: Implement Auto-Save System for Card Edits (Priority: Urgent)
- NEX-195: Complete Undo/Redo System Implementation (Priority: High)
- NEX-196: Enhance Delete Confirmation System with Archive Support (Priority: High)
- NEX-197: Create Batch Operations UI for Multiple Card Actions (Priority: Medium)
- NEX-198: Complete Template System for Quick Card Creation (Priority: Low)
- NEX-199: Enhance Optimistic Updates with Conflict Resolution (Priority: Low)

## Benefits

1. **Thorough Analysis**: Every sub-task includes detailed information about existing code to reuse
2. **No Duplication**: Prevents reimplementing functionality that already exists
3. **Clear Dependencies**: Shows which tasks must be done in order
4. **Implementation Ready**: Each sub-task has enough detail to start coding immediately
5. **Consistent Quality**: Follows established patterns and maintains code quality
6. **Time Estimation**: Breaking down complex features helps with sprint planning

## Technical Implementation

This command leverages Claude's existing capabilities:
- **Linear MCP Server** for ticket and sub-task management
- **File System Tools** (Read, Glob, Grep) for codebase analysis
- **Code Analysis** capabilities to understand existing patterns
- **Technical Writing** skills to create comprehensive documentation
- **Project Management** understanding to organize work logically

No additional infrastructure or scripts are required - it uses only the tools already available in Claude Code.

## Notes

- Works best with tickets that have clear acceptance criteria
- More complex tickets will result in more detailed sub-task breakdowns
- The analysis quality depends on how well the codebase is documented and organized
- Can be used iteratively - run on sub-tasks if they need further breakdown