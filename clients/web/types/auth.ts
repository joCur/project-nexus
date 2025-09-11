/**
 * Authentication types for Project Nexus Web Client
 * 
 * These types provide type safety for Auth0 integration and 
 * align with the backend authentication system.
 */

import { UserProfile } from '@auth0/nextjs-auth0/client';

/**
 * Auth0 custom claim URL constants
 * Centralized constants for maintainability
 * @deprecated Use AUTH0_CONFIG.CLAIM_URLS from @/lib/config/auth instead
 */
export const AUTH0_CLAIM_URLS = {
  ROLES: 'https://api.nexus-app.de/roles',
  PERMISSIONS: 'https://api.nexus-app.de/permissions', // Deprecated: permissions no longer used
  USER_ID: 'https://api.nexus-app.de/user_id',
} as const;

/**
 * Auth0 JWT payload structure
 * Matches the backend Auth0JWTPayload interface
 */
export interface Auth0JWTPayload {
  sub: string; // Auth0 user ID
  email: string;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;
  iss: string; // Auth0 issuer
  aud: string; // Auth0 audience
  iat: number; // issued at
  exp: number; // expires at
  scope: string; // OAuth scopes

  // Custom claims (set via Auth0 Rules/Actions)
  [AUTH0_CLAIM_URLS.ROLES]?: string[];
  [AUTH0_CLAIM_URLS.PERMISSIONS]?: string[]; // Deprecated: no longer extracted
  [AUTH0_CLAIM_URLS.USER_ID]?: string; // Internal user ID
}

/**
 * Extended user profile with custom claims and type safety
 * Used throughout the application for authenticated user data
 * Note: permissions are now fetched from backend, not Auth0 JWT
 */
export interface ExtendedUserProfile {
  // Required Auth0 fields
  sub: string;
  email: string;
  
  // Optional Auth0 fields
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;
  
  // Custom claims extracted from JWT
  roles?: string[];
  internalUserId?: string;
  
  // Additional computed fields
  displayName?: string;
  avatarUrl?: string;
}

/**
 * User entity from backend database
 * Matches the backend User interface
 */
export interface User {
  id: string;
  email: string;
  auth0UserId: string; // Auth0 'sub' field
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
  lastLogin?: Date;
  auth0UpdatedAt?: Date;

  // Auth0 metadata cache
  roles: string[];
  permissions: string[];
  metadataSyncedAt: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // User preferences
  preferences: UserPreferences;

  // Relationships
  workspaces?: Workspace[];
  cards?: Card[];
}

/**
 * User preferences structure
 */
export interface UserPreferences {
  // UI preferences
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  
  // Canvas preferences
  defaultCanvasZoom: number;
  canvasBackgroundColor: string;
  gridEnabled: boolean;
  snapToGrid: boolean;
  
  // Notification preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
  desktopNotifications: boolean;
  
  // Feature preferences
  experimentalFeatures: boolean;
  analyticsEnabled: boolean;
  
