# Project Nexus - Living Architecture Guide

**Version**: 1.0
**Last Updated**: September 26, 2025
**Status**: Active Development Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Development Environment Setup](#development-environment-setup)
3. [Project Organization Standards](#project-organization-standards)
4. [Core Architecture Principles](#core-architecture-principles)
5. [Proven Implementation Patterns](#proven-implementation-patterns)
6. [Development Workflow](#development-workflow)
7. [Code Structure Templates](#code-structure-templates)
8. [Testing Patterns](#testing-patterns)
9. [Performance Guidelines](#performance-guidelines)
10. [Common Anti-Patterns](#common-anti-patterns)
11. [Reference Examples](#reference-examples)
12. [Architecture Decision Records](#architecture-decision-records)

---

## Introduction

This living architecture guide captures the **proven patterns currently working in the Project Nexus codebase** and establishes development guardrails for consistent implementation. Unlike theoretical architectural documents, this guide is based on real, working code patterns that have been validated in production.

### Purpose

- **Document Current Success**: Capture and codify working patterns from the existing codebase
- **Establish Consistency**: Provide clear guidelines for implementing new features
- **Enable Team Scaling**: Make it easy for new developers to follow established patterns
- **Prevent Drift**: Identify and resolve architectural inconsistencies

### Architecture Context

Project Nexus is an AI-powered visual knowledge workspace with:
- **Backend**: Node.js + GraphQL + PostgreSQL with pgvector + Redis
- **Frontend**: Next.js 14 + Zustand + Apollo Client + Konva.js
- **Infrastructure**: Docker Compose (development) + Auth0 authentication

---

## Development Environment Setup

### Docker Development Stack

Project Nexus uses Docker Compose for local development with the following services:

```yaml
# devops/docker-compose.yml
services:
  postgres:    # PostgreSQL with pgvector (AI embeddings)
  redis:       # Cache and sessions
  redis-commander: # Redis web interface (localhost:8081)
  adminer:     # Database web interface (localhost:8080)
```

**Setup Commands:**
```bash
# User starts Docker services (Claude never runs this)
cd devops && docker-compose up -d

# Backend development
npm run dev:backend

# Frontend development
npm run dev:frontend
```

**Important**: Never start docker-compose from Claude - always ask the user to start it.

### Environment Configuration

**Monorepo Environment Structure:**
- Root `.env` file contains all environment variables
- Backend and frontend read from root `.env` via relative paths
- Docker Compose uses root `.env` automatically

**Frontend Environment Variables (Next.js):**
```javascript
// clients/web/next.config.js
require('dotenv').config({ path: '../../.env' });

const nextConfig = {
  env: {
    AUTH0_SECRET: process.env.AUTH0_SECRET,
    AUTH0_BASE_URL: process.env.AUTH0_BASE_URL,
    GRAPHQL_ENDPOINT: process.env.GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
    // ... other variables
  }
};
```

---

## Project Organization Standards

### Directory Structure

**Monorepo Layout:**
```
project-nexus/
├── backend/           # Node.js GraphQL API
│   ├── src/
│   │   ├── resolvers/    # GraphQL resolvers
│   │   ├── services/     # Business logic layer
│   │   ├── models/       # Database models
│   │   └── types/        # TypeScript types
│   └── __tests__/        # Backend tests
├── clients/
│   └── web/           # Next.js frontend
│       ├── components/   # React components
│       ├── hooks/        # Custom React hooks
│       ├── stores/       # Zustand stores
│       ├── types/        # TypeScript types
│       ├── lib/          # Utilities and GraphQL
│       └── __tests__/    # Frontend tests
├── devops/            # Docker Compose setup
└── project-documentation/ # Architecture docs
```

### Path Aliases & Import Standards

**Frontend Path Aliases (TypeScript):**
```json
// clients/web/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/stores/*": ["./stores/*"],
      "@/types/*": ["./types/*"],
      "@/lib/*": ["./lib/*"],
      "@/utils/*": ["./utils/*"]
    }
  }
}
```

**Import Order Standards:**
```typescript
// 1. External libraries
import React from 'react';
import { useMutation } from '@apollo/client';

// 2. Internal imports with @ aliases (grouped by type)
import { useCardStore } from '@/stores/cardStore';
import { useCardCreation } from '@/hooks/useCardCreation';
import type { CardType } from '@/types/card.types';
import { CREATE_CARD } from '@/lib/graphql/cardOperations';

// 3. Relative imports (if any)
import './Component.styles.css';
```

**Backend Import Standards:**
```typescript
// 1. Node.js built-ins
import path from 'path';

// 2. External libraries
import { ApolloServer } from '@apollo/server';

// 3. Internal imports (relative paths)
import { resolvers } from './resolvers';
import { typeDefs } from './schema';
import type { Context } from './types';
```

### Canvas-Specific Patterns (Konva.js)

**Canvas Architecture:**
```typescript
// Canvas layer hierarchy
<Stage>
  <Layer name="background" />
  <Layer name="cards">
    {cards.map(card => (
      <CardRenderer key={card.id} card={card} />
    ))}
  </Layer>
  <Layer name="ui-overlay" />
</Stage>
```

**Canvas State Management:**
```typescript
// Canvas viewport state (Zustand)
interface CanvasStore {
  viewport: {
    position: { x: number; y: number };
    zoom: number;
    bounds: { width: number; height: number };
  };
  // UI-only state, no server data
}

// Card data comes from GraphQL/Apollo (server state)
const { data: cards } = useQuery(GET_CARDS);
```

**Canvas Coordinate Systems:**
```typescript
// Screen to canvas coordinate conversion
const screenToCanvasPosition = (screenPos: Position): CanvasPosition => {
  const { position, zoom } = viewport;
  return {
    x: (screenPos.x - position.x) / zoom,
    y: (screenPos.y - position.y) / zoom,
    z: Math.floor(Date.now() / 1000) % 1000
  };
};
```

**Konva.js Integration Standards:**
- Use `ref` for direct Konva node access
- Implement `onDragMove`, `onDragEnd` for position updates
- Use `onTransform` for resize operations
- Cache complex shapes with `cache()` for performance

### File Naming Conventions

**Components:**
- PascalCase: `CardRenderer.tsx`, `UserProfile.tsx`
- Test files: `CardRenderer.test.tsx`
- Styles: `CardRenderer.module.css` (if needed)

**Hooks:**
- camelCase with `use` prefix: `useCardCreation.ts`, `useCanvasViewport.ts`
- Test files: `useCardCreation.test.ts`

**Stores:**
- camelCase with Store suffix: `cardStore.ts`, `canvasStore.ts`
- No test files (stores are tested through components/hooks)

**Types:**
- camelCase with `.types.ts` suffix: `card.types.ts`, `canvas.types.ts`
- Use singular names: `card.types.ts` not `cards.types.ts`

**GraphQL:**
- camelCase descriptive names: `cardOperations.ts`, `workspaceQueries.ts`
- Group related operations in single files

### GraphQL Schema Organization

**Backend Schema Structure:**
```
backend/src/
├── graphql/
│   ├── typeDefs.ts          # Main schema definitions
│   ├── canvasTypeDefs.ts    # Feature-specific schemas
│   └── canvasResolvers.ts   # Feature-specific resolvers
├── resolvers/
│   ├── index.ts             # Resolver merging
│   ├── cardResolvers.ts     # Entity resolvers
│   ├── userResolvers.ts
│   └── workspaceResolvers.ts
├── services/               # Business logic layer
└── types/                  # TypeScript type definitions
```

**Schema Definition Patterns:**
```typescript
// graphql/typeDefs.ts - Main schema
export const authTypeDefs = gql`
  # Scalar types first
  scalar DateTime
  scalar JSON

  # Entity types
  type User {
    id: ID!
    email: String!
    # ... fields
  }

  # Input types for mutations
  input CreateUserInput {
    email: String!
    # ... fields
  }

  # Queries and Mutations
  type Query {
    user(id: ID!): User
    users(filter: UserFilter): [User!]!
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
  }
`;
```

**Resolver Implementation Patterns:**
```typescript
// resolvers/cardResolvers.ts
import { CardService } from '@/services/CardService';
import { GraphQLContext } from '@/types';
import { AuthenticationError, ValidationError } from '@/utils/errors';

export const cardResolvers = {
  Query: {
    card: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<Card | null> => {
      // 1. Authentication check
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      // 2. Service layer call
      const cardService = new CardService();
      return await cardService.getCardById(id, context.user.id);
    },
  },

  Mutation: {
    createCard: async (
      _: any,
      { input }: { input: CreateCardInput },
      context: GraphQLContext
    ): Promise<Card> => {
      // Authentication, validation, service call pattern
      if (!context.isAuthenticated) {
        throw new AuthenticationError();
      }

      const cardService = new CardService();
      return await cardService.createCard(input, context.user.id);
    },
  },
};
```

**Frontend GraphQL Integration:**
```typescript
// lib/graphql/cardOperations.ts
import { gql } from '@apollo/client';

export const CREATE_CARD = gql`
  mutation CreateCard($input: CreateCardInput!) {
    createCard(input: $input) {
      id
      title
      content
      position {
        x
        y
        z
      }
      dimensions {
        width
        height
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_CARDS = gql`
  query GetCards($workspaceId: ID!) {
    cards(workspaceId: $workspaceId) {
      items {
        id
        title
        type
        position {
          x
          y
          z
        }
        # ... other fields
      }
    }
  }
`;
```

**GraphQL Standards:**
- **Naming**: Use PascalCase for types, camelCase for fields
- **Nullability**: Be explicit about required vs optional fields
- **Input Types**: Always use input types for mutations
- **Error Handling**: Use custom error types with proper HTTP status codes
- **Context**: Always validate authentication in resolvers
- **Service Layer**: Never put business logic in resolvers - delegate to services

---

## Core Architecture Principles

### 1. Data Flow Architecture

**Principle**: Clear separation between client state and server state with unidirectional data flow using **two distinct caching systems**.

#### Server Data Flow (Apollo Cache)
```
User Action → Hook → Apollo GraphQL Query/Mutation → Service → Database
     ↓
Component ← Apollo Cache ← GraphQL Response ← Service
```

#### UI State Flow (Zustand Store)
```
User Action → Component → Zustand Store Actions
     ↓
Component ← Zustand Store State
```

**Implementation**:
- **Server Data (Apollo Cache)**: Cards, workspaces, user profiles - automatic cache management
- **UI State (Zustand Store)**: Selection, drag operations, modal visibility - manual state management
- **Backend**: Service layer pattern with repository abstraction
- **No Data Mixing**: Server data never stored in Zustand, UI state never stored in Apollo
- **No Direct Database Access**: All database operations through service layer

### 2. State Management Strategy

**Client State (Zustand)**: Transient UI state only
- Selection state, drag operations, modal visibility
- Never persist server data in Zustand stores
- Example: `cardStore.ts` manages selection/drag, not card data

**Server State (Apollo Client)**: All persistent data
- Cards, workspaces, user profiles from GraphQL
- Automatic cache management and synchronization
- Cache updates after mutations

### 3. Error Handling Standards

**Backend Pattern**:
```typescript
try {
  // Validate input with Zod
  const validatedInput = schema.parse(input);

  // Business logic
  const result = await service.operation(validatedInput);

  // Log success
  logger.info('Operation completed', { context });

  return result;
} catch (error) {
  if (error instanceof z.ZodError) {
    throw new ValidationError(error.errors[0]?.message);
  }

  logger.error('Operation failed', { error: error.message, context });
  throw error;
}
```

**Frontend Pattern**:
```typescript
const [mutation, { loading, error }] = useMutation(MUTATION, {
  onError: (error) => {
    // Update UI state to show error
    setState(prev => ({
      ...prev,
      error: error.message,
      loading: false
    }));

    // Optional: Send to error tracking service
    // errorService.captureError(error, { context: 'mutation' });
  },
  update: (cache, { data }) => {
    // Update Apollo cache optimistically
  }
});
```

### 4. Enum Type Standardization

**Critical Issue**: Inconsistent enum handling has caused production bugs. We must standardize enum values across all layers.

**Standard Pattern**: Use lowercase values everywhere with proper TypeScript enums for type safety.

```typescript
// ✅ CORRECT: Standard enum definition
export enum WorkspacePrivacy {
  PRIVATE = 'private',
  TEAM = 'team',
  PUBLIC = 'public'
}

export enum CardType {
  TEXT = 'text',
  IMAGE = 'image',
  LINK = 'link',
  CODE = 'code'
}
```

**Implementation Rules**:
- **Database**: Store lowercase values (`'private'`, `'text'`)
- **GraphQL Schema**: Use lowercase enum values
- **Frontend/Backend**: Use TypeScript enums for type safety
- **Validation**: Zod schemas use enum values for validation

**Database Schema**:
```sql
CREATE TYPE workspace_privacy AS ENUM ('private', 'team', 'public');
CREATE TYPE card_type AS ENUM ('text', 'image', 'link', 'code');

CREATE TABLE workspaces (
  privacy workspace_privacy DEFAULT 'private'
);
```

**GraphQL Schema**:
```graphql
enum WorkspacePrivacy {
  private
  team
  public
}

enum CardType {
  text
  image
  link
  code
}
```

**Service Layer Validation**:
```typescript
const workspaceCreateSchema = z.object({
  name: z.string().min(1).max(100),
  privacy: z.nativeEnum(WorkspacePrivacy).default(WorkspacePrivacy.PRIVATE),
});

// ❌ WRONG: String literals cause inconsistency
// privacy: z.enum(['Private', 'Public']) // Avoid this!
```

**Frontend Usage**:
```typescript
// ✅ CORRECT: Use enum values consistently
const createWorkspace = async (name: string, privacy: WorkspacePrivacy) => {
  return await createWorkspaceMutation({
    variables: {
      input: {
        name,
        privacy: privacy // Already lowercase from enum
      }
    }
  });
};

// UI dropdown options
const privacyOptions = [
  { value: WorkspacePrivacy.PRIVATE, label: 'Private' },
  { value: WorkspacePrivacy.TEAM, label: 'Team' },
  { value: WorkspacePrivacy.PUBLIC, label: 'Public' }
];
```

### 5. API Design Patterns

**GraphQL-First Approach**:
- Single endpoint reduces complexity
- Strong typing with TypeScript generation
- Efficient data fetching with field selection
- Real-time updates via subscriptions (when enabled)

**Resolver Pattern**:
```typescript
// Thin resolvers delegate to services
const cardResolvers = {
  Mutation: {
    createCard: async (_, { input }, { user, services }) => {
      return await services.card.createCard(input, user.id);
    }
  }
};
```

---

## Proven Implementation Patterns

### Backend Service Layer Pattern

**Current Working Example**: `WorkspaceService` class demonstrates the proven pattern:

```typescript
export class WorkspaceService {
  private readonly tableName = 'workspaces';

  // 1. Input Validation with Zod
  async createWorkspace(input: WorkspaceCreateInput): Promise<Workspace> {
    const validatedInput = workspaceCreateSchema.parse(input);

    // 2. Business Logic
    if (validatedInput.isDefault) {
      await this.clearDefaultWorkspace(validatedInput.ownerId);
    }

    // 3. Database Operations
    const [workspace] = await database.query<any[]>(
      knex(this.tableName).insert(workspaceData).returning('*'),
      'workspace_create'
    );

    // 4. Logging
    logger.info('Workspace created', { workspaceId: workspace.id });

    // 5. Data Mapping
    return this.mapDbWorkspaceToWorkspace(workspace);
  }

  // Transaction Safety for Critical Operations
  async transferOwnership(workspaceId: string, newOwnerId: string): Promise<Workspace> {
    return database.transaction(async (trx) => {
      // All operations within transaction
    });
  }
}
```

**Key Elements**:
- Input validation with Zod schemas
- Structured error handling and logging
- Database operations through Knex query builder
- Transaction safety for multi-step operations
- Data mapping between DB and domain models

### Frontend Hook Pattern

**Current Working Example**: `useCardCreation` demonstrates the proven pattern:

```typescript
export const useCardCreation = (config: CardCreationConfig): UseCardCreationReturn => {
  // 1. External Dependencies
  const canvasStore = useCanvasStore();
  const [createCardMutation, { loading }] = useMutation(CREATE_CARD);

  // 2. Local State Management
  const [state, setState] = useState<CardCreationState>({
    // UI state only
  });

  // 3. Memoized Operations
  const createCard = useCallback(async (params) => {
    try {
      const result = await createCardMutation({ variables: { input } });
      // Apollo automatically updates cache
      closeModal(); // Update UI state
      return result.data?.createCard.id;
    } catch (error) {
      setState(prev => ({ ...prev, error: error.message }));
      return null;
    }
  }, [dependencies]);

  return {
    state,
    actions: { createCard, openModal, closeModal }
  };
};
```

**Key Elements**:
- Clear separation of concerns (UI state vs server operations)
- Memoized callbacks to prevent unnecessary re-renders
- Apollo cache updates happen automatically
- Local state for UI-specific concerns only

### Frontend Store Pattern

**Current Working Example**: `cardStore.ts` demonstrates UI-only state:

```typescript
export const useCardStore = create<CardStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Only UI state - no server data
        selection: {
          selectedIds: new Set(),
          // ... selection state
        },

        // Actions operate on UI state only
        selectCard: (id: CardId, addToSelection: boolean = false) => {
          set((state) => ({
            // Update UI state immutably
          }));
        },
      }),
      {
        // Only persist UI preferences
        partialize: (state) => ({
          selection: {
            selectedIds: Array.from(state.selection.selectedIds),
            // ... serializable state only
          },
        }),
      }
    )
  )
);
```

**Key Elements**:
- UI state only, never server data
- Immutable updates with proper TypeScript typing
- Persistence only for user preferences
- Set serialization handling for complex types

---

## Development Workflow

### Test-Driven Development (TDD) Approach

**Philosophy**: Write tests first, implement functionality second. This ensures:
- ✅ Better test coverage and quality
- ✅ Cleaner, more focused code design
- ✅ Fewer bugs in production
- ✅ Confidence in refactoring

**TDD Cycle**: RED → GREEN → REFACTOR → VERIFY
1. **RED**: Write a failing test that describes the desired behavior
2. **GREEN**: Write the minimal code to make the test pass
3. **REFACTOR**: Clean up the code while keeping tests green
4. **VERIFY**: Run ALL related tests, not just new ones - ensure no regression

**TDD Example**:
```typescript
// 1. RED: Write failing test first
describe('WorkspaceService.createWorkspace', () => {
  it('should create workspace with default settings', async () => {
    const input = { name: 'My Workspace', ownerId: 'user-123' };

    const result = await workspaceService.createWorkspace(input);

    expect(result).toMatchObject({
      name: 'My Workspace',
      ownerId: 'user-123',
      privacy: WorkspacePrivacy.PRIVATE,
      isDefault: false
    });
  });
});

// 2. GREEN: Implement minimal code to pass
export class WorkspaceService {
  async createWorkspace(input: WorkspaceCreateInput): Promise<Workspace> {
    // Minimal implementation to make test pass
    return {
      id: 'workspace-123',
      name: input.name,
      ownerId: input.ownerId,
      privacy: WorkspacePrivacy.PRIVATE,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

// 3. REFACTOR: Add proper implementation while keeping tests green
async createWorkspace(input: WorkspaceCreateInput): Promise<Workspace> {
  const validatedInput = workspaceCreateSchema.parse(input);

  const [workspace] = await database.query<any[]>(
    knex(this.tableName).insert(workspaceData).returning('*'),
    'workspace_create'
  );

  return this.mapDbWorkspaceToWorkspace(workspace);
}

// 4. VERIFY: Run all tests to ensure no regression
// npm test workspace  // All workspace-related tests
// npm test           // Full suite to catch unexpected breaks
```

**Critical TDD Enhancement**: The VERIFY step is essential when modifying existing code. It's not enough to make your new tests pass - you must ensure existing functionality remains intact.

### Feature Implementation Process

**1. Requirements Analysis**
```bash
# Review Linear ticket and acceptance criteria
# Identify service layer changes needed
# Plan GraphQL schema changes if required
# Define test scenarios and edge cases
```

**2. Backend-First Development (TDD Approach)**
```bash
# 1. Create/update database migrations
# 2. Write comprehensive service layer tests (RED - tests fail)
# 3. Implement service layer methods to pass tests (GREEN)
# 4. Refactor service layer code for quality (REFACTOR)
# 5. Write GraphQL resolver tests (RED)
# 6. Implement GraphQL resolvers to pass tests (GREEN)
# 7. Update GraphQL schema if needed
# 8. Refactor resolvers for quality (REFACTOR)
```

**3. Frontend Integration (TDD Approach)**
```bash
# 1. Generate TypeScript types from GraphQL schema
# 2. Write hook tests with Apollo mocks (RED - tests fail)
# 3. Implement hooks to pass tests (GREEN)
# 4. Refactor hooks for performance and quality (REFACTOR)
# 5. Write component tests (RED - tests fail)
# 6. Implement/update UI components to pass tests (GREEN)
# 7. Refactor components for quality (REFACTOR)
# 8. Integration testing with full GraphQL stack
```

**4. Quality Assurance Standards**

**Philosophy**: Zero tolerance for quality issues. Code must pass ALL quality gates before merging.

### Code Quality Requirements

**TypeScript Standards**:
```typescript
// ✅ REQUIRED: Strict typing, no exceptions
interface UserProfile {
  id: string;
  email: string;
  preferences: UserPreferences; // Typed interface
  metadata: Record<string, unknown>; // If truly dynamic, use Record
}

// ❌ FORBIDDEN: These will fail CI
const userData: any = response.data; // NO 'any' types
const result: unknown = parseData(); // NO 'unknown' without narrowing
const userId = user?.id!; // NO non-null assertions without good reason
// @ts-ignore - NO ignoring TypeScript errors
const value = dangerousOperation();
```

**ESLint Rules Enforced**:
- `@typescript-eslint/no-explicit-any` - ERROR (no `any` types)
- `@typescript-eslint/no-unused-vars` - ERROR
- `@typescript-eslint/explicit-function-return-type` - WARN (prefer explicit returns)
- `@typescript-eslint/prefer-nullish-coalescing` - ERROR
- `@typescript-eslint/strict-boolean-expressions` - ERROR
- `prefer-const` - ERROR (use const when possible)
- `no-console` - ERROR (use proper logging)

**Quality Gate Checklist**:
```bash
# 1. TypeScript compilation (MUST PASS)
npm run type-check
# Zero TypeScript errors allowed

# 2. Linting (MUST PASS)
npm run lint
# Zero ESLint errors, zero warnings in production code

# 3. Test suite (MUST PASS)
npm test
# All tests pass, minimum coverage thresholds met

# 4. GraphQL schema validation (MUST PASS)
npm run codegen
# Schema generates valid TypeScript types

# 5. Build verification (MUST PASS)
npm run build
# Production build succeeds without warnings
```

### Specific Quality Standards

**Variable Declarations**:
```typescript
// ✅ CORRECT: Proper typing
const workspaceId: string = params.id;
const user: User = await userService.getUser(userId);
const preferences: UserPreferences = {
  theme: 'dark',
  notifications: true
};

// ❌ WRONG: Avoid these patterns
let workspaceId; // Implicit any
const user = await userService.getUser(userId) as any; // Type assertion abuse
var preferences = {}; // Use const/let, avoid var
```

**Function Signatures**:
```typescript
// ✅ CORRECT: Explicit types and error handling
async function createWorkspace(
  input: WorkspaceCreateInput,
  userId: string
): Promise<Result<Workspace, ValidationError>> {
  // Implementation with proper error handling
}

// ❌ WRONG: Missing types and error handling
async function createWorkspace(input, userId) {
  // Implicit any parameters
  return await db.create(input); // Unhandled errors
}
```

**Import/Export Standards**:
```typescript
// ✅ CORRECT: Explicit imports and exports
import { WorkspaceService } from '@/services/workspace';
import type { CreateWorkspaceInput } from '@/types/workspace.types';

export { WorkspaceService };
export type { CreateWorkspaceInput };

// ❌ WRONG: Avoid these patterns
import * as workspace from '@/services/workspace'; // Namespace imports for services
export * from '@/types'; // Barrel exports without explicit re-exports
```

**Error Handling Standards**:
```typescript
// ✅ CORRECT: Typed error handling
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  if (error instanceof ValidationError) {
    return { success: false, error: error.message };
  }

  // Re-throw unexpected errors
  logger.error('Unexpected error in operation', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  throw error;
}

// ❌ WRONG: Poor error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.log(error); // No proper logging
  return null; // Swallowing errors
}
```

### Pre-Commit Requirements

**Developer Responsibility**:
- Run `npm run type-check` before every commit
- Fix ALL TypeScript errors (no exceptions)
- Fix ALL ESLint errors and warnings
- Ensure test coverage for new code
- No `console.log`, `debugger`, or commented-out code

**Code Review Requirements**:
- All quality gates must pass in CI
- Type safety review (no `any`, proper interfaces)
- Test coverage review (critical paths tested)
- Error handling review (all errors properly handled)
- Performance review (no obvious performance issues)

### Legacy Code Improvement Strategy

**Boy Scout Rule**: "Always leave the code better than you found it"

Since these quality standards weren't enforced previously, we have existing code that violates our rules. Instead of massive refactoring, we improve incrementally:

**When Working on Any File**:
1. **Fix the file you're working on**: Remove ALL linting errors/warnings in files you modify
2. **Improve related code**: Fix obvious issues in functions you call or modify
3. **Update imports**: Fix any `any` types in interfaces you import
4. **Add missing types**: Type any previously untyped variables you encounter

**Common Legacy Issues & Fixes**:

**1. Removing `any` Types**:
```typescript
// ❌ BEFORE: Legacy code with any
const handleResponse = (data: any) => {
  return data.items?.map((item: any) => item.name);
};

// ✅ AFTER: Properly typed
interface ApiResponse {
  items?: Array<{ name: string; id: string }>;
}

const handleResponse = (data: ApiResponse): string[] => {
  return data.items?.map(item => item.name) || [];
};
```

**2. Adding Missing Return Types**:
```typescript
// ❌ BEFORE: Implicit return type
const createWorkspace = async (input) => {
  return await workspaceService.create(input);
};

// ✅ AFTER: Explicit types
const createWorkspace = async (input: CreateWorkspaceInput): Promise<Workspace> => {
  return await workspaceService.create(input);
};
```

**3. Fixing Variable Declarations**:
```typescript
// ❌ BEFORE: Implicit any and var
var result;
let items = [];

// ✅ AFTER: Proper typing
const result: WorkspaceResult | null = null;
const items: WorkspaceItem[] = [];
```

**4. Improving Error Handling**:
```typescript
// ❌ BEFORE: Poor error handling
try {
  const result = await operation();
  return result;
} catch (error) {
  console.error(error);
  return null;
}

// ✅ AFTER: Proper error handling
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    context: 'createWorkspace'
  });
  return { success: false, error: 'Failed to create workspace' };
}
```

**5. Replacing Console Logs**:
```typescript
// ❌ BEFORE: Console logging
console.log('User created:', user);
console.error('Failed to create user:', error);

// ✅ AFTER: Proper logging
logger.info('User created successfully', { userId: user.id });
logger.error('Failed to create user', {
  error: error instanceof Error ? error.message : 'Unknown error',
  context: { email: input.email }
});
```

### Incremental Improvement Process

**File-by-File Approach**:
1. **Open file for feature work** → Fix all quality issues in that file
2. **Touch related files** → Fix immediate issues in those files too
3. **Update tests** → Ensure tests cover your improvements
4. **Commit improvements** → Separate commits for quality fixes vs feature work

**Prioritization Strategy**:
1. **Critical paths first**: Fix most-used services and hooks
2. **New code**: Apply all standards to new files immediately
3. **High-traffic files**: Prioritize files changed frequently
4. **Dependencies**: Fix shared types and interfaces early

**Example Commit Strategy**:
```bash
# Use the /commit slash command for proper conventional commits with emojis
# Quality improvement commits:
♻️ refactor: remove any types and improve error handling in WorkspaceService
🚨 fix: resolve linter warnings in CardLayer component
🏷️ feat: add proper TypeScript types to useCardCreation hook

# Feature commits (with Linear ticket reference):
✨ feat: add workspace creation with proper validation (NEX-123)
🐛 fix: resolve card positioning issue in canvas (NEX-456)

# Always use /commit command to ensure:
# - Proper conventional commit format with emojis
# - Pre-commit checks (lint, build, docs generation)
# - Atomic commits when multiple changes detected
```

### Quality Improvement Metrics

**Track Progress**:
- Count of `any` types in codebase (should decrease over time)
- ESLint errors/warnings count (should trend to zero)
- TypeScript strict mode compatibility
- Test coverage percentage (should increase)

**Weekly Quality Review**:
- Identify files with most violations
- Celebrate quality improvements in standups
- Share before/after examples of good cleanup work

### When Legacy Code is Too Large

**For files with 50+ violations**:
1. **Create dedicated cleanup ticket**: Don't mix with feature work
2. **Incremental approach**: Fix 10-20 issues at a time
3. **Pair programming**: Two people can tackle large files faster
4. **Break into smaller functions**: Split large functions while fixing

**Critical Rule**: Never merge code that adds NEW violations, even if cleaning up old ones.

### Commit Standards

**Use the `/commit` Slash Command**: Always use `/commit` for proper conventional commits with emojis.

**What `/commit` provides**:
- ✅ **Pre-commit checks**: Runs `npm run lint`, `npm run build`, and `npm run generate:docs`
- ✅ **Conventional commit format**: Proper `type: description` with appropriate emojis
- ✅ **Atomic commits**: Detects multiple changes and suggests splitting commits
- ✅ **Quality validation**: Ensures code quality before committing

**Common commit types for quality improvements**:
- `♻️ refactor`: Remove `any` types, improve code structure
- `🚨 fix`: Resolve linter warnings and errors
- `🏷️ feat`: Add proper TypeScript types
- `🎨 style`: Improve code formatting and organization
- `✅ test`: Add missing tests during cleanup

### Branch Workflow

```bash
# 1. Create feature branch
git checkout -b feature/nex-[NUMBER]-[description]

# 2. Development with /commit command
/commit  # Runs quality checks and creates proper commit messages

# 3. Quality checks are automatic with /commit
# - npm run type-check (via /commit)
# - npm run lint (via /commit)
# - npm run build (via /commit)
# - npm run generate:docs (via /commit)

# 4. Create PR with comprehensive description
gh pr create --title "feat: [feature] (NEX-[NUMBER])" --body "[description]"
```

---

## Code Structure Templates

### Backend Service Template

```typescript
import { database, knex } from '@/database/connection';
import { ValidationError, NotFoundError } from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { z } from 'zod';

// Input validation schemas
const createSchema = z.object({
  // Define schema
});

const updateSchema = z.object({
  // Define schema
});

// Types
export interface EntityType {
  // Define interface
}

const logger = createContextLogger({ service: 'EntityService' });

export class EntityService {
  private readonly tableName = 'entities';

  /**
   * Create entity with validation and error handling
   */
  async createEntity(input: CreateEntityInput, userId: string): Promise<EntityType> {
    try {
      // 1. Validate input
      const validatedInput = createSchema.parse(input);

      // 2. Business logic
      // ... business rules

      // 3. Database operation
      const [entity] = await database.query<any[]>(
        knex(this.tableName)
          .insert(entityData)
          .returning('*'),
        'entity_create'
      );

      // 4. Logging
      logger.info('Entity created', {
        entityId: entity.id,
        userId,
      });

      // 5. Return mapped result
      return this.mapDbEntityToEntity(entity);

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      logger.error('Failed to create entity', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Transaction example for complex operations
   */
  async complexOperation(input: ComplexInput): Promise<Result> {
    return database.transaction(async (trx) => {
      // All operations use trx instead of database
      const step1 = await trx(this.tableName).where('id', input.id).first();

      if (!step1) {
        throw new NotFoundError('Entity', input.id);
      }

      // Additional steps...

      return result;
    });
  }

  /**
   * Data mapping helper
   */
  private mapDbEntityToEntity(dbEntity: any): EntityType {
    return {
      id: dbEntity.id,
      // Map database fields to domain model
      createdAt: new Date(dbEntity.created_at),
      updatedAt: new Date(dbEntity.updated_at),
    };
  }
}
```

### Frontend Hook Template

```typescript
import { useCallback, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { MUTATION, QUERY } from '@/lib/graphql/operations';

interface HookConfig {
  // Configuration options
}

interface HookState {
  // UI state shape
}

interface HookReturn {
  // Return interface
}

export const useEntityOperation = (config: HookConfig): HookReturn => {
  // 1. External dependencies
  const [mutation, { loading: mutationLoading }] = useMutation(MUTATION, {
    update: (cache, { data }) => {
      // Update cache after successful mutation
    },
    onError: (error) => {
      // Update UI state to show error
      setState(prev => ({
        ...prev,
        error: error.message,
        loading: false
      }));
    }
  });

  const { data, loading: queryLoading } = useQuery(QUERY, {
    variables: { /* variables */ },
    skip: !condition, // Conditional querying
  });

  // 2. Local state for UI concerns
  const [state, setState] = useState<HookState>({
    // Initial state
  });

  // 3. Memoized operations
  const performOperation = useCallback(async (params: OperationParams) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const result = await mutation({
        variables: { input: params }
      });

      setState(prev => ({ ...prev, loading: false }));

      return result.data?.operationResult;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Operation failed'
      }));
      return null;
    }
  }, [mutation]);

  return {
    state,
    data,
    loading: queryLoading || mutationLoading,
    performOperation,
  };
};
```

### Component Template with Store Integration

```typescript
import React from 'react';
import { useEntityStore } from '@/stores/entityStore';
import { useEntityOperation } from '@/hooks/useEntityOperation';

interface ComponentProps {
  // Props interface
}

export const EntityComponent: React.FC<ComponentProps> = ({ ...props }) => {
  // 1. Store integration (UI state only)
  const {
    selection,
    actions: { selectEntity, clearSelection }
  } = useEntityStore();

  // 2. Server operations via hooks
  const {
    data: entities,
    loading,
    performOperation
  } = useEntityOperation({
    config: props.config
  });

  // 3. Event handlers
  const handleEntityClick = useCallback((entityId: string) => {
    selectEntity(entityId);
    // Additional UI logic
  }, [selectEntity]);

  const handleOperation = useCallback(async () => {
    const result = await performOperation({
      // params
    });

    if (result) {
      // Handle success
      clearSelection();
    }
  }, [performOperation, clearSelection]);

  // 4. Render
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};
```
### Component Template with Logging

All frontend components must use structured logging via `createContextLogger`. Never use `console.log` directly.

```typescript
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createContextLogger } from '@/utils/logger';
import { useCardStore } from '@/stores/cardStore';
import { useCreateCard } from '@/hooks/useCreateCard';

// Create logger at module level with component context
const logger = createContextLogger({ component: 'CardCreator' });

interface CardCreatorProps {
  canvasId: string;
  position: { x: number; y: number };
  onSuccess?: (cardId: string) => void;
  onCancel?: () => void;
}

/**
 * CardCreator component handles creation of new knowledge cards
 *
 * @requires ApolloProvider - Required for GraphQL mutations
 * @requires CardStoreProvider - Required for card state management
 *
 * Context Requirements:
 * - Apollo Client must be configured with proper authentication
 * - Card store must be initialized before mounting
 */
export const CardCreator: React.FC<CardCreatorProps> = ({
  canvasId,
  position,
  onSuccess,
  onCancel
}) => {
  // Component state
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Store integration
  const { actions } = useCardStore();

  // GraphQL mutation hook
  const { createCard, loading, error } = useCreateCard();

  // Log component mount
  useEffect(() => {
    logger.debug('CardCreator mounted', {
      canvasId,
      position,
      hasSuccessCallback: !!onSuccess,
      hasCancelCallback: !!onCancel
    });

    return (): void => {
      logger.debug('CardCreator unmounting', { canvasId });
    };
  }, [canvasId, position, onSuccess, onCancel]);

  // Log error state changes
  useEffect(() => {
    if (error) {
      logger.error('Card creation error detected', {
        error: error.message,
        canvasId,
        cardTitle: title
      });
    }
  }, [error, canvasId, title]);

  /**
   * Handle form submission with comprehensive error handling
   */
  const handleSubmit = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!title.trim()) {
      logger.warn('Attempted to create card without title', { canvasId });
      return;
    }

    logger.info('Creating new card', {
      canvasId,
      position,
      titleLength: title.length,
      contentLength: content.length
    });

    setIsSubmitting(true);

    try {
      const result = await createCard({
        canvasId,
        title: title.trim(),
        content: content.trim(),
        position
      });

      if (result?.id) {
        logger.info('Card created successfully', {
          cardId: result.id,
          canvasId,
          title: title.trim()
        });

        // Update local store
        actions.addCard(result);

        // Call success callback
        onSuccess?.(result.id);

        // Reset form
        setTitle('');
        setContent('');
      } else {
        logger.error('Card creation returned no ID', {
          canvasId,
          result
        });
      }
    } catch (err) {
      logger.error('Failed to create card', {
        error: err instanceof Error ? err.message : 'Unknown error',
        errorStack: err instanceof Error ? err.stack : undefined,
        canvasId,
        title: title.trim(),
        position
      });

      // Re-throw to allow component error boundary to handle
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [title, content, canvasId, position, createCard, actions, onSuccess]);

  /**
   * Handle cancel action
   */
  const handleCancel = useCallback((): void => {
    logger.debug('Card creation cancelled', {
      canvasId,
      hadTitle: !!title,
      hadContent: !!content
    });

    setTitle('');
    setContent('');
    onCancel?.();
  }, [canvasId, title, content, onCancel]);

  /**
   * Handle input changes with debug logging
   */
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const newTitle = e.target.value;
    logger.debug('Title changed', {
      previousLength: title.length,
      newLength: newTitle.length
    });
    setTitle(newTitle);
  }, [title.length]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const newContent = e.target.value;
    logger.debug('Content changed', {
      previousLength: content.length,
      newLength: newContent.length
    });
    setContent(newContent);
  }, [content.length]);

  return (
    <form onSubmit={handleSubmit} className="card-creator">
      <input
        type="text"
        value={title}
        onChange={handleTitleChange}
        placeholder="Card title"
        disabled={isSubmitting}
        required
      />
      <textarea
        value={content}
        onChange={handleContentChange}
        placeholder="Card content"
        disabled={isSubmitting}
      />
      <div className="actions">
        <button type="submit" disabled={isSubmitting || !title.trim()}>
          {isSubmitting ? 'Creating...' : 'Create Card'}
        </button>
        <button type="button" onClick={handleCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
      {error && (
        <div className="error">
          Failed to create card: {error.message}
        </div>
      )}
    </form>
  );
};
```

### Logging Best Practices

#### 1. Always Use Structured Logging

**❌ Bad: Direct console usage**
```typescript
console.log('Card created');
console.log('Error:', error);
console.log('User clicked button', userId, cardId);
```

**✅ Good: Structured logging with context**
```typescript
const logger = createContextLogger({ component: 'CardList' });

logger.info('Card created', {
  cardId: result.id,
  canvasId,
  userId
});

logger.error('Card creation failed', {
  error: error.message,
  errorStack: error.stack,
  userId,
  canvasId
});

logger.debug('Button clicked', {
  userId,
  cardId,
  buttonType: 'delete'
});
```

#### 2. Create Logger Per Component/Module

**❌ Bad: Shared or imported logger**
```typescript
import { logger } from '@/utils/logger'; // Generic logger

export const MyComponent = () => {
  logger.info('Something happened'); // No component context
};
```

**✅ Good: Component-specific logger**
```typescript
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger({ component: 'MyComponent' });

export const MyComponent = () => {
  logger.info('Something happened'); // Automatically includes component context
};
```

#### 3. Use Appropriate Log Levels

```typescript
const logger = createContextLogger({ component: 'DataProcessor' });

// DEBUG: Detailed diagnostic information (verbose)
logger.debug('Processing item', {
  itemId: item.id,
  itemType: item.type,
  processingStep: 'validation'
});

// INFO: General informational events
logger.info('Processing completed', {
  itemsProcessed: count,
  duration: endTime - startTime
});

// WARN: Warning events that might need attention
logger.warn('Processing took longer than expected', {
  duration: endTime - startTime,
  threshold: THRESHOLD_MS,
  itemsProcessed: count
});

// ERROR: Error events that need immediate attention
logger.error('Processing failed', {
  error: error.message,
  errorStack: error.stack,
  itemId: item.id,
  retryCount
});
```

#### 4. Log Component Lifecycle Events

```typescript
const logger = createContextLogger({ component: 'CanvasRenderer' });

export const CanvasRenderer: React.FC<Props> = ({ canvasId }) => {
  // Mount logging
  useEffect(() => {
    logger.debug('CanvasRenderer mounted', {
      canvasId,
      timestamp: Date.now()
    });

    return (): void => {
      logger.debug('CanvasRenderer unmounting', {
        canvasId,
        timestamp: Date.now()
      });
    };
  }, [canvasId]);

  // Dependency change logging
  useEffect(() => {
    logger.debug('Canvas ID changed', {
      previousCanvasId: prevCanvasId,
      newCanvasId: canvasId
    });
  }, [canvasId]);
};
```

#### 5. Include Relevant Context in All Logs

**❌ Bad: Missing context**
```typescript
logger.info('Operation completed');
logger.error('Failed', { error: err.message });
```

**✅ Good: Rich contextual information**
```typescript
logger.info('Card update completed', {
  cardId,
  canvasId,
  userId,
  fieldsUpdated: ['title', 'content'],
  duration: endTime - startTime
});

logger.error('Card update failed', {
  error: err.message,
  errorStack: err.stack,
  cardId,
  canvasId,
  userId,
  updateData,
  retryCount,
  previousState
});
```

#### 6. Document Required Context Providers

Always document context requirements in JSDoc comments:

```typescript
/**
 * EditModeManager component handles inline editing state and operations
 *
 * @requires ApolloProvider - Required for GraphQL mutations (card updates)
 * @requires EditModeStoreProvider - Required for edit mode state management
 * @requires CardStoreProvider - Optional but recommended for optimistic updates
 *
 * Context Requirements:
 * - Apollo Client must be configured with authenticated requests
 * - Edit mode store must be initialized before mounting
 * - Component will fail to render without required providers
 *
 * @example
 * ```tsx
 * <ApolloProvider client={apolloClient}>
 *   <EditModeStoreProvider>
 *     <EditModeManager />
 *   </EditModeStoreProvider>
 * </ApolloProvider>
 * ```
 */
const logger = createContextLogger({ component: 'EditModeManager' });

export const EditModeManager: React.FC = () => {
  logger.debug('EditModeManager initialized', {
    timestamp: Date.now()
  });

  // Component implementation
};
```

#### 7. Error Handling with Comprehensive Logging

```typescript
const logger = createContextLogger({ component: 'CardEditor' });

const handleSave = async (): Promise<void> => {
  const startTime = Date.now();

  logger.info('Saving card changes', {
    cardId,
    fieldsModified: Object.keys(changes),
    changeCount: Object.keys(changes).length
  });

  try {
    const result = await updateCard({
      id: cardId,
      ...changes
    });

    logger.info('Card saved successfully', {
      cardId,
      duration: Date.now() - startTime,
      fieldsUpdated: Object.keys(changes)
    });

    return result;
  } catch (error) {
    logger.error('Failed to save card', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      cardId,
      changes,
      duration: Date.now() - startTime,
      retryCount: 0
    });

    // Re-throw for error boundary
    throw error;
  }
};
```

#### 8. Async Operations and Promises

```typescript
const logger = createContextLogger({ component: 'DataFetcher' });

const fetchData = useCallback(async (): Promise<void> => {
  logger.debug('Starting data fetch', {
    canvasId,
    filters: activeFilters
  });

  try {
    const data = await queryData({ canvasId });

    logger.info('Data fetched successfully', {
      canvasId,
      recordCount: data.length,
      duration: performance.now() - startTime
    });
  } catch (error) {
    logger.error('Data fetch failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      canvasId,
      filters: activeFilters
    });
    throw error;
  }
}, [canvasId, activeFilters]);
```

#### 9. Explicit Return Types for Callbacks

Always specify return types for event handlers and callbacks:

```typescript
const logger = createContextLogger({ component: 'ActionHandler' });

// ✅ Good: Explicit return types
const handleClick = useCallback((): void => {
  logger.debug('Button clicked', { buttonId });
  performAction();
}, [buttonId, performAction]);

const handleAsyncAction = useCallback(async (): Promise<void> => {
  logger.info('Starting async action', { actionType });
  await performAsyncAction();
  logger.info('Async action completed', { actionType });
}, [actionType, performAsyncAction]);

const handleFormSubmit = useCallback((e: React.FormEvent): void => {
  e.preventDefault();
  logger.info('Form submitted', { formId });
  submitForm();
}, [formId, submitForm]);

// ❌ Bad: No return types
const handleClick = useCallback(() => {
  logger.debug('Button clicked', { buttonId });
  performAction();
}, [buttonId, performAction]);
```

#### 10. Logger Context Patterns

Use appropriate context keys based on the module type:

```typescript
// Components
const logger = createContextLogger({ component: 'CardList' });

// Custom hooks
const logger = createContextLogger({ hook: 'useCardOperations' });

// Utility functions
const logger = createContextLogger({ utility: 'canvasPositioning' });

// Store actions
const logger = createContextLogger({ store: 'cardStore' });

// Service modules
const logger = createContextLogger({ service: 'CanvasService' });
```

------

## Testing Patterns

### Testing Integration Patterns

**Critical Lesson**: When modifying existing components to add new dependencies (especially context providers like Apollo Client), ALL existing tests must be updated to provide those dependencies. This is a common source of test failures that can break CI/CD pipelines.

#### Dependency Addition Checklist

When adding a new dependency to an existing component:

1. **Identify all affected tests**:
```bash
# Find all test files that import or test the modified component
grep -r "ComponentName" --include="*.test.tsx" --include="*.test.ts"
grep -r "ComponentName" --include="*.spec.tsx" --include="*.spec.ts"
```

2. **Update test wrappers to provide required context**:
```typescript
// BEFORE: Test without Apollo dependency
import { render } from '@testing-library/react';
import { EditModeManager } from '../EditModeManager';

test('renders correctly', () => {
  render(<EditModeManager />); // ❌ Will fail after adding Apollo dependency
});

// AFTER: Test with Apollo MockedProvider
import { render } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { EditModeManager } from '../EditModeManager';

test('renders correctly', () => {
  render(
    <MockedProvider mocks={[]} addTypename={false}>
      <EditModeManager />
    </MockedProvider>
  ); // ✅ Provides required Apollo context
});
```

3. **Run the FULL test suite** - not just your new tests:
```bash
# Don't just run your new tests
npm test EditModeManager.simple.test.tsx  # ❌ Insufficient

# Run ALL tests for the component and related features
npm test EditModeManager  # ✅ Catches all affected tests
npm test canvas/editing  # ✅ Catches related component tests
npm test  # ✅ Best - catches unexpected dependencies
```

#### Provider Hierarchy Pattern

When components require multiple providers, maintain consistent hierarchy:

```typescript
// Reusable test wrapper for components with multiple dependencies
const TestWrapper: React.FC<{ children: React.ReactNode; mocks?: any[] }> = ({
  children,
  mocks = []
}) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <StoreProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </StoreProvider>
  </MockedProvider>
);

