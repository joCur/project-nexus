import jwt from 'jsonwebtoken';
import { Auth0User, Auth0TokenPayload, User } from '@/types/auth';
import { randomUUID } from 'crypto';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from '@/graphql/typeDefs';
import { resolvers } from '@/resolvers';

/**
 * Test helper utilities for authentication testing
 * Provides mock data generation and test utilities
 */

// Test secret for JWT mocking - NOT A REAL SECRET
// This is only used for testing purposes where we mock JWT verification
export const TEST_JWT_SECRET = 'test-jwt-secret-for-unit-tests-only-not-real';

// Auth0 test configuration
export const TEST_AUTH0_CONFIG = {
  domain: 'test.auth0.com',
  audience: 'https://test-api.nexus-app.de',
  issuer: 'https://test.auth0.com/',
  algorithms: ['RS256'] as const,
};

/**
 * Generate a mock JWT token for testing
 */
export function generateMockJWT(payload: Partial<Auth0TokenPayload> = {}): string {
  const defaultPayload: Auth0TokenPayload = {
    sub: 'auth0|test_user_123',
    email: 'test@example.com',
    email_verified: true,
    iss: TEST_AUTH0_CONFIG.issuer,
    aud: TEST_AUTH0_CONFIG.audience,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    scope: 'openid profile email',
    'https://api.nexus-app.de/roles': ['user'],
    'https://api.nexus-app.de/permissions': ['card:read', 'workspace:read'],
    'https://api.nexus-app.de/user_id': randomUUID(),
    ...payload,
  };

  return jwt.sign(defaultPayload, TEST_JWT_SECRET, {
    algorithm: 'HS256',
    keyid: 'test-key-id',
  });
}

/**
 * Generate an expired JWT token for testing
 */
export function generateExpiredJWT(payload: Partial<Auth0TokenPayload> = {}): string {
  const expiredPayload: Auth0TokenPayload = {
    sub: 'auth0|test_user_123',
    email: 'test@example.com',
    email_verified: true,
    iss: TEST_AUTH0_CONFIG.issuer,
    aud: TEST_AUTH0_CONFIG.audience,
    iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
    scope: 'openid profile email',
    ...payload,
  };

  return jwt.sign(expiredPayload, TEST_JWT_SECRET, {
    algorithm: 'HS256',
    keyid: 'test-key-id',
  });
}

/**
 * Generate a malformed JWT token for testing
 */
export function generateMalformedJWT(): string {
  return 'invalid.jwt.token';
}

/**
 * Generate mock Auth0 user data
 */
export function createMockAuth0User(overrides: Partial<Auth0User> = {}): Auth0User {
  return {
    sub: 'auth0|test_user_123',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    updated_at: new Date().toISOString(),
    iss: TEST_AUTH0_CONFIG.issuer,
    aud: TEST_AUTH0_CONFIG.audience,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    scope: 'openid profile email',
    roles: ['user'],
    userId: randomUUID(),
    ...overrides,
  };
}

/**
 * Generate mock user data for database
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: randomUUID(),
    email: 'test@example.com',
    auth0UserId: 'auth0|test_user_123',
    emailVerified: true,
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    lastLogin: now,
    auth0UpdatedAt: now,
    createdAt: now,
    updatedAt: now,
    roles: ['user'],
    permissions: ['card:read', 'workspace:read'],
    metadataSyncedAt: now,
    ...overrides,
  };
}

/**
 * Generate mock session data
 */
export function createMockSessionData(userId: string, auth0UserId: string) {
  const now = new Date();
  return {
    userId,
    auth0UserId,
    email: 'test@example.com',
    permissions: ['card:read', 'workspace:read'],
    roles: ['user'],
    createdAt: now,
    lastActivity: now,
    expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4 hours
  };
}

/**
 * Create mock Express request object
 */
export function createMockRequest(overrides: any = {}) {
  return {
    headers: {
      authorization: undefined,
      'user-agent': 'Test Agent',
      ...overrides.headers,
    },
    ip: '127.0.0.1',
    path: '/test',
    method: 'GET',
    isAuthenticated: false,
    permissions: [],
    ...overrides,
  };
}

/**
 * Create mock Express response object
 */
export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Create mock Next function
 */
export function createMockNext() {
  return jest.fn();
}

/**
 * Create mock GraphQL context
 */
