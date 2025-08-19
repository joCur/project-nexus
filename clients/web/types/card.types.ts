/**
 * Card Store Type Definitions
 * 
 * Types and interfaces for card entities and card management operations.
 */

import type { Position, Dimensions, Bounds, Color, EntityId, Timestamp, Metadata } from './common.types';

/**
 * Card types supported by the canvas
 */
export type CardType = 'text' | 'image' | 'link' | 'code';

/**
 * Card content based on type
 */
export interface CardContent {
  text?: {
    content: string;
    markdown: boolean;
  };
  image?: {
    url: string;
    alt: string;
    caption?: string;
  };
  link?: {
    url: string;
    title: string;
    description?: string;
    favicon?: string;
  };
  code?: {
    language: string;
    content: string;
    filename?: string;
  };
}

/**
 * Card styling properties
 */
export interface CardStyle {
  backgroundColor: Color;
  borderColor: Color;
  textColor: Color;
  borderWidth: number;
  borderRadius: number;
  opacity: number;
  shadow: boolean;
}

/**
 * Individual card entity
 */
export interface Card {
  id: EntityId;
  type: CardType;
  content: CardContent;
  position: Position;
  dimensions: Dimensions;
  style: CardStyle;
  zIndex: number;
  isSelected: boolean;
  isLocked: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  tags: string[];
  metadata: Metadata;
}

/**
 * Card selection state
 */
export interface CardSelection {
  selectedIds: Set<EntityId>;
  lastSelected?: EntityId;
  selectionBounds?: Bounds;
}

/**
 * Card drag state
 */
export interface CardDragState {
  isDragging: boolean;
  draggedIds: EntityId[];
  startPosition: Position;
  currentOffset: Position;
}

/**
 * Card history for undo/redo
 */
export interface CardHistory {
  past: Array<Map<EntityId, Card>>;
  present: Map<EntityId, Card>;
  future: Array<Map<EntityId, Card>>;
}

/**
 * Card store state interface
 */
export interface CardState {
  cards: Map<EntityId, Card>;
  selection: CardSelection;
  dragState: CardDragState;
  clipboard: Card[];
  history: CardHistory;
}

/**
 * Card store actions interface
 */
export interface CardActions {
  // CRUD operations
  createCard: (type: CardType, position: Position, content?: Partial<CardContent>) => EntityId;
  updateCard: (id: EntityId, updates: Partial<Card>) => void;
  deleteCard: (id: EntityId) => void;
  deleteCards: (ids: EntityId[]) => void;
  duplicateCard: (id: EntityId, offset?: Position) => EntityId;
  
  // Selection management
  selectCard: (id: EntityId, addToSelection?: boolean) => void;
  selectCards: (ids: EntityId[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isCardSelected: (id: EntityId) => boolean;
  
  // Card manipulation
  moveCard: (id: EntityId, position: Position) => void;
  moveCards: (ids: EntityId[], offset: Position) => void;
  resizeCard: (id: EntityId, dimensions: Dimensions) => void;
  updateCardStyle: (id: EntityId, style: Partial<CardStyle>) => void;
  bringToFront: (id: EntityId) => void;
  sendToBack: (id: EntityId) => void;
  
  // Drag operations
  startDrag: (ids: EntityId[], startPosition: Position) => void;
  updateDrag: (currentOffset: Position) => void;
  endDrag: (finalPosition?: Position) => void;
  
  // Clipboard operations
  copyCards: (ids: EntityId[]) => void;
  cutCards: (ids: EntityId[]) => void;
  pasteCards: (position?: Position) => EntityId[];
  
  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Utility
  getCard: (id: EntityId) => Card | undefined;
  getCards: () => Card[];
  getSelectedCards: () => Card[];
  getCardsInBounds: (bounds: Bounds) => Card[];
}

/**
 * Combined card store type
 */
export interface CardStore extends CardState, CardActions {}