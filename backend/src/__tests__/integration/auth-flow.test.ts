import request from 'supertest';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { Auth0Service } from '@/services/auth0';
import { UserService } from '@/services/user';
import { CacheService } from '@/services/cache';
import { createAuthMiddleware, createGraphQLContext } from '@/middleware/auth';
import { authResolvers } from '@/resolvers/auth';
import {
  createMockAuth0Service,
  createMockUserService,
  createMockCacheService,
  createMockWorkspaceAuthorizationService,
  generateMockJWT,
  createMockUser,
  createMockAuth0User,
} from '../utils/test-helpers';
import {
  JWT_FIXTURES,
  AUTH0_USER_FIXTURES,
  USER_FIXTURES,
  SESSION_FIXTURES,
  GRAPHQL_FIXTURES,
} from '../utils/test-fixtures';

// Mock external dependencies
jest.mock('@/utils/logger');
jest.mock('@/database/connection');

// GraphQL Schema for E2E testing
const typeDefs = `
  scalar DateTime
  scalar JSON

  type User {
    id: ID!
    email: String!
    displayName: String
    roles: [String!]!
    permissions: [String!]!
    lastLogin: DateTime
    createdAt: DateTime!
    workspaces: [String!]
  }

  type AuthPayload {
    user: User!
    sessionId: String!
    expiresAt: DateTime!
    permissions: [String!]!
  }

  type SessionData {
    userId: String!
    expiresAt: DateTime!
    lastActivity: DateTime!
  }

  type Query {
    me: User
    validateSession: Boolean!
    getUserPermissions(userId: String!): [String!]!
  }

  type Mutation {
    syncUserFromAuth0(auth0Token: String!): AuthPayload!
    refreshSession: SessionData!
    logout: Boolean!
    grantPermissions(userId: String!, permissions: [String!]!): User!
    revokePermissions(userId: String!, permissions: [String!]!): User!
    assignRole(userId: String!, role: String!): User!
    removeRole(userId: String!, role: String!): User!
  }
`;