export function createMockGraphQLContext(overrides: any = {}) {
  return {
    user: null,
    auth0Payload: null,
    permissions: [],
    isAuthenticated: false,
    req: createMockRequest(),
    res: createMockResponse(),
    dataSources: {
      auth0Service: null,
      userService: null,
      cacheService: null,
      userProfileService: null,
      onboardingService: null,
      workspaceService: null,
      workspaceAuthorizationService: null,
    },
    ...overrides,
  };
}

/**
 * Wait for a specified amount of time (useful for testing timeouts)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create mock database query function
 */
export function createMockDatabaseQuery() {
  return jest.fn();
}

/**
 * Create a comprehensive mock Knex query builder
 */
export function createMockKnexQueryBuilder() {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNotIn: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    whereBetween: jest.fn().mockReturnThis(),
    whereExists: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    rightJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    fullOuterJoin: jest.fn().mockReturnThis(),
    crossJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    first: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    countDistinct: jest.fn().mockReturnThis(),
    min: jest.fn().mockReturnThis(),
    max: jest.fn().mockReturnThis(),
    sum: jest.fn().mockReturnThis(),
    avg: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    clearSelect: jest.fn().mockReturnThis(),
    clearWhere: jest.fn().mockReturnThis(),
    clearOrder: jest.fn().mockReturnThis(),
    clearHaving: jest.fn().mockReturnThis(),
    clearCounters: jest.fn().mockReturnThis(),
    toString: jest.fn().mockReturnValue('mock-query-string'),
    toSQL: jest.fn().mockReturnValue({ sql: 'mock-query', bindings: [] }),
    debug: jest.fn().mockReturnThis(),
    connection: jest.fn().mockReturnThis(),
    options: jest.fn().mockReturnThis(),
    columnInfo: jest.fn().mockReturnThis(),
    with: jest.fn().mockReturnThis(),
    withRecursive: jest.fn().mockReturnThis(),
    forUpdate: jest.fn().mockReturnThis(),
    forShare: jest.fn().mockReturnThis(),
    skipLocked: jest.fn().mockReturnThis(),
    noWait: jest.fn().mockReturnThis(),
    union: jest.fn().mockReturnThis(),
    unionAll: jest.fn().mockReturnThis(),
    intersect: jest.fn().mockReturnThis(),
    except: jest.fn().mockReturnThis(),
    as: jest.fn().mockReturnThis(),
    columns: jest.fn().mockReturnThis(),
    column: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    table: jest.fn().mockReturnThis(),
    modify: jest.fn().mockReturnThis(),
    queryContext: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    onConflict: jest.fn().mockReturnThis(),
    ignore: jest.fn().mockReturnThis(),
    merge: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    truncate: jest.fn().mockReturnThis(),
    pluck: jest.fn().mockReturnThis(),
    jsonExtract: jest.fn().mockReturnThis(),
    jsonSet: jest.fn().mockReturnThis(),
    jsonInsert: jest.fn().mockReturnThis(),
    jsonRemove: jest.fn().mockReturnThis(),
    // Add transaction support
    transacting: jest.fn().mockReturnThis(),
    // Add promise-like methods
    then: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };

  // Make it behave like a promise for async operations
  Object.setPrototypeOf(mockQueryBuilder, Promise.prototype);

  return mockQueryBuilder;
}

/**
 * Create mock knex function that returns a mock query builder
 */
export function createMockKnex() {
  const mockKnex: any = jest.fn(() => createMockKnexQueryBuilder());
  
  // Add knex static methods
  mockKnex.raw = jest.fn().mockReturnValue(createMockKnexQueryBuilder());
  mockKnex.ref = jest.fn();
  mockKnex.transaction = jest.fn();
  mockKnex.schema = {
    createTable: jest.fn().mockReturnValue(Promise.resolve()),
    dropTable: jest.fn().mockReturnValue(Promise.resolve()),
    alterTable: jest.fn().mockReturnValue(Promise.resolve()),
    hasTable: jest.fn().mockReturnValue(Promise.resolve(true)),
    hasColumn: jest.fn().mockReturnValue(Promise.resolve(true)),
    renameTable: jest.fn().mockReturnValue(Promise.resolve()),
    dropTableIfExists: jest.fn().mockReturnValue(Promise.resolve()),
  };
  mockKnex.migrate = {
    latest: jest.fn().mockReturnValue(Promise.resolve()),
    rollback: jest.fn().mockReturnValue(Promise.resolve()),
    status: jest.fn().mockReturnValue(Promise.resolve()),
    currentVersion: jest.fn().mockReturnValue(Promise.resolve()),
  };
  mockKnex.seed = {
    run: jest.fn().mockReturnValue(Promise.resolve()),
  };
  mockKnex.destroy = jest.fn().mockReturnValue(Promise.resolve());
  mockKnex.client = {
    pool: {
      numUsed: jest.fn().mockReturnValue(0),
      numFree: jest.fn().mockReturnValue(10),
      numPendingAcquires: jest.fn().mockReturnValue(0),
      min: 2,
      max: 10,
      on: jest.fn(),
    },
  };

  return mockKnex;
}

