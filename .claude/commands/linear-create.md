# Claude Command: Linear Ticket Creation

This command automatically creates comprehensive Linear tickets from your planning discussions, transforming ideas into actionable development tasks with proper structure and documentation.

## Usage

To create tickets from your most recent planning discussion:
```
/linear-create
```

With optional parameters:
```
/linear-create --project "Infinite Canvas"
/linear-create --priority high
/linear-create --split-complexity
/linear-create $ARGUMENTS
```

## What This Command Does

1. **Analyzes Recent Conversation**
   - Reviews the planning discussion in the current conversation
   - Identifies features, improvements, or tasks discussed
   - Extracts technical requirements and architectural decisions

2. **Intelligently Structures Tickets**
   - Breaks down complex features into main tickets and subtasks
   - Creates parent-child relationships for related work
   - Determines appropriate ticket hierarchy and dependencies

3. **Generates Comprehensive Tickets**
   - Creates detailed descriptions with markdown formatting
   - Includes objectives, scope, success criteria, and technical considerations
   - Adds appropriate labels based on content analysis
   - Sets initial status to "Backlog" for prioritization

4. **Smart Project Assignment**
   - Checks if tickets fit existing projects (Infinite Canvas, Mobile App, etc.)
   - Creates general-purpose tickets if no specific project matches
   - Maintains project scope and goals alignment

## Command Parameters

- `$ARGUMENTS`: Optional text to guide ticket creation or specify focus areas
- `--project <name>`: Force assignment to a specific project
- `--priority <level>`: Set priority (high, medium, low)
- `--split-complexity`: Automatically break complex features into multiple tickets

## Workflow Example

**Planning Discussion:**
"Let's implement Sentry error tracking for both frontend and backend. We need comprehensive monitoring, alerts, and integration with our existing workflow."

**Command Execution:**
```
/linear-create
```

**Result:**
- **NEX-XXX**: Implement Sentry Error Tracking for Backend (Priority: High)
- **NEX-XXY**: Implement Sentry Error Tracking for Frontend (Priority: High)
- **NEX-XXZ**: Configure Sentry Alerts and Integrations (Priority: Medium, Parent: NEX-XXX)
- **NEX-XXA**: Set Up Sentry Release Tracking and Source Maps (Priority: Medium, Parent: NEX-XXX)

## Ticket Structure Template

Each generated ticket follows this comprehensive structure:

### Overview
Clear description of what needs to be implemented

### Objective
Specific goal and value proposition

### Scope
Detailed breakdown of work included:
- Core functionality
- Integration requirements
- Performance considerations
- Security aspects

### Success Criteria
Measurable outcomes that define completion

### Technical Considerations
Architecture decisions, compatibility requirements, and implementation notes

### Dependencies
Required prerequisites and related tickets

### Out of Scope
Explicitly excluded items to prevent scope creep

## Best Practices

### Planning Discussions
- Be specific about features and requirements
- Discuss technical constraints and dependencies
- Mention priority levels or urgency
- Include success metrics when possible

### Ticket Quality
- Each ticket should be independently valuable
- Scope should be completable in 1-2 weeks
- Include enough detail for implementation
- Define clear acceptance criteria

### Project Organization
- Related tickets are linked via parent-child relationships
- Labels help categorize and filter work
- Priorities reflect business value and dependencies
- Status progression follows team workflow

## Advanced Features

### Automatic Label Assignment
The command analyzes content and automatically applies relevant labels:
- **backend** - Node.js, GraphQL, database work
- **frontend** - Next.js, React, UI components
- **infrastructure** - DevOps, monitoring, deployment
- **testing** - Test automation, QA processes
- **documentation** - Docs, guides, specifications

### Priority Intelligence
Priorities are assigned based on discussion context:
- **High**: Security, critical bugs, foundational features
- **Medium**: Enhancements, integrations, developer tools
- **Low**: Nice-to-have features, optimizations

### Complexity Splitting
Large features are automatically broken down into:
1. **Foundation ticket**: Core implementation
2. **Integration tickets**: System connections
3. **Enhancement tickets**: Advanced features
4. **Configuration tickets**: Setup and tooling

## Integration with Project Nexus Workflow

The `/linear` command is designed to work seamlessly with the Project Nexus development process:

1. **Planning Phase**: Use during feature discussions and architecture planning
2. **Ticket Creation**: Generate comprehensive tickets with one command
3. **Development**: Reference ticket IDs in branches and commits
4. **Tracking**: Monitor progress through Linear's project views

## Command Behavior

When you execute `/linear-create`, Claude will:

1. **Use TodoWrite** to track the ticket creation process
2. **Analyze the conversation** for feature descriptions and requirements
3. **List existing projects** to determine appropriate assignment
4. **Create tickets systematically** using the Linear MCP server
5. **Establish relationships** between parent and child tickets
6. **Provide a summary** with ticket IDs and Linear URLs

## Examples

### Single Feature Implementation
```
/linear-create
```
*After discussing a specific feature like "add dark mode toggle"*

Result: Single ticket with comprehensive scope and implementation details

### Complex System Integration
```
/linear-create --split-complexity
```
*After discussing "implement real-time collaboration"*

Result: Multiple related tickets covering:
- WebSocket infrastructure
- Conflict resolution
- UI indicators
- Testing strategy

### Project-Specific Work
```
/linear-create --project "Infinite Canvas"
```
*After discussing canvas performance improvements*

Result: Tickets assigned to the Infinite Canvas project with appropriate context

## Important Notes

- **Conversation Context**: The command works best after detailed planning discussions
- **Project Alignment**: Tickets are aligned with existing project goals and architecture
- **Team Workflow**: All tickets are created in "Backlog" status for team prioritization
- **Comprehensive Documentation**: Each ticket includes sufficient detail for implementation
- **Dependency Tracking**: Related work is properly linked through ticket relationships

## Tips for Better Results

1. **Be Specific**: Detailed discussions produce better-structured tickets
2. **Include Technical Details**: Architecture decisions improve ticket quality
3. **Mention Constraints**: Time, resource, or technical limitations help scope appropriately
4. **Discuss Success Metrics**: Clear outcomes improve ticket acceptance criteria
5. **Consider Dependencies**: Mention related systems or prerequisite work

---

Transform your planning discussions into actionable development work with the `/linear-create` command. From high-level feature ideas to detailed implementation tickets, streamline your workflow and maintain comprehensive project documentation.

Ready to create Linear tickets? Start planning your next feature and use `/linear-create` when you're ready to formalize the work!