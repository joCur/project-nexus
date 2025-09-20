/**
 * Workspace Components Integration Tests
 *
 * Tests the core functionality and integration between workspace components
 * without getting caught up in detailed CSS class assertions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { WorkspaceLayout } from '../WorkspaceLayout';
import { WorkspaceHeader } from '../WorkspaceHeader';
import { WorkspaceBreadcrumbs } from '../WorkspaceBreadcrumbs';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuth } from '@/hooks/use-auth';
import { useContextPermissions } from '@/hooks/use-permissions';
import { useCanvas, useCanvases } from '@/hooks/use-canvas';
import { GET_WORKSPACE_CANVASES } from '@/lib/graphql/canvasOperations';
import { createCanvasId } from '@/types/workspace.types';

// Mock dependencies
jest.mock('@/stores/workspaceStore');
jest.mock('@/hooks/use-auth');
jest.mock('@/hooks/use-permissions');
jest.mock('@/lib/utils/permissions');
jest.mock('@/hooks/use-canvas');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Mock child components for integration testing
jest.mock('../CanvasSwitcher', () => ({
  CanvasSwitcher: () => <div data-testid="canvas-switcher">Canvas Switcher</div>,
}));

jest.mock('../CreateCanvasModal', () => ({
  CreateCanvasModal: ({ isOpen }: any) => 
    isOpen ? <div data-testid="create-modal">Create Modal</div> : null,
}));

const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseContextPermissions = useContextPermissions as jest.MockedFunction<typeof useContextPermissions>;
const mockUseCanvas = useCanvas as jest.MockedFunction<typeof useCanvas>;
const mockUseCanvases = useCanvases as jest.MockedFunction<typeof useCanvases>;

describe('Workspace Components Integration', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { 
        name: 'Test User', 
        email: 'test@example.com',
        sub: 'auth0|123',
      },
      login: jest.fn(),
      logout: jest.fn(),
      checkPermission: jest.fn().mockReturnValue(true),
      hasAnyPermission: jest.fn().mockReturnValue(true),
      hasAllPermissions: jest.fn().mockReturnValue(true),
      hasRole: jest.fn().mockReturnValue(true),
      createPermissionChecker: jest.fn().mockReturnValue({
        hasPermission: jest.fn().mockReturnValue(true),
        hasAnyPermission: jest.fn().mockReturnValue(true),
        hasAllPermissions: jest.fn().mockReturnValue(true),
      }),
      refreshUser: jest.fn(),
      announceAuthStatus: jest.fn(),
      isLoading: false,
      isAuthenticated: true,
    });

    mockUseContextPermissions.mockReturnValue({
      permissionsByWorkspace: { 'workspace-1': ['workspace:read', 'canvas:create'] },
      loading: false,
      error: undefined,
      refetch: jest.fn().mockResolvedValue({}),
      getAllPermissions: jest.fn().mockReturnValue(['workspace:read', 'canvas:create']),
      checkPermissionInWorkspace: jest.fn().mockReturnValue(true),
    });

    // Mock canvas hooks
    const testCanvas = {
      id: createCanvasId('canvas-1'),
      workspaceId: 'workspace-1',
      name: 'Test Canvas',
      description: 'Test Canvas Description',
      settings: {
        isDefault: true,
        position: { x: 0, y: 0, z: 0 },
        zoom: 1.0,
        grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
        background: { type: 'COLOR' as const, color: '#ffffff', opacity: 1.0 },
      },
      status: 'active' as const,
      priority: 'normal' as const,
      tags: [],
      metadata: {},
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      version: 1,
    };

    mockUseCanvas.mockReturnValue({
      canvas: testCanvas,
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    });

    mockUseCanvases.mockReturnValue({
      canvases: [testCanvas],
      loading: false,
      error: undefined,
      refetch: jest.fn(),
      hasMore: false,
      loadMore: jest.fn(),
    });

    // Mock simplified workspace store
    mockUseWorkspaceStore.mockImplementation((selector?: any) => {
      const mockStore = {
        context: {
          currentWorkspaceId: 'workspace-1',
          currentCanvasId: 'canvas-1',
          workspaceName: 'Test Workspace',
          canvasName: 'Test Canvas',
        },
        uiState: {
          loadingStates: {
            fetchingCanvases: false,
            creatingCanvas: false,
            updatingCanvas: false,
            deletingCanvas: false,
            settingDefault: false,
            duplicatingCanvas: false,
          },
          errors: {
            fetchError: undefined,
            mutationError: undefined,
          },
        },
        isInitialized: true,
        setCurrentWorkspace: jest.fn(),
        setCurrentCanvas: jest.fn(),
        switchCanvas: jest.fn(),
        clearContext: jest.fn(),
        setCanvasLoading: jest.fn(),
        setError: jest.fn(),
        clearErrors: jest.fn(),
      };

      return selector ? selector(mockStore) : mockStore;
    });
  });

  // Helper function to render with Apollo provider
  const renderWithApollo = (component: React.ReactElement, mocks: any[] = []) => {
    const defaultMocks = [
      {
        request: {
          query: GET_WORKSPACE_CANVASES,
          variables: { workspaceId: 'workspace-1' },
        },
        result: {
          data: {
            workspaceCanvases: {
              items: [],
              hasNextPage: false,
              page: 0,
              limit: 100,
              totalCount: 0,
            },
          },
        },
      },
    ];
    return render(
      <MockedProvider mocks={[...defaultMocks, ...mocks]} addTypename={false}>
        {component}
      </MockedProvider>
    );
  };

  describe('WorkspaceLayout Integration', () => {
    it('renders complete workspace layout with header and breadcrumbs', () => {
      renderWithApollo(
        <WorkspaceLayout>
          <div data-testid="canvas-content">Canvas Content</div>
        </WorkspaceLayout>
      );

      // Check main structure elements are present
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByTestId('canvas-content')).toBeInTheDocument();
    });
  });

  describe('WorkspaceHeader Integration', () => {
    it('displays project branding and user information', () => {
      renderWithApollo(<WorkspaceHeader />);

      expect(screen.getByText('Project Nexus')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Logout/ })).toBeInTheDocument();
    });

    it('shows canvas switcher when workspace context exists', () => {
      renderWithApollo(<WorkspaceHeader />);
      expect(screen.getByTestId('canvas-switcher')).toBeInTheDocument();
    });

    it('calls logout when logout button is clicked', () => {
      const mockLogout = jest.fn();
      mockUseAuth.mockReturnValue({
        user: { 
          name: 'Test User', 
          email: 'test@example.com',
          sub: 'auth0|123',
        },
        login: jest.fn(),
        logout: mockLogout,
        checkPermission: jest.fn().mockReturnValue(true),
        hasAnyPermission: jest.fn().mockReturnValue(true),
        hasAllPermissions: jest.fn().mockReturnValue(true),
        hasRole: jest.fn().mockReturnValue(true),
        createPermissionChecker: jest.fn().mockReturnValue({
          hasPermission: jest.fn().mockReturnValue(true),
          hasAnyPermission: jest.fn().mockReturnValue(true),
          hasAllPermissions: jest.fn().mockReturnValue(true),
        }),
        refreshUser: jest.fn(),
        announceAuthStatus: jest.fn(),
        isLoading: false,
        isAuthenticated: true,
      });

      renderWithApollo(<WorkspaceHeader />);

      fireEvent.click(screen.getByRole('button', { name: /Logout/ }));
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('WorkspaceBreadcrumbs Integration', () => {
    it('renders breadcrumb navigation with proper hierarchy', () => {
      renderWithApollo(<WorkspaceBreadcrumbs />);

      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(nav).toBeInTheDocument();

      // Check breadcrumb items
      expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Test Workspace/ })).toBeInTheDocument();
      expect(screen.getByText('Test Canvas')).toBeInTheDocument();
    });

    it('handles workspace-only context correctly', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: 'workspace-1',
            currentCanvasId: undefined,
            workspaceName: 'Test Workspace',
            canvasName: undefined,
          },
          uiState: {
            loadingStates: {
              fetchingCanvases: false,
              creatingCanvas: false,
              updatingCanvas: false,
              deletingCanvas: false,
              settingDefault: false,
              duplicatingCanvas: false,
            },
            errors: {
              fetchError: undefined,
              mutationError: undefined,
            },
          },
          isInitialized: true,
          setCurrentWorkspace: jest.fn(),
          setCurrentCanvas: jest.fn(),
          switchCanvas: jest.fn(),
          clearContext: jest.fn(),
          setCanvasLoading: jest.fn(),
          setError: jest.fn(),
          clearErrors: jest.fn(),
        };

        return selector ? selector(mockStore) : mockStore;
      });

      // Mock useCanvas for workspace-only context (no canvas)
      mockUseCanvas.mockReturnValue({
        canvas: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      mockUseCanvases.mockReturnValue({
        canvases: [],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        hasMore: false,
        loadMore: jest.fn(),
      });

      renderWithApollo(<WorkspaceBreadcrumbs />);

      expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
      expect(screen.queryByText('Test Canvas')).not.toBeInTheDocument();
    });
  });

  describe('Error Boundaries', () => {
    it('gracefully handles missing workspace context', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        const mockStore = {
          context: {
            currentWorkspaceId: undefined,
            currentCanvasId: undefined,
            workspaceName: undefined,
            canvasName: undefined,
          },
          uiState: {
            loadingStates: {
              fetchingCanvases: false,
              creatingCanvas: false,
              updatingCanvas: false,
              deletingCanvas: false,
              settingDefault: false,
              duplicatingCanvas: false,
            },
            errors: {
              fetchError: undefined,
              mutationError: undefined,
            },
          },
          isInitialized: false,
          setCurrentWorkspace: jest.fn(),
          setCurrentCanvas: jest.fn(),
          switchCanvas: jest.fn(),
          clearContext: jest.fn(),
          setCanvasLoading: jest.fn(),
          setError: jest.fn(),
          clearErrors: jest.fn(),
        };

        return selector ? selector(mockStore) : mockStore;
      });

      // Mock useCanvas for missing workspace context
      mockUseCanvas.mockReturnValue({
        canvas: undefined,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      mockUseCanvases.mockReturnValue({
        canvases: [],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
        hasMore: false,
        loadMore: jest.fn(),
      });

      // WorkspaceBreadcrumbs should not render without workspace context
      const { container: breadcrumbContainer } = renderWithApollo(<WorkspaceBreadcrumbs />);
      expect(breadcrumbContainer.firstChild).toBeNull();

      // WorkspaceHeader should render but without canvas switcher
      renderWithApollo(<WorkspaceHeader />);
      expect(screen.getByText('Project Nexus')).toBeInTheDocument();
      expect(screen.queryByTestId('canvas-switcher')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('maintains proper semantic structure across components', () => {
      renderWithApollo(
        <WorkspaceLayout>
          <div>Test Content</div>
        </WorkspaceLayout>
      );

      // Check semantic structure
      expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
      expect(screen.getByRole('navigation')).toBeInTheDocument(); // Breadcrumbs
      expect(screen.getByRole('main')).toBeInTheDocument(); // Main content
    });

    it('provides proper navigation labels and descriptions', () => {
      renderWithApollo(<WorkspaceBreadcrumbs />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('aria-label');
      });
    });
  });
});