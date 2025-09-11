/**
 * use-permissions hook tests
 * 
 * Tests the new workspace-aware permission fetching hooks that integrate
 * with backend GraphQL queries for the permission system.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import React from 'react';
import {
  useWorkspacePermissions,
  usePermissionCheck,
  useContextPermissions,
  usePermissionCacheWarming,
  usePermissionCacheInvalidation,
  usePermissions,
} from '../use-permissions';
import { useAuth } from '../use-auth';
import {
  GET_USER_WORKSPACE_PERMISSIONS,
  CHECK_USER_PERMISSION,
  GET_USER_PERMISSIONS_FOR_CONTEXT,
} from '@/lib/graphql/userOperations';

// Mock useAuth hook
jest.mock('../use-auth');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('Permission Hooks', () => {
  const mockUser = {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockWorkspacePermissions = ['workspace:read', 'workspace:update', 'card:create'];
  const mockPermissionsByWorkspace = {
    'workspace-1': ['workspace:read', 'workspace:update', 'card:create'],
    'workspace-2': ['workspace:read', 'card:read'],
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
      checkPermission: jest.fn(),
      hasAnyPermission: jest.fn(),
      hasAllPermissions: jest.fn(),
      hasRole: jest.fn(),
      createPermissionChecker: jest.fn(),
      refreshUser: jest.fn(),
      announceAuthStatus: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('useWorkspacePermissions', () => {
    const successMock = {
      request: {
        query: GET_USER_WORKSPACE_PERMISSIONS,
        variables: {
          userId: mockUser.sub,
          workspaceId: 'workspace-1',
        },
      },
      result: {
        data: {
          getUserWorkspacePermissions: mockWorkspacePermissions,
        },
      },
    };

    const errorMock = {
      request: {
        query: GET_USER_WORKSPACE_PERMISSIONS,
        variables: {
          userId: mockUser.sub,
          workspaceId: 'workspace-1',
        },
      },
      error: new Error('Permission fetch failed'),
    };

    function TestWrapper({ children, mocks = [] }: { children: React.ReactNode; mocks?: any[] }) {
      return (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      );
    }

    it('should fetch workspace permissions successfully', async () => {
      const { result } = renderHook(() => useWorkspacePermissions('workspace-1'), {
        wrapper: (props) => <TestWrapper mocks={[successMock]} {...props} />,
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.permissions).toEqual([]);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.permissions).toEqual(mockWorkspacePermissions);
      expect(result.current.error).toBeUndefined();
      expect(result.current.checkPermission('workspace:read')).toBe(true);
      expect(result.current.checkPermission('workspace:delete')).toBe(false);
    });

    it('should handle errors with secure-by-default policy', async () => {
      const { result } = renderHook(
        () => useWorkspacePermissions('workspace-1', { errorPolicy: 'secure-by-default' }),
        { wrapper: (props) => <TestWrapper mocks={[errorMock]} {...props} /> }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.permissions).toEqual([]);
      expect(result.current.error).toBeDefined();
      expect(result.current.checkPermission('workspace:read')).toBe(false);
    });

    it('should skip query when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: jest.fn(),
        logout: jest.fn(),
        checkPermission: jest.fn(),
        hasAnyPermission: jest.fn(),
        hasAllPermissions: jest.fn(),
        hasRole: jest.fn(),
        createPermissionChecker: jest.fn(),
        refreshUser: jest.fn(),
        announceAuthStatus: jest.fn(),
      });

      const { result } = renderHook(() => useWorkspacePermissions('workspace-1'), {
        wrapper: (props) => <TestWrapper {...props} />,
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.permissions).toEqual([]);
    });

    it('should skip query when disabled', () => {
      const { result } = renderHook(
        () => useWorkspacePermissions('workspace-1', { enabled: false }),
        { wrapper: (props) => <TestWrapper {...props} /> }
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.permissions).toEqual([]);
    });

    it('should skip query when workspaceId is empty', () => {
      const { result } = renderHook(() => useWorkspacePermissions(''), {
        wrapper: (props) => <TestWrapper {...props} />,
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.permissions).toEqual([]);
    });

    it('should provide refetch functionality', async () => {
      const { result } = renderHook(() => useWorkspacePermissions('workspace-1'), {
        wrapper: (props) => <TestWrapper mocks={[successMock, successMock]} {...props} />,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
      await expect(result.current.refetch()).resolves.not.toThrow();
    });
  });

  describe('usePermissionCheck', () => {
    const successMock = {
      request: {
        query: CHECK_USER_PERMISSION,
        variables: {
          userId: mockUser.sub,
          workspaceId: 'workspace-1',
          permission: 'workspace:read',
        },
      },
      result: {
        data: {
          checkUserPermission: true,
        },
      },
    };

    const errorMock = {
      request: {
        query: CHECK_USER_PERMISSION,
        variables: {
          userId: mockUser.sub,
          workspaceId: 'workspace-1',
          permission: 'workspace:read',
        },
      },
      error: new Error('Permission check failed'),
    };

    function TestWrapper({ children, mocks = [] }: { children: React.ReactNode; mocks?: any[] }) {
      return (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      );
    }

    it('should check single permission successfully', async () => {
      const { result } = renderHook(
        () => usePermissionCheck('workspace-1', 'workspace:read'),
        { wrapper: (props) => <TestWrapper mocks={[successMock]} {...props} /> }
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.hasPermission).toBe(false);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasPermission).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it('should handle errors with secure-by-default policy', async () => {
      const { result } = renderHook(
        () => usePermissionCheck('workspace-1', 'workspace:read', { errorPolicy: 'secure-by-default' }),
        { wrapper: (props) => <TestWrapper mocks={[errorMock]} {...props} /> }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasPermission).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it('should skip query when parameters are missing', () => {
      const { result } = renderHook(
        () => usePermissionCheck('', 'workspace:read'),
        { wrapper: (props) => <TestWrapper {...props} /> }
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.hasPermission).toBe(false);
    });
  });

  describe('useContextPermissions', () => {
    const successMock = {
      request: {
        query: GET_USER_PERMISSIONS_FOR_CONTEXT,
        variables: {
          userId: mockUser.sub,
        },
      },
      result: {
        data: {
          getUserPermissionsForContext: mockPermissionsByWorkspace,
        },
      },
    };

    function TestWrapper({ children, mocks = [] }: { children: React.ReactNode; mocks?: any[] }) {
      return (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      );
    }

    it('should fetch context permissions successfully', async () => {
      const { result } = renderHook(() => useContextPermissions(), {
        wrapper: (props) => <TestWrapper mocks={[successMock]} {...props} />,
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.permissionsByWorkspace).toEqual({});

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.permissionsByWorkspace).toEqual(mockPermissionsByWorkspace);
      expect(result.current.checkPermissionInWorkspace('workspace-1', 'workspace:read')).toBe(true);
      expect(result.current.checkPermissionInWorkspace('workspace-1', 'workspace:delete')).toBe(false);
      expect(result.current.checkPermissionInWorkspace('workspace-2', 'workspace:update')).toBe(false);
    });

    it('should provide getAllPermissions functionality', async () => {
      const { result } = renderHook(() => useContextPermissions(), {
        wrapper: (props) => <TestWrapper mocks={[successMock]} {...props} />,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const allPermissions = result.current.getAllPermissions();
      expect(allPermissions).toContain('workspace:read');
      expect(allPermissions).toContain('workspace:update');
      expect(allPermissions).toContain('card:create');
      expect(allPermissions).toContain('card:read');
      // Should remove duplicates
      expect(allPermissions.filter(p => p === 'workspace:read')).toHaveLength(1);
    });

    it('should handle empty workspace parameters gracefully', async () => {
      const { result } = renderHook(() => useContextPermissions(), {
        wrapper: (props) => <TestWrapper mocks={[successMock]} {...props} />,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.checkPermissionInWorkspace('', 'workspace:read')).toBe(false);
      expect(result.current.checkPermissionInWorkspace('workspace-1', '')).toBe(false);
    });
  });

  describe('usePermissionCacheWarming', () => {
    function TestWrapper({ children }: { children: React.ReactNode }) {
      return (
        <MockedProvider mocks={[]} addTypename={false}>
          {children}
        </MockedProvider>
      );
    }

    it('should provide cache warming functions', () => {
      const { result } = renderHook(() => usePermissionCacheWarming(), {
        wrapper: TestWrapper,
      });

      expect(typeof result.current.warmWorkspacePermissions).toBe('function');
      expect(typeof result.current.warmContextPermissions).toBe('function');
    });

    it('should not attempt warming when user is not available', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: jest.fn(),
        logout: jest.fn(),
        checkPermission: jest.fn(),
        hasAnyPermission: jest.fn(),
        hasAllPermissions: jest.fn(),
        hasRole: jest.fn(),
        createPermissionChecker: jest.fn(),
        refreshUser: jest.fn(),
        announceAuthStatus: jest.fn(),
      });

      const { result } = renderHook(() => usePermissionCacheWarming(), {
        wrapper: TestWrapper,
      });

      await expect(result.current.warmWorkspacePermissions(['workspace-1'])).resolves.not.toThrow();
      await expect(result.current.warmContextPermissions()).resolves.not.toThrow();
    });
  });

  describe('usePermissionCacheInvalidation', () => {
    function TestWrapper({ children }: { children: React.ReactNode }) {
      return (
        <MockedProvider mocks={[]} addTypename={false}>
          {children}
        </MockedProvider>
      );
    }

    it('should provide cache invalidation functions', () => {
      const { result } = renderHook(() => usePermissionCacheInvalidation(), {
        wrapper: TestWrapper,
      });

      expect(typeof result.current.invalidateWorkspacePermissions).toBe('function');
      expect(typeof result.current.invalidateAllUserPermissions).toBe('function');
    });

    it('should execute invalidation functions without error', () => {
      const { result } = renderHook(() => usePermissionCacheInvalidation(), {
        wrapper: TestWrapper,
      });

      expect(() => {
        result.current.invalidateWorkspacePermissions(mockUser.sub, 'workspace-1');
        result.current.invalidateAllUserPermissions(mockUser.sub);
      }).not.toThrow();
    });
  });

  describe('usePermissions (combined hook)', () => {
    const workspacePermissionsMock = {
      request: {
        query: GET_USER_WORKSPACE_PERMISSIONS,
        variables: {
          userId: mockUser.sub,
          workspaceId: 'workspace-1',
        },
      },
      result: {
        data: {
          getUserWorkspacePermissions: mockWorkspacePermissions,
        },
      },
    };

    const contextPermissionsMock = {
      request: {
        query: GET_USER_PERMISSIONS_FOR_CONTEXT,
        variables: {
          userId: mockUser.sub,
        },
      },
      result: {
        data: {
          getUserPermissionsForContext: mockPermissionsByWorkspace,
        },
      },
    };

    function TestWrapper({ children, mocks = [] }: { children: React.ReactNode; mocks?: any[] }) {
      return (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      );
    }

    it('should provide all permission functionality', async () => {
      const { result } = renderHook(() => usePermissions('workspace-1'), {
        wrapper: (props) => <TestWrapper mocks={[workspacePermissionsMock, contextPermissionsMock]} {...props} />,
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have workspace permissions functionality
      expect(result.current.permissions).toEqual(mockWorkspacePermissions);
      expect(result.current.checkPermission('workspace:read')).toBe(true);

      // Should have context permissions functionality
      expect(result.current.contextPermissions).toBeDefined();
      expect(result.current.contextPermissions.loading).toBe(false);

      // Should have cache functionality
      expect(result.current.cacheWarming).toBeDefined();
      expect(result.current.cacheInvalidation).toBeDefined();
    });

    it('should disable workspace permissions when workspaceId is not provided', () => {
      const { result } = renderHook(() => usePermissions(), {
        wrapper: (props) => <TestWrapper mocks={[contextPermissionsMock]} {...props} />,
      });

      // Workspace permissions should be disabled
      expect(result.current.permissions).toEqual([]);
      expect(result.current.loading).toBe(false);

      // Context permissions should still work
      expect(result.current.contextPermissions).toBeDefined();
    });

    it('should respect enabled option', () => {
      const { result } = renderHook(() => usePermissions('workspace-1', { enabled: false }), {
        wrapper: (props) => <TestWrapper {...props} />,
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.permissions).toEqual([]);
      expect(result.current.contextPermissions.loading).toBe(false);
    });
  });

  describe('Performance and Error Handling', () => {
    function TestWrapper({ children, mocks = [] }: { children: React.ReactNode; mocks?: any[] }) {
      return (
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      );
    }

    it('should handle network errors gracefully', async () => {
      const networkErrorMock = {
        request: {
          query: GET_USER_WORKSPACE_PERMISSIONS,
          variables: {
            userId: mockUser.sub,
            workspaceId: 'workspace-1',
          },
        },
        error: new Error('Network error'),
      };

      const { result } = renderHook(() => useWorkspacePermissions('workspace-1'), {
        wrapper: (props) => <TestWrapper mocks={[networkErrorMock]} {...props} />,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.permissions).toEqual([]);
    });

    it('should handle malformed response data', async () => {
      const malformedMock = {
        request: {
          query: GET_USER_WORKSPACE_PERMISSIONS,
          variables: {
            userId: mockUser.sub,
            workspaceId: 'workspace-1',
          },
        },
        result: {
          data: {
            getUserWorkspacePermissions: null, // Malformed response
          },
        },
      };

      const { result } = renderHook(() => useWorkspacePermissions('workspace-1'), {
        wrapper: (props) => <TestWrapper mocks={[malformedMock]} {...props} />,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.permissions).toEqual([]);
      expect(result.current.checkPermission('workspace:read')).toBe(false);
    });
  });
});