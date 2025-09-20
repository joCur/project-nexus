/**
 * Card Operations Hook
 * 
 * Integrates GraphQL operations with the existing card store, providing 
 * real-time synchronization and server persistence for card operations.
 */

import { useCallback, useEffect } from 'react';
import {
  useQuery,
  useMutation,
  // useSubscription, // 🚨 TODO: Uncomment when subscriptions are re-enabled
  useApolloClient
} from '@apollo/client';
import {
  GET_CARDS,
  GET_CARD,
  SEARCH_CARDS,
  CREATE_CARD,
  UPDATE_CARD,
  DELETE_CARD,
  DUPLICATE_CARD,
  BATCH_UPDATE_CARD_POSITIONS,
  CARD_CREATED_SUBSCRIPTION,
  CARD_UPDATED_SUBSCRIPTION,
  CARD_DELETED_SUBSCRIPTION,
  type CardResponse,
  type CardsConnectionResponse,
} from '@/lib/graphql/cardOperations';
import { useCardStore } from '@/stores/cardStore';
import type { 
  Card, 
  CardId, 
  CreateCardParams, 
  UpdateCardParams,
  TextCard,
  ImageCard,
  LinkCard,
  CodeCard
} from '@/types/card.types';
import type { EntityId } from '@/types/common.types';

/**
 * Transform backend GraphQL response to frontend Card type
 * Handles backend single interface to frontend discriminated union conversion
 */
const transformBackendCardToFrontend = (backendCard: CardResponse): Card => {
  const baseCard = {
    id: backendCard.id as CardId,
    position: {
      x: backendCard.position.x,
      y: backendCard.position.y,
      z: backendCard.position.z,
    },
    dimensions: backendCard.dimensions,
    style: backendCard.style,
    isSelected: false,
    isLocked: false,
    isHidden: false,
    isMinimized: false,
    status: backendCard.status.toLowerCase() as 'draft' | 'active' | 'archived' | 'deleted',
    priority: backendCard.priority.toLowerCase() as 'low' | 'normal' | 'high' | 'urgent',
    createdAt: backendCard.createdAt,
    updatedAt: backendCard.updatedAt,
    tags: backendCard.tags,
    metadata: backendCard.metadata,
    animation: {
      isAnimating: false,
    },
  };

  // Create discriminated union based on backend type
  switch (backendCard.type) {
    case 'TEXT':
      return {
        ...baseCard,
        content: {
          type: 'text' as const,
          content: backendCard.content,
          markdown: false,
          wordCount: backendCard.content.length,
          lastEditedAt: backendCard.updatedAt,
        },
      } as TextCard;

    case 'IMAGE':
      return {
        ...baseCard,
        content: {
          type: 'image' as const,
          url: backendCard.content,
          alt: backendCard.title || '',
          caption: backendCard.title,
        },
      } as ImageCard;

    case 'LINK':
      try {
        const url = new URL(backendCard.content);
        return {
          ...baseCard,
          content: {
            type: 'link' as const,
            url: backendCard.content,
            title: backendCard.title || url.hostname,
            description: backendCard.metadata?.description,
            domain: url.hostname,
            favicon: backendCard.metadata?.favicon,
            previewImage: backendCard.metadata?.previewImage,
            lastChecked: backendCard.metadata?.lastChecked,
            isAccessible: true,
          },
        } as LinkCard;
      } catch {
        return {
          ...baseCard,
          content: {
            type: 'link' as const,
            url: backendCard.content,
            title: backendCard.title || 'Link',
            domain: '',
            isAccessible: false,
          },
        } as LinkCard;
      }

    case 'CODE':
      return {
        ...baseCard,
        content: {
          type: 'code' as const,
          language: backendCard.metadata?.language || 'text',
          content: backendCard.content,
          filename: backendCard.metadata?.filename,
          lineCount: backendCard.content.split('\n').length,
          hasExecuted: false,
        },
      } as CodeCard;

    default:
      return {
        ...baseCard,
        content: {
          type: 'text' as const,
          content: backendCard.content,
          markdown: false,
          wordCount: backendCard.content.length,
          lastEditedAt: backendCard.updatedAt,
        },
      } as TextCard;
  }
};

/**
 * Transform frontend CreateCardParams to backend mutation input
 */
const transformCreateParamsToBackend = (params: CreateCardParams & { workspaceId: EntityId }) => {
  const baseInput: any = {
    workspaceId: params.workspaceId,
    type: params.type.toUpperCase(),
    position: {
      x: params.position.x,
      y: params.position.y,
    },
    dimensions: params.dimensions,
    style: params.style,
    tags: [],
    metadata: {},
  };

  // Handle content based on type
  if (params.content) {
    switch (params.content.type) {
      case 'text':
        baseInput.content = params.content.content;
        break;
      case 'image':
        baseInput.content = params.content.url;
        baseInput.title = params.content.alt;
        break;
      case 'link':
        baseInput.content = params.content.url;
        baseInput.title = params.content.title;
        baseInput.metadata = {
          description: params.content.description,
          domain: params.content.domain,
        };
        break;
      case 'code':
        baseInput.content = params.content.content;
        baseInput.metadata = {
          language: params.content.language,
          filename: params.content.filename,
        };
        break;
    }
  }

  return baseInput;
};

