/**
 * Card Store Type Definitions
 * 
 * Comprehensive types and interfaces for card entities with discriminated unions,
 * canvas-specific properties, and enhanced type safety for the infinite canvas system.
 */

import type { Position, Dimensions, Bounds, Color, EntityId, Timestamp, Metadata } from './common.types';
import type { CanvasPosition, CanvasBounds } from './canvas.types';

// ============================================================================
// BRANDED TYPES FOR CARDS
// ============================================================================

/**
 * Branded card ID for type safety
 */
export type CardId = EntityId & { readonly __brand: 'CardId' };

/**
 * Create branded card ID
 */
export const createCardId = (id: string): CardId => id as CardId;

// ============================================================================
// CARD TYPE DEFINITIONS
// ============================================================================

/**
 * Card types supported by the canvas
 */
export type CardType = 'text' | 'image' | 'link' | 'code';

/**
 * Card status for lifecycle management
 */
export type CardStatus = 'draft' | 'active' | 'archived' | 'deleted';

/**
 * Card priority levels
 */
export type CardPriority = 'low' | 'normal' | 'high' | 'urgent';

// ============================================================================
// DISCRIMINATED UNION CARD CONTENT TYPES
// ============================================================================

/**
 * Text card specific content
 */
export interface TextCardContent {
  type: 'text';
  content: string;
  markdown: boolean;
  wordCount: number;
  lastEditedAt?: Timestamp;
}

/**
 * Image card specific content
 */
export interface ImageCardContent {
  type: 'image';
  url: string;
  alt: string;
  caption?: string;
  originalFilename?: string;
  fileSize?: number;
  dimensions?: Dimensions;
  thumbnail?: string;
}

/**
 * Link card specific content
 */
export interface LinkCardContent {
  type: 'link';
  url: string;
  title: string;
  description?: string;
  favicon?: string;
  previewImage?: string;
  domain: string;
  lastChecked?: Timestamp;
  isAccessible: boolean;
}

/**
 * Code card specific content
 */
export interface CodeCardContent {
  type: 'code';
  language: string;
  content: string;
  filename?: string;
  lineCount: number;
  hasExecuted?: boolean;
  executionResults?: {
    output?: string;
    error?: string;
    timestamp: Timestamp;
  };
}

/**
 * Union type for all card content variants
 */
export type CardContent = 
  | TextCardContent 
  | ImageCardContent 
  | LinkCardContent 
  | CodeCardContent;

// ============================================================================
// CARD STYLING AND APPEARANCE
// ============================================================================

/**
 * Card styling properties with enhanced options
 */
export interface CardStyle {
  /** Background color */
  backgroundColor: Color;
  /** Border color */
  borderColor: Color;
  /** Text color */
  textColor: Color;
  /** Border width in pixels */
  borderWidth: number;
  /** Border radius in pixels */
  borderRadius: number;
  /** Overall opacity (0-1) */
  opacity: number;
  /** Drop shadow enabled */
  shadow: boolean;
  /** Shadow configuration */
  shadowConfig?: {
    color: Color;
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
  };
  /** Gradient background */
  gradient?: {
    enabled: boolean;
    direction: number; // degrees
    stops: Array<{
      color: Color;
      position: number; // 0-1
    }>;
  };
}

/**
 * Card animation state
 */
export interface CardAnimation {
  /** Whether card is currently animating */
  isAnimating: boolean;
  /** Animation type */
  type?: 'move' | 'resize' | 'fade' | 'scale' | 'rotate';
  /** Animation duration in milliseconds */
  duration?: number;
  /** Animation easing function */
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  /** Animation start timestamp */
  startTime?: number;
}

// ============================================================================
// ENHANCED CARD INTERFACE WITH DISCRIMINATED UNIONS
// ============================================================================

/**
 * Base card interface with common properties
 */
