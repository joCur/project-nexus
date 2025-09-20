/**
 * Permission utilities tests
 * 
 * Tests the new workspace-aware permission checking functionality
 * integrated with backend GraphQL queries.
 */

import {
  checkUserPermission,
  checkAnyUserPermission,
  checkAllUserPermissions,
  checkUserRole,
  checkAnyUserRole,
  checkAllUserRoles,
  createWorkspacePermissionChecker,
  setPermissionContext,
  getPermissionContext,
  clearPermissionContext,
  isValidPermissionFormat,
  isBackendIntegrationReady,
} from '../permissions';
import { ExtendedUserProfile } from '@/types/auth';
import * as permissionLogger from '../permissionLogger';

// Mock the permission logger
jest.mock('../permissionLogger', () => ({
  permissionLogger: {
    logPermissionCheck: jest.fn(),
    logError: jest.fn(),
    logPerformanceMetric: jest.fn(),
  },
}));

describe('Permission Utilities', () => {
  const mockUser: ExtendedUserProfile = {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user', 'premium'],
  };

  const mockPermissions = ['workspace:read', 'workspace:update', 'card:create'];
  const mockWorkspacePermissions = {
    'workspace-1': ['workspace:read', 'workspace:update', 'card:create'],
    'workspace-2': ['workspace:read', 'card:read'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearPermissionContext();
  });

  describe('Permission Context Management', () => {
    it('should set and get permission context', () => {
      const context = {
        workspaceId: 'workspace-1',
        permissions: mockPermissions,
        permissionsByWorkspace: mockWorkspacePermissions,
      };

      setPermissionContext(context);
      expect(getPermissionContext()).toEqual(context);
    });

    it('should clear permission context', () => {
      setPermissionContext({
        workspaceId: 'workspace-1',
        permissions: mockPermissions,
      });

      clearPermissionContext();
      expect(getPermissionContext()).toEqual({});
    });

    it('should return empty object initially', () => {
      expect(getPermissionContext()).toEqual({});
    });
  });

  describe('checkUserPermission', () => {
    it('should return false for null user', () => {
      setPermissionContext({ permissions: mockPermissions });
      expect(checkUserPermission(null, 'workspace:read')).toBe(false);
    });

    it('should return false for empty permission', () => {
      setPermissionContext({ permissions: mockPermissions });
      expect(checkUserPermission(mockUser, '')).toBe(false);
    });

    it('should return false for user without sub', () => {
      const userWithoutSub = { ...mockUser, sub: '' };
      setPermissionContext({ permissions: mockPermissions });
      expect(checkUserPermission(userWithoutSub, 'workspace:read')).toBe(false);
    });

    it('should check permissions from general context', () => {
      setPermissionContext({ permissions: mockPermissions });
      
      expect(checkUserPermission(mockUser, 'workspace:read')).toBe(true);
      expect(checkUserPermission(mockUser, 'workspace:delete')).toBe(false);
    });

    it('should check workspace-specific permissions', () => {
      setPermissionContext({ 
        workspaceId: 'workspace-1',
        permissionsByWorkspace: mockWorkspacePermissions 
      });
      
      expect(checkUserPermission(mockUser, 'workspace:read')).toBe(true);
      expect(checkUserPermission(mockUser, 'workspace:update')).toBe(true);
      expect(checkUserPermission(mockUser, 'card:create')).toBe(true);
      expect(checkUserPermission(mockUser, 'workspace:delete')).toBe(false);
    });

    it('should use explicit workspace ID over context', () => {
      setPermissionContext({ 
        workspaceId: 'workspace-1',
        permissionsByWorkspace: mockWorkspacePermissions 
      });
      
      // Using workspace-2 explicitly should check workspace-2 permissions
      expect(checkUserPermission(mockUser, 'workspace:update', 'workspace-2')).toBe(false);
      expect(checkUserPermission(mockUser, 'workspace:read', 'workspace-2')).toBe(true);
    });

    it('should return false when no context is available', () => {
      // Should warn in non-test environment and return false
      expect(checkUserPermission(mockUser, 'workspace:read')).toBe(false);
    });

    it.skip('should handle errors gracefully', () => {
      // Mock permissionLogger to throw error during logging
      const originalLogPermissionCheck = permissionLogger.permissionLogger.logPermissionCheck;
      permissionLogger.permissionLogger.logPermissionCheck = jest.fn().mockImplementation(() => {
        throw new Error('Logging error');
      });
      
      setPermissionContext({ permissions: mockPermissions });
      
      // Should handle the error and return false
      expect(checkUserPermission(mockUser, 'workspace:read')).toBe(false);
      expect(permissionLogger.permissionLogger.logError).toHaveBeenCalledWith(
        'Permission check failed',
        expect.objectContaining({
          permission: 'workspace:read',
          userId: mockUser.sub,
          workspaceId: undefined
        })
      );
      
      // Restore original mock
      permissionLogger.permissionLogger.logPermissionCheck = originalLogPermissionCheck;
    });

    it.skip('should log permission checks', () => {
      setPermissionContext({ permissions: mockPermissions });
      
      checkUserPermission(mockUser, 'workspace:read');
      
      expect(permissionLogger.permissionLogger.logPermissionCheck).toHaveBeenCalledWith(
        'workspace:read',
        true,
        mockUser.sub,
        undefined
      );
    });

    it.skip('should log performance metrics', () => {
      setPermissionContext({ permissions: mockPermissions });
      
      checkUserPermission(mockUser, 'workspace:read');
      
      expect(permissionLogger.permissionLogger.logPerformanceMetric).toHaveBeenCalledWith(
        'checkUserPermission',
        expect.any(Number),
        mockUser.sub,
        undefined,
        expect.objectContaining({
          permission: 'workspace:read',
          result: true,
        })
      );
    });
  });

  describe('checkAnyUserPermission', () => {
    it('should return false for null user', () => {
      setPermissionContext({ permissions: mockPermissions });
      expect(checkAnyUserPermission(null, ['workspace:read', 'workspace:update'])).toBe(false);
    });

    it('should return false for empty permissions array', () => {
      setPermissionContext({ permissions: mockPermissions });
      expect(checkAnyUserPermission(mockUser, [])).toBe(false);
    });

    it('should return true if user has any of the permissions', () => {
      setPermissionContext({ permissions: mockPermissions });
      
      expect(checkAnyUserPermission(mockUser, ['workspace:read', 'workspace:delete'])).toBe(true);
      expect(checkAnyUserPermission(mockUser, ['workspace:delete', 'admin:system'])).toBe(false);
    });

    it('should work with workspace-specific context', () => {
      setPermissionContext({ 
        workspaceId: 'workspace-1',
        permissionsByWorkspace: mockWorkspacePermissions 
      });
      
      expect(checkAnyUserPermission(mockUser, ['workspace:update', 'workspace:delete'])).toBe(true);
      expect(checkAnyUserPermission(mockUser, ['workspace:delete', 'admin:system'])).toBe(false);
    });
  });

  describe('checkAllUserPermissions', () => {
    it('should return false for null user', () => {
      setPermissionContext({ permissions: mockPermissions });
      expect(checkAllUserPermissions(null, ['workspace:read', 'workspace:update'])).toBe(false);
    });

    it('should return false for empty permissions array', () => {
      setPermissionContext({ permissions: mockPermissions });
      expect(checkAllUserPermissions(mockUser, [])).toBe(false);
    });

    it('should return true only if user has all permissions', () => {
      setPermissionContext({ permissions: mockPermissions });
      
      expect(checkAllUserPermissions(mockUser, ['workspace:read', 'workspace:update'])).toBe(true);
      expect(checkAllUserPermissions(mockUser, ['workspace:read', 'workspace:delete'])).toBe(false);
    });

    it('should work with workspace-specific context', () => {
      setPermissionContext({ 
        workspaceId: 'workspace-1',
        permissionsByWorkspace: mockWorkspacePermissions 
      });
      
      expect(checkAllUserPermissions(mockUser, ['workspace:read', 'workspace:update'])).toBe(true);
      expect(checkAllUserPermissions(mockUser, ['workspace:read', 'workspace:delete'])).toBe(false);
    });
  });

  describe('Role Checking Functions', () => {
    describe('checkUserRole', () => {
      it('should return false for null user', () => {
        expect(checkUserRole(null, 'user')).toBe(false);
      });

      it('should return false for user without roles', () => {
        const userWithoutRoles = { ...mockUser, roles: undefined };
        expect(checkUserRole(userWithoutRoles, 'user')).toBe(false);
      });

      it('should check if user has role', () => {
        expect(checkUserRole(mockUser, 'user')).toBe(true);
        expect(checkUserRole(mockUser, 'premium')).toBe(true);
        expect(checkUserRole(mockUser, 'admin')).toBe(false);
      });
    });

    describe('checkAnyUserRole', () => {
      it('should return false for null user', () => {
        expect(checkAnyUserRole(null, ['user', 'admin'])).toBe(false);
      });

      it('should return false for user without roles', () => {
        const userWithoutRoles = { ...mockUser, roles: undefined };
        expect(checkAnyUserRole(userWithoutRoles, ['user', 'admin'])).toBe(false);
      });

      it('should return true if user has any role', () => {
        expect(checkAnyUserRole(mockUser, ['user', 'admin'])).toBe(true);
        expect(checkAnyUserRole(mockUser, ['admin', 'super_admin'])).toBe(false);
      });
    });

    describe('checkAllUserRoles', () => {
      it('should return false for null user', () => {
        expect(checkAllUserRoles(null, ['user', 'premium'])).toBe(false);
      });

      it('should return false for user without roles', () => {
        const userWithoutRoles = { ...mockUser, roles: undefined };
        expect(checkAllUserRoles(userWithoutRoles, ['user', 'premium'])).toBe(false);
      });

      it('should return true only if user has all roles', () => {
        expect(checkAllUserRoles(mockUser, ['user', 'premium'])).toBe(true);
        expect(checkAllUserRoles(mockUser, ['user', 'admin'])).toBe(false);
      });
    });
  });

  describe('createWorkspacePermissionChecker', () => {
    it('should create workspace-aware permission checker', () => {
      setPermissionContext({ 
        permissionsByWorkspace: mockWorkspacePermissions 
      });

      const checker = createWorkspacePermissionChecker(mockUser, 'workspace-1');

      expect(checker.hasPermission('workspace:read')).toBe(true);
      expect(checker.hasPermission('workspace:delete')).toBe(false);
      
      expect(checker.hasAnyPermission(['workspace:read', 'workspace:delete'])).toBe(true);
      expect(checker.hasAnyPermission(['workspace:delete', 'admin:system'])).toBe(false);
      
      expect(checker.hasAllPermissions(['workspace:read', 'workspace:update'])).toBe(true);
      expect(checker.hasAllPermissions(['workspace:read', 'workspace:delete'])).toBe(false);
    });

    it('should work with null user', () => {
      const checker = createWorkspacePermissionChecker(null, 'workspace-1');

      expect(checker.hasPermission('workspace:read')).toBe(false);
      expect(checker.hasAnyPermission(['workspace:read', 'workspace:update'])).toBe(false);
      expect(checker.hasAllPermissions(['workspace:read', 'workspace:update'])).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    describe('isValidPermissionFormat', () => {
      it('should validate correct permission format', () => {
        expect(isValidPermissionFormat('workspace:read')).toBe(true);
        expect(isValidPermissionFormat('card:create')).toBe(true);
        expect(isValidPermissionFormat('admin:manage_users')).toBe(true);
      });

      it('should reject invalid permission formats', () => {
        expect(isValidPermissionFormat('')).toBe(false);
        expect(isValidPermissionFormat('invalid')).toBe(false);
        expect(isValidPermissionFormat('workspace:')).toBe(false);
        expect(isValidPermissionFormat(':read')).toBe(false);
        expect(isValidPermissionFormat('workspace:read:extra')).toBe(false);
        expect(isValidPermissionFormat('Workspace:Read')).toBe(false); // uppercase not allowed
        expect(isValidPermissionFormat('workspace read')).toBe(false); // spaces not allowed
        expect(isValidPermissionFormat(123 as any)).toBe(false); // non-string
      });
    });

    describe('isBackendIntegrationReady', () => {
      it('should always return true (backend integration complete)', () => {
        expect(isBackendIntegrationReady()).toBe(true);
      });
    });
  });

  describe('Integration with Permission Context', () => {
    it('should handle switching between workspaces correctly', () => {
      // Set context for workspace-1
      setPermissionContext({ 
        workspaceId: 'workspace-1',
        permissionsByWorkspace: mockWorkspacePermissions 
      });

      expect(checkUserPermission(mockUser, 'workspace:update')).toBe(true);

      // Switch to workspace-2 context
      setPermissionContext({ 
        workspaceId: 'workspace-2',
        permissionsByWorkspace: mockWorkspacePermissions 
      });

      expect(checkUserPermission(mockUser, 'workspace:update')).toBe(false);
      expect(checkUserPermission(mockUser, 'workspace:read')).toBe(true);
    });

    it('should handle fallback from workspace-specific to general permissions', () => {
      // When permissionsByWorkspace doesn't exist, should use general permissions
      setPermissionContext({ 
        workspaceId: 'workspace-3',
        permissions: mockPermissions, // general permissions available
        permissionsByWorkspace: undefined // no workspace-specific permissions
      });

      // Should fallback to general permissions
      expect(checkUserPermission(mockUser, 'workspace:read')).toBe(true);
    });

    it('should handle empty workspace permissions', () => {
      setPermissionContext({ 
        workspaceId: 'workspace-1',
        permissionsByWorkspace: {
          'workspace-1': [] // empty permissions
        }
      });

      expect(checkUserPermission(mockUser, 'workspace:read')).toBe(false);
    });
  });

  describe('Performance and Error Handling', () => {
    it('should not crash on malformed permission context', () => {
      setPermissionContext({ 
        permissions: 'invalid' as any // should be array
      });

      expect(() => checkUserPermission(mockUser, 'workspace:read')).not.toThrow();
      expect(checkUserPermission(mockUser, 'workspace:read')).toBe(false);
    });

    it('should handle undefined permission arrays gracefully', () => {
      setPermissionContext({ 
        workspaceId: 'workspace-1',
        permissionsByWorkspace: {
          'workspace-1': undefined as any
        }
      });

      expect(checkUserPermission(mockUser, 'workspace:read')).toBe(false);
    });

    it('should handle non-array permission values', () => {
      setPermissionContext({ 
        workspaceId: 'workspace-1',
        permissionsByWorkspace: {
          'workspace-1': 'not-an-array' as any
        }
      });

      expect(checkUserPermission(mockUser, 'workspace:read')).toBe(false);
    });
  });
});