import { randomUUID as _randomUUID } from 'crypto';
import { 
  generateMockJWT, 
  generateExpiredJWT,
  createMockAuth0User,
  createMockUser,
  TEST_AUTH0_CONFIG as _TEST_AUTH0_CONFIG 
} from './test-helpers';

/**
 * Test fixtures for authentication testing
 * Provides consistent test data across all test suites
 */

// JWT Token Fixtures
export const JWT_FIXTURES = {
  VALID_TOKEN: generateMockJWT({
    sub: 'auth0|test_user_123',
    email: 'john.doe@example.com',
    email_verified: true,
    name: 'John Doe',
    'https://api.nexus-app.de/roles': ['user'],
    'https://api.nexus-app.de/permissions': ['card:read', 'workspace:read'],
  }),

  ADMIN_TOKEN: generateMockJWT({
    sub: 'auth0|admin_user_456',
    email: 'admin@example.com',
    email_verified: true,
    name: 'Admin User',
    'https://api.nexus-app.de/roles': ['super_admin'],
    'https://api.nexus-app.de/permissions': [
      'card:create', 'card:read', 'card:update', 'card:delete',
      'workspace:create', 'workspace:read', 'workspace:update', 'workspace:delete',
      'admin:user_management', 'admin:system_settings'
    ],
  }),

  WORKSPACE_OWNER_TOKEN: generateMockJWT({
    sub: 'auth0|workspace_owner_789',
    email: 'owner@example.com',
    email_verified: true,
    name: 'Workspace Owner',
    'https://api.nexus-app.de/roles': ['workspace_owner'],
    'https://api.nexus-app.de/permissions': [
      'card:create', 'card:read', 'card:update', 'card:delete',
      'workspace:read', 'workspace:update', 'workspace:invite', 'workspace:manage_members'
    ],
  }),

  LIMITED_USER_TOKEN: generateMockJWT({
    sub: 'auth0|limited_user_321',
    email: 'viewer@example.com',
    email_verified: true,
    name: 'Limited User',
    'https://api.nexus-app.de/roles': ['workspace_viewer'],
    'https://api.nexus-app.de/permissions': ['card:read', 'workspace:read'],
  }),

  EXPIRED_TOKEN: generateExpiredJWT({
    sub: 'auth0|expired_user_999',
    email: 'expired@example.com',
    email_verified: true,
  }),

  UNVERIFIED_EMAIL_TOKEN: generateMockJWT({
    sub: 'auth0|unverified_user_555',
    email: 'unverified@example.com',
    email_verified: false,
    name: 'Unverified User',
  }),

  MALFORMED_TOKEN: 'invalid.jwt.token.format',
  
  NO_CLAIMS_TOKEN: generateMockJWT({
    sub: 'auth0|no_claims_user_777',
    email: 'noclaims@example.com',
    email_verified: true,
    name: 'No Claims User',
    // No custom claims
  }),
};

// Auth0 User Fixtures
export const AUTH0_USER_FIXTURES = {
  STANDARD_USER: createMockAuth0User({
    sub: 'auth0|test_user_123',
    username: 'johndoe',
    email: 'john.doe@example.com',
    name: 'John Doe',
    picture: 'https://example.com/avatars/john.jpg',
    roles: ['user'],
    userId: 'user-123-uuid',
  }),

  ADMIN_USER: createMockAuth0User({
    sub: 'auth0|admin_user_456',
    username: 'admin',
    email: 'admin@example.com',
    name: 'Admin User',
    picture: 'https://example.com/avatars/admin.jpg',
    roles: ['super_admin'],
    userId: 'admin-456-uuid',
  }),

  WORKSPACE_OWNER: createMockAuth0User({
    sub: 'auth0|workspace_owner_789',
    username: 'owner',
    email: 'owner@example.com',
    name: 'Workspace Owner',
    picture: 'https://example.com/avatars/owner.jpg',
    roles: ['workspace_owner'],
    userId: 'owner-789-uuid',
  }),

  UNVERIFIED_USER: createMockAuth0User({
    sub: 'auth0|unverified_user_555',
    username: 'unverified',
    email: 'unverified@example.com',
    name: 'Unverified User',
    picture: 'https://example.com/avatars/unverified.jpg',
    roles: ['user'],
    userId: 'unverified-555-uuid',
  }),
};

