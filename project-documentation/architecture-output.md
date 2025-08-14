# Nexus - Technical Architecture Specification

## Executive Summary

**Project**: Nexus - Intelligent workspace with AI-powered thought connections and visual canvas
**Architecture Goals**: High-performance, scalable, GDPR-compliant system supporting 60 FPS canvas rendering with 1000+ cards, sub-200ms API responses, and offline-capable sync

### Key Architectural Decisions
- **Frontend**: Next.js 14 with TypeScript for web, Flutter for mobile
- **Backend**: Node.js with FastAPI hybrid for AI workloads
- **Database**: PostgreSQL + Redis + Pinecone vector database
- **AI**: OpenAI API with local embedding models for cost optimization
- **Infrastructure**: AWS with Cloudflare CDN for global performance

### Critical Technical Constraints
- Canvas performance: 60 FPS with 1000+ cards
- API response time: < 200ms for all operations
- Search response: < 2s for semantic queries
- Offline capability: Full CRUD operations with conflict resolution
- GDPR compliance: End-to-end encryption for sensitive data

---

## 1. System Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           Frontend Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  Web App (Next.js)           │  Mobile App (Flutter)           │
│  ├─ Canvas Renderer (Konva)  │  ├─ Quick Capture               │
│  ├─ Markdown Editor         │  ├─ Offline Sync Queue          │
│  ├─ Real-time Sync          │  └─ Native Integrations         │
│  └─ State Management        │                                  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                               API Gateway
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                         Backend Services                        │
├─────────────────────────────────────────────────────────────────┤
│  Core API (Node.js/Express)  │  AI Service (Python/FastAPI)    │
│  ├─ Authentication          │  ├─ Embedding Generation         │
│  ├─ CRUD Operations         │  ├─ Connection Discovery         │
│  ├─ Real-time Sync          │  ├─ Semantic Search             │
│  └─ File Management         │  └─ LLM Integration             │
└─────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  Primary DB        │  Vector DB        │  Cache & Queue        │
│  (PostgreSQL)      │  (Pinecone)       │  (Redis)              │
│  ├─ User Data      │  ├─ Embeddings    │  ├─ Session Cache     │
│  ├─ Cards/Content  │  ├─ Similarity    │  ├─ Search Cache      │
│  ├─ Workspaces     │  └─ Indexing      │  └─ Background Jobs   │
│  └─ Relationships  │                   │                       │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Canvas Engine**
- **Purpose**: High-performance visual workspace for card management
- **Technology**: Konva.js with WebGL acceleration
- **Responsibilities**: 
  - Card rendering and positioning
  - Zoom/pan interactions
  - Connection visualization
  - Performance optimization (virtualization)

#### 2. **AI Intelligence Layer**
- **Purpose**: Semantic understanding and connection discovery
- **Technology**: Python FastAPI with LangChain
- **Responsibilities**:
  - Content embeddings generation
  - Similarity calculations
  - Connection suggestions
  - Natural language search

#### 3. **Real-time Sync Engine**
- **Purpose**: Collaborative editing and offline support
- **Technology**: WebSockets + CRDT (Conflict-free Replicated Data Types)
- **Responsibilities**:
  - Real-time collaboration
  - Offline queue management
  - Conflict resolution
  - Event sourcing

#### 4. **Security & Privacy Controller**
- **Purpose**: GDPR compliance and data protection
- **Technology**: JWT with refresh tokens, AES-256 encryption
- **Responsibilities**:
  - Authentication/authorization
  - Data encryption
  - Audit logging
  - Privacy controls

---

## 2. Technology Stack Decisions

### Frontend Architecture

#### Web Application
**Framework**: Next.js 14 with App Router
- **Rationale**: 
  - Server-side rendering for SEO and performance
  - Built-in optimization features
  - Excellent TypeScript support
  - Vercel deployment optimization

**State Management**: Zustand + React Query
- **Rationale**:
  - Lightweight compared to Redux
  - Excellent TypeScript integration
  - Built-in optimistic updates
  - Perfect for real-time applications

**Canvas Library**: Konva.js
- **Rationale**:
  - WebGL acceleration for performance
  - Rich interaction API
  - Better performance than SVG for many objects
  - Mobile-friendly touch events

**Editor**: Lexical (Facebook)
- **Rationale**:
  - Modern architecture with plugins
  - Better performance than Monaco for inline editing
  - Excellent mobile support
  - Rich text + Markdown hybrid

#### Mobile Application
**Framework**: Flutter
- **Rationale**:
  - Single codebase for iOS/Android
  - Native performance
  - Excellent offline capabilities
  - Strong ecosystem for widgets

### Backend Architecture

#### Core API Service
**Runtime**: Node.js 20 LTS
**Framework**: Express.js with TypeScript
- **Rationale**:
  - Excellent ecosystem for real-time features
  - JSON handling performance
  - WebSocket support
  - Large talent pool

#### AI Service
**Runtime**: Python 3.11
**Framework**: FastAPI
- **Rationale**:
  - Superior ML/AI library ecosystem
  - Async support for concurrent requests
  - Automatic OpenAPI documentation
  - Type hints for better code quality

#### Database Strategy
**Primary Database**: PostgreSQL 15
- **Rationale**:
  - ACID compliance for data integrity
  - JSON column support for flexible schemas
  - Full-text search capabilities
  - Excellent performance for complex queries

**Vector Database**: Pinecone
- **Rationale**:
  - Managed service reduces operational overhead
  - Excellent performance for similarity search
  - Built-in metadata filtering
  - Scales automatically

**Cache & Queue**: Redis 7
- **Rationale**:
  - In-memory performance for hot data
  - Pub/Sub for real-time features
  - Queue management for background jobs
  - Session storage

### Infrastructure Decisions

#### Cloud Provider: AWS
- **Rationale**:
  - Comprehensive service ecosystem
  - Strong security and compliance features
  - Global edge locations
  - Cost-effective for MVP to scale

#### CDN: Cloudflare
- **Rationale**:
  - Global edge network
  - DDoS protection included
  - Web Application Firewall
  - Cost-effective bandwidth

#### Monitoring: DataDog + Sentry
- **Rationale**:
  - Comprehensive application monitoring
  - Error tracking and alerting
  - Performance profiling
  - User session replay

---

## 3. Data Architecture

### Core Entity Models

#### User Entity
```typescript
interface User {
  id: string;                    // UUID primary key
  email: string;                 // Unique, encrypted
  name: string;                  // Display name
  avatar_url?: string;           // Profile image
  created_at: Date;
  updated_at: Date;
  preferences: {
    theme: 'light' | 'dark';
    canvas_settings: CanvasPreferences;
    ai_settings: AIPreferences;
  };
  subscription: {
    tier: 'free' | 'pro' | 'team' | 'enterprise';
    status: 'active' | 'canceled' | 'past_due';
    current_period_end: Date;
  };
}
```

#### Workspace Entity
```typescript
interface Workspace {
  id: string;                    // UUID primary key
  name: string;                  // Workspace title
  description?: string;          // Optional description
  owner_id: string;              // Foreign key to User
  created_at: Date;
  updated_at: Date;
  settings: {
    is_public: boolean;
    collaboration_mode: 'private' | 'read_only' | 'collaborative';
    ai_features_enabled: boolean;
  };
  canvas_state: {
    viewport: { x: number; y: number; zoom: number };
    background_color: string;
    grid_enabled: boolean;
  };
}
```

#### Card Entity
```typescript
interface Card {
  id: string;                    // UUID primary key
  workspace_id: string;          // Foreign key to Workspace
  author_id: string;             // Foreign key to User
  title: string;                 // Card title
  content: string;               // Markdown content
  content_type: 'text' | 'image' | 'file' | 'url';
  created_at: Date;
  updated_at: Date;
  position: {
    x: number;                   // Canvas coordinates
    y: number;
    width: number;               // Card dimensions
    height: number;
    z_index: number;             // Layer order
  };
  style: {
    background_color: string;
    border_color: string;
    font_size: number;
  };
  metadata: {
    word_count: number;
    reading_time_minutes: number;
    last_modified_by: string;
    version: number;             // For conflict resolution
  };
  tags: string[];                // User-defined tags
}
```

