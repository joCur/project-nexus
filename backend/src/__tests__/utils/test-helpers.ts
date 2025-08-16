import jwt from 'jsonwebtoken';
import { Auth0User, Auth0TokenPayload, User } from '@/types/auth';
import { randomUUID } from 'crypto';

/**
 * Test helper utilities for authentication testing
 * Provides mock data generation and test utilities
 */

// Test JWT secret for token generation
export const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';

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
    email_verified: true,
    name: 'Test User',
    nickname: 'testuser',
    picture: 'https://example.com/avatar.jpg',
    updated_at: new Date().toISOString(),
    iss: TEST_AUTH0_CONFIG.issuer,
    aud: TEST_AUTH0_CONFIG.audience,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    scope: 'openid profile email',
    'https://api.nexus-app.de/roles': ['user'],
    'https://api.nexus-app.de/permissions': ['card:read', 'workspace:read'],
    'https://api.nexus-app.de/user_id': randomUUID(),
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