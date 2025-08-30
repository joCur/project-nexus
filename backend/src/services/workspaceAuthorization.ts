import { Knex, knex } from '@/database/connection';
import { CacheService } from '@/services/cache';
import { createContextLogger } from '@/utils/logger';
import { 
  AuthorizationError, 
  NotFoundError 
} from '@/utils/errors';
import { 
  WorkspaceRole,
  CacheKeys
} from '@/types/auth';

const logger = createContextLogger({ service: 'WorkspaceAuthorizationService' });

/**
 * Workspace member interface
 */
export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  permissions: string[];
  invitedBy?: string;
  joinedAt: Date;
  lastAccessed?: Date;
  memberSettings?: Record<string, any>;
  isActive: boolean;
}

/**
 * Permission levels for workspace operations
 */
export const WorkspacePermissions = {
  // Viewer permissions (read-only)
  VIEWER: [
    'workspace:read',
    'card:read',
    'connection:read',
    'canvas:read'
  ],
  
  // Editor permissions (viewer + edit)
  EDITOR: [
    'workspace:read',
    'card:read',
    'card:create',
    'card:update',
    'card:delete',
    'connection:read',
    'connection:create',
    'connection:update',
    'connection:delete',
    'canvas:read',
    'canvas:create',
    'canvas:update'
  ],
  
  // Admin permissions (editor + manage)
  ADMIN: [
    'workspace:read',
    'workspace:update',
    'workspace:invite',
    'workspace:manage_members',
    'card:read',
    'card:create',
    'card:update',
    'card:delete',
    'connection:read',
    'connection:create',
    'connection:update',
    'connection:delete',
    'canvas:read',
    'canvas:create',
    'canvas:update'
  ],
  
  // Owner permissions (all)
  OWNER: [
    'workspace:read',
    'workspace:update',
    'workspace:delete',
    'workspace:invite',
    'workspace:manage_members',
    'workspace:transfer_ownership',
    'card:read',
    'card:create',
    'card:update',
    'card:delete',
    'connection:read',
    'connection:create',
    'connection:update',
    'connection:delete',
    'canvas:read',
    'canvas:create',
    'canvas:update'
  ]
} as const;

/**
 * Service for handling workspace authorization and member management
 */
/**
 * Cache configuration constants for permission system
 */
const PERMISSION_CACHE_CONFIG = {
  MEMBER_PERMISSIONS_TTL: 300, // 5 minutes
  NON_MEMBER_TTL: 60,          // 1 minute
  WORKSPACE_MEMBER_TTL: 300    // 5 minutes (existing)
} as const;

export class WorkspaceAuthorizationService {
  private db: Knex;
  private cacheService: CacheService;
  private readonly CACHE_TTL = PERMISSION_CACHE_CONFIG.WORKSPACE_MEMBER_TTL;

  constructor() {
    this.db = knex;
    this.cacheService = new CacheService();
  }

  /**
   * Type-safe cache getter for permission arrays
   */
  private async getCachedPermissions(key: string): Promise<string[] | null> {
    try {
      const cached = await this.cacheService.get(key);
      if (cached && Array.isArray(cached)) {
        return cached as string[];
      }
      return null;
    } catch (error) {
      // Cache error shouldn't break permission resolution
      return null;
    }
  }

  /**
   * Type-safe cache getter for permission context map
   */
  private async getCachedPermissionContext(key: string): Promise<{ [workspaceId: string]: string[] } | null> {
    try {
      const cached = await this.cacheService.get(key);
      if (cached && typeof cached === 'object' && cached !== null) {
        return cached as { [workspaceId: string]: string[] };
      }
      return null;
    } catch (error) {
      // Cache error shouldn't break permission resolution
      return null;
    }
  }

