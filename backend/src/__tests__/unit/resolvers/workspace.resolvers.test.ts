import { workspaceResolvers } from '@/resolvers/workspace';
import { GraphQLContext } from '@/types';
import { User } from '@/types/auth';
import { Workspace } from '@/services/workspace';
import { 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError 
} from '@/utils/errors';
import { WorkspaceService } from '@/services/workspace';
import { UserService } from '@/services/user';

// Mock services
jest.mock('@/services/workspace');
jest.mock('@/services/user');
jest.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock authorization helper
jest.mock('@/utils/authorizationHelper', () => ({
  createAuthorizationHelper: () => ({
    requireWorkspacePermission: jest.fn(),
    requireGlobalPermission: jest.fn(),
  }),
}));

describe('Workspace Resolvers', () => {
  let mockWorkspaceService: jest.Mocked<WorkspaceService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockAuthHelper: any;
  let mockContext: GraphQLContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock services
    mockWorkspaceService = {
      getWorkspaceById: jest.fn(),
      updateWorkspace: jest.fn(),
    } as any;

    mockUserService = {
      findById: jest.fn(),
    } as any;

    // Mock authorization helper
    mockAuthHelper = {
      requireWorkspacePermission: jest.fn(),
    };

    // Create mock context
    mockContext = {
      isAuthenticated: true,
      user: {
        id: 'user-123',
        email: 'test@example.com',
      },
      dataSources: {
        workspaceService: mockWorkspaceService,
        userService: mockUserService,
      },
    } as any;

    // Mock createAuthorizationHelper to return our mock
    const authHelperModule = require('@/utils/authorizationHelper');
    authHelperModule.createAuthorizationHelper = jest.fn().mockReturnValue(mockAuthHelper);
  });

  describe('transferWorkspaceOwnership mutation', () => {
    const mockInput = {
      workspaceId: 'workspace-123',
      newOwnerId: 'new-owner-456',
    };

    const mockWorkspace: Workspace = {
      id: 'workspace-123',
      name: 'Test Workspace',
      ownerId: 'current-owner-789',
      privacy: 'PRIVATE',
      settings: {},
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockNewOwner: User = {
      id: 'new-owner-456',
      email: 'newowner@example.com',
      auth0UserId: 'auth0|new-owner-456',
      emailVerified: true,
      displayName: 'New Owner',
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: ['user'],
      metadataSyncedAt: new Date(),
    };

    const mockUpdatedWorkspace: Workspace = {
      ...mockWorkspace,
      ownerId: 'new-owner-456',
    };

    it('should successfully transfer workspace ownership', async () => {
      // Setup mocks
      mockWorkspaceService.getWorkspaceById.mockResolvedValue(mockWorkspace);
      mockUserService.findById.mockResolvedValue(mockNewOwner);
      mockWorkspaceService.updateWorkspace.mockResolvedValue(mockUpdatedWorkspace);
      mockAuthHelper.requireWorkspacePermission.mockResolvedValue(undefined);

      // Execute resolver
      const result = await workspaceResolvers.Mutation.transferWorkspaceOwnership(
        {},
        { input: mockInput },
        mockContext
      );

      // Verify result
      expect(result).toEqual(mockUpdatedWorkspace);

      // Verify service calls
      expect(mockWorkspaceService.getWorkspaceById).toHaveBeenCalledWith('workspace-123');
      expect(mockUserService.findById).toHaveBeenCalledWith('new-owner-456');
      expect(mockWorkspaceService.updateWorkspace).toHaveBeenCalledWith('workspace-123', {
        ownerId: 'new-owner-456'
      });

      // Verify permission check
      expect(mockAuthHelper.requireWorkspacePermission).toHaveBeenCalledWith(
        'workspace-123',
        'workspace:transfer_ownership',
        'You do not have permission to transfer ownership of this workspace'
      );
    });

    it('should throw AuthenticationError when user is not authenticated', async () => {
      mockContext.isAuthenticated = false;

      await expect(
        workspaceResolvers.Mutation.transferWorkspaceOwnership(
          {},
          { input: mockInput },
          mockContext
        )
      ).rejects.toThrow(AuthenticationError);

      // Verify no service calls were made
      expect(mockWorkspaceService.getWorkspaceById).not.toHaveBeenCalled();
      expect(mockUserService.findById).not.toHaveBeenCalled();
      expect(mockWorkspaceService.updateWorkspace).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when workspace does not exist', async () => {
      mockWorkspaceService.getWorkspaceById.mockResolvedValue(null);

      await expect(
        workspaceResolvers.Mutation.transferWorkspaceOwnership(
          {},
          { input: mockInput },
          mockContext
        )
      ).rejects.toThrow(new NotFoundError('Workspace', 'workspace-123'));

      expect(mockWorkspaceService.getWorkspaceById).toHaveBeenCalledWith('workspace-123');
      expect(mockUserService.findById).not.toHaveBeenCalled();
      expect(mockWorkspaceService.updateWorkspace).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when new owner does not exist', async () => {
      mockWorkspaceService.getWorkspaceById.mockResolvedValue(mockWorkspace);
      mockUserService.findById.mockResolvedValue(null);

      await expect(
        workspaceResolvers.Mutation.transferWorkspaceOwnership(
          {},
          { input: mockInput },
          mockContext
        )
      ).rejects.toThrow(new NotFoundError('User', 'new-owner-456'));

      expect(mockWorkspaceService.getWorkspaceById).toHaveBeenCalledWith('workspace-123');
      expect(mockUserService.findById).toHaveBeenCalledWith('new-owner-456');
      expect(mockWorkspaceService.updateWorkspace).not.toHaveBeenCalled();
    });

    it('should throw error when user lacks transfer ownership permission', async () => {
      mockWorkspaceService.getWorkspaceById.mockResolvedValue(mockWorkspace);
      mockUserService.findById.mockResolvedValue(mockNewOwner);
      
      const permissionError = new AuthorizationError(
        'You do not have permission to transfer ownership of this workspace',
        'INSUFFICIENT_PERMISSIONS'
      );
      mockAuthHelper.requireWorkspacePermission.mockRejectedValue(permissionError);

      await expect(
        workspaceResolvers.Mutation.transferWorkspaceOwnership(
          {},
          { input: mockInput },
          mockContext
        )
      ).rejects.toThrow(permissionError);

      expect(mockWorkspaceService.getWorkspaceById).toHaveBeenCalledWith('workspace-123');
      expect(mockUserService.findById).toHaveBeenCalledWith('new-owner-456');
      expect(mockWorkspaceService.updateWorkspace).not.toHaveBeenCalled();
    });

    it('should handle workspace service update errors gracefully', async () => {
      mockWorkspaceService.getWorkspaceById.mockResolvedValue(mockWorkspace);
      mockUserService.findById.mockResolvedValue(mockNewOwner);
      mockAuthHelper.requireWorkspacePermission.mockResolvedValue(undefined);
      
      const updateError = new Error('Database connection failed');
      mockWorkspaceService.updateWorkspace.mockRejectedValue(updateError);

      await expect(
        workspaceResolvers.Mutation.transferWorkspaceOwnership(
          {},
          { input: mockInput },
          mockContext
        )
      ).rejects.toThrow(updateError);

      expect(mockWorkspaceService.updateWorkspace).toHaveBeenCalledWith('workspace-123', {
        ownerId: 'new-owner-456'
      });
    });

    it('should validate input parameters correctly', async () => {
      mockWorkspaceService.getWorkspaceById.mockResolvedValue(mockWorkspace);
      mockUserService.findById.mockResolvedValue(mockNewOwner);
      mockWorkspaceService.updateWorkspace.mockResolvedValue(mockUpdatedWorkspace);
      mockAuthHelper.requireWorkspacePermission.mockResolvedValue(undefined);

      const inputWithExtraFields = {
        workspaceId: 'workspace-123',
        newOwnerId: 'new-owner-456',
        extraField: 'should be ignored',
      };

      const result = await workspaceResolvers.Mutation.transferWorkspaceOwnership(
        {},
        { input: inputWithExtraFields },
        mockContext
      );

      expect(result).toEqual(mockUpdatedWorkspace);
      
      // Verify only the expected fields are passed to the service
      expect(mockWorkspaceService.updateWorkspace).toHaveBeenCalledWith('workspace-123', {
        ownerId: 'new-owner-456'
      });
    });

    it('should handle concurrent ownership transfer attempts', async () => {
      mockWorkspaceService.getWorkspaceById.mockResolvedValue(mockWorkspace);
      mockUserService.findById.mockResolvedValue(mockNewOwner);
      mockAuthHelper.requireWorkspacePermission.mockResolvedValue(undefined);
      
      // Simulate concurrent modification error
      const concurrencyError = new Error('Workspace was modified by another user');
      mockWorkspaceService.updateWorkspace.mockRejectedValue(concurrencyError);

      await expect(
        workspaceResolvers.Mutation.transferWorkspaceOwnership(
          {},
          { input: mockInput },
          mockContext
        )
      ).rejects.toThrow(concurrencyError);
    });
  });
});