interface BaseCard {
  /** Unique card identifier */
  id: CardId;
  /** Card content with discriminated union */
  content: CardContent;
  /** Canvas position (z component is used for layering) */
  position: CanvasPosition;
  /** Card dimensions */
  dimensions: Dimensions;
  /** Visual styling */
  style: CardStyle;
  /** Selection state */
  isSelected: boolean;
  /** Locked state prevents editing */
  isLocked: boolean;
  /** Hidden state for temporary hiding */
  isHidden: boolean;
  /** Minimized state */
  isMinimized: boolean;
  /** Card status */
  status: CardStatus;
  /** Card priority */
  priority: CardPriority;
  /** Creation timestamp */
  createdAt: Timestamp;
  /** Last update timestamp */
  updatedAt: Timestamp;
  /** Tags for categorization */
  tags: string[];
  /** Additional metadata */
  metadata: Metadata;
  /** Animation state */
  animation: CardAnimation;
}

/**
 * Text card with specific typing
 */
export interface TextCard extends BaseCard {
  content: TextCardContent;
}

/**
 * Image card with specific typing
 */
export interface ImageCard extends BaseCard {
  content: ImageCardContent;
}

/**
 * Link card with specific typing
 */
export interface LinkCard extends BaseCard {
  content: LinkCardContent;
}

/**
 * Code card with specific typing
 */
export interface CodeCard extends BaseCard {
  content: CodeCardContent;
}

/**
 * Union type for all card variants using discriminated union
 */
export type Card = TextCard | ImageCard | LinkCard | CodeCard;

// ============================================================================
// CARD INTERACTION AND SELECTION
// ============================================================================

/**
 * Card selection state with enhanced features
 */
export interface CardSelection {
  /** Set of selected card IDs */
  selectedIds: Set<CardId>;
  /** Last selected card ID */
  lastSelected?: CardId;
  /** Primary selected card (for multi-selection operations) */
  primarySelected?: CardId;
  /** Selection bounds encompassing all selected cards */
  selectionBounds?: CanvasBounds;
  /** Selection mode */
  mode: 'single' | 'multiple' | 'area' | 'lasso';
  /** Whether selection is being dragged */
  isDragSelection: boolean;
}

/**
 * Card drag state with multi-card support
 */
export interface CardDragState {
  /** Whether cards are being dragged */
  isDragging: boolean;
  /** Set of dragged card IDs */
  draggedIds: Set<CardId>;
  /** Drag start position */
  startPosition: CanvasPosition;
  /** Current drag offset */
  currentOffset: Position;
  /** Drag ghost/preview configuration */
  dragPreview?: {
    opacity: number;
    showCount: boolean;
  };
}

/**
 * Card resize state
 */
export interface CardResizeState {
  /** Whether a card is being resized */
  isResizing: boolean;
  /** Card being resized */
  cardId?: CardId;
  /** Resize handle being used */
  handle?: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  /** Original dimensions */
  originalDimensions?: Dimensions;
  /** Minimum dimensions for the card type */
  minDimensions: Dimensions;
  /** Maximum dimensions for the card type */
  maxDimensions: Dimensions;
  /** Whether to maintain aspect ratio */
  maintainAspectRatio: boolean;
}

/**
 * Card hover state
 */
export interface CardHoverState {
  /** Currently hovered card ID */
  hoveredId?: CardId;
  /** Hover timestamp */
  hoverStartTime?: number;
  /** Show hover tooltip */
  showTooltip: boolean;
  /** Tooltip position */
  tooltipPosition?: Position;
}

// ============================================================================
// CARD HISTORY AND VERSIONING
// ============================================================================

/**
 * Card history entry for undo/redo
 */
export interface CardHistoryEntry {
  /** Timestamp of change */
  timestamp: Timestamp;
  /** Type of change */
  changeType: 'create' | 'update' | 'delete' | 'move' | 'resize' | 'style';
  /** Card state before change */
  beforeState: Card | null;
  /** Card state after change */
  afterState: Card | null;
  /** User who made the change */
  userId?: string;
  /** Optional description of change */
  description?: string;
}

/**
 * Card history for undo/redo operations
 */
export interface CardHistory {
  /** Past states (undo stack) */
  past: CardHistoryEntry[];
  /** Current state */
  present: Map<CardId, Card>;
  /** Future states (redo stack) */
  future: CardHistoryEntry[];
  /** Maximum history entries to keep */
  maxHistorySize: number;
}

// ============================================================================
// CARD FILTERING AND SEARCH
// ============================================================================

/**
 * Card filter configuration
 */
