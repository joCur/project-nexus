import { database, knex } from '@/database/connection';
import { 
  NotFoundError, 
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
  tutorialProgress: z.record(z.boolean()).optional().default({}),
});

const onboardingCompleteSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  tutorialProgress: z.record(z.boolean()).optional().default({}),
});

// Types
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
    try {
      const onboarding = await database.query<any>(
        knex(this.tableName)
          .where('user_id', userId)
          .first(),
        'onboarding_get_progress'
      );

      return onboarding ? this.mapDbOnboardingToOnboarding(onboarding) : null;

    } catch (error) {
      logger.error('Failed to get onboarding progress', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update onboarding progress
   */
  async updateProgress(input: OnboardingUpdateInput): Promise<OnboardingProgress> {
    try {
      // Validate input
      const validatedInput = onboardingProgressSchema.parse(input);

      // Check if onboarding record exists
      const existing = await this.getProgress(validatedInput.userId);

      if (existing) {
        // Update existing record
        const updateData = {
          current_step: validatedInput.currentStep,
          tutorial_progress: validatedInput.tutorialProgress,
          updated_at: new Date(),
        };

        const [updated] = await database.query<any[]>(
          knex(this.tableName)
            .where('user_id', validatedInput.userId)
            .update(updateData)
            .returning('*'),
          'onboarding_update_progress'
        );

        logger.info('Onboarding progress updated', {
          userId: validatedInput.userId,
          currentStep: validatedInput.currentStep,
        });

        return this.mapDbOnboardingToOnboarding(updated);

      } else {
        // Create new record
        const createData = {
          user_id: validatedInput.userId,
          current_step: validatedInput.currentStep,
          tutorial_progress: validatedInput.tutorialProgress,
          completed: false,
        };

        const [created] = await database.query<any[]>(
          knex(this.tableName)
            .insert(createData)
            .returning('*'),
          'onboarding_create_progress'
        );

        logger.info('Onboarding progress created', {
          userId: validatedInput.userId,
          currentStep: validatedInput.currentStep,
        });

        return this.mapDbOnboardingToOnboarding(created);
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      logger.error('Failed to update onboarding progress', {
        userId: input.userId,
        currentStep: input.currentStep,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(input: OnboardingCompleteInput): Promise<OnboardingProgress> {
    try {
      // Validate input
      const validatedInput = onboardingCompleteSchema.parse(input);

      // Check if onboarding record exists
      const existing = await this.getProgress(validatedInput.userId);

      const updateData = {
        completed: true,
        completed_at: new Date(),
        final_step: existing?.currentStep || 3, // Default to 3 for v1 onboarding
        tutorial_progress: {
          ...existing?.tutorialProgress,
          ...validatedInput.tutorialProgress,
        },
        updated_at: new Date(),
      };

      if (existing) {
        // Update existing record
        const [updated] = await database.query<any[]>(
          knex(this.tableName)
            .where('user_id', validatedInput.userId)
            .update(updateData)
            .returning('*'),
          'onboarding_complete'
        );

        logger.info('Onboarding completed (updated)', {
          userId: validatedInput.userId,
          finalStep: updateData.final_step,
        });

        return this.mapDbOnboardingToOnboarding(updated);

      } else {
        // Create new record as completed
        const createData = {
          user_id: validatedInput.userId,
          current_step: 3, // All steps completed
          ...updateData,
        };

        const [created] = await database.query<any[]>(
          knex(this.tableName)
            .insert(createData)
            .returning('*'),
          'onboarding_complete_new'
        );

        logger.info('Onboarding completed (new)', {
          userId: validatedInput.userId,
          finalStep: createData.final_step,
        });

        return this.mapDbOnboardingToOnboarding(created);
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      logger.error('Failed to complete onboarding', {
        userId: input.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Check if user has completed onboarding
   */
  async isOnboardingComplete(userId: string): Promise<boolean> {
    try {
      const onboarding = await this.getProgress(userId);
      return onboarding?.completed || false;

    } catch (error) {
      logger.error('Failed to check onboarding completion', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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
   */
  private mapDbOnboardingToOnboarding(dbOnboarding: any): OnboardingProgress {
    return {
      id: dbOnboarding.id,
      userId: dbOnboarding.user_id,
      completed: dbOnboarding.completed,
      completedAt: dbOnboarding.completed_at ? new Date(dbOnboarding.completed_at) : undefined,
      currentStep: dbOnboarding.current_step,
      finalStep: dbOnboarding.final_step,
      tutorialProgress: dbOnboarding.tutorial_progress || {},
      createdAt: new Date(dbOnboarding.created_at),
      updatedAt: new Date(dbOnboarding.updated_at),
    };
  }
}