/**
 * Create mock cache service
 */
export function createMockCacheService() {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    expire: jest.fn().mockResolvedValue(undefined),
    ttl: jest.fn().mockResolvedValue(-1),
    clear: jest.fn().mockResolvedValue(undefined),
    incr: jest.fn().mockResolvedValue(1),
    mset: jest.fn().mockResolvedValue(undefined),
    mget: jest.fn().mockResolvedValue([]),
    keys: jest.fn().mockResolvedValue([]),
    scan: jest.fn().mockResolvedValue([]),
    healthCheck: jest.fn().mockResolvedValue({ status: 'OK', responseTime: 10 }),
    close: jest.fn().mockResolvedValue(undefined),
    isConnectedToRedis: jest.fn().mockReturnValue(true),
  } as any;
}

/**
 * Create mock user service
 */
export function createMockUserService() {
  return {
    tableName: 'users',
    create: jest.fn(),
    findById: jest.fn(),
    findByAuth0Id: jest.fn(),
    findByEmail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    search: jest.fn(),
    updateLastLogin: jest.fn(),
    getUserWorkspaces: jest.fn(),
    mapDbUserToUser: jest.fn(),
  } as any;
}

/**
 * Create JWKS client mock
 */
export function createMockJwksClient() {
  return {
    getSigningKey: jest.fn().mockResolvedValue({
      getPublicKey: () => TEST_JWT_SECRET,
    }),
  };
}

/**
 * Create mock onboarding service
 */
export function createMockOnboardingService() {
  return {
    updateProgress: jest.fn(),
    getProgress: jest.fn(),
    completeOnboarding: jest.fn(),
    isComplete: jest.fn(),
    reset: jest.fn(),
    getStep: jest.fn(),
    isOnboardingComplete: jest.fn(),
    resetOnboarding: jest.fn(),
  } as any;
}

/**
 * Create mock user profile service
 */
export function createMockUserProfileService() {
  return {
    getProfileByUserId: jest.fn(),
    createProfile: jest.fn(),
    updateProfile: jest.fn(),
    upsertProfile: jest.fn(),
    deleteProfile: jest.fn(),
  } as any;
}

/**
 * Create mock workspace service
 */
export function createMockWorkspaceService() {
  return {
    getWorkspaceById: jest.fn(),
    createWorkspace: jest.fn(),
    updateWorkspace: jest.fn(),
    deleteWorkspace: jest.fn(),
    listWorkspaces: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    updateMemberRole: jest.fn(),
    getMembers: jest.fn(),
  } as any;
}

/**
 * Create mock canvas service
 */
export function createMockCanvasService() {
  return {
    getCanvasById: jest.fn(),
    getWorkspaceCanvases: jest.fn(),
    getCanvasesByWorkspace: jest.fn(),
    getDefaultCanvas: jest.fn(),
    createCanvas: jest.fn(),
    updateCanvas: jest.fn(),
    deleteCanvas: jest.fn(),
    setDefaultCanvas: jest.fn(),
    duplicateCanvas: jest.fn(),
    getCanvasStats: jest.fn(),
    getCanvasStatistics: jest.fn(),
  } as any;
}

/**
 * Create mock workspace authorization service
 */
export function createMockWorkspaceAuthorizationService() {
  return {
    getUserPermissionsForContext: jest.fn(),
    getUserPermissionsInWorkspace: jest.fn(),
    hasPermissionInWorkspace: jest.fn(),
    hasWorkspaceAccess: jest.fn(),
    getWorkspaceMember: jest.fn(),
    addWorkspaceMember: jest.fn(),
    removeWorkspaceMember: jest.fn(),
    updateWorkspaceMember: jest.fn(),
    getWorkspaceMembers: jest.fn(),
    getWorkspaceRole: jest.fn(),
    checkPermission: jest.fn(),
  } as any;
}