export interface CardFilter {
  /** Filter by card types */
  types?: CardType[];
  /** Filter by status */
  status?: CardStatus[];
  /** Filter by priority */
  priority?: CardPriority[];
  /** Filter by tags */
  tags?: string[];
  /** Filter by creation date range */
  createdDateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  /** Filter by update date range */
  updatedDateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  /** Filter by text content */
  searchQuery?: string;
  /** Filter by canvas bounds */
  bounds?: CanvasBounds;
  /** Filter by selection state */
  selectedOnly?: boolean;
  /** Filter by locked state */
  lockedOnly?: boolean;
  /** Hide archived cards */
  hideArchived?: boolean;
}

/**
 * Card search result
 */
export interface CardSearchResult {
  /** Matching card */
  card: Card;
  /** Search relevance score */
  relevance: number;
  /** Highlighted text matches */
  highlights?: Array<{
    field: keyof Card;
    text: string;
    startIndex: number;
    endIndex: number;
  }>;
}

// ============================================================================
// CARD TEMPLATES AND PRESETS
// ============================================================================

/**
 * Card template for quick creation
 */
export interface CardTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Card type this template applies to */
  type: CardType;
  /** Default content structure */
  defaultContent: Partial<CardContent>;
  /** Default styling */
  defaultStyle: Partial<CardStyle>;
  /** Default dimensions */
  defaultDimensions: Dimensions;
  /** Template category */
  category: string;
  /** Whether template is user-created */
  isCustom: boolean;
  /** Template thumbnail */
  thumbnail?: string;
}

// ============================================================================
// CARD STORE STATE AND ACTIONS
// ============================================================================

/**
 * Card store state interface
 */
export interface CardState {
  /** Map of all cards by ID */
  cards: Map<CardId, Card>;
  /** Selection state */
  selection: CardSelection;
  /** Drag state */
  dragState: CardDragState;
  /** Resize state */
  resizeState: CardResizeState;
  /** Hover state */
  hoverState: CardHoverState;
  /** Clipboard contents */
  clipboard: Card[];
  /** History for undo/redo */
  history: CardHistory;
  /** Available templates */
  templates: Map<string, CardTemplate>;
  /** Active filters */
  activeFilter: CardFilter;
  /** Search results */
  searchResults: CardSearchResult[];
}

/**
 * Card creation parameters
 */
export interface CreateCardParams {
  type: CardType;
  position: CanvasPosition;
  content?: Partial<CardContent>;
  dimensions?: Dimensions;
  style?: Partial<CardStyle>;
  templateId?: string;
}

/**
 * Card update parameters
 */
export interface UpdateCardParams {
  id: CardId;
  updates: Partial<Omit<Card, 'id' | 'createdAt'>>;
}

/**
 * Card store actions interface
 */
export interface CardActions {
  // CRUD operations
  createCard: (params: CreateCardParams) => CardId;
  createCardFromTemplate: (templateId: string, position: CanvasPosition) => CardId;
  updateCard: (params: UpdateCardParams) => void;
  updateCards: (updates: UpdateCardParams[]) => void;
  deleteCard: (id: CardId) => void;
  deleteCards: (ids: CardId[]) => void;
  duplicateCard: (id: CardId, offset?: Position) => CardId;
  duplicateCards: (ids: CardId[], offset?: Position) => CardId[];
  
  // Selection management
  selectCard: (id: CardId, addToSelection?: boolean) => void;
  selectCards: (ids: CardId[]) => void;
  selectCardsInBounds: (bounds: CanvasBounds) => void;
  selectAll: () => void;
  clearSelection: () => void;
  invertSelection: () => void;
  isCardSelected: (id: CardId) => boolean;
  getSelectedCards: () => Card[];
  
  // Card manipulation
  moveCard: (id: CardId, position: CanvasPosition) => void;
  moveCards: (ids: CardId[], offset: Position) => void;
  resizeCard: (id: CardId, dimensions: Dimensions) => void;
  updateCardStyle: (id: CardId, style: Partial<CardStyle>) => void;
  updateCardStatus: (id: CardId, status: CardStatus) => void;
  updateCardPriority: (id: CardId, priority: CardPriority) => void;
  bringToFront: (id: CardId) => void;
  sendToBack: (id: CardId) => void;
  arrangeCards: (ids: CardId[], arrangement: 'front' | 'back' | 'forward' | 'backward') => void;
  
