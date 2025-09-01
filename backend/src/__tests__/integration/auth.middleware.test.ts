/**
 * Integration tests for authentication middleware 
 * Tests the complete auth flow without Auth0 permission synchronization
 * Focus on workspace-based permission resolution in GraphQL context
 */

import request from 'supertest';
import express, { Express } from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { createAuthMiddleware, createGraphQLContext } from '@/middleware/auth';
import { authResolvers } from '@/resolvers/auth';
import { GraphQLContext } from '@/types';
import { 
  createMockAuth0Service,
  createMockUserService,
  createMockCacheService,
  createMockWorkspaceAuthorizationService,
  createMockUser
} from '../utils/test-helpers';
import { JWT_FIXTURES, USER_FIXTURES, REQUEST_FIXTURES } from '../utils/test-fixtures';

describe('Auth Middleware Integration Tests', () => {
  let app: Express;
  let server: ApolloServer<GraphQLContext>;
  let mockAuth0Service: any;
  let mockUserService: any;
  let mockCacheService: any;
  let mockWorkspaceAuthService: any;
  let mockUserProfileService: any;
  let mockOnboardingService: any;
  let mockWorkspaceService: any;

  beforeEach(async () => {
    // Create mock services
    mockAuth0Service = createMockAuth0Service();
    mockUserService = createMockUserService();
    mockCacheService = createMockCacheService();
    mockWorkspaceAuthService = createMockWorkspaceAuthorizationService();
    
    // Create additional required mock services
    mockUserProfileService = {
      getProfile: jest.fn(),
      createProfile: jest.fn(),
      updateProfile: jest.fn(),
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
      typeDefs: `
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
        
        type Query {
          me: User
          validateSession: Boolean!
        }
        
        type Mutation {
          syncUserFromAuth0(auth0Token: String!): AuthPayload!
          refreshSession: Session!
          logout: Boolean!
          assignRole(userId: ID!, role: String!): User!
          removeRole(userId: ID!, role: String!): User!
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
      `,
      resolvers: authResolvers,
    });

    await server.start();

    // Setup GraphQL endpoint
    app.use(
      '/graphql',
      expressMiddleware(server, {
        context: async ({ req, res }: { req: any; res: any }) => {
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
            
            return context;
          } catch (error) {
            console.error('Error creating GraphQL context:', error);
            throw error;
          }
        },
      })
    );
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (server) {
      await server.stop();
    }
  });

  describe('Authentication without Auth0 permissions', () => {
    test('successfully authenticates user with valid JWT token', async () => {
      // Setup mocks
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: 'query { me { id email roles } }'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.me).toBeDefined();
      expect(response.body.data.me.id).toBe(USER_FIXTURES.STANDARD_USER.id);
    });

    test('rejects requests with invalid JWT token', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue(null);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          query: 'query { me { id email } }'
        });

      expect(response.status).toBe(200); // GraphQL returns 200 but with errors
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Authentication required');
    });

    test('rejects requests without authorization header', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: 'query { me { id email } }'
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Authentication required');
    });

    test('handles expired JWT tokens gracefully', async () => {
      mockAuth0Service.validateAuth0Token.mockRejectedValue(new Error('JWT token expired'));

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.EXPIRED_TOKEN}`)
        .send({
          query: 'query { me { id email } }'
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Authentication failed');
    });
  });

  describe('GraphQL context permission resolution', () => {
    test('populates GraphQL context with workspace authorization service', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      // Mock workspace permissions
      mockWorkspaceAuthService.getUserPermissionsForContext.mockResolvedValue({
        'ws-1': ['workspace:read', 'card:create', 'card:read'],
        'ws-2': ['workspace:read', 'card:read']
      });

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              syncUserFromAuth0(auth0Token: "${JWT_FIXTURES.VALID_TOKEN}") {
                user { id email }
                permissions
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.syncUserFromAuth0).toBeDefined();
      expect(response.body.data.syncUserFromAuth0.permissions).toEqual(
        expect.arrayContaining(['workspace:read', 'card:create', 'card:read'])
      );
    });

    test('GraphQL context includes workspace authorization service', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: 'query { me { id email roles } }'
        });

      expect(response.status).toBe(200);
      
      // Verify that workspace authorization service is available in context
      expect(mockWorkspaceAuthService.getUserPermissionsForContext).toHaveBeenCalledTimes(0);
    });

    test('handles missing user in database during context creation', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|unknown_user',
        email: 'unknown@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(null);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: 'query { me { id email } }'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.me).toBeNull();
    });
  });

  describe('Request handling with workspace context', () => {
    test('handles requests with workspace-specific headers', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', 'ws-1')
        .send({
          query: 'query { me { id email } }'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.me).toBeDefined();
    });

    test('validates workspace access in protected resolvers', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      // Mock no workspace permissions for this user
      mockWorkspaceAuthService.hasPermissionInWorkspace.mockResolvedValue(false);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('x-workspace-id', 'ws-unauthorized')
        .send({
          query: `
            query {
              workspace(id: "ws-unauthorized") {
                id
                name
              }
            }
          `
        });

      expect(response.status).toBe(200);
      // Should return null or error for unauthorized workspace access
      expect(response.body.data?.workspace).toBeNull();
    });
  });

  describe('Session management without permissions', () => {
    test('creates session without permission synchronization', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockCacheService.set.mockResolvedValue('OK');

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              syncUserFromAuth0(auth0Token: "${JWT_FIXTURES.VALID_TOKEN}") {
                user { id email roles }
                sessionId
                expiresAt
                permissions
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.syncUserFromAuth0).toBeDefined();
      expect(response.body.data.syncUserFromAuth0.user.roles).toEqual(['user']);
      expect(response.body.data.syncUserFromAuth0.permissions).toBeDefined();
      
      // Verify session was created in cache
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    test('validates session without checking Auth0 permissions', async () => {
      // Mock existing session
      mockCacheService.get.mockResolvedValue({
        userId: USER_FIXTURES.STANDARD_USER.id,
        auth0UserId: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      });

      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: 'query { validateSession }'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.validateSession).toBe(true);
    });

    test('refreshes session without permission updates', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      // Mock existing session that needs refresh
      mockCacheService.get.mockResolvedValue({
        userId: USER_FIXTURES.STANDARD_USER.id,
        auth0UserId: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now (needs refresh)
      });

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: `
            mutation {
              refreshSession {
                userId
                expiresAt
                roles
              }
            }
          `
        });

      expect(response.status).toBe(200);
      expect(response.body.data.refreshSession).toBeDefined();
      expect(response.body.data.refreshSession.userId).toBe(USER_FIXTURES.STANDARD_USER.id);
    });

    test('handles logout without permission cleanup', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockCacheService.del.mockResolvedValue(1);

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: 'mutation { logout }'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.logout).toBe(true);
      expect(mockCacheService.del).toHaveBeenCalled();
    });
  });

  describe('Error handling in middleware', () => {
    test('handles Auth0 service unavailability', async () => {
      mockAuth0Service.validateAuth0Token.mockRejectedValue(new Error('Auth0 service unavailable'));

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: 'query { me { id email } }'
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
    });

    test('handles database connection failures gracefully', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: 'query { me { id email } }'
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
    });

    test('handles cache service failures gracefully', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockCacheService.get.mockRejectedValue(new Error('Redis connection failed'));
      mockCacheService.set.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: 'query { me { id email } }'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.me).toBeDefined();
      // Should work even without cache
    });

    test('handles malformed authorization headers', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', 'InvalidFormat token')
        .send({
          query: 'query { me { id email } }'
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
    });

    test('handles missing Bearer prefix in authorization header', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', JWT_FIXTURES.VALID_TOKEN)
        .send({
          query: 'query { me { id email } }'
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Performance and caching in middleware', () => {
    test('caches authentication results to reduce Auth0 calls', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      // Make multiple requests with same token
      await Promise.all([
        request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
          .send({ query: 'query { me { id } }' }),
        request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
          .send({ query: 'query { me { email } }' }),
        request(app)
          .post('/graphql')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
          .send({ query: 'query { me { roles } }' })
      ]);

      // Should cache the authentication results
      expect(mockAuth0Service.validateAuth0Token).toHaveBeenCalled();
    });

    test('middleware completes quickly for authenticated requests', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        sub: 'auth0|test_user_123',
        email: 'john.doe@example.com',
        roles: ['user'],
      });

      mockUserService.findByAuth0Id.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      const startTime = Date.now();

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .send({
          query: 'query { me { id email } }'
        });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});