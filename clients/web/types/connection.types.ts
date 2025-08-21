/**
 * Connection Type Definitions
 * 
 * Types and interfaces for connection entities, visualization, and management
 * including manual connections and AI-generated suggestions.
 */

import type { Color, EntityId, Timestamp } from './common.types';
import type { CanvasPosition } from './canvas.types';

// ============================================================================
// CORE CONNECTION TYPES
// ============================================================================

/**
 * Connection ID branded type
 */
export type ConnectionId = EntityId;

/**
 * Connection types supported by the system
 */
export enum ConnectionType {
  MANUAL = 'manual',
  AI_SUGGESTED = 'ai_suggested',
  AI_GENERATED = 'ai_generated',
  REFERENCE = 'reference',
  DEPENDENCY = 'dependency',
  SIMILARITY = 'similarity',
  RELATED = 'related',
}

/**
 * AI confidence level for connections (0.0 to 1.0)
 */
export type ConnectionConfidence = number;

/**
 * Connection visual styling
 */
export interface ConnectionStyle {
  color: Color;
  width: number;
  opacity: number;
  dashArray?: string;
  curve: 'straight' | 'curved' | 'stepped';
  showArrow: boolean;
  showLabel: boolean;
}

/**
 * Connection label configuration
 */
export interface ConnectionLabel {
  text: string;
  position: 'start' | 'middle' | 'end';
  backgroundColor?: Color;
  textColor?: Color;
  fontSize: number;
}

/**
 * Core connection entity
 */
export interface Connection {
  id: ConnectionId;
  sourceCardId: EntityId;
  targetCardId: EntityId;
  type: ConnectionType;
  confidence: ConnectionConfidence;
  style: ConnectionStyle;
  label?: ConnectionLabel;
  metadata: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: EntityId;
  isVisible: boolean;
}

// ============================================================================
// AI CONNECTION TYPES
// ============================================================================

/**
 * AI analysis results for connections
 */
export interface AIConnectionAnalysis {
  strength: number;
  reasoning: string;
  keywords: string[];
  concepts: string[];
  confidence: ConnectionConfidence;
  suggestedType: ConnectionType;
}

/**
 * AI connection suggestion
 */
export interface ConnectionSuggestion {
  id: string;
  sourceCardId: EntityId;
  targetCardId: EntityId;
  analysis: AIConnectionAnalysis;
  isAccepted: boolean;
  isRejected: boolean;
  createdAt: Timestamp;
}

// ============================================================================
// CONNECTION VISUALIZATION
// ============================================================================

/**
 * Connection path calculation
 */
export interface ConnectionPath {
  startPoint: CanvasPosition;
  endPoint: CanvasPosition;
  controlPoints: CanvasPosition[];
  pathData: string; // SVG path data
  length: number;
}

/**
 * Connection rendering state
 */
export interface ConnectionRenderState {
  path: ConnectionPath;
  style: ConnectionStyle;
  isHovered: boolean;
  isSelected: boolean;
  isAnimated: boolean;
  animationProgress: number;
}

/**
 * Connection interaction state
 */
export interface ConnectionInteraction {
  isCreating: boolean;
  sourceCardId?: EntityId;
  currentPosition?: CanvasPosition;
  hoveredConnectionId?: ConnectionId;
  selectedConnectionIds: Set<ConnectionId>;
}

// ============================================================================
// CONNECTION STORE TYPES
// ============================================================================

/**
 * Connection store state
 */
export interface ConnectionState {
  connections: Map<ConnectionId, Connection>;
  suggestions: ConnectionSuggestion[];
  interaction: ConnectionInteraction;
  filters: {
    types: Set<ConnectionType>;
    minConfidence: ConnectionConfidence;
    showAI: boolean;
    showManual: boolean;
  };
}

/**
 * Connection store actions
 */
export interface ConnectionActions {
  // CRUD operations
  createConnection: (
    sourceCardId: EntityId, 
    targetCardId: EntityId, 
    type: ConnectionType,
    metadata?: Record<string, any>
  ) => ConnectionId;
  
  updateConnection: (id: ConnectionId, updates: Partial<Connection>) => void;
  deleteConnection: (id: ConnectionId) => void;
  deleteConnections: (ids: ConnectionId[]) => void;
  
  // Suggestion management
  acceptSuggestion: (suggestionId: string) => ConnectionId;
  rejectSuggestion: (suggestionId: string) => void;
  clearSuggestions: () => void;
  
  // Interaction management
  startConnectionCreation: (sourceCardId: EntityId, position: CanvasPosition) => void;
  updateConnectionCreation: (position: CanvasPosition) => void;
  endConnectionCreation: (targetCardId?: EntityId) => ConnectionId | null;
  
  // Selection management
  selectConnection: (id: ConnectionId) => void;
  selectMultiple: (ids: ConnectionId[]) => void;
  clearSelection: () => void;
  
  // Filtering and visibility
  setTypeFilter: (types: Set<ConnectionType>) => void;
  setConfidenceFilter: (minConfidence: ConnectionConfidence) => void;
  toggleConnectionVisibility: (id: ConnectionId) => void;
  
  // Utility methods
  getConnection: (id: ConnectionId) => Connection | undefined;
  getConnections: (cardId?: EntityId) => Connection[];
  getConnectionsByType: (type: ConnectionType) => Connection[];
}

/**
 * Combined connection store interface
 */
export interface ConnectionStore extends ConnectionState, ConnectionActions {}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a new connection ID
 */
export const createConnectionId = (): ConnectionId => 
  `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as EntityId;

/**
 * Check if connection is AI-generated
 */
export const isAIConnection = (connection: Connection): boolean =>
  connection.type === ConnectionType.AI_SUGGESTED || 
  connection.type === ConnectionType.AI_GENERATED;

/**
 * Get connection type display color
 */
export const getConnectionTypeColor = (type: ConnectionType): Color => {
  const colors: Record<ConnectionType, Color> = {
    [ConnectionType.MANUAL]: '#3B82F6',
    [ConnectionType.AI_SUGGESTED]: '#10B981',
    [ConnectionType.AI_GENERATED]: '#8B5CF6',
    [ConnectionType.REFERENCE]: '#F59E0B',
    [ConnectionType.DEPENDENCY]: '#EF4444',
    [ConnectionType.SIMILARITY]: '#06B6D4',
    [ConnectionType.RELATED]: '#6B7280',
  };
  return colors[type] || '#6B7280';
};

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default connection style
 */
export const DEFAULT_CONNECTION_STYLE: ConnectionStyle = {
  color: '#6B7280',
  width: 2,
  opacity: 0.8,
  curve: 'curved',
  showArrow: true,
  showLabel: false,
};

/**
 * Default connection filters
 */
export const DEFAULT_CONNECTION_FILTERS = {
  types: new Set(Object.values(ConnectionType)),
  minConfidence: 0.0,
  showAI: true,
  showManual: true,
};