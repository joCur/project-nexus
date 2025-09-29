/**
 * CardRenderer - Main orchestrator for rendering all card types
 *
 * This component determines the card type and delegates to specific renderers,
 * handles selection states, drag operations, resize handles, and edit mode.
 */

import React, { useCallback, useState, useMemo } from 'react';
import { Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  Card,
  TextCard,
  CardId,
} from '@/types/card.types';
import {
  isTextCard,
  isImageCard,
  isLinkCard,
  isCodeCard
} from '@/types/card.types';
import { useCardStore } from '@/stores/cardStore';
import { EditModeManager, useEditMode, type EditMode } from '@/components/canvas/editing';
import { TextCardRenderer } from './TextCardRenderer';
import { ImageCardRenderer } from './ImageCardRenderer';
import { LinkCardRenderer } from './LinkCardRenderer';
import { CodeCardRenderer } from './CodeCardRenderer';
import { isValidCard, getFallbackCard } from './cardFactory';

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
  /** Callback when entering edit mode */
  onEditStart?: (cardId: string, mode: EditMode) => void;
  /** Callback when saving edits */
  onEditEnd?: (cardId: string, content: unknown) => void;
  /** Callback when canceling edits */
  onEditCancel?: (cardId: string) => void;
  /** Whether inline editing is enabled */
  enableInlineEdit?: boolean;
  /** Whether this specific card is currently being edited */
  isEditingCard?: boolean;
  /** Callback to clear selection when entering edit mode */
  onClearSelection?: () => void;
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
  onEditStart,
  onEditEnd,
  onEditCancel,
  enableInlineEdit = false,
  isEditingCard = false,
  onClearSelection,
}) => {
  const {
    selection,
    dragState,
    hoverState,
    // Note: resizeState will be used in future for resize handles implementation
    // resizeState,
    selectCard,
    startDrag,
    updateDrag,
    endDrag,
    setHoveredCard,
    // editingCardId, // Will be used in future for global edit state coordination
    setEditingCard,
    clearEditingCard,
  } = useCardStore();

  // Use the edit mode hook from EditModeManager
  const { editState, startEdit, endEdit } = useEditMode();

  // State for managing local edit mode
  // const [isLocallyEditing, setIsLocallyEditing] = useState(false); // Will be used when full edit state coordination is implemented

  // Determine card state with safe checks
  const isSelected = card?.id && selection?.selectedIds?.has(card.id) || false;
  const isDragged = card?.id && dragState?.draggedIds?.has(card.id) || false;
  const isHovered = card?.id && hoverState?.hoveredId === card.id || false;

  // Check if this card is currently being edited
  const isInEditMode = useMemo(() => {
    return (enableInlineEdit && (isEditingCard || (editState.isEditing && editState.editingCardId === card.id))) || false;
  }, [enableInlineEdit, isEditingCard, editState.isEditing, editState.editingCardId, card.id]);

  // Handle click events
  const handleClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;

    // Don't allow selection changes during edit mode
    if (isInEditMode) {
      return;
    }

    selectCard(card.id, e.evt.ctrlKey || e.evt.metaKey);
    onCardClick?.(card, e);
  }, [card, selectCard, onCardClick, isInEditMode]);

  // Handle double click events
  const handleDoubleClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;

    // If inline editing is enabled, trigger edit mode instead of callback
    if (enableInlineEdit && !card.isLocked) {
      // Clear selection when entering edit mode
      onClearSelection?.();

      // setIsLocallyEditing(true); // Will be used when full edit state coordination is implemented
      setEditingCard?.(card.id);

      // Determine edit mode based on card type
      const editMode = card.content.type === 'text' ? 'text' :
                      card.content.type === 'code' ? 'code' :
                      card.content.type === 'link' ? 'link' :
                      card.content.type === 'image' ? 'image-caption' : 'metadata';

      startEdit(card.id, editMode, card.content);
      onEditStart?.(card.id, editMode as EditMode);
    } else {
      onCardDoubleClick?.(card, e);
    }
  }, [card, onCardDoubleClick, enableInlineEdit, onEditStart, onClearSelection, startEdit, setEditingCard]);

  // Handle drag start
  const handleDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (card?.isLocked || isInEditMode) return;

    // Prevent Stage drag when dragging cards
    e.cancelBubble = true;

    const selectedIds = selection?.selectedIds?.has(card.id)
      ? Array.from(selection.selectedIds)
      : [card.id];

    const startPosition = {
      x: card.position.x,
      y: card.position.y,
      z: card.position.z || 0,
    };

    startDrag(selectedIds, startPosition);
    onCardDragStart?.(card, e);
  }, [card, selection?.selectedIds, startDrag, onCardDragStart, isInEditMode]);

  // Handle drag move
  const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (card?.isLocked || !dragState?.isDragging || !dragState?.startPosition) return;

    // Prevent Stage drag during card drag
    e.cancelBubble = true;

    const currentOffset = {
      x: (e.target?.x() || 0) - dragState.startPosition.x,
      y: (e.target?.y() || 0) - dragState.startPosition.y,
    };

    updateDrag(currentOffset);
    onCardDragMove?.(card, e);
  }, [card, dragState?.isDragging, dragState?.startPosition, updateDrag, onCardDragMove]);

  // Handle drag end
  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    if (card?.isLocked) return;

    // Prevent Stage drag during card drag
    e.cancelBubble = true;

    // Get final position from Konva
    const finalPosition = {
      x: e.target?.x() || 0,
      y: e.target?.y() || 0,
      z: card.position.z || 0,
    };

    endDrag(finalPosition);
    onCardDragEnd?.(card, e);
  }, [card, endDrag, onCardDragEnd]);

  // Handle mouse enter
  const handleMouseEnter = useCallback((e: KonvaEventObject<MouseEvent>) => {
    // Don't trigger hover effects during edit mode
    if (isInEditMode) return;

    setHoveredCard(card.id);
    onCardHover?.(card, e);
  }, [card, setHoveredCard, onCardHover, isInEditMode]);

  // Handle mouse leave
  const handleMouseLeave = useCallback((e: KonvaEventObject<MouseEvent>) => {
    setHoveredCard(undefined);
    onCardUnhover?.(card, e);
  }, [card, setHoveredCard, onCardUnhover]);

  // Handle edit mode callbacks
  const handleEditStart = useCallback((cardId: string, mode: EditMode) => {
    // Clear selection when entering edit mode
    onClearSelection?.();
    // setIsLocallyEditing(true); // Will be used when full edit state coordination is implemented
    setEditingCard?.(cardId as CardId);
    startEdit(cardId as CardId, mode, card.content);
    onEditStart?.(cardId, mode);
  }, [onEditStart, onClearSelection, startEdit, setEditingCard, card.content]);

  const handleEditEnd = useCallback((cardId: string, content: unknown) => {
    // setIsLocallyEditing(false); // Will be used when full edit state coordination is implemented
    clearEditingCard?.();
    endEdit();
    onEditEnd?.(cardId, content);
  }, [onEditEnd, endEdit, clearEditingCard]);

  const handleEditCancel = useCallback((cardId: string) => {
    // setIsLocallyEditing(false); // Will be used when full edit state coordination is implemented
    clearEditingCard?.();
    endEdit();
    onEditCancel?.(cardId);
  }, [onEditCancel, endEdit, clearEditingCard]);

  // Don't render if card is invalid or hidden
  if (!card || !card.id || card.isHidden) {
    return null;
  }

  // Render specific card type
  const renderCardContent = () => {
    // Handle invalid or missing content gracefully with fallback
    // This ensures cards always render, meeting NEX-192 error recovery requirements
    if (!isValidCard(card)) {
      const fallbackCard = getFallbackCard(card);
      return (
        <TextCardRenderer
          card={fallbackCard}
          isSelected={isSelected}
          isDragged={isDragged}
          isHovered={isHovered}
        />
      );
    }

    if (isTextCard(card)) {
      return (
        <TextCardRenderer
          card={card}
          isSelected={isSelected}
          isDragged={isDragged}
          isHovered={isHovered}
          isEditing={isInEditMode}
          onStartEdit={() => handleDoubleClick({ cancelBubble: false, evt: {} } as any)}
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
    // This cast is safe as TextCardRenderer can handle any card type with content
    return (
      <TextCardRenderer
        card={card as TextCard}
        isSelected={isSelected}
        isDragged={isDragged}
        isHovered={isHovered}
      />
    );
  };

  // Wrap with EditModeManager if inline editing is enabled
  const cardContent = renderCardContent();

  const groupContent = (
    <Group
      x={card.position?.x ?? 0}
      y={card.position?.y ?? 0}
      draggable={!card.isLocked && !isInEditMode}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      opacity={card.style?.opacity ?? 1}
      listening={!card.isLocked && !isInEditMode}
    >
      {cardContent}
    </Group>
  );

  // If inline editing is enabled, wrap with EditModeManager
  if (enableInlineEdit) {
    return (
      <EditModeManager
        card={card}
        onEditStart={handleEditStart}
        onEditEnd={handleEditEnd}
        onEditCancel={handleEditCancel}
        canEdit={!card.isLocked}
        className="card-edit-wrapper"
      >
        {groupContent}
      </EditModeManager>
    );
  }

  return groupContent;
});

CardRenderer.displayName = 'CardRenderer';