  // Locking and visibility
  lockCard: (id: CardId) => void;
  unlockCard: (id: CardId) => void;
  toggleCardLock: (id: CardId) => void;
  hideCard: (id: CardId) => void;
  showCard: (id: CardId) => void;
  toggleCardVisibility: (id: CardId) => void;
  minimizeCard: (id: CardId) => void;
  maximizeCard: (id: CardId) => void;
  
  // Drag operations
  startDrag: (ids: CardId[], startPosition: CanvasPosition) => void;
  updateDrag: (currentOffset: Position) => void;
  endDrag: (finalPosition?: CanvasPosition) => void;
  cancelDrag: () => void;
  
  // Resize operations  
  startResize: (id: CardId, handle: CardResizeState['handle']) => void;
  updateResize: (dimensions: Dimensions) => void;
  endResize: () => void;
  cancelResize: () => void;
  
  // Hover operations
  setHoveredCard: (id: CardId | undefined) => void;
  
  // Clipboard operations
  copyCards: (ids: CardId[]) => void;
  cutCards: (ids: CardId[]) => void;
  pasteCards: (position?: CanvasPosition) => CardId[];
  
  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  
  // Template operations
  saveAsTemplate: (id: CardId, name: string, description: string) => string;
  deleteTemplate: (templateId: string) => void;
  
  // Filtering and search
  setFilter: (filter: CardFilter) => void;
  clearFilter: () => void;
  searchCards: (query: string) => void;
  clearSearch: () => void;
  
  // Utility functions
  getCard: (id: CardId) => Card | undefined;
  getCards: (ids?: CardId[]) => Card[];
  getCardsInBounds: (bounds: CanvasBounds) => Card[];
  getCardsByType: (type: CardType) => Card[];
  getCardsByStatus: (status: CardStatus) => Card[];
  getCardsByTag: (tag: string) => Card[];
  getCardCount: () => number;
  getCardBounds: (id: CardId) => CanvasBounds | undefined;
  getAllCardsBounds: () => CanvasBounds | undefined;
}

/**
 * Combined card store type
 */
export interface CardStore extends CardState, CardActions {}

// ============================================================================
// TYPE GUARDS FOR DISCRIMINATED UNIONS
// ============================================================================

/**
 * Type guard for text card
 */
export const isTextCard = (card: Card): card is TextCard =>
  card.content.type === 'text';

/**
 * Type guard for image card
 */
export const isImageCard = (card: Card): card is ImageCard =>
  card.content.type === 'image';

/**
 * Type guard for link card
 */
export const isLinkCard = (card: Card): card is LinkCard =>
  card.content.type === 'link';

/**
 * Type guard for code card
 */
export const isCodeCard = (card: Card): card is CodeCard =>
  card.content.type === 'code';

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default card dimensions by type
 */
export const DEFAULT_CARD_DIMENSIONS: Record<CardType, Dimensions> = {
  text: { width: 250, height: 150 },
  image: { width: 300, height: 200 },
  link: { width: 280, height: 120 },
  code: { width: 400, height: 250 },
};

/**
 * Default card style
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

/**
 * Card constraints for validation
 */
export const CARD_CONSTRAINTS = {
  MIN_WIDTH: 100,
  MIN_HEIGHT: 50,
  MAX_WIDTH: 1000,
  MAX_HEIGHT: 800,
  MIN_BORDER_WIDTH: 0,
  MAX_BORDER_WIDTH: 10,
  MIN_BORDER_RADIUS: 0,
  MAX_BORDER_RADIUS: 50,
  MIN_OPACITY: 0.1,
  MAX_OPACITY: 1,
  MAX_TAG_LENGTH: 50,
  MAX_TAGS_PER_CARD: 20,
  MAX_TEXT_LENGTH: 50000,
  MAX_TITLE_LENGTH: 200,
} as const;

// ============================================================================
// TYPE EXPORTS - All types are exported inline above
// ============================================================================

/**
 * Card type definitions version for compatibility tracking
 */
export const CARD_TYPES_VERSION = '1.0.0' as const;