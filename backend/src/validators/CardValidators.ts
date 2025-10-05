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
  CardConstraints,
  TiptapJSONContent
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

// Tiptap JSON validation constants
const TIPTAP_MAX_NESTING_DEPTH = 20;
const TIPTAP_MAX_CONTENT_SIZE = 100 * 1024; // 100KB

/**
 * Allowed Tiptap node types based on Phase 1-4 implementation
 */
const ALLOWED_NODE_TYPES = new Set([
  // Core structure
  'doc',
  'paragraph',
  'text',
  // Headings
  'heading',
  // Lists
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  // Block elements
  'blockquote',
  'codeBlock',
  'horizontalRule',
]);

/**
 * Allowed Tiptap mark types based on Phase 1-4 implementation
 */
const ALLOWED_MARK_TYPES = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
]);

/**
 * Dangerous URL protocols that should be blocked for XSS prevention
 */
const DANGEROUS_PROTOCOLS = new Set([
  'javascript:',
  'data:text/html',
  'vbscript:',
  'file:',
  'about:',
]);

/**
 * Allowed URL protocols for link sanitization
 */
const ALLOWED_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
]);

/**
 * Calculate nesting depth of Tiptap JSON
 * @param node - Tiptap JSON node
 * @param currentDepth - Current depth (internal use)
 * @returns Maximum nesting depth
 */
function getTiptapNestingDepth(node: TiptapJSONContent, currentDepth = 0): number {
  if (!node.content || node.content.length === 0) {
    return currentDepth;
  }

  let maxDepth = currentDepth;
  for (const child of node.content) {
    const childDepth = getTiptapNestingDepth(child, currentDepth + 1);
    maxDepth = Math.max(maxDepth, childDepth);
  }

  return maxDepth;
}

/**
 * Validate Tiptap JSON structure for security and correctness
 * @param node - Tiptap JSON node to validate
 * @returns True if valid, throws error otherwise
 */
function validateTiptapStructure(node: TiptapJSONContent): boolean {
  // Check node type is allowed
  if (!ALLOWED_NODE_TYPES.has(node.type)) {
    throw new Error(`Invalid node type: ${node.type}`);
  }

  // Validate marks if present
  if (node.marks) {
    for (const mark of node.marks) {
      if (!ALLOWED_MARK_TYPES.has(mark.type)) {
        throw new Error(`Invalid mark type: ${mark.type}`);
      }

      // Validate link href for XSS prevention
      if (mark.type === 'link' && mark.attrs?.href && typeof mark.attrs.href === 'string') {
        const href = mark.attrs.href.toLowerCase();

        // Check for dangerous protocols
        for (const protocol of DANGEROUS_PROTOCOLS) {
          if (href.startsWith(protocol)) {
            throw new Error(`Dangerous protocol detected in link: ${protocol}`);
          }
        }

        // Validate allowed protocols
        const hasAllowedProtocol = Array.from(ALLOWED_PROTOCOLS).some(
          protocol => href.startsWith(protocol)
        );

        if (!hasAllowedProtocol && href.includes(':')) {
          throw new Error(`Invalid protocol in link: ${href}`);
        }
      }
    }
  }

  // Check nesting depth
  const depth = getTiptapNestingDepth(node);
  if (depth > TIPTAP_MAX_NESTING_DEPTH) {
    throw new Error(`JSON nesting depth exceeds maximum allowed (${TIPTAP_MAX_NESTING_DEPTH})`);
  }

  // Recursively validate children
  if (node.content) {
    for (const child of node.content) {
      validateTiptapStructure(child);
    }
  }

  return true;
}

/**
 * Sanitize Tiptap JSON content for XSS prevention
 * @param node - Tiptap JSON node to sanitize
 * @returns Sanitized Tiptap JSON node
 */
function sanitizeTiptapJSON(node: TiptapJSONContent): TiptapJSONContent {
  const sanitized: TiptapJSONContent = { type: node.type };

  // Sanitize text content
  if (node.text !== undefined) {
    sanitized.text = node.text;
  }

  // Sanitize marks
  if (node.marks) {
    sanitized.marks = node.marks.map(mark => {
      const sanitizedMark: { type: string; attrs?: Record<string, any> } = { type: mark.type };

      if (mark.attrs) {
        const sanitizedAttrs: Record<string, any> = {};

        // Sanitize link hrefs
        if (mark.type === 'link' && mark.attrs.href && typeof mark.attrs.href === 'string') {
          const href = mark.attrs.href.toLowerCase();

          // Remove dangerous protocols
          let isAllowed = true;
          for (const protocol of DANGEROUS_PROTOCOLS) {
            if (href.startsWith(protocol)) {
              isAllowed = false;
              break;
            }
          }

          if (isAllowed) {
            sanitizedAttrs.href = mark.attrs.href;
          }
        } else {
          // Copy other attributes (excluding dangerous ones)
          for (const [key, value] of Object.entries(mark.attrs)) {
            if (!key.toLowerCase().startsWith('on')) { // Remove event handlers
              sanitizedAttrs[key] = value;
            }
          }
        }

        if (Object.keys(sanitizedAttrs).length > 0) {
          sanitizedMark.attrs = sanitizedAttrs;
        }
      }

      return sanitizedMark;
    });
  }

  // Sanitize attributes
  if (node.attrs) {
    const sanitizedAttrs: Record<string, any> = {};

    for (const [key, value] of Object.entries(node.attrs)) {
      // Remove dangerous attributes
      if (!key.toLowerCase().startsWith('on') &&
          key !== 'onerror' &&
          key !== 'onclick') {
        sanitizedAttrs[key] = value;
      }
    }

    if (Object.keys(sanitizedAttrs).length > 0) {
      sanitized.attrs = sanitizedAttrs;
    }
  }

  // Recursively sanitize children
  if (node.content) {
    sanitized.content = node.content.map(child => sanitizeTiptapJSON(child));
  }

  return sanitized;
}

