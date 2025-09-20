import { database, knex } from '@/database/connection';
import { 
  NotFoundError, 
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { z } from 'zod';

/**
 * User Profile Service - Repository layer for user profile management
 * Implements profile CRUD operations for onboarding and user management
 */

const logger = createContextLogger({ service: 'UserProfileService' });

// Validation schemas
const userProfileCreateSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  fullName: z.string().min(1, 'Full name is required').max(255),
  displayName: z.string().min(1).max(100).optional(),
  timezone: z.string().max(100).optional(),
  role: z.enum(['student', 'researcher', 'creative', 'business', 'other']).optional(),
  preferences: z.record(z.string(), z.unknown()).optional().default({}),
});

const userProfileUpdateSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  displayName: z.string().min(1).max(100).optional(),
  timezone: z.string().max(100).optional(),
  role: z.enum(['student', 'researcher', 'creative', 'business', 'other']).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

// Types
export interface UserProfile {
  id: string;
  userId: string;
  fullName: string;
  displayName?: string;
  timezone?: string;
  role?: 'STUDENT' | 'RESEARCHER' | 'CREATIVE' | 'BUSINESS' | 'OTHER';
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface UserProfileCreateInput {
  userId: string;
  fullName: string;
  displayName?: string;
  timezone?: string;
  role?: 'student' | 'researcher' | 'creative' | 'business' | 'other';
  preferences?: Record<string, any>;
}

interface UserProfileUpdateInput {
  fullName?: string;
  displayName?: string;
  timezone?: string;
  role?: 'student' | 'researcher' | 'creative' | 'business' | 'other';
  preferences?: Record<string, any>;
}

export class UserProfileService {
  private readonly tableName = 'user_profiles';