// Usage in tests
test('component with multiple dependencies', () => {
  render(
    <TestWrapper mocks={apolloMocks}>
      <ComplexComponent />
    </TestWrapper>
  );
});
```

#### Component Context Requirements Documentation

Components should clearly document their context dependencies:

```typescript
/**
 * EditModeManager Component
 *
 * Required Context Providers:
 * - Apollo Client (via MockedProvider in tests)
 * - CardStore (via StoreProvider)
 *
 * @requires Apollo Client context for useCardOperations hook
 * @requires CardStore for local state management
 */
export const EditModeManager: React.FC<Props> = ({ children }) => {
  const { updateCard } = useCardOperations(); // Requires Apollo
  const { cards } = useCardStore(); // Requires store
  // ...
};
```

### Common Testing Pitfalls

#### The Apollo Client Context Missing Error

**Symptom**: `Invariant Violation: Could not find "client" in the context or passed in as an option`

**Cause**: Component uses Apollo hooks (useQuery, useMutation, etc.) but test doesn't provide MockedProvider

**Solution**: Always wrap components using Apollo in MockedProvider:
```typescript
// Create a helper for consistent Apollo test setup
export const renderWithApollo = (
  component: React.ReactElement,
  { mocks = [], ...options }: any = {}
) => {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      {component}
    </MockedProvider>,
    options
  );
};
```

#### The "TDD for New Features but Forgetting Existing Tests" Anti-Pattern

**Problem**: You follow TDD perfectly for new features but break 149 existing tests by adding a dependency to a shared component.

**Real Example**: Adding `useCardOperations` (Apollo hook) to `EditModeManager` broke all existing tests that didn't provide MockedProvider.

**Prevention Strategy**:
1. Before modifying shared components, run existing tests first
2. After adding dependencies, run tests again before writing new ones
3. Update existing tests to provide new dependencies
4. Then proceed with TDD for new functionality

#### Identifying When Tests Need Provider Updates

**Red Flags** that indicate missing providers:
- `Cannot read property 'store' of undefined` - Missing store provider
- `useContext must be used within a Provider` - Missing specific context
- `Invalid hook call` - Often missing provider or incorrect test setup
- `Invariant Violation` with Apollo - Missing MockedProvider
- Theme-related errors - Missing ThemeProvider

**Proactive Detection**:
```typescript
// Add this to your component to make dependencies explicit
if (typeof window !== 'undefined' && !client) {
  console.warn('EditModeManager requires Apollo Client context');
}
```

### Test Maintenance Best Practices

#### Creating Reusable Test Utilities

```typescript
// test-utils/providers.tsx
export const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mockClient = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { errorPolicy: 'all' },
      mutate: { errorPolicy: 'all' },
    },
  });

  return (
    <ApolloProvider client={mockClient}>
      <StoreProvider>
        {children}
      </StoreProvider>
    </ApolloProvider>
  );
};

