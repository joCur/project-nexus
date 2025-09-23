/**
 * CardEditingManager - Manages inline editing state and overlays for the canvas
 *
 * This component sits alongside the canvas and manages HTML editing overlays
 * that are positioned over the Konva canvas cards.
 */

'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useCardStore } from '@/stores/cardStore';
import { useCanvasStore } from '@/stores/canvasStore';
import type { Card, CardId } from '@/types/card.types';
import { CardEditOverlay } from '@/components/cards/CardEditOverlay';

interface CardEditingManagerProps {
  /** Container element that holds the canvas */
  canvasContainer: HTMLElement | null;
  /** Whether editing is enabled */
  enableEditing?: boolean;
  /** CSS class for the overlay container */
  className?: string;
}

/**
 * Custom hook to manage card editing state
 */
export const useCardEditing = () => {
  const [editingCardId, setEditingCardId] = useState<CardId | null>(null);

  const startEditing = useCallback((cardId: CardId) => {
    setEditingCardId(cardId);
  }, []);

  const stopEditing = useCallback(() => {
    setEditingCardId(null);
  }, []);

  return {
    editingCardId,
    isEditing: editingCardId !== null,
    startEditing,
    stopEditing,
  };
};

/**
 * CardEditingManager component
 */
export const CardEditingManager: React.FC<CardEditingManagerProps> = ({
  canvasContainer,
  enableEditing = true,
  className = '',
}) => {
  const { cards } = useCardStore();
  const { viewport } = useCanvasStore();
  const { zoom, position } = viewport;
  const { editingCardId, isEditing, startEditing, stopEditing } = useCardEditing();

  // Get the card being edited
  const editingCard = editingCardId ? cards.get(editingCardId) : null;

  // Calculate overlay position accounting for canvas transform
  const overlayPosition = useMemo(() => {
    if (!editingCard || !canvasContainer) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    // Get canvas container bounds
    const containerRect = canvasContainer.getBoundingClientRect();

    // Convert world coordinates to screen coordinates within the container
    const screenX = editingCard.position.x * zoom + position.x;
    const screenY = editingCard.position.y * zoom + position.y;
    const screenWidth = editingCard.dimensions.width * zoom;
    const screenHeight = editingCard.dimensions.height * zoom;

    return {
      x: screenX,
      y: screenY,
      width: screenWidth,
      height: screenHeight,
    };
  }, [editingCard, canvasContainer, zoom, position.x, position.y]);

  // Handle edit completion
  const handleEditComplete = useCallback((card: Card) => {
    stopEditing();
  }, [stopEditing]);

  // Handle edit cancellation
  const handleEditCancel = useCallback((card: Card) => {
    stopEditing();
  }, [stopEditing]);

  // Expose editing functions globally for CardRenderer to use
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__cardEditingManager = {
        startEditing,
        stopEditing,
        isEditing: editingCardId !== null,
        editingCardId,
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__cardEditingManager;
      }
    };
  }, [startEditing, stopEditing, editingCardId]);

  // Don't render if editing is disabled or no container
  if (!enableEditing || !canvasContainer || !isEditing || !editingCard) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        zIndex: 1000, // Ensure it's above the canvas
      }}
    >
      <div
        className="absolute pointer-events-auto"
        style={{
          left: overlayPosition.x,
          top: overlayPosition.y,
          width: overlayPosition.width,
          height: overlayPosition.height,
        }}
      >
        <CardEditOverlay
          card={editingCard}
          isEditing={true}
          containerElement={canvasContainer}
          onEditComplete={handleEditComplete}
          onEditCancel={handleEditCancel}
        />
      </div>
    </div>
  );
};

export default CardEditingManager;