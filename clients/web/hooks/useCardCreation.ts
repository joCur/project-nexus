/**
 * Card Creation Hook
 *
 * Manages state and operations for card creation UI components including
 * modal states, position tracking, type selection, and integration with
 * existing card store and operations.
 */

import { useCallback, useState } from 'react';
import { useCardStore } from '@/stores/cardStore';
import { useCanvasStore } from '@/stores/canvasStore';
import type {
  CardType,
  CreateCardParams,
  CardId,
} from '@/types/card.types';
import { DEFAULT_CARD_DIMENSIONS } from '@/types/card.types';
import type { CanvasPosition } from '@/types/canvas.types';
import type { Position } from '@/types/common.types';

/**
 * Card creation state interface
 */
export interface CardCreationState {
  /** Whether the creation modal is open */
  isModalOpen: boolean;
  /** Whether the context menu is open */
  isContextMenuOpen: boolean;
  /** Currently selected card type */
  selectedType: CardType | null;
  /** Position where card should be created */
  creationPosition: CanvasPosition | null;
  /** Context menu position */
  contextMenuPosition: Position | null;
  /** Whether creation is in progress */
  isCreating: boolean;
  /** Creation error if any */
  error: string | null;
}

/**
 * Card creation configuration options
 */
export interface CardCreationConfig {
  /** Default card type */
  defaultType?: CardType;
  /** Default position offset from center */
  defaultOffset?: Position;
  /** Whether to auto-enter edit mode after creation */
  autoEnterEditMode?: boolean;
}

/**
 * Hook return interface
 */
export interface UseCardCreationReturn {
  /** Current creation state */
  state: CardCreationState;

  /** Open creation modal at position */
  openModal: (position?: CanvasPosition, type?: CardType) => void;

  /** Close creation modal */
  closeModal: () => void;

  /** Open context menu at position */
  openContextMenu: (position: Position) => void;

  /** Close context menu */
  closeContextMenu: () => void;

  /** Set selected card type */
  setSelectedType: (type: CardType) => void;

  /** Create card with current settings */
  createCard: (params?: Partial<CreateCardParams>) => Promise<CardId | null>;

  /** Create card of specific type at position */
  createCardAtPosition: (type: CardType, position: CanvasPosition, content?: any) => Promise<CardId | null>;

  /** Get default position for card creation */
  getDefaultPosition: () => CanvasPosition;

  /** Get canvas position from screen coordinates */
  screenToCanvasPosition: (screenPos: Position) => CanvasPosition;

  /** Clear any error state */
  clearError: () => void;
}

/**
 * Default content generators for each card type
 */
const getDefaultContent = (type: CardType): any => {
  switch (type) {
    case 'text':
      return {
        type: 'text',
        content: '',
        markdown: false,
        wordCount: 0,
        lastEditedAt: new Date().toISOString(),
      };
    case 'image':
      return {
        type: 'image',
        url: '',
        alt: '',
        caption: '',
      };
    case 'link':
      return {
        type: 'link',
        url: '',
        title: '',
        domain: '',
        isAccessible: true,
      };
    case 'code':
      return {
        type: 'code',
        language: 'javascript',
        content: '',
        lineCount: 0,
      };
    default:
      return {};
  }
};

/**
 * Custom hook for card creation state management
 */