  /**
   * Check if user has access to workspace
   */
  async hasWorkspaceAccess(
    userId: string, 
    workspaceId: string,
    requiredPermission?: string
  ): Promise<boolean> {
    try {
      const member = await this.getWorkspaceMember(userId, workspaceId);
      
      if (!member || !member.isActive) {
        return false;
      }

      // If no specific permission required, just check membership
      if (!requiredPermission) {
        return true;
      }

      // Check if user has required permission
      return this.hasPermission(member, requiredPermission);
    } catch (error) {
      logger.error('Failed to check workspace access', {
        userId,
        workspaceId,
        requiredPermission,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get workspace member details
   */
  async getWorkspaceMember(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceMember | null> {
    // Check cache first
    const cacheKey = `workspace_member:${workspaceId}:${userId}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached as unknown as WorkspaceMember;
    }

    try {
      const member = await this.db('workspace_members')
        .where({
          user_id: userId,
          workspace_id: workspaceId,
          is_active: true
        })
        .first();

      if (!member) {
        // Check if user is the workspace owner (legacy support)
        const workspace = await this.db('workspaces')
          .where({ id: workspaceId, owner_id: userId })
          .first();
        
        if (workspace) {
          // Create virtual member entry for owner
          const ownerMember: WorkspaceMember = {
            id: `owner-${workspaceId}-${userId}`,
            workspaceId,
            userId,
            role: 'owner',
            permissions: [...WorkspacePermissions.OWNER],
            joinedAt: workspace.created_at,
            isActive: true
          };
          
          // Cache the result
          await this.cacheService.set(cacheKey, ownerMember, this.CACHE_TTL);
          return ownerMember;
        }
        
        return null;
      }

      const workspaceMember: WorkspaceMember = {
        id: member.id,
        workspaceId: member.workspace_id,
        userId: member.user_id,
        role: member.role,
        permissions: member.permissions || this.getRolePermissions(member.role),
        invitedBy: member.invited_by,
        joinedAt: member.joined_at,
        lastAccessed: member.last_accessed,
        memberSettings: member.member_settings,
        isActive: member.is_active
      };

      // Update last accessed time
      await this.updateLastAccessed(workspaceMember.id);

      // Cache the result
      await this.cacheService.set(cacheKey, workspaceMember, this.CACHE_TTL);

      return workspaceMember;
    } catch (error) {
      logger.error('Failed to get workspace member', {
        userId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get all members of a workspace
   */
  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    try {
      const members = await this.db('workspace_members')
        .where({ workspace_id: workspaceId, is_active: true })
        .orderBy('joined_at', 'asc');

      // Also include the owner from workspaces table
      const workspace = await this.db('workspaces')
        .where({ id: workspaceId })
        .first();

      const allMembers: WorkspaceMember[] = [];

      // Add owner if not already in members
      if (workspace && !members.find(m => m.user_id === workspace.owner_id)) {
        allMembers.push({
          id: `owner-${workspaceId}-${workspace.owner_id}`,
          workspaceId,
          userId: workspace.owner_id,
          role: 'owner',
          permissions: [...WorkspacePermissions.OWNER],
          joinedAt: workspace.created_at,
          isActive: true
        });
      }

      // Add all members
      for (const member of members) {
        allMembers.push({
          id: member.id,
          workspaceId: member.workspace_id,
          userId: member.user_id,
          role: member.role,
          permissions: member.permissions || this.getRolePermissions(member.role),
          invitedBy: member.invited_by,
          joinedAt: member.joined_at,
          lastAccessed: member.last_accessed,
          memberSettings: member.member_settings,
          isActive: member.is_active
        });
      }

      return allMembers;
    } catch (error) {
      logger.error('Failed to get workspace members', {
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Add member to workspace
   */
  async addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    invitedBy: string,
    additionalPermissions?: string[]
  ): Promise<WorkspaceMember> {
    try {
      // Check if member already exists
      const existing = await this.db('workspace_members')
        .where({ workspace_id: workspaceId, user_id: userId })
        .first();

      if (existing) {
        if (existing.is_active) {
          throw new Error('User is already a member of this workspace');
        }
        
        // Reactivate inactive member
        await this.db('workspace_members')
          .where({ id: existing.id })
          .update({
            role,
            permissions: additionalPermissions || this.getRolePermissions(role),
            is_active: true,
            joined_at: this.db.fn.now(),
            updated_at: this.db.fn.now()
          });

        return this.getWorkspaceMember(userId, workspaceId) as Promise<WorkspaceMember>;
      }

      // Create new member
      const [member] = await this.db('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role,
          permissions: additionalPermissions || this.getRolePermissions(role),
          invited_by: invitedBy,
          is_active: true
        })
        .returning('*');

      // Clear cache
      await this.invalidatePermissionCaches(userId, workspaceId);

      logger.info('Added workspace member', {
        workspaceId,
        userId,
        role,
        invitedBy
      });

      return {
        id: member.id,
        workspaceId: member.workspace_id,
        userId: member.user_id,
        role: member.role,
        permissions: member.permissions,
        invitedBy: member.invited_by,
        joinedAt: member.joined_at,
        isActive: member.is_active
      };
    } catch (error) {
      logger.error('Failed to add workspace member', {
        workspaceId,
        userId,
        role,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    newRole: WorkspaceRole,
    updatedBy: string
  ): Promise<void> {
    try {
      // Can't change owner role through this method
      if (newRole === 'owner') {
        throw new Error('Cannot set owner role directly. Use transferOwnership instead.');
      }

      const member = await this.getWorkspaceMember(userId, workspaceId);
      if (!member) {
        throw new NotFoundError('Workspace member', `${workspaceId}:${userId}`);
      }

      if (member.role === 'owner') {
        throw new Error('Cannot change owner role. Transfer ownership instead.');
      }

      await this.db('workspace_members')
        .where({
          workspace_id: workspaceId,
          user_id: userId
        })
        .update({
          role: newRole,
          permissions: this.getRolePermissions(newRole),
          updated_at: this.db.fn.now()
        });

      // Clear cache
      await this.invalidatePermissionCaches(userId, workspaceId);

      logger.info('Updated member role', {
        workspaceId,
        userId,
        newRole,
        updatedBy
      });
    } catch (error) {
      logger.error('Failed to update member role', {
        workspaceId,
        userId,
        newRole,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Remove member from workspace
   */
  async removeMember(
    workspaceId: string,
    userId: string,
    removedBy: string
  ): Promise<void> {
    try {
      const member = await this.getWorkspaceMember(userId, workspaceId);
      if (!member) {
        throw new NotFoundError('Workspace member', `${workspaceId}:${userId}`);
      }

      if (member.role === 'owner') {
        throw new Error('Cannot remove workspace owner');
      }

      // Soft delete by setting is_active to false
      await this.db('workspace_members')
        .where({
          workspace_id: workspaceId,
          user_id: userId
        })
        .update({
          is_active: false,
          updated_at: this.db.fn.now()
        });

      // Clear cache
      await this.invalidatePermissionCaches(userId, workspaceId);

      logger.info('Removed workspace member', {
        workspaceId,
        userId,
        removedBy
      });
    } catch (error) {
      logger.error('Failed to remove workspace member', {
        workspaceId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if member has specific permission
   */
  private hasPermission(member: WorkspaceMember, permission: string): boolean {
    // Check role-based permissions
    const rolePermissions = this.getRolePermissions(member.role);
    if (rolePermissions.includes(permission)) {
      return true;
    }

    // Check additional permissions
    return member.permissions.includes(permission);
  }

  /**
   * Get default permissions for a role
   */
  private getRolePermissions(role: WorkspaceRole): string[] {
    switch (role) {
      case 'owner':
        return [...WorkspacePermissions.OWNER];
      case 'admin':
        return [...WorkspacePermissions.ADMIN];
      case 'member': // Database stores 'member' role but maps to EDITOR permissions for backward compatibility
        return [...WorkspacePermissions.EDITOR];
      case 'viewer':
        return [...WorkspacePermissions.VIEWER];
      default:
        return [...WorkspacePermissions.VIEWER];
    }
  }

  /**
   * Update last accessed timestamp
   */
  private async updateLastAccessed(memberId: string): Promise<void> {
    try {
      await this.db('workspace_members')
        .where({ id: memberId })
        .update({ last_accessed: this.db.fn.now() });
    } catch (error) {
      // Non-critical error, just log it
      logger.warn('Failed to update last accessed time', {
        memberId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Invalidate all permission-related caches for a user and workspace
   */
  private async invalidatePermissionCaches(userId: string, workspaceId: string): Promise<void> {
    try {
      const cacheKeys = [
        // Existing caches
        `workspace_member:${workspaceId}:${userId}`,
        CacheKeys.WORKSPACE_MEMBERS(workspaceId),
        
        // New permission-specific caches
        `user_permissions:${userId}:${workspaceId}`,
        `user_context_permissions:${userId}`
      ];

      await Promise.all(cacheKeys.map(key => this.cacheService.del(key)));

      logger.debug('Invalidated permission caches', {
        userId,
        workspaceId,
        cacheKeys: cacheKeys.length
      });
    } catch (error) {
      logger.warn('Failed to invalidate permission caches', {
        userId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Validate permission requirements
   */
  async requirePermission(
    userId: string,
    workspaceId: string,
    permission: string,
    errorMessage?: string
  ): Promise<WorkspaceMember> {
    const member = await this.getWorkspaceMember(userId, workspaceId);
    
    if (!member || !member.isActive) {
      throw new AuthorizationError(
        errorMessage || 'Not a member of this workspace',
        'WORKSPACE_ACCESS_DENIED',
        permission,
        []
      );
    }

    if (!this.hasPermission(member, permission)) {
      throw new AuthorizationError(
        errorMessage || `Insufficient permissions for ${permission}`,
        'INSUFFICIENT_PERMISSIONS',
        permission,
        member.permissions
      );
    }

    return member;
  }

  /**
   * Get all permissions for a user in a specific workspace
   * 
   * Resolves role-based permissions combined with any custom permissions.
   * Handles both workspace members and owners (who might not be in workspace_members table).
   * Results are cached in Redis with appropriate TTL.
   * 
   * @param userId - The user's ID
   * @param workspaceId - The workspace ID
   * @returns Promise resolving to array of permission strings, or empty array if not a member
   */
  async getUserPermissionsInWorkspace(userId: string, workspaceId: string): Promise<string[]> {
    // Check cache first
    const cacheKey = `user_permissions:${userId}:${workspaceId}`;
    const cached = await this.getCachedPermissions(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const member = await this.getWorkspaceMember(userId, workspaceId);
      
      if (!member || !member.isActive) {
        // Cache empty result briefly to avoid repeated DB queries
        await this.cacheService.set(cacheKey, [], PERMISSION_CACHE_CONFIG.NON_MEMBER_TTL);
        return [];
      }

      // Get role-based permissions
      const rolePermissions = this.getRolePermissions(member.role);
      
      // Combine role-based permissions with custom permissions
      // Use Set to automatically deduplicate permissions that may exist in both role and custom arrays
      const allPermissions = Array.from(new Set([
        ...rolePermissions,
        ...(member.permissions || [])
      ]));

      // Cache the result
      await this.cacheService.set(cacheKey, allPermissions, PERMISSION_CACHE_CONFIG.MEMBER_PERMISSIONS_TTL);

      logger.debug('Resolved user permissions in workspace', {
        userId,
        workspaceId,
        role: member.role,
        permissionCount: allPermissions.length
      });

      return allPermissions;
    } catch (error) {
      logger.error('Failed to get user permissions in workspace', {
        userId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Get user's role in a workspace
   * 
   * Returns the user's workspace role, handling both workspace members
   * and owners who might not be in the workspace_members table.
   * 
   * @param userId - The user's ID
   * @param workspaceId - The workspace ID
   * @returns Promise resolving to WorkspaceRole or null if user is not a member
   */
  async getUserWorkspaceRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
    try {
      const member = await this.getWorkspaceMember(userId, workspaceId);
      
      if (!member || !member.isActive) {
        return null;
      }

      logger.debug('Resolved user workspace role', {
        userId,
        workspaceId,
        role: member.role
      });

      return member.role;
    } catch (error) {
      logger.error('Failed to get user workspace role', {
        userId,
        workspaceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Check if user has specific permission in workspace
   * 
   * More efficient than getUserPermissionsInWorkspace when checking a single permission.
   * Uses role-based permissions combined with custom permissions.
   * 
   * @param userId - The user's ID
   * @param workspaceId - The workspace ID
   * @param permission - The permission to check for
   * @returns Promise resolving to true if user has the permission, false otherwise
   */
  async hasPermissionInWorkspace(userId: string, workspaceId: string, permission: string): Promise<boolean> {
    try {
      const member = await this.getWorkspaceMember(userId, workspaceId);
      
      if (!member || !member.isActive) {
        return false;
      }

      const hasPermission = this.hasPermission(member, permission);

      logger.debug('Checked permission in workspace', {
        userId,
        workspaceId,
        permission,
        hasPermission,
        role: member.role
      });

      return hasPermission;
    } catch (error) {
      logger.error('Failed to check permission in workspace', {
        userId,
        workspaceId,
        permission,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get permissions across all user's workspaces
   * 
   * Returns a mapping of workspace IDs to permission arrays for all workspaces
   * the user has access to. This is used for GraphQL context resolution and
   * efficient permission checking across multiple workspaces.
   * 
   * @param userId - The user's ID
   * @returns Promise resolving to object mapping workspaceId to permissions array
   */
  async getUserPermissionsForContext(userId: string): Promise<{ [workspaceId: string]: string[] }> {
    // Check cache first
    const cacheKey = `user_context_permissions:${userId}`;
    const cached = await this.getCachedPermissionContext(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // TODO: Consider optimizing with a single JOIN query for better performance at scale
      // Current approach uses two separate queries for clarity and maintainability
      
      // Get all workspaces user is a member of
      const memberWorkspaces = await this.db('workspace_members')
        .select('workspace_id', 'role', 'permissions')
        .where({
          user_id: userId,
          is_active: true
        });

      // Get all workspaces user owns
      const ownedWorkspaces = await this.db('workspaces')
        .select('id')
        .where({ owner_id: userId });

      const permissionsMap: { [workspaceId: string]: string[] } = {};

      // Process member workspaces
      for (const member of memberWorkspaces) {
        const rolePermissions = this.getRolePermissions(member.role);
        const customPermissions = member.permissions || [];
        
        permissionsMap[member.workspace_id] = Array.from(new Set([
          ...rolePermissions,
          ...customPermissions
        ]));
      }

      // Process owned workspaces (in case owner is not in members table)
      for (const workspace of ownedWorkspaces) {
        if (!permissionsMap[workspace.id]) {
          permissionsMap[workspace.id] = [...WorkspacePermissions.OWNER];
        }
      }

      // Cache the result with shorter TTL since this is more dynamic
      await this.cacheService.set(cacheKey, permissionsMap, PERMISSION_CACHE_CONFIG.MEMBER_PERMISSIONS_TTL);

      logger.debug('Resolved user permissions for context', {
        userId,
        workspaceCount: Object.keys(permissionsMap).length
      });

      return permissionsMap;
    } catch (error) {
      logger.error('Failed to get user permissions for context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {};
    }
  }
}