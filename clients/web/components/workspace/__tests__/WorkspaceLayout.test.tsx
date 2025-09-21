/**
 * WorkspaceLayout Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { WorkspaceLayout } from '../WorkspaceLayout';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuth } from '@/hooks/use-auth';
import { useContextPermissions } from '@/hooks/use-permissions';

// Mock dependencies
jest.mock('@/stores/workspaceStore');
jest.mock('@/hooks/use-auth');
jest.mock('@/hooks/use-permissions');
jest.mock('@/lib/utils/permissions');

// Mock child components
jest.mock('../WorkspaceHeader', () => ({
  WorkspaceHeader: () => <div data-testid="workspace-header">Workspace Header</div>,
}));

jest.mock('../WorkspaceBreadcrumbs', () => ({
  WorkspaceBreadcrumbs: () => <div data-testid="workspace-breadcrumbs">Breadcrumbs</div>,
}));

const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseContextPermissions = useContextPermissions as jest.MockedFunction<typeof useContextPermissions>;

describe('WorkspaceLayout', () => {
  beforeEach(() => {
    // Mock auth
    mockUseAuth.mockReturnValue({
      user: { sub: 'auth0|123456', name: 'Test User', email: 'test@example.com' },
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

    // Mock permission hooks
    mockUseContextPermissions.mockReturnValue({
      permissionsByWorkspace: { 'workspace-1': ['workspace:read', 'canvas:create'] },
      loading: false,
      error: undefined,
      refetch: jest.fn().mockResolvedValue({}),
      getAllPermissions: jest.fn().mockReturnValue(['workspace:read', 'canvas:create']),
      checkPermissionInWorkspace: jest.fn().mockReturnValue(true),
    });

    // Mock simplified workspace store
    mockUseWorkspaceStore.mockReturnValue({
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
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the workspace layout structure correctly', () => {
    render(
      <WorkspaceLayout>
        <div data-testid="test-content">Test Content</div>
      </WorkspaceLayout>
    );

    // Check main layout structure
    expect(screen.getByRole('main')).toBeInTheDocument();
    
    // Check that header is rendered
    expect(screen.getByTestId('workspace-header')).toBeInTheDocument();
    
    // Check that breadcrumbs are rendered
    expect(screen.getByTestId('workspace-breadcrumbs')).toBeInTheDocument();
    
    // Check that children are rendered
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('has proper semantic structure', () => {
    render(
      <WorkspaceLayout>
        <div>Content</div>
      </WorkspaceLayout>
    );

    // Check for main element
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveClass('flex-1', 'flex', 'flex-col', 'overflow-hidden');
  });

  it('applies correct CSS classes for layout', () => {
    const { container } = render(
      <WorkspaceLayout>
        <div>Content</div>
      </WorkspaceLayout>
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('h-screen', 'bg-gray-900', 'flex', 'flex-col');
  });

  it('renders children in the main content area', () => {
    const TestChild = () => (
      <div data-testid="custom-child">Custom Child Component</div>
    );

    render(
      <WorkspaceLayout>
        <TestChild />
      </WorkspaceLayout>
    );

    const main = screen.getByRole('main');
    const child = screen.getByTestId('custom-child');
    
    expect(main).toContainElement(child);
  });

  it('handles multiple children correctly', () => {
    render(
      <WorkspaceLayout>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </WorkspaceLayout>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });
});