# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Nexus is an AI-powered visual knowledge workspace that transforms scattered thoughts into an interconnected knowledge graph. The system combines infinite canvas visualization, intelligent content analysis, and cross-platform synchronization.

## Architecture

**Monorepo Structure:**
- `backend/` - Node.js GraphQL API with Auth0 authentication
- `clients/web/` - Next.js 14 web application
- `clients/app/` - Flutter mobile app (future implementation)
- `database/` - PostgreSQL with pgvector extension setup
- `redis/` - Redis cache configuration

**Key Technologies:**
- Backend: Node.js, GraphQL (Apollo Server), PostgreSQL + pgvector, Redis, Auth0
- Frontend: Next.js 14, TypeScript, Tailwind CSS, Konva.js (canvas), Zustand (state)
- Infrastructure: Docker Compose for local development

## Testing

**Backend Testing:**
- Uses Jest with ts-jest preset
- Test files: `src/__tests__/**/*.test.ts`
- Comprehensive test suite includes unit, integration, and security tests
- Coverage target: 90%+ for core services
- Mock Auth0 for development testing

**Frontend Testing:**
- Uses Jest with Next.js configuration
- Test files: `**/__tests__/**/*.test.{ts,tsx}`
- React Testing Library for component tests
- Includes tests for hooks, components, and API integration

## Key Architectural Patterns

**Authentication Flow:**
- Auth0 integration with Universal Login
- Development mode authentication for testing
- JWT token validation via Auth0 JWKS

**State Management:**
- Backend: GraphQL resolvers with service layer pattern
- Frontend: Zustand for client state, React Query for server state
- Database: Knex.js query builder with PostgreSQL

**Testing Strategy:**
- Server-side state management (no localStorage dependency)
- Enum case conversion handling (frontend uppercase, backend lowercase)
- Cross-platform consistency validation

## Linear Ticket Workflow

When working on tickets from Linear, follow this comprehensive workflow to ensure proper tracking and delivery:

### 1. Ticket Selection and Setup
```bash
# Find the next ticket in backlog
# Linear Team: "Project Nexus" (prefix: NEX)
# Always work on the highest priority ticket unless specified otherwise
```

### 2. Branch Creation and Ticket Updates
```bash
# Create feature branch with NEX ticket number
git checkout -b feature/nex-[NUMBER]-[descriptive-name]

# Example: git checkout -b feature/nex-91-create-canvas-state-management-system
```

**Linear ticket management:**
- Update ticket status to **"In Progress"** when starting work
- Add initial comment with implementation plan and progress tracking
- Always update ticket state and properties throughout development

### 3. Implementation Process
- Create TodoWrite list for complex tasks to track progress
- Follow acceptance criteria exactly as specified in Linear ticket
- Implement features incrementally with meaningful commits
- Add progress comment to Linear ticket showing current status and update it through the implementation process
- Write tests for critical functionality (aim for comprehensive coverage)

### 4. Code Quality Standards
```bash
# Always run before committing
npm run type-check     # TypeScript compilation check
npm run lint           # ESLint validation
npm test               # Run test suite
```

### 5. Commit and PR Creation
```bash
# Commit with clear reference to ticket
git add -A
git commit -m "feat: implement [feature description] (NEX-[NUMBER])

[Detailed commit message with:]
- Clear description of changes
- Technical implementation details
- Features completed
- Any breaking changes or dependencies"

# Push and create PR
git push -u origin feature/nex-[NUMBER]-[descriptive-name]
gh pr create --title "feat: implement [feature] (NEX-[NUMBER])" --body "[comprehensive PR description]"
```

### 6. PR and Ticket Finalization
**Linear ticket workflow:**
- Move ticket to **"In Review"** when PR is created
- Add PR link to Linear ticket
- Update ticket to **"Done"** only AFTER PR is merged
- Add final comment with implementation summary

**PR requirements:**
- Comprehensive description with summary, technical details, and test plan
- Link to Linear ticket (NEX-[NUMBER])
- Clear acceptance criteria completion checklist
- Ready for review and approval

