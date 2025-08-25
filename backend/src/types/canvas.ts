/**
 * Canvas-related types and interfaces
 * Defines data structures for Canvas entities and operations
 */

import { z } from 'zod';

/**
 * Canvas entity interface
 */
export interface Canvas {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  position: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Canvas creation input interface
 */
export interface CreateCanvasInput {
  workspaceId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  position?: number;
}

/**
 * Canvas update input interface
 */
export interface UpdateCanvasInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
  position?: number;
}

/**
 * Canvas statistics interface
 */
export interface CanvasStats {
  id: string;
  name: string;
  cardCount: number;
  connectionCount: number;
  lastActivity?: Date;
  createdAt: Date;
}

/**
 * Canvas filter options
 */
export interface CanvasFilter {
  workspaceId?: string;
  name?: string;
  isDefault?: boolean;
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

/**
 * Canvas duplication options
 */
export interface DuplicateCanvasOptions {
  name: string;
  description?: string;
  includeCards?: boolean;
  includeConnections?: boolean;
  position?: number;
}

/**
 * Zod validation schemas
 */
export const CreateCanvasSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID format'),
  name: z.string()
    .min(1, 'Canvas name is required')
    .max(100, 'Canvas name must be 100 characters or less')
    .transform(val => val.trim()),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  isDefault: z.boolean().optional().default(false),
  position: z.number()
    .int('Position must be an integer')
    .min(0, 'Position must be non-negative')
    .optional()
    .default(0)
});

export const UpdateCanvasSchema = z.object({
  name: z.string()
    .min(1, 'Canvas name cannot be empty')
    .max(100, 'Canvas name must be 100 characters or less')
    .transform(val => val.trim())
    .optional(),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  isDefault: z.boolean().optional(),
  position: z.number()
    .int('Position must be an integer')
    .min(0, 'Position must be non-negative')
    .optional()
});

export const DuplicateCanvasSchema = z.object({
  name: z.string()
    .min(1, 'Canvas name is required')
    .max(100, 'Canvas name must be 100 characters or less')
    .transform(val => val.trim()),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  includeCards: z.boolean().optional().default(true),
  includeConnections: z.boolean().optional().default(true),
  position: z.number()
    .int('Position must be an integer')
    .min(0, 'Position must be non-negative')
    .optional()
});

/**
 * Canvas-specific error types
 */
export class CanvasNotFoundError extends Error {
  constructor(canvasId: string) {
    super(`Canvas with id '${canvasId}' not found`);
    this.name = 'CanvasNotFoundError';
  }
}

export class CanvasNameConflictError extends Error {
  constructor(name: string, workspaceId: string) {
    super(`Canvas with name '${name}' already exists in workspace '${workspaceId}'`);
    this.name = 'CanvasNameConflictError';
  }
}

export class DefaultCanvasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DefaultCanvasError';
  }
}

export class CanvasValidationError extends Error {
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'CanvasValidationError';
    if (field) {
      (this as any).field = field;
    }
  }
}