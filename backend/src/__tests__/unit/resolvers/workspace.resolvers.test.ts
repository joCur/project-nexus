import { workspaceResolvers } from '@/resolvers/workspace';
import { GraphQLContext } from '@/types';
import { User } from '@/types/auth';
import { Workspace } from '@/services/workspace';
import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  RateLimitError
} from '@/utils/errors';
import { createComprehensiveMocks, resetAllMocks, TEST_FIXTURES, ComprehensiveMocks } from '../../utils/comprehensive-mocks';

// Mock services and utilities
jest.mock('@/services/rateLimiter', () => ({
  rateLimiterService: {
    checkOwnershipTransferLimit: jest.fn(),
    resetLimit: jest.fn(),
    getRateLimitStatus: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/utils/authorizationHelper', () => ({
  createAuthorizationHelper: () => ({
    requireWorkspacePermission: jest.fn(),
    requireGlobalPermission: jest.fn(),
  }),
}));

describe('Workspace Resolvers', () => {
  let mocks: ComprehensiveMocks;

  beforeEach(() => {
    mocks = createComprehensiveMocks();
    resetAllMocks(mocks);

    // Mock createAuthorizationHelper to return our mock
    const authHelperModule = require('@/utils/authorizationHelper');
    authHelperModule.createAuthorizationHelper = jest.fn().mockReturnValue(mocks.authHelper);

    // Mock rateLimiterService
    const rateLimiterModule = require('@/services/rateLimiter');
    rateLimiterModule.rateLimiterService = mocks.rateLimiterService;
  });

  describe('Mutation', () => {
    describe('transferWorkspaceOwnership', () => {
      const mockInput = {
        workspaceId: TEST_FIXTURES.workspace.id,
        newOwnerId: TEST_FIXTURES.newOwner.id,
      };

      const mockUpdatedWorkspace: Workspace = {
        ...TEST_FIXTURES.workspace,
        ownerId: TEST_FIXTURES.newOwner.id,
      };

      describe('Success Scenarios', () => {

        it('should successfully transfer workspace ownership with all validations', async () => {
          // Setup mocks
          mocks.workspaceService.getWorkspaceById.mockResolvedValue(TEST_FIXTURES.workspace);
          mocks.userService.findById.mockResolvedValue(TEST_FIXTURES.newOwner);
          mocks.workspaceService.transferOwnership.mockResolvedValue(mockUpdatedWorkspace);
          mocks.rateLimiterService.checkOwnershipTransferLimit.mockResolvedValue(undefined);
          mocks.authHelper.requireWorkspacePermission.mockResolvedValue(undefined);
          mocks.cacheService.del.mockResolvedValue(undefined);
          mocks.cacheService.set.mockResolvedValue(undefined);

          // Execute resolver
          const result = await workspaceResolvers.Mutation.transferWorkspaceOwnership(
            {},
            { input: mockInput },
            mocks.context
          );

          // Verify result
          expect(result).toEqual(mockUpdatedWorkspace);

          // Verify rate limiting check
          expect(mocks.rateLimiterService.checkOwnershipTransferLimit).toHaveBeenCalledWith(mocks.context);

          // Verify permission check
          expect(mocks.authHelper.requireWorkspacePermission).toHaveBeenCalledWith(
            TEST_FIXTURES.workspace.id,
            'workspace:transfer_ownership',
            'You do not have permission to transfer ownership of this workspace'
          );

          // Verify transactional transfer
          expect(mocks.workspaceService.transferOwnership).toHaveBeenCalledWith(
            TEST_FIXTURES.workspace.id,
            TEST_FIXTURES.newOwner.id
          );

          // Verify cache operations
          expect(mocks.cacheService.del).toHaveBeenCalledWith(`workspace:${TEST_FIXTURES.workspace.id}`);
          expect(mocks.cacheService.set).toHaveBeenCalledWith(
            `workspace:${TEST_FIXTURES.workspace.id}`,
            mockUpdatedWorkspace,
            300
          );
        });
      });

      describe('Authentication and Authorization Errors', () => {
        it('should throw AuthenticationError when user is not authenticated', async () => {
          const unauthenticatedContext = { ...mocks.context, isAuthenticated: false };

          await expect(
            workspaceResolvers.Mutation.transferWorkspaceOwnership(
              {},
              { input: mockInput },
              unauthenticatedContext
            )
          ).rejects.toThrow(AuthenticationError);

          // Verify no service calls were made
          expect(mocks.workspaceService.transferOwnership).not.toHaveBeenCalled();
          expect(mocks.rateLimiterService.checkOwnershipTransferLimit).not.toHaveBeenCalled();
        });

        it('should throw RateLimitError when rate limit is exceeded', async () => {
          mocks.workspaceService.getWorkspaceById.mockResolvedValue(TEST_FIXTURES.workspace);
          mocks.userService.findById.mockResolvedValue(TEST_FIXTURES.newOwner);
          mocks.rateLimiterService.checkOwnershipTransferLimit.mockRejectedValue(
            new RateLimitError(3, 86400000, 86400000)
          );

          await expect(
            workspaceResolvers.Mutation.transferWorkspaceOwnership(
              {},
              { input: mockInput },
              mocks.context
            )
          ).rejects.toThrow(RateLimitError);

          expect(mocks.rateLimiterService.checkOwnershipTransferLimit).toHaveBeenCalledWith(mocks.context);
          expect(mocks.workspaceService.transferOwnership).not.toHaveBeenCalled();
        });

        it('should throw AuthorizationError when user lacks permission', async () => {
          mocks.workspaceService.getWorkspaceById.mockResolvedValue(TEST_FIXTURES.workspace);
          mocks.userService.findById.mockResolvedValue(TEST_FIXTURES.newOwner);
          mocks.rateLimiterService.checkOwnershipTransferLimit.mockResolvedValue(undefined);
          mocks.authHelper.requireWorkspacePermission.mockRejectedValue(
            new AuthorizationError('You do not have permission to transfer ownership of this workspace')
          );

          await expect(
            workspaceResolvers.Mutation.transferWorkspaceOwnership(
              {},
              { input: mockInput },
              mocks.context
            )
          ).rejects.toThrow(AuthorizationError);

          expect(mocks.rateLimiterService.checkOwnershipTransferLimit).toHaveBeenCalledWith(mocks.context);
          expect(mocks.authHelper.requireWorkspacePermission).toHaveBeenCalled();
          expect(mocks.workspaceService.transferOwnership).not.toHaveBeenCalled();
        });
      });

      describe('Service Error Scenarios', () => {
        beforeEach(() => {
          // Setup workspace and user mocks
          mocks.workspaceService.getWorkspaceById.mockResolvedValue(TEST_FIXTURES.workspace);
          mocks.userService.findById.mockResolvedValue(TEST_FIXTURES.newOwner);
          // Setup successful rate limiting and authorization for these tests
          mocks.rateLimiterService.checkOwnershipTransferLimit.mockResolvedValue(undefined);
          mocks.authHelper.requireWorkspacePermission.mockResolvedValue(undefined);
        });

        it('should handle database transaction failures gracefully', async () => {
          const transactionError = new Error('Database transaction failed');
          mocks.workspaceService.transferOwnership.mockRejectedValue(transactionError);

          await expect(
            workspaceResolvers.Mutation.transferWorkspaceOwnership(
              {},
              { input: mockInput },
              mocks.context
            )
          ).rejects.toThrow('Database transaction failed');

          expect(mocks.workspaceService.transferOwnership).toHaveBeenCalledWith(
            TEST_FIXTURES.workspace.id,
            TEST_FIXTURES.newOwner.id
          );
        });

        it('should handle cache service failures gracefully without affecting transfer', async () => {
          mocks.workspaceService.transferOwnership.mockResolvedValue(mockUpdatedWorkspace);
          mocks.cacheService.del.mockRejectedValue(new Error('Cache service unavailable'));
          mocks.cacheService.set.mockRejectedValue(new Error('Cache service unavailable'));

          const result = await workspaceResolvers.Mutation.transferWorkspaceOwnership(
            {},
            { input: mockInput },
            mocks.context
          );

          // Transfer should still succeed even if cache operations fail
          expect(result).toEqual(mockUpdatedWorkspace);
          expect(mocks.workspaceService.transferOwnership).toHaveBeenCalled();
        });
      });
    });
  });
});