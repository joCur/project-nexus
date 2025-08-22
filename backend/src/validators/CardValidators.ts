/**
 * Card validation schemas and utilities
 * Implements comprehensive validation for card operations
 */

import { z } from 'zod';
import { 
  CardType, 
  CardStatus, 
  CardPosition, 
  CardDimensions, 
  CreateCardInput, 
  UpdateCardInput,
  CardFilter,
  CardPositionUpdate,
  BatchCardUpdate,
  ImportCardData,
  CardConstraints
} from '@/types/CardTypes';

// Base validation schemas
const cardTypeSchema = z.nativeEnum(CardType);

const cardStatusSchema = z.nativeEnum(CardStatus);

const cardPositionSchema = z.object({
  x: z.number()
    .min(CardConstraints.POSITION_MIN, `X position must be >= ${CardConstraints.POSITION_MIN}`)
    .max(CardConstraints.POSITION_MAX, `X position must be <= ${CardConstraints.POSITION_MAX}`),
  y: z.number()
    .min(CardConstraints.POSITION_MIN, `Y position must be >= ${CardConstraints.POSITION_MIN}`)
    .max(CardConstraints.POSITION_MAX, `Y position must be <= ${CardConstraints.POSITION_MAX}`),
  z: z.number()
    .min(0, 'Z position must be >= 0')
    .max(1000, 'Z position must be <= 1000')
    .int('Z position must be an integer'),
});

const cardDimensionsSchema = z.object({
  width: z.number()
    .min(CardConstraints.DIMENSIONS_MIN_WIDTH, `Width must be >= ${CardConstraints.DIMENSIONS_MIN_WIDTH}`)
    .max(CardConstraints.DIMENSIONS_MAX_WIDTH, `Width must be <= ${CardConstraints.DIMENSIONS_MAX_WIDTH}`),
  height: z.number()
    .min(CardConstraints.DIMENSIONS_MIN_HEIGHT, `Height must be >= ${CardConstraints.DIMENSIONS_MIN_HEIGHT}`)
    .max(CardConstraints.DIMENSIONS_MAX_HEIGHT, `Height must be <= ${CardConstraints.DIMENSIONS_MAX_HEIGHT}`),
});

const cardMetadataSchema = z.record(z.any()).refine(
  (metadata) => {
    const jsonString = JSON.stringify(metadata);
    return jsonString.length <= 10000; // 10KB limit for metadata
  },
  { message: 'Metadata size must be <= 10KB' }
);

const tagsSchema = z.array(
  z.string()
    .min(1, 'Tag cannot be empty')
    .max(CardConstraints.TAG_MAX_LENGTH, `Tag must be <= ${CardConstraints.TAG_MAX_LENGTH} characters`)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Tag can only contain letters, numbers, underscores, and hyphens')
).max(CardConstraints.TAGS_MAX_COUNT, `Maximum ${CardConstraints.TAGS_MAX_COUNT} tags allowed`);

// Content validation by card type
const contentValidationByType = {
  TEXT: z.string()
    .min(1, 'Text content cannot be empty')
    .max(CardConstraints.CONTENT_MAX_LENGTH, `Content must be <= ${CardConstraints.CONTENT_MAX_LENGTH} characters`),
  
  IMAGE: z.string()
    .url('Image content must be a valid URL')
    .or(z.string().startsWith('data:image/', 'Must be a valid image URL or data URI')),
  
  LINK: z.string()
    .url('Link content must be a valid URL'),
  
  CODE: z.string()
    .min(1, 'Code content cannot be empty')
    .max(CardConstraints.CONTENT_MAX_LENGTH, `Code content must be <= ${CardConstraints.CONTENT_MAX_LENGTH} characters`),
  
  FILE: z.string()
    .url('File content must be a valid URL')
    .or(z.string().startsWith('data:', 'Must be a valid file URL or data URI')),
  
  DRAWING: z.string()
    .min(1, 'Drawing content cannot be empty')
    .refine(
      (content) => {
        try {
          JSON.parse(content);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Drawing content must be valid JSON' }
    ),
};

// Main validation schemas
export const createCardSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID format'),
  type: cardTypeSchema,
  title: z.string()
    .max(CardConstraints.TITLE_MAX_LENGTH, `Title must be <= ${CardConstraints.TITLE_MAX_LENGTH} characters`)
    .optional(),
  content: z.string(),
  position: cardPositionSchema,
  dimensions: cardDimensionsSchema,
  metadata: cardMetadataSchema.optional().default({}),
  tags: tagsSchema.optional().default([]),
}).refine(
  (data) => {
    const contentValidator = contentValidationByType[data.type];
    return contentValidator.safeParse(data.content).success;
  },
  {
    message: 'Content format is invalid for the specified card type',
    path: ['content'],
  }
);

