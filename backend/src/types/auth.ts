/**
 * Auth0 and authentication-related type definitions
 * Based on technical architecture specifications
 * 
 * Breaking Changes (NEX-184):
 * - Removed Auth0 permission synchronization fields
 * - Removed GraphQL mutations: grantPermissions, revokePermissions
 * - Removed GraphQL query: getUserPermissions
 * - Auth0User interface no longer includes 'permissions' field
 * 
 * Migration Guide:
 * - Replace getUserPermissions queries with WorkspaceAuthorizationService.getUserPermissions()
 * - Replace grantPermissions mutations with workspace-based permission assignments
 * - Use workspace authorization system for all permission operations
 * 
 * @see WorkspaceAuthorizationService for new permission management
 */

export interface Auth0User {
  sub: string; // Auth0 user ID
  username?: string; // Auth0 username
  name?: string;
  picture?: string;
  updated_at?: string;
  iss: string; // Auth0 issuer
  aud: string; // Auth0 audience
  iat: number; // issued at
  exp: number; // expires at
  scope: string; // OAuth scopes
  
  // Clean field names mapped from custom claims and standard fields
  email?: string; // Email from custom claims or standard field
  roles?: string[]; // User roles from custom claims
  userId?: string; // Internal user ID from custom claims
}

export interface User {
  id: string;
  email: string;
  auth0UserId: string; // Auth0 'sub' field
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
  lastLogin?: Date;
  auth0UpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Auth0 metadata cache for performance
  roles: string[];
  permissions: string[];
  metadataSyncedAt: Date;
}

export interface UserCreateInput {
  email: string;
  auth0UserId: string;
  emailVerified?: boolean;
  displayName?: string;
  avatarUrl?: string;
  roles?: string[];
}

export interface UserUpdateInput {
  displayName?: string;
  avatarUrl?: string;
  roles?: string[];
  lastLogin?: Date;
}

export interface AuthContext {
  user?: User;
  auth0Payload?: Auth0User;
  isAuthenticated: boolean;
  dataSources: {
    auth0Service: import('@/services/auth0').Auth0Service;
    userService: import('@/services/user').UserService;
    cacheService: import('@/services/cache').CacheService;
    userProfileService: import('@/services/userProfile').UserProfileService;
    onboardingService: import('@/services/onboarding').OnboardingService;
    workspaceService: import('@/services/workspace').WorkspaceService;
    workspaceAuthorizationService: import('@/services/workspaceAuthorization').WorkspaceAuthorizationService;
  };
}

export interface SessionData {
  userId: string;
  auth0UserId: string;
  email: string;
  roles: string[];
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface WorkspacePermission {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  permissions: string[];
  grantedBy?: string;
  grantedAt: Date;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface AuthenticationError extends Error {
  code: 'UNAUTHENTICATED' | 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'EMAIL_NOT_VERIFIED';
  statusCode: number;
}

export interface AuthorizationError extends Error {
  code: 'FORBIDDEN' | 'INSUFFICIENT_PERMISSIONS' | 'WORKSPACE_ACCESS_DENIED';
  statusCode: number;
  requiredPermission?: string;
  userPermissions?: string[];
}

// Auth0 Management API types
export interface Auth0ManagementUser {
  user_id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at: string;
  created_at: string;
  last_login?: string;
  login_count: number;
  app_metadata?: {
    roles?: string[];
    permissions?: string[];
  };
  user_metadata?: Record<string, unknown>;
}

export interface Auth0TokenPayload {
  sub: string;
  username?: string;
  email?: string; // For tests and some configurations
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  scope: string;
  
  // Custom claims
  'https://api.nexus-app.de/email'?: string;
  [key: string]: unknown;
}

// Cache key patterns for Redis
export const CacheKeys = {
  USER_SESSION: (userId: string) => `session:${userId}`,
  USER_PERMISSIONS: (userId: string) => `permissions:${userId}`,
  USER_WORKSPACES: (userId: string) => `workspaces:${userId}`,
  WORKSPACE_MEMBERS: (workspaceId: string) => `workspace_members:${workspaceId}`,
  AUTH0_USER: (auth0UserId: string) => `auth0_user:${auth0UserId}`,
  JWKS: () => 'auth0_jwks',
} as const;

// Session configuration
export const SessionConfig = {
  ABSOLUTE_DURATION: 4 * 60 * 60 * 1000, // 4 hours
  INACTIVITY_DURATION: 30 * 60 * 1000,   // 30 minutes
  REFRESH_THRESHOLD: 15 * 60 * 1000,     // Refresh if expires in 15 minutes
} as const;

// Permission constants
export const Permissions = {
  // Card permissions
  CARD_CREATE: 'card:create',
  CARD_READ: 'card:read',
  CARD_UPDATE: 'card:update',
  CARD_DELETE: 'card:delete',
  
  // Workspace permissions
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_READ: 'workspace:read',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_INVITE: 'workspace:invite',
  WORKSPACE_MANAGE_MEMBERS: 'workspace:manage_members',
  
  // AI permissions
  AI_GENERATE_EMBEDDINGS: 'ai:generate_embeddings',
  AI_SEARCH: 'ai:search',
  AI_CONNECTIONS: 'ai:connections',
  
  // Admin permissions
  ADMIN_USER_MANAGEMENT: 'admin:user_management',
  ADMIN_SYSTEM_SETTINGS: 'admin:system_settings',
} as const;

// Role definitions
export const Roles = {
  SUPER_ADMIN: 'super_admin',
  WORKSPACE_OWNER: 'workspace_owner',
  WORKSPACE_ADMIN: 'workspace_admin',
  WORKSPACE_MEMBER: 'workspace_member',
  WORKSPACE_VIEWER: 'workspace_viewer',
} as const;