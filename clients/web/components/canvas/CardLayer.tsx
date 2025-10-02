'use client';

import React, { useMemo, useRef, useCallback } from 'react';
import { Layer } from 'react-konva';
import { useQuery, useMutation } from '@apollo/client';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCanvasStore } from '@/stores/canvasStore';
import { useWorkspacePermissionContextSafe } from '@/contexts/WorkspacePermissionContext';
import { useViewportDimensions } from '@/utils/viewport';
import type { Card, CardId } from '@/types/card.types';
import type { CanvasBounds } from '@/types/canvas.types';
import { CARD_CONFIG } from './cards/cardConfig';
import {
  GET_CARDS_IN_BOUNDS,
  GET_CARDS,
  UPDATE_CARD,
  type CardsInBoundsQueryVariables,
  type UpdateCardMutationVariables
} from '@/lib/graphql/cardOperations';

// Backend GraphQL response type
interface BackendCard {
  id: string;
  ownerId: string;
  type: string;
  title?: string;
  position?: { x: number; y: number; z: number };
  dimensions?: { width: number; height: number };
  style?: Record<string, unknown>;
  status?: string;
  priority?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  content: Record<string, unknown>;
}

// Import the CardRenderer from the cards directory
const CardRenderer = React.lazy(() =>
  import('./cards/CardRenderer').then(mod => ({ default: mod.CardRenderer }))
);

interface CardLayerProps {
  /** Optional viewport bounds override for testing */
  viewportBounds?: CanvasBounds;
  /** Whether to enable viewport culling for performance */
  enableViewportCulling?: boolean;
  /** Viewport padding for culling calculations */
  viewportPadding?: number;
}

/**
 * CardLayer component renders all cards within a Konva Layer.
 *
 * Features:
 * - Uses GraphQL queries to fetch cards from server (not local cache)
 * - Viewport culling for performance optimization
 * - Z-order management based on position.z values
 * - Integration with canvas zoom and position
 * - Efficient re-rendering with memoization
 * - Multi-device synchronization through server-side data
 *
 * Performance Optimizations:
 * - Only renders cards within viewport bounds (with padding)
 * - Sorts cards by z-index for proper layering
 * - Uses React.memo and useMemo for efficient re-renders
 * - Lazy loads CardRenderer component
 * - Apollo cache-and-network policy for immediate cached data + fresh updates
 */
