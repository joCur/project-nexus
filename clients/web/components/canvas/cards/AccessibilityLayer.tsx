/**
 * AccessibilityLayer - Provides keyboard navigation and screen reader support for canvas cards
 *
 * Since Konva renders to Canvas which is not accessible, this component provides
 * an invisible DOM layer for keyboard navigation and screen reader support.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useCardStore } from '@/stores/cardStore';
import type { Card } from '@/types/card.types';
import { isTextCard, isImageCard, isLinkCard, isCodeCard } from '@/types/card.types';

interface AccessibilityLayerProps {
  cards: Card[];
  onCardFocus?: (card: Card) => void;
  onCardActivate?: (card: Card) => void;
}

export const AccessibilityLayer: React.FC<AccessibilityLayerProps> = ({
  cards,
  onCardFocus,
  onCardActivate,
}) => {
  const { selection, selectCard, clearSelection, selectCards } = useCardStore();
  const focusedIndexRef = useRef<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const focusedIndex = focusedIndexRef.current;

    switch (e.key) {
      case 'Tab':
        // Allow normal tab navigation
        break;

      case 'Enter':
      case ' ': // Space
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < cards.length) {
          const card = cards[focusedIndex];
          onCardActivate?.(card);

          // Toggle selection
          if (selection.selectedIds.has(card.id)) {
            // Deselect by clearing and re-selecting others
            const currentSelected = cards.filter(c => selection.selectedIds.has(c.id));
            const newSelection = currentSelected.filter(c => c.id !== card.id).map(c => c.id);
            selectCards(newSelection);
          } else {
            selectCard(card.id, e.ctrlKey || e.metaKey);
          }
        }
        break;

      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        e.preventDefault();
        navigateCards(e.key);
        break;

      case 'a':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Select all cards
          selectCards(cards.map(c => c.id));
        }
        break;

      case 'Escape':
        e.preventDefault();
        // Deselect all
        clearSelection();
        break;

      default:
        break;
    }
  }, [cards, selection, selectCard, clearSelection, selectCards, onCardActivate]);

  // Navigate between cards with arrow keys
  const navigateCards = useCallback((direction: string) => {
    const currentIndex = focusedIndexRef.current;
    let newIndex = currentIndex;

    // Calculate grid-based navigation
    const cols = Math.floor(Math.sqrt(cards.length)); // Approximate grid columns

    switch (direction) {
      case 'ArrowUp':
        newIndex = Math.max(0, currentIndex - cols);
        break;
      case 'ArrowDown':
        newIndex = Math.min(cards.length - 1, currentIndex + cols);
        break;
      case 'ArrowLeft':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        newIndex = Math.min(cards.length - 1, currentIndex + 1);
        break;
    }

    if (newIndex !== currentIndex && newIndex >= 0) {
      focusCard(newIndex);
    }
  }, [cards]);

  // Focus a specific card
  const focusCard = useCallback((index: number) => {
    if (index >= 0 && index < cards.length) {
      focusedIndexRef.current = index;
      const element = containerRef.current?.children[index] as HTMLElement;
      element?.focus();
      onCardFocus?.(cards[index]);
    }
  }, [cards, onCardFocus]);

  // Set up keyboard event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Get accessible label for card
  const getCardLabel = (card: Card): string => {
    const type = card.content.type;
    const selected = selection.selectedIds.has(card.id) ? 'selected' : '';
    const locked = card.isLocked ? 'locked' : '';

    let content = '';
    if (isTextCard(card)) {
      content = card.content.content?.substring(0, 50) || 'Empty text';
    } else if (isImageCard(card)) {
      content = card.content.alt || 'Image';
    } else if (isLinkCard(card)) {
      content = card.content.title || 'Link';
    } else if (isCodeCard(card)) {
      content = `Code in ${card.content.language || 'unknown language'}`;
    } else {
      content = 'Unknown card type';
    }

    return `${type} card: ${content} ${selected} ${locked}`.trim();
  };

  return (
    <div
      ref={containerRef}
      className="sr-only"
      role="application"
      aria-label="Canvas cards navigation"
      aria-description="Use arrow keys to navigate between cards, Enter or Space to select, Ctrl+A to select all, Escape to deselect all"
    >
      {cards.map((card, index) => (
        <button
          key={card.id}
          role="button"
          aria-label={getCardLabel(card)}
          aria-selected={selection.selectedIds.has(card.id)}
          aria-disabled={card.isLocked}
          tabIndex={index === 0 ? 0 : -1}
          onFocus={() => {
            focusedIndexRef.current = index;
            onCardFocus?.(card);
          }}
          onClick={(e) => {
            e.preventDefault();
            onCardActivate?.(card);
            selectCard(card.id, e.ctrlKey || e.metaKey);
          }}
          className="absolute opacity-0 pointer-events-none"
          style={{
            left: card.position.x,
            top: card.position.y,
            width: card.dimensions.width,
            height: card.dimensions.height,
          }}
        >
          {getCardLabel(card)}
        </button>
      ))}
    </div>
  );
};