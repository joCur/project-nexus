import { database, knex } from '@/database/connection';
import { 
  User, 
  UserCreateInput, 
  UserUpdateInput, 
  PaginationInput, 
  PaginationResponse 
} from '@/types';
import { 
  NotFoundError, 
  UniqueConstraintError as _UniqueConstraintError, 
  ValidationError 
} from '@/utils/errors';
import { createContextLogger } from '@/utils/logger';
import { z } from 'zod';

/**
 * User Service - Repository layer for user management
 * Implements user CRUD operations with Auth0 integration
 */

const logger = createContextLogger({ service: 'UserService' });

// Validation schemas
const userCreateSchema = z.object({
  email: z.string().email('Invalid email format'),
  auth0UserId: z.string().min(1, 'Auth0 user ID is required'),
  emailVerified: z.boolean().optional().default(false),
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
  roles: z.array(z.string()).optional().default([]),
});

const userUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
  roles: z.array(z.string()).optional(),
  lastLogin: z.date().optional(),
});

const paginationSchema = z.object({
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
  sortBy: z.string().optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export class UserService {
  private readonly tableName = 'users';

  /**
   * Create a new user
   */
  async create(input: UserCreateInput): Promise<User> {
    try {
      // Validate input
      const validatedInput = userCreateSchema.parse(input);

      const userData = {
        email: validatedInput.email,
        auth0_user_id: validatedInput.auth0UserId,
        email_verified: validatedInput.emailVerified,
        display_name: validatedInput.displayName,
        avatar_url: validatedInput.avatarUrl,
        roles: JSON.stringify(validatedInput.roles || []),
        metadata_synced_at: new Date(),
      };

      const [user] = await database.query<User[]>(
        knex(this.tableName)
          .insert(userData)
          .returning('*'),
        'user_create'
      );

      logger.info('User created', {
        userId: user.id,
        email: user.email,
        auth0UserId: user.auth0UserId,
      });

      return this.mapDbUserToUser(user);

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      logger.error('Failed to create user', {
        email: input.email,
        auth0UserId: input.auth0UserId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      const user = await database.query<any>(
        knex(this.tableName)
          .where('id', id)
          .first(),
        'user_find_by_id'
      );

      return user ? this.mapDbUserToUser(user) : null;

    } catch (error) {
      logger.error('Failed to find user by ID', {
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find user by Auth0 ID
   */
  async findByAuth0Id(auth0UserId: string): Promise<User | null> {
    try {
      const user = await database.query<any>(
        knex(this.tableName)
          .where('auth0_user_id', auth0UserId)
          .first(),
        'user_find_by_auth0_id'
      );

      return user ? this.mapDbUserToUser(user) : null;

    } catch (error) {
      logger.error('Failed to find user by Auth0 ID', {
        auth0UserId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await database.query<any>(
        knex(this.tableName)
          .where('email', email.toLowerCase())
          .first(),
        'user_find_by_email'
      );

      return user ? this.mapDbUserToUser(user) : null;

    } catch (error) {
      logger.error('Failed to find user by email', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update user
   */
  async update(id: string, input: UserUpdateInput): Promise<User> {
    try {
      // Validate input
      const validatedInput = userUpdateSchema.parse(input);

      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundError('User', id);
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date(),
      };

      if (validatedInput.displayName !== undefined) {
        updateData.display_name = validatedInput.displayName;
      }
      if (validatedInput.avatarUrl !== undefined) {
        updateData.avatar_url = validatedInput.avatarUrl;
      }
      if (validatedInput.roles !== undefined) {
        updateData.roles = JSON.stringify(validatedInput.roles);
        updateData.metadata_synced_at = new Date();
      }
      if (validatedInput.lastLogin !== undefined) {
        updateData.last_login = validatedInput.lastLogin;
      }

      const [updatedUser] = await database.query<any[]>(
        knex(this.tableName)
          .where('id', id)
          .update(updateData)
          .returning('*'),
        'user_update'
      );

      logger.info('User updated', {
        userId: id,
        updatedFields: Object.keys(updateData),
      });

      return this.mapDbUserToUser(updatedUser);

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message || 'Validation failed');
      }

      logger.error('Failed to update user', {
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Delete user (soft delete by marking as inactive)
   */
  async delete(id: string): Promise<void> {
    try {
      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundError('User', id);
      }

      // In a real application, you might want to soft delete or handle cascade deletions
      // For now, we'll do a hard delete as per the database schema
      await database.query(
        knex(this.tableName)
          .where('id', id)
          .del(),
        'user_delete'
      );

      logger.info('User deleted', { userId: id });

    } catch (error) {
      logger.error('Failed to delete user', {
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * List users with pagination
   */
  async list(input: PaginationInput = {}): Promise<PaginationResponse<User>> {
    try {
      // Validate pagination input
      const { page, limit, sortBy, sortOrder } = paginationSchema.parse(input);

      const offset = (page - 1) * limit;

      // Get total count
      const [{ count }] = await database.query<[{ count: string }]>(
        knex(this.tableName).count('id as count'),
        'user_count'
      );

      const totalCount = parseInt(count, 10);

      // Get paginated users
      const users = await database.query<any[]>(
        knex(this.tableName)
          .orderBy(sortBy, sortOrder)
          .limit(limit)
          .offset(offset),
        'user_list'
      );

      const mappedUsers = users.map(user => this.mapDbUserToUser(user));

      return {
        items: mappedUsers,
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPreviousPage: page > 1,
      };

    } catch (error) {
      logger.error('Failed to list users', {
        input,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Search users by display name or email
   */
  async search(query: string, limit: number = 20): Promise<User[]> {
    try {
      const users = await database.query<any[]>(
        knex(this.tableName)
          .where(function() {
            this.whereILike('display_name', `%${query}%`)
                .orWhereILike('email', `%${query}%`);
          })
          .orderBy('display_name')
          .limit(limit),
        'user_search'
      );

      return users.map(user => this.mapDbUserToUser(user));

    } catch (error) {
      logger.error('Failed to search users', {
        query,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      await database.query(
        knex(this.tableName)
          .where('id', id)
          .update({ last_login: new Date() }),
        'user_update_last_login'
      );

    } catch (error) {
      logger.error('Failed to update last login', {
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw error for last login update failures
    }
  }

  /**
   * Get user's workspace memberships
   */
  async getUserWorkspaces(userId: string): Promise<string[]> {
    try {
      const memberships = await database.query<{ workspace_id: string }[]>(
        knex('workspace_members')
          .select('workspace_id')
          .where('user_id', userId),
        'user_workspaces'
      );

      return memberships.map(m => m.workspace_id);

    } catch (error) {
      logger.error('Failed to get user workspaces', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Map database user record to User interface
   */
  private mapDbUserToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      auth0UserId: dbUser.auth0_user_id,
      emailVerified: dbUser.email_verified,
      displayName: dbUser.display_name,
      avatarUrl: dbUser.avatar_url,
      lastLogin: dbUser.last_login ? new Date(dbUser.last_login) : undefined,
      auth0UpdatedAt: dbUser.auth0_updated_at ? new Date(dbUser.auth0_updated_at) : undefined,
      createdAt: new Date(dbUser.created_at),
      updatedAt: new Date(dbUser.updated_at),
      roles: typeof dbUser.roles === 'string' ? JSON.parse(dbUser.roles) : (dbUser.roles || []),
      permissions: typeof dbUser.permissions === 'string' ? JSON.parse(dbUser.permissions) : (dbUser.permissions || []),
      metadataSyncedAt: new Date(dbUser.metadata_synced_at),
    };
  }
}