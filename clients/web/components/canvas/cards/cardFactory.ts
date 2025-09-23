/**
 * Card Factory Utilities
 *
 * Provides factory functions for creating fallback cards to ensure
 * rendering continues even with missing or invalid data.
 * This is critical for error resilience as per NEX-192 requirements.
 */

import type { Card, TextCard, ImageCard, LinkCard, CodeCard } from '@/types/card.types';
import { createCardId } from '@/types/card.types';
import { isTextCard, isImageCard, isLinkCard, isCodeCard } from '@/types/card.types';

/**
 * Creates a fallback text card for error cases
 * Ensures cards always render even with missing data
 */
export const createFallbackTextCard = (baseCard: Partial<Card>): TextCard => {
  const now = new Date().toISOString();

  return {
    id: baseCard.id || createCardId('fallback-' + Date.now()),
    content: {
      type: 'text' as const,
      content: '[Error: Card content missing]',
      markdown: false,
      wordCount: 3,
      lastEditedAt: now,
    },
    position: baseCard.position || { x: 0, y: 0, z: 0 },
    dimensions: baseCard.dimensions || { width: 200, height: 150 },
    style: baseCard.style || {
      backgroundColor: '#FEF2F2',
      borderColor: '#FECACA',
      borderWidth: 1,
      borderRadius: 8,
      textColor: '#991B1B',
      opacity: 1,
      shadow: false,
    },
    isSelected: false,
    isLocked: baseCard.isLocked || false,
    isHidden: baseCard.isHidden || false,
    isMinimized: false,
    status: 'active',
    priority: 'normal',
    createdAt: baseCard.createdAt || now,
    updatedAt: now,
    tags: [],
    metadata: {},
    animation: {
      isAnimating: false,
    },
  } as TextCard;
};

/**
 * Validates if a card has valid content
 * Checks that required fields are present
 */
export const isValidCard = (card: Card | null | undefined): boolean => {
  if (!card || !card.content) return false;

  switch (card.content.type) {
    case 'text': {
      const content = card.content as any;
      return typeof content.content === 'string';
    }
    case 'image': {
      const content = card.content as any;
      return typeof content.url === 'string';
    }
    case 'link': {
      const content = card.content as any;
      return typeof content.url === 'string';
    }
    case 'code': {
      const content = card.content as any;
      return typeof content.language === 'string';
    }
    default:
      return false;
  }
};

/**
 * Gets an appropriate fallback card for error recovery
 * This ensures cards always render, even with invalid data
 */
export const getFallbackCard = (card: Partial<Card> | null | undefined): TextCard => {
  // Always return a text card as the safe fallback
  return createFallbackTextCard(card || {});
};

/**
 * Safely gets card type from content
 * Returns 'text' as default for invalid cards
 */
export const getCardType = (card: Card | null | undefined): 'text' | 'image' | 'link' | 'code' => {
  if (!card || !card.content) return 'text';
  return card.content.type;
};