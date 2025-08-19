/**
 * Card-related type definitions for the infinite canvas system
 * Based on Project Nexus technical architecture specifications
 */

// Core card enums
export enum CardType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  LINK = 'LINK',
  CODE = 'CODE',
  FILE = 'FILE',
  DRAWING = 'DRAWING',
}

export enum CardStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum ConnectionType {
  RELATED = 'RELATED',
  REFERENCE = 'REFERENCE',
  DEPENDENCY = 'DEPENDENCY',
  SIMILARITY = 'SIMILARITY',
}

export enum SentimentType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
}

export enum ConflictStrategy {
  CLIENT_WINS = 'CLIENT_WINS',
  SERVER_WINS = 'SERVER_WINS',
  MERGE = 'MERGE',
  MANUAL = 'MANUAL',
}

export interface CardPosition {
  x: number;
  y: number;
  z: number; // z-index for layering
}

export interface CardDimensions {
  width: number;
  height: number;
}

export interface CardMetadata {
  [key: string]: any;
}

// Main Card interface
export interface Card {
  id: string;
  workspaceId: string;
  type: CardType;
  title?: string;
  content: string;
  position: CardPosition;
  dimensions: CardDimensions;
  metadata: CardMetadata;
  status: CardStatus;
  version: number; // For optimistic locking
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID
  lastModifiedBy: string; // User ID
  tags: string[];
  
  // Auto-save tracking
  lastSavedAt?: Date;
  isDirty: boolean; // Has unsaved changes
  
  // AI and analysis
  embeddings?: number[]; // Vector embeddings for AI search
  analysisResults?: CardAnalysisResult;
}

// Input types for card operations
export interface CreateCardInput {
  workspaceId: string;
  type: CardType;
  title?: string;
  content: string;
  position: CardPosition;
  dimensions: CardDimensions;
  metadata?: CardMetadata;
  tags?: string[];
}

export interface UpdateCardInput {
  title?: string;
  content?: string;
  position?: CardPosition;
  dimensions?: CardDimensions;
  metadata?: CardMetadata;
  tags?: string[];
  status?: CardStatus;
}

// Batch operation types
export interface CardPositionUpdate {
  cardId: string;
  position: CardPosition;
  version: number; // For optimistic locking
}

export interface BatchCardUpdate {
  cardId: string;
  updates: UpdateCardInput;
  version: number;
}

export interface ImportCardData {
  type: CardType;
  title?: string;
  content: string;
  position: CardPosition;
  dimensions: CardDimensions;
  metadata?: CardMetadata;
  tags?: string[];
}

// Filter and query types
export interface CardFilter {
  type?: CardType | CardType[];
  status?: CardStatus | CardStatus[];
  tags?: string[];
  createdBy?: string;
  lastModifiedBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  searchTerm?: string;
  boundingBox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

// Auto-save types
export interface AutoSaveConfig {
  enabled: boolean;
  debounceMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface SaveOperation {
  cardId: string;
  updates: UpdateCardInput;
  timestamp: Date;
  retryCount: number;
  userId: string;
}

// Conflict resolution for concurrent editing
export interface ConflictResolution {
  strategy: ConflictStrategy;
  clientVersion: number;
  serverVersion: number;
  conflictedFields: string[];
}

export interface CardConflict {
  cardId: string;
  clientData: UpdateCardInput;
  serverData: Card;
  resolution?: ConflictResolution;
}

// AI and analysis types
export interface CardAnalysisResult {
  extractedEntities: string[];
  suggestedTags: string[];
  contentSummary?: string;
  languageDetected?: string;
  sentiment?: SentimentType;
  topics: string[];
  lastAnalyzed: Date;
}

// Connection types (for future use)
export interface CardConnection {
  id: string;
  fromCardId: string;
  toCardId: string;
  type: ConnectionType;
  strength: number; // 0-1 confidence score
  metadata?: Record<string, any>;
  createdAt: Date;
  createdBy: string; // User ID or 'AI' for auto-generated
}

// Validation constraints
export const CardConstraints = {
  TITLE_MAX_LENGTH: 200,
  CONTENT_MAX_LENGTH: 100000, // 100KB
  TAGS_MAX_COUNT: 20,
  TAG_MAX_LENGTH: 50,
  POSITION_MIN: -1000000,
  POSITION_MAX: 1000000,
  DIMENSIONS_MIN_WIDTH: 100,
  DIMENSIONS_MIN_HEIGHT: 50,
  DIMENSIONS_MAX_WIDTH: 5000,
  DIMENSIONS_MAX_HEIGHT: 5000,
  VERSION_MIN: 1,
} as const;

// Database mapping types
export interface DbCard {
  id: string;
  workspace_id: string;
  type: string;
  title?: string;
  content: string;
  position_x: number;
  position_y: number;
  position_z: number;
  width: number;
  height: number;
  metadata: string; // JSON string
  status: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  last_modified_by: string;
  tags: string; // JSON array string
  last_saved_at?: Date;
  is_dirty: boolean;
  
  // pgvector fields
  embedding?: number[];
  embedding_model?: string;
  embedding_created_at?: Date;
  content_hash?: string;
  
  // AI analysis results
  analysis_results?: string; // JSON string
}

// Service error types
export interface CardServiceError extends Error {
  code: 'CARD_NOT_FOUND' | 'WORKSPACE_NOT_FOUND' | 'VERSION_CONFLICT' | 'VALIDATION_ERROR' | 'PERMISSION_DENIED';
  cardId?: string;
  workspaceId?: string;
  version?: number;
}

// Performance and monitoring types
export interface CardMetrics {
  totalCards: number;
  cardsByType: Record<CardType, number>;
  cardsByStatus: Record<CardStatus, number>;
  averageCardSize: number;
  lastUpdateTime: Date;
}

export interface BatchOperationResult<T> {
  successful: T[];
  failed: Array<{
    input: any;
    error: string;
  }>;
  totalProcessed: number;
  processingTimeMs: number;
}