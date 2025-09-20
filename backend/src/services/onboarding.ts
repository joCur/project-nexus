import { database, knex } from '@/database/connection';
import { 
  NotFoundError as _NotFoundError, 
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { z } from 'zod';

/**
 * Onboarding Service - Repository layer for user onboarding operations
 * Implements onboarding progress tracking and completion
 */

const logger = createContextLogger({ service: 'OnboardingService' });

// Validation schemas
const onboardingProgressSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  currentStep: z.number().min(1).max(10),
  tutorialProgress: z.record(z.string(), z.boolean()).optional().default({}),
});

const onboardingCompleteSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  tutorialProgress: z.record(z.string(), z.boolean()).optional().default({}),
});

// Database model types (snake_case as returned from database)
interface DbOnboardingRecord {
  id: string;
  user_id: string;
  completed: boolean;
  completed_at: string | null;
  current_step: number;
  final_step: number | null;
  tutorial_progress: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

// Application model types (camelCase for TypeScript)
export interface OnboardingProgress {
  id: string;
  userId: string;
  completed: boolean;
  completedAt?: Date;
  currentStep: number;
  finalStep?: number;
  tutorialProgress: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

interface OnboardingUpdateInput {
  userId: string;
  currentStep: number;
  tutorialProgress?: Record<string, boolean>;
}

interface OnboardingCompleteInput {
  userId: string;
  tutorialProgress?: Record<string, boolean>;
}

export class OnboardingService {
  private readonly tableName = 'user_onboarding';

  /**
   * Get onboarding progress for a user
   */
  async getProgress(userId: string): Promise<OnboardingProgress | null> {
    const requestId = `get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug('Getting onboarding progress', {
      requestId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    try {
      const startTime = Date.now();
      
      const onboarding = await database.query<DbOnboardingRecord>(
        knex(this.tableName)
          .where('user_id', userId)
          .first(),
        'onboarding_get_progress'
      );
      
      const duration = Date.now() - startTime;
      
      logger.debug('Database query completed for onboarding progress', {
        requestId,
        userId,
        found: !!onboarding,
        duration,
        timestamp: new Date().toISOString()
      });

      if (onboarding) {
        const progress = this.mapDbOnboardingToOnboarding(onboarding);
        
        logger.debug('Successfully retrieved onboarding progress', {
          requestId,
          userId,
          completed: progress.completed,
          currentStep: progress.currentStep,
          lastUpdated: progress.updatedAt.toISOString()
        });
        
        return progress;
      }
      
      logger.debug('No onboarding progress found for user', {
        requestId,
        userId
      });
      
      return null;

    } catch (error) {
      logger.error('Failed to get onboarding progress', {
        requestId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Update onboarding progress
   */
  async updateProgress(input: OnboardingUpdateInput): Promise<OnboardingProgress> {
    const requestId = `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Starting onboarding progress update', {
      requestId,
      userId: input.userId,
      currentStep: input.currentStep,
      tutorialProgress: input.tutorialProgress,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Validate input
      const validatedInput = onboardingProgressSchema.parse(input);
      
      logger.debug('Input validation successful', {
        requestId,
        userId: validatedInput.userId,
        currentStep: validatedInput.currentStep
      });

      // Use a transaction to prevent race conditions
      const result = await database.transaction(async (trx) => {
        // Check if onboarding record exists within transaction
        const existingQuery = trx(this.tableName)
          .where('user_id', validatedInput.userId)
          .first()
          .forUpdate(); // Lock the row for update
        
        const existing = await existingQuery as DbOnboardingRecord | undefined;
        
        logger.debug('Existing record check within transaction', {
          requestId,
          userId: validatedInput.userId,
          hasExisting: !!existing,
          existingStep: existing?.current_step,
          existingCompleted: existing?.completed
        });

        if (existing) {
          // Update existing record
          const updateData = {
            current_step: validatedInput.currentStep,
            tutorial_progress: validatedInput.tutorialProgress,
            updated_at: new Date(),
          };

          const [updated] = await trx(this.tableName)
            .where('user_id', validatedInput.userId)
            .update(updateData)
            .returning('*') as DbOnboardingRecord[];

          logger.info('Onboarding progress updated within transaction', {
            requestId,
            userId: validatedInput.userId,
            oldStep: existing.current_step,
            newStep: validatedInput.currentStep,
            completed: updated.completed
          });

          return updated;
        } else {
          // Create new record
          const createData = {
            user_id: validatedInput.userId,
            current_step: validatedInput.currentStep,
            tutorial_progress: validatedInput.tutorialProgress,
            completed: false,
          };

          const [created] = await trx(this.tableName)
            .insert(createData)
            .returning('*') as DbOnboardingRecord[];

          logger.info('Onboarding progress created within transaction', {
            requestId,
            userId: validatedInput.userId,
            currentStep: validatedInput.currentStep,
            id: created.id
          });

          return created;
        }
      });
      
      const progress = this.mapDbOnboardingToOnboarding(result);
      
      logger.info('Onboarding progress update completed successfully', {
        requestId,
        userId: validatedInput.userId,
        currentStep: progress.currentStep,
        completed: progress.completed,
        progressId: progress.id,
        timestamp: new Date().toISOString()
      });
      
      return progress;

    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Validation error in onboarding update', {
          requestId,
          userId: input.userId,
          validationErrors: error.issues,
          timestamp: new Date().toISOString()
        });
        throw new ValidationError(error.issues[0]?.message || 'Validation failed');
      }