// Custom render function
export const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  return render(ui, {
    wrapper: AllProviders,
    ...options,
  });
};
```

#### Test File Organization Pattern

```typescript
// EditModeManager.test.tsx - Organized for clarity
import { MockedProvider } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import { EditModeManager } from '../EditModeManager';

// 1. Document required providers at the top
/**
 * Test Requirements:
 * - Apollo MockedProvider (for useCardOperations)
 * - CardStore mock (for useCardStore)
 */

// 2. Define mocks and test data
const apolloMocks = [...];
const storeMocks = {...};

// 3. Create test-specific wrapper
const renderEditModeManager = (props = {}, mocks = apolloMocks) => {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <EditModeManager {...props} />
    </MockedProvider>
  );
};

// 4. Use consistent wrapper in all tests
describe('EditModeManager', () => {
  test('handles edit mode correctly', () => {
    renderEditModeManager({ cardId: 'test-1' });
    // ... test implementation
  });
});
```

#### Regression Testing Strategy

When modifying shared components:

1. **Create a regression test checklist**:
```typescript
// Before making changes to shared component
describe('EditModeManager - Regression Tests', () => {
  test.todo('All existing Canvas tests pass');
  test.todo('All existing Card tests pass');
  test.todo('All parent component tests pass');
  test.todo('Integration tests still work');
});
```

2. **Run progressive test suites**:
```bash
# Level 1: Component tests
npm test EditModeManager