// Database User Fixtures
export const USER_FIXTURES = {
  STANDARD_USER: createMockUser({
    id: 'user-123-uuid',
    email: 'john.doe@example.com',
    auth0UserId: 'auth0|test_user_123',
    emailVerified: true,
    displayName: 'John Doe',
    avatarUrl: 'https://example.com/avatars/john.jpg',
    roles: ['user'],
    permissions: ['card:read', 'workspace:read'],
  }),

  ADMIN_USER: createMockUser({
    id: 'admin-456-uuid',
    email: 'admin@example.com',
    auth0UserId: 'auth0|admin_user_456',
    emailVerified: true,
    displayName: 'Admin User',
    avatarUrl: 'https://example.com/avatars/admin.jpg',
    roles: ['super_admin'],
    permissions: [
      'card:create', 'card:read', 'card:update', 'card:delete',
      'workspace:create', 'workspace:read', 'workspace:update', 'workspace:delete',
      'admin:user_management', 'admin:system_settings'
    ],
  }),

  WORKSPACE_OWNER: createMockUser({
    id: 'owner-789-uuid',
    email: 'owner@example.com',
    auth0UserId: 'auth0|workspace_owner_789',
    emailVerified: true,
    displayName: 'Workspace Owner',
    avatarUrl: 'https://example.com/avatars/owner.jpg',
    roles: ['workspace_owner'],
    permissions: [
      'card:create', 'card:read', 'card:update', 'card:delete',
      'workspace:read', 'workspace:update', 'workspace:invite', 'workspace:manage_members'
    ],
  }),

  NEW_USER: {
    email: 'newuser@example.com',
    auth0UserId: 'auth0|new_user_999',
    emailVerified: true,
    displayName: 'New User',
    avatarUrl: 'https://example.com/avatars/new.jpg',
    roles: ['user'],
    permissions: ['card:read', 'workspace:read'],
  },
};

// Session Data Fixtures
export const SESSION_FIXTURES = {
  ACTIVE_SESSION: {
    userId: 'user-123-uuid',
    auth0UserId: 'auth0|test_user_123',
    email: 'john.doe@example.com',
    permissions: ['card:read', 'workspace:read'],
    roles: ['user'],
    createdAt: new Date(),
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
  },

  EXPIRED_SESSION: {
    userId: 'user-456-uuid',
    auth0UserId: 'auth0|expired_user_456',
    email: 'expired@example.com',
    permissions: ['card:read'],
    roles: ['user'],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago (expired)
  },

  INACTIVE_SESSION: {
    userId: 'user-789-uuid',
    auth0UserId: 'auth0|inactive_user_789',
    email: 'inactive@example.com',
    permissions: ['card:read'],
    roles: ['user'],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    lastActivity: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago (inactive)
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
  },
};

// GraphQL Query/Mutation Fixtures
export const GRAPHQL_FIXTURES = {
  SYNC_USER_MUTATION: `
    mutation SyncUserFromAuth0($auth0Token: String!) {
      syncUserFromAuth0(auth0Token: $auth0Token) {
        user {
          id
          email
          displayName
          roles
          permissions
        }
        sessionId
        expiresAt
        permissions
      }
    }
  `,

  ME_QUERY: `
    query Me {
      me {
        id
        email
        displayName
        roles
        permissions
        lastLogin
        createdAt
      }
    }
  `,

  VALIDATE_SESSION_QUERY: `
    query ValidateSession {
      validateSession
    }
  `,

  LOGOUT_MUTATION: `
    mutation Logout {
      logout
    }
  `,

  REFRESH_SESSION_MUTATION: `
    mutation RefreshSession {
      refreshSession {
        userId
        expiresAt
        lastActivity
      }
    }
  `,

};

