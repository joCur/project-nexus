import { Knex, knex } from '@/database/connection';
import { createContextLogger } from '@/utils/logger';
import { 
  AuthorizationError, 
  NotFoundError,
  ValidationError 
} from '@/utils/errors';
import { 
  WorkspaceRole
} from '@/types/auth';
import { WorkspaceAuthorizationService } from './workspaceAuthorization';
import crypto from 'crypto';

const logger = createContextLogger({ service: 'WorkspaceInvitationService' });

/**
 * Workspace invitation interface
 */
export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  invitedBy: string;
  email: string;
  userId?: string;
  role: WorkspaceRole;
  permissions: string[];
  token: string;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  acceptedAt?: Date;
  rejectedAt?: Date;
  cancelledAt?: Date;
  message?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service for handling workspace invitations
 */
export class WorkspaceInvitationService {
  private db: Knex;
  private authService: WorkspaceAuthorizationService;
  private readonly DEFAULT_EXPIRE_DAYS = 7;
  private readonly TOKEN_LENGTH = 32;

  constructor() {
    this.db = knex;
    this.authService = new WorkspaceAuthorizationService();
  }

  /**
   * Create a workspace invitation
   */
  async createInvite(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    invitedBy: string,
    message?: string,
    additionalPermissions?: string[]
  ): Promise<WorkspaceInvite> {
    try {
      // Validate inviter has permission
      await this.authService.requirePermission(
        invitedBy,
        workspaceId,
        'workspace:invite',
        'You do not have permission to invite members to this workspace'
      );

      // Check for existing pending invite
      const existingInvite = await this.db('workspace_invites')
        .where({
          workspace_id: workspaceId,
          email: email.toLowerCase(),
          status: 'pending'
        })
        .first();

      if (existingInvite) {
        throw new ValidationError('An invitation for this email is already pending');
      }

      // Check if user is already a member
      const existingUser = await this.db('users')
        .where({ email: email.toLowerCase() })
        .first();

      if (existingUser) {
        const existingMember = await this.authService.getWorkspaceMember(
          existingUser.id,
          workspaceId
        );
        
        if (existingMember && existingMember.isActive) {
          throw new ValidationError('User is already a member of this workspace');
        }
      }

      // Cannot invite as owner
      if (role === 'owner') {
        throw new ValidationError('Cannot invite users as owner. Use transfer ownership instead.');
      }

      // Generate secure token
      const token = this.generateSecureToken();

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.DEFAULT_EXPIRE_DAYS);

      // Create invitation
      const [invite] = await this.db('workspace_invites')
        .insert({
          workspace_id: workspaceId,
          invited_by: invitedBy,
          email: email.toLowerCase(),
          user_id: existingUser?.id,
          role,
          permissions: additionalPermissions || [],
          token,
          expires_at: expiresAt,
          status: 'pending',
          message,
          metadata: {}
        })
        .returning('*');

      logger.info('Created workspace invitation', {
        inviteId: invite.id,
        workspaceId,
        email: email.toLowerCase(),
        role,
        invitedBy,
        expiresAt
      });

      return this.mapToInvite(invite);
    } catch (error) {
      logger.error('Failed to create workspace invitation', {
        workspaceId,
        email,
        role,
        invitedBy,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Accept an invitation
   */
  async acceptInvite(token: string, userId: string): Promise<void> {
    try {
      // Find invitation by token
      const invite = await this.db('workspace_invites')
        .where({ token, status: 'pending' })
        .first();

      if (!invite) {
        throw new NotFoundError('Invitation', token);
      }

      // Check expiration
      if (new Date(invite.expires_at) < new Date()) {
        await this.db('workspace_invites')
          .where({ id: invite.id })
          .update({ 
            status: 'expired',
            updated_at: this.db.fn.now()
          });
        throw new ValidationError('This invitation has expired');
      }

      // Verify user email matches invitation (if user has email)
      const user = await this.db('users').where({ id: userId }).first();
      if (user && user.email.toLowerCase() !== invite.email.toLowerCase()) {
        throw new ValidationError('This invitation was sent to a different email address');
      }

      // Start transaction
      await this.db.transaction(async (trx) => {
        // Add user as workspace member
        await this.authService.addWorkspaceMember(
          invite.workspace_id,
          userId,
          invite.role,
          invite.invited_by,
          invite.permissions?.length > 0 ? invite.permissions : undefined
        );

        // Update invitation status
        await trx('workspace_invites')
          .where({ id: invite.id })
          .update({
            status: 'accepted',
            accepted_at: trx.fn.now(),
            user_id: userId,
            updated_at: trx.fn.now()
          });
      });

      logger.info('Accepted workspace invitation', {
        inviteId: invite.id,
        workspaceId: invite.workspace_id,
        userId,
        role: invite.role
      });
    } catch (error) {
      logger.error('Failed to accept invitation', {
        token,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Reject an invitation
   */
  async rejectInvite(token: string): Promise<void> {
    try {
      const invite = await this.db('workspace_invites')
        .where({ token, status: 'pending' })
        .first();

      if (!invite) {
        throw new NotFoundError('Invitation', token);
      }

      await this.db('workspace_invites')
        .where({ id: invite.id })
        .update({
          status: 'rejected',
          rejected_at: this.db.fn.now(),
          updated_at: this.db.fn.now()
        });

      logger.info('Rejected workspace invitation', {
        inviteId: invite.id,
        workspaceId: invite.workspace_id
      });
    } catch (error) {
      logger.error('Failed to reject invitation', {
        token,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Cancel an invitation
   */
  async cancelInvite(inviteId: string, cancelledBy: string): Promise<void> {
    try {
      const invite = await this.db('workspace_invites')
        .where({ id: inviteId, status: 'pending' })
        .first();

      if (!invite) {
        throw new NotFoundError('Invitation', inviteId);
      }

      // Verify canceller has permission
      await this.authService.requirePermission(
        cancelledBy,
        invite.workspace_id,
        'workspace:invite',
        'You do not have permission to cancel invitations'
      );

      await this.db('workspace_invites')
        .where({ id: inviteId })
        .update({
          status: 'cancelled',
          cancelled_at: this.db.fn.now(),
          updated_at: this.db.fn.now()
        });

      logger.info('Cancelled workspace invitation', {
        inviteId,
        workspaceId: invite.workspace_id,
        cancelledBy
      });
    } catch (error) {
      logger.error('Failed to cancel invitation', {
        inviteId,
        cancelledBy,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get invitations for a workspace
   */
  async getWorkspaceInvites(
    workspaceId: string,
    requesterId: string,
    includePast = false
  ): Promise<WorkspaceInvite[]> {
    try {
      // Verify requester has access
      const hasAccess = await this.authService.hasWorkspaceAccess(
        requesterId,
        workspaceId,
        'workspace:read'
      );

      if (!hasAccess) {
        throw new AuthorizationError(
          'You do not have access to view invitations for this workspace',
          'WORKSPACE_ACCESS_DENIED'
        );
      }

      let query = this.db('workspace_invites')
        .where({ workspace_id: workspaceId });

      if (!includePast) {
        query = query.where({ status: 'pending' });
      }

      const invites = await query.orderBy('created_at', 'desc');

      return invites.map(this.mapToInvite);
    } catch (error) {
      logger.error('Failed to get workspace invitations', {
        workspaceId,
        requesterId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get invitations for a user by email
   */
  async getUserInvites(email: string): Promise<WorkspaceInvite[]> {
    try {
      const invites = await this.db('workspace_invites')
        .where({ 
          email: email.toLowerCase(),
          status: 'pending'
        })
        .where('expires_at', '>', this.db.fn.now())
        .orderBy('created_at', 'desc');

      return invites.map(this.mapToInvite);
    } catch (error) {
      logger.error('Failed to get user invitations', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Get invitation by token
   */
  async getInviteByToken(token: string): Promise<WorkspaceInvite | null> {
    try {
      const invite = await this.db('workspace_invites')
        .where({ token })
        .first();

      if (!invite) {
        return null;
      }

      return this.mapToInvite(invite);
    } catch (error) {
      logger.error('Failed to get invitation by token', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Expire old invitations
   */
  async expireOldInvitations(): Promise<number> {
    try {
      const result = await this.db('workspace_invites')
        .where('status', 'pending')
        .where('expires_at', '<', this.db.fn.now())
        .update({
          status: 'expired',
          updated_at: this.db.fn.now()
        });

      if (result > 0) {
        logger.info('Expired old invitations', { count: result });
      }

      return result;
    } catch (error) {
      logger.error('Failed to expire old invitations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Generate a secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  /**
   * Map database record to WorkspaceInvite interface
   */
  private mapToInvite(record: any): WorkspaceInvite {
    return {
      id: record.id,
      workspaceId: record.workspace_id,
      invitedBy: record.invited_by,
      email: record.email,
      userId: record.user_id,
      role: record.role,
      permissions: record.permissions || [],
      token: record.token,
      expiresAt: record.expires_at,
      status: record.status,
      acceptedAt: record.accepted_at,
      rejectedAt: record.rejected_at,
      cancelledAt: record.cancelled_at,
      message: record.message,
      metadata: record.metadata,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }
}