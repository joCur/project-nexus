/**
 * Connection-related type definitions for the infinite canvas system
 * Aligned with frontend connection types and database schema
 */

import { ConnectionType } from './CardTypes';

// ============================================================================
// CONNECTION INTERFACES
// ============================================================================

export interface Connection {
  id: string;
  sourceCardId: string; // Maps to source_card_id in DB
  targetCardId: string; // Maps to target_card_id in DB
  type: ConnectionType;
  confidence: number; // 0.0 to 1.0
  style: ConnectionStyle;
  label?: ConnectionLabel;
  metadata: Record<string, any>;
  createdBy: string;
  isVisible: boolean;
  aiReasoning?: string; // For AI connections
  keywords?: string[]; // Keywords that triggered connection
  concepts?: string[]; // Concepts linking the cards
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionStyle {
  color: string;
  width: number;
  opacity: number;
  curve: 'straight' | 'curved' | 'stepped';
  showArrow: boolean;
  showLabel: boolean;
  dashArray?: string; // SVG dash pattern
}

export interface ConnectionLabel {
  text: string;
  position: 'start' | 'middle' | 'end';
  backgroundColor?: string;
  textColor?: string;
  fontSize: number;
}

// ============================================================================
// AI CONNECTION TYPES
// ============================================================================

export interface AIConnectionAnalysis {
  strength: number;
  reasoning: string;
  keywords: string[];
  concepts: string[];
  confidence: number;
  suggestedType: ConnectionType;
}

export interface ConnectionSuggestion {
  id: string;
  sourceCardId: string;
  targetCardId: string;
  analysis: AIConnectionAnalysis;
  isAccepted: boolean;
  isRejected: boolean;
  createdAt: Date;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateConnectionInput {
  sourceCardId: string;
  targetCardId: string;
  type: ConnectionType;
  confidence?: number;
  style?: Partial<ConnectionStyle>;
  label?: ConnectionLabel;
  metadata?: Record<string, any>;
  aiReasoning?: string;
  keywords?: string[];
  concepts?: string[];
}

export interface UpdateConnectionInput {
  type?: ConnectionType;
  confidence?: number;
  style?: Partial<ConnectionStyle>;
  label?: ConnectionLabel;
  metadata?: Record<string, any>;
  isVisible?: boolean;
  aiReasoning?: string;
  keywords?: string[];
  concepts?: string[];
}

export interface BatchConnectionUpdate {
  connectionId: string;
  updates: UpdateConnectionInput;
}

// ============================================================================
// QUERY AND FILTER TYPES
// ============================================================================

export interface ConnectionFilter {
  types?: ConnectionType[];
  minConfidence?: number;
  maxConfidence?: number;
  sourceCardIds?: string[];
  targetCardIds?: string[];
  createdBy?: string;
  isVisible?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  hasAIReasoning?: boolean;
  keywords?: string[];
  concepts?: string[];
}

export interface ConnectionQuery {
  cardId?: string; // Get all connections for a specific card
  cardIds?: string[]; // Get connections between specific cards
  filter?: ConnectionFilter;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'confidence' | 'type';
  sortOrder?: 'asc' | 'desc';
  includeBidirectional?: boolean; // Include reverse connections
}

// ============================================================================
// DATABASE MAPPING TYPES
// ============================================================================

export interface DbConnection {
  id: string;
  source_card_id: string;
  target_card_id: string;
  type: string;
  confidence: number;
  style: string; // JSON string
  label?: string; // JSON string
  metadata: string; // JSON string
  created_by: string;
  is_visible: boolean;
  ai_reasoning?: string;
  keywords?: string[]; // PostgreSQL array
  concepts?: string[]; // PostgreSQL array
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// VISUALIZATION TYPES
// ============================================================================

export interface ConnectionPath {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  controlPoints: Array<{ x: number; y: number }>;
  pathData: string; // SVG path data
  length: number;
}

export interface ConnectionRenderState {
  path: ConnectionPath;
  style: ConnectionStyle;
  isHovered: boolean;
  isSelected: boolean;
  isAnimated: boolean;
  animationProgress: number;
}

export interface BidirectionalConnection extends Connection {
  direction: 'forward' | 'reverse';
}

// ============================================================================
// SERVICE ERROR TYPES
// ============================================================================

export interface ConnectionServiceError extends Error {
  code: 
    | 'CONNECTION_NOT_FOUND'
    | 'CARD_NOT_FOUND'
    | 'DUPLICATE_CONNECTION'
    | 'SELF_CONNECTION'
    | 'VALIDATION_ERROR'
    | 'PERMISSION_DENIED'
    | 'INVALID_CONNECTION_TYPE';
  connectionId?: string;
  sourceCardId?: string;
  targetCardId?: string;
}

// ============================================================================
// BATCH OPERATION TYPES
// ============================================================================

export interface BatchConnectionResult<T> {
  successful: T[];
  failed: Array<{
    input: any;
    error: string;
  }>;
  totalProcessed: number;
  processingTimeMs: number;
}

export interface ConnectionMetrics {
  totalConnections: number;
  connectionsByType: Record<ConnectionType, number>;
  averageConfidence: number;
  connectionsWithAI: number;
  visibleConnections: number;
  lastUpdateTime: Date;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface ConnectionPair {
  sourceCardId: string;
  targetCardId: string;
}

export interface ConnectionStrength {
  connectionId: string;
  strength: number;
  factors: Array<{
    type: string;
    value: number;
    weight: number;
  }>;
}

// ============================================================================
// CONSTANTS AND DEFAULTS
// ============================================================================

export const DEFAULT_CONNECTION_STYLE: ConnectionStyle = {
  color: '#6B7280',
  width: 2,
  opacity: 0.8,
  curve: 'curved',
  showArrow: true,
  showLabel: false,
};

export const CONNECTION_TYPE_COLORS: Record<ConnectionType, string> = {
  [ConnectionType.MANUAL]: '#3B82F6',
  [ConnectionType.AI_SUGGESTED]: '#10B981',
  [ConnectionType.AI_GENERATED]: '#8B5CF6',
  [ConnectionType.REFERENCE]: '#F59E0B',
  [ConnectionType.DEPENDENCY]: '#EF4444',
  [ConnectionType.SIMILARITY]: '#06B6D4',
  [ConnectionType.RELATED]: '#6B7280',
};

export const ConnectionConstraints = {
  MIN_CONFIDENCE: 0.0,
  MAX_CONFIDENCE: 1.0,
  DEFAULT_CONFIDENCE: 1.0,
  MIN_LINE_WIDTH: 1,
  MAX_LINE_WIDTH: 10,
  DEFAULT_LINE_WIDTH: 2,
  MAX_LABEL_LENGTH: 100,
  MAX_REASONING_LENGTH: 1000,
  MAX_KEYWORDS_COUNT: 20,
  MAX_CONCEPTS_COUNT: 10,
} as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export const isAIConnection = (connection: Connection): boolean =>
  connection.type === ConnectionType.AI_SUGGESTED || 
  connection.type === ConnectionType.AI_GENERATED;

export const isManualConnection = (connection: Connection): boolean =>
  connection.type === ConnectionType.MANUAL;

export const hasAIAnalysis = (connection: Connection): boolean =>
  !!(connection.aiReasoning || connection.keywords?.length || connection.concepts?.length);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const createConnectionId = (): string =>
  `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const getConnectionTypeColor = (type: ConnectionType): string =>
  CONNECTION_TYPE_COLORS[type] || CONNECTION_TYPE_COLORS[ConnectionType.RELATED];

export const isValidConfidence = (confidence: number): boolean =>
  confidence >= ConnectionConstraints.MIN_CONFIDENCE && 
  confidence <= ConnectionConstraints.MAX_CONFIDENCE;

export const formatConnectionLabel = (connection: Connection): string => {
  if (connection.label?.text) {
    return connection.label.text;
  }
  
  // Generate default label based on type
  switch (connection.type) {
    case ConnectionType.MANUAL:
      return 'Connected';
    case ConnectionType.AI_SUGGESTED:
      return `Suggested (${Math.round(connection.confidence * 100)}%)`;
    case ConnectionType.AI_GENERATED:
      return `AI Generated (${Math.round(connection.confidence * 100)}%)`;
    case ConnectionType.REFERENCE:
      return 'References';
    case ConnectionType.DEPENDENCY:
      return 'Depends on';
    case ConnectionType.SIMILARITY:
      return 'Similar to';
    case ConnectionType.RELATED:
      return 'Related to';
    default:
      return 'Connected';
  }
};