  /**
   * Get user profile by user ID
   */
  async getProfileByUserId(userId: string): Promise<UserProfile | null> {
    try {
      const profile = await database.query<any>(
        knex(this.tableName)
          .where('user_id', userId)
          .first(),
        'user_profile_get_by_user_id'
      );

      return profile ? this.mapDbProfileToProfile(profile) : null;

    } catch (error) {
      logger.error('Failed to get user profile by user ID', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get user profile by profile ID
   */
  async getProfileById(profileId: string): Promise<UserProfile | null> {
    try {
      const profile = await database.query<any>(
        knex(this.tableName)
          .where('id', profileId)
          .first(),
        'user_profile_get_by_id'
      );

      return profile ? this.mapDbProfileToProfile(profile) : null;

    } catch (error) {
      logger.error('Failed to get user profile by ID', {
        profileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create a new user profile
   */
  async createProfile(input: UserProfileCreateInput): Promise<UserProfile> {
    try {
      // Validate input
      const validatedInput = userProfileCreateSchema.parse(input);

      // Check if profile already exists for this user
      const existingProfile = await this.getProfileByUserId(validatedInput.userId);
      if (existingProfile) {
        throw new ValidationError('User profile already exists');
      }

      const profileData = {
        user_id: validatedInput.userId,
        full_name: validatedInput.fullName,
        display_name: validatedInput.displayName,
        timezone: validatedInput.timezone,
        role: validatedInput.role,
        preferences: validatedInput.preferences,
      };

      const [profile] = await database.query<any[]>(
        knex(this.tableName)
          .insert(profileData)
          .returning('*'),
        'user_profile_create'
      );

      logger.info('User profile created', {
        userId: validatedInput.userId,
        profileId: profile.id,
        fullName: validatedInput.fullName,
      });

      return this.mapDbProfileToProfile(profile);

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.issues[0]?.message || 'Validation failed');
      }

      // Handle PostgreSQL constraint violations (e.g., concurrent creation)
      if (error instanceof Error && (error as any).code === '23505') {
        // Check if profile was created by another process
        const existingProfile = await this.getProfileByUserId(input.userId);
        if (existingProfile) {
          throw new ValidationError('User profile already exists');
        }
      }

      logger.error('Failed to create user profile', {
        userId: input.userId,
        fullName: input.fullName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, input: UserProfileUpdateInput): Promise<UserProfile> {
    try {
      // Validate input
      const validatedInput = userProfileUpdateSchema.parse(input);

      // Check if profile exists
      const existingProfile = await this.getProfileByUserId(userId);
      if (!existingProfile) {
        throw new NotFoundError('User profile', userId);
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date(),
      };

      if (validatedInput.fullName !== undefined) {
        updateData.full_name = validatedInput.fullName;
      }
      if (validatedInput.displayName !== undefined) {
        updateData.display_name = validatedInput.displayName;
      }
      if (validatedInput.timezone !== undefined) {
        updateData.timezone = validatedInput.timezone;
      }
      if (validatedInput.role !== undefined) {
        updateData.role = validatedInput.role;
      }
      if (validatedInput.preferences !== undefined) {
        updateData.preferences = {
          ...existingProfile.preferences,
          ...validatedInput.preferences,
        };
      }

      const [updatedProfile] = await database.query<any[]>(
        knex(this.tableName)
          .where('user_id', userId)
          .update(updateData)
          .returning('*'),
        'user_profile_update'
      );

      logger.info('User profile updated', {
        userId,
        profileId: updatedProfile.id,
        updatedFields: Object.keys(updateData),
      });

      return this.mapDbProfileToProfile(updatedProfile);

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.issues[0]?.message || 'Validation failed');
      }

      logger.error('Failed to update user profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Create or update user profile (upsert)
   */
  async upsertProfile(input: UserProfileCreateInput): Promise<UserProfile> {
    try {
      const existingProfile = await this.getProfileByUserId(input.userId);

      if (existingProfile) {
        // Update existing profile
        const updateInput: UserProfileUpdateInput = {
          fullName: input.fullName,
          displayName: input.displayName,
          timezone: input.timezone,
          role: input.role,
          preferences: input.preferences,
        };

        return await this.updateProfile(input.userId, updateInput);
      } else {
        // Create new profile
        return await this.createProfile(input);
      }

    } catch (error) {
      logger.error('Failed to upsert user profile', {
        userId: input.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete user profile
   */
  async deleteProfile(userId: string): Promise<void> {
    try {
      // Check if profile exists
      const existingProfile = await this.getProfileByUserId(userId);
      if (!existingProfile) {
        throw new NotFoundError('User profile', userId);
      }

      await database.query(
        knex(this.tableName)
          .where('user_id', userId)
          .del(),
        'user_profile_delete'
      );

      logger.info('User profile deleted', { userId, profileId: existingProfile.id });

    } catch (error) {
      logger.error('Failed to delete user profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get profiles by full name (search functionality)
   */
  async searchProfiles(query: string, limit: number = 20): Promise<UserProfile[]> {
    try {
      const profiles = await database.query<any[]>(
        knex(this.tableName)
          .where(function() {
            this.whereILike('full_name', `%${query}%`)
                .orWhereILike('display_name', `%${query}%`);
          })
          .orderBy('full_name')
          .limit(limit),
        'user_profile_search'
      );

      return profiles.map(profile => this.mapDbProfileToProfile(profile));

    } catch (error) {
      logger.error('Failed to search user profiles', {
        query,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Map database profile record to UserProfile interface
   */
  private mapDbProfileToProfile(dbProfile: any): UserProfile {
    return {
      id: dbProfile.id,
      userId: dbProfile.user_id,
      fullName: dbProfile.full_name,
      displayName: dbProfile.display_name,
      timezone: dbProfile.timezone,
      role: dbProfile.role?.toUpperCase(),
      preferences: dbProfile.preferences ? {
        ...dbProfile.preferences,
        ...(dbProfile.preferences?.privacy && { 
          privacy: dbProfile.preferences.privacy.toUpperCase() 
        }),
      } : {},
      createdAt: new Date(dbProfile.created_at),
      updatedAt: new Date(dbProfile.updated_at),
    };
  }
}

