import { WorkspaceService } from '@/services/workspace';
import { UserService } from '@/services/user';
import { CacheService } from '@/services/cache';
import { rateLimiterService } from '@/services/rateLimiter';
import { GraphQLContext } from '@/types';

/**
 * Comprehensive mock services with all methods needed for testing
 * Provides type-safe mocks for all service methods
 */

export interface ComprehensiveMocks {
  workspaceService: jest.Mocked<WorkspaceService>;
  userService: jest.Mocked<UserService>;
  cacheService: jest.Mocked<CacheService>;
  rateLimiterService: jest.Mocked<typeof rateLimiterService>;
  authHelper: any;
  context: GraphQLContext;
}

export function createComprehensiveMocks(): ComprehensiveMocks {
  // Mock WorkspaceService with all methods
  const mockWorkspaceService = {
    getWorkspaceById: jest.fn(),
    getWorkspacesByOwnerId: jest.fn(),
    getDefaultWorkspace: jest.fn(),
    createWorkspace: jest.fn(),
    updateWorkspace: jest.fn(),
    deleteWorkspace: jest.fn(),
    transferOwnership: jest.fn(),
    createDefaultWorkspace: jest.fn(),
    searchWorkspaces: jest.fn(),
    mapDbWorkspaceToWorkspace: jest.fn(),
  } as any;

  // Mock UserService with all methods
  const mockUserService = {
    findById: jest.fn(),
    findByAuth0Id: jest.fn(),
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    searchUsers: jest.fn(),
    getUsersByIds: jest.fn(),
  } as any;

  // Mock CacheService with all methods
  const mockCacheService = {
    connect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    incr: jest.fn(),
    mset: jest.fn(),
    mget: jest.fn(),
    mdel: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(),
    healthCheck: jest.fn(),
    close: jest.fn(),
    isConnectedToRedis: jest.fn(),
  } as any;

  // Mock RateLimiterService
  const mockRateLimiterService = {
    checkOwnershipTransferLimit: jest.fn(),
    resetLimit: jest.fn(),
    getRateLimitStatus: jest.fn(),
  } as any;

  // Mock authorization helper
  const mockAuthHelper = {
    requireWorkspacePermission: jest.fn(),
    requireGlobalPermission: jest.fn(),
    hasWorkspacePermission: jest.fn(),
    hasGlobalPermission: jest.fn(),
    getWorkspaceRole: jest.fn(),
    getUserPermissions: jest.fn(),
  };

  // Mock GraphQL context
  const mockContext: GraphQLContext = {
    isAuthenticated: true,
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      auth0UserId: 'auth0|test-user-123',
      emailVerified: true,
      displayName: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [],
      metadataSyncedAt: new Date(),
    } as any,
    auth0Payload: {
      sub: 'auth0|test-user-123',
      email: 'test@example.com',
      emailVerified: true,
      iat: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    } as any,
    req: {} as any,
    res: {} as any,
    dataSources: {
      workspaceService: mockWorkspaceService,
      userService: mockUserService,
      cacheService: mockCacheService,
      userProfileService: {} as any,
      onboardingService: {} as any,
      auth0Service: {} as any,
      workspaceAuthorizationService: {} as any,
    },
  };

  return {
    workspaceService: mockWorkspaceService,
    userService: mockUserService,
    cacheService: mockCacheService,
    rateLimiterService: mockRateLimiterService,
    authHelper: mockAuthHelper,
    context: mockContext,
  };
}

export function resetAllMocks(mocks: ComprehensiveMocks): void {
  jest.clearAllMocks();
  
  // Reset mock implementations
  Object.values(mocks.workspaceService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
  
  Object.values(mocks.userService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
  
  Object.values(mocks.cacheService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
  
  Object.values(mocks.rateLimiterService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
  
  Object.values(mocks.authHelper).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
}

// Test data fixtures
export const TEST_FIXTURES = {
  workspace: {
    id: 'workspace-123',
    name: 'Test Workspace',
    ownerId: 'owner-123',
    privacy: 'PRIVATE' as const,
    settings: {},
    isDefault: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  user: {
    id: 'user-456',
    email: 'user@example.com',
    auth0UserId: 'auth0|user-456',
    emailVerified: true,
    displayName: 'Test User',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  newOwner: {
    id: 'new-owner-789',
    email: 'newowner@example.com',
    auth0UserId: 'auth0|new-owner-789',
    emailVerified: true,
    displayName: 'New Owner',
    roles: [],
    metadataSyncedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
};