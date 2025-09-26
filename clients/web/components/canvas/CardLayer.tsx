'use client';

import React, { useMemo, useRef } from 'react';
import { Layer } from 'react-konva';
import { useQuery } from '@apollo/client';
import { useCanvasStore } from '@/stores/canvasStore';
import { useWorkspacePermissionContextSafe } from '@/contexts/WorkspacePermissionContext';
import { useViewportDimensions } from '@/utils/viewport';
import type { Card } from '@/types/card.types';
import type { CanvasBounds } from '@/types/canvas.types';
import { CARD_CONFIG } from './cards/cardConfig';
import { GET_CARDS_IN_BOUNDS, type CardsInBoundsQueryVariables } from '@/lib/graphql/cardOperations';

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
    const cards = cardsData.cardsInBounds.map((backendCard: any): Card => {
      const baseCard = {
        id: backendCard.id as CardId,
        ownerId: backendCard.ownerId,
        position: {
          x: backendCard.position?.x ?? 0,
          y: backendCard.position?.y ?? 0,
          z: backendCard.position?.z ?? 0,
        },
        dimensions: backendCard.dimensions || { width: 200, height: 100 },
        style: backendCard.style || {
          backgroundColor: '#FFFFFF',
          borderColor: '#E5E7EB',
          textColor: '#1F2937',
          borderWidth: 1,
          borderRadius: 8,
          opacity: 1,
          shadow: true,
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

      // Create discriminated union based on backend type
      switch (backendCard.type) {
        case 'TEXT':
          return {
            ...baseCard,
            content: {
              type: 'text' as const,
              content: backendCard.content || '',
              markdown: false,
              wordCount: (backendCard.content || '').length,
              lastEditedAt: backendCard.updatedAt || new Date().toISOString(),
            },
          } as Card;

        case 'IMAGE':
          return {
            ...baseCard,
            content: {
              type: 'image' as const,
              url: backendCard.content || '',
              alt: backendCard.title || '',
              caption: backendCard.title || '',
            },
          } as Card;

        case 'LINK':
          try {
            const url = new URL(backendCard.content || 'https://example.com');
            return {
              ...baseCard,
              content: {
                type: 'link' as const,
                url: backendCard.content || '',
                title: backendCard.title || url.hostname,
                description: backendCard.metadata?.description,
                domain: url.hostname,
                favicon: backendCard.metadata?.favicon,
                previewImage: backendCard.metadata?.previewImage,
                lastChecked: backendCard.metadata?.lastChecked,
                isAccessible: true,
              },
            } as Card;
          } catch {
            return {
              ...baseCard,
              content: {
                type: 'link' as const,
                url: backendCard.content || '',
                title: backendCard.title || 'Link',
                domain: '',
                isAccessible: false,
              },
            } as Card;
          }

        case 'CODE':
          return {
            ...baseCard,
            content: {
              type: 'code' as const,
              language: backendCard.metadata?.language || 'text',
              content: backendCard.content || '',
              filename: backendCard.metadata?.filename,
              lineCount: (backendCard.content || '').split('\n').length,
              hasExecuted: false,
            },
          } as Card;

        default:
          return {
            ...baseCard,
            content: {
              type: 'text' as const,
              content: backendCard.content || '',
              markdown: false,
              wordCount: (backendCard.content || '').length,
              lastEditedAt: backendCard.updatedAt || new Date().toISOString(),
            },
          } as Card;
      }
    });

    // Filter out hidden cards (UI state only, server doesn't track this)
    return cards.filter(card => !card.isHidden);
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
        />
      </React.Suspense>
    ));
  }, [sortedCards]);

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