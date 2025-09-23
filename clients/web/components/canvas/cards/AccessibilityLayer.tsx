/**
 * AccessibilityLayer - Provides keyboard navigation and screen reader support for canvas cards
 *
 * Since Konva renders to Canvas which is not accessible, this component provides
 * an invisible DOM layer for keyboard navigation and screen reader support.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useCardStore } from '@/stores/cardStore';
import type { Card } from '@/types/card.types';

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
  const { selectedCards, selectCard, deselectCard, setSelectedCards } = useCardStore();
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
          if (selectedCards.has(card.id)) {
            deselectCard(card.id);
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
          setSelectedCards(new Set(cards.map(c => c.id)));
        }
        break;

      case 'Escape':
        e.preventDefault();
        // Deselect all
        setSelectedCards(new Set());
        break;

      default:
        break;
    }
  }, [cards, selectedCards, selectCard, deselectCard, setSelectedCards, onCardActivate]);

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
    const type = card.type;
    const selected = selectedCards.has(card.id) ? 'selected' : '';
    const locked = card.isLocked ? 'locked' : '';

    let content = '';
    switch (card.type) {
      case 'text':
        content = (card.content as any).content?.substring(0, 50) || 'Empty text';
        break;
      case 'image':
        content = (card.content as any).alt || 'Image';
        break;
      case 'link':
        content = (card.content as any).title || 'Link';
        break;
      case 'code':
        content = `Code in ${(card.content as any).language || 'unknown language'}`;
        break;
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
          aria-selected={selectedCards.has(card.id)}
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