/**
 * Create mock Auth0 service
 */
export function createMockAuth0Service() {
  return {
    validateAuth0Token: jest.fn(),
    syncUserFromAuth0: jest.fn(),
    createSession: jest.fn(),
    validateSession: jest.fn(),
    invalidateSession: jest.fn(),
    refreshSession: jest.fn(),
    getActiveSessionsForUser: jest.fn(),
    getUserPermissions: jest.fn(),
    destroySession: jest.fn(),
    healthCheck: jest.fn(),
  } as any;
}

/**
 * Test data sets for comprehensive testing
 */
export const TEST_DATA = {
  VALID_EMAILS: [
    'test@example.com',
    'user.name@domain.co.uk',
    'firstname+lastname@example.com',
  ],
  
  INVALID_EMAILS: [
    'invalid-email',
    '@domain.com',
    'user@',
    '',
  ],
  
  PERMISSIONS: [
    'card:create',
    'card:read',
    'card:update',
    'card:delete',
    'workspace:create',
    'workspace:read',
    'workspace:update',
    'workspace:delete',
    'workspace:invite',
    'workspace:manage_members',
    'ai:generate_embeddings',
    'ai:search',
    'ai:connections',
    'admin:user_management',
    'admin:system_settings',
  ],
  
  ROLES: [
    'super_admin',
    'workspace_owner',
    'workspace_admin',
    'workspace_member',
    'workspace_viewer',
  ],
  
  AUTH0_CUSTOM_CLAIMS: {
    ROLES: 'https://api.nexus-app.de/roles',
    PERMISSIONS: 'https://api.nexus-app.de/permissions',
    USER_ID: 'https://api.nexus-app.de/user_id',
  },
};

/**
 * Error simulation helpers
 */
export const ERROR_SCENARIOS = {
  NETWORK_ERROR: new Error('Network error'),
  TIMEOUT_ERROR: new Error('Request timeout'),
  AUTH0_API_ERROR: new Error('Auth0 API error'),
  DATABASE_ERROR: new Error('Database connection error'),
  REDIS_ERROR: new Error('Redis connection error'),
  JWT_EXPIRED: new jwt.TokenExpiredError('jwt expired', new Date()),
  JWT_MALFORMED: new jwt.JsonWebTokenError('jwt malformed'),
  JWT_INVALID_SIGNATURE: new jwt.JsonWebTokenError('invalid signature'),
};

/**
 * Create test Express app with GraphQL endpoint
 */
// Global mock services that can be accessed by tests
export let testMockServices: any = {};

export async function createTestApp() {
  // Using imported modules
  
  const app = express();
  app.use(express.json());
  
  // Create mock services that can be accessed globally
  testMockServices = {
    onboardingService: createMockOnboardingService(),
    userProfileService: createMockUserProfileService(),
    workspaceService: createMockWorkspaceService(),
    workspaceAuthorizationService: createMockWorkspaceAuthorizationService(),
    auth0Service: createMockAuth0Service(),
    userService: createMockUserService(),
    cacheService: createMockCacheService(),
    canvasService: createMockCanvasService(),
  };
  
  // Using imported schema and resolvers
  
  // Mock authentication middleware
  app.use('/graphql', (req: any, res: any, next: any) => {
    const auth = req.headers.authorization;
    const userSub = req.headers['x-user-sub'];
    const userEmail = req.headers['x-user-email'];
    const userPermissions = req.headers['x-user-permissions'];
    
    if (auth && userSub) {
      req.isAuthenticated = true;
      req.user = {
        id: userSub.replace('auth0|', ''),
        email: userEmail,
        sub: userSub,
      };
      req.permissions = userPermissions ? userPermissions.split(',') : ['user:read', 'user:update'];
    } else {
      req.isAuthenticated = false;
      req.user = null;
      req.permissions = [];
    }
    
    next();
  });
  
  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });
  
  await server.start();
  
  // GraphQL endpoint
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }: { req: any }) => ({
      isAuthenticated: req.isAuthenticated,
      user: req.user,
      permissions: req.permissions,
      dataSources: testMockServices,
    }),
  }));
  
  return app;
}