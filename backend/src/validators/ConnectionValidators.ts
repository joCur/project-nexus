/**
 * Zod validation schemas for connection-related types
 * Provides runtime type safety and input validation
 */

import { z } from 'zod';
import { ConnectionType } from '../types/CardTypes';
import { ConnectionConstraints } from '../types/ConnectionTypes';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const ConnectionTypeSchema = z.enum([
  ConnectionType.MANUAL,
  ConnectionType.AI_SUGGESTED,
  ConnectionType.AI_GENERATED,
  ConnectionType.REFERENCE,
  ConnectionType.DEPENDENCY,
  ConnectionType.SIMILARITY,
  ConnectionType.RELATED,
]);

// ============================================================================
// BASIC TYPE SCHEMAS
// ============================================================================

export const ConnectionIdSchema = z.string().uuid();

export const ConfidenceSchema = z
  .number()
  .min(ConnectionConstraints.MIN_CONFIDENCE)
  .max(ConnectionConstraints.MAX_CONFIDENCE);

export const ConnectionStyleSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  width: z.number()
    .min(ConnectionConstraints.MIN_LINE_WIDTH)
    .max(ConnectionConstraints.MAX_LINE_WIDTH),
  opacity: z.number().min(0).max(1),
  curve: z.enum(['straight', 'curved', 'stepped']),
  showArrow: z.boolean(),
  showLabel: z.boolean(),
  dashArray: z.string().optional(),
});

export const ConnectionLabelSchema = z.object({
  text: z.string()
    .min(1)
    .max(ConnectionConstraints.MAX_LABEL_LENGTH),
  position: z.enum(['start', 'middle', 'end']),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontSize: z.number().min(8).max(24),
});

// ============================================================================
// CONNECTION SCHEMAS
// ============================================================================

