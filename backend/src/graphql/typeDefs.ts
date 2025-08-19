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
    profile: UserProfile
    onboarding: UserOnboarding
  }

  # User profile types
  type UserProfile {
    id: ID!
    userId: ID!
    fullName: String!
    displayName: String
    timezone: String
    role: UserProfileRole
    preferences: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Onboarding types
  type UserOnboarding {
    id: ID!
    userId: ID!
    completed: Boolean!
    completedAt: DateTime
    currentStep: Int!
    finalStep: Int
    tutorialProgress: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Workspace types
  type Workspace {
    id: ID!
    name: String!
    ownerId: ID!
    privacy: WorkspacePrivacy!
    settings: JSON!
    isDefault: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Computed fields
    owner: User!
  }

  # Onboarding workflow types
  type OnboardingStatus {
    profile: UserProfile
    onboarding: UserOnboarding
    defaultWorkspace: Workspace
    isComplete: Boolean!
  }

  type OnboardingWorkflowResult {
    success: Boolean!
    profile: UserProfile!
    onboarding: UserOnboarding!
    workspace: Workspace!
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

  input UserProfileCreateInput {
    fullName: String!
    displayName: String
    timezone: String
    role: UserProfileRole
    preferences: JSON = {}
  }

  input UserProfileUpdateInput {
    fullName: String
    displayName: String
    timezone: String
    role: UserProfileRole
    preferences: JSON
  }

  input OnboardingProgressUpdateInput {
    currentStep: Int!
    tutorialProgress: JSON = {}
  }

  input OnboardingCompleteInput {
    tutorialProgress: JSON = {}
  }

  input OnboardingWorkflowCompleteInput {
    userProfile: UserProfileCreateInput!
    tutorialProgress: JSON = {}
  }

  input WorkspaceCreateInput {
    name: String!
    privacy: WorkspacePrivacy = PRIVATE
    settings: JSON = {}
    isDefault: Boolean = false
  }

  input WorkspaceUpdateInput {
    name: String
    privacy: WorkspacePrivacy
    settings: JSON
    isDefault: Boolean
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

  enum UserProfileRole {
    STUDENT
    RESEARCHER
    CREATIVE
    BUSINESS
    OTHER
  }

  enum WorkspacePrivacy {
    PRIVATE
    TEAM
    PUBLIC
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
    
    # User profile queries
    userProfile(userId: ID!): UserProfile
    myProfile: UserProfile
    
    # Onboarding queries
    onboardingProgress(userId: ID!): UserOnboarding
    myOnboardingProgress: UserOnboarding
    isOnboardingComplete(userId: ID!): Boolean!
    myOnboardingStatus: OnboardingStatus!
    
    # Workspace queries
    workspace(id: ID!): Workspace
    workspaces(ownerId: ID!): [Workspace!]!
    myWorkspaces: [Workspace!]!
    defaultWorkspace(ownerId: ID!): Workspace
    myDefaultWorkspace: Workspace
    
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
    
    # User profile mutations
    createUserProfile(input: UserProfileCreateInput!): UserProfile!
    updateUserProfile(userId: ID!, input: UserProfileUpdateInput!): UserProfile!
    updateMyProfile(input: UserProfileUpdateInput!): UserProfile!
    deleteUserProfile(userId: ID!): Boolean!
    
    # Onboarding mutations
    updateOnboardingProgress(input: OnboardingProgressUpdateInput!): UserOnboarding!
    completeOnboarding(input: OnboardingCompleteInput!): UserOnboarding!
    resetOnboarding(userId: ID!): Boolean!
    
    # Onboarding workflow mutations
    completeOnboardingWorkflow(input: OnboardingWorkflowCompleteInput!): OnboardingWorkflowResult!
    updateOnboardingStep(currentStep: Int!, tutorialProgress: JSON): UserOnboarding!
    
    # Workspace mutations
    createWorkspace(input: WorkspaceCreateInput!): Workspace!
    updateWorkspace(id: ID!, input: WorkspaceUpdateInput!): Workspace!
    deleteWorkspace(id: ID!): Boolean!
    createDefaultWorkspace(workspaceName: String!): Workspace!
    
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