  // Accessibility preferences
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

/**
 * Authentication state
 */
export interface AuthState {
  user: ExtendedUserProfile | null;
  isLoading: boolean;
  error?: Error;
  isAuthenticated: boolean;
}

/**
 * Login options for Auth0
 */
export interface LoginOptions {
  returnTo?: string;
  organization?: string;
  invitation?: string;
  screen_hint?: 'login' | 'signup';
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  max_age?: number;
  ui_locales?: string;
  connection?: string;
  audience?: string;
  scope?: string;
}

/**
 * Logout options for Auth0
 */
export interface LogoutOptions {
  returnTo?: string;
  federated?: boolean;
  client_id?: string;
}

/**
 * User synchronization input for backend
 */
export interface SyncUserInput {
  auth0UserId: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
  auth0UpdatedAt?: string;
}

/**
 * Authentication actions interface
 */
export interface AuthActions {
  login: (options?: LoginOptions) => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
  checkPermission: (permission: string, workspaceId?: string) => boolean;
  hasAnyPermission: (permissions: string[], workspaceId?: string) => boolean;
  hasAllPermissions: (permissions: string[], workspaceId?: string) => boolean;
  hasRole: (role: string) => boolean;
  createPermissionChecker: (workspaceId: string) => {
    hasPermission: (permission: string) => boolean;
    hasAnyPermission: (permissions: string[]) => boolean;
    hasAllPermissions: (permissions: string[]) => boolean;
  };
  refreshUser: () => Promise<void>;
}

/**
 * Complete authentication hook return type
 */
export interface UseAuthReturn extends AuthState, AuthActions {
  announceAuthStatus: (message: string, priority?: 'polite' | 'assertive') => void;
}

/**
 * Permission definitions
 * Updated to match the backend permission system format
 */
export const Permissions = {
  // Workspace permissions
  WORKSPACE_READ: 'workspace:read',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_MANAGE_MEMBERS: 'workspace:manage_members',
  
  // Card permissions
  CARD_READ: 'card:read',
  CARD_CREATE: 'card:create',
  CARD_UPDATE: 'card:update',
  CARD_DELETE: 'card:delete',
  
  // Canvas permissions
  CANVAS_READ: 'canvas:read',
  CANVAS_CREATE: 'canvas:create',
  CANVAS_UPDATE: 'canvas:update',
  CANVAS_DELETE: 'canvas:delete',
  
  // Connection permissions
  CONNECTION_READ: 'connection:read',
  CONNECTION_CREATE: 'connection:create',
  CONNECTION_UPDATE: 'connection:update',
  CONNECTION_DELETE: 'connection:delete',
  
  // User permissions
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  
  // Admin permissions
  ADMIN_USERS: 'admin:users',
  ADMIN_SYSTEM: 'admin:system',
} as const;

/**
 * Role definitions
 * These should match the backend role system
 */
export const Roles = {
  USER: 'user',
  PREMIUM: 'premium',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

/**
 * Permission type from the Permissions constant
 */
export type Permission = typeof Permissions[keyof typeof Permissions];

/**
 * Role type from the Roles constant
 */
export type Role = typeof Roles[keyof typeof Roles];

/**
 * Auth0 error types
 */
export interface Auth0Error extends Error {
  error?: string;
  error_description?: string;
  error_uri?: string;
  state?: string;
}

/**
 * Session configuration type
 */
export interface SessionConfig {
  cookie: {
    domain?: string;
    httpOnly: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    secure: boolean;
    maxAge: number;
  };
  absoluteDuration: number;
  rolling: boolean;
  rollingDuration: boolean | number;
}

/**
 * Auth0 configuration interface
 */
export interface Auth0Config {
  secret: string;
  baseURL: string;
  issuerBaseURL: string;
  clientID: string;
  clientSecret: string;
  authorizationParams: {
    audience: string;
    scope: string;
  };
  session: SessionConfig;
  routes: {
    login: string;
    logout: string;
    callback: string;
    postLogoutRedirect: string;
  };
  idpLogout: boolean;
  organization?: string;
  loginParameters: {
    max_age: string;
    ui_locales: string;
  };
}

/**
 * Workspace interface (minimal for auth context)
 */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Card interface (minimal for auth context)
 */
export interface Card {
  id: string;
  title: string;
  workspaceId: string;
  authorId: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GraphQL mutation response types
 */
export interface SyncUserResponse {
  syncUser: {
    id: string;
    email: string;
    displayName?: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * Auth0 Management API user interface
 */
export interface Auth0ManagementUser {
  user_id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at: string;
  created_at: string;
  app_metadata?: {
    roles?: string[];
    permissions?: string[];
    [key: string]: any;
  };
  user_metadata?: {
    [key: string]: any;
  };
}

/**
 * Protected route props interface
 */
export interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  
  // Permission-based access control
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAllPermissions?: boolean;
  requireAllRoles?: boolean;
  
  // Custom authorization function
  authorize?: (user: ExtendedUserProfile) => boolean;
  
  // Redirect configuration
  redirectTo?: string;
  onUnauthorized?: () => void;
}

/**
 * Authentication context type
 */
export interface AuthContextType extends UseAuthReturn {
  // Additional context-specific methods
  updateUserPreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearAuthCache: () => void;
}

/**
 * Type guards for authentication objects
 */
export function isExtendedUserProfile(user: any): user is ExtendedUserProfile {
  return user && typeof user.sub === 'string' && typeof user.email === 'string';
}

export function isAuth0Error(error: any): error is Auth0Error {
  return error && (error.error || error.error_description);
}

export function hasPermission(user: ExtendedUserProfile | null, permission: Permission): boolean {
  // Import the shared utility to avoid duplication
  // Note: Using dynamic import here to avoid circular dependency issues
  // TODO: Refactor to use proper ES6 imports when circular dependency is resolved
  const { checkUserPermission } = require('@/lib/utils/permissions');
  return checkUserPermission(user, permission);
}

export function hasRole(user: ExtendedUserProfile | null, role: Role): boolean {
  const { checkUserRole } = require('@/lib/utils/permissions');
  return checkUserRole(user, role);
}

export function hasAnyPermission(user: ExtendedUserProfile | null, permissions: Permission[]): boolean {
  const { checkAnyUserPermission } = require('@/lib/utils/permissions');
  return checkAnyUserPermission(user, permissions);
}

export function hasAllPermissions(user: ExtendedUserProfile | null, permissions: Permission[]): boolean {
  const { checkAllUserPermissions } = require('@/lib/utils/permissions');
  return checkAllUserPermissions(user, permissions);
}

export function hasAnyRole(user: ExtendedUserProfile | null, roles: Role[]): boolean {
  const { checkAnyUserRole } = require('@/lib/utils/permissions');
  return checkAnyUserRole(user, roles);
}

export function hasAllRoles(user: ExtendedUserProfile | null, roles: Role[]): boolean {
  const { checkAllUserRoles } = require('@/lib/utils/permissions');
  return checkAllUserRoles(user, roles);
}