export const updateCardSchema = z.object({
  title: z.string()
    .max(CardConstraints.TITLE_MAX_LENGTH, `Title must be <= ${CardConstraints.TITLE_MAX_LENGTH} characters`)
    .optional(),
  content: z.string().optional(),
  position: cardPositionSchema.optional(),
  dimensions: cardDimensionsSchema.optional(),
  metadata: cardMetadataSchema.optional(),
  tags: tagsSchema.optional(),
  status: cardStatusSchema.optional(),
});

export const cardFilterSchema = z.object({
  type: z.union([cardTypeSchema, z.array(cardTypeSchema)]).optional(),
  status: z.union([cardStatusSchema, z.array(cardStatusSchema)]).optional(),
  tags: z.array(z.string()).optional(),
  createdBy: z.string().uuid('Invalid creator ID format').optional(),
  lastModifiedBy: z.string().uuid('Invalid modifier ID format').optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  updatedAfter: z.date().optional(),
  updatedBefore: z.date().optional(),
  searchTerm: z.string().min(1).max(100).optional(),
  boundingBox: z.object({
    minX: z.number(),
    minY: z.number(),
    maxX: z.number(),
    maxY: z.number(),
  }).refine(
    (box) => box.minX < box.maxX && box.minY < box.maxY,
    { message: 'Invalid bounding box: min values must be less than max values' }
  ).optional(),
}).refine(
  (filter) => {
    if (filter.createdAfter && filter.createdBefore) {
      return filter.createdAfter < filter.createdBefore;
    }
    return true;
  },
  { message: 'createdAfter must be before createdBefore' }
).refine(
  (filter) => {
    if (filter.updatedAfter && filter.updatedBefore) {
      return filter.updatedAfter < filter.updatedBefore;
    }
    return true;
  },
  { message: 'updatedAfter must be before updatedBefore' }
);

// Batch operation schemas
export const cardPositionUpdateSchema = z.object({
  cardId: z.string().uuid('Invalid card ID format'),
  position: cardPositionSchema,
  version: z.number().min(CardConstraints.VERSION_MIN, 'Version must be >= 1').int(),
});

export const batchCardUpdateSchema = z.object({
  cardId: z.string().uuid('Invalid card ID format'),
  updates: updateCardSchema,
  version: z.number().min(CardConstraints.VERSION_MIN, 'Version must be >= 1').int(),
});

export const importCardDataSchema = z.object({
  type: cardTypeSchema,
  title: z.string()
    .max(CardConstraints.TITLE_MAX_LENGTH, `Title must be <= ${CardConstraints.TITLE_MAX_LENGTH} characters`)
    .optional(),
  content: z.string(),
  position: cardPositionSchema,
  dimensions: cardDimensionsSchema,
  metadata: cardMetadataSchema.optional().default({}),
  tags: tagsSchema.optional().default([]),
}).refine(
  (data) => {
    const contentValidator = contentValidationByType[data.type];
    return contentValidator.safeParse(data.content).success;
  },
  {
    message: 'Content format is invalid for the specified card type',
    path: ['content'],
  }
);

