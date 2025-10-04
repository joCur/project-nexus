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
 * Tiptap JSON content structure
 * Based on ProseMirror JSON schema used by Tiptap editor
 */
export interface TiptapJSONContent {
  /** Node type (e.g., 'doc', 'paragraph', 'text', 'heading') */
  type: string;
  /** Optional array of child nodes */
  content?: TiptapJSONContent[];
  /** Text content for text nodes */
  text?: string;
  /** Array of marks (formatting) applied to this node */
  marks?: Array<{
    type: string;
    attrs?: Record<string, any>;
  }>;
  /** Node attributes (e.g., level for headings, href for links) */
  attrs?: Record<string, any>;
}

/**
 * Content format type for text cards
 * Using TypeScript enum with lowercase values per architecture guidelines
 */
export enum TextContentFormat {
  MARKDOWN = 'markdown',
  TIPTAP = 'tiptap'
}

/**
 * Text card specific content
 * Supports both legacy markdown format and new Tiptap JSON format
 */
export interface TextCardContent {
  type: 'text';
  /**
   * Content format - 'markdown' for legacy string content, 'tiptap' for JSON structure
   * Optional for backward compatibility - if not specified, falls back to 'markdown' field
   */
  format?: TextContentFormat;
  /**
   * Content data - string for markdown, TiptapJSONContent for tiptap format
   * For backward compatibility, markdown string is stored here
   */
  content: string | TiptapJSONContent;
  /** @deprecated Use format === 'markdown' instead. Kept for backward compatibility. */
  markdown: boolean;
  /** Word count of the text content */
  wordCount: number;
  /** Last edit timestamp */
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
  /** Owner ID (user who created/owns the card) */
  ownerId: EntityId;
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
  /** Selection state */
  selection: CardSelection;
  /** Drag state */
  dragState: CardDragState;
  /** Resize state */
  resizeState: CardResizeState;
  /** Hover state */
  hoverState: CardHoverState;
  /** Currently editing card ID (UI state for inline editing) */
  editingCardId?: CardId | null;
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
  // UI state management only - server data comes from GraphQL queries

  // Selection management (UI state only)
  selectCard: (id: CardId, addToSelection?: boolean) => void;
  selectCards: (ids: CardId[]) => void;
  clearSelection: () => void;
  isCardSelected: (id: CardId) => boolean;
  
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

  // Edit mode operations (UI state only)
  setEditingCard: (id: CardId | null) => void;
  clearEditingCard: () => void;
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
  card.content?.type === 'text';

/**
 * Type guard for image card
 */
export const isImageCard = (card: Card): card is ImageCard =>
  card.content?.type === 'image';

/**
 * Type guard for link card
 */
export const isLinkCard = (card: Card): card is LinkCard =>
  card.content?.type === 'link';

/**
 * Type guard for code card
 */
export const isCodeCard = (card: Card): card is CodeCard =>
  card.content?.type === 'code';

// ============================================================================
// TYPE GUARDS FOR TEXT CARD CONTENT FORMATS
// ============================================================================

/**
 * Type guard to check if content is markdown string format
 */
export const isMarkdownContent = (content: string | TiptapJSONContent): content is string =>
  typeof content === 'string';

/**
 * Type guard to check if content is Tiptap JSON format
 */
export const isTiptapContent = (content: string | TiptapJSONContent): content is TiptapJSONContent =>
  typeof content === 'object' && content !== null && 'type' in content;

/**
 * Type guard to check if text card content uses markdown format
 */
export const isTextCardMarkdown = (content: TextCardContent): content is TextCardContent & { content: string } =>
  (content.format === TextContentFormat.MARKDOWN || (!content.format && content.markdown)) && typeof content.content === 'string';

/**
 * Type guard to check if text card content uses Tiptap format
 */
export const isTextCardTiptap = (content: TextCardContent): content is TextCardContent & { content: TiptapJSONContent } =>
  content.format === TextContentFormat.TIPTAP && typeof content.content === 'object' && content.content !== null;

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