      logger.error('Failed to update onboarding progress', {
        requestId,
        userId: input.userId,
        currentStep: input.currentStep,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(input: OnboardingCompleteInput): Promise<OnboardingProgress> {
    const requestId = `complete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Starting onboarding completion', {
      requestId,
      userId: input.userId,
      tutorialProgress: input.tutorialProgress,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Validate input
      const validatedInput = onboardingCompleteSchema.parse(input);
      
      logger.debug('Input validation successful for completion', {
        requestId,
        userId: validatedInput.userId
      });

      // Use a transaction to ensure consistency
      const result = await database.transaction(async (trx) => {
        // Check if onboarding record exists within transaction
        const existing = await trx(this.tableName)
          .where('user_id', validatedInput.userId)
          .first()
          .forUpdate() as DbOnboardingRecord | undefined; // Lock the row for update
        
        logger.debug('Existing record check for completion', {
          requestId,
          userId: validatedInput.userId,
          hasExisting: !!existing,
          existingCompleted: existing?.completed,
          existingStep: existing?.current_step
        });
        
        // Prevent double completion
        if (existing?.completed) {
          logger.warn('Attempting to complete already completed onboarding', {
            requestId,
            userId: validatedInput.userId,
            completedAt: existing.completed_at
          });
          return existing;
        }

        const updateData = {
          completed: true,
          completed_at: new Date(),
          final_step: existing?.current_step || 3, // Default to 3 for v1 onboarding
          tutorial_progress: {
            ...existing?.tutorial_progress,
            ...validatedInput.tutorialProgress,
          },
          updated_at: new Date(),
        };

        if (existing) {
          // Update existing record
          const [updated] = await trx(this.tableName)
            .where('user_id', validatedInput.userId)
            .update(updateData)
            .returning('*') as DbOnboardingRecord[];

          logger.info('Onboarding completed (updated existing record)', {
            requestId,
            userId: validatedInput.userId,
            finalStep: updateData.final_step,
            previousStep: existing.current_step,
            completedAt: updateData.completed_at
          });

          return updated;
        } else {
          // Create new record as completed
          const createData = {
            user_id: validatedInput.userId,
            current_step: 3, // All steps completed
            ...updateData,
          };

          const [created] = await trx(this.tableName)
            .insert(createData)
            .returning('*') as DbOnboardingRecord[];

          logger.info('Onboarding completed (created new completed record)', {
            requestId,
            userId: validatedInput.userId,
            finalStep: createData.final_step,
            completedAt: createData.completed_at,
            id: created.id
          });

          return created;
        }
      });
      
      const progress = this.mapDbOnboardingToOnboarding(result);
      
      logger.info('Onboarding completion process finished successfully', {
        requestId,
        userId: validatedInput.userId,
        completed: progress.completed,
        completedAt: progress.completedAt?.toISOString(),
        finalStep: progress.finalStep,
        progressId: progress.id,
        timestamp: new Date().toISOString()
      });
      
      return progress;

    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Validation error in onboarding completion', {
          requestId,
          userId: input.userId,
          validationErrors: error.issues,
          timestamp: new Date().toISOString()
        });
        throw new ValidationError(error.issues[0]?.message || 'Validation failed');
      }

      logger.error('Failed to complete onboarding', {
        requestId,
        userId: input.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Check if user has completed onboarding
   */
  async isOnboardingComplete(userId: string): Promise<boolean> {
    const requestId = `check_complete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug('Checking onboarding completion status', {
      requestId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    try {
      const onboarding = await this.getProgress(userId);
      const isComplete = onboarding?.completed || false;
      
      logger.debug('Onboarding completion check result', {
        requestId,
        userId,
        isComplete,
        hasProgress: !!onboarding,
        currentStep: onboarding?.currentStep,
        completedAt: onboarding?.completedAt?.toISOString()
      });
      
      return isComplete;

    } catch (error) {
      logger.error('Failed to check onboarding completion', {
        requestId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      // Return false instead of throwing to allow graceful degradation
      return false;
    }
  }

  /**
   * Reset onboarding progress (for admin use or testing)
   */
  async resetOnboarding(userId: string): Promise<void> {
    try {
      await database.query(
        knex(this.tableName)
          .where('user_id', userId)
          .update({
            completed: false,
            completed_at: null,
            current_step: 1,
            final_step: null,
            tutorial_progress: {},
            updated_at: new Date(),
          }),
        'onboarding_reset'
      );

      logger.info('Onboarding reset', { userId });

    } catch (error) {
      logger.error('Failed to reset onboarding', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Map database onboarding record to OnboardingProgress interface
   * Converts snake_case database fields to camelCase TypeScript interface
   */
  private mapDbOnboardingToOnboarding(dbOnboarding: DbOnboardingRecord): OnboardingProgress {
    // Validate required fields
    if (!dbOnboarding.id || !dbOnboarding.user_id) {
      throw new Error('Invalid database record: missing required fields');
    }
    
    return {
      id: dbOnboarding.id,
      userId: dbOnboarding.user_id,
      completed: Boolean(dbOnboarding.completed),
      completedAt: dbOnboarding.completed_at ? new Date(dbOnboarding.completed_at) : undefined,
      currentStep: Number(dbOnboarding.current_step) || 1,
      finalStep: dbOnboarding.final_step ? Number(dbOnboarding.final_step) : undefined,
      tutorialProgress: dbOnboarding.tutorial_progress || {},
      createdAt: new Date(dbOnboarding.created_at),
      updatedAt: new Date(dbOnboarding.updated_at),
    };
  }
}