/**
 * Card GraphQL Operations Hook
 */
export const useCardOperations = (workspaceId: EntityId) => {
  const apolloClient = useApolloClient();

  // Access store methods (read-only for this hook)
  const store = useCardStore();

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Load cards from server (doesn't sync to store automatically)
   */
  const {
    data: cardsData,
    loading: cardsLoading,
    error: cardsError,
    refetch: refetchCards,
  } = useQuery<{ cards: CardsConnectionResponse }>(GET_CARDS, {
    variables: { workspaceId },
    fetchPolicy: 'cache-and-network',
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const [createCardMutation, { loading: createLoading }] = useMutation(CREATE_CARD);
  const [updateCardMutation, { loading: updateLoading }] = useMutation(UPDATE_CARD);
  const [deleteCardMutation, { loading: deleteLoading }] = useMutation(DELETE_CARD);
  const [batchUpdateMutation, { loading: batchLoading }] = useMutation(BATCH_UPDATE_CARD_POSITIONS);

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to real-time card events and sync with store
   *
   * ⚠️ TEMPORARILY DISABLED - TODO: Re-enable real-time card subscriptions
   *
   * Reason: Backend subscriptions return null for non-nullable fields
   * Likely cause: Authentication/permission issues in subscription resolvers
   *
   * @see TodoWrite: "Re-enable card subscriptions in useCardOperations hook"
   */

  // 🚨 CARD SUBSCRIPTIONS DISABLED - Search for "TODO.*subscriptions" to find all disabled locations
  console.log('🚨 Card subscriptions disabled - authentication/permission issues in backend');

  // TODO: Re-enable these card subscriptions when backend auth issues are resolved:
  /*
  useSubscription(CARD_CREATED_SUBSCRIPTION, {
    variables: { workspaceId },
    onData: ({ data }) => {
      if (data?.data?.cardCreated) {
        const card = transformBackendCardToFrontend(data.data.cardCreated);
        store.createCard({ ... });
      }
    },
  });

  useSubscription(CARD_UPDATED_SUBSCRIPTION, { ... });
  useSubscription(CARD_DELETED_SUBSCRIPTION, { ... });
  */

  // ============================================================================
  // API METHODS
  // ============================================================================

  /**
   * Create card with server persistence
   */
  const createCard = useCallback(async (params: CreateCardParams): Promise<CardId | null> => {
    try {
      // First create in local store for immediate UI feedback
      const localCardId = store.createCard(params);

      // Then persist to server
      const input = transformCreateParamsToBackend({ ...params, workspaceId });
      const { data } = await createCardMutation({ variables: { input } });

      if (data?.createCard) {
        // Replace local card with server version
        const serverCard = transformBackendCardToFrontend(data.createCard);
        store.deleteCard(localCardId);
        store.createCard({
          type: serverCard.content.type,
          position: serverCard.position,
          content: serverCard.content,
          dimensions: serverCard.dimensions,
          style: serverCard.style,
        });
        return serverCard.id;
      }

      return localCardId;
    } catch (error) {
      console.error('Failed to create card:', error);
      return null;
    }
  }, [store, workspaceId, createCardMutation]);

  /**
   * Update card with server persistence
   */
  const updateCard = useCallback(async (params: UpdateCardParams): Promise<boolean> => {
    try {
      // Apply optimistic update
      store.updateCard(params);

      // Persist to server
      const input = params.updates;
      const { data } = await updateCardMutation({ 
        variables: { id: params.id, input } 
      });

      return !!data?.updateCard;
    } catch (error) {
      console.error('Failed to update card:', error);
      // TODO: Revert optimistic update
      return false;
    }
  }, [store, updateCardMutation]);

  /**
   * Delete card with server persistence
   */
  const deleteCard = useCallback(async (cardId: CardId): Promise<boolean> => {
    try {
      // Apply optimistic delete
      store.deleteCard(cardId);

      // Persist to server
      const { data } = await deleteCardMutation({ variables: { id: cardId } });

      return !!data?.deleteCard;
    } catch (error) {
      console.error('Failed to delete card:', error);
      // TODO: Revert optimistic delete
      return false;
    }
  }, [store, deleteCardMutation]);

  /**
   * Load and sync cards from server to store
   */
  const syncCardsFromServer = useCallback(async () => {
    try {
      const { data } = await refetchCards();
      if (data?.cards?.items) {
        // Clear existing cards and load from server
        // Note: This is a simplistic approach - in production you'd want smarter syncing
        data.cards.items.forEach(serverCard => {
          const card = transformBackendCardToFrontend(serverCard);
          store.createCard({
            type: card.content.type,
            position: card.position,
            content: card.content,
            dimensions: card.dimensions,
            style: card.style,
          });
        });
      }
    } catch (error) {
      console.error('Failed to sync cards from server:', error);
    }
  }, [refetchCards, store]);

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    // Server data
    serverCards: cardsData?.cards?.items,
    loading: cardsLoading || createLoading || updateLoading || deleteLoading || batchLoading,
    error: cardsError,

    // Operations with server persistence
    createCard,
    updateCard,
    deleteCard,
    
    // Sync operations
    syncCardsFromServer,
    refetchCards,

    // Direct store access for local operations
    store,
  };
};

export default useCardOperations;