export const ConnectionSchema = z.object({
  id: ConnectionIdSchema,
  sourceCardId: z.string().uuid(),
  targetCardId: z.string().uuid(),
  type: ConnectionTypeSchema,
  confidence: ConfidenceSchema,
  style: ConnectionStyleSchema,
  label: ConnectionLabelSchema.optional(),
  metadata: z.record(z.any()),
  createdBy: z.string().uuid(),
  isVisible: z.boolean(),
  aiReasoning: z.string()
    .max(ConnectionConstraints.MAX_REASONING_LENGTH)
    .optional(),
  keywords: z.array(z.string())
    .max(ConnectionConstraints.MAX_KEYWORDS_COUNT)
    .optional(),
  concepts: z.array(z.string())
    .max(ConnectionConstraints.MAX_CONCEPTS_COUNT)
    .optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).refine(
  (data) => data.sourceCardId !== data.targetCardId,
  {
    message: 'Source and target cards must be different',
    path: ['targetCardId'],
  }
);

// ============================================================================
// INPUT VALIDATION SCHEMAS
// ============================================================================

export const CreateConnectionInputSchema = z.object({
  sourceCardId: z.string().uuid(),
  targetCardId: z.string().uuid(),
  type: ConnectionTypeSchema.default(ConnectionType.MANUAL),
  confidence: ConfidenceSchema.default(ConnectionConstraints.DEFAULT_CONFIDENCE),
  style: ConnectionStyleSchema.partial().optional(),
  label: ConnectionLabelSchema.optional(),
  metadata: z.record(z.any()).default({}),
  aiReasoning: z.string()
    .max(ConnectionConstraints.MAX_REASONING_LENGTH)
    .optional(),
  keywords: z.array(z.string())
    .max(ConnectionConstraints.MAX_KEYWORDS_COUNT)
    .optional(),
  concepts: z.array(z.string())
    .max(ConnectionConstraints.MAX_CONCEPTS_COUNT)
    .optional(),
}).refine(
  (data) => data.sourceCardId !== data.targetCardId,
  {
    message: 'Cannot create connection from card to itself',
    path: ['targetCardId'],
  }
);

export const UpdateConnectionInputSchema = z.object({
  type: ConnectionTypeSchema.optional(),
  confidence: ConfidenceSchema.optional(),
  style: ConnectionStyleSchema.partial().optional(),
  label: ConnectionLabelSchema.optional(),
  metadata: z.record(z.any()).optional(),
  isVisible: z.boolean().optional(),
  aiReasoning: z.string()
    .max(ConnectionConstraints.MAX_REASONING_LENGTH)
    .optional(),
  keywords: z.array(z.string())
    .max(ConnectionConstraints.MAX_KEYWORDS_COUNT)
    .optional(),
  concepts: z.array(z.string())
    .max(ConnectionConstraints.MAX_CONCEPTS_COUNT)
    .optional(),
});

export const BatchConnectionUpdateSchema = z.object({
  connectionId: ConnectionIdSchema,
  updates: UpdateConnectionInputSchema,
});

// ============================================================================
// AI CONNECTION SCHEMAS
// ============================================================================

export const AIConnectionAnalysisSchema = z.object({
  strength: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(1000),
  keywords: z.array(z.string()).max(20),
  concepts: z.array(z.string()).max(10),
  confidence: ConfidenceSchema,
  suggestedType: ConnectionTypeSchema,
});

export const ConnectionSuggestionSchema = z.object({
  id: z.string(),
  sourceCardId: z.string().uuid(),
  targetCardId: z.string().uuid(),
  analysis: AIConnectionAnalysisSchema,
  isAccepted: z.boolean(),
  isRejected: z.boolean(),
  createdAt: z.date(),
});

// ============================================================================
// QUERY AND FILTER SCHEMAS
// ============================================================================

export const ConnectionFilterSchema = z.object({
  types: z.array(ConnectionTypeSchema).optional(),
  minConfidence: ConfidenceSchema.optional(),
  maxConfidence: ConfidenceSchema.optional(),
  sourceCardIds: z.array(z.string().uuid()).optional(),
  targetCardIds: z.array(z.string().uuid()).optional(),
  createdBy: z.string().uuid().optional(),
  isVisible: z.boolean().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  hasAIReasoning: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
  concepts: z.array(z.string()).optional(),
});

export const ConnectionQuerySchema = z.object({
  cardId: z.string().uuid().optional(),
  cardIds: z.array(z.string().uuid()).optional(),
  filter: ConnectionFilterSchema.optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['createdAt', 'updatedAt', 'confidence', 'type']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeBidirectional: z.boolean().default(false),
});

// ============================================================================
// BATCH OPERATION SCHEMAS
// ============================================================================

export const BatchCreateConnectionsSchema = z.object({
  connections: z.array(CreateConnectionInputSchema)
    .min(1)
    .max(50), // Limit batch size
});

export const BatchUpdateConnectionsSchema = z.object({
  updates: z.array(BatchConnectionUpdateSchema)
    .min(1)
    .max(50),
});

export const BatchDeleteConnectionsSchema = z.object({
  connectionIds: z.array(ConnectionIdSchema)
    .min(1)
    .max(50),
});

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

export const validateCreateConnection = (data: unknown) => {
  return CreateConnectionInputSchema.parse(data);
};

export const validateUpdateConnection = (data: unknown) => {
  return UpdateConnectionInputSchema.parse(data);
};

export const validateConnectionQuery = (data: unknown) => {
  return ConnectionQuerySchema.parse(data);
};

export const validateConnectionFilter = (data: unknown) => {
  return ConnectionFilterSchema.parse(data);
};

export const validateBatchCreateConnections = (data: unknown) => {
  return BatchCreateConnectionsSchema.parse(data);
};

export const validateBatchUpdateConnections = (data: unknown) => {
  return BatchUpdateConnectionsSchema.parse(data);
};

export const validateBatchDeleteConnections = (data: unknown) => {
  return BatchDeleteConnectionsSchema.parse(data);
};

// ============================================================================
// CUSTOM VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates that a connection type supports AI features
 */
export const isAIConnectionType = (type: ConnectionType): boolean => {
  return type === ConnectionType.AI_SUGGESTED || 
         type === ConnectionType.AI_GENERATED ||
         type === ConnectionType.SIMILARITY;
};

/**
 * Validates confidence score based on connection type
 */
export const validateConfidenceForType = (
  confidence: number, 
  type: ConnectionType
): boolean => {
  // Manual connections should have high confidence
  if (type === ConnectionType.MANUAL) {
    return confidence === 1.0;
  }
  
  // AI connections can have variable confidence
  if (isAIConnectionType(type)) {
    return confidence >= 0.0 && confidence <= 1.0;
  }
  
  // Other types should have high confidence unless specified
  return confidence >= 0.8 && confidence <= 1.0;
};

/**
 * Validates that AI-specific fields are present for AI connections
 */
export const validateAIConnectionData = (data: {
  type: ConnectionType;
  aiReasoning?: string;
  keywords?: string[];
  concepts?: string[];
}): string[] => {
  const errors: string[] = [];
  
  if (isAIConnectionType(data.type)) {
    if (!data.aiReasoning || data.aiReasoning.trim().length === 0) {
      errors.push('AI connections must include reasoning');
    }
    
    if (!data.keywords || data.keywords.length === 0) {
      errors.push('AI connections must include keywords');
    }
  }
  
  return errors;
};

/**
 * Validates connection pair uniqueness (considering bidirectionality)
 */
export const normalizeConnectionPair = (
  sourceCardId: string, 
  targetCardId: string
): { source: string; target: string } => {
  // Always put the lexicographically smaller ID first for consistency
  if (sourceCardId < targetCardId) {
    return { source: sourceCardId, target: targetCardId };
  } else {
    return { source: targetCardId, target: sourceCardId };
  }
};

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateConnectionInput = z.infer<typeof CreateConnectionInputSchema>;
export type UpdateConnectionInput = z.infer<typeof UpdateConnectionInputSchema>;
export type ConnectionFilter = z.infer<typeof ConnectionFilterSchema>;
export type ConnectionQuery = z.infer<typeof ConnectionQuerySchema>;
export type AIConnectionAnalysis = z.infer<typeof AIConnectionAnalysisSchema>;
export type ConnectionSuggestion = z.infer<typeof ConnectionSuggestionSchema>;