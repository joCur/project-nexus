import { gql } from 'apollo-server-express';

/**
 * GraphQL type definitions for Project Nexus authentication system
 * Based on technical architecture specifications
 */

export const typeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON

  # User types
  type User {
    id: ID!
    email: String!
    auth0UserId: String!
    emailVerified: Boolean!
    displayName: String
    avatarUrl: String
    lastLogin: DateTime
    auth0UpdatedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    roles: [String!]!
    permissions: [String!]!
    metadataSyncedAt: DateTime!
    
    # Computed fields
    workspaces: [String!]!
  }

  # Authentication types
  type AuthPayload {
    user: User!
    sessionId: String!
    expiresAt: DateTime!
    permissions: [String!]!
  }

  type Session {
    userId: String!
    auth0UserId: String!
    email: String!
    permissions: [String!]!
    roles: [String!]!
    createdAt: DateTime!
    lastActivity: DateTime!
    expiresAt: DateTime!
  }

  # Permission and Role types
  type Permission {
    name: String!
    resource: String!
    action: String!
    description: String
  }

  type Role {
    name: String!
    description: String
    permissions: [Permission!]!
  }

  # Input types
  input UserCreateInput {
    email: String!
    auth0UserId: String!
    emailVerified: Boolean = false
    displayName: String
    avatarUrl: String
    roles: [String!] = []
    permissions: [String!] = []
  }

  input UserUpdateInput {
    displayName: String
    avatarUrl: String
    roles: [String!]
    permissions: [String!]
  }

  input PaginationInput {
    page: Int = 1
    limit: Int = 20
    sortBy: String = "created_at"
    sortOrder: SortOrder = DESC
  }

  # Pagination types
  type UserConnection {
    items: [User!]!
    totalCount: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  # Enums
  enum SortOrder {
    ASC
    DESC
  }

  enum UserRole {
    SUPER_ADMIN
    WORKSPACE_OWNER
    WORKSPACE_ADMIN
    WORKSPACE_MEMBER
    WORKSPACE_VIEWER
  }

  # Health check types
  type HealthStatus {
    status: String!
    timestamp: DateTime!
    responseTime: Int
    error: String
    details: JSON
  }

  type HealthCheck {
    status: String!
    timestamp: DateTime!
    version: String!
    uptime: Int!
    environment: String!
    services: HealthServices!
  }

  type HealthServices {
    database: HealthStatus!
    redis: HealthStatus!
    auth0: HealthStatus!
  }

  # Error types
  type ValidationError {
    field: String!
    message: String!
    value: String
  }

  type AuthError {
    code: String!
    message: String!
    statusCode: Int!
  }

  # Query types
  type Query {
    # Authentication queries
    me: User
    validateSession: Boolean!
    getUserPermissions(userId: ID!): [String!]!
    
    # User queries
    user(id: ID!): User
    users(pagination: PaginationInput): UserConnection!
    searchUsers(query: String!, limit: Int = 20): [User!]!
    
    # Health checks
    health: HealthCheck!
    healthReady: Boolean!
    healthLive: Boolean!
    
    # System info
    version: String!
    uptime: Int!
  }

  # Mutation types
  type Mutation {
    # Authentication mutations
    syncUserFromAuth0(auth0Token: String!): AuthPayload!
    refreshSession: Session!
    logout: Boolean!
    
    # User mutations
    createUser(input: UserCreateInput!): User!
    updateUser(id: ID!, input: UserUpdateInput!): User!
    deleteUser(id: ID!): Boolean!
    updateLastLogin(userId: ID!): Boolean!
    
    # Permission mutations
    grantPermissions(userId: ID!, permissions: [String!]!): User!
    revokePermissions(userId: ID!, permissions: [String!]!): User!
    assignRole(userId: ID!, role: UserRole!): User!
    removeRole(userId: ID!, role: UserRole!): User!
  }

  # Subscription types (for future real-time features)
  type Subscription {
    # User events
    userUpdated(userId: ID!): User!
    userLoggedIn: User!
    userLoggedOut: User!
    
    # Session events
    sessionExpired(userId: ID!): Boolean!
  }

  # Directives for authentication and authorization
  directive @auth on FIELD_DEFINITION
  directive @requirePermission(permission: String!) on FIELD_DEFINITION
  directive @requireRole(role: UserRole!) on FIELD_DEFINITION
  directive @rateLimit(max: Int!, window: Int!) on FIELD_DEFINITION

  # Schema extensions for authentication
  extend type Query {
    # Protected queries that require authentication
    protectedQuery: String @auth
    adminQuery: String @requireRole(role: SUPER_ADMIN)
  }

  extend type Mutation {
    # Protected mutations that require authentication
    protectedMutation: String @auth
    adminMutation: String @requireRole(role: SUPER_ADMIN)
  }
`;