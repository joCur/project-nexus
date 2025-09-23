/**
 * Card Factory Utilities
 *
 * Provides factory functions for creating cards and handling fallbacks
 * with proper type safety and error resilience.
 */

import type { Card, TextCard, ImageCard, LinkCard, CodeCard, CardStatus, CardPriority } from '@/types/card.types';
import { createCardId } from '@/types/card.types';

/**
 * Creates a fallback text card for error cases
 * Ensures type safety without type assertions
 */
export const createFallbackTextCard = (baseCard: Partial<TextCard>): TextCard => {
  return {
    id: baseCard.id || createCardId('fallback-' + Date.now()),
    position: baseCard.position || { x: 0, y: 0, z: 0 },
    dimensions: baseCard.dimensions || { width: 200, height: 150 },
    content: {
      type: 'text' as const,
      content: '[Error: Card content missing]',
      markdown: false,
      wordCount: 3,
    },
    style: baseCard.style || {
      backgroundColor: '#FEF2F2',
      borderColor: '#FECACA',
      borderWidth: 1,
      borderRadius: 8,
      textColor: '#991B1B',
      opacity: 1,
      shadow: false,
    },
    metadata: {
      ...baseCard.metadata,
      createdAt: baseCard.metadata?.createdAt || Date.now(),
      updatedAt: Date.now(),
      tags: baseCard.metadata?.tags || [],
    },
    isLocked: baseCard.isLocked || false,
    isHidden: baseCard.isHidden || false,
  };
};

/**
 * Creates a placeholder image card for loading states
 */
export const createPlaceholderImageCard = (baseCard: Partial<Card>): ImageCard => {
  return {
    id: baseCard.id || 'placeholder-img-' + Date.now(),
    type: 'image' as const,
    position: baseCard.position || { x: 0, y: 0, z: 0 },
    dimensions: baseCard.dimensions || { width: 300, height: 200 },
    content: {
      type: 'image' as const,
      url: '',
      alt: 'Loading image...',
      caption: '',
    },
    style: baseCard.style || {
      backgroundColor: '#F9FAFB',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      borderRadius: 8,
      textColor: '#6B7280',
      opacity: 1,
      shadow: false,
    },
    metadata: {
      ...baseCard.metadata,
      createdAt: baseCard.metadata?.createdAt || Date.now(),
      updatedAt: Date.now(),
      tags: baseCard.metadata?.tags || [],
    },
    isLocked: baseCard.isLocked || false,
    isHidden: baseCard.isHidden || false,
  };
};

/**
 * Creates a placeholder link card for loading states
 */
export const createPlaceholderLinkCard = (baseCard: Partial<Card>): LinkCard => {
  return {
    id: baseCard.id || 'placeholder-link-' + Date.now(),
    type: 'link' as const,
    position: baseCard.position || { x: 0, y: 0, z: 0 },
    dimensions: baseCard.dimensions || { width: 280, height: 180 },
    content: {
      type: 'link' as const,
      url: '',
      title: 'Loading...',
      description: '',
      domain: '',
      isAccessible: false,
    },
    style: baseCard.style || {
      backgroundColor: '#F9FAFB',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      borderRadius: 8,
      textColor: '#6B7280',
      opacity: 1,
      shadow: false,
    },
    metadata: {
      ...baseCard.metadata,
      createdAt: baseCard.metadata?.createdAt || Date.now(),
      updatedAt: Date.now(),
      tags: baseCard.metadata?.tags || [],
    },
    isLocked: baseCard.isLocked || false,
    isHidden: baseCard.isHidden || false,
  };
};

/**
 * Creates a placeholder code card for loading states
 */
export const createPlaceholderCodeCard = (baseCard: Partial<Card>): CodeCard => {
  return {
    id: baseCard.id || 'placeholder-code-' + Date.now(),
    type: 'code' as const,
    position: baseCard.position || { x: 0, y: 0, z: 0 },
    dimensions: baseCard.dimensions || { width: 400, height: 300 },
    content: {
      type: 'code' as const,
      code: '// Loading...',
      language: 'plaintext',
      filename: undefined,
      lineCount: 1,
    },
    style: baseCard.style || {
      backgroundColor: '#1F2937',
      borderColor: '#374151',
      borderWidth: 1,
      borderRadius: 8,
      textColor: '#E5E7EB',
      opacity: 1,
      shadow: false,
    },
    metadata: {
      ...baseCard.metadata,
      createdAt: baseCard.metadata?.createdAt || Date.now(),
      updatedAt: Date.now(),
      tags: baseCard.metadata?.tags || [],
    },
    isLocked: baseCard.isLocked || false,
    isHidden: baseCard.isHidden || false,
  };
};

/**
 * Validates if a card has valid content
 */
export const isValidCard = (card: Card): boolean => {
  if (!card || !card.content) return false;

  switch (card.type) {
    case 'text':
      return typeof (card.content as any).content === 'string';
    case 'image':
      return typeof (card.content as any).url === 'string';
    case 'link':
      return typeof (card.content as any).url === 'string';
    case 'code':
      return typeof (card.content as any).code === 'string';
    default:
      return false;
  }
};

/**
 * Gets an appropriate fallback card based on card type
 */
export const getFallbackCard = (card: Partial<Card>): Card => {
  const type = card.type || 'text';

  switch (type) {
    case 'image':
      return createPlaceholderImageCard(card);
    case 'link':
      return createPlaceholderLinkCard(card);
    case 'code':
      return createPlaceholderCodeCard(card);
    case 'text':
    default:
      return createFallbackTextCard(card);
  }
};