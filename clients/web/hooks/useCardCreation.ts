/**
 * Card Creation Hook
 *
 * Manages state and operations for card creation UI components including
 * modal states, position tracking, type selection, and integration with
 * Apollo GraphQL mutations for server-side card creation.
 */

import { useCallback, useState } from 'react';
import { useMutation } from '@apollo/client';
import { useCanvasStore } from '@/stores/canvasStore';
import { CREATE_CARD, GET_CARDS, GET_CARDS_IN_BOUNDS } from '@/lib/graphql/cardOperations';
import type {
  CreateCardMutationVariables,
  CardResponse,
} from '@/lib/graphql/cardOperations';
import type {
  CardType,
  CardId
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
  /** Workspace ID for card creation */
  workspaceId: string;
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
  createCard: (params?: Partial<CreateCardMutationVariables['input']>) => Promise<string | null>;

  /** Create card of specific type at position */
  createCardAtPosition: (type: CardType, position: CanvasPosition, content?: string) => Promise<string | null>;

  /** Get default position for card creation */
  getDefaultPosition: () => CanvasPosition;

  /** Get canvas position from screen coordinates */
  screenToCanvasPosition: (screenPos: Position) => CanvasPosition;

  /** Clear any error state */
  clearError: () => void;
}

/**
 * Default content for each card type
 */
const getDefaultContent = (type: CardType): string => {
  switch (type) {
    case 'text':
      return 'Enter your text here';
    case 'image':
      return 'https://via.placeholder.com/300x200?text=Image';
    case 'link':
      return 'https://example.com';
    case 'code':
      return '// Your code here';
    default:
      return 'Enter content here';
  }
};

/**
 * Convert frontend card type to GraphQL enum
 * Resolver expects lowercase enum values: 'text' | 'image' | 'link' | 'code' | 'file' | 'drawing'
 */
const toGraphQLCardType = (type: CardType): 'text' | 'image' | 'link' | 'code' => {
  return type.toLowerCase() as 'text' | 'image' | 'link' | 'code';
};

/**
 * Custom hook for card creation state management
 */
export const useCardCreation = (config: CardCreationConfig): UseCardCreationReturn => {
  const {
    workspaceId,
    defaultType = 'text',
    defaultOffset = { x: 0, y: 0 },
    autoEnterEditMode = false,
  } = config;

  // Store hooks
  const canvasStore = useCanvasStore();
  const { viewport } = canvasStore;

  // Apollo mutation
  const [createCardMutation, { loading: isCreatingMutation }] = useMutation<
    { createCard: CardResponse },
    CreateCardMutationVariables
  >(CREATE_CARD, {
    // Update Apollo cache after successful card creation
    update: (cache, { data }) => {
      if (!data?.createCard) return;

      // Update the GET_CARDS query cache
      try {
        const existingCards = cache.readQuery({
          query: GET_CARDS,
          variables: { workspaceId },
        }) as { cards: { items: CardResponse[] } } | null;

        if (existingCards) {
          cache.writeQuery({
            query: GET_CARDS,
            variables: { workspaceId },
            data: {
              cards: {
                ...existingCards.cards,
                items: [data.createCard, ...existingCards.cards.items],
              },
            },
          });
        }
      } catch (error) {
        // Cache entry might not exist yet, that's okay
        console.debug('Could not update cache after card creation:', error);
      }
    },
  });

  // Creation state
  const [state, setState] = useState<CardCreationState>({
    isModalOpen: false,
    isContextMenuOpen: false,
    selectedType: null,
    creationPosition: null,
    contextMenuPosition: null,
    isCreating: isCreatingMutation,
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
      z: Math.floor(Date.now() / 1000) % 1000, // Use timestamp-based z-ordering within valid range
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
      z: Math.floor(Date.now() / 1000) % 1000, // Use timestamp-based z-ordering within valid range
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
  const createCard = useCallback(async (params: Partial<CreateCardMutationVariables['input']> = {}): Promise<string | null> => {
    const { selectedType, creationPosition } = state;

    if (!selectedType || !creationPosition) {
      setState(prev => ({ ...prev, error: 'Missing card type or position' }));
      return null;
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      const input: CreateCardMutationVariables['input'] = {
        workspaceId,
        type: toGraphQLCardType(selectedType),
        title: params.title || `New ${selectedType} card`,
        content: params.content || getDefaultContent(selectedType),
        position: {
          x: creationPosition.x,
          y: creationPosition.y,
          z: creationPosition.z || Math.floor(Date.now() / 1000) % 1000,
        },
        dimensions: params.dimensions || DEFAULT_CARD_DIMENSIONS[selectedType],
        style: params.style,
        tags: params.tags || [],
        metadata: params.metadata || {},
        priority: params.priority || 'normal',
      };

      const result = await createCardMutation({
        variables: { input },
      });

      const createdCard = result.data?.createCard;
      if (!createdCard) {
        throw new Error('No card returned from mutation');
      }

      // Apollo automatically updates the cache with the new card
      // No need to manually add to local store - GraphQL queries will fetch updated data

      // Close UI after successful creation
      setState(prev => ({
        ...prev,
        isModalOpen: false,
        isContextMenuOpen: false,
        selectedType: null,
        creationPosition: null,
        contextMenuPosition: null,
      }));

      // TODO: Integrate with NEX-193 to auto-enter edit mode
      if (autoEnterEditMode) {
        console.log('Auto-enter edit mode for card:', createdCard.id);
      }

      return createdCard.id;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create card',
      }));
      return null;
    }
  }, [state, workspaceId, createCardMutation, autoEnterEditMode]);

  /**
   * Create card of specific type at position
   */
  const createCardAtPosition = useCallback(async (
    type: CardType,
    position: CanvasPosition,
    content?: string
  ): Promise<string | null> => {
    console.log('🚀 createCardAtPosition called:', { type, position, workspaceId });
    setState(prev => ({ ...prev, error: null }));

    try {
      const input: CreateCardMutationVariables['input'] = {
        workspaceId,
        type: toGraphQLCardType(type),
        title: `New ${type} card`,
        content: content || getDefaultContent(type),
        position: {
          x: position.x,
          y: position.y,
          z: position.z || Math.floor(Date.now() / 1000) % 1000,
        },
        dimensions: DEFAULT_CARD_DIMENSIONS[type],
        tags: [],
        metadata: {},
        priority: 'normal',
      };

      console.log('📤 Sending GraphQL mutation with input:', input);

      const result = await createCardMutation({
        variables: { input },
      });

      console.log('📥 GraphQL mutation result:', result);

      const createdCard = result.data?.createCard;
      if (!createdCard) {
        console.error('❌ No card returned from mutation');
        throw new Error('No card returned from mutation');
      }

      console.log('✅ Card created successfully:', createdCard.id);

      // Apollo automatically updates the cache with the new card
      // No need to manually add to local store - GraphQL queries will fetch updated data
      console.log('✅ Card added to local store for rendering');

      // TODO: Integrate with NEX-193 to auto-enter edit mode
      if (autoEnterEditMode) {
        console.log('Auto-enter edit mode for card:', createdCard.id);
      }

      return createdCard.id;
    } catch (error) {
      console.error('❌ createCardAtPosition error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create card',
      }));
      return null;
    }
  }, [workspaceId, createCardMutation, autoEnterEditMode]);

  return {
    state: {
      ...state,
      isCreating: isCreatingMutation, // Use Apollo loading state
    },
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