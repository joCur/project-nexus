/**
 * Card-related type definitions for the infinite canvas system
 * Based on Project Nexus technical architecture specifications
 */

// Core card enums - aligned with frontend and database
export enum CardType {
  TEXT = 'text',
  IMAGE = 'image',
  LINK = 'link',
  CODE = 'code',
  FILE = 'file',
  DRAWING = 'drawing',
}

export enum CardStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export enum CardPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ConnectionType {
  MANUAL = 'manual',
  AI_SUGGESTED = 'ai_suggested',
  AI_GENERATED = 'ai_generated',
  REFERENCE = 'reference',
  DEPENDENCY = 'dependency',
  SIMILARITY = 'similarity',
  RELATED = 'related',
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
  z: number; // z-index for layering (maps to z_index in DB)
}

export interface CardDimensions {
  width: number;
  height: number;
}

export interface CardMetadata {
  [key: string]: any;
}

export interface CardStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  borderWidth: number;
  borderRadius: number;
  opacity: number;
  shadow: boolean;
  shadowConfig?: {
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
  };
}

export interface CardAnimation {
  isAnimating: boolean;
  type?: 'move' | 'resize' | 'fade' | 'scale' | 'rotate';
  duration?: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  startTime?: number;
}

// Main Card interface - aligned with database schema
export interface Card {
  id: string;
  workspaceId: string;
  ownerId: string; // User ID who owns the card
  type: CardType;
  title?: string;
  content: string;
  position: CardPosition;
  dimensions: CardDimensions;
  metadata: CardMetadata;
  status: CardStatus;
  priority: CardPriority;
  style: CardStyle;
  version: number; // For optimistic locking
  createdAt: Date;
  updatedAt: Date;
  lastModifiedBy: string; // User ID
  tags: string[];
  
  // Auto-save tracking
  lastSavedAt?: Date;
  isDirty: boolean; // Has unsaved changes
  
  // Canvas-specific properties
  isLocked: boolean;
  isHidden: boolean;
  isMinimized: boolean;
  isSelected: boolean;
  rotation: number; // Degrees
  animation: CardAnimation;
  
  // AI and analysis
  embeddings?: number[]; // Vector embeddings for AI search
  analysisResults?: CardAnalysisResult;
}

// Input types for card operations
export interface CreateCardInput {
  workspaceId: string;
  canvasId?: string; // Optional - if not provided, will use default canvas
  type: CardType;
  title?: string;
  content: string;
  position: CardPosition;
  dimensions: CardDimensions;
  metadata?: CardMetadata;
  tags?: string[];
  priority?: CardPriority;
  style?: Partial<CardStyle>;
}

export interface UpdateCardInput {
  title?: string;
  content?: string;
  position?: CardPosition;
  dimensions?: CardDimensions;
  metadata?: CardMetadata;
  tags?: string[];
  status?: CardStatus;
  priority?: CardPriority;
  style?: Partial<CardStyle>;
  isLocked?: boolean;
  isHidden?: boolean;
  isMinimized?: boolean;
  rotation?: number;
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

// Database mapping types - aligned with new schema
export interface DbCard {
  id: string;
  workspace_id: string;
  type: string;
  title?: string;
  content: string;
  position_x: number;
  position_y: number;
  z_index: number; // Renamed from position_z
  width: number;
  height: number;
  metadata: string; // JSON string
  status: string;
  priority: string;
  style: string; // JSON string
  version: number;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  last_modified_by: string;
  tags: string; // JSON array string
  last_saved_at?: Date;
  is_dirty: boolean;
  
  // Canvas-specific fields
  is_locked: boolean;
  is_hidden: boolean;
  is_minimized: boolean;
  is_selected: boolean;
  rotation: number;
  animation: string; // JSON string
  
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

/**
 * Default card style configuration
 */
export const DEFAULT_CARD_STYLE: CardStyle = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E5E7EB',
  textColor: '#1F2937',
  borderWidth: 1,
  borderRadius: 8,
  opacity: 1,
  shadow: true,
  shadowConfig: {
    color: '#00000015',
    offsetX: 0,
    offsetY: 2,
    blur: 8,
    spread: 0,
  },
};