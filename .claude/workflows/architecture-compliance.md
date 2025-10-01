# Architecture Compliance Workflow

This workflow ensures all implementations conform to the Project Nexus Architecture Guide standards.

## When to Use This Workflow

Use this workflow for:
- Implementing new features
- Modifying existing components
- Adding new dependencies to components
- Refactoring code
- Before marking Linear tickets as complete
- Before creating pull requests

## Pre-Implementation Checklist

Before starting any implementation:

### 1. Review Architecture Guide
- [ ] Read relevant sections of `project-documentation/architecture-guide.md`
- [ ] Understand data flow requirements (Section 1)
- [ ] Review state management strategy (Section 2)
- [ ] Check enum standardization rules (Section 4)
- [ ] Review applicable patterns (Sections 6-8)

### 2. Plan Implementation
- [ ] Identify which architecture patterns apply
- [ ] Determine if new enums are needed (use TypeScript enum with lowercase values)
- [ ] Plan state management approach (Apollo vs Zustand)
- [ ] Identify service layer changes needed
- [ ] Plan GraphQL schema changes if required

### 3. Create TodoWrite List
For complex tasks (3+ steps), create a TodoWrite list:

```typescript
// Example TodoWrite structure for feature implementation:
[
  { content: "Write service layer tests (TDD)", status: "pending" },
  { content: "Implement service layer methods", status: "pending" },
  { content: "Write GraphQL resolver tests", status: "pending" },
  { content: "Implement GraphQL resolvers", status: "pending" },
  { content: "Write hook tests with Apollo mocks", status: "pending" },
  { content: "Implement custom hooks", status: "pending" },
  { content: "Write component tests", status: "pending" },
  { content: "Implement UI components", status: "pending" },
  { content: "Run architecture compliance verification", status: "pending" }
]
```

## Implementation Checklist

### Phase 1: Backend Development (TDD)

#### Service Layer
- [ ] **RED**: Write failing service layer tests first
- [ ] Define Zod validation schemas with proper enum usage
- [ ] **GREEN**: Implement service methods to pass tests
- [ ] Use TypeScript enums for all enum types (Section 4)
- [ ] Validate all inputs with Zod schemas
- [ ] Implement comprehensive error handling
- [ ] Add structured logging (no console.log)
- [ ] Use transactions for multi-step operations
- [ ] **REFACTOR**: Clean up code while keeping tests green
- [ ] **VERIFY**: Run ALL related tests, not just new ones

#### GraphQL Layer
- [ ] **RED**: Write failing resolver tests
- [ ] Define GraphQL schema with lowercase enum values
- [ ] **GREEN**: Implement thin resolvers that delegate to services
- [ ] Validate authentication in all resolvers
- [ ] **REFACTOR**: Improve resolver code quality
- [ ] **VERIFY**: Run all GraphQL tests

### Phase 2: Frontend Development (TDD)

#### Custom Hooks
- [ ] **RED**: Write failing hook tests with Apollo mocks
- [ ] Define hook interface with proper TypeScript types
- [ ] **GREEN**: Implement hooks to pass tests
- [ ] Use Apollo Client for server operations
- [ ] Use Zustand only for UI state
- [ ] Memoize callbacks with useCallback
- [ ] Implement cache updates in mutations
- [ ] Handle errors with state updates
- [ ] **REFACTOR**: Optimize hook implementation
- [ ] **VERIFY**: Run all hook tests

#### Components
- [ ] **RED**: Write failing component tests
- [ ] Document context requirements with @requires tags
- [ ] **GREEN**: Implement components to pass tests
- [ ] Use TypeScript enums for all enum props
- [ ] Provide MockedProvider in tests for Apollo dependencies
- [ ] **REFACTOR**: Improve component structure
- [ ] **VERIFY**: Run ALL component tests (not just new ones)

### Phase 3: Enum Compliance Verification

This is CRITICAL - enum violations cause production bugs.

- [ ] **All enum types use TypeScript enum** (not string literal unions)
- [ ] **All enum values are lowercase strings** (e.g., `'idle'`, `'saving'`)
- [ ] **Enum constants used in code** (e.g., `SaveStatus.IDLE`)
- [ ] **No string literals in code** (no `'idle'` or `'IDLE'` literals)
- [ ] **Zod schemas use z.nativeEnum(EnumName)**
- [ ] **GraphQL schema uses lowercase values**
- [ ] **Database stores lowercase values**

Example verification:
```typescript
// ✅ CORRECT
export enum SaveStatus {
  IDLE = 'idle',
  SAVING = 'saving',
  SUCCESS = 'success',
  ERROR = 'error'
}

const status: SaveStatus = SaveStatus.IDLE;
const schema = z.object({
  status: z.nativeEnum(SaveStatus)
});

// ❌ WRONG
export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
const status = 'idle'; // String literal
```

## Post-Implementation Verification

### 1. Architecture Compliance Check

Go through the Architecture Compliance Checklist in `architecture-guide.md`:

#### Critical Checks (Must Pass)
- [ ] Section 4: Enum Type Standardization (ALL items)
- [ ] Section 2: State Management Strategy (no mixing server/UI state)
- [ ] Section 3: Error Handling Standards (proper logging)
- [ ] Section 9: Testing Patterns (all tests pass)
- [ ] Section 11: Code Quality Standards (lint/type-check pass)

#### Pattern Compliance
- [ ] Section 6: Backend Service Layer Pattern (if applicable)
- [ ] Section 7: Frontend Hook Pattern (if applicable)
- [ ] Section 8: Frontend Store Pattern (if applicable)
- [ ] Section 12: Common Anti-Patterns (none present)

### 2. Quality Gates

Run all quality checks:

```bash
# TypeScript compilation (MUST PASS)
npm run type-check

# Linting with enum enforcement (MUST PASS)
npm run lint

# Full test suite (MUST PASS)
npm test

# Verify all pass
npm run type-check && npm run lint && npm test
```

### 3. Test Coverage Verification

When modifying existing code:

```bash
# Find all tests that might be affected
grep -r "ComponentName" --include="*.test.*"

# Run component-specific tests
npm test ComponentName

# Run feature-area tests
npm test canvas/editing

# Run FULL suite to catch regressions
npm test
```

### 4. Dependency Update Verification

If you added new dependencies to existing components:

- [ ] Identified all affected test files
- [ ] Updated test wrappers to provide new dependencies
- [ ] Added MockedProvider for Apollo dependencies
- [ ] Added store providers for Zustand dependencies
- [ ] Documented requirements with @requires comments
- [ ] All existing tests pass with new dependencies

## Integration with TodoWrite

Update your TodoWrite list as you progress:

```typescript
// Mark tasks as in_progress when starting
{ content: "Implement service layer methods", status: "in_progress" }

// Mark as completed only when FULLY done (tests pass, quality gates pass)
{ content: "Implement service layer methods", status: "completed" }

// Add compliance verification as final task
{ content: "Run architecture compliance verification", status: "in_progress" }
```

## Before Marking Linear Ticket Complete

- [ ] All TodoWrite tasks marked as completed
- [ ] Architecture Compliance Checklist fully checked
- [ ] All quality gates pass (type-check, lint, test)
- [ ] No enum violations (verified with ESLint)
- [ ] All tests pass (including existing tests)
- [ ] Linear ticket updated with implementation summary
- [ ] Code ready for PR creation

## Before Creating Pull Request

- [ ] Architecture Compliance Checklist completed
- [ ] Quality gates all green
- [ ] Linear ticket in "In Review" status
- [ ] PR description includes compliance verification
- [ ] Breaking changes documented
- [ ] Test coverage adequate

## Common Architecture Violations to Watch For

### Enum Violations (CRITICAL)
```typescript
// ❌ WRONG - String literal union
export type Status = 'idle' | 'saving';

// ❌ WRONG - Uppercase enum values
export enum Status {
  IDLE = 'IDLE',
  SAVING = 'SAVING'
}

// ✅ CORRECT - TypeScript enum with lowercase values
export enum Status {
  IDLE = 'idle',
  SAVING = 'saving'
}
```

### State Management Violations
```typescript
// ❌ WRONG - Server data in Zustand
interface BadStore {
  cards: Card[]; // Belongs in Apollo cache
}

// ✅ CORRECT - Only UI state in Zustand
interface GoodStore {
  selectedCardIds: Set<string>; // UI state only
}
```

### Error Handling Violations
```typescript
// ❌ WRONG - Console logging and swallowed errors
try {
  await operation();
} catch (error) {
  console.log(error); // Wrong logging
  return null; // Swallowed error
}

// ✅ CORRECT - Structured logging and proper error handling
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    context: { /* relevant context */ }
  });
  throw error; // Re-throw for caller
}
```

### Testing Violations
```typescript
// ❌ WRONG - Component uses Apollo but test doesn't provide it
test('renders correctly', () => {
  render(<ComponentUsingApollo />); // Will fail
});

// ✅ CORRECT - Provide required contexts
test('renders correctly', () => {
  render(
    <MockedProvider mocks={[]} addTypename={false}>
      <ComponentUsingApollo />
    </MockedProvider>
  );
});
```

## Quick Compliance Verification Commands

```bash
# Check for string literal unions (should find violations)
grep -r "type.*=.*'.*'.*|" --include="*.ts" --include="*.tsx"

# Check for enum definitions (verify lowercase values)
grep -r "export enum" --include="*.ts" --include="*.tsx" -A 5

# Check for console.log (should find none in production code)
grep -r "console.log" --include="*.ts" --include="*.tsx" --exclude-dir=__tests__

# Verify no 'any' types in new code
grep -r ": any" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules
```

## Escalation

If you're unsure about architecture compliance:
1. Review the specific section in architecture-guide.md
2. Check reference examples in the guide
3. Look for similar patterns in the existing codebase
4. Consult with senior developers
5. Create an ADR (Architecture Decision Record) for new patterns

## Summary

Architecture compliance prevents:
- Production bugs from enum mismatches
- State management inconsistencies
- Testing failures from missing dependencies
- Code quality degradation
- Performance issues

Always verify compliance BEFORE marking tasks complete or creating PRs.