export const CardLayer: React.FC<CardLayerProps> = ({
  viewportBounds,
  enableViewportCulling = true,
  viewportPadding = CARD_CONFIG.viewport.extraPadding, // Extra pixels around viewport to render
}) => {
  const { viewport } = useCanvasStore();
  const { zoom, position } = viewport;
  const viewportDimensions = useViewportDimensions();
  const workspaceContext = useWorkspacePermissionContextSafe();
  const currentWorkspaceId = workspaceContext?.currentWorkspaceId;

  // Calculate current viewport bounds if not provided
  const currentViewportBounds = useMemo((): CanvasBounds => {
    if (viewportBounds) {
      return viewportBounds;
    }

    // Calculate viewport bounds based on canvas state
    // We need to reverse the transform to get world coordinates
    const { width: viewportWidth, height: viewportHeight } = viewportDimensions;

    // Convert screen space to world space coordinates
    const worldMinX = (-position.x) / zoom - viewportPadding;
    const worldMinY = (-position.y) / zoom - viewportPadding;
    const worldMaxX = (-position.x + viewportWidth) / zoom + viewportPadding;
    const worldMaxY = (-position.y + viewportHeight) / zoom + viewportPadding;

    return {
      minX: worldMinX,
      minY: worldMinY,
      maxX: worldMaxX,
      maxY: worldMaxY,
    };
  }, [viewportBounds, position.x, position.y, zoom, viewportPadding, viewportDimensions]);

  // Prepare GraphQL variables
  const queryVariables: CardsInBoundsQueryVariables | null = useMemo(() => {
    if (!currentWorkspaceId || !enableViewportCulling) {
      return null;
    }

    return {
      workspaceId: currentWorkspaceId,
      bounds: {
        minX: currentViewportBounds.minX,
        minY: currentViewportBounds.minY,
        maxX: currentViewportBounds.maxX,
        maxY: currentViewportBounds.maxY,
      },
    };
  }, [currentWorkspaceId, currentViewportBounds, enableViewportCulling]);

  // Query cards from GraphQL server instead of local store
  // Skip query if no workspace context (e.g., in tests)
  const { data: cardsData, loading, error } = useQuery(GET_CARDS_IN_BOUNDS, {
    variables: queryVariables || { workspaceId: currentWorkspaceId || '', bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } },
    skip: !currentWorkspaceId,
    fetchPolicy: 'cache-and-network', // Get cached data immediately, but also fetch from network
    errorPolicy: 'all', // Don't crash on GraphQL errors
  });

  // Setup UPDATE_CARD mutation for drag persistence
  const [updateCard] = useMutation<
    { updateCard: BackendCard },
    UpdateCardMutationVariables
  >(UPDATE_CARD, {
    // Error handling - log but don't crash UI
    onError: (error) => {
      console.error('Failed to update card position:', error);
    },
    // Update cache optimistically for smooth UX
    update: (cache, { data }) => {
      if (!data?.updateCard) return;

      // Update GET_CARDS_IN_BOUNDS cache
      try {
        const existingData = cache.readQuery({
          query: GET_CARDS_IN_BOUNDS,
          variables: queryVariables,
        });

        if (existingData) {
          cache.writeQuery({
            query: GET_CARDS_IN_BOUNDS,
            variables: queryVariables,
            data: {
              cardsInBounds: (existingData as { cardsInBounds: BackendCard[] }).cardsInBounds.map((card: BackendCard) =>
                card.id === data.updateCard.id ? data.updateCard : card
              ),
            },
          });
        }
      } catch (e) {
        // Cache miss is okay - card might not be in current bounds
        console.debug('Cache update skipped - card not in current bounds');
      }

      // Update GET_CARDS cache if it exists
      try {
        const cardsData = cache.readQuery({
          query: GET_CARDS,
          variables: { workspaceId: currentWorkspaceId },
        });

        if (cardsData) {
          cache.writeQuery({
            query: GET_CARDS,
            variables: { workspaceId: currentWorkspaceId },
            data: {
              cards: {
                ...(cardsData as { cards: { items: BackendCard[] } }).cards,
                items: (cardsData as { cards: { items: BackendCard[] } }).cards.items.map((card: BackendCard) =>
                  card.id === data.updateCard.id ? data.updateCard : card
                ),
              },
            },
          });
        }
      } catch (e) {
        // Cache miss is okay - not all cards may be loaded
        console.debug('GET_CARDS cache update skipped');
      }
    },
  });

  // Get visible cards from GraphQL response
  const visibleCards = useMemo((): Card[] => {
    if (loading && !cardsData) {
      return [];
    }

    if (error || !cardsData?.cardsInBounds) {
      // Log error but don't crash the UI
      if (error) {
        console.warn('Failed to load cards:', error);
      }
      return [];
    }

    // Transform backend GraphQL response to frontend Card type
    const cards = cardsData.cardsInBounds.map((backendCard: BackendCard): Card => {
      const baseCardProps = {
        id: backendCard.id as CardId,
        ownerId: backendCard.ownerId,
        position: {
          x: backendCard.position?.x ?? 0,
          y: backendCard.position?.y ?? 0,
          z: backendCard.position?.z ?? 0,
        },
        dimensions: backendCard.dimensions || { width: 200, height: 100 },
        style: {
          backgroundColor: '#FFFFFF',
          borderColor: '#E5E7EB',
          textColor: '#1F2937',
          borderWidth: 1,
          borderRadius: 8,
          opacity: 1,
          shadow: true,
          ...(backendCard.style as Record<string, unknown> || {}),
        },
        isSelected: false, // UI state, not from server
        isLocked: false,   // UI state, not from server
        isHidden: false,   // UI state, not from server
        isMinimized: false, // UI state, not from server
        status: (backendCard.status?.toLowerCase() || 'active') as 'draft' | 'active' | 'archived' | 'deleted',
        priority: (backendCard.priority?.toLowerCase() || 'normal') as 'low' | 'normal' | 'high' | 'urgent',
        createdAt: backendCard.createdAt || new Date().toISOString(),
        updatedAt: backendCard.updatedAt || new Date().toISOString(),
        tags: backendCard.tags || [],
        metadata: backendCard.metadata || {},
        animation: {
          isAnimating: false, // UI state, not from server
        },
      };

      // Create discriminated union based on backend type (using lowercase as per enum standard)
      const cardType = backendCard.type.toLowerCase();
      switch (cardType) {
        case 'text': {
          const textCard: Card = {
            ...baseCardProps,
            content: {
              type: 'text' as const,
              content: String(backendCard.content || ''),
              markdown: false,
              wordCount: String(backendCard.content || '').length,
              lastEditedAt: backendCard.updatedAt || new Date().toISOString(),
            },
          };
          return textCard;
        }

        case 'image': {
          const imageCard: Card = {
            ...baseCardProps,
            content: {
              type: 'image' as const,
              url: String(backendCard.content || ''),
              alt: String(backendCard.metadata?.alt || ''),
              caption: backendCard.title || '',
            },
          };
          return imageCard;
        }

        case 'link':
          try {
            const urlString = String(backendCard.content || 'https://example.com');
            const url = new URL(urlString);
            const linkCard: Card = {
              ...baseCardProps,
              content: {
                type: 'link' as const,
                url: urlString,
                title: backendCard.title || url.hostname,
                description: String(backendCard.metadata?.description || ''),
                domain: url.hostname,
                favicon: String(backendCard.metadata?.favicon || ''),
                previewImage: String(backendCard.metadata?.previewImage || ''),
                lastChecked: String(backendCard.metadata?.lastChecked || ''),
                isAccessible: true,
              },
            };
            return linkCard;
          } catch {
            const linkCard: Card = {
              ...baseCardProps,
              content: {
                type: 'link' as const,
                url: String(backendCard.content || ''),
                title: backendCard.title || 'Link',
                domain: '',
                isAccessible: false,
              },
            };
            return linkCard;
          }

        case 'code': {
          const codeCard: Card = {
            ...baseCardProps,
            content: {
              type: 'code' as const,
              language: String(backendCard.metadata?.language || 'text'),
              content: String(backendCard.content || ''),
              filename: String(backendCard.metadata?.filename || ''),
              lineCount: String(backendCard.content || '').split('\n').length,
              hasExecuted: false,
            },
          };
          return codeCard;
        }

        default: {
          const textCard: Card = {
            ...baseCardProps,
            content: {
              type: 'text' as const,
              content: String(backendCard.content || ''),
              markdown: false,
              wordCount: String(backendCard.content || '').length,
              lastEditedAt: backendCard.updatedAt || new Date().toISOString(),
            },
          };
          return textCard;
        }
      }
    });

    // Filter out hidden cards (UI state only, server doesn't track this)
    return cards.filter((card: Card) => !card.isHidden);
  }, [cardsData, loading, error]);

  // Sort cards by z-index for proper layering
  const sortedCards = useMemo((): Card[] => {
    return visibleCards.slice().sort((a, b) => {
      const aZ = a.position.z ?? 0;
      const bZ = b.position.z ?? 0;

      // Sort ascending so higher z values render on top
      return aZ - bZ;
    });
  }, [visibleCards]);

  // Drag end handler - persists position to server
  const handleCardDragEnd = useCallback((card: Card, e: KonvaEventObject<DragEvent>) => {
    // Get final position from Konva event
    const finalPosition = {
      x: e.target?.x() || 0,
      y: e.target?.y() || 0,
      z: card.position.z || 0,
    };

    // Check if position actually changed (avoid unnecessary updates)
    const positionChanged =
      finalPosition.x !== card.position.x ||
      finalPosition.y !== card.position.y;

    if (!positionChanged) {
      console.debug('Card position unchanged, skipping update');
      return;
    }

    // Call UPDATE_CARD mutation with new position
    updateCard({
      variables: {
        id: card.id,
        input: {
          position: finalPosition,
        },
      },
    }).catch((error) => {
      // Error already logged by onError handler
      console.error('Failed to persist card position:', error);
      // Note: Apollo cache will automatically rollback on error
    });
  }, [updateCard]);

  // Use ref to track card count for more efficient memoization
  const cardCountRef = useRef(sortedCards.length);
  const previousCardsRef = useRef<Card[]>([]);

  // Memoized card renderers with ref-based optimization
  const cardRenderers = useMemo(() => {
    const currentCount = sortedCards.length;
    const countChanged = cardCountRef.current !== currentCount;

    // Check if cards actually changed (not just reordered)
    const cardsChanged = countChanged ||
      sortedCards.some((card, index) => {
        const prevCard = previousCardsRef.current[index];
        return !prevCard || prevCard.id !== card.id;
      });

    // Update refs
    cardCountRef.current = currentCount;
    previousCardsRef.current = sortedCards;

    // Only recreate renderers if cards actually changed
    if (!cardsChanged && sortedCards.length > 0) {
      return sortedCards.map((card) => (
        <React.Suspense
          key={card.id}
          fallback={null}
        >
          <CardRenderer
            card={card}
            enableInlineEdit={true}
            onCardDragEnd={handleCardDragEnd}
          />
        </React.Suspense>
      ));
    }

    return sortedCards.map((card) => (
      <React.Suspense
        key={card.id}
        fallback={null}
      >
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          onCardDragEnd={handleCardDragEnd}
        />
      </React.Suspense>
    ));
  }, [sortedCards, handleCardDragEnd]);

  return (
    <Layer
      name="card-layer"
      listening={true}
      perfectDrawEnabled={false} // Performance optimization
    >
      {cardRenderers}
    </Layer>
  );
};

/**
 * Memoized CardLayer to prevent unnecessary re-renders
 */
export default React.memo(CardLayer);

// Debug utilities for development
export const CardLayerDebugInfo = {
  /**
   * Get debug information about the card layer
   */
  getDebugInfo: () => {
    // This would be called from a component with access to the stores
    return {
      performance: {
        renderingStrategy: 'viewport-culling',
        zIndexSorting: true,
        memoization: true,
        lazyLoading: true,
      },
    };
  },
};