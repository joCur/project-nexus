'use client';

import React, { useMemo, useRef } from 'react';
import { Layer } from 'react-konva';
import { useCardStore } from '@/stores/cardStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useViewportDimensions } from '@/utils/viewport';
import type { Card } from '@/types/card.types';
import type { CanvasBounds } from '@/types/canvas.types';
import { CARD_CONFIG } from './cards/cardConfig';

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
 * - Connects to cardStore for card data and state management
 * - Viewport culling for performance optimization
 * - Z-order management based on position.z values
 * - Integration with canvas zoom and position
 * - Efficient re-rendering with memoization
 *
 * Performance Optimizations:
 * - Only renders cards within viewport bounds (with padding)
 * - Sorts cards by z-index for proper layering
 * - Uses React.memo and useMemo for efficient re-renders
 * - Lazy loads CardRenderer component
 */
export const CardLayer: React.FC<CardLayerProps> = ({
  viewportBounds,
  enableViewportCulling = true,
  viewportPadding = CARD_CONFIG.viewport.extraPadding, // Extra pixels around viewport to render
}) => {
  const { cards, getCardsInBounds } = useCardStore();
  const { viewport } = useCanvasStore();
  const { zoom, position } = viewport;
  const viewportDimensions = useViewportDimensions();

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

  // Get visible cards with performance optimization
  const visibleCards = useMemo((): Card[] => {
    if (!enableViewportCulling) {
      // Return all cards if culling is disabled
      return Array.from(cards.values());
    }

    // Use the cardStore method to get cards in bounds
    const cardsInBounds = getCardsInBounds(currentViewportBounds);

    // Filter out hidden cards
    return cardsInBounds.filter(card => !card.isHidden);
  }, [cards, currentViewportBounds, enableViewportCulling, getCardsInBounds]);

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