export const useCardCreation = (config: CardCreationConfig = {}): UseCardCreationReturn => {
  const {
    defaultType = 'text',
    defaultOffset = { x: 0, y: 0 },
    autoEnterEditMode = false,
  } = config;

  // Store hooks
  const cardStore = useCardStore();
  const canvasStore = useCanvasStore();
  const { viewport } = canvasStore;

  // Creation state
  const [state, setState] = useState<CardCreationState>({
    isModalOpen: false,
    isContextMenuOpen: false,
    selectedType: null,
    creationPosition: null,
    contextMenuPosition: null,
    isCreating: false,
    error: null,
  });

  /**
   * Convert screen coordinates to canvas coordinates
   */
  const screenToCanvasPosition = useCallback((screenPos: Position): CanvasPosition => {
    const { position, zoom } = viewport;

    return {
      x: (screenPos.x - position.x) / zoom,
      y: (screenPos.y - position.y) / zoom,
      z: Date.now(), // Use timestamp for z-ordering
    };
  }, [viewport]);

  /**
   * Get default position for card creation (center of viewport)
   */
  const getDefaultPosition = useCallback((): CanvasPosition => {
    const { position, zoom } = viewport;

    // Calculate center of current viewport
    const centerX = (-position.x + window.innerWidth / 2) / zoom;
    const centerY = (-position.y + window.innerHeight / 2) / zoom;

    return {
      x: centerX + defaultOffset.x,
      y: centerY + defaultOffset.y,
      z: Date.now(),
    };
  }, [viewport, defaultOffset]);

  /**
   * Open creation modal
   */
  const openModal = useCallback((position?: CanvasPosition, type?: CardType) => {
    setState(prev => ({
      ...prev,
      isModalOpen: true,
      isContextMenuOpen: false,
      creationPosition: position || getDefaultPosition(),
      selectedType: type || defaultType,
      error: null,
    }));
  }, [getDefaultPosition, defaultType]);

  /**
   * Close creation modal
   */
  const closeModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModalOpen: false,
      selectedType: null,
      creationPosition: null,
      error: null,
    }));
  }, []);

  /**
   * Open context menu at screen position
   */
  const openContextMenu = useCallback((position: Position) => {
    setState(prev => ({
      ...prev,
      isContextMenuOpen: true,
      isModalOpen: false,
      contextMenuPosition: position,
      creationPosition: screenToCanvasPosition(position),
      error: null,
    }));
  }, [screenToCanvasPosition]);

  /**
   * Close context menu
   */
  const closeContextMenu = useCallback(() => {
    setState(prev => ({
      ...prev,
      isContextMenuOpen: false,
      contextMenuPosition: null,
      creationPosition: null,
      error: null,
    }));
  }, []);

  /**
   * Set selected card type
   */
  const setSelectedType = useCallback((type: CardType) => {
    setState(prev => ({
      ...prev,
      selectedType: type,
      error: null,
    }));
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  /**
   * Create card with current settings
   */
  const createCard = useCallback(async (params: Partial<CreateCardParams> = {}): Promise<CardId | null> => {
    const { selectedType, creationPosition } = state;

    if (!selectedType || !creationPosition) {
      setState(prev => ({ ...prev, error: 'Missing card type or position' }));
      return null;
    }

    setState(prev => ({ ...prev, isCreating: true, error: null }));

    try {
      const createParams: CreateCardParams = {
        type: selectedType,
        position: creationPosition,
        content: params.content || getDefaultContent(selectedType),
        dimensions: params.dimensions || DEFAULT_CARD_DIMENSIONS[selectedType],
        style: params.style,
        ...params,
      };

      const cardId = cardStore.createCard(createParams);

      // Close UI after successful creation
      setState(prev => ({
        ...prev,
        isCreating: false,
        isModalOpen: false,
        isContextMenuOpen: false,
        selectedType: null,
        creationPosition: null,
        contextMenuPosition: null,
      }));

      // TODO: Integrate with NEX-193 to auto-enter edit mode
      if (autoEnterEditMode && cardId) {
        // This will be implemented when NEX-193 is available
        console.log('Auto-enter edit mode for card:', cardId);
      }

      return cardId;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isCreating: false,
        error: error instanceof Error ? error.message : 'Failed to create card',
      }));
      return null;
    }
  }, [state, cardStore, autoEnterEditMode]);

  /**
   * Create card of specific type at position
   */
  const createCardAtPosition = useCallback(async (
    type: CardType,
    position: CanvasPosition,
    content?: any
  ): Promise<CardId | null> => {
    setState(prev => ({ ...prev, isCreating: true, error: null }));

    try {
      const createParams: CreateCardParams = {
        type,
        position,
        content: content || getDefaultContent(type),
        dimensions: DEFAULT_CARD_DIMENSIONS[type],
      };

      const cardId = cardStore.createCard(createParams);

      setState(prev => ({ ...prev, isCreating: false }));

      // TODO: Integrate with NEX-193 to auto-enter edit mode
      if (autoEnterEditMode && cardId) {
        console.log('Auto-enter edit mode for card:', cardId);
      }

      return cardId;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isCreating: false,
        error: error instanceof Error ? error.message : 'Failed to create card',
      }));
      return null;
    }
  }, [cardStore, autoEnterEditMode]);

  return {
    state,
    openModal,
    closeModal,
    openContextMenu,
    closeContextMenu,
    setSelectedType,
    createCard,
    createCardAtPosition,
    getDefaultPosition,
    screenToCanvasPosition,
    clearError,
  };
};

export default useCardCreation;