### 7. Merge and Completion
```bash
# After PR approval, merge to main
gh pr merge [NUMBER] --squash --delete-branch
```

**Post-merge:**
- Update Linear ticket to "Done" with completion summary
- Document any follow-up tasks or dependencies
- Archive feature branch (deleted automatically with --delete-branch)

### Example Complete Workflow
```bash
# 1. Create branch
git checkout -b feature/nex-91-create-canvas-state-management-system

# 2. Update Linear (via MCP)
# - Status: "In Progress"
# - Comment: Implementation plan

# 3. Implement with commits
git commit -m "feat: implement canvas state management system (NEX-91)"

# 4. Quality checks
npm run type-check && npm run lint && npm test

# 5. Push and PR
git push -u origin feature/nex-91-create-canvas-state-management-system
gh pr create --title "feat: implement canvas state management system (NEX-91)"

# 6. Update Linear
# - Status: "In Review" 
# - Add PR link

# 7. Merge after approval
gh pr merge 19 --squash --delete-branch

# 8. Complete Linear ticket
# - Status: "Done"
# - Final summary comment
```

## Important Development Guidelines

- **Docker**: Never start docker-compose yourself - always ask the user to do it
- **Environment**: .env files are at root level, set through docker-compose
- **Testing**: Always write tests before implementing a new feature; when updating existing code always run the tests to check if anything broke.
- **Linear Integration**: When using Linear MCP to move tasks to backlog, remove them from markdown feature documentation files
- **Code Style**: Follow existing patterns, use TypeScript strictly, maintain test coverage
- **Linear Workflow**: Always update ticket state and properties throughout development process
- **Agent Usage**: Try to always use the correct sub agent, when working on a process e.g. using the senior backend agent when working on the backend
- never implement development versions of features that mock the real implementation, unless otherwise stated.
- **Documentation**: All documentation is now stored in Notion. Create new documentation in Notion and link to specific documentation in code comments when relevant.

## Documentation in Notion

**All project documentation has been migrated to Notion and should be accessed via the Notion MCP server.**

### Using Notion MCP for Documentation Lookup

When you need to find or reference documentation:

```typescript
// Use notion-search to find relevant documentation
mcp__notion__notion-search with query: "canvas default fix"
mcp__notion__notion-search with query: "apollo testing guide"
mcp__notion__notion-search with query: "design system buttons"

// Use notion-fetch to get full content of specific documents
mcp__notion__notion-fetch with id: "[page-id-from-search]"
```

### Linking Code to Documentation

**IMPORTANT**: When working with code that has related documentation, include Notion links or page names in comments:

```typescript
// Related documentation: "GraphQL Subscriptions Status" in Notion
// This feature is currently disabled - see Notion doc for re-enabling steps
const subscriptionsDisabled = true;

// Canvas default setting implementation
// See: "Canvas Default Fix Documentation" in Notion for transaction safety details
function setCanvasDefault(canvasId: string) {
  // implementation
}

// Button component implementation
// Design specs: "Button Components" in Notion Design System
export const Button = ({ variant, size, ...props }) => {
  // implementation
}
```

### Documentation Structure in Notion

**Main Documentation Sections:**
- **Project Nexus** (Main page) - Project overview and elevator pitch
- **📋 Technical Documentation** - Development guides, fixes, and technical specs
- **🎨 Design Documentation** - Complete design system, features, and guidelines
- **📊 Project Documentation** - Product requirements and technical architecture

### Key Documentation Pages in Notion

- **Project Overview**: "Project Nexus" main page
- **Technical Guides**:
  - "Apollo GraphQL Testing Guide"
  - "Canvas Default Fix Documentation"
  - "GraphQL Subscriptions Status"
- **Design System**:
  - "Complete Style Guide"
  - "Button Components"
  - "Knowledge Card Components"
  - "Color System"
  - "Typography System"
- **Product Specifications**:
  - "Product Manager Output"
  - "Technical Architecture"