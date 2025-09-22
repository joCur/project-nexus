/**
 * CardRenderer - Main orchestrator for rendering all card types
 *
 * This component determines the card type and delegates to specific renderers,
 * handles selection states, drag operations, and resize handles.
 */

import React from 'react';
import { Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  Card,
  TextCard,
} from '@/types/card.types';
import {
  isTextCard,
  isImageCard,
  isLinkCard,
  isCodeCard
} from '@/types/card.types';
import { useCardStore } from '@/stores/cardStore';
import { TextCardRenderer } from './TextCardRenderer';
import { ImageCardRenderer } from './ImageCardRenderer';
import { LinkCardRenderer } from './LinkCardRenderer';
import { CodeCardRenderer } from './CodeCardRenderer';

interface CardRendererProps {
  card: Card;
  /** Callback for card interactions */
  onCardClick?: (card: Card, e: KonvaEventObject<MouseEvent>) => void;
  onCardDragStart?: (card: Card, e: KonvaEventObject<DragEvent>) => void;
  onCardDragMove?: (card: Card, e: KonvaEventObject<DragEvent>) => void;
  onCardDragEnd?: (card: Card, e: KonvaEventObject<DragEvent>) => void;
  onCardDoubleClick?: (card: Card, e: KonvaEventObject<MouseEvent>) => void;
  onCardHover?: (card: Card, e: KonvaEventObject<MouseEvent>) => void;
  onCardUnhover?: (card: Card, e: KonvaEventObject<MouseEvent>) => void;
}

/**
 * CardRenderer component with memoization for performance
 */
export const CardRenderer = React.memo<CardRendererProps>(({
  card,
  onCardClick,
  onCardDragStart,
  onCardDragMove,
  onCardDragEnd,
  onCardDoubleClick,
  onCardHover,
  onCardUnhover,
}) => {
  const {
    selection,
    dragState,
    resizeState,
    hoverState,
    selectCard,
    startDrag,
    updateDrag,
    endDrag,
    setHoveredCard,
  } = useCardStore();

  // Determine card state
  const isSelected = selection.selectedIds.has(card.id);
  const isDragged = dragState.draggedIds.has(card.id);
  const isHovered = hoverState.hoveredId === card.id;

  // Suppress unused vars warning for now - these will be used for resize handles later
  void resizeState;

  // Don't render hidden cards
  if (card.isHidden) {
    return null;
  }

  // Handle click events
  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    selectCard(card.id, e.evt.ctrlKey || e.evt.metaKey);
    onCardClick?.(card, e);
  };

  // Handle double click events
  const handleDoubleClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onCardDoubleClick?.(card, e);
  };

  // Handle drag start
  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
    if (card.isLocked) return;

    const selectedIds = selection.selectedIds.has(card.id)
      ? Array.from(selection.selectedIds)
      : [card.id];

    startDrag(selectedIds, {
      x: e.target.x(),
      y: e.target.y(),
    });

    onCardDragStart?.(card, e);
  };

  // Handle drag move
  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    if (card.isLocked || !dragState.isDragging) return;

    const currentOffset = {
      x: e.target.x() - dragState.startPosition.x,
      y: e.target.y() - dragState.startPosition.y,
    };

    updateDrag(currentOffset);
    onCardDragMove?.(card, e);
  };

  // Handle drag end
  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    if (card.isLocked) return;

    endDrag({
      x: e.target.x(),
      y: e.target.y(),
    });

    onCardDragEnd?.(card, e);
  };

  // Handle mouse enter
  const handleMouseEnter = (e: KonvaEventObject<MouseEvent>) => {
    setHoveredCard(card.id);
    onCardHover?.(card, e);
  };

  // Handle mouse leave
  const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
    setHoveredCard(undefined);
    onCardUnhover?.(card, e);
  };

  // Render specific card type
  const renderCardContent = () => {
    if (isTextCard(card)) {
      return (
        <TextCardRenderer
          card={card}
          isSelected={isSelected}
          isDragged={isDragged}
          isHovered={isHovered}
        />
      );
    }

    if (isImageCard(card)) {
      return (
        <ImageCardRenderer
          card={card}
          isSelected={isSelected}
          isDragged={isDragged}
          isHovered={isHovered}
        />
      );
    }

    if (isLinkCard(card)) {
      return (
        <LinkCardRenderer
          card={card}
          isSelected={isSelected}
          isDragged={isDragged}
          isHovered={isHovered}
        />
      );
    }

    if (isCodeCard(card)) {
      return (
        <CodeCardRenderer
          card={card}
          isSelected={isSelected}
          isDragged={isDragged}
          isHovered={isHovered}
        />
      );
    }

    // Fallback to text renderer for unknown types
    return (
      <TextCardRenderer
        card={card as TextCard}
        isSelected={isSelected}
        isDragged={isDragged}
        isHovered={isHovered}
      />
    );
  };

  return (
    <Group
      x={card.position.x}
      y={card.position.y}
      draggable={!card.isLocked}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      opacity={card.style.opacity}
      listening={!card.isLocked}
    >
      {renderCardContent()}
    </Group>
  );
});

CardRenderer.displayName = 'CardRenderer';