describe('End-to-End Authentication Flow Tests', () => {
  let app: express.Application;
  let server: ApolloServer<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockAuth0Service: jest.Mocked<Auth0Service>;
  let mockUserService: jest.Mocked<UserService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockWorkspaceAuthService: any;
  let mockUserProfileService: any;
  let mockOnboardingService: any;
  let mockWorkspaceService: any;

  beforeEach(async () => {
    // Create mock services
    mockAuth0Service = createMockAuth0Service() as jest.Mocked<Auth0Service>;
    mockUserService = createMockUserService() as jest.Mocked<UserService>;
    mockCacheService = createMockCacheService() as jest.Mocked<CacheService>;
    mockWorkspaceAuthService = createMockWorkspaceAuthorizationService();
    mockUserProfileService = {
      getProfileByUserId: jest.fn(),
      createProfile: jest.fn(),
      updateProfile: jest.fn(),
      upsertProfile: jest.fn(),
      deleteProfile: jest.fn(),
    };
    mockOnboardingService = {
      updateProgress: jest.fn(),
      getProgress: jest.fn(),
      completeOnboarding: jest.fn(),
      isComplete: jest.fn(),
      reset: jest.fn(),
    };
    mockWorkspaceService = {
      getWorkspaceById: jest.fn(),
      createWorkspace: jest.fn(),
      updateWorkspace: jest.fn(),
      deleteWorkspace: jest.fn(),
      listWorkspaces: jest.fn(),
    };
    
    // Setup User.workspaces field resolver mock
    mockUserService.getUserWorkspaces = jest.fn().mockResolvedValue([]);
    
    // Setup workspace authorization service defaults
    mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue({});
    mockWorkspaceAuthService.getUserPermissionsInWorkspace.mockResolvedValue([]);
    mockWorkspaceAuthService.hasPermissionInWorkspace.mockResolvedValue(false);
    mockWorkspaceAuthService.checkPermission.mockResolvedValue(false);
    mockWorkspaceAuthService.getWorkspaceMember.mockResolvedValue(null);
    mockWorkspaceAuthService.hasWorkspaceAccess.mockResolvedValue(false);

    // Create Express app
    app = express();
    app.use(express.json());

    // Setup authentication middleware
    const authMiddleware = createAuthMiddleware(
      mockAuth0Service,
      mockUserService,
      mockCacheService
    );
    app.use(authMiddleware);

    // Create Apollo Server
    server = new ApolloServer({
      typeDefs,
      resolvers: authResolvers,
    });

    await server.start();

    // Setup GraphQL endpoint
    app.use(
      '/graphql',
      expressMiddleware(server, {
        context: async ({ req, res }: { req: any; res: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          try {
            const context = await createGraphQLContext(
              mockAuth0Service,
              mockUserService,
              mockCacheService,
              mockUserProfileService,
              mockOnboardingService,
              mockWorkspaceService,
              mockWorkspaceAuthService
            )({ req, res });
            
            // Verify workspace auth service is properly set
            if (!context.dataSources?.workspaceAuthorizationService) {
              console.error('workspaceAuthorizationService missing from context');
            }
            
            return context;
          } catch (error) {
            console.error('Error creating GraphQL context:', error);
            throw error;
          }
        },
      })
    );

    // Setup REST endpoint for testing
    app.get('/protected', (req: any, res) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!req.isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({
        message: 'Protected resource accessed',
        user: req.user,
        permissions: req.permissions,
      });
    });

    app.get('/public', (req, res) => {
      res.json({ message: 'Public resource' });
    });
  });

  afterEach(async () => {
    await server?.stop();
    jest.clearAllMocks();
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full authentication workflow', async () => {
      // Step 1: Sync user from Auth0
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;
      const sessionId = 'session-123';

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.createSession.mockResolvedValue(sessionId);

      const syncResponse = await request(app)
        .post('/graphql')
        .send({
          query: GRAPHQL_FIXTURES.SYNC_USER_MUTATION,
          variables: { auth0Token: JWT_FIXTURES.VALID_TOKEN },
        });

      expect(syncResponse.status).toBe(200);
      expect(syncResponse.body.data.syncUserFromAuth0).toEqual({
        user: expect.objectContaining({
          id: user.id,
          email: user.email,
        }),
        sessionId,
        expiresAt: expect.any(String),
        permissions: expect.any(Array), // Now populated by WorkspaceAuthorizationService
      });

      // Step 2: Access protected resource with valid token
      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const protectedResponse = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.body).toEqual({
        message: 'Protected resource accessed',
        user: expect.objectContaining({
          id: user.id,
          email: user.email,
        }),
        permissions: expect.any(Array), // Now populated by WorkspaceAuthorizationService
      });

      // Step 3: Query current user info
      const meResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: GRAPHQL_FIXTURES.ME_QUERY,
        });

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.me).toEqual(
        expect.objectContaining({
          id: user.id,
          email: user.email,
        })
      );

      // Step 4: Validate session
      const sessionResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: GRAPHQL_FIXTURES.VALIDATE_SESSION_QUERY,
        });

      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.body.data.validateSession).toBe(true);

      // Step 5: Logout
      const logoutResponse = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: GRAPHQL_FIXTURES.LOGOUT_MUTATION,
        });

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.data.logout).toBe(true);
      expect(mockAuth0Service.destroySession).toHaveBeenCalledWith(user.id);
    });
  });

  describe('Unauthenticated Access', () => {
    it('should allow access to public resources', async () => {
      const response = await request(app).get('/public');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Public resource',
      });
    });

    it('should deny access to protected REST endpoints', async () => {
      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should return null for me query without authentication', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: GRAPHQL_FIXTURES.ME_QUERY,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.me).toBeNull();
    });

    it('should return false for session validation without authentication', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: GRAPHQL_FIXTURES.VALIDATE_SESSION_QUERY,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.validateSession).toBe(false);
    });
  });

  describe('Invalid Authentication Scenarios', () => {
    it('should reject expired JWT tokens', async () => {
      mockAuth0Service.validateAuth0Token.mockRejectedValue(
        new Error('Token expired')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.EXPIRED_TOKEN}`);

      expect(response.status).toBe(401);
    });

    it('should reject malformed JWT tokens', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.MALFORMED_TOKEN}`);

      expect(response.status).toBe(401);
    });

    it('should reject tokens with invalid format', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Unauthorized',
      });
    });

    it('should handle Auth0 service unavailability', async () => {
      mockAuth0Service.validateAuth0Token.mockRejectedValue(
        new Error('Auth0 service unavailable')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(401);
    });

    it('should handle user synchronization failures', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockRejectedValue(
        new Error('Database connection error')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(401);
    });

    it('should handle expired sessions by creating new session', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(false);
      mockAuth0Service.createSession.mockResolvedValue('new-session-id');

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      // Should succeed because a new session is created automatically
      expect(response.status).toBe(200);
      expect(mockAuth0Service.createSession).toHaveBeenCalledWith(user, auth0User);
    });
  });

  describe('Permission-Based Access Control', () => {
    it.skip('should allow access for users with required permissions - SKIPPED: Test will be updated in NEX-182 for workspace-based permissions', async () => {
      const auth0User = AUTH0_USER_FIXTURES.ADMIN_USER;
      const adminUser = USER_FIXTURES.ADMIN_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(adminUser);
      mockAuth0Service.validateSession.mockResolvedValue(true);
      mockUserService.findById.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockUserService.update.mockResolvedValue({
        ...USER_FIXTURES.STANDARD_USER,
      });

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.ADMIN_TOKEN}`)
        .send({
          query: GRAPHQL_FIXTURES.ME_QUERY,
          variables: {
            userId: USER_FIXTURES.STANDARD_USER.id,
            permissions: ['new:permission'],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.grantPermissions).toBeDefined();
    });

    it('should deny access for unauthenticated users', async () => {
      // Don't set Authorization header to simulate unauthenticated request

      const response = await request(app)
        .post('/graphql')
        .send({
          query: GRAPHQL_FIXTURES.ME_QUERY,
        })
        .catch(err => {
          console.error('Request failed:', err);
          throw err;
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.me).toBeNull(); // Should return null for unauthenticated users
    });

    it('should allow users to access their own data', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);
      
      // Mock user's own permissions across workspaces
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue({
        'workspace-1': ['card:read', 'card:write'],
        'workspace-2': ['workspace:read'],
      });

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: GRAPHQL_FIXTURES.ME_QUERY,
          variables: { userId: user.id },
        });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      
      // Debug the response structure
      if (!response.body.data || response.body.data.me === null) {
        console.log('DEBUG - Allow users access own data - Response body:', JSON.stringify(response.body, null, 2));
      }
      
      expect(response.body.data).toBeDefined();
      expect(response.body.data.me).toBeDefined();
      expect(response.body.data.me.id).toBeDefined();
    });

    it('should successfully authenticate and return user data', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: GRAPHQL_FIXTURES.ME_QUERY,
        });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.data).toBeDefined();
      expect(response.body.data.me).toBeDefined();
      expect(response.body.data.me.id).toBe(user.id);
    });
  });

  describe('Session Management', () => {
    it('should refresh session successfully', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;
      const sessionData = SESSION_FIXTURES.ACTIVE_SESSION;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);
      mockCacheService.get.mockResolvedValue(JSON.stringify(sessionData));
      mockCacheService.set.mockResolvedValue();

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: GRAPHQL_FIXTURES.REFRESH_SESSION_MUTATION,
        });

      expect(response.status).toBe(200);
      
      if (response.body.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.body.errors)}`);
      }
      
      expect(response.body.data).toBeTruthy();
      expect(response.body.data.refreshSession).toEqual(
        expect.objectContaining({
          userId: user.id,
          lastActivity: expect.any(String),
        })
      );
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should handle session refresh for expired session', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(false);
      mockAuth0Service.createSession.mockResolvedValue('new-session-id');

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: GRAPHQL_FIXTURES.REFRESH_SESSION_MUTATION,
        });

      // Should succeed because a new session is created automatically
      expect(response.status).toBe(200);
      expect(mockAuth0Service.createSession).toHaveBeenCalledWith(user, auth0User);
    });

    it('should handle concurrent session operations', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const concurrentRequests = Array(10).fill(null).map(() =>
        request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
          .send({
            query: GRAPHQL_FIXTURES.VALIDATE_SESSION_QUERY,
          })
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.validateSession).toBe(true);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed GraphQL queries gracefully', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: 'invalid GraphQL syntax {',
        });

      expect(response.status).toBe(401);
    });

    it('should handle missing variables in GraphQL mutations', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: GRAPHQL_FIXTURES.SYNC_USER_MUTATION,
          // Missing variables
        });

      expect(response.status).toBe(401);
    });

    it('should handle database connection failures', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockRejectedValue(
        new Error('Database connection lost')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(401);
    });

    it('should handle Redis cache failures gracefully', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);
      mockCacheService.get.mockRejectedValue(new Error('Redis connection error'));

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      // Should still work even if cache fails
      expect(response.status).toBe(200);
    });

    it('should handle very large request payloads', async () => {
      const largePayload = {
        query: GRAPHQL_FIXTURES.SYNC_USER_MUTATION,
        variables: {
          auth0Token: JWT_FIXTURES.VALID_TOKEN,
          largeData: 'x'.repeat(100000), // 100KB of data
        },
      };

      const response = await request(app)
        .post('/graphql')
        .send(largePayload);

      expect(response.status).toBe(200);
    });

    it('should handle authentication with special characters in tokens', async () => {
      const specialToken = generateMockJWT({
        email: 'user+test@example.com',
        name: 'User with "quotes" and \'apostrophes\'',
      });

      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        ...AUTH0_USER_FIXTURES.STANDARD_USER,
        email: 'user+test@example.com',
        name: 'User with "quotes" and \'apostrophes\'',
      });
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue({
        ...USER_FIXTURES.STANDARD_USER,
        email: 'user+test@example.com',
        displayName: 'User with "quotes" and \'apostrophes\'',
      });
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${specialToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-frequency authentication requests', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const concurrentRequests = 50;
      const startTime = Date.now();

      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
      );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds (relaxed for CI/slow environments)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle rapid login/logout cycles', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;
      const sessionId = 'session-123';

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.createSession.mockResolvedValue(sessionId);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const cycles = 10;
      for (let i = 0; i < cycles; i++) {
        // Login
        const loginResponse = await request(app)
          .post('/graphql')
          .send({
            query: GRAPHQL_FIXTURES.SYNC_USER_MUTATION,
            variables: { auth0Token: JWT_FIXTURES.VALID_TOKEN },
          });

        expect(loginResponse.status).toBe(200);

        // Logout
        const logoutResponse = await request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
          .send({
            query: GRAPHQL_FIXTURES.LOGOUT_MUTATION,
          });

        expect(logoutResponse.status).toBe(200);
      }
    });

    it('should maintain performance with complex permission structures', async () => {
      const complexUser = createMockUser({
        roles: Array(10).fill(null).map((_, i) => `role:${i}`),
      });

      const complexAuth0User = createMockAuth0User({
        roles: complexUser.roles,
      });

      mockAuth0Service.validateAuth0Token.mockResolvedValue(complexAuth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(complexUser);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const startTime = Date.now();

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds even with complex permissions (relaxed for CI/slow environments)
    });
  });
});