/**
 * Tiptap mark schema for validation
 */
const tiptapMarkSchema = z.object({
  type: z.string().refine(
    (type) => ALLOWED_MARK_TYPES.has(type),
    { message: 'Invalid mark type' }
  ),
  attrs: z.record(z.any()).optional(),
});

/**
 * Recursive Tiptap JSON content schema
 */
const tiptapNodeSchema: z.ZodType<TiptapJSONContent> = z.lazy(() =>
  z.object({
    type: z.string().min(1, 'Node type is required'),
    content: z.array(tiptapNodeSchema).optional(),
    text: z.string().optional(),
    marks: z.array(tiptapMarkSchema).optional(),
    attrs: z.record(z.any()).optional(),
  }).refine(
    (node): node is TiptapJSONContent => {
      // Validate node type is allowed
      if (!ALLOWED_NODE_TYPES.has(node.type)) {
        throw new z.ZodError([{
          code: 'custom',
          message: `Invalid node type: ${node.type}`,
          path: ['type'],
        }]);
      }

      // Validate structure and security (cast is safe because type is required)
      validateTiptapStructure(node as TiptapJSONContent);
      return true;
    },
    { message: 'Invalid Tiptap JSON structure' }
  )
) as z.ZodType<TiptapJSONContent>;

// Content validation by card type
const contentValidationByType = {
  text: z.union([
    // Markdown string
    z.string()
      .min(1, 'Text content cannot be empty')
      .max(CardConstraints.CONTENT_MAX_LENGTH, `Content must be <= ${CardConstraints.CONTENT_MAX_LENGTH} characters`),
    // Tiptap JSON (as stringified JSON)
    z.string()
      .refine(
        (content) => {
          try {
            const parsed = JSON.parse(content);

            // Check if it's a valid JSON object with type property
            if (typeof parsed !== 'object' || !parsed.type) {
              return false;
            }

            // Validate size limit (100KB max)
            if (content.length > TIPTAP_MAX_CONTENT_SIZE) {
              throw new Error('Content exceeds maximum size limit');
            }

            // Validate Tiptap structure
            tiptapNodeSchema.parse(parsed);
            return true;
          } catch (error) {
            // If it's not valid JSON or Tiptap, it might be markdown
            // Let the markdown validator handle it
            return false;
          }
        },
        { message: 'Invalid Tiptap JSON structure' }
      ),
  ]),

  image: z.string()
    .url('Image content must be a valid URL')
    .or(z.string().startsWith('data:image/', 'Must be a valid image URL or data URI')),

  link: z.string()
    .url('Link content must be a valid URL'),

  code: z.string()
    .min(1, 'Code content cannot be empty')
    .max(CardConstraints.CONTENT_MAX_LENGTH, `Code content must be <= ${CardConstraints.CONTENT_MAX_LENGTH} characters`),

  file: z.string()
    .url('File content must be a valid URL')
    .or(z.string().startsWith('data:', 'Must be a valid file URL or data URI')),

  drawing: z.string()
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
  static sanitizeContent(content: string | TiptapJSONContent, type: CardType): string {
    // If content is already an object (TiptapJSONContent), stringify it first
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

    switch (type) {
      case 'text':
        // Check if content is Tiptap JSON
        try {
          const parsed = JSON.parse(contentStr);
          if (typeof parsed === 'object' && parsed.type) {
            // It's Tiptap JSON - sanitize it
            const sanitized = sanitizeTiptapJSON(parsed);
            return JSON.stringify(sanitized);
          }
        } catch {
          // Not JSON, treat as markdown
        }

        // Markdown - Basic HTML entity encoding to prevent XSS
        return contentStr
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');

      case 'code':
        // Basic HTML entity encoding to prevent XSS
        return contentStr
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');

      case 'link':
      case 'image':
      case 'file':
        // For URLs, ensure they're properly encoded
        try {
          const url = new URL(contentStr);
          return url.toString();
        } catch {
          return contentStr; // Return as-is if not a valid URL
        }

      case 'drawing':
        // For drawing data, ensure it's valid JSON
        try {
          return JSON.stringify(JSON.parse(contentStr));
        } catch {
          return contentStr; // Return as-is if not valid JSON
        }

      default:
        return contentStr;
    }
  }

  /**
   * Validate Tiptap JSON content structure
   * @param content - Content to validate (can be string or TiptapJSONContent)
   * @returns Validated TiptapJSONContent object
   * @throws Error if validation fails
   */
  static validateTiptapJSON(content: unknown): TiptapJSONContent {
    // If content is a string, try to parse it
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch (error) {
        throw new Error('Invalid JSON format for Tiptap content');
      }
    }

    // Validate using Zod schema
    return tiptapNodeSchema.parse(content);
  }

  /**
   * Sanitize Tiptap JSON content for XSS prevention
   * @param content - Tiptap JSON content to sanitize
   * @returns Sanitized TiptapJSONContent
   */
  static sanitizeTiptapJSON(content: TiptapJSONContent): TiptapJSONContent {
    return sanitizeTiptapJSON(content);
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