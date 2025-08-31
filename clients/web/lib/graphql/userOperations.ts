/**
 * GraphQL operations for user management and authentication
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