// HTTP Request Fixtures
export const REQUEST_FIXTURES = {
  AUTHENTICATED_REQUEST: {
    headers: {
      authorization: `Bearer ${JWT_FIXTURES.VALID_TOKEN}`,
      'user-agent': 'Mozilla/5.0 Test Browser',
      'content-type': 'application/json',
    },
    ip: '192.168.1.100',
    path: '/graphql',
    method: 'POST',
  },

  ADMIN_REQUEST: {
    headers: {
      authorization: `Bearer ${JWT_FIXTURES.ADMIN_TOKEN}`,
      'user-agent': 'Mozilla/5.0 Admin Browser',
      'content-type': 'application/json',
    },
    ip: '192.168.1.101',
    path: '/admin/users',
    method: 'GET',
  },

  UNAUTHENTICATED_REQUEST: {
    headers: {
      'user-agent': 'Mozilla/5.0 Public Browser',
      'content-type': 'application/json',
    },
    ip: '192.168.1.102',
    path: '/public',
    method: 'GET',
  },

  MALFORMED_AUTH_REQUEST: {
    headers: {
      authorization: 'Bearer invalid-token-format',
      'user-agent': 'Mozilla/5.0 Malformed Browser',
      'content-type': 'application/json',
    },
    ip: '192.168.1.103',
    path: '/graphql',
    method: 'POST',
  },

  EXPIRED_AUTH_REQUEST: {
    headers: {
      authorization: `Bearer ${JWT_FIXTURES.EXPIRED_TOKEN}`,
      'user-agent': 'Mozilla/5.0 Expired Browser',
      'content-type': 'application/json',
    },
    ip: '192.168.1.104',
    path: '/graphql',
    method: 'POST',
  },
};

// Error Response Fixtures
export const ERROR_FIXTURES = {
  AUTHENTICATION_ERROR: {
    code: 'UNAUTHENTICATED',
    message: 'Authentication required',
    statusCode: 401,
  },

  AUTHORIZATION_ERROR: {
    code: 'FORBIDDEN',
    message: 'Insufficient permissions',
    statusCode: 403,
  },

  TOKEN_EXPIRED_ERROR: {
    code: 'TOKEN_EXPIRED',
    message: 'JWT token has expired',
    statusCode: 401,
  },

  INVALID_TOKEN_ERROR: {
    code: 'INVALID_TOKEN',
    message: 'Invalid JWT token',
    statusCode: 401,
  },

  EMAIL_NOT_VERIFIED_ERROR: {
    code: 'EMAIL_NOT_VERIFIED',
    message: 'Email address not verified',
    statusCode: 401,
  },

  RATE_LIMIT_ERROR: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests',
    statusCode: 429,
  },

  SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    statusCode: 500,
  },
};

// Performance Benchmark Fixtures
export const PERFORMANCE_FIXTURES = {
  ACCEPTABLE_RESPONSE_TIME: 100, // milliseconds
  SLOW_RESPONSE_TIME: 500, // milliseconds
  TIMEOUT_DURATION: 5000, // milliseconds
  
  AUTH_FLOW_BENCHMARKS: {
    TOKEN_VALIDATION: 50, // ms
    USER_SYNC: 100, // ms
    SESSION_CREATION: 25, // ms
    PERMISSION_CHECK: 10, // ms
  },
};

// Security Test Fixtures
export const SECURITY_FIXTURES = {
  SQL_INJECTION_ATTEMPTS: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "admin'--",
    "admin'/*",
  ],

  XSS_ATTEMPTS: [
    "<script>alert('xss')</script>",
    "javascript:alert('xss')",
    "<img src=x onerror=alert('xss')>",
  ],

  MALICIOUS_JWT_PAYLOADS: [
    { sub: "'; DROP TABLE users; --" },
    { email: "<script>alert('xss')</script>" },
    { 'https://api.nexus-app.de/roles': ["admin'; DROP TABLE users; --"] },
  ],

  RATE_LIMIT_TEST_SCENARIOS: [
    { requests: 10, timeWindow: 1000, shouldPass: true },
    { requests: 100, timeWindow: 1000, shouldPass: false },
    { requests: 1000, timeWindow: 1000, shouldPass: false },
  ],
};