/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { UserProvider, UserProfile } from '@auth0/nextjs-auth0/client';
import { 
  WorkspacePermissionProvider, 
  useWorkspacePermissionContext,
  useWorkspacePermissions 
} from '../WorkspacePermissionContext';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { GET_USER_PERMISSIONS_FOR_CONTEXT } from '@/lib/graphql/userOperations';
import { ExtendedUserProfile } from '@/types/auth';

// Mock the useAuth hook
const mockUser: ExtendedUserProfile = {
  sub: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  roles: ['user'],
};

// Auth0 compatible user for UserProvider
const mockAuth0User: UserProfile = {
  sub: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
} as UserProfile;

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
    error: null,
    checkPermission: jest.fn((permission: string) => permission === 'workspace:read'),
    hasAnyPermission: jest.fn(),
    hasAllPermissions: jest.fn(),
    hasRole: jest.fn(),
  }),
}));

// Mock the workspace store
jest.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: jest.fn(),
}));

const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>;

// Test component that uses the context
const TestContextConsumer = () => {
  const context = useWorkspacePermissionContext();
  const permissions = useWorkspacePermissions();
  
  return (
    <div>
      <div data-testid="workspace-id">{context.currentWorkspaceId || 'none'}</div>
      <div data-testid="permissions">{context.permissions.join(',')}</div>
      <div data-testid="loading">{String(context.loading)}</div>
      <div data-testid="has-read-permission">{String(permissions.hasPermission('workspace:read'))}</div>
    </div>
  );
};

// GraphQL mocks
const mocks = [
  {
    request: {
      query: GET_USER_PERMISSIONS_FOR_CONTEXT,
      variables: {},
    },
    result: {
      data: {
        getUserPermissionsForContext: {
          'workspace-1': ['workspace:read', 'workspace:update'],
          'workspace-2': ['workspace:read'],
        },
      },
    },
  },
];

describe('WorkspacePermissionContext', () => {
  beforeEach(() => {
    // Mock simplified workspace store state
    mockUseWorkspaceStore.mockReturnValue({
      context: {
        currentWorkspaceId: 'workspace-1',
        workspaceName: 'Test Workspace',
        currentCanvasId: undefined,
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
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should provide workspace permission context', async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <UserProvider user={mockAuth0User}>
          <WorkspacePermissionProvider>
            <TestContextConsumer />
          </WorkspacePermissionProvider>
        </UserProvider>
      </MockedProvider>
    );

    // Check initial state
    expect(screen.getByTestId('workspace-id')).toHaveTextContent('workspace-1');
    expect(screen.getByTestId('loading')).toHaveTextContent('true'); // Initially loading

    // Wait for data to load and check permissions
    await screen.findByTestId('loading');
    
    // Check that the provider is working
    expect(screen.getByTestId('workspace-id')).toHaveTextContent('workspace-1');
    expect(screen.getByTestId('has-read-permission')).toHaveTextContent('true');
  });

  it('should handle context outside provider', () => {
    // This should throw an error
    const TestComponentOutsideProvider = () => {
      try {
        useWorkspacePermissionContext();
        return <div>No error</div>;
      } catch (error) {
        return <div data-testid="error">Context error</div>;
      }
    };

    render(<TestComponentOutsideProvider />);
    
    expect(screen.getByTestId('error')).toBeInTheDocument();
  });

  it('should handle workspace changes', () => {
    let currentWorkspaceId = 'workspace-1';

    // Mock simplified workspace store that can change
    mockUseWorkspaceStore.mockImplementation(() => ({
      context: {
        currentWorkspaceId,
        workspaceName: 'Test Workspace',
        currentCanvasId: undefined,
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
      setCurrentWorkspace: jest.fn((newId) => {
        currentWorkspaceId = newId;
      }),
      setCurrentCanvas: jest.fn(),
      switchCanvas: jest.fn(),
      clearContext: jest.fn(),
      setCanvasLoading: jest.fn(),
      setError: jest.fn(),
      clearErrors: jest.fn(),
    }));

    const { rerender } = render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <UserProvider user={mockAuth0User}>
          <WorkspacePermissionProvider>
            <TestContextConsumer />
          </WorkspacePermissionProvider>
        </UserProvider>
      </MockedProvider>
    );

    expect(screen.getByTestId('workspace-id')).toHaveTextContent('workspace-1');

    // Change workspace
    currentWorkspaceId = 'workspace-2';

    rerender(
      <MockedProvider mocks={mocks} addTypename={false}>
        <UserProvider user={mockAuth0User}>
          <WorkspacePermissionProvider>
            <TestContextConsumer />
          </WorkspacePermissionProvider>
        </UserProvider>
      </MockedProvider>
    );

    expect(screen.getByTestId('workspace-id')).toHaveTextContent('workspace-2');
  });
});

describe('useWorkspacePermissions hook', () => {
  beforeEach(() => {
    // Mock simplified workspace store
    mockUseWorkspaceStore.mockReturnValue({
      context: {
        currentWorkspaceId: 'workspace-1',
        workspaceName: 'Test Workspace',
        currentCanvasId: undefined,
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
    });
  });

  it('should provide workspace permission checking utilities', async () => {
    const TestPermissionHook = () => {
      const permissions = useWorkspacePermissions();
      
      return (
        <div>
          <div data-testid="workspace-id">{permissions.workspaceId || 'none'}</div>
          <div data-testid="is-authenticated">{String(permissions.isAuthenticated)}</div>
          <div data-testid="has-read">{String(permissions.hasPermission('workspace:read'))}</div>
          <div data-testid="user-name">{permissions.user?.name || 'no-user'}</div>
        </div>
      );
    };

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <UserProvider user={mockAuth0User}>
          <WorkspacePermissionProvider>
            <TestPermissionHook />
          </WorkspacePermissionProvider>
        </UserProvider>
      </MockedProvider>
    );

    expect(screen.getByTestId('workspace-id')).toHaveTextContent('workspace-1');
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('has-read')).toHaveTextContent('true');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
  });
});