# Level 2: Feature tests
npm test canvas/editing

# Level 3: Related feature tests
npm test canvas

# Level 4: Full suite
npm test
```

3. **Document breaking changes**:
```typescript
// BREAKING CHANGE: Added Apollo Client dependency
// All tests using EditModeManager must now provide MockedProvider
// See: EditModeManager.test.tsx for examples
```

### Quick Reference: Test Update Checklist

When adding dependencies to existing components:

- [ ] **Before changes**: Run `npm test [component]` to ensure tests pass
- [ ] **Add dependency**: Implement your feature/change
- [ ] **Find affected tests**: `grep -r "ComponentName" --include="*.test.*"`
- [ ] **Update test setup**: Add required providers (MockedProvider, etc.)
- [ ] **Run component tests**: `npm test [component]`
- [ ] **Run feature tests**: `npm test [feature-folder]`
- [ ] **Run full suite**: `npm test` (before committing)
- [ ] **Document requirements**: Add `@requires` comments to component
- [ ] **Update test utilities**: Add reusable wrappers if needed
- [ ] **Commit message**: Note if tests were updated for new dependencies

**Remember**: A component modification that breaks 149 tests is a failed modification, even if your 3 new tests pass perfectly!

### Backend Service Testing

**Current Working Pattern**: Follow the Jest + service layer testing approach:

```typescript
describe('WorkspaceService', () => {
  let workspaceService: WorkspaceService;

  beforeEach(() => {
    workspaceService = new WorkspaceService();
  });

  describe('createWorkspace', () => {
    it('should create workspace with valid input', async () => {
      // Arrange
      const input = {
        name: 'Test Workspace',
        ownerId: 'user-id',
        privacy: 'private' as const,
      };

      // Act
      const result = await workspaceService.createWorkspace(input);

      // Assert
      expect(result).toMatchObject({
        name: 'Test Workspace',
        ownerId: 'user-id',
        privacy: 'PRIVATE',
      });
    });

    it('should throw ValidationError for invalid input', async () => {
      const input = { name: '' }; // Invalid

      await expect(
        workspaceService.createWorkspace(input as any)
      ).rejects.toThrow(ValidationError);
    });
  });
});
```

### Dependency Injection for Testability

**Pattern**: Design components with dependency injection in mind to simplify testing:

```typescript
// BAD: Hard dependency on Apollo hook makes testing difficult
export const CardEditor: React.FC<Props> = ({ cardId }) => {
  const { updateCard } = useCardOperations(); // Hard dependency
  // Component logic...
};

// GOOD: Optional dependency injection for testing
export const CardEditor: React.FC<Props & {
  updateCard?: (id: string, data: any) => Promise<void>
}> = ({ cardId, updateCard: updateCardProp }) => {
  const { updateCard: updateCardHook } = useCardOperations();
  const updateCard = updateCardProp || updateCardHook; // Use injected or default
  // Component logic...
};

// In tests, you can now inject mocks directly
test('updates card', async () => {
  const mockUpdate = jest.fn();
  render(<CardEditor cardId="1" updateCard={mockUpdate} />);
  // No need for MockedProvider if not testing Apollo integration
});
```

### Frontend Hook Testing

**Current Working Pattern**: React Testing Library with Apollo mocks:

```typescript
import { renderHook, act } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { useCardCreation } from '../useCardCreation';

const mocks = [
  {
    request: {
      query: CREATE_CARD,
      variables: { input: expectedInput },
    },
    result: {
      data: { createCard: mockCard },
    },
  },
];

describe('useCardCreation', () => {
  it('should create card successfully', async () => {
    const { result } = renderHook(
      () => useCardCreation({ workspaceId: 'workspace-1' }),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        ),
      }
    );

    await act(async () => {
      const cardId = await result.current.createCardAtPosition(
        'text',
        { x: 0, y: 0, z: 1 }
      );
      expect(cardId).toBe(mockCard.id);
    });
  });
});
```

### Component Testing Pattern

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { EntityComponent } from '../EntityComponent';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MockedProvider mocks={mocks}>
    {children}
  </MockedProvider>
);

describe('EntityComponent', () => {
  it('should handle entity selection', () => {
    render(
      <EntityComponent config={mockConfig} />,
      { wrapper: TestWrapper }
    );

    const entity = screen.getByTestId('entity-1');
    fireEvent.click(entity);

    expect(screen.getByTestId('selected-indicator')).toBeInTheDocument();
  });
});
```

---

## Performance Guidelines

### Database Query Optimization

**1. Use Proper Indexes**
```sql
-- For workspace-scoped queries
CREATE INDEX CONCURRENTLY idx_cards_workspace_id ON cards(workspace_id);

-- For vector similarity (current working pattern)
CREATE INDEX CONCURRENTLY idx_cards_embedding_cosine
ON cards USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**2. Efficient Query Patterns**
```typescript
// Good: Workspace-scoped with pagination
const getWorkspaceCards = async (workspaceId: string, limit: number, offset: number) => {
  return knex('cards')
    .where('workspace_id', workspaceId)
    .where('status', '!=', 'deleted')
    .orderBy('updated_at', 'desc')
    .limit(limit)
    .offset(offset);
};

// Bad: N+1 queries
// Don't do this - use proper JOIN or batch loading
```

### Frontend Performance Patterns

**1. Memoization Strategy**
```typescript
// Memoize expensive operations
const expensiveCalculation = useMemo(() => {
  return cards.filter(card => /* complex filter */).sort(/* complex sort */);
}, [cards, filters]);

// Memoize callbacks to prevent re-renders
const handleCardClick = useCallback((cardId: string) => {
  selectCard(cardId);
}, [selectCard]);
```

**2. Apollo Cache Standards**

**Cache Policy Decision Matrix**: Choose the right policy based on your data type.

### For Collaborative Data (Cards, Workspaces)
**Use**: `cache-and-network` + `refetchOnWindowFocus`
**When**: Data that multiple users can modify, needs multi-device sync

```typescript
// ✅ Cards, workspaces, shared content
const { data: cards } = useQuery(GET_CARDS, {
  fetchPolicy: 'cache-and-network',
  refetchOnWindowFocus: true,           // Sync when switching devices
  variables: { workspaceId }
});
```

### For Static Profile Data (User Info, Settings)
**Use**: `cache-first` with long TTL
**When**: User profile data, settings that rarely change

```typescript
// ✅ User profiles, app settings, static content
const { data: userProfile } = useQuery(GET_USER_PROFILE, {
  fetchPolicy: 'cache-first',           // Use cache unless expired
  context: {
    headers: { 'Cache-Control': 'max-age=3600' } // 1 hour cache
  }
});
```

### For Real-Time Collaboration Features
**Use**: GraphQL subscriptions
**When**: Live cursors, real-time editing, notifications

```typescript
// ✅ Real-time collaboration features (when implemented)
const { data: liveUpdates } = useSubscription(WORKSPACE_UPDATES, {
  variables: { workspaceId },
  onData: ({ data }) => {
    // Handle real-time updates from other users
  }
});
```

### For Frequently Changing Data (Activity Feeds)
**Use**: Polling with `cache-and-network`
**When**: Activity logs, notifications, frequently updated lists

```typescript
// ✅ Activity feeds, notification counts
const { data: activities } = useQuery(GET_ACTIVITIES, {
  fetchPolicy: 'cache-and-network',
  pollInterval: 60000,                  // Check every minute
  variables: { workspaceId }
});
```

**Standard Mutation Pattern**: Always update cache optimistically

```typescript
// ✅ STANDARD: All mutations must update cache like this
const [createCard] = useMutation(CREATE_CARD, {
  update: (cache, { data }) => {
    const existing = cache.readQuery({ query: GET_CARDS, variables });
    if (existing && data?.createCard) {
      cache.writeQuery({
        query: GET_CARDS,
        variables,
        data: {
          cards: {
            ...existing.cards,
            items: [data.createCard, ...existing.cards.items],
          },
        },
      });
    }
  }
});
```

**Decision Flowchart**:
1. **Is it collaborative data?** → `cache-and-network` + `refetchOnWindowFocus`
2. **Is it static user data?** → `cache-first` + long TTL
3. **Need real-time updates?** → GraphQL subscriptions
4. **Frequently changing feed?** → `cache-and-network` + polling
5. **Default fallback** → `cache-and-network`

**3. Canvas Rendering Optimization**
```typescript
// Current working pattern in Konva.js integration
const CardRenderer = React.memo(({ card, isSelected, onSelect }) => {
  // Memoize expensive calculations
  const cardStyle = useMemo(() => ({
    // Calculate styles
  }), [card.style, isSelected]);

  return (
    <Group>
      {/* Konva components */}
    </Group>
  );
});
```

---

## Common Anti-Patterns

### ❌ What to Avoid

**1. Mixing UI State and Server Data in Stores**
```typescript
// DON'T: Store server data in Zustand
interface BadStore {
  cards: Card[]; // This belongs in Apollo cache
  selectedIds: Set<string>; // This is OK
}

// DO: Keep server data in Apollo, UI state in Zustand
interface GoodStore {
  selectedIds: Set<string>; // UI state only
}
```

**2. Direct Database Access in Resolvers**
```typescript
// DON'T: Database queries in resolvers
const resolvers = {
  Query: {
    cards: async () => {
      return knex('cards').select('*'); // Bypass service layer
    }
  }
};

// DO: Delegate to service layer
const resolvers = {
  Query: {
    cards: async (_, args, { services }) => {
      return services.card.getCards(args);
    }
  }
};
```

**3. Missing Input Validation**
```typescript
// DON'T: Trust input data
const createCard = async (input: any) => {
  return knex('cards').insert(input); // Dangerous!
};

// DO: Validate all inputs
const createCard = async (input: CreateCardInput) => {
  const validatedInput = createCardSchema.parse(input);
  // Safe to proceed
};
```

**4. Inconsistent Error Handling**
```typescript
// DON'T: Swallow errors
const operation = async () => {
  try {
    await riskyOperation();
  } catch (error) {
    console.log('Something went wrong'); // Lost context!
  }
};

// DO: Proper error handling and logging
const operation = async () => {
  try {
    await riskyOperation();
  } catch (error) {
    logger.error('Operation failed', {
      operation: 'specific-operation',
      error: error instanceof Error ? error.message : 'Unknown error',
      context: { /* relevant context */ }
    });
    throw error; // Re-throw for caller to handle
  }
};
```

**5. Inconsistent Enum Usage**
```typescript
// DON'T: Mix enum formats across layers
// Frontend
interface WorkspaceUI {
  privacy: 'PRIVATE' | 'PUBLIC'; // UPPERCASE
}

// Backend service
const workspace = {
  privacy: 'private' // lowercase
};

// Database
// privacy column stores: 'Private' // TitleCase - DISASTER!

// DO: Use consistent TypeScript enums everywhere
export enum WorkspacePrivacy {
  PRIVATE = 'private',
  PUBLIC = 'public'
}

// All layers use the same values:
// Database: 'private'
// GraphQL: 'private'
// Frontend: WorkspacePrivacy.PRIVATE (resolves to 'private')
// Backend: WorkspacePrivacy.PRIVATE (resolves to 'private')
```

---

## Reference Examples

### Complete Feature Implementation

**Backend Service (`CardService.ts`)**
- ✅ Input validation with Zod schemas
- ✅ Comprehensive error handling and logging
- ✅ Transaction safety for complex operations
- ✅ Proper data mapping between layers
- ✅ Batch operations for performance

**Frontend Hook (`useCardCreation.ts`)**
- ✅ Clear separation of UI state vs server operations
- ✅ Apollo cache integration with automatic updates
- ✅ Memoized callbacks for performance
- ✅ Comprehensive error handling

**Frontend Store (`cardStore.ts`)**
- ✅ UI state only (selection, drag state)
- ✅ Proper persistence handling with serialization
- ✅ Immutable state updates
- ✅ TypeScript integration with selectors

### GraphQL Integration Pattern

**Schema Definition**
```graphql
type Card {
  id: ID!
  title: String!
  content: String!
  type: CardType!
  position: Position!
  dimensions: Dimensions!
  # ... other fields
}

input CreateCardInput {
  workspaceId: ID!
  type: CardType!
  title: String!
  content: String!
  position: PositionInput!
  dimensions: DimensionsInput!
  # ... other inputs
}
```

**Generated TypeScript Types**
```typescript
// Auto-generated from GraphQL schema
export interface CreateCardMutationVariables {
  input: CreateCardInput;
}

export interface CardResponse {
  id: string;
  title: string;
  content: string;
  type: CardType;
  position: Position;
  dimensions: Dimensions;
}
```

---

## Architecture Decision Records

### ADR-001: State Management Architecture

**Status**: Adopted
**Date**: 2025-09-26

**Decision**: Use Zustand for UI state, Apollo Client for server state

**Rationale**:
- Clear separation of concerns
- Apollo provides caching and synchronization
- Zustand is lightweight for UI state
- Prevents data duplication and sync issues

**Consequences**:
- ✅ Clear mental model for developers
- ✅ Automatic cache management
- ❌ Requires discipline to not mix state types

### ADR-002: Service Layer Pattern

**Status**: Adopted
**Date**: 2025-09-26

**Decision**: All database operations through service layer

**Rationale**:
- Business logic centralization
- Consistent validation and error handling
- Transaction management
- Testability

**Consequences**:
- ✅ Maintainable and testable code
- ✅ Consistent patterns across features
- ❌ Additional abstraction layer

### ADR-003: GraphQL-First API Design

**Status**: Adopted
**Date**: 2025-09-26

**Decision**: Single GraphQL endpoint with typed resolvers

**Rationale**:
- Strong TypeScript integration
- Efficient data fetching
- Single API contract
- Real-time capabilities

**Consequences**:
- ✅ Better developer experience
- ✅ Reduced over-fetching
- ❌ GraphQL learning curve

---

## Conclusion

This living architecture guide reflects the **current working state** of Project Nexus and provides practical guidelines for maintaining consistency as the codebase grows. The patterns documented here are proven to work in the current implementation and should be followed for new development.

**Key Takeaways**:

1. **Follow Proven Patterns**: Use the working examples as templates
2. **Maintain Separation**: Keep UI state and server state clearly separated
3. **Validate Everything**: All inputs must be validated before processing
4. **Handle Errors Properly**: Comprehensive error handling and logging
5. **Test Systematically**: Follow established testing patterns
6. **Monitor Performance**: Use established optimization patterns

**Next Steps**:

- Update this guide as new patterns emerge
- Add new ADRs for significant architectural decisions
- Refactor inconsistent code to match established patterns
- Create additional templates for common scenarios

This guide should be the **authoritative reference** for all architectural decisions and implementation patterns in Project Nexus.