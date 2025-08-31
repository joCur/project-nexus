/**
 * GraphQL operations for user management and authentication
 * 
 * Performance & Caching Strategy:
 * 
 * 1. **Permission Caching**: User permissions should be cached with a TTL of 5 minutes
 *    to reduce backend load while maintaining reasonable freshness for permission changes.
 * 
 * 2. **Cache-First Policy**: Use cache-first fetch policy for getUserPermissions to
 *    prioritize performance over absolute freshness since permissions don't change frequently.
 * 
 * 3. **Workspace-Scoped Caching**: Cache permissions per workspace to handle multi-workspace
 *    users correctly. Cache key format: `userPermissions:${userId}:${workspaceId}`
 * 
 * 4. **Cache Invalidation**: Invalidate permission cache when:
 *    - User role changes in workspace
 *    - Workspace membership changes
 *    - User explicitly refreshes their session
 * 
 * 5. **Error Handling**: On cache miss or network error, gracefully degrade by
 *    assuming no permissions (secure by default).
 * 
 * Example Apollo Client cache configuration:
 * ```typescript
 * const cacheConfig = {
 *   typePolicies: {
 *     Query: {
 *       fields: {
 *         getUserPermissions: {
 *           keyArgs: ['userId'],
 *           merge: false, // Replace cached data completely
 *         }
 *       }
 *     }
 *   }
 * };
 * ```
 * 
 * @see NEX-183 - Remove Auth0 permission extraction from frontend
 */

import { gql } from '@apollo/client';

/**
 * Query to get user permissions from backend
 * Fetches permissions for the current authenticated user
 */
export const GET_USER_PERMISSIONS = gql`
  query GetUserPermissions($userId: ID!) {
    getUserPermissions(userId: $userId)
  }
`;

/**
 * Query to get current user profile
 */
export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    getCurrentUser {
      id
      email
      displayName
      avatarUrl
      roles
      permissions
      createdAt
      updatedAt
    }
  }
`;

/**
 * Mutation to sync user data from Auth0
 */
export const SYNC_USER = gql`
  mutation SyncUser($input: SyncUserInput!) {
    syncUser(input: $input) {
      id
      email
      displayName
      createdAt
      updatedAt
    }
  }
`;

/**
 * Types for user operations
 */
export interface GetUserPermissionsVariables {
  userId: string;
}

export interface GetUserPermissionsData {
  getUserPermissions: string[];
}

export interface GetCurrentUserData {
  getCurrentUser: {
    id: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
    roles: string[];
    permissions: string[];
    createdAt: string;
    updatedAt: string;
  };
}

export interface SyncUserVariables {
  input: {
    auth0UserId: string;
    email: string;
    emailVerified: boolean;
    displayName?: string;
    avatarUrl?: string;
    auth0UpdatedAt?: string;
  };
}

export interface SyncUserData {
  syncUser: {
    id: string;
    email: string;
    displayName?: string;
    createdAt: string;
    updatedAt: string;
  };
}