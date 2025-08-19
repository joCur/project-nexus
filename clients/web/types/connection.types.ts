/**
 * Connection Store Type Definitions
 * 
 * Types and interfaces for connections between cards and connection management.
 */

import type { Position, Color, EntityId, Timestamp, Metadata } from './common.types';

/**
 * Connection types
 */
export type ConnectionType = 'manual' | 'ai-suggested' | 'related' | 'sequential';

/**
 * Connection style properties
 */
export interface ConnectionStyle {
  color: Color;
  width: number;
  dashPattern?: number[];
  opacity: number;
  animated: boolean;
}

/**
 * Individual connection entity
 */
export interface Connection {
  id: EntityId;
  sourceId: EntityId;
  targetId: EntityId;
  type: ConnectionType;
  style: ConnectionStyle;
  label?: string;
  description?: string;
  strength: number; // 0-1, for AI connections
  isSelected: boolean;
  isVisible: boolean;
  createdAt: Timestamp;
  metadata: Metadata;
}

/**
 * Connection rendering state
 */
export interface ConnectionRenderState {
  hoveredId?: EntityId;
  isCreating: boolean;
  createSource?: EntityId;
  createTarget?: Position;
  previewConnection?: Partial<Connection>;
}

/**
 * Connection filter settings
 */
export interface ConnectionFilters {
  showManual: boolean;
  showAISuggested: boolean;
  showRelated: boolean;
  showSequential: boolean;
  minStrength: number;
}

/**
 * Connection store state interface
 */
export interface ConnectionState {
  connections: Map<EntityId, Connection>;
  renderState: ConnectionRenderState;
  selectedIds: Set<EntityId>;
  filters: ConnectionFilters;
}

/**
 * Connection store actions interface
 */
export interface ConnectionActions {
  // CRUD operations
  createConnection: (sourceId: EntityId, targetId: EntityId, type: ConnectionType) => EntityId;
  updateConnection: (id: EntityId, updates: Partial<Connection>) => void;
  deleteConnection: (id: EntityId) => void;
  deleteConnections: (ids: EntityId[]) => void;
  
  // Selection management
  selectConnection: (id: EntityId, addToSelection?: boolean) => void;
  clearSelection: () => void;
  
  // Interactive creation
  startCreatingConnection: (sourceId: EntityId) => void;
  updateConnectionPreview: (targetPosition: Position) => void;
  finishCreatingConnection: (targetId: EntityId) => EntityId | null;
  cancelCreatingConnection: () => void;
  
  // Connection queries
  getConnection: (id: EntityId) => Connection | undefined;
  getConnections: () => Connection[];
  getConnectionsForCard: (cardId: EntityId) => Connection[];
  getSelectedConnections: () => Connection[];
  
  // Filtering and visibility
  updateFilters: (filters: Partial<ConnectionFilters>) => void;
  toggleConnectionType: (type: ConnectionType) => void;
  
  // Style management
  updateConnectionStyle: (id: EntityId, style: Partial<ConnectionStyle>) => void;
  
  // Utility
  areCardsConnected: (sourceId: EntityId, targetId: EntityId) => boolean;
  findShortestPath: (sourceId: EntityId, targetId: EntityId) => EntityId[];
}

/**
 * Combined connection store type
 */
export interface ConnectionStore extends ConnectionState, ConnectionActions {}