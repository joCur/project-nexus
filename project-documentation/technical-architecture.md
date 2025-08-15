# Project Nexus - Technical Architecture Specification

## Executive Summary

### Project Overview
Project Nexus is an AI-powered visual knowledge workspace that transforms scattered thoughts into an interconnected knowledge graph. The system combines infinite canvas visualization, intelligent content analysis, and cross-platform synchronization to create a novel approach to personal knowledge management.

### Key Architectural Decisions
- **Frontend Strategy**: Next.js 14 (web) + Flutter 3.0 (mobile) for optimal platform-native experiences
- **Backend Architecture**: Node.js with GraphQL API providing unified data access layer
- **Authentication Provider**: Auth0 with MFA, brute force protection, and GDPR compliance features
- **Data Strategy**: PostgreSQL with pgvector extension for structured data and vector embeddings + Redis for caching
- **AI Pipeline**: OpenAI/Claude API for embeddings with PostgreSQL pgvector for similarity search and connection detection
- **Infrastructure**: AWS-based microservices with auto-scaling and global CDN distribution

### System Component Overview
```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Next.js Web App]
        MOB[Flutter Mobile App]
    end
    
    subgraph "API Layer"
        GQL[GraphQL API Gateway]
        REST[REST Endpoints]
    end
    
    subgraph "Core Services"
        AUTH[Auth0 Integration Service]
        CARD[Card Management Service]
        AI[AI Processing Service]
        SYNC[Sync Service]
    end
    
    subgraph "External Services"
        AUTH0[Auth0 Authentication]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL + pgvector)]
        REDIS[(Redis Cache)]
        S3[(S3 Storage)]
    end
    
    WEB --> GQL
    MOB --> GQL
    GQL --> AUTH
    GQL --> CARD
    GQL --> AI
    GQL --> SYNC
    
    AUTH --> AUTH0
    CARD --> PG
    AI --> PG
    AUTH --> REDIS
    CARD --> S3
```

### Critical Technical Constraints
- Support 10,000 concurrent users with <2s response times
- Handle 100,000 cards per user without performance degradation
- Maintain offline-first architecture with conflict resolution
- Ensure AI processing doesn't block user interactions
- Provide cross-platform feature parity

---

## Technology Stack Architecture

### Frontend Architecture

#### Web Application (Next.js 14)
**Framework Selection Rationale:**
- Next.js 14 provides excellent performance with App Router and Server Components
- Built-in optimization for large-scale canvas rendering with React 18 concurrent features
- Superior SEO capabilities for public workspace sharing
- Robust TypeScript integration for type-safe development

**Core Technologies:**
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5.0+
- **Authentication**: Auth0 Next.js SDK with Universal Login
- **State Management**: Zustand for client state + React Query for server state
- **Canvas Rendering**: Konva.js for high-performance 2D graphics
- **Styling**: Tailwind CSS with Headless UI components
- **Real-time**: Socket.io client for live collaboration

**State Management Strategy:**
```typescript
// Zustand store structure
interface AppStore {
  // Canvas state
  canvas: {
    viewport: { x: number; y: number; zoom: number };
    selectedCards: string[];
    dragState: DragState | null;
  };
  
  // UI state
  ui: {
    sidebarOpen: boolean;
    searchOpen: boolean;
    aiPanelOpen: boolean;
  };
  
  // App state
  app: {
    currentWorkspace: string;
    syncStatus: 'idle' | 'syncing' | 'error';
    aiProcessing: boolean;
  };
}
```

**Auth0 Integration (Next.js):**
```typescript
// app/auth/callback/route.ts - Auth0 callback handler
import { handleAuth, handleCallback } from '@auth0/nextjs-auth0';

export const GET = handleAuth({
  callback: handleCallback({
    afterCallback: async (req, session) => {
      // Sync user to our database after Auth0 authentication
      await syncUserToDatabase(session.user);
      return session;
    }
  })
});

// lib/auth0-config.ts - Auth0 configuration
export const auth0Config = {
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  baseURL: process.env.AUTH0_BASE_URL!,
  secret: process.env.AUTH0_SECRET!,
  session: {
    cookie: {
      domain: process.env.NODE_ENV === 'production' ? '.nexus.app' : undefined,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    },
    absoluteDuration: 4 * 60 * 60 // 4 hours as recommended by security analyst
  }
};

// hooks/use-auth.ts - Auth0 hooks for components
import { useUser } from '@auth0/nextjs-auth0/client';

export function useAuth() {
  const { user, error, isLoading } = useUser();
  
  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    logout: () => window.location.href = '/api/auth/logout',
    login: () => window.location.href = '/api/auth/login'
  };
}

// components/auth/ProtectedRoute.tsx
import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';

export const ProtectedRoute = withPageAuthRequired(
  function ProtectedPage({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  },
  {
    returnTo: '/workspace'
  }
);
```

**Component Architecture:**
- **Layout Components**: Header, Sidebar, Canvas Container
- **Canvas Components**: InfiniteCanvas, Card, Connection, Minimap
- **Input Components**: MarkdownEditor, SearchBox, TagInput
- **Modal Components**: ShareDialog, SettingsModal, ConflictResolver

#### Mobile Application (Flutter 3.0)
**Framework Selection Rationale:**
- Single codebase for iOS and Android with native performance
- Excellent canvas manipulation capabilities with CustomPainter
- Strong offline support with built-in SQLite integration
- Consistent UI across platforms while respecting platform conventions

**Core Technologies:**
- **Framework**: Flutter 3.0 with Dart 3.0
- **Authentication**: Auth0 Flutter SDK with biometric integration
- **State Management**: Riverpod for dependency injection and state
- **Local Storage**: Drift (SQLite) for offline-first data
- **Networking**: Dio for HTTP with retry policies
- **Canvas**: CustomPainter for high-performance drawing

**Mobile-Specific Architecture:**
```dart
// lib/auth/auth0_service.dart - Auth0 Flutter integration
import 'package:auth0_flutter/auth0_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class Auth0Service {
  static const _storage = FlutterSecureStorage();
  late final Auth0 auth0;
  
  Auth0Service() {
    auth0 = Auth0(
      dotenv.env['AUTH0_DOMAIN']!,
      dotenv.env['AUTH0_CLIENT_ID']!,
    );
  }
  
  Future<Credentials?> login() async {
    try {
      final credentials = await auth0.webAuthentication().login(
        audience: dotenv.env['AUTH0_AUDIENCE'],
        scopes: {'openid', 'profile', 'email', 'offline_access'}
      );
      
      await _storeCredentials(credentials);
      return credentials;
    } catch (e) {
      print('Auth0 login failed: $e');
      return null;
    }
  }
  
  Future<void> logout() async {
    try {
      await auth0.webAuthentication().logout();
      await _storage.deleteAll();
    } catch (e) {
      print('Auth0 logout failed: $e');
    }
  }
  
  Future<Credentials?> refreshToken() async {
    final refreshToken = await _storage.read(key: 'refresh_token');
    if (refreshToken == null) return null;
    
    try {
      final credentials = await auth0.api.renewCredentials(
        refreshToken: refreshToken
      );
      await _storeCredentials(credentials);
      return credentials;
    } catch (e) {
      print('Token refresh failed: $e');
      return null;
    }
  }
  
  Future<void> _storeCredentials(Credentials credentials) async {
    await _storage.write(key: 'access_token', value: credentials.accessToken);
    await _storage.write(key: 'refresh_token', value: credentials.refreshToken);
    await _storage.write(key: 'id_token', value: credentials.idToken);
  }
}

// lib/providers/auth_provider.dart - Riverpod auth state
final authServiceProvider = Provider<Auth0Service>((ref) => Auth0Service());

final authStateProvider = FutureProvider<AuthState>((ref) async {
  final authService = ref.read(authServiceProvider);
  
  // Check for stored credentials on app start
  const storage = FlutterSecureStorage();
  final accessToken = await storage.read(key: 'access_token');
  
  if (accessToken != null) {
    // Try to refresh token to verify validity
    final credentials = await authService.refreshToken();
    if (credentials != null) {
      return AuthState.authenticated(credentials.user);
    }
  }
  
  return const AuthState.unauthenticated();
});

// Core app structure
class NexusApp extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      home: ref.watch(authStateProvider).when(
        data: (authState) => authState.when(
          authenticated: (user) => WorkspaceScreen(),
          unauthenticated: () => LoginScreen(),
        ),
        loading: () => SplashScreen(),
        error: (error, stack) => ErrorScreen(error: error),
      ),
    );
  }
}

// Auth state classes
@freezed
class AuthState with _$AuthState {
  const factory AuthState.authenticated(User user) = _Authenticated;
  const factory AuthState.unauthenticated() = _Unauthenticated;
}
```

### Backend Architecture

#### API Design Philosophy
**GraphQL-First Approach:**
- Single endpoint reduces client complexity
- Strong typing enables better developer experience
- Efficient data fetching with field-level granularity
- Real-time subscriptions for collaborative features

#### Core Services Architecture

**1. Auth0 Integration Service**
```typescript
interface Auth0IntegrationService {
  // Auth0 JWT validation and user management
  validateAuth0Token(token: string): Promise<Auth0User | null>;
  syncUserToDatabase(auth0User: Auth0User): Promise<User>;
  getUserPermissions(userId: string): Promise<Permission[]>;
  
  // Authorization with Auth0 user context
  checkPermission(userId: string, resource: string, action: string): Promise<boolean>;
  getUserWorkspaces(userId: string): Promise<string[]>;
}

interface Auth0User {
  sub: string; // Auth0 user ID
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  updated_at: string;
  // Custom app metadata
  app_metadata?: {
    roles?: string[];
    permissions?: string[];
  };
}
```

**2. Card Management Service**
```typescript
interface CardService {
  createCard(workspaceId: string, cardData: CreateCardInput): Promise<Card>;
  updateCard(cardId: string, updates: UpdateCardInput): Promise<Card>;
  deleteCard(cardId: string): Promise<boolean>;
  
  // Batch operations for performance
  batchUpdatePositions(updates: CardPositionUpdate[]): Promise<Card[]>;
  searchCards(workspaceId: string, query: SearchQuery): Promise<CardSearchResult>;
}
```

**3. AI Processing Service**
```typescript
interface AIService {
  generateEmbedding(content: string): Promise<number[]>;
  findSimilarCards(embedding: number[], threshold: number): Promise<SimilarCard[]>;
  analyzeConnections(cards: Card[]): Promise<Connection[]>;
  processNaturalLanguageQuery(query: string, context: Card[]): Promise<QueryResult>;
}
```

**4. Synchronization Service**
```typescript
interface SyncService {
  syncWorkspace(userId: string, workspaceId: string): Promise<SyncResult>;
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<Card>;
  broadcastChange(change: WorkspaceChange): Promise<void>;
}
```

### Database Architecture

#### Primary Database (PostgreSQL 15 with pgvector Extension)
**pgvector Configuration:**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Configure pgvector settings for optimal performance
SET maintenance_work_mem = '512MB';  -- For index creation
SET max_parallel_maintenance_workers = 2;
```

**Schema Design:**
```sql
-- Users and Auth0 integration
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    auth0_user_id VARCHAR(255) UNIQUE NOT NULL, -- Auth0 'sub' field
    email_verified BOOLEAN DEFAULT FALSE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    last_login TIMESTAMP,
    auth0_updated_at TIMESTAMP, -- From Auth0 'updated_at'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Auth0 metadata cache (for performance)
    roles TEXT[], -- Cached from Auth0 app_metadata.roles
    permissions TEXT[], -- Cached from Auth0 app_metadata.permissions
    metadata_synced_at TIMESTAMP DEFAULT NOW()
);

-- Index for Auth0 user lookup
CREATE INDEX idx_users_auth0_user_id ON users(auth0_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_login ON users(last_login);

-- Workspaces
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Cards - core content entities with vector embeddings
CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'image', 'link', 'code')),
    title VARCHAR(200),
    content TEXT NOT NULL,
    position_x FLOAT DEFAULT 0,
    position_y FLOAT DEFAULT 0,
    width FLOAT DEFAULT 300,
    height FLOAT DEFAULT 200,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    -- Vector embedding column (1536 dimensions for OpenAI ada-002)
    embedding vector(1536),
    -- Embedding metadata for tracking
    embedding_model VARCHAR(50) DEFAULT 'text-embedding-ada-002',
    embedding_created_at TIMESTAMP,
    -- Content hash for detecting changes
    content_hash VARCHAR(64),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- Connections between cards
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
    target_card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
    strength FLOAT NOT NULL DEFAULT 0.0,
    type VARCHAR(20) NOT NULL CHECK (type IN ('ai_suggested', 'user_created', 'manual')),
    accepted BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_card_id, target_card_id)
);

-- Workspace sharing and permissions
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- Sync tracking for offline support
CREATE TABLE sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL,
    entity_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
    data JSONB,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cards_workspace ON cards(workspace_id);
CREATE INDEX idx_cards_position ON cards(position_x, position_y);
CREATE INDEX idx_cards_tags ON cards USING GIN(tags);
CREATE INDEX idx_cards_updated ON cards(updated_at DESC);
CREATE INDEX idx_cards_content_hash ON cards(content_hash);
CREATE INDEX idx_connections_source ON connections(source_card_id);
CREATE INDEX idx_connections_target ON connections(target_card_id);
CREATE INDEX idx_connections_strength ON connections(strength DESC);
CREATE INDEX idx_sync_events_workspace ON sync_events(workspace_id, created_at DESC);

-- Vector similarity indexes for fast nearest neighbor search
-- HNSW index for high recall, good for most use cases
CREATE INDEX idx_cards_embedding_hnsw ON cards 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- IVFFlat index as alternative for memory-constrained environments
-- CREATE INDEX idx_cards_embedding_ivfflat ON cards 
-- USING ivfflat (embedding vector_cosine_ops) 
-- WITH (lists = 100);

-- Partial indexes for cards with embeddings
CREATE INDEX idx_cards_with_embeddings ON cards(workspace_id, updated_at) 
WHERE embedding IS NOT NULL;
```

#### Vector Search with pgvector
**Vector Operations:**
```sql
-- Find similar cards using cosine similarity
SELECT 
    c.id,
    c.title,
    c.content,
    1 - (c.embedding <=> $1::vector) AS similarity
FROM cards c
WHERE 
    c.workspace_id = $2 
    AND c.embedding IS NOT NULL
    AND c.id != $3  -- Exclude source card
ORDER BY c.embedding <=> $1::vector  -- Cosine distance
LIMIT 20;

-- Create embedding with metadata tracking
UPDATE cards 
SET 
    embedding = $1::vector,
    embedding_model = $2,
    embedding_created_at = NOW(),
    content_hash = $3
WHERE id = $4;

-- Batch similarity search for multiple cards
WITH target_embeddings AS (
    SELECT id, embedding 
    FROM cards 
    WHERE id = ANY($1::uuid[])
)
SELECT 
    te.id as source_id,
    c.id as target_id,
    1 - (c.embedding <=> te.embedding) AS similarity
FROM target_embeddings te
CROSS JOIN cards c
WHERE 
    c.workspace_id = $2
    AND c.embedding IS NOT NULL
    AND c.id != te.id
    AND (c.embedding <=> te.embedding) < 0.3  -- Similarity threshold
ORDER BY te.id, (c.embedding <=> te.embedding);
```

**pgvector Performance Configuration:**
```typescript
interface VectorConfig {
  // HNSW index parameters
  hnsw: {
    m: 16;              // Max connections per node
    efConstruction: 64;  // Search width during construction
    efSearch: 40;       // Search width during query
  };
  
  // Similarity thresholds
  similarity: {
    high: 0.8;     // Strong connection
    medium: 0.7;   // Moderate connection
    low: 0.6;      // Weak connection
    threshold: 0.5; // Minimum for consideration
  };
  
  // Batch processing limits
  batch: {
    maxCardsPerQuery: 100;
    maxSimilarResults: 20;
    timeoutMs: 5000;
  };
}
```

#### Caching Strategy (Redis)
```typescript
// Cache key patterns
const CacheKeys = {
  USER_SESSION: (userId: string) => `session:${userId}`,
  WORKSPACE_CARDS: (workspaceId: string) => `workspace:${workspaceId}:cards`,
  VECTOR_SIMILARITIES: (cardId: string) => `vector_sim:${cardId}`,
  SEARCH_RESULTS: (query: string, workspaceId: string) => `search:${workspaceId}:${hashQuery(query)}`,
  EMBEDDING_QUEUE: () => `embedding_queue`,
  CONTENT_HASH: (cardId: string) => `content_hash:${cardId}`
};

// Cache TTL strategy
const CacheTTL = {
  SESSION: 86400, // 24 hours
  CARDS: 3600, // 1 hour
  VECTOR_SIMILARITIES: 7200, // 2 hours (longer for expensive vector ops)
  SEARCH: 1800, // 30 minutes
  CONTENT_HASH: 86400, // 24 hours
  EMBEDDING_QUEUE: 300 // 5 minutes
};
```

---

## Data Models and Schemas

### Core Entity Definitions

#### Card Entity
```typescript
interface Card {
  id: string;
  workspaceId: string;
  type: 'text' | 'image' | 'link' | 'code';
  title?: string;
  content: string;
  position: {
    x: number;
    y: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
  tags: string[];
  metadata: {
    // Type-specific metadata
    imageUrl?: string;
    linkUrl?: string;
    language?: string; // for code cards
    backgroundColor?: string;
    textColor?: string;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  
  // Vector embedding fields (stored directly in PostgreSQL)
  embedding?: number[];           // 1536-dimensional vector from OpenAI
  embeddingModel?: string;        // Model used for embedding (e.g., 'text-embedding-ada-002')
  embeddingCreatedAt?: Date;      // When embedding was generated
  contentHash?: string;           // Hash of content when embedding was created
  
  // Computed fields
  connections?: Connection[];
  similarityScore?: number;       // For search results
}
```

#### Connection Entity
```typescript
interface Connection {
  id: string;
  sourceCardId: string;
  targetCardId: string;
  strength: number; // 0.0 to 1.0
  type: 'ai_suggested' | 'user_created' | 'manual';
  accepted: boolean;
  createdBy: string;
  createdAt: Date;
  
  // Metadata for AI suggestions
  reason?: string; // Why AI suggested this connection
  confidence?: number; // AI confidence score
}
```

#### Workspace Entity
```typescript
interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  settings: {
    aiSensitivity: number; // 0.0 to 1.0
    autoConnect: boolean;
    theme: 'light' | 'dark' | 'auto';
    canvasBackground: string;
    defaultCardType: CardType;
  };
  members: WorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
  
  // Computed fields
  cardCount?: number;
  lastActivity?: Date;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: Date;
  
  // User info (joined from users table)
  user?: {
    displayName: string;
    avatarUrl?: string;
    email: string;
  };
}
```

#### User Entity
```typescript
interface User {
  id: string;
  email: string;
  auth0UserId: string; // Auth0 'sub' field
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
  lastLogin?: Date;
  auth0UpdatedAt?: Date;
  
  // Auth0 metadata cache
  roles: string[];
  permissions: string[];
  metadataSyncedAt: Date;
  
  preferences: {
    aiEnabled: boolean;
    autoSave: boolean;
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
  };
  subscription: {
    tier: 'free' | 'pro' | 'enterprise';
    validUntil?: Date;
    features: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}
```

### AI/ML Data Models

#### Embedding Processing
```typescript
interface EmbeddingJob {
  id: string;
  cardId: string;
  content: string;
  contentHash: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  embedding?: number[];
  error?: string;
  priority: 'low' | 'normal' | 'high';
  retryCount: number;
  createdAt: Date;
  completedAt?: Date;
}

interface SimilarityResult {
  cardId: string;
  similarity: number;              // Cosine similarity score (0-1)
  distance: number;                // Cosine distance used by pgvector
  explanation?: string;
  matchedContent?: string;         // Preview of matched content
  tags?: string[];                 // Shared tags for context
}

interface ConnectionSuggestion {
  sourceCardId: string;
  targetCardId: string;
  confidence: number;
  reason: string;
  semanticSimilarity: number;
  contextualRelevance: number;
  sharedTags: string[];            // Common tags between cards
  temporalProximity?: number;      // How close in time the cards were created
}

// pgvector-specific interfaces
interface VectorSearchQuery {
  embedding: number[];
  workspaceId: string;
  excludeCardIds?: string[];
  similarityThreshold?: number;    // Minimum similarity (default 0.5)
  maxResults?: number;             // Maximum results (default 20)
  includeContent?: boolean;        // Include content preview
}

interface VectorSearchResult {
  cardId: string;
  title?: string;
  content?: string;
  type: string;
  tags: string[];
  similarity: number;
  distance: number;                // Raw pgvector distance
  createdAt: Date;
}
```

#### Query Processing
```typescript
interface NLQuery {
  id: string;
  workspaceId: string;
  userId: string;
  query: string;
  queryEmbedding?: number[];       // Embedding of the search query
  processedQuery: {
    intent: 'search' | 'create' | 'connect' | 'analyze';
    entities: string[];
    concepts: string[];
    keywords: string[];            // Extracted keywords for text search
    temporalConstraints?: {
      from?: Date;
      to?: Date;
    };
  };
  searchStrategy: {
    useVectorSearch: boolean;
    useTextSearch: boolean;
    vectorWeight: number;          // Weight for vector similarity (0-1)
    textWeight: number;           // Weight for text relevance (0-1)
  };
  results: QueryResult[];
  performanceMetrics: {
    vectorSearchTime: number;      // Time for pgvector query (ms)
    textSearchTime: number;       // Time for text search (ms)
    totalTime: number;            // Total processing time (ms)
    resultsCount: number;
  };
  createdAt: Date;
}

interface QueryResult {
  cardId: string;
  relevanceScore: number;
  matchType: 'semantic' | 'keyword' | 'tag' | 'connection' | 'hybrid';
  highlight?: string[];
  vectorSimilarity?: number;       // Raw vector similarity score
  textRank?: number;              // PostgreSQL text search rank
  combinedScore?: number;         // Weighted combination of vector + text
  explanation?: string;           // Why this result was returned
}
```

---

## AI/ML Architecture

### Embedding Generation Pipeline

#### Content Processing Flow
```typescript
class ContentProcessor {
  async processCard(card: Card): Promise<EmbeddingResult> {
    // 1. Content extraction and normalization
    const cleanContent = this.extractTextContent(card);
    const contentHash = this.generateContentHash(cleanContent);
    
    // 2. Check if embedding exists and content hasn't changed
    const existingCard = await this.cardRepository.getById(card.id);
    if (existingCard?.contentHash === contentHash && existingCard.embedding) {
      return {
        embedding: existingCard.embedding,
        similarCards: await this.findSimilarCards(existingCard.embedding, card.workspaceId, card.id)
      };
    }
    
    // 3. Generate embedding
    const embedding = await this.generateEmbedding(cleanContent);
    
    // 4. Store embedding in PostgreSQL
    await this.storeEmbedding(card.id, embedding, contentHash);
    
    // 5. Find similar cards using pgvector
    const similarCards = await this.findSimilarCards(embedding, card.workspaceId, card.id);
    
    return {
      embedding,
      similarCards
    };
  }
  
  private async storeEmbedding(cardId: string, embedding: number[], contentHash: string): Promise<void> {
    await this.db.query(`
      UPDATE cards 
      SET 
        embedding = $1::vector,
        embedding_model = $2,
        embedding_created_at = NOW(),
        content_hash = $3
      WHERE id = $4
    `, [JSON.stringify(embedding), 'text-embedding-ada-002', contentHash, cardId]);
  }
  
  private async findSimilarCards(
    embedding: number[], 
    workspaceId: string, 
    excludeCardId: string
  ): Promise<SimilarCard[]> {
    const result = await this.db.query(`
      SELECT 
        id,
        title,
        content,
        type,
        1 - (embedding <=> $1::vector) AS similarity
      FROM cards
      WHERE 
        workspace_id = $2 
        AND embedding IS NOT NULL
        AND id != $3
        AND (embedding <=> $1::vector) < $4
      ORDER BY embedding <=> $1::vector
      LIMIT $5
    `, [JSON.stringify(embedding), workspaceId, excludeCardId, 0.4, 20]);
    
    return result.rows.map(row => ({
      cardId: row.id,
      title: row.title,
      similarity: parseFloat(row.similarity),
      type: row.type
    }));
  }
  
  private generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
  
  private extractTextContent(card: Card): string {
    switch (card.type) {
      case 'text':
        return this.stripMarkdown(card.content);
      case 'code':
        return this.extractCodeComments(card.content);
      case 'link':
        return card.title || card.metadata.linkUrl || '';
      case 'image':
        return card.title || card.metadata.imageAlt || '';
      default:
        return card.content;
    }
  }
}
```

#### Connection Detection Algorithm
```typescript
class ConnectionDetector {
  private readonly SIMILARITY_THRESHOLD = 0.75;
  private readonly MIN_CONTENT_LENGTH = 10;
  
  async detectConnections(cardId: string): Promise<Connection[]> {
    const card = await this.cardService.getCard(cardId);
    
    if (!card.embedding) {
      throw new Error('Card embedding not found');
    }
    
    // Find semantically similar cards using pgvector
    const similarCards = await this.findSimilarCardsWithDetails(card);
    
    const connections: Connection[] = [];
    
    for (const similar of similarCards) {
      if (similar.similarity >= this.SIMILARITY_THRESHOLD) {
        const reason = await this.explainConnection(card, similar);
        
        connections.push({
          id: generateId(),
          sourceCardId: cardId,
          targetCardId: similar.id,
          strength: similar.similarity,
          type: 'ai_suggested',
          accepted: false,
          createdBy: 'system',
          createdAt: new Date(),
          reason,
          confidence: similar.similarity
        });
      }
    }
    
    return connections;
  }
  
  private async findSimilarCardsWithDetails(sourceCard: Card): Promise<SimilarCardWithContent[]> {
    const result = await this.db.query(`
      SELECT 
        id,
        title,
        content,
        type,
        tags,
        created_at,
        1 - (embedding <=> $1::vector) AS similarity
      FROM cards
      WHERE 
        workspace_id = $2 
        AND embedding IS NOT NULL
        AND id != $3
        AND (embedding <=> $1::vector) < $4
      ORDER BY embedding <=> $1::vector
      LIMIT $5
    `, [
      JSON.stringify(sourceCard.embedding), 
      sourceCard.workspaceId, 
      sourceCard.id, 
      1 - this.SIMILARITY_THRESHOLD, // Convert similarity to distance
      20
    ]);
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content.slice(0, 500), // Preview for explanation
      type: row.type,
      tags: row.tags,
      similarity: parseFloat(row.similarity),
      createdAt: row.created_at
    }));
  }
  
  private async explainConnection(sourceCard: Card, targetCard: any): Promise<string> {
    const prompt = `
      Explain why these two pieces of content might be related in 1-2 sentences:
      
      Content 1: ${sourceCard.content.slice(0, 500)}
      Content 2: ${targetCard.metadata.contentPreview}
      
      Focus on conceptual connections, shared themes, or complementary information.
    `;
    
    const response = await this.aiService.complete(prompt, { maxTokens: 100 });
    return response.trim();
  }
}
```

### Natural Language Query Processing

#### Query Understanding
```typescript
class QueryProcessor {
  async processQuery(query: string, workspaceId: string): Promise<QueryResult[]> {
    // 1. Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    
    // 2. Vector similarity search using pgvector
    const semanticResults = await this.performVectorSearch(queryEmbedding, workspaceId);
    
    // 3. Keyword search for exact matches
    const keywordResults = await this.searchService.searchCards(query, workspaceId);
    
    // 4. Combine and rank results
    const combinedResults = this.combineResults(semanticResults, keywordResults);
    
    // 5. Apply query intent understanding
    const enrichedResults = await this.enrichWithIntent(query, combinedResults);
    
    return enrichedResults;
  }
  
  private async performVectorSearch(
    queryEmbedding: number[], 
    workspaceId: string
  ): Promise<QueryResult[]> {
    const result = await this.db.query(`
      SELECT 
        id,
        title,
        content,
        type,
        tags,
        1 - (embedding <=> $1::vector) AS similarity,
        ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', $3)) as text_rank
      FROM cards
      WHERE 
        workspace_id = $2 
        AND embedding IS NOT NULL
        AND (embedding <=> $1::vector) < 0.5  -- Only include reasonably similar results
      ORDER BY 
        -- Combine vector similarity with text relevance
        (1 - (embedding <=> $1::vector)) * 0.7 + 
        COALESCE(ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', $3)), 0) * 0.3 DESC
      LIMIT 50
    `, [JSON.stringify(queryEmbedding), workspaceId, this.extractKeywords(query)]);
    
    return result.rows.map(row => ({
      cardId: row.id,
      relevanceScore: parseFloat(row.similarity),
      matchType: 'semantic',
      title: row.title,
      content: row.content,
      highlight: this.generateHighlight(row.content, query)
    }));
  }
  
  private extractKeywords(query: string): string {
    // Extract meaningful keywords for text search
    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .join(' ');
  }
  
  private generateHighlight(content: string, query: string): string[] {
    const keywords = this.extractKeywords(query).split(' ');
    const highlights: string[] = [];
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`\b${keyword}\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        highlights.push(...matches);
      }
    });
    
    return highlights;
  }
  
  private async enrichWithIntent(query: string, results: QueryResult[]): Promise<QueryResult[]> {
    const intent = await this.analyzeIntent(query);
    
    switch (intent.type) {
      case 'temporal':
        return this.filterByTimeframe(results, intent.timeframe);
      case 'conceptual':
        return this.boostConceptualMatches(results, intent.concepts);
      case 'relational':
        return this.includeConnectedCards(results);
      default:
        return results;
    }
  }
}
```

### AI Performance Optimization

#### Caching Strategy
```typescript
class EmbeddingCache {
  private readonly CACHE_TTL = 7 * 24 * 60 * 60; // 7 days
  
  async getOrGenerateEmbedding(content: string, cardId?: string): Promise<number[]> {
    const contentHash = this.getContentHash(content);
    
    // Check if card already has embedding for this content
    if (cardId) {
      const existingEmbedding = await this.getExistingEmbedding(cardId, contentHash);
      if (existingEmbedding) {
        return existingEmbedding;
      }
    }
    
    // Check Redis cache
    const cacheKey = this.getCacheKey(contentHash);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Generate new embedding
    const embedding = await this.openaiService.createEmbedding(content);
    
    // Cache for future use
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(embedding));
    
    return embedding;
  }
  
  private async getExistingEmbedding(cardId: string, contentHash: string): Promise<number[] | null> {
    const result = await this.db.query(`
      SELECT embedding 
      FROM cards 
      WHERE id = $1 AND content_hash = $2 AND embedding IS NOT NULL
    `, [cardId, contentHash]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].embedding;
  }
  
  private getContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
  
  private getCacheKey(contentHash: string): string {
    return `embedding:${contentHash}`;
  }
}
```

#### Batch Processing
```typescript
class BatchProcessor {
  private readonly BATCH_SIZE = 10;
  private readonly MAX_CONCURRENT = 3;
  
  async processPendingEmbeddings(): Promise<void> {
    const pendingJobs = await this.embeddingJobService.getPending(this.BATCH_SIZE);
    
    // Process in batches to avoid rate limits
    const batches = this.chunkArray(pendingJobs, this.MAX_CONCURRENT);
    
    for (const batch of batches) {
      await Promise.all(
        batch.map(job => this.processEmbeddingJob(job))
      );
    }
  }
  
  private async processEmbeddingJob(job: EmbeddingJob): Promise<void> {
    try {
      await this.embeddingJobService.updateStatus(job.id, 'processing');
      
      // Generate and store embedding directly in PostgreSQL
      const embedding = await this.embeddingService.generate(job.content);
      await this.storeEmbeddingInDatabase(job.cardId, embedding, job.contentHash);
      
      // Detect connections using pgvector similarity search
      const connections = await this.connectionDetector.detectConnections(job.cardId);
      
      await Promise.all([
        this.embeddingJobService.complete(job.id, embedding),
        this.connectionService.createSuggestions(connections)
      ]);
    } catch (error) {
      await this.embeddingJobService.fail(job.id, error.message);
    }
  }
  
  private async storeEmbeddingInDatabase(
    cardId: string, 
    embedding: number[], 
    contentHash: string
  ): Promise<void> {
    await this.db.query(`
      UPDATE cards 
      SET 
        embedding = $1::vector,
        embedding_model = $2,
        embedding_created_at = NOW(),
        content_hash = $3
      WHERE id = $4
    `, [JSON.stringify(embedding), 'text-embedding-ada-002', contentHash, cardId]);
  }
  
  // Batch process multiple cards for efficiency
  async batchProcessCards(cardIds: string[]): Promise<void> {
    const cards = await this.cardService.getCardsByIds(cardIds);
    const jobs: EmbeddingJob[] = [];
    
    for (const card of cards) {
      const contentHash = this.generateContentHash(card.content);
      
      // Skip if embedding is up to date
      if (card.contentHash === contentHash && card.embedding) {
        continue;
      }
      
      jobs.push({
        id: generateId(),
        cardId: card.id,
        content: card.content,
        contentHash,
        status: 'pending',
        priority: 'normal',
        retryCount: 0,
        createdAt: new Date()
      });
    }
    
    // Add to processing queue
    for (const job of jobs) {
      await this.embeddingJobService.enqueue(job);
    }
  }
  
  private generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
```

---

## API Contract Specifications

### GraphQL Schema Definition

#### Core Types
```graphql
scalar DateTime
scalar JSON

type User {
  id: ID!
  email: String!
  displayName: String
  avatarUrl: String
  preferences: UserPreferences!
  subscription: Subscription!
  createdAt: DateTime!
  lastActiveAt: DateTime
}

type UserPreferences {
  aiEnabled: Boolean!
  autoSave: Boolean!
  theme: Theme!
  language: String!
  timezone: String!
}

type Workspace {
  id: ID!
  name: String!
  owner: User!
  settings: WorkspaceSettings!
  members: [WorkspaceMember!]!
  cards(
    first: Int = 50
    after: String
    filter: CardFilter
  ): CardConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
  cardCount: Int!
  lastActivity: DateTime
}

type WorkspaceSettings {
  aiSensitivity: Float!
  autoConnect: Boolean!
  theme: Theme!
  canvasBackground: String!
  defaultCardType: CardType!
}

type Card {
  id: ID!
  workspace: Workspace!
  type: CardType!
  title: String
  content: String!
  position: Position!
  dimensions: Dimensions!
  tags: [String!]!
  metadata: JSON
  connections: [Connection!]!
  createdBy: User!
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int!
}

type Connection {
  id: ID!
  sourceCard: Card!
  targetCard: Card!
  strength: Float!
  type: ConnectionType!
  accepted: Boolean!
  reason: String
  confidence: Float
  createdBy: User!
  createdAt: DateTime!
}

enum CardType {
  TEXT
  IMAGE
  LINK
  CODE
}

enum ConnectionType {
  AI_SUGGESTED
  USER_CREATED
  MANUAL
}

enum Theme {
  LIGHT
  DARK
  AUTO
}

type Position {
  x: Float!
  y: Float!
}

type Dimensions {
  width: Float!
  height: Float!
}
```

#### Query Operations
```graphql
type Query {
  # User queries
  me: User
  
  # Workspace queries
  workspace(id: ID!): Workspace
  myWorkspaces: [Workspace!]!
  
  # Card queries
  card(id: ID!): Card
  searchCards(
    workspaceId: ID!
    query: String!
    filter: SearchFilter
  ): SearchResult!
  
  # AI queries
  suggestConnections(cardId: ID!): [Connection!]!
  similarCards(cardId: ID!, limit: Int = 10): [Card!]!
  
  # Analytics
  workspaceAnalytics(workspaceId: ID!): WorkspaceAnalytics!
}

type SearchResult {
  cards: [Card!]!
  totalCount: Int!
  query: String!
  processingTime: Float!
}

type WorkspaceAnalytics {
  cardCount: Int!
  connectionCount: Int!
  aiSuggestionsAccepted: Int!
  lastActivity: DateTime
  activeMembers: Int!
}
```

#### Mutation Operations
```graphql
type Mutation {
  # Authentication
  signIn(provider: String!, token: String!): AuthResult!
  signOut: Boolean!
  refreshToken: AuthResult!
  
  # Workspace mutations
  createWorkspace(input: CreateWorkspaceInput!): Workspace!
  updateWorkspace(id: ID!, input: UpdateWorkspaceInput!): Workspace!
  deleteWorkspace(id: ID!): Boolean!
  inviteToWorkspace(workspaceId: ID!, email: String!, role: Role!): WorkspaceMember!
  
  # Card mutations
  createCard(input: CreateCardInput!): Card!
  updateCard(id: ID!, input: UpdateCardInput!): Card!
  deleteCard(id: ID!): Boolean!
  batchUpdateCardPositions(updates: [CardPositionUpdate!]!): [Card!]!
  
  # Connection mutations
  acceptConnection(id: ID!): Connection!
  rejectConnection(id: ID!): Boolean!
  createConnection(input: CreateConnectionInput!): Connection!
  deleteConnection(id: ID!): Boolean!
  
  # AI mutations
  generateEmbedding(cardId: ID!): Boolean!
  triggerAIAnalysis(workspaceId: ID!): Boolean!
}

# Input types
input CreateCardInput {
  workspaceId: ID!
  type: CardType!
  title: String
  content: String!
  position: PositionInput!
  dimensions: DimensionsInput
  tags: [String!]
  metadata: JSON
}

input UpdateCardInput {
  title: String
  content: String
  position: PositionInput
  dimensions: DimensionsInput
  tags: [String!]
  metadata: JSON
}

input CardPositionUpdate {
  id: ID!
  position: PositionInput!
}

input PositionInput {
  x: Float!
  y: Float!
}

input DimensionsInput {
  width: Float!
  height: Float!
}
```

#### Subscription Operations
```graphql
type Subscription {
  # Real-time workspace updates
  workspaceUpdated(workspaceId: ID!): WorkspaceUpdate!
  
  # Card updates
  cardCreated(workspaceId: ID!): Card!
  cardUpdated(workspaceId: ID!): Card!
  cardDeleted(workspaceId: ID!): ID!
  
  # Connection updates
  connectionSuggested(workspaceId: ID!): Connection!
  connectionAccepted(workspaceId: ID!): Connection!
  
  # AI processing updates
  aiProcessingStatus(workspaceId: ID!): AIProcessingUpdate!
}

type WorkspaceUpdate {
  type: String!
  data: JSON!
  timestamp: DateTime!
  userId: ID!
}

type AIProcessingUpdate {
  cardId: ID!
  status: String!
  progress: Float
  error: String
}
```

### REST API Endpoints

#### File Upload/Download
```typescript
// Media upload endpoint
POST /api/v1/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

Request Body:
- file: File (max 10MB)
- workspaceId: string
- cardId?: string

Response:
{
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

// File download with CDN caching
GET /api/v1/files/:fileId
Authorization: Bearer <token>
Cache-Control: public, max-age=31536000

Response: Binary file data
```

#### Export Operations
```typescript
// Workspace export
POST /api/v1/workspaces/:id/export
Authorization: Bearer <token>

Request Body:
{
  format: 'json' | 'markdown' | 'pdf';
  options: {
    includeConnections: boolean;
    includeImages: boolean;
    dateRange?: {
      from: string;
      to: string;
    };
  };
}

Response:
{
  exportId: string;
  status: 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  createdAt: string;
  expiresAt: string;
}

// Export status check
GET /api/v1/exports/:exportId/status
Authorization: Bearer <token>

Response:
{
  status: 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  downloadUrl?: string;
  error?: string;
}
```

#### Webhook Endpoints
```typescript
// AI processing webhook
POST /api/v1/webhooks/ai-processing
Content-Type: application/json
X-Webhook-Signature: <hmac-signature>

Request Body:
{
  eventType: 'embedding.completed' | 'connection.detected' | 'processing.failed';
  cardId: string;
  workspaceId: string;
  data: any;
  timestamp: string;
}
```

---

## Infrastructure Architecture

### Cloud Deployment Strategy

#### AWS Architecture Overview
```yaml
Production Environment:
  Compute:
    - ECS Fargate for API services (auto-scaling)
    - Lambda for background processing
    - CloudFront CDN for global distribution
  
  Storage:
    - RDS PostgreSQL Multi-AZ (primary database)
    - ElastiCache Redis cluster (caching layer)
    - S3 buckets (file storage with versioning)
    - pgvector extension (integrated vector search)
  
  Networking:
    - VPC with public/private subnets
    - Application Load Balancer (ALB)
    - Route53 for DNS management
    - CloudFront for CDN and SSL termination
  
  Security:
    - IAM roles with least privilege
    - WAF for API protection
    - Secrets Manager for credentials
    - Certificate Manager for SSL/TLS
    - Auth0 tenant with MFA and anomaly detection
    - Auth0 Actions for custom authentication flows
```

#### Container Configuration

**Backend Dockerfile (`./backend/Dockerfile`):**
```dockerfile
# API service Dockerfile
FROM node:18-alpine AS base
WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build
COPY . .
RUN npm run build

# Runtime
FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Web Client Dockerfile (`./clients/web/Dockerfile`):**
```dockerfile
# Next.js web app Dockerfile
FROM node:18-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Runtime
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

#### Docker Compose for Development

**Root Docker Compose Configuration:**
```yaml
version: '3.8'

services:
  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://nexus:password@postgres:5432/nexus_dev
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules

  web:
    build: ./clients/web
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost:3000/graphql
    depends_on:
      - api
    volumes:
      - ./clients/web:/app
      - /app/node_modules

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: nexus_dev
      POSTGRES_USER: nexus
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
      - web

volumes:
  postgres_data:
  redis_data:
```

### Scaling and Performance

#### Auto-scaling Configuration
```yaml
# ECS Service Auto Scaling
ApiServiceScaling:
  Type: AWS::ApplicationAutoScaling::ScalableTarget
  Properties:
    MinCapacity: 2
    MaxCapacity: 50
    ResourceId: service/nexus-cluster/api-service
    ScalableDimension: ecs:service:DesiredCount
    ServiceNamespace: ecs
    
ScalingPolicy:
  Type: AWS::ApplicationAutoScaling::ScalingPolicy
  Properties:
    PolicyType: TargetTrackingScaling
    TargetTrackingScalingPolicyConfiguration:
      TargetValue: 70.0
      PredefinedMetricSpecification:
        PredefinedMetricType: ECSServiceAverageCPUUtilization
```

#### Performance Monitoring
```typescript
// Custom metrics configuration
interface PerformanceMetrics {
  // API response times
  apiResponseTime: {
    queries: number;
    mutations: number;
    subscriptions: number;
  };
  
  // Database performance
  databaseMetrics: {
    connectionPool: number;
    queryExecutionTime: number;
    slowQueries: number;
  };
  
  // AI processing metrics
  aiMetrics: {
    embeddingGenerationTime: number;
    connectionDetectionTime: number;
    queueLength: number;
    processingErrors: number;
  };
  
  // User experience metrics
  uxMetrics: {
    canvasLoadTime: number;
    cardRenderTime: number;
    syncLatency: number;
    offlineEvents: number;
  };
}
```

### Monitoring and Observability

#### Logging Strategy
```typescript
// Structured logging configuration
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: {
    service: 'nexus-api',
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV
  },
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' })
  ]
});

// Custom log levels for business events
logger.add(new transports.File({
  filename: 'logs/business-events.log',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  level: 'info',
  handleExceptions: false
}));
```

#### Health Checks
```typescript
// Health check endpoints
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      pgvector: await checkPgVectorHealth(),
      aiService: await checkAIServiceHealth(),
      auth0: await checkAuth0Health()
    }
  };
  
  const hasFailures = Object.values(healthCheck.checks)
    .some(check => check.status !== 'OK');
  
  res.status(hasFailures ? 503 : 200).json(healthCheck);
});

async function checkDatabaseHealth(): Promise<HealthStatus> {
  try {
    const start = Date.now();
    await db.raw('SELECT 1');
    const responseTime = Date.now() - start;
    return { status: 'OK', responseTime };
  } catch (error) {
    return { status: 'ERROR', error: error.message };
  }
}

async function checkPgVectorHealth(): Promise<HealthStatus> {
  try {
    // Check pgvector extension
    const vectorCheck = await db.raw("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    if (vectorCheck.rows.length === 0) {
      return { status: 'ERROR', error: 'pgvector extension not installed' };
    }
    
    // Check vector index health
    const indexCheck = await db.raw(`
      SELECT schemaname, tablename, indexname 
      FROM pg_indexes 
      WHERE indexdef LIKE '%vector%' AND tablename = 'cards'
    `);
    
    // Test a simple vector operation
    const start = Date.now();
    await db.raw("SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector as distance");
    const responseTime = Date.now() - start;
    
    return { 
      status: 'OK', 
      responseTime,
      metadata: {
        vectorIndexes: indexCheck.rows.length,
        extensionInstalled: true
      }
    };
  } catch (error) {
    return { status: 'ERROR', error: error.message };
  }
}

async function checkAuth0Health(): Promise<HealthStatus> {
  try {
    const start = Date.now();
    
    // Test Auth0 JWKS endpoint availability
    const jwksResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`);
    if (!jwksResponse.ok) {
      return { status: 'ERROR', error: 'Auth0 JWKS endpoint unavailable' };
    }
    
    // Test Auth0 Management API (if configured)
    if (process.env.AUTH0_MANAGEMENT_TOKEN) {
      const mgmtResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/api/v2/users?per_page=1`, {
        headers: {
          'Authorization': `Bearer ${process.env.AUTH0_MANAGEMENT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!mgmtResponse.ok) {
        return { status: 'WARN', error: 'Auth0 Management API not accessible' };
      }
    }
    
    const responseTime = Date.now() - start;
    return { 
      status: 'OK', 
      responseTime,
      metadata: {
        jwksEndpoint: 'accessible',
        managementApi: process.env.AUTH0_MANAGEMENT_TOKEN ? 'accessible' : 'not_configured'
      }
    };
  } catch (error) {
    return { status: 'ERROR', error: error.message };
  }
}
```

---

## Security Architecture

### Auth0 Authentication and Authorization

#### Auth0 JWT Validation Strategy
```typescript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

interface Auth0JWTPayload {
  sub: string; // Auth0 user ID
  email: string;
  email_verified: boolean;
  iss: string; // Auth0 issuer
  aud: string; // Auth0 audience
  iat: number; // issued at
  exp: number; // expires at
  scope: string; // OAuth scopes
  // Custom claims (set via Auth0 Rules/Actions)
  'https://nexus.app/roles': string[];
  'https://nexus.app/permissions': string[];
  'https://nexus.app/user_id': string; // Internal user ID
}

class Auth0Service {
  private readonly AUTH0_DOMAIN = process.env.AUTH0_DOMAIN!;
  private readonly AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE!;
  private readonly jwksClient = jwksClient({
    jwksUri: `https://${this.AUTH0_DOMAIN}/.well-known/jwks.json`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000 // 10 minutes
  });
  
  async validateAuth0Token(token: string): Promise<Auth0JWTPayload | null> {
    try {
      // Get signing key from Auth0
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.header.kid) {
        return null;
      }
      
      const key = await this.jwksClient.getSigningKey(decoded.header.kid);
      const signingKey = key.getPublicKey();
      
      // Verify JWT with Auth0 public key
      const payload = jwt.verify(token, signingKey, {
        audience: this.AUTH0_AUDIENCE,
        issuer: `https://${this.AUTH0_DOMAIN}/`,
        algorithms: ['RS256']
      }) as Auth0JWTPayload;
      
      // Ensure email is verified for security
      if (!payload.email_verified) {
        throw new Error('Email not verified');
      }
      
      return payload;
    } catch (error) {
      console.error('Auth0 token validation failed:', error);
      return null;
    }
  }
  
  async syncUserFromAuth0(auth0Payload: Auth0JWTPayload): Promise<User> {
    const existingUser = await db('users')
      .where('auth0_user_id', auth0Payload.sub)
      .first();
    
    const userData = {
      email: auth0Payload.email,
      auth0_user_id: auth0Payload.sub,
      email_verified: auth0Payload.email_verified,
      display_name: auth0Payload['https://nexus.app/name'],
      avatar_url: auth0Payload['https://nexus.app/picture'],
      roles: auth0Payload['https://nexus.app/roles'] || [],
      permissions: auth0Payload['https://nexus.app/permissions'] || [],
      last_login: new Date(),
      auth0_updated_at: new Date(auth0Payload['https://nexus.app/updated_at']),
      metadata_synced_at: new Date(),
      updated_at: new Date()
    };
    
    if (existingUser) {
      await db('users')
        .where('id', existingUser.id)
        .update(userData);
      return { ...existingUser, ...userData };
    } else {
      const [newUser] = await db('users')
        .insert(userData)
        .returning('*');
      return newUser;
    }
  }
}
```

#### Auth0 GraphQL Middleware
```typescript
import { AuthenticationError, ForbiddenError } from 'apollo-server-express';

export interface AuthContext {
  user?: User;
  auth0Payload?: Auth0JWTPayload;
  permissions: string[];
}

export async function createAuthContext(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { permissions: [] };
  }
  
  const token = authHeader.substring(7);
  const auth0Service = new Auth0Service();
  
  try {
    const auth0Payload = await auth0Service.validateAuth0Token(token);
    if (!auth0Payload) {
      return { permissions: [] };
    }
    
    // Sync user data from Auth0
    const user = await auth0Service.syncUserFromAuth0(auth0Payload);
    
    return {
      user,
      auth0Payload,
      permissions: auth0Payload['https://nexus.app/permissions'] || []
    };
  } catch (error) {
    console.error('Auth context creation failed:', error);
    return { permissions: [] };
  }
}

// GraphQL directive for authentication
export function requireAuth(resolver: Function) {
  return (parent: any, args: any, context: AuthContext, info: any) => {
    if (!context.user) {
      throw new AuthenticationError('Authentication required');
    }
    return resolver(parent, args, context, info);
  };
}

// GraphQL directive for authorization
export function requirePermission(permission: string) {
  return (resolver: Function) => {
    return (parent: any, args: any, context: AuthContext, info: any) => {
      if (!context.user) {
        throw new AuthenticationError('Authentication required');
      }
      
      if (!context.permissions.includes(permission)) {
        throw new ForbiddenError(`Permission required: ${permission}`);
      }
      
      return resolver(parent, args, context, info);
    };
  };
}
```

#### Permission System
```typescript
enum Permission {
  // Card permissions
  CARD_CREATE = 'card:create',
  CARD_READ = 'card:read',
  CARD_UPDATE = 'card:update',
  CARD_DELETE = 'card:delete',
  
  // Workspace permissions
  WORKSPACE_READ = 'workspace:read',
  WORKSPACE_UPDATE = 'workspace:update',
  WORKSPACE_DELETE = 'workspace:delete',
  WORKSPACE_INVITE = 'workspace:invite',
  
  // AI permissions
  AI_GENERATE = 'ai:generate',
  AI_QUERY = 'ai:query',
  
  // Admin permissions
  ADMIN_USERS = 'admin:users',
  ADMIN_SYSTEM = 'admin:system'
}

class AuthorizationService {
  async checkPermission(userId: string, permission: Permission, resourceId?: string): Promise<boolean> {
    const user = await this.userService.getById(userId);
    if (!user) return false;
    
    // Check global permissions
    if (user.globalPermissions.includes(permission)) {
      return true;
    }
    
    // Check resource-specific permissions
    if (resourceId) {
      const resourcePermissions = await this.getResourcePermissions(userId, resourceId);
      return resourcePermissions.includes(permission);
    }
    
    return false;
  }
  
  private async getResourcePermissions(userId: string, resourceId: string): Promise<Permission[]> {
    // Determine resource type and check permissions
    if (resourceId.startsWith('ws_')) {
      return this.getWorkspacePermissions(userId, resourceId);
    } else if (resourceId.startsWith('card_')) {
      return this.getCardPermissions(userId, resourceId);
    }
    
    return [];
  }
}
```

### Data Encryption and Privacy

#### Encryption at Rest
```typescript
class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  
  async encryptSensitiveData(data: string, userId: string): Promise<EncryptedData> {
    const key = await this.getDerivedKey(userId);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(Buffer.from(userId));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  async decryptSensitiveData(encryptedData: EncryptedData, userId: string): Promise<string> {
    const key = await this.getDerivedKey(userId);
    
    const decipher = crypto.createDecipher(this.algorithm, key);
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  private async getDerivedKey(userId: string): Promise<Buffer> {
    const salt = await this.getSalt(userId);
    return crypto.pbkdf2Sync(process.env.MASTER_KEY!, salt, 100000, this.keyLength, 'sha512');
  }
}
```

#### GDPR Compliance
```typescript
class DataPrivacyService {
  async requestDataExport(userId: string): Promise<DataExportResult> {
    const userData = await this.collectUserData(userId);
    const exportFile = await this.generateExportFile(userData);
    
    // Log the export request for compliance
    await this.auditLogger.logDataAccess({
      userId,
      action: 'DATA_EXPORT_REQUEST',
      timestamp: new Date(),
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent()
    });
    
    return {
      exportId: exportFile.id,
      downloadUrl: exportFile.url,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
  }
  
  async deleteUserData(userId: string): Promise<DataDeletionResult> {
    const deletionTasks = [
      this.deleteUserCards(userId),
      this.deleteUserWorkspaces(userId),
      this.deleteUserConnections(userId),
      this.deleteUserEmbeddings(userId),
      this.deleteUserSessions(userId),
      this.deleteUserAuditLogs(userId)
    ];
    
    await Promise.all(deletionTasks);
    
    // Mark user as deleted but keep minimal record for compliance
    await this.userService.markAsDeleted(userId);
    
    return {
      deletedAt: new Date(),
      retentionPeriod: 30 // days
    };
  }
}
```

### API Security

#### Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const createRateLimit = (windowMs: number, max: number, message: string) => 
  rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });

// Different limits for different endpoints
const rateLimits = {
  auth: createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts'), // 5 attempts per 15 minutes
  api: createRateLimit(15 * 60 * 1000, 1000, 'API rate limit exceeded'), // 1000 requests per 15 minutes
  ai: createRateLimit(60 * 60 * 1000, 100, 'AI processing rate limit exceeded'), // 100 AI requests per hour
  upload: createRateLimit(60 * 60 * 1000, 50, 'Upload rate limit exceeded') // 50 uploads per hour
};

// Apply rate limits
app.use('/auth', rateLimits.auth);
app.use('/api', rateLimits.api);
app.use('/api/ai', rateLimits.ai);
app.use('/api/upload', rateLimits.upload);
```

#### Input Validation and Sanitization
```typescript
import { body, param, query, validationResult } from 'express-validator';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Validation middleware
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Card creation validation
const validateCardCreation = [
  body('workspaceId').isUUID().withMessage('Invalid workspace ID'),
  body('type').isIn(['text', 'image', 'link', 'code']).withMessage('Invalid card type'),
  body('content').isLength({ min: 1, max: 10000 }).withMessage('Content must be 1-10000 characters'),
  body('title').optional().isLength({ max: 200 }).withMessage('Title must be under 200 characters'),
  body('tags').optional().isArray({ max: 20 }).withMessage('Maximum 20 tags allowed'),
  body('tags.*').matches(/^[a-zA-Z0-9-_]+$/).withMessage('Tags must be alphanumeric with hyphens/underscores'),
  validateRequest
];

// Content sanitization
const sanitizeContent = (content: string, type: string): string => {
  switch (type) {
    case 'text':
      return purify.sanitize(content, { 
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'h1', 'h2', 'h3', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: []
      });
    case 'code':
      // For code, we want to preserve the raw content but escape HTML
      return content.replace(/[<>&"']/g, (match) => {
        const htmlEntities: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#x27;'
        };
        return htmlEntities[match];
      });
    default:
      return purify.sanitize(content);
  }
};
```

---

## Component-Specific Architecture

### Project Structure Overview

The project follows a modular architecture with clear separation between backend services and client applications:

```
project-nexus/
├── backend/                    # Node.js GraphQL API service
│   ├── src/
│   │   ├── api/               # GraphQL and REST endpoints
│   │   ├── services/          # Business logic services
│   │   ├── models/            # Data models and repositories
│   │   ├── utils/             # Shared utilities
│   │   ├── types/             # TypeScript type definitions
│   │   └── config/            # Configuration files
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── readme.md
├── clients/                   # Client applications
│   ├── web/                   # Next.js 14 web application
│   │   ├── src/
│   │   │   ├── app/           # Next.js App Router pages
│   │   │   ├── components/    # React components
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── lib/           # Utility functions
│   │   │   ├── stores/        # Zustand state stores
│   │   │   └── types/         # Client-side types
│   │   ├── public/            # Static assets
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   └── readme.md
│   └── app/                   # Flutter mobile application
│       ├── lib/               # Dart source code
│       │   ├── features/      # Feature-based modules
│       │   ├── shared/        # Shared widgets and services
│       │   └── core/          # Core app configuration
│       ├── test/              # Unit and widget tests
│       ├── android/           # Android-specific files
│       ├── ios/               # iOS-specific files
│       ├── assets/            # App assets
│       ├── pubspec.yaml
│       └── readme.md
├── project-documentation/     # Architecture and product docs
│   ├── product-manager-output.md
│   ├── technical-architecture.md
│   └── [additional docs]
└── docker-compose.yml         # Development environment setup
```

### Backend Service Architecture

The backend is structured as a single Node.js service with clear layer separation:

#### API Layer (`./backend/src/api/`)
```
api/
├── graphql/
│   ├── schema/
│   │   ├── types/           # GraphQL type definitions
│   │   ├── queries/         # Query resolvers
│   │   ├── mutations/       # Mutation resolvers
│   │   └── subscriptions/   # Subscription resolvers
│   ├── resolvers/           # Business logic resolvers
│   └── context.ts           # GraphQL context setup
├── rest/
│   ├── routes/              # REST route definitions
│   ├── middleware/          # Express middleware
│   └── controllers/         # Request controllers
└── server.ts                # Express server configuration
```

#### Service Layer (`./backend/src/services/`)
```
services/
├── auth/                    # Authentication & authorization
├── cards/                   # Card management operations
├── workspaces/              # Workspace management
├── ai/                      # AI processing and embeddings
└── sync/                    # Cross-platform synchronization
```

#### Data Layer (`./backend/src/models/`)
```
models/
├── entities/                # TypeScript entity definitions
├── repositories/            # Data access layer
└── migrations/              # Database schema versioning
```

### Web Client Architecture

The web application uses Next.js 14 with App Router:

#### Component Structure (`./clients/web/src/components/`)
```
components/
├── ui/                      # Reusable UI primitives (buttons, inputs)
├── canvas/                  # Canvas-specific components
│   ├── InfiniteCanvas.tsx
│   ├── Card.tsx
│   ├── Connection.tsx
│   └── Minimap.tsx
├── cards/                   # Card type-specific components
│   ├── TextCard.tsx
│   ├── ImageCard.tsx
│   ├── LinkCard.tsx
│   └── CodeCard.tsx
├── layout/                  # Navigation and layout components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Navigation.tsx
└── forms/                   # Input and form components
    ├── MarkdownEditor.tsx
    ├── SearchBox.tsx
    └── TagInput.tsx
```

#### State Management (`./clients/web/src/stores/`)
```
stores/
├── canvas.ts                # Canvas viewport and interaction state
├── cards.ts                 # Card data and operations
├── ui.ts                    # UI state (modals, sidebar, etc.)
├── auth.ts                  # Authentication state
└── sync.ts                  # Synchronization status
```

### Mobile App Architecture

The Flutter app follows a feature-based architecture:

#### Feature Modules (`./clients/app/lib/features/`)
```
features/
├── auth/
│   ├── models/
│   ├── providers/
│   ├── screens/
│   └── widgets/
├── canvas/
│   ├── models/
│   ├── providers/
│   ├── screens/
│   └── widgets/
├── cards/
│   ├── models/
│   ├── providers/
│   ├── screens/
│   └── widgets/
└── sync/
    ├── models/
    ├── providers/
    └── services/
```

#### Shared Components (`./clients/app/lib/shared/`)
```
shared/
├── widgets/                 # Reusable UI components
├── services/                # API and storage services
├── models/                  # Shared data models
└── utils/                   # Utility functions
```

---

## Development Workflow

### Local Development Setup

**Prerequisites:**
- Node.js 18+ and npm
- Flutter 3.0+ and Dart SDK
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

**Getting Started:**
```bash
# Clone and setup
git clone <repository>
cd project-nexus

# Backend setup
cd backend
npm install
cp .env.example .env
npm run dev

# Web client setup (new terminal)
cd ../clients/web
npm install
cp .env.example .env.local
npm run dev

# Mobile app setup (new terminal)
cd ../clients/app
flutter pub get
flutter run
```

**Using Docker Compose:**
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api
docker-compose logs -f web

# Reset development environment
docker-compose down -v
docker-compose up --build
```

### Inter-Service Communication

**Web Client ↔ Backend:**
- GraphQL over HTTP for queries and mutations
- WebSocket subscriptions for real-time updates
- REST endpoints for file uploads and exports

**Mobile App ↔ Backend:**
- GraphQL queries with offline caching
- Background sync with conflict resolution
- Push notifications for collaborative features

**Shared Type Definitions:**
```typescript
// Shared across backend and web client
interface Card {
  id: string;
  workspaceId: string;
  type: CardType;
  content: string;
  position: Position;
  // ... other properties
}

// Generated from GraphQL schema
export type GraphQLTypes = {
  Query: QueryType;
  Mutation: MutationType;
  Subscription: SubscriptionType;
};
```

### Build and Deployment Pipeline

**Development Environment:**
- Backend: `http://localhost:3000` (GraphQL + REST)
- Web Client: `http://localhost:3001` (Next.js dev server)
- Mobile: Local emulator/device via Flutter

**Staging Environment:**
- Backend: ECS Fargate service with staging database
- Web Client: Vercel preview deployment
- Mobile: TestFlight/Play Console internal testing

**Production Environment:**
- Backend: Auto-scaled ECS service with RDS
- Web Client: Vercel production deployment with CDN
- Mobile: App Store and Play Store distribution

### Cross-Platform Feature Development

**Feature Implementation Order:**
1. **Backend API:** Implement GraphQL schema and resolvers in `./backend/src/api/`
2. **Web Client:** Build UI components in `./clients/web/src/components/` and GraphQL integration
3. **Mobile App:** Implement Flutter widgets in `./clients/app/lib/features/` and sync logic
4. **Testing:** Cross-platform integration testing across all services

**Shared Business Logic:**
- API contracts defined in GraphQL schema (`./backend/src/api/graphql/schema/`)
- Validation rules implemented on backend (`./backend/src/utils/validation/`)
- Client-side validation mirrors backend rules
- Offline capabilities handle network failures gracefully

### Service Integration Patterns

**Backend Service (`./backend/`):**
- Serves as the single source of truth for data
- Handles authentication and authorization
- Manages AI processing and connection detection
- Provides real-time updates via GraphQL subscriptions
- Implements business logic and data validation

**Web Client (`./clients/web/`):**
- Consumes GraphQL API for data operations
- Implements infinite canvas with Konva.js
- Manages client-side state with Zustand
- Handles real-time collaboration features
- Provides responsive design for desktop/tablet usage

**Mobile App (`./clients/app/`):**
- Uses GraphQL API with offline-first approach
- Implements quick capture and mobile-optimized UI
- Manages local storage with Drift/SQLite
- Handles background sync and conflict resolution
- Provides platform-specific features (notifications, widgets)

**Development Environment Coordination:**
```bash
# Start all services in development mode
docker-compose up -d    # Starts backend, web, postgres, redis

# Or start individually:
cd backend && npm run dev              # Backend at :3000
cd clients/web && npm run dev          # Web client at :3001
cd clients/app && flutter run          # Mobile app on device/emulator
```

**API Versioning Strategy:**
- GraphQL schema evolution with deprecation warnings
- Backward compatibility maintained for mobile app releases
- Feature flags for gradual rollout of new capabilities
- Client SDK generation from GraphQL schema

---

## Development Guidelines

#### Service Layer Architecture
```typescript
// Base service interface
interface BaseService<T> {
  create(data: CreateInput<T>): Promise<T>;
  getById(id: string): Promise<T | null>;
  update(id: string, data: UpdateInput<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

// Example implementation
class CardService implements BaseService<Card> {
  constructor(
    private readonly cardRepository: CardRepository,
    private readonly aiService: AIService,
    private readonly eventBus: EventBus
  ) {}
  
  async create(data: CreateCardInput): Promise<Card> {
    // 1. Validate permissions
    await this.validateCreatePermissions(data.workspaceId, data.userId);
    
    // 2. Sanitize content
    const sanitizedContent = this.sanitizeContent(data.content, data.type);
    
    // 3. Create card
    const card = await this.cardRepository.create({
      ...data,
      content: sanitizedContent
    });
    
    // 4. Trigger AI processing (async)
    this.eventBus.emit('card.created', { cardId: card.id });
    
    // 5. Return immediately
    return card;
  }
  
  async update(id: string, data: UpdateCardInput): Promise<Card> {
    const existingCard = await this.cardRepository.getById(id);
    if (!existingCard) {
      throw new NotFoundError('Card not found');
    }
    
    await this.validateUpdatePermissions(existingCard, data.userId);
    
    const updatedCard = await this.cardRepository.update(id, data);
    
    // Trigger re-analysis if content changed
    if (data.content && data.content !== existingCard.content) {
      this.eventBus.emit('card.content.changed', { cardId: id });
    }
    
    return updatedCard;
  }
  
  private async validateCreatePermissions(workspaceId: string, userId: string): Promise<void> {
    const hasPermission = await this.authService.checkPermission(
      userId, 
      Permission.CARD_CREATE, 
      workspaceId
    );
    
    if (!hasPermission) {
      throw new ForbiddenError('Insufficient permissions to create card');
    }
  }
}
```

### Testing Strategy

#### Unit Testing
```typescript
// Example unit test for CardService
import { CardService } from '../services/CardService';
import { createMockRepository, createMockAIService } from '../utils/testing';

describe('CardService', () => {
  let cardService: CardService;
  let mockCardRepository: jest.Mocked<CardRepository>;
  let mockAIService: jest.Mocked<AIService>;
  
  beforeEach(() => {
    mockCardRepository = createMockRepository<Card>();
    mockAIService = createMockAIService();
    cardService = new CardService(mockCardRepository, mockAIService);
  });
  
  describe('create', () => {
    it('should create a card with sanitized content', async () => {
      const input: CreateCardInput = {
        workspaceId: 'ws-123',
        type: 'text',
        content: '<script>alert("xss")</script>Hello world',
        userId: 'user-123'
      };
      
      const expectedCard: Card = {
        id: 'card-123',
        ...input,
        content: 'Hello world', // XSS removed
        createdAt: new Date()
      };
      
      mockCardRepository.create.mockResolvedValue(expectedCard);
      
      const result = await cardService.create(input);
      
      expect(result.content).toBe('Hello world');
      expect(mockCardRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Hello world'
        })
      );
    });
    
    it('should throw error for invalid permissions', async () => {
      const input: CreateCardInput = {
        workspaceId: 'ws-123',
        type: 'text',
        content: 'Hello world',
        userId: 'unauthorized-user'
      };
      
      await expect(cardService.create(input)).rejects.toThrow(ForbiddenError);
    });
  });
});
```

#### Integration Testing
```typescript
// Integration test example
import { startTestServer, createTestDatabase } from '../utils/testing';
import { GraphQLClient } from 'graphql-request';

describe('Card API Integration', () => {
  let server: TestServer;
  let client: GraphQLClient;
  let testDb: TestDatabase;
  
  beforeAll(async () => {
    testDb = await createTestDatabase();
    server = await startTestServer({ database: testDb });
    client = new GraphQLClient(`http://localhost:${server.port}/graphql`);
  });
  
  afterAll(async () => {
    await server.close();
    await testDb.cleanup();
  });
  
  it('should create and retrieve a card', async () => {
    const createCardMutation = `
      mutation CreateCard($input: CreateCardInput!) {
        createCard(input: $input) {
          id
          content
          type
          createdAt
        }
      }
    `;
    
    const input = {
      workspaceId: 'test-workspace',
      type: 'text',
      content: 'Test card content'
    };
    
    const createResult = await client.request(createCardMutation, { input });
    const createdCard = createResult.createCard;
    
    expect(createdCard.id).toBeDefined();
    expect(createdCard.content).toBe(input.content);
    
    // Test retrieval
    const getCardQuery = `
      query GetCard($id: ID!) {
        card(id: $id) {
          id
          content
          type
        }
      }
    `;
    
    const getResult = await client.request(getCardQuery, { id: createdCard.id });
    const retrievedCard = getResult.card;
    
    expect(retrievedCard).toEqual(
      expect.objectContaining({
        id: createdCard.id,
        content: input.content,
        type: input.type
      })
    );
  });
});
```

#### Performance Testing
```typescript
// Performance test example
import { performance } from 'perf_hooks';
import { CardService } from '../services/CardService';

describe('CardService Performance', () => {
  let cardService: CardService;
  
  beforeEach(() => {
    cardService = new CardService(/* dependencies */);
  });
  
  it('should handle large workspace with 1000+ cards', async () => {
    const workspaceId = 'large-workspace';
    
    // Create 1000 cards
    const cards = await Promise.all(
      Array.from({ length: 1000 }, (_, i) => 
        cardService.create({
          workspaceId,
          type: 'text',
          content: `Card content ${i}`,
          userId: 'test-user'
        })
      )
    );
    
    // Test search performance
    const searchStart = performance.now();
    const searchResults = await cardService.searchCards(workspaceId, 'content');
    const searchDuration = performance.now() - searchStart;
    
    expect(searchDuration).toBeLessThan(2000); // < 2 seconds
    expect(searchResults.length).toBeGreaterThan(0);
  });
  
  it('should maintain canvas performance with 100+ cards', async () => {
    const workspaceId = 'canvas-test';
    const cards = await this.createTestCards(100, workspaceId);
    
    const loadStart = performance.now();
    const canvasData = await cardService.getCanvasData(workspaceId);
    const loadDuration = performance.now() - loadStart;
    
    expect(loadDuration).toBeLessThan(1000); // < 1 second
    expect(canvasData.cards).toHaveLength(100);
  });
});
```

### CI/CD Pipeline

#### Multi-Service GitHub Actions Workflow
```yaml
name: Multi-Service CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  # Detect which services have changes
  changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.changes.outputs.backend }}
      web: ${{ steps.changes.outputs.web }}
      mobile: ${{ steps.changes.outputs.mobile }}
      docs: ${{ steps.changes.outputs.docs }}
    steps:
    - uses: actions/checkout@v4
    - uses: dorny/paths-filter@v2
      id: changes
      with:
        filters: |
          backend:
            - 'backend/**'
          web:
            - 'clients/web/**'
          mobile:
            - 'clients/app/**'
          docs:
            - 'project-documentation/**'

  # Backend service testing and building
  test-backend:
    needs: changes
    if: ${{ needs.changes.outputs.backend == 'true' }}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: nexus_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: backend/package-lock.json
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run ESLint
      run: npm run lint
    
    - name: Run type check
      run: npm run type-check
    
    - name: Run unit tests
      run: npm run test:unit
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost:5432/nexus_test
        REDIS_URL: redis://localhost:6379
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost:5432/nexus_test
        REDIS_URL: redis://localhost:6379
    
    - name: Generate coverage report
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        flags: backend

  # Web client testing and building
  test-web:
    needs: changes
    if: ${{ needs.changes.outputs.web == 'true' }}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./clients/web
    
    steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: clients/web/package-lock.json
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run ESLint
      run: npm run lint
    
    - name: Run type check
      run: npm run type-check
    
    - name: Run tests
      run: npm run test
    
    - name: Build application
      run: npm run build
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: web-build
        path: clients/web/.next

  # Mobile app testing
  test-mobile:
    needs: changes
    if: ${{ needs.changes.outputs.mobile == 'true' }}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./clients/app
    
    steps:
    - uses: actions/checkout@v4
    - name: Setup Flutter
      uses: subosito/flutter-action@v2
      with:
        flutter-version: '3.0.0'
    
    - name: Install dependencies
      run: flutter pub get
    
    - name: Run analyzer
      run: flutter analyze
    
    - name: Run tests
      run: flutter test
    
    - name: Build APK (Android)
      run: flutter build apk --debug
    
    - name: Upload APK
      uses: actions/upload-artifact@v3
      with:
        name: mobile-apk
        path: clients/app/build/app/outputs/apk/debug/app-debug.apk

  # Build and deploy services
  build-and-deploy:
    needs: [changes, test-backend, test-web, test-mobile]
    if: always() && (needs.test-backend.result == 'success' || needs.test-backend.result == 'skipped') && (needs.test-web.result == 'success' || needs.test-web.result == 'skipped') && (needs.test-mobile.result == 'success' || needs.test-mobile.result == 'skipped')
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    # Backend deployment
    - name: Build and deploy backend
      if: ${{ needs.changes.outputs.backend == 'true' }}
      run: |
        cd backend
        docker build -t nexus-api:${{ github.sha }} .
        # Additional deployment steps based on environment
    
    # Web client deployment
    - name: Deploy web client
      if: ${{ needs.changes.outputs.web == 'true' }}
      run: |
        cd clients/web
        # Deploy to Vercel or similar platform
        echo "Deploying web client..."
    
    # Mobile app deployment
    - name: Deploy mobile app
      if: ${{ needs.changes.outputs.mobile == 'true' }}
      run: |
        cd clients/app
        # Deploy to app stores (staging/production based on branch)
        echo "Deploying mobile app..."

  # Environment-specific deployment
  deploy-staging:
    needs: build-and-deploy
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
    - name: Deploy to staging environment
      run: |
        echo "Deploying to staging..."
        # Deploy backend to staging ECS
        # Deploy web to staging environment
        # Deploy mobile to TestFlight/Play Console

  deploy-production:
    needs: build-and-deploy
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to production environment
      run: |
        echo "Deploying to production..."
        # Deploy backend to production ECS
        # Deploy web to production
        # Deploy mobile to app stores
```

---

## Auth0 Implementation Guide

### Auth0 Architecture Overview
Project Nexus uses Auth0 as the primary authentication provider from day one, providing enterprise-grade security, MFA, and social login capabilities without the complexity of maintaining a custom authentication system.

**Key Benefits:**
- Enterprise-grade security with MFA and brute force protection
- Social login providers (Google, Microsoft, Apple) out-of-the-box
- GDPR compliance and data retention controls
- Scalable authentication that grows with the platform
- Reduced development time and security maintenance

### Auth0 Configuration

#### Tenant Setup
**Production Tenant:**
```yaml
Domain: projectnexus.auth0.com
Plan: B2B Essentials (for MFA and advanced security)
Region: US (or closest to primary user base)
```

**Environment Configuration:**
- **Development**: projectnexus-dev.auth0.com
- **Staging**: projectnexus-staging.auth0.com  
- **Production**: projectnexus.auth0.com (with custom domain)

#### Applications Setup
**Web Application (Next.js):**
```yaml
Application Type: Regular Web Application
Allowed Callback URLs: 
  - http://localhost:3000/api/auth/callback/auth0 (dev)
  - https://app.projectnexus.com/api/auth/callback/auth0 (prod)
Allowed Logout URLs:
  - http://localhost:3000 (dev)
  - https://app.projectnexus.com (prod)
Token Endpoint Authentication Method: POST
```

**Mobile Application (Flutter):**
```yaml
Application Type: Native
Allowed Callback URLs:
  - com.projectnexus.app://login-callback
Allowed Logout URLs:  
  - com.projectnexus.app://logout-callback
Grant Types: Authorization Code, Refresh Token
```

#### Security Configuration
**Universal Login:**
- Enable New Universal Login experience
- Custom branding with Project Nexus logo and colors
- Progressive profiling for user onboarding
- Passwordless options (email magic links)

**Multi-Factor Authentication:**
- Required for all users
- TOTP (Google Authenticator, Authy)
- SMS backup for non-smartphone users
- Push notifications via Auth0 Guardian

**Attack Protection:**
- Brute force protection: 10 attempts per IP per hour
- Suspicious IP throttling enabled
- Breached password detection
- Bot detection with CAPTCHA

### Backend Integration

#### Auth0 JWT Validation Service
```typescript
import { auth } from 'express-oauth-server';
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';

export class Auth0ValidationService {
  private jwksClient: jwksClient.JwksClient;
  
  constructor() {
    this.jwksClient = jwksClient({
      jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 86400000, // 24 hours
      rateLimit: true,
      jwksRequestsPerMinute: 10
    });
  }
  
  async validateToken(token: string): Promise<Auth0User> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded?.header?.kid) {
      throw new Error('Invalid token structure');
    }
    
    const signingKey = await this.getSigningKey(decoded.header.kid);
    
    const verified = jwt.verify(token, signingKey, {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256']
    }) as Auth0JWTPayload;
    
    return this.mapToUser(verified);
  }
  
  private async getSigningKey(kid: string): Promise<string> {
    const key = await this.jwksClient.getSigningKey(kid);
    return key.getPublicKey();
  }
}
```

#### User Synchronization Service
```typescript
export class Auth0UserSyncService {
  async syncUserFromAuth0(auth0UserId: string): Promise<User> {
    // Get user from Auth0 Management API
    const auth0User = await this.auth0Management.getUser({ id: auth0UserId });
    
    // Upsert user in local database
    const user = await this.userRepository.upsert({
      auth0UserId: auth0User.user_id,
      email: auth0User.email,
      emailVerified: auth0User.email_verified,
      displayName: auth0User.name || auth0User.nickname,
      avatarUrl: auth0User.picture,
      lastLogin: new Date(auth0User.last_login),
      auth0UpdatedAt: new Date(auth0User.updated_at),
      roles: auth0User.app_metadata?.roles || [],
      permissions: auth0User.app_metadata?.permissions || []
    });
    
    return user;
  }
  
  async ensureUserExists(auth0UserId: string): Promise<User> {
    let user = await this.userRepository.findByAuth0Id(auth0UserId);
    
    if (!user) {
      user = await this.syncUserFromAuth0(auth0UserId);
    }
    
    return user;
  }
}
```

### Frontend Integration

#### Next.js Configuration
```typescript
// pages/api/auth/[...auth0].ts
import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';

export default handleAuth({
  login: handleLogin({
    authorizationParams: {
      audience: process.env.AUTH0_AUDIENCE,
      scope: 'openid profile email offline_access'
    }
  })
});
```

#### Protected Route Pattern
```typescript
// components/ProtectedRoute.tsx
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/api/auth/login');
    }
  }, [user, isLoading, router]);
  
  if (isLoading) return <LoadingSpinner />;
  if (!user) return null;
  
  return <>{children}</>;
}
```

#### Flutter Integration
```dart
// lib/services/auth_service.dart
import 'package:auth0_flutter/auth0_flutter.dart';

class AuthService {
  late Auth0 auth0;
  
  AuthService() {
    auth0 = Auth0(
      'YOUR_AUTH0_DOMAIN',
      'YOUR_AUTH0_CLIENT_ID',
    );
  }
  
  Future<Credentials?> login() async {
    try {
      final credentials = await auth0.webAuthentication().login(
        audience: 'YOUR_AUTH0_AUDIENCE',
        scopes: {'openid', 'profile', 'email', 'offline_access'},
      );
      
      // Store credentials securely
      await _storeCredentials(credentials);
      return credentials;
    } catch (e) {
      print('Login error: $e');
      return null;
    }
  }
  
  Future<void> logout() async {
    await auth0.webAuthentication().logout();
    await _clearStoredCredentials();
  }
}
```

### Implementation Success Metrics
- **Authentication Success Rate**: >99.5%
- **Token Validation Time**: <200ms average
- **MFA Adoption Rate**: >90% within 30 days
- **User Onboarding Completion**: >85%
- **Security Incident Rate**: Zero authentication-related breaches

---

## Implementation Roadmap

### Phase 1: MVP Core (Months 1-3)

#### Sprint 1-2: Foundation Setup
**Backend Development:**
- [ ] Set up Node.js + GraphQL API structure
- [ ] Configure PostgreSQL database with Auth0 schema
- [ ] Configure Auth0 tenant with MFA and security settings
- [ ] Implement Auth0 JWT validation and user sync service
- [ ] Set up Redis caching layer
- [ ] Create basic CRUD operations for Cards and Workspaces

**Frontend Development:**
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Integrate Auth0 Next.js SDK with Universal Login
- [ ] Set up Zustand state management
- [ ] Create basic canvas component with Konva.js
- [ ] Implement card creation and editing UI
- [ ] Set up routing and Auth0 authentication flow

#### Sprint 3-4: Core Features
**Backend Development:**
- [ ] Integrate OpenAI API for embeddings
- [ ] Set up pgvector extension for vector similarity search
- [ ] Implement connection detection algorithm
- [ ] Create GraphQL subscriptions for real-time updates
- [ ] Add comprehensive input validation and sanitization

**Frontend Development:**
- [ ] Build infinite canvas with smooth pan/zoom
- [ ] Implement drag-and-drop card positioning
- [ ] Create connection visualization
- [ ] Add markdown editor component
- [ ] Implement search functionality

#### Sprint 5-6: AI Integration
**Backend Development:**
- [ ] Build AI processing pipeline
- [ ] Implement natural language query processing
- [ ] Create batch processing for embeddings
- [ ] Add connection suggestion API
- [ ] Implement conflict resolution for sync

**Frontend Development:**
- [ ] Add AI connection visualization
- [ ] Implement natural language search
- [ ] Create connection acceptance/rejection UI
- [ ] Add loading states for AI processing
- [ ] Implement offline mode with local storage

### Phase 2: Mobile and Enhancement (Months 4-6)

#### Sprint 7-8: Mobile Development
**Mobile Development (Flutter):**
- [ ] Set up Flutter project with Riverpod
- [ ] Integrate Auth0 Flutter SDK with biometric authentication
- [ ] Implement Auth0 authentication flow with secure storage
- [ ] Create mobile canvas component
- [ ] Build quick capture feature
- [ ] Implement sync with backend

**Backend Enhancements:**
- [ ] Optimize API for mobile usage
- [ ] Add mobile-specific endpoints
- [ ] Implement push notifications
- [ ] Add file upload handling
- [ ] Create export/import functionality

#### Sprint 9-10: Performance and Scale
**Backend Optimization:**
- [ ] Implement caching strategies
- [ ] Add database query optimization
- [ ] Set up auto-scaling infrastructure
- [ ] Add comprehensive monitoring
- [ ] Implement rate limiting and security measures

**Frontend Optimization:**
- [ ] Add virtualization for large canvases
- [ ] Implement progressive loading
- [ ] Optimize bundle size and performance
- [ ] Add service worker for offline support
- [ ] Create comprehensive error handling

#### Sprint 11-12: Advanced Features
**Feature Development:**
- [ ] Add smart tag suggestions
- [ ] Implement advanced search filters
- [ ] Create workspace templates
- [ ] Add collaboration features (Phase 2 prep)
- [ ] Implement analytics dashboard

### Phase 3: Collaboration and Enterprise (Months 7-9)

#### Sprint 13-14: Real-time Collaboration
**Collaboration Features:**
- [ ] Implement real-time editing
- [ ] Add presence indicators
- [ ] Create conflict resolution UI
- [ ] Add commenting system
- [ ] Implement version history

#### Sprint 15-16: Enterprise Features
**Enterprise Development:**
- [ ] Add team management
- [ ] Implement advanced permissions
- [ ] Create admin dashboard
- [ ] Add SSO integration
- [ ] Implement audit logging

#### Sprint 17-18: Integrations and Polish
**Integration Development:**
- [ ] Add third-party integrations (Notion, Obsidian)
- [ ] Create API documentation
- [ ] Build webhook system
- [ ] Add advanced export options
- [ ] Implement custom AI model training

---

## Vector Search Architecture with pgvector

### Overview
Project Nexus uses PostgreSQL with the pgvector extension as the primary vector database solution. This approach provides vector similarity search capabilities while maintaining operational simplicity and cost efficiency for the MVP and growth phases.

### Architecture Benefits
**Cost Efficiency:**
- No separate vector database service costs (saves $200-500/month vs dedicated solutions)
- Single database instance to manage and monitor
- Reduced operational complexity and infrastructure overhead

**Technical Advantages:**
- ACID transactions across relational and vector data
- Consistent backup and recovery procedures
- Native SQL querying with vector operations
- Mature PostgreSQL ecosystem and tooling

**Development Benefits:**
- Simpler local development setup
- Unified database schema and versioning
- Single connection pool and monitoring system
- Faster iteration during MVP development

### pgvector Implementation

#### Vector Storage Schema
```sql
-- Enhanced cards table with vector embeddings
CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'image', 'link', 'code')),
    title VARCHAR(200),
    content TEXT NOT NULL,
    
    -- Vector embedding for AI similarity search (1536 dimensions for OpenAI)
    embedding vector(1536),
    embedding_model VARCHAR(50) DEFAULT 'text-embedding-ada-002',
    embedding_created_at TIMESTAMP,
    
    -- Position and styling
    position_x FLOAT DEFAULT 0,
    position_y FLOAT DEFAULT 0,
    width FLOAT DEFAULT 300,
    height FLOAT DEFAULT 200,
    
    -- Metadata and timestamps
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Optimized indexes for vector similarity search
CREATE INDEX idx_cards_embedding ON cards USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_cards_workspace_embedding ON cards(workspace_id) WHERE embedding IS NOT NULL;
CREATE INDEX idx_cards_type_embedding ON cards(type) WHERE embedding IS NOT NULL;
```

#### Vector Service Implementation
```typescript
export class PgVectorService {
  constructor(private readonly db: DatabaseConnection) {}
  
  async upsertEmbedding(cardId: string, embedding: number[]): Promise<void> {
    await this.db.query(`
      UPDATE cards 
      SET embedding = $1, 
          embedding_created_at = NOW(),
          embedding_model = $2
      WHERE id = $3
    `, [JSON.stringify(embedding), 'text-embedding-ada-002', cardId]);
  }
  
  async findSimilarCards(
    workspaceId: string, 
    queryEmbedding: number[], 
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SimilarCard[]> {
    const result = await this.db.query(`
      SELECT 
        id,
        title,
        content,
        type,
        tags,
        1 - (embedding <=> $1) as similarity
      FROM cards 
      WHERE workspace_id = $2 
        AND embedding IS NOT NULL 
        AND 1 - (embedding <=> $1) > $3
      ORDER BY embedding <=> $1
      LIMIT $4
    `, [JSON.stringify(queryEmbedding), workspaceId, threshold, limit]);
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content.substring(0, 200),
      type: row.type,
      tags: row.tags,
      similarity: parseFloat(row.similarity)
    }));
  }
  
  async getVectorStats(workspaceId: string): Promise<VectorStats> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_cards,
        COUNT(embedding) as cards_with_embeddings,
        AVG(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as embedding_coverage
      FROM cards 
      WHERE workspace_id = $1
    `, [workspaceId]);
    
    return {
      totalCards: parseInt(result.rows[0].total_cards),
      cardsWithEmbeddings: parseInt(result.rows[0].cards_with_embeddings),
      embeddingCoverage: parseFloat(result.rows[0].embedding_coverage)
    };
  }
}
```

#### Performance Optimization
**Index Configuration:**
```sql
-- HNSW index parameters for optimal performance
CREATE INDEX idx_cards_embedding ON cards 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Set runtime parameters for query performance
SET hnsw.ef_search = 40;  -- Higher values = better recall, slower queries
SET maintenance_work_mem = '1GB';  -- Increase for faster index builds
```

**Query Optimization:**
```typescript
// Optimized similarity search with metadata filtering
export class OptimizedVectorQueries {
  async searchWithFilters(params: {
    workspaceId: string;
    queryEmbedding: number[];
    cardTypes?: string[];
    tags?: string[];
    dateRange?: { start: Date; end: Date };
    limit: number;
  }): Promise<SimilarCard[]> {
    let whereConditions = ['workspace_id = $1', 'embedding IS NOT NULL'];
    let paramIndex = 2;
    const queryParams: any[] = [params.workspaceId];
    
    if (params.cardTypes?.length) {
      whereConditions.push(`type = ANY($${paramIndex})`);
      queryParams.push(params.cardTypes);
      paramIndex++;
    }
    
    if (params.tags?.length) {
      whereConditions.push(`tags && $${paramIndex}`);
      queryParams.push(params.tags);
      paramIndex++;
    }
    
    if (params.dateRange) {
      whereConditions.push(`created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      queryParams.push(params.dateRange.start, params.dateRange.end);
      paramIndex += 2;
    }
    
    // Add embedding and limit parameters
    queryParams.push(JSON.stringify(params.queryEmbedding), params.limit);
    
    const query = `
      SELECT 
        id, title, content, type, tags,
        1 - (embedding <=> $${paramIndex}) as similarity
      FROM cards 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY embedding <=> $${paramIndex}
      LIMIT $${paramIndex + 1}
    `;
    
    const result = await this.db.query(query, queryParams);
    return this.mapResultsToSimilarCards(result.rows);
  }
}
```

### Scalability and Performance

#### Current Capacity
- **Vector Storage**: Handles 1M+ embeddings efficiently
- **Query Performance**: <500ms for similarity searches with proper indexing
- **Memory Requirements**: ~8GB RAM for 1M vectors with HNSW index
- **Storage Overhead**: ~6KB per 1536-dimension vector (including index)

#### Performance Monitoring
```typescript
export class VectorPerformanceMonitor {
  async trackQueryPerformance(): Promise<PerformanceMetrics> {
    const metrics = await this.db.query(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE tablename = 'cards' AND attname = 'embedding'
    `);
    
    const indexStats = await this.db.query(`
      SELECT 
        indexrelname,
        idx_tup_read,
        idx_tup_fetch,
        idx_scan
      FROM pg_stat_user_indexes 
      WHERE relname = 'cards' AND indexrelname LIKE '%embedding%'
    `);
    
    return {
      indexUtilization: indexStats.rows,
      vectorDistribution: metrics.rows,
      queryLatencyMs: await this.measureAverageQueryTime()
    };
  }
}
```

### Cost Analysis

#### pgvector Operating Costs
```typescript
interface PgVectorCosts {
  monthly: {
    databaseInstance: 345.60,    // db.r6g.xlarge: $0.48/hour * 24 * 30
    storage: {
      base: 57.50,               // 500GB GP3: $0.115/GB
      vectorData: 23.04,         // 200GB vectors: 1M vectors * 6KB * $0.115/GB
      indexOverhead: 11.52       // 100GB HNSW indexes
    },
    backups: 5.75,               // Automated backups: 50GB * $0.115/GB
    monitoring: 0,               // CloudWatch included in AWS RDS
    total: 443.41                // Total monthly cost
  },
  annual: 5320.92
}

// Cost per 1M vectors: ~$443/month for full production setup
// Break-even vs Pinecone: pgvector advantage up to ~2M vectors
```

### Implementation Success Metrics
- **Query Performance**: <500ms average for similarity searches
- **Index Build Time**: <10 minutes for 1M vectors
- **Storage Efficiency**: <10GB total for 1M vectors including indexes
- **Cost Efficiency**: <$500/month for 1M+ vector database
- **Availability**: >99.9% uptime leveraging PostgreSQL reliability

---

## Risk Assessment and Mitigation

### Technical Risks

#### High Impact Risks
1. **AI Service Dependency**
   - **Risk**: OpenAI/Claude API downtime or changes
   - **Mitigation**: Implement fallback to local search, cache embeddings, multi-provider support
   - **Monitoring**: API health checks, usage quotas, response time alerts

2. **Performance at Scale**
   - **Risk**: Canvas performance degradation with large datasets
   - **Mitigation**: Virtualization, progressive loading, database optimization
   - **Monitoring**: Performance metrics, load testing, user experience tracking

3. **Data Consistency**
   - **Risk**: Sync conflicts in offline-first architecture
   - **Mitigation**: Robust conflict resolution, version vectors, user-controlled merge
   - **Monitoring**: Sync failure rates, conflict frequency, resolution success

#### Medium Impact Risks
4. **Security Vulnerabilities**
   - **Risk**: Data breaches, unauthorized access
   - **Mitigation**: Regular security audits, input sanitization, encryption
   - **Monitoring**: Security scanning, intrusion detection, audit logs

5. **Mobile Platform Changes**
   - **Risk**: iOS/Android policy changes affecting app functionality
   - **Mitigation**: Stay updated with platform guidelines, alternative distribution methods
   - **Monitoring**: Platform update notifications, app store review status

### Business Risks

#### Market Adoption
- **Risk**: Low user adoption due to complexity
- **Mitigation**: Comprehensive onboarding, progressive disclosure, user testing
- **Metrics**: Activation rates, retention curves, feature usage analytics

#### Competitive Response
- **Risk**: Existing players adding similar AI features
- **Mitigation**: Focus on unique value proposition, rapid feature development
- **Strategy**: Build network effects, establish data moats, patent key innovations

### Operational Risks

#### Team Scalability
- **Risk**: Knowledge transfer as team grows
- **Mitigation**: Comprehensive documentation, code reviews, pair programming
- **Process**: Regular knowledge sharing, architectural decision records

#### Infrastructure Costs
- **Risk**: High AI processing costs with scale
- **Mitigation**: Optimize embedding generation, implement smart caching, consider local models
- **Monitoring**: Cost per user metrics, AI usage patterns, efficiency improvements

---

## Success Metrics and KPIs

### Technical Performance Metrics
- **API Response Time**: < 200ms for 95th percentile
- **Canvas Load Time**: < 2 seconds for 100 cards
- **AI Processing Time**: < 2 seconds for embedding generation
- **Vector Search Time**: < 1 second for similarity queries (pgvector)
- **Database Query Time**: < 100ms for vector similarity search
- **Embedding Storage**: < 50ms for vector upsert operations
- **Sync Latency**: < 5 seconds for text changes
- **Uptime**: 99.9% availability target

### User Experience Metrics
- **Time to First Card**: < 2 minutes from signup
- **Connection Discovery Rate**: 5+ AI connections accepted per user per week
- **Search Success Rate**: 85% of queries return relevant results (improved with pgvector)
- **Vector Search Accuracy**: 90% relevance for top 10 similarity results
- **AI Feature Response Time**: < 3 seconds end-to-end for connection suggestions
- **Cross-Platform Usage**: 70% of users active on both web and mobile
- **Feature Adoption**: 60% of users utilize AI suggestions within first week

### Business Metrics
- **User Activation**: 60% create 10+ cards in first week
- **Daily Active Users**: 40% of monthly active users
- **Retention Rate**: 70% monthly retention for active users
- **Conversion Rate**: 15% free-to-paid conversion within 6 months
- **Net Promoter Score**: >50 for active users
- **Cost Efficiency**: 40% lower vector storage costs vs. dedicated vector DB
- **Infrastructure Scaling**: Support 10x user growth without architecture changes

---

## Conclusion

This technical architecture specification provides a comprehensive blueprint for building Project Nexus as a scalable, intelligent knowledge management platform. The architecture prioritizes:

**Core Strengths:**
1. **AI-First Design**: Embedding generation and connection detection using pgvector are fundamental to the system
2. **Cross-Platform Consistency**: Unified GraphQL API ensures feature parity across web and mobile
3. **Cost-Effective Scaling**: PostgreSQL with pgvector provides vector capabilities without separate service costs
4. **Scalable Foundation**: Architecture supports growth from MVP to enterprise scale with flexible expansion options
5. **Performance Focus**: Optimized caching and pgvector indexing ensure responsive user experience
6. **Security-by-Design**: Comprehensive authentication, authorization, and data protection
7. **Operational Simplicity**: Single database system reduces operational complexity and monitoring overhead

**Implementation Strategy:**
The phased roadmap balances feature delivery with technical debt management, ensuring a solid foundation while delivering user value quickly. The MVP focuses on core differentiation (AI connections via pgvector, visual canvas) while subsequent phases add collaboration and enterprise features.

**Technical Excellence:**
- Type-safe development with TypeScript across all layers
- Comprehensive testing strategy covering unit, integration, and performance tests
- Modern deployment practices with containerization and CI/CD automation
- Observability-first monitoring and logging for production reliability
- pgvector-optimized database configuration for high-performance vector operations
- Optimized pgvector implementation for cost-effective vector search

**Risk Management:**
Proactive identification of technical and business risks with concrete mitigation strategies ensures project resilience. The architecture includes fallback mechanisms for AI dependencies, handles offline scenarios gracefully, and provides efficient pgvector scaling for growing vector storage needs.

This architecture serves as the definitive technical reference for all development teams, providing the structure needed to build Project Nexus into a category-defining intelligent workspace platform. The pgvector-based approach ensures cost-effective startup operations while maintaining the flexibility to scale to dedicated vector databases as the platform grows.

**Key Implementation Notes:**
- The `./backend/` directory contains the complete Node.js GraphQL API service
- The `./clients/web/` directory contains the Next.js 14 web application
- The `./clients/app/` directory contains the Flutter mobile application
- The `./project-documentation/` directory contains all architectural and product documentation
- Each service maintains its own build process and deployment pipeline
- Docker Compose orchestrates the development environment for all services
- CI/CD pipeline handles testing and deployment of changed services only

---

## Project Structure Implementation Guide

### Required Configuration Files

**Root Level Files:**
- `docker-compose.yml` - Development environment orchestration
- `nginx.conf` - Reverse proxy configuration for development
- `.gitignore` - Git ignore patterns for all services
- `README.md` - Project overview and setup instructions

**Backend Configuration (`./backend/`):**
- `package.json` - Node.js dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `Dockerfile` - Container build instructions
- `.env.example` - Environment variable template
- `jest.config.js` - Test configuration
- `graphql.config.js` - GraphQL tooling configuration

**Web Client Configuration (`./clients/web/`):**
- `package.json` - React/Next.js dependencies
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `.env.local.example` - Environment variable template
- `Dockerfile` - Container build instructions

**Mobile App Configuration (`./clients/app/`):**
- `pubspec.yaml` - Flutter dependencies and metadata
- `analysis_options.yaml` - Dart analysis configuration
- `android/app/build.gradle` - Android build configuration
- `ios/Runner.xcworkspace` - iOS build configuration

### Environment Variable Management

**Backend Environment Variables:**
```bash
# Database (PostgreSQL with pgvector)
DATABASE_URL=postgres://user:pass@host:5432/nexus_dev
REDIS_URL=redis://host:6379

# Vector database configuration
VECTOR_SERVICE=pgvector  # Primary vector database using PostgreSQL extension
PGVECTOR_SIMILARITY_THRESHOLD=0.5
PGVECTOR_MAX_RESULTS=20
PGVECTOR_INDEX_TYPE=hnsw  # Options: 'hnsw' | 'ivfflat'

# AI Services
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=text-embedding-ada-002
OPENAI_MAX_RETRIES=3
OPENAI_TIMEOUT_MS=30000

# Additional pgvector optimization settings
PGVECTOR_EF_SEARCH=40  # HNSW search parameter for query recall/speed balance
PGVECTOR_M=16  # HNSW index parameter for connection count

# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.nexus.app

# Auth0 Management API (for user management and monitoring)
AUTH0_MANAGEMENT_CLIENT_ID=your_management_client_id
AUTH0_MANAGEMENT_CLIENT_SECRET=your_management_client_secret
AUTH0_MANAGEMENT_TOKEN=your_management_token  # Optional: for automated user management

# External Services
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
S3_BUCKET_NAME=nexus-files

# Feature flags
ENABLE_AI_FEATURES=true
ENABLE_VECTOR_SEARCH=true
ENABLE_BATCH_PROCESSING=true
```

**Web Client Environment Variables:**
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/graphql
NEXT_PUBLIC_WS_URL=ws://localhost:3000/graphql

# Auth0 Configuration (Next.js)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_nextjs_client_id
AUTH0_CLIENT_SECRET=your_nextjs_client_secret
AUTH0_SECRET=your_auth0_secret_key
AUTH0_BASE_URL=http://localhost:3001
AUTH0_AUDIENCE=https://api.nexus.app

# Feature Flags
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
NEXT_PUBLIC_ENABLE_VECTOR_SEARCH=true
NEXT_PUBLIC_ENABLE_COLLABORATION=false
NEXT_PUBLIC_VECTOR_SERVICE=pgvector

# Performance settings
NEXT_PUBLIC_CANVAS_MAX_CARDS=1000
NEXT_PUBLIC_SEARCH_DEBOUNCE_MS=300
NEXT_PUBLIC_AI_PROCESSING_TIMEOUT_MS=10000
```

**Mobile App Environment Configuration:**
```dart
// lib/core/config/app_config.dart
class AppConfig {
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://api.nexus.dev/graphql',
  );
  
  static const String wsUrl = String.fromEnvironment(
    'WS_URL', 
    defaultValue: 'wss://api.nexus.dev/graphql',
  );
  
  // Auth0 Configuration
  static const String auth0Domain = String.fromEnvironment(
    'AUTH0_DOMAIN',
    defaultValue: 'your-tenant.auth0.com',
  );
  
  static const String auth0ClientId = String.fromEnvironment(
    'AUTH0_CLIENT_ID',
    defaultValue: 'your_flutter_client_id',
  );
  
  static const String auth0Audience = String.fromEnvironment(
    'AUTH0_AUDIENCE',
    defaultValue: 'https://api.nexus.app',
  );
  
  static const bool enableOfflineMode = bool.fromEnvironment(
    'ENABLE_OFFLINE',
    defaultValue: true,
  );
  
  static const bool enableAiFeatures = bool.fromEnvironment(
    'ENABLE_AI_FEATURES',
    defaultValue: true,
  );
  
  static const String vectorService = String.fromEnvironment(
    'VECTOR_SERVICE',
    defaultValue: 'pgvector',
  );
  
  static const int maxOfflineCards = int.fromEnvironment(
    'MAX_OFFLINE_CARDS',
    defaultValue: 500,
  );
  
  static const int aiProcessingTimeoutMs = int.fromEnvironment(
    'AI_PROCESSING_TIMEOUT_MS',
    defaultValue: 15000,
  );
}
```

### Development Workflow Summary

1. **Initial Setup:**
   ```bash
   git clone <repository>
   cd project-nexus
   cp backend/.env.example backend/.env
   cp clients/web/.env.local.example clients/web/.env.local
   docker-compose up -d
   ```

2. **Backend Development:**
   ```bash
   cd backend
   npm install
   npm run dev
   npm run test:watch
   ```

3. **Web Client Development:**
   ```bash
   cd clients/web
   npm install
   npm run dev
   npm run test:watch+
   ```

4. **Mobile Development:**
   ```bash
   cd clients/app
   flutter pub get
   flutter run
   flutter test --watch
   ```

5. **Full Stack Testing:**
   ```bash
   npm run test:all       # Run all service tests
   npm run e2e:test       # End-to-end testing
   npm run build:all      # Build all services
   ```

This structure enables independent development of each service while maintaining consistency through shared API contracts and coordinated deployment processes.