// Batch validation schemas
export const batchPositionUpdateSchema = z.array(cardPositionUpdateSchema)
  .min(1, 'At least one position update required')
  .max(100, 'Maximum 100 position updates per batch');

export const batchCardUpdateArraySchema = z.array(batchCardUpdateSchema)
  .min(1, 'At least one card update required')
  .max(50, 'Maximum 50 card updates per batch');

export const importCardsSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID format'),
  cards: z.array(importCardDataSchema)
    .min(1, 'At least one card required for import')
    .max(100, 'Maximum 100 cards per import batch'),
});

// Validation utilities
export class CardValidator {
  /**
   * Validate create card input
   */
  static validateCreateCard(input: unknown): CreateCardInput {
    return createCardSchema.parse(input) as CreateCardInput;
  }

  /**
   * Validate update card input
   */
  static validateUpdateCard(input: unknown): UpdateCardInput {
    return updateCardSchema.parse(input) as UpdateCardInput;
  }

  /**
   * Validate card filter
   */
  static validateCardFilter(input: unknown): CardFilter {
    return cardFilterSchema.parse(input) as CardFilter;
  }

  /**
   * Validate position update
   */
  static validatePositionUpdate(input: unknown): CardPositionUpdate {
    return cardPositionUpdateSchema.parse(input) as CardPositionUpdate;
  }

  /**
   * Validate batch position updates
   */
  static validateBatchPositionUpdates(input: unknown): CardPositionUpdate[] {
    return batchPositionUpdateSchema.parse(input) as CardPositionUpdate[];
  }

  /**
   * Validate batch card updates
   */
  static validateBatchCardUpdates(input: unknown): BatchCardUpdate[] {
    return batchCardUpdateArraySchema.parse(input) as BatchCardUpdate[];
  }

  /**
   * Validate import cards
   */
  static validateImportCards(input: unknown): { workspaceId: string; cards: ImportCardData[] } {
    return importCardsSchema.parse(input) as { workspaceId: string; cards: ImportCardData[] };
  }

  /**
   * Validate content for specific card type
   */
  static validateContentForType(content: string, type: CardType): boolean {
    const validator = contentValidationByType[type];
    return validator.safeParse(content).success;
  }

  /**
   * Sanitize card content based on type
   */
  static sanitizeContent(content: string, type: CardType): string {
    switch (type) {
      case CardType.TEXT:
      case CardType.CODE:
        // Basic HTML entity encoding to prevent XSS
        return content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');
      
      case CardType.LINK:
      case CardType.IMAGE:
      case CardType.FILE:
        // For URLs, ensure they're properly encoded
        try {
          const url = new URL(content);
          return url.toString();
        } catch {
          return content; // Return as-is if not a valid URL
        }
      
      case CardType.DRAWING:
        // For drawing data, ensure it's valid JSON
        try {
          return JSON.stringify(JSON.parse(content));
        } catch {
          return content; // Return as-is if not valid JSON
        }
      
      default:
        return content;
    }
  }

  /**
   * Check if position is within workspace bounds
   */
  static isPositionWithinBounds(position: CardPosition, workspaceBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): boolean {
    if (!workspaceBounds) return true;
    
    return position.x >= workspaceBounds.minX &&
           position.x <= workspaceBounds.maxX &&
           position.y >= workspaceBounds.minY &&
           position.y <= workspaceBounds.maxY;
  }

  /**
   * Validate card overlaps (basic collision detection)
   */
  static checkCardOverlap(
    position: CardPosition,
    dimensions: CardDimensions,
    existingCards: Array<{ position: CardPosition; dimensions: CardDimensions }>
  ): boolean {
    return existingCards.some(card => {
      const overlap = !(
        position.x + dimensions.width < card.position.x ||
        card.position.x + card.dimensions.width < position.x ||
        position.y + dimensions.height < card.position.y ||
        card.position.y + card.dimensions.height < position.y
      );
      return overlap;
    });
  }
}