#### Connection Entity
```typescript
interface Connection {
  id: string;                    // UUID primary key
  workspace_id: string;          // Foreign key to Workspace
  source_card_id: string;        // Foreign key to Card
  target_card_id: string;        // Foreign key to Card
  type: 'manual' | 'ai_suggested' | 'ai_confirmed';
  strength: number;              // 0.0 - 1.0 similarity score
  reason?: string;               // AI explanation for connection
  created_at: Date;
  created_by: string;            // User or 'system'
  status: 'active' | 'rejected' | 'pending';
  style: {
    color: string;
    thickness: number;
    line_type: 'solid' | 'dashed' | 'dotted';
  };
}
```

#### Embedding Entity (Vector Storage)
```typescript
interface CardEmbedding {
  card_id: string;               // Foreign key to Card
  embedding: number[];           // 1536-dimensional vector (OpenAI)
  model_version: string;         // Embedding model identifier
  content_hash: string;          // For cache invalidation
  created_at: Date;
  metadata: {
    content_length: number;
    language: string;
    content_type: string;
  };
}
```

### Database Schema Design

#### PostgreSQL Tables

**Users Table**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  subscription JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users USING GIN(subscription);
```

**Workspaces Table**
```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  canvas_state JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX idx_workspaces_settings ON workspaces USING GIN(settings);
```

**Cards Table**
```sql
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  content_type VARCHAR(50) DEFAULT 'text',
  position JSONB NOT NULL,
  style JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Full-text search
  content_search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', title || ' ' || COALESCE(content, ''))
  ) STORED
);

CREATE INDEX idx_cards_workspace ON cards(workspace_id);
CREATE INDEX idx_cards_author ON cards(author_id);
CREATE INDEX idx_cards_search ON cards USING GIN(content_search);
CREATE INDEX idx_cards_tags ON cards USING GIN(tags);
CREATE INDEX idx_cards_updated ON cards(updated_at);
```

**Connections Table**
```sql
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  source_card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  target_card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  strength DECIMAL(3,2) CHECK (strength >= 0.0 AND strength <= 1.0),
  reason TEXT,
  status VARCHAR(50) DEFAULT 'active',
  style JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT unique_connection UNIQUE(source_card_id, target_card_id),
  CONSTRAINT no_self_connection CHECK(source_card_id != target_card_id)
);

CREATE INDEX idx_connections_workspace ON connections(workspace_id);
CREATE INDEX idx_connections_source ON connections(source_card_id);
CREATE INDEX idx_connections_target ON connections(target_card_id);
CREATE INDEX idx_connections_type ON connections(type, status);
```

### Caching Strategy

#### Redis Cache Layers
```typescript
// Cache keys and TTL strategy
const CACHE_KEYS = {
  USER_SESSION: 'session:{user_id}',           // TTL: 24h
  WORKSPACE_DATA: 'workspace:{workspace_id}',  // TTL: 1h
  CARD_CONTENT: 'card:{card_id}',             // TTL: 30min
  SEARCH_RESULTS: 'search:{query_hash}',       // TTL: 15min
  AI_EMBEDDINGS: 'embedding:{card_id}',        // TTL: 7d
  CONNECTION_GRAPH: 'graph:{workspace_id}',    // TTL: 1h
};

// Cache invalidation patterns
const invalidateWorkspaceCache = (workspaceId: string) => {
  redis.del(`workspace:${workspaceId}`);
  redis.del(`graph:${workspaceId}`);
  // Clear search cache for workspace
  redis.eval(`
    for i, name in ipairs(redis.call('KEYS', 'search:*:${workspaceId}')) do
      redis.call('DEL', name)
    end
  `);
};
```

---

## 4. API Design & Contracts

### REST API Endpoints

#### Authentication Endpoints
```typescript
// POST /api/auth/register
interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

interface RegisterResponse {
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
}

// POST /api/auth/login
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
}
```

#### Workspace Management
```typescript
// GET /api/workspaces
interface GetWorkspacesResponse {
  workspaces: Workspace[];
  total: number;
  page: number;
  limit: number;
}

// POST /api/workspaces
interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  settings?: Partial<Workspace['settings']>;
}

interface CreateWorkspaceResponse {
  workspace: Workspace;
}

// GET /api/workspaces/:id/cards
interface GetWorkspaceCardsResponse {
  cards: Card[];
  connections: Connection[];
  total_cards: number;
}
```

#### Card Operations
```typescript
// POST /api/cards
interface CreateCardRequest {
  workspace_id: string;
  title: string;
  content?: string;
  position: Card['position'];
  style?: Partial<Card['style']>;
  tags?: string[];
}

interface CreateCardResponse {
  card: Card;
  suggested_connections?: Connection[];
}

// PUT /api/cards/:id
interface UpdateCardRequest {
  title?: string;
  content?: string;
  position?: Card['position'];
  style?: Partial<Card['style']>;
  tags?: string[];
}

interface UpdateCardResponse {
  card: Card;
  new_connections?: Connection[];
}

// DELETE /api/cards/:id
interface DeleteCardResponse {
  success: boolean;
  removed_connections: string[];
}
```

#### Search & AI Features
```typescript
// POST /api/search/semantic
interface SemanticSearchRequest {
  workspace_id: string;
  query: string;
  limit?: number;
  filters?: {
    tags?: string[];
    date_range?: { start: Date; end: Date };
    content_type?: string[];
  };
}

interface SemanticSearchResponse {
  results: Array<{
    card: Card;
    relevance_score: number;
    matching_excerpt: string;
  }>;
  query_time_ms: number;
  total_results: number;
}

// POST /api/ai/suggest-connections
interface SuggestConnectionsRequest {
  card_id: string;
  max_suggestions?: number;
}

interface SuggestConnectionsResponse {
  suggestions: Array<{
    target_card: Card;
    connection: Omit<Connection, 'id' | 'created_at'>;
    confidence: number;
  }>;
  processing_time_ms: number;
}
```

### WebSocket Events

#### Real-time Collaboration
```typescript
// Client -> Server events
interface ClientEvents {
  'join_workspace': { workspace_id: string };
  'leave_workspace': { workspace_id: string };
  'card_update': { card_id: string; changes: Partial<Card> };
  'card_move': { card_id: string; position: Card['position'] };
  'cursor_move': { x: number; y: number; user_id: string };
}

// Server -> Client events
interface ServerEvents {
  'user_joined': { user: User; workspace_id: string };
  'user_left': { user_id: string; workspace_id: string };
  'card_updated': { card: Card; updated_by: string };
  'card_created': { card: Card; created_by: string };
  'card_deleted': { card_id: string; deleted_by: string };
  'connection_created': { connection: Connection; created_by: string };
  'cursor_moved': { user_id: string; x: number; y: number };
  'sync_conflict': { card_id: string; conflicts: ConflictData[] };
}
```

### API Response Standards

#### Standard Response Format
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    timestamp: string;
    request_id: string;
    processing_time_ms: number;
  };
}

// Error codes standardization
enum ErrorCodes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED'
}
```

#### Rate Limiting
```typescript
// Rate limit headers in all responses
interface RateLimitHeaders {
  'X-RateLimit-Limit': string;     // Requests per window
  'X-RateLimit-Remaining': string; // Remaining requests
  'X-RateLimit-Reset': string;     // Reset time (Unix timestamp)
  'X-RateLimit-Window': string;    // Window duration in seconds
}

// Different limits per endpoint type
const RATE_LIMITS = {
  '/api/auth/*': '5 requests per minute',
  '/api/cards': '100 requests per minute',
  '/api/search/semantic': '30 requests per minute',
  '/api/ai/*': '20 requests per minute',
  '/api/upload': '10 requests per minute'
};
```

---

## 5. AI Architecture

### Embedding Strategy

#### Model Selection
**Primary**: OpenAI text-embedding-3-small
- **Rationale**: 
  - Cost-effective at $0.02/1M tokens
  - 1536 dimensions (good balance of performance/storage)
  - Multilingual support
  - Consistent performance across domains

**Fallback**: Local Sentence-BERT model
- **Purpose**: Cost optimization for high-volume users
- **Model**: all-MiniLM-L6-v2
- **Trade-off**: Slightly lower quality but no API costs

#### Embedding Pipeline
```typescript
interface EmbeddingService {
  generateEmbedding(content: string, cardId: string): Promise<EmbeddingResult>;
  batchGenerateEmbeddings(cards: Card[]): Promise<EmbeddingResult[]>;
  findSimilarCards(cardId: string, threshold: number): Promise<SimilarCard[]>;
  updateEmbedding(cardId: string, newContent: string): Promise<void>;
}

interface EmbeddingResult {
  card_id: string;
  embedding: number[];
  model_version: string;
  confidence: number;
  processing_time_ms: number;
}

// Content preprocessing pipeline
class ContentPreprocessor {
  preprocessForEmbedding(content: string): string {
    return content
      .replace(/!\[.*?\]\(.*?\)/g, '[IMAGE]')  // Replace images
      .replace(/\[.*?\]\(.*?\)/g, '$1')        // Extract link text
      .replace(/```[\s\S]*?```/g, '[CODE]')    // Replace code blocks
      .replace(/#{1,6}\s/g, '')                // Remove markdown headers
      .trim();
  }
  
  extractKeyPhrases(content: string): string[] {
    // Use simple NLP for key phrase extraction
    // In production, could use more sophisticated models
    return content
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 20); // Limit to top 20 words
  }
}
```

### Connection Discovery Algorithm

#### Similarity Calculation
```typescript
class ConnectionDiscoveryService {
  async findConnections(cardId: string): Promise<SuggestedConnection[]> {
    const targetCard = await this.getCard(cardId);
    const embedding = await this.getEmbedding(cardId);
    
    // Vector similarity search
    const similarCards = await this.vectorDB.query({
      vector: embedding,
      topK: 20,
      filter: {
        workspace_id: targetCard.workspace_id,
        card_id: { $ne: cardId }
      }
    });
    
    // Post-processing filters
    const connections = await Promise.all(
      similarCards.map(async (match) => {
        const similarity = match.score;
        const sourceCard = await this.getCard(match.id);
        
        // Additional scoring factors
        const recencyBoost = this.calculateRecencyBoost(sourceCard);
        const tagOverlap = this.calculateTagOverlap(targetCard, sourceCard);
        const lengthPenalty = this.calculateLengthPenalty(sourceCard);
        
        const finalScore = similarity * recencyBoost * tagOverlap * lengthPenalty;
        
        if (finalScore > 0.75) {
          return {
            source_card_id: cardId,
            target_card_id: sourceCard.id,
            strength: finalScore,
            reason: await this.generateConnectionReason(targetCard, sourceCard),
            type: 'ai_suggested' as const
          };
        }
        
        return null;
      })
    );
    
    return connections.filter(Boolean);
  }
  
  private calculateRecencyBoost(card: Card): number {
    const daysSinceCreation = (Date.now() - card.created_at.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0.5, 1 - (daysSinceCreation / 90)); // Decay over 90 days
  }
  
  private calculateTagOverlap(card1: Card, card2: Card): number {
    const commonTags = card1.tags.filter(tag => card2.tags.includes(tag));
    const totalTags = new Set([...card1.tags, ...card2.tags]).size;
    return totalTags > 0 ? (commonTags.length / totalTags) * 1.2 + 0.8 : 1.0;
  }
  
  private async generateConnectionReason(card1: Card, card2: Card): Promise<string> {
    // Use LLM to generate human-readable connection reason
    const prompt = `
      Explain in one sentence why these two cards might be connected:
      
      Card 1: "${card1.title}" - ${card1.content.substring(0, 200)}...
      Card 2: "${card2.title}" - ${card2.content.substring(0, 200)}...
      
      Focus on the conceptual or thematic relationship.
    `;
    
    const response = await this.llmClient.complete({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.3
    });
    
    return response.choices[0].message.content.trim();
  }
}
```

### Semantic Search Implementation

#### Search Pipeline
```typescript
class SemanticSearchService {
  async search(query: string, workspaceId: string, options: SearchOptions): Promise<SearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    
    // Vector similarity search
    const vectorResults = await this.vectorDB.query({
      vector: queryEmbedding,
      topK: options.limit * 2, // Get more results for re-ranking
      filter: { workspace_id: workspaceId }
    });
    
    // Hybrid search: combine with text search
    const textResults = await this.textSearch(query, workspaceId);
    
    // Merge and re-rank results
    const mergedResults = this.mergeResults(vectorResults, textResults);
    
    // Apply additional filters
    const filteredResults = this.applyFilters(mergedResults, options.filters);
    
    // Generate excerpts
    const resultsWithExcerpts = await Promise.all(
      filteredResults.slice(0, options.limit).map(async (result) => {
        const excerpt = await this.generateExcerpt(result.card.content, query);
        return {
          card: result.card,
          relevance_score: result.score,
          matching_excerpt: excerpt
        };
      })
    );
    
    return resultsWithExcerpts;
  }
  
  private async textSearch(query: string, workspaceId: string): Promise<SearchResult[]> {
    // PostgreSQL full-text search as fallback
    const results = await this.db.query(`
      SELECT *, ts_rank(content_search, plainto_tsquery($1)) as rank
      FROM cards 
      WHERE workspace_id = $2 
        AND content_search @@ plainto_tsquery($1)
      ORDER BY rank DESC
      LIMIT 50
    `, [query, workspaceId]);
    
    return results.rows.map(row => ({
      card: this.mapRowToCard(row),
      score: row.rank,
      source: 'text_search'
    }));
  }
  
  private mergeResults(vectorResults: any[], textResults: SearchResult[]): SearchResult[] {
    // Combine results with weighted scoring
    const vectorWeight = 0.7;
    const textWeight = 0.3;
    
    const cardScores = new Map<string, number>();
    const cards = new Map<string, Card>();
    
    // Process vector results
    vectorResults.forEach(result => {
      cardScores.set(result.id, result.score * vectorWeight);
      cards.set(result.id, result.metadata);
    });
    
    // Add text search results
    textResults.forEach(result => {
      const existingScore = cardScores.get(result.card.id) || 0;
      cardScores.set(result.card.id, existingScore + (result.score * textWeight));
      cards.set(result.card.id, result.card);
    });
    
    // Sort by combined score
    return Array.from(cardScores.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([cardId, score]) => ({
        card: cards.get(cardId)!,
        score,
        source: 'hybrid'
      }));
  }
}
```

### LLM Integration Architecture

#### Provider Abstraction
```typescript
interface LLMProvider {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed(text: string): Promise<number[]>;
  healthCheck(): Promise<boolean>;
}

class LLMService {
  private providers: Map<string, LLMProvider>;
  private fallbackChain: string[];
  
  constructor() {
    this.providers = new Map([
      ['openai', new OpenAIProvider()],
      ['anthropic', new AnthropicProvider()],
      ['local', new LocalLLMProvider()]
    ]);
    
    this.fallbackChain = ['openai', 'anthropic', 'local'];
  }
  
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    for (const providerId of this.fallbackChain) {
      try {
        const provider = this.providers.get(providerId);
        if (!provider) continue;
        
        const response = await provider.complete({
          ...request,
          timeout: 30000 // 30 second timeout
        });
        
        // Log usage for cost tracking
        await this.logUsage(providerId, request, response);
        
        return response;
      } catch (error) {
        console.warn(`LLM provider ${providerId} failed:`, error);
        continue;
      }
    }
    
    throw new Error('All LLM providers failed');
  }
}
```

### Cost Optimization Strategy

#### Token Usage Monitoring
```typescript
class CostOptimizationService {
  private readonly DAILY_LIMITS = {
    free: { tokens: 10000, embeddings: 1000 },
    pro: { tokens: 100000, embeddings: 10000 },
    team: { tokens: 500000, embeddings: 50000 }
  };
  
  async checkUsageLimits(userId: string, operation: 'completion' | 'embedding'): Promise<boolean> {
    const user = await this.getUserWithSubscription(userId);
    const limits = this.DAILY_LIMITS[user.subscription.tier];
    
    const todayUsage = await this.getDailyUsage(userId);
    
    switch (operation) {
      case 'completion':
        return todayUsage.tokens < limits.tokens;
      case 'embedding':
        return todayUsage.embeddings < limits.embeddings;
      default:
        return false;
    }
  }
  
  async optimizeEmbeddingRequests(cards: Card[]): Promise<Card[]> {
    // Skip re-embedding if content hasn't changed significantly
    const cardsNeedingEmbedding = await Promise.all(
      cards.map(async (card) => {
        const existingEmbedding = await this.getEmbedding(card.id);
        if (!existingEmbedding) return card;
        
        const contentHash = this.hashContent(card.content);
        if (existingEmbedding.content_hash === contentHash) {
          return null; // Skip, no changes
        }
        
        return card;
      })
    );
    
    return cardsNeedingEmbedding.filter(Boolean);
  }
}
```

---

## 6. Security & Compliance Framework

### Authentication & Authorization

#### JWT Token Strategy
```typescript
interface TokenPayload {
  user_id: string;
  email: string;
  subscription_tier: string;
  permissions: Permission[];
  iat: number;
  exp: number;
  jti: string; // Token ID for revocation
}

class AuthenticationService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  
  async generateTokens(user: User): Promise<TokenPair> {
    const accessPayload: TokenPayload = {
      user_id: user.id,
      email: user.email,
      subscription_tier: user.subscription.tier,
      permissions: await this.getUserPermissions(user.id),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      jti: generateUUID()
    };
    
    const refreshPayload = {
      user_id: user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      jti: generateUUID()
    };
    
    const accessToken = jwt.sign(accessPayload, process.env.JWT_ACCESS_SECRET);
    const refreshToken = jwt.sign(refreshPayload, process.env.JWT_REFRESH_SECRET);
    
    // Store refresh token hash for revocation
    await this.storeRefreshTokenHash(refreshPayload.jti, user.id);
    
    return { accessToken, refreshToken };
  }
  
  async validatePermissions(userId: string, resource: string, action: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    
    // Check specific permission
    const hasPermission = userPermissions.some(p => 
      p.resource === resource && p.actions.includes(action)
    );
    
    // Check ownership for user-specific resources
    if (!hasPermission && resource.startsWith('workspace:')) {
      const workspaceId = resource.split(':')[1];
      return await this.isWorkspaceOwnerOrMember(userId, workspaceId);
    }
    
    return hasPermission;
  }
}
```

#### Role-Based Access Control
```typescript
enum Role {
  WORKSPACE_OWNER = 'workspace_owner',
  WORKSPACE_MEMBER = 'workspace_member',
  WORKSPACE_VIEWER = 'workspace_viewer'
}

interface Permission {
  resource: string;
  actions: string[];
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.WORKSPACE_OWNER]: [
    { resource: 'workspace:*', actions: ['read', 'write', 'delete', 'manage'] },
    { resource: 'card:*', actions: ['read', 'write', 'delete'] },
    { resource: 'connection:*', actions: ['read', 'write', 'delete'] }
  ],
  [Role.WORKSPACE_MEMBER]: [
    { resource: 'workspace:*', actions: ['read', 'write'] },
    { resource: 'card:*', actions: ['read', 'write'] },
    { resource: 'connection:*', actions: ['read', 'write'] }
  ],
  [Role.WORKSPACE_VIEWER]: [
    { resource: 'workspace:*', actions: ['read'] },
    { resource: 'card:*', actions: ['read'] },
    { resource: 'connection:*', actions: ['read'] }
  ]
};
```

### Data Encryption Strategy

#### Encryption at Rest
```typescript
class EncryptionService {
  private readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  private readonly ALGORITHM = 'aes-256-gcm';
  
  async encryptSensitiveData(data: string): Promise<EncryptedData> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.ALGORITHM, this.ENCRYPTION_KEY);
    cipher.setAAD(Buffer.from('nexus-app'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  async decryptSensitiveData(encryptedData: EncryptedData): Promise<string> {
    const decipher = crypto.createDecipher(this.ALGORITHM, this.ENCRYPTION_KEY);
    decipher.setAAD(Buffer.from('nexus-app'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Database encryption configuration
const DATABASE_ENCRYPTION = {
  // Encrypt PII fields
  encrypted_fields: ['email', 'name', 'content'],
  
  // Transparent Data Encryption (TDE) for PostgreSQL
  tde_enabled: true,
  
  // Encryption keys rotation
  key_rotation_days: 90
};
```

#### GDPR Compliance Implementation

```typescript
class GDPRService {
  async handleDataPortabilityRequest(userId: string): Promise<UserDataExport> {
    const userData = await this.collectAllUserData(userId);
    
    return {
      user_profile: userData.profile,
      workspaces: userData.workspaces.map(w => ({
        ...w,
        cards: w.cards.map(c => ({
          ...c,
          content: await this.decryptContent(c.content)
        }))
      })),
      connections: userData.connections,
      ai_data: {
        embeddings_count: userData.embeddingsCount,
        connection_suggestions: userData.aiSuggestions
      },
      export_date: new Date().toISOString(),
      format_version: '1.0'
    };
  }
  
  async handleRightToErasure(userId: string): Promise<DeletionReport> {
    // Soft delete for 30 days, then hard delete
    await this.markUserForDeletion(userId);
    
    // Anonymize shared content
    await this.anonymizeSharedWorkspaces(userId);
    
    // Remove from AI systems
    await this.removeUserEmbeddings(userId);
    
    // Schedule background deletion
    await this.scheduleHardDeletion(userId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    
    return {
      user_id: userId,
      deletion_scheduled: true,
      hard_deletion_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      recoverable_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }
  
  async handleConsentWithdrawal(userId: string, consentType: ConsentType): Promise<void> {
    switch (consentType) {
      case 'AI_PROCESSING':
        await this.disableAIFeatures(userId);
        await this.deleteUserEmbeddings(userId);
        break;
      case 'ANALYTICS':
        await this.anonymizeAnalyticsData(userId);
        break;
      case 'MARKETING':
        await this.unsubscribeFromMarketing(userId);
        break;
    }
  }
}
```

### Security Headers & Middleware

#### Express Security Configuration
```typescript
class SecurityMiddleware {
  static configure(app: Express): void {
    // Helmet for security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
          fontSrc: ["'self'", "fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "*.cloudfront.net"],
          connectSrc: ["'self'", "wss:", "*.openai.com"],
          workerSrc: ["'self'", "blob:"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));
    
    // Rate limiting
    app.use('/api/', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false
    }));
    
    // API-specific rate limits
    app.use('/api/ai/', rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 20, // 20 requests per minute for AI endpoints
      keyGenerator: (req) => req.user?.id || req.ip
    }));
    
    // CORS configuration
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      optionsSuccessStatus: 200
    }));
  }
}
```

### Audit Logging

#### Security Event Logging
```typescript
interface SecurityEvent {
  event_type: 'LOGIN' | 'LOGOUT' | 'PERMISSION_DENIED' | 'DATA_ACCESS' | 'DATA_EXPORT';
  user_id?: string;
  ip_address: string;
  user_agent: string;
  resource_accessed?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

class AuditLogger {
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    // Log to secure audit database
    await this.auditDB.events.create({
      ...event,
      id: generateUUID(),
      created_at: new Date()
    });
    
    // Send to SIEM if high-severity
    if (this.isHighSeverity(event)) {
      await this.sendToSIEM(event);
    }
    
    // Alert on suspicious patterns
    await this.checkForSuspiciousPatterns(event);
  }
  
  private isHighSeverity(event: SecurityEvent): boolean {
    return [
      'PERMISSION_DENIED',
      'MULTIPLE_FAILED_LOGINS',
      'BULK_DATA_ACCESS'
    ].includes(event.event_type);
  }
  
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    const events = await this.auditDB.events.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      }
    });
    
    return {
      period: { start: startDate, end: endDate },
      total_events: events.length,
      user_access_events: events.filter(e => e.event_type === 'DATA_ACCESS').length,
      security_violations: events.filter(e => e.event_type === 'PERMISSION_DENIED').length,
      data_exports: events.filter(e => e.event_type === 'DATA_EXPORT').length,
      compliance_score: this.calculateComplianceScore(events)
    };
  }
}
```

---

## 7. Performance Optimization Strategy

### Canvas Performance Architecture

#### Virtual Rendering System
```typescript
class VirtualCanvasRenderer {
  private viewport: Viewport;
  private visibleCards: Set<string>;
  private cardPool: Map<string, CanvasCard>;
  
  constructor(private canvas: HTMLCanvasElement) {
    this.viewport = new Viewport(canvas);
    this.visibleCards = new Set();
    this.cardPool = new Map();
  }
  
  async render(cards: Card[]): Promise<void> {
    // Only render cards in viewport + buffer
    const visibleArea = this.calculateVisibleArea();
    const cardsToRender = cards.filter(card => 
      this.isCardInArea(card, visibleArea)
    );
    
    // Virtualization: limit concurrent renders
    const maxConcurrentRenders = 100;
    const renderBatch = cardsToRender.slice(0, maxConcurrentRenders);
    
    // Use requestAnimationFrame for smooth rendering
    const renderFrame = () => {
      this.clearCanvas();
      
      renderBatch.forEach(card => {
        const canvasCard = this.getOrCreateCanvasCard(card);
        canvasCard.render(this.viewport);
      });
      
      // Render connections
      this.renderConnections(renderBatch);
      
      // Update FPS counter
      this.updateFPS();
    };
    
    requestAnimationFrame(renderFrame);
  }
  
  private calculateVisibleArea(): BoundingBox {
    const { x, y, zoom } = this.viewport;
    const { width, height } = this.canvas;
    
    // Add buffer for smooth scrolling
    const buffer = 200;
    
    return {
      left: x - buffer / zoom,
      top: y - buffer / zoom,
      right: x + (width / zoom) + buffer / zoom,
      bottom: y + (height / zoom) + buffer / zoom
    };
  }
  
  // Level-of-detail rendering
  private getLODLevel(card: Card, zoom: number): LODLevel {
    if (zoom < 0.3) return 'minimal';      // Just title
    if (zoom < 0.7) return 'summary';      // Title + first line
    return 'full';                         // Full content
  }
}
```

#### WebGL Acceleration
```typescript
class WebGLCanvasRenderer {
  private gl: WebGLRenderingContext;
  private shaderProgram: WebGLProgram;
  private cardInstances: Float32Array;
  
  constructor(canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    this.initializeShaders();
    this.setupBuffers();
  }
  
  private initializeShaders(): void {
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      attribute vec4 a_color;
      
      uniform mat3 u_transform;
      uniform vec2 u_resolution;
      
      varying vec2 v_texCoord;
      varying vec4 v_color;
      
      void main() {
        vec2 position = (u_transform * vec3(a_position, 1)).xy;
        vec2 clipSpace = ((position / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
        
        gl_Position = vec4(clipSpace, 0, 1);
        v_texCoord = a_texCoord;
        v_color = a_color;
      }
    `;
    
    const fragmentShaderSource = `
      precision mediump float;
      
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;
      varying vec4 v_color;
      
      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord) * v_color;
      }
    `;
    
    this.shaderProgram = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
  }
  
  renderCards(cards: Card[], transform: Transform): void {
    // Batch render all cards in single draw call
    this.gl.useProgram(this.shaderProgram);
    
    // Update instance data
    this.updateCardInstances(cards);
    
    // Set uniforms
    this.gl.uniformMatrix3fv(
      this.gl.getUniformLocation(this.shaderProgram, 'u_transform'),
      false,
      transform.matrix
    );
    
    // Draw instanced
    this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, 6, cards.length);
  }
}
```

### Database Performance Optimization

#### Query Optimization
```sql
-- Optimized workspace card loading
CREATE OR REPLACE FUNCTION get_workspace_cards_optimized(workspace_uuid UUID, user_uuid UUID)
RETURNS TABLE (
  card_data JSONB,
  connection_data JSONB,
  user_permissions TEXT[]
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Check permissions first
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  WITH card_with_connections AS (
    SELECT 
      c.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', conn.id,
            'target_card_id', conn.target_card_id,
            'strength', conn.strength,
            'type', conn.type
          )
        ) FILTER (WHERE conn.id IS NOT NULL),
        '[]'::json
      ) as connections
    FROM cards c
    LEFT JOIN connections conn ON c.id = conn.source_card_id
    WHERE c.workspace_id = workspace_uuid
    GROUP BY c.id
  )
  SELECT 
    row_to_json(cwc.*)::JSONB as card_data,
    cwc.connections::JSONB as connection_data,
    ARRAY['read', 'write']::TEXT[] as user_permissions
  FROM card_with_connections cwc
  ORDER BY cwc.updated_at DESC;
END;
$$;

-- Indexes for performance
CREATE INDEX CONCURRENTLY idx_cards_workspace_updated 
ON cards(workspace_id, updated_at DESC);

CREATE INDEX CONCURRENTLY idx_connections_source_target 
ON connections(source_card_id, target_card_id) 
WHERE status = 'active';

-- Partial index for recent cards (hot data)
CREATE INDEX CONCURRENTLY idx_cards_recent 
ON cards(workspace_id, updated_at) 
WHERE updated_at > NOW() - INTERVAL '30 days';
```

#### Caching Architecture
```typescript
class MultiLayerCache {
  private l1Cache: LRUCache<string, any>; // In-memory
  private l2Cache: Redis;                 // Redis
  private l3Cache: S3;                    // S3 for large objects
  
  constructor() {
    this.l1Cache = new LRUCache({
      max: 1000,
      ttl: 5 * 60 * 1000 // 5 minutes
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    // L1: Check memory cache
    let value = this.l1Cache.get(key);
    if (value) {
      this.recordCacheHit('l1', key);
      return value;
    }
    
    // L2: Check Redis
    value = await this.l2Cache.get(key);
    if (value) {
      this.l1Cache.set(key, value);
      this.recordCacheHit('l2', key);
      return JSON.parse(value);
    }
    
    // L3: Check S3 for large objects
    if (this.isLargeObjectKey(key)) {
      value = await this.l3Cache.getObject({ Key: key });
      if (value) {
        const parsed = JSON.parse(value.Body.toString());
        this.l2Cache.setex(key, 3600, JSON.stringify(parsed)); // 1 hour
        this.l1Cache.set(key, parsed);
        this.recordCacheHit('l3', key);
        return parsed;
      }
    }
    
    this.recordCacheMiss(key);
    return null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Always set in L1
    this.l1Cache.set(key, value);
    
    // Set in L2 with TTL
    await this.l2Cache.setex(key, ttl || 3600, JSON.stringify(value));
    
    // Set in L3 for large objects
    if (this.isLargeObject(value)) {
      await this.l3Cache.putObject({
        Key: key,
        Body: JSON.stringify(value),
        StorageClass: 'STANDARD_IA' // Infrequent access
      });
    }
  }
  
  // Cache warming for predictable access patterns
  async warmCache(userId: string): Promise<void> {
    const userWorkspaces = await this.getUserWorkspaces(userId);
    
    // Pre-load recent workspaces
    const recentWorkspaces = userWorkspaces
      .sort((a, b) => b.last_accessed.getTime() - a.last_accessed.getTime())
      .slice(0, 3);
    
    await Promise.all(
      recentWorkspaces.map(workspace => 
        this.preloadWorkspaceData(workspace.id)
      )
    );
  }
}
```

### Real-time Sync Performance

#### CRDT Implementation for Conflict Resolution
```typescript
class CardCRDT {
  constructor(
    public id: string,
    public state: CardState,
    public vectorClock: VectorClock
  ) {}
  
  merge(other: CardCRDT): CardCRDT {
    const mergedClock = this.vectorClock.merge(other.vectorClock);
    const mergedState = this.mergeState(this.state, other.state, mergedClock);
    
    return new CardCRDT(this.id, mergedState, mergedClock);
  }
  
  private mergeState(local: CardState, remote: CardState, clock: VectorClock): CardState {
    // Last-writer-wins for simple fields
    const result: CardState = { ...local };
    
    // Title: use vector clock to determine winner
    if (clock.isAfter(remote.title_timestamp, local.title_timestamp)) {
      result.title = remote.title;
      result.title_timestamp = remote.title_timestamp;
    }
    
    // Content: use operational transformation for text
    if (local.content !== remote.content) {
      result.content = this.mergeContent(local.content, remote.content, clock);
    }
    
    // Position: use last-writer-wins with conflict resolution
    if (clock.isAfter(remote.position_timestamp, local.position_timestamp)) {
      result.position = remote.position;
    }
    
    return result;
  }
  
  private mergeContent(local: string, remote: string, clock: VectorClock): string {
    // Simple line-based merge for MVP
    // In production, use proper operational transformation
    const localLines = local.split('\n');
    const remoteLines = remote.split('\n');
    
    const merged = this.mergeLinesWithConflictMarkers(localLines, remoteLines);
    return merged.join('\n');
  }
}

class RealtimeSyncEngine {
  private wsConnections: Map<string, WebSocket>;
  private workspaceSubscriptions: Map<string, Set<string>>; // workspace -> user_ids
  
  async broadcastCardUpdate(workspaceId: string, update: CardUpdate, excludeUserId?: string): Promise<void> {
    const subscribers = this.workspaceSubscriptions.get(workspaceId) || new Set();
    
    const message = {
      type: 'card_updated',
      workspace_id: workspaceId,
      update,
      timestamp: Date.now()
    };
    
    // Batch send for performance
    const sendPromises = Array.from(subscribers)
      .filter(userId => userId !== excludeUserId)
      .map(async (userId) => {
        const ws = this.wsConnections.get(userId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify(message));
          } catch (error) {
            console.warn(`Failed to send to user ${userId}:`, error);
            this.handleDisconnection(userId);
          }
        }
      });
    
    await Promise.allSettled(sendPromises);
  }
  
  // Optimistic conflict resolution
  async handleConflictingUpdate(workspaceId: string, cardId: string, updates: CardUpdate[]): Promise<CardUpdate> {
    // Sort updates by timestamp
    const sortedUpdates = updates.sort((a, b) => a.timestamp - b.timestamp);
    
    // Apply updates sequentially using CRDT
    let currentCard = await this.getCard(cardId);
    
    for (const update of sortedUpdates) {
      const updatedCard = currentCard.applyUpdate(update);
      currentCard = currentCard.merge(updatedCard);
    }
    
    // Broadcast resolved state
    await this.broadcastCardUpdate(workspaceId, {
      card_id: cardId,
      type: 'conflict_resolved',
      resolved_state: currentCard.state,
      timestamp: Date.now()
    });
    
    return currentCard.getLastUpdate();
  }
}
```

### API Performance Optimization

#### Response Caching & Compression
```typescript
class APIPerformanceMiddleware {
  static cache = (ttl: number = 300) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const cacheKey = `api:${req.method}:${req.path}:${JSON.stringify(req.query)}`;
      
      // Check cache first
      const cachedResponse = await redis.get(cacheKey);
      if (cachedResponse) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json');
        return res.send(cachedResponse);
      }
      
      // Override res.json to cache response
      const originalJson = res.json;
      res.json = function(data: any) {
        // Cache successful responses only
        if (res.statusCode < 400) {
          redis.setex(cacheKey, ttl, JSON.stringify(data));
        }
        res.setHeader('X-Cache', 'MISS');
        return originalJson.call(this, data);
      };
      
      next();
    };
  };
  
  static compress = () => {
    return compression({
      threshold: 1024, // Only compress responses > 1KB
      level: 6,        // Balance between speed and compression
      filter: (req, res) => {
        // Don't compress images or already compressed content
        if (res.getHeader('Content-Type')?.includes('image/')) return false;
        return compression.filter(req, res);
      }
    });
  };
  
  static responseTime = () => {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        res.setHeader('X-Response-Time', `${duration}ms`);
        
        // Log slow requests
        if (duration > 1000) {
          console.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
        }
        
        // Metrics collection
        this.recordAPIMetrics(req.path, req.method, duration, res.statusCode);
      });
      
      next();
    };
  };
}
```

### Frontend Performance Optimization

#### React Performance Patterns
```typescript
// Optimized card component with React.memo and careful re-renders
const Card = React.memo(({ card, onUpdate, isSelected, connections }: CardProps) => {
  // Stable callbacks to prevent unnecessary re-renders
  const handleUpdate = useCallback((updates: Partial<Card>) => {
    onUpdate(card.id, updates);
  }, [card.id, onUpdate]);
  
  // Memoize expensive calculations
  const cardStyles = useMemo(() => ({
    transform: `translate(${card.position.x}px, ${card.position.y}px)`,
    width: `${card.position.width}px`,
    height: `${card.position.height}px`,
    zIndex: card.position.z_index,
    backgroundColor: card.style.background_color
  }), [card.position, card.style.background_color]);
  
  // Virtual scrolling for long content
  const contentLines = useMemo(() => {
    if (card.content.length > 1000) {
      return card.content.split('\n').slice(0, 20); // Show only first 20 lines
    }
    return card.content.split('\n');
  }, [card.content]);
  
  return (
    <div 
      className={`card ${isSelected ? 'selected' : ''}`}
      style={cardStyles}
      data-card-id={card.id}
    >
      <CardHeader title={card.title} onTitleChange={handleUpdate} />
      <CardContent lines={contentLines} />
      <CardConnections connections={connections} />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.card.id === nextProps.card.id &&
    prevProps.card.updated_at === nextProps.card.updated_at &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.connections.length === nextProps.connections.length
  );
});

// Canvas viewport management with intersection observer
class CanvasViewportManager {
  private observer: IntersectionObserver;
  private visibleCards: Set<string> = new Set();
  
  constructor(private onVisibilityChange: (cardId: string, isVisible: boolean) => void) {
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        root: null, // viewport
        rootMargin: '100px', // Load cards 100px before they become visible
        threshold: 0
      }
    );
  }
  
  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      const cardId = entry.target.getAttribute('data-card-id');
      if (!cardId) return;
      
      if (entry.isIntersecting) {
        if (!this.visibleCards.has(cardId)) {
          this.visibleCards.add(cardId);
          this.onVisibilityChange(cardId, true);
        }
      } else {
        if (this.visibleCards.has(cardId)) {
          this.visibleCards.delete(cardId);
          this.onVisibilityChange(cardId, false);
        }
      }
    });
  }
  
  observeCard(cardElement: HTMLElement) {
    this.observer.observe(cardElement);
  }
  
  unobserveCard(cardElement: HTMLElement) {
    this.observer.unobserve(cardElement);
  }
}
```

---

## 8. Infrastructure & Deployment Architecture

### AWS Infrastructure Design

#### Production Environment Architecture
```yaml
# Infrastructure as Code (CDK/CloudFormation)
Resources:
  # Application Load Balancer
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Scheme: internet-facing
      Type: application
      Subnets: 
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref ALBSecurityGroup
      
  # ECS Fargate for API services
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: nexus-production
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT
      
  # Core API Service
  CoreAPIService:
    Type: AWS::ECS::Service
    Properties:
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref CoreAPITaskDefinition
      LaunchType: FARGATE
      DesiredCount: 3
      LoadBalancers:
        - ContainerName: core-api
          ContainerPort: 3000
          TargetGroupArn: !Ref CoreAPITargetGroup
      NetworkConfiguration:
        AwsvpcConfiguration:
          SecurityGroups:
            - !Ref APISecurityGroup
          Subnets:
            - !Ref PrivateSubnet1
            - !Ref PrivateSubnet2
            
  # AI Service (separate scaling)
  AIService:
    Type: AWS::ECS::Service
    Properties:
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref AITaskDefinition
      LaunchType: FARGATE
      DesiredCount: 2
      NetworkConfiguration:
        AwsvpcConfiguration:
          SecurityGroups:
            - !Ref AISecurityGroup
          Subnets:
            - !Ref PrivateSubnet1
            - !Ref PrivateSubnet2
            
  # RDS PostgreSQL
  Database:
    Type: AWS::RDS::DBCluster
    Properties:
      Engine: aurora-postgresql
      EngineVersion: '15.4'
      DatabaseName: nexus
      MasterUsername: nexus_admin
      MasterUserPassword: !Ref DatabasePassword
      DBSubnetGroupName: !Ref DBSubnetGroup
      VpcSecurityGroupIds:
        - !Ref DatabaseSecurityGroup
      BackupRetentionPeriod: 7
      PreferredBackupWindow: "03:00-04:00"
      PreferredMaintenanceWindow: "sun:04:00-sun:05:00"
      StorageEncrypted: true
      
  # ElastiCache Redis
  RedisCluster:
    Type: AWS::ElastiCache::ReplicationGroup
    Properties:
      ReplicationGroupDescription: "Nexus Redis Cluster"
      NumCacheClusters: 3
      Engine: redis
      CacheNodeType: cache.r7g.large
      Port: 6379
      ParameterGroupName: default.redis7
      SubnetGroupName: !Ref RedisSubnetGroup
      SecurityGroupIds:
        - !Ref RedisSecurityGroup
      AtRestEncryptionEnabled: true
      TransitEncryptionEnabled: true
```

#### Auto-scaling Configuration
```typescript
class AutoScalingManager {
  private readonly SCALING_POLICIES = {
    coreAPI: {
      min: 2,
      max: 20,
      target: {
        cpu: 70,        // Scale up when CPU > 70%
        memory: 80,     // Scale up when Memory > 80%
        requestCount: 1000, // Requests per minute per instance
      },
      scaleUp: {
        cooldown: 300,  // 5 minutes
        increment: 2    // Add 2 instances
      },
      scaleDown: {
        cooldown: 600,  // 10 minutes
        decrement: 1    // Remove 1 instance
      }
    },
    aiService: {
      min: 1,
      max: 10,
      target: {
        cpu: 60,        // AI workloads are CPU intensive
        queueLength: 50 // Scale based on AI request queue
      }
    }
  };
  
  async setupAutoScaling(): Promise<void> {
    // CloudWatch metrics for custom scaling
    await this.createCustomMetrics();
    
    // Application Auto Scaling for ECS
    await this.configureECSAutoScaling();
    
    // Lambda-based custom scaling logic
    await this.deployCustomScalingFunction();
  }
  
  private async createCustomMetrics(): Promise<void> {
    const metrics = [
      {
        MetricName: 'ActiveWebSocketConnections',
        Namespace: 'Nexus/RealTime',
        Dimensions: [{ Name: 'Environment', Value: 'production' }]
      },
      {
        MetricName: 'AIRequestQueueLength',
        Namespace: 'Nexus/AI',
        Dimensions: [{ Name: 'ServiceType', Value: 'embedding' }]
      },
      {
        MetricName: 'CanvasRenderingLatency',
        Namespace: 'Nexus/Frontend',
        Dimensions: [{ Name: 'PerformanceMetric', Value: 'p95' }]
      }
    ];
    
    // Send metrics from application
    setInterval(async () => {
      await this.publishMetrics(metrics);
    }, 60000); // Every minute
  }
}
```

### CI/CD Pipeline

#### GitHub Actions Workflow
```yaml
# .github/workflows/production-deploy.yml
name: Production Deployment

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY_API: nexus-core-api
  ECR_REPOSITORY_AI: nexus-ai-service

jobs:
  test:
    runs-on: ubuntu-latest
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
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: |
          npm run test:unit
          npm run test:integration
          npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/nexus_test
          REDIS_URL: redis://localhost:6379
          
      - name: Run security scan
        run: |
          npm audit --audit-level high
          npx snyk test
          
      - name: Check code quality
        run: |
          npm run lint
          npm run type-check
          npm run build

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
          
      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v2
        
      - name: Build and push Core API image
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG -f Dockerfile.api .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
          
      - name: Build and push AI Service image
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_AI:$IMAGE_TAG -f Dockerfile.ai .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_AI:$IMAGE_TAG
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
          
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster nexus-production \
            --service core-api-service \
            --force-new-deployment
            
          aws ecs update-service \
            --cluster nexus-production \
            --service ai-service \
            --force-new-deployment
            
      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster nexus-production \
            --services core-api-service ai-service
            
      - name: Run health checks
        run: |
          curl -f https://api.nexus-app.com/health || exit 1
          curl -f https://ai.nexus-app.com/health || exit 1
          
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: "Production deployment completed: ${{ github.sha }}"
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

#### Database Migration Strategy
```typescript
class DatabaseMigrationManager {
  async runMigrations(): Promise<void> {
    // Blue-green deployment for zero-downtime migrations
    const migrations = await this.getPendingMigrations();
    
    for (const migration of migrations) {
      try {
        console.log(`Running migration: ${migration.name}`);
        
        // Start transaction
        await this.db.query('BEGIN');
        
        // Apply migration
        await this.db.query(migration.up);
        
        // Record migration
        await this.db.query(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)',
          [migration.version, migration.name, new Date()]
        );
        
        // Commit transaction
        await this.db.query('COMMIT');
        
        console.log(`Migration ${migration.name} completed successfully`);
        
      } catch (error) {
        // Rollback on error
        await this.db.query('ROLLBACK');
        
        console.error(`Migration ${migration.name} failed:`, error);
        
        // Attempt rollback
        if (migration.down) {
          try {
            await this.db.query(migration.down);
            console.log(`Rollback for ${migration.name} completed`);
          } catch (rollbackError) {
            console.error(`Rollback failed for ${migration.name}:`, rollbackError);
          }
        }
        
        throw error;
      }
    }
  }
  
  // Zero-downtime migration strategy
  async performSchemaChanges(): Promise<void> {
    // Phase 1: Add new columns/tables (non-breaking)
    await this.addNewSchema();
    
    // Phase 2: Deploy application with dual writes
    await this.deployDualWriteVersion();
    
    // Phase 3: Migrate data in background
    await this.migrateExistingData();
    
    // Phase 4: Switch reads to new schema
    await this.switchReadsToNewSchema();
    
    // Phase 5: Remove old columns/tables
    await this.cleanupOldSchema();
  }
}
```

### Monitoring & Observability

#### Comprehensive Monitoring Stack
```typescript
class MonitoringStack {
  async setupMonitoring(): Promise<void> {
    // CloudWatch dashboards
    await this.createCloudWatchDashboards();
    
    // Application metrics (Prometheus + Grafana)
    await this.setupApplicationMetrics();
    
    // Error tracking (Sentry)
    await this.configureSentry();
    
    // APM (DataDog)
    await this.setupAPM();
    
    // Real user monitoring
    await this.configureRUM();
  }
  
  private async createCloudWatchDashboards(): Promise<void> {
    const dashboardConfig = {
      widgets: [
        {
          type: "metric",
          properties: {
            metrics: [
              ["AWS/ECS", "CPUUtilization", "ServiceName", "core-api-service"],
              ["AWS/ECS", "MemoryUtilization", "ServiceName", "core-api-service"],
              ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "nexus-alb"],
              ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "nexus-alb"]
            ],
            period: 300,
            stat: "Average",
            region: "us-east-1",
            title: "Core API Metrics"
          }
        },
        {
          type: "log",
          properties: {
            query: `
              fields @timestamp, @message
              | filter @message like /ERROR/
              | sort @timestamp desc
              | limit 20
            `,
            region: "us-east-1",
            title: "Recent Errors"
          }
        }
      ]
    };
    
    await this.cloudWatch.putDashboard({
      DashboardName: 'NexusProduction',
      DashboardBody: JSON.stringify(dashboardConfig)
    });
  }
  
  // Custom application metrics
  private instrumentApplication(): void {
    const promClient = require('prom-client');
    
    // Business metrics
    const cardCreations = new promClient.Counter({
      name: 'nexus_cards_created_total',
      help: 'Total number of cards created',
      labelNames: ['workspace_id', 'user_tier']
    });
    
    const aiConnections = new promClient.Counter({
      name: 'nexus_ai_connections_suggested_total',
      help: 'Total AI connections suggested',
      labelNames: ['workspace_id', 'accepted']
    });
    
    const canvasPerformance = new promClient.Histogram({
      name: 'nexus_canvas_render_duration_seconds',
      help: 'Canvas rendering duration',
      labelNames: ['card_count_range'],
      buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    });
    
    // API performance
    const httpDuration = new promClient.Histogram({
      name: 'nexus_http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    });
  }
}
```

#### Health Check System
```typescript
class HealthCheckService {
  async performHealthChecks(): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkAIServices(),
      this.checkExternalAPIs(),
      this.checkFileStorage(),
      this.checkWebSocketConnections()
    ]);
    
    const results = checks.map((check, index) => ({
      name: this.getCheckName(index),
      status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      error: check.status === 'rejected' ? check.reason : null,
      timestamp: new Date()
    }));
    
    const overallStatus = results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded';
    
    return {
      status: overallStatus,
      checks: results,
      timestamp: new Date(),
      version: process.env.APP_VERSION || 'unknown'
    };
  }
  
  private async checkDatabase(): Promise<void> {
    const start = Date.now();
    await this.db.query('SELECT 1');
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      throw new Error(`Database response too slow: ${duration}ms`);
    }
  }
  
  private async checkAIServices(): Promise<void> {
    // Test embedding generation
    const testText = "This is a test for health check";
    const response = await fetch(`${process.env.AI_SERVICE_URL}/health`, {
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`AI service unhealthy: ${response.status}`);
    }
  }
  
  // Expose health endpoint
  setupHealthEndpoint(app: Express): void {
    app.get('/health', async (req, res) => {
      try {
        const health = await this.performHealthChecks();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date()
        });
      }
    });
  }
}
```

### Disaster Recovery & Backup Strategy

#### Backup Strategy
```typescript
class BackupManager {
  private readonly BACKUP_SCHEDULE = {
    database: {
      full: 'daily at 2 AM UTC',
      incremental: 'every 6 hours',
      retention: '30 days'
    },
    files: {
      full: 'daily at 3 AM UTC',
      retention: '90 days'
    },
    redis: {
      snapshot: 'every 12 hours',
      retention: '7 days'
    }
  };
  
  async performDatabaseBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `nexus-db-backup-${timestamp}`;
    
    try {
      // Create RDS snapshot
      await this.rds.createDBSnapshot({
        DBInstanceIdentifier: process.env.DB_INSTANCE_ID,
        DBSnapshotIdentifier: backupName
      });
      
      // Export to S3 for long-term storage
      await this.rds.startExportTask({
        ExportTaskIdentifier: `${backupName}-export`,
        SourceArn: this.getSnapshotArn(backupName),
        S3BucketName: process.env.BACKUP_BUCKET,
        S3Prefix: `database-backups/${timestamp}/`,
        IamRoleArn: process.env.BACKUP_ROLE_ARN,
        KmsKeyId: process.env.BACKUP_KMS_KEY
      });
      
      console.log(`Database backup initiated: ${backupName}`);
      
    } catch (error) {
      console.error('Database backup failed:', error);
      await this.sendBackupAlert('Database backup failed', error);
      throw error;
    }
  }
  
  async performFileBackup(): Promise<void> {
    // Sync user files to backup bucket
    await this.s3.sync({
      source: process.env.FILES_BUCKET,
      destination: process.env.BACKUP_BUCKET,
      options: {
        storageClass: 'GLACIER',
        encryption: 'AES256'
      }
    });
  }
  
  // Point-in-time recovery capability
  async restoreFromBackup(backupId: string, targetTime?: Date): Promise<void> {
    const restoreInstanceId = `nexus-restore-${Date.now()}`;
    
    if (targetTime) {
      // Point-in-time recovery
      await this.rds.restoreDBInstanceToPointInTime({
        SourceDBInstanceIdentifier: process.env.DB_INSTANCE_ID,
        TargetDBInstanceIdentifier: restoreInstanceId,
        RestoreTime: targetTime
      });
    } else {
      // Restore from snapshot
      await this.rds.restoreDBInstanceFromDBSnapshot({
        DBInstanceIdentifier: restoreInstanceId,
        DBSnapshotIdentifier: backupId
      });
    }
    
    console.log(`Database restore initiated: ${restoreInstanceId}`);
  }
}
```

---

## 9. Implementation Roadmap

### Phase 1: MVP Foundation (Months 1-3)

#### Sprint 1-2: Core Infrastructure
- **Week 1-2**: Project setup, CI/CD pipeline, AWS infrastructure
- **Week 3-4**: Database schema, authentication system, basic API endpoints

#### Sprint 3-4: Card System
- **Week 5-6**: Card CRUD operations, markdown editor integration
- **Week 7-8**: Canvas implementation, drag-and-drop functionality

#### Sprint 5-6: Mobile & Sync
- **Week 9-10**: Flutter mobile app, quick capture functionality
- **Week 11-12**: Real-time sync, offline capabilities, testing

### Phase 2: AI Integration (Months 4-6)

#### Sprint 7-8: AI Foundation
- **Week 13-14**: LLM service setup, embedding generation pipeline
- **Week 15-16**: Basic connection discovery, semantic search

#### Sprint 9-10: Intelligence Features
- **Week 17-18**: Connection suggestions UI, relevance scoring
- **Week 19-20**: Natural language search, AI explanations

#### Sprint 11-12: Collaboration
- **Week 21-22**: Multi-user workspaces, real-time collaboration
- **Week 23-24**: Shared workspaces, permission system

### Phase 3: Scale & Polish (Months 7-12)

#### Enterprise Features
- Advanced security (SSO, audit logs)
- Team management and admin dashboard
- API for third-party integrations
- Advanced analytics and insights

---

## Conclusion

This technical architecture provides a solid foundation for building Nexus as a high-performance, AI-powered workspace. The design prioritizes:

1. **Performance**: Canvas optimization for 60 FPS with 1000+ cards
2. **Scalability**: Microservices architecture with auto-scaling
3. **Reliability**: CRDT for conflict resolution, comprehensive monitoring
4. **Security**: End-to-end encryption, GDPR compliance, audit logging
5. **User Experience**: Sub-200ms API responses, offline capabilities

### Critical Success Factors

1. **Canvas Performance**: WebGL acceleration and virtualization are essential
2. **AI Cost Management**: Careful token usage monitoring and optimization
3. **Real-time Sync**: CRDT implementation for seamless collaboration
4. **Mobile Experience**: Flutter provides native performance across platforms
5. **Data Security**: Encryption and compliance must be built-in from day one

The architecture supports rapid development and iteration while maintaining production-ready standards for security, performance, and scalability.

**Next Steps**: Proceed with technical spike implementation to validate canvas performance and AI integration costs before full development begins.