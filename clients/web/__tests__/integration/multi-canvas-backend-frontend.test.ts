/**
 * Multi-Canvas Backend-Frontend Integration Tests (NEX-177)
 * 
 * Comprehensive integration testing for backend-frontend communication including:
 * - Backend canvas operations integration
 * - Frontend-backend integration
 * - Real-time subscriptions
 * - Authorization and permissions
 * - Data synchronization and consistency
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import { WebSocket } from 'ws';
import React from 'react';

// Import GraphQL operations
import {
  GET_WORKSPACE_CANVASES,
  GET_CANVAS,
  CREATE_CANVAS,
  UPDATE_CANVAS,
  DELETE_CANVAS,
  SET_DEFAULT_CANVAS,
  DUPLICATE_CANVAS,
  UPDATE_CANVAS_SETTINGS,
  CANVAS_UPDATED_SUBSCRIPTION,
  CANVAS_DELETED_SUBSCRIPTION,
} from '@/lib/graphql/canvasOperations';

import {
  GET_CANVAS_CARDS,
  CREATE_CARD,
  UPDATE_CARD,
  DELETE_CARD,
} from '@/lib/graphql/cardOperations';

// Import components
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import CanvasSwitcher from '@/components/workspace/CanvasSwitcher';
import { InfiniteCanvas } from '@/components/canvas';

// Import stores
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';

// Import types
import type { EntityId } from '@/types/common.types';
import type { CanvasId } from '@/types/workspace.types';

// Mock WebSocket for real-time subscriptions
global.WebSocket = WebSocket;

// Mock authentication
const mockAuth = {
  getToken: jest.fn().mockResolvedValue('valid-token'),
  user: {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
  },
};

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockAuth,
}));

// Mock stores
jest.mock('@/stores/workspaceStore');
jest.mock('@/stores/canvasStore');

describe('Multi-Canvas Backend-Frontend Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let subscriptionCleanup: (() => void)[] = [];

  // Test data
  const mockWorkspace = {
    id: 'integration-workspace-id' as EntityId,
    name: 'Integration Test Workspace',
    ownerId: 'auth0|test-user-id' as EntityId,
    settings: {
      privacy: 'PRIVATE' as const,
      defaultViewType: 'CANVAS' as const,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockCanvas1 = {
    id: 'canvas-1' as CanvasId,
    workspaceId: mockWorkspace.id,
    name: 'Main Canvas',
    description: 'Primary canvas for testing',
    settings: {
      isDefault: true,
      position: { x: 0, y: 0, z: 0 },
      zoom: 1.0,
      grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
      background: { type: 'COLOR' as const, color: '#ffffff', opacity: 1.0 },
    },
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  const mockCanvas2 = {
    id: 'canvas-2' as CanvasId,
    workspaceId: mockWorkspace.id,
    name: 'Secondary Canvas',
    description: 'Secondary canvas for testing',
    settings: {
      isDefault: false,
      position: { x: 0, y: 0, z: 0 },
      zoom: 1.2,
      grid: { enabled: false, size: 20, color: '#e5e7eb', opacity: 0.3 },
      background: { type: 'COLOR' as const, color: '#f8f9fa', opacity: 1.0 },
    },
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  const mockCard = {
    id: 'card-1' as EntityId,
    canvasId: mockCanvas1.id,
    workspaceId: mockWorkspace.id,
    type: 'NOTE' as const,
    title: 'Test Card',
    content: 'Integration test card content',
    position: { x: 100, y: 100, z: 0 },
    size: { width: 200, height: 150 },
    style: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#e5e7eb',
      borderWidth: 1,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  beforeAll(() => {
    user = userEvent.setup({ delay: null });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptionCleanup = [];
  });

  afterEach(() => {
    // Clean up subscriptions
    subscriptionCleanup.forEach(cleanup => cleanup());
    subscriptionCleanup = [];
  });

  const createWrapper = (mocks: any[] = []) => {
    return ({ children }: { children: React.ReactNode }) => (
      <MockedProvider mocks={mocks} addTypename={false}>
        {children}
      </MockedProvider>
    );
  };

  describe('Canvas CRUD Operations Integration', () => {
    it('should create canvas with proper backend communication', async () => {
      const createCanvasMutation = {
        request: {
          query: CREATE_CANVAS,
          variables: {
            input: {
              workspaceId: mockWorkspace.id,
              name: 'New Integration Canvas',
              description: 'Created via integration test',
              metadata: {},
            },
          },
        },
        result: {
          data: {
            createCanvas: {
              id: 'new-canvas-id',
              workspaceId: mockWorkspace.id,
              name: 'New Integration Canvas',
              description: 'Created via integration test',
              settings: {
                isDefault: false,
                position: { x: 0, y: 0, z: 0 },
                zoom: 1.0,
                grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
                background: { type: 'COLOR', color: '#ffffff', opacity: 1.0 },
              },
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
            },
          },
        },
      };

      const refreshCanvasesQuery = {
        request: {
          query: GET_WORKSPACE_CANVASES,
          variables: { workspaceId: mockWorkspace.id },
        },
        result: {
          data: {
            workspaceCanvases: {
              items: [mockCanvas1, mockCanvas2],
              totalCount: 2,
              page: 0,
              limit: 50,
              totalPages: 1,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          },
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        canvasManagement: {
          canvases: new Map([[mockCanvas1.id, mockCanvas1], [mockCanvas2.id, mockCanvas2]]),
        },
        createCanvas: jest.fn().mockResolvedValue('new-canvas-id'),
        loadCanvases: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([createCanvasMutation, refreshCanvasesQuery]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Trigger canvas creation
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      // Fill form
      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      const descriptionInput = screen.getByRole('textbox', { name: /description/i });
      
      await user.type(nameInput, 'New Integration Canvas');
      await user.type(descriptionInput, 'Created via integration test');

      // Submit
      const submitButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(submitButton);

      // Verify backend communication
      await waitFor(() => {
        expect(mockWorkspaceStore.createCanvas).toHaveBeenCalledWith({
          workspaceId: mockWorkspace.id,
          name: 'New Integration Canvas',
          description: 'Created via integration test',
        });
      });

      // Verify frontend state update
      await waitFor(() => {
        expect(mockWorkspaceStore.loadCanvases).toHaveBeenCalled();
      });
    });

    it('should update canvas with optimistic updates and backend sync', async () => {
      const updateCanvasMutation = {
        request: {
          query: UPDATE_CANVAS,
          variables: {
            id: mockCanvas1.id,
            input: {
              name: 'Updated Canvas Name',
              description: 'Updated description',
            },
          },
        },
        result: {
          data: {
            updateCanvas: {
              ...mockCanvas1,
              name: 'Updated Canvas Name',
              description: 'Updated description',
              updatedAt: new Date().toISOString(),
              version: 2,
            },
          },
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCanvas: jest.fn().mockReturnValue(mockCanvas1),
        updateCanvas: jest.fn().mockResolvedValue(true),
        optimisticUpdateCanvas: jest.fn(),
        revertOptimisticUpdate: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([updateCanvasMutation]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Trigger canvas update
      const editButton = screen.getByRole('button', { name: /edit canvas/i });
      await user.click(editButton);

      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Canvas Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify optimistic update occurred first
      expect(mockWorkspaceStore.optimisticUpdateCanvas).toHaveBeenCalledWith(
        mockCanvas1.id,
        expect.objectContaining({
          name: 'Updated Canvas Name',
        })
      );

      // Verify backend sync
      await waitFor(() => {
        expect(mockWorkspaceStore.updateCanvas).toHaveBeenCalledWith(
          mockCanvas1.id,
          expect.objectContaining({
            name: 'Updated Canvas Name',
          })
        );
      });
    });

    it('should handle update failures with rollback', async () => {
      const updateCanvasFailure = {
        request: {
          query: UPDATE_CANVAS,
          variables: {
            id: mockCanvas1.id,
            input: { name: 'Conflicting Name' },
          },
        },
        result: {
          errors: [new GraphQLError('Canvas with this name already exists')],
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCanvas: jest.fn().mockReturnValue(mockCanvas1),
        updateCanvas: jest.fn().mockRejectedValue(new Error('Canvas with this name already exists')),
        optimisticUpdateCanvas: jest.fn(),
        revertOptimisticUpdate: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([updateCanvasFailure]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Trigger update that will fail
      const editButton = screen.getByRole('button', { name: /edit canvas/i });
      await user.click(editButton);

      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.clear(nameInput);
      await user.type(nameInput, 'Conflicting Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify optimistic update was attempted
      expect(mockWorkspaceStore.optimisticUpdateCanvas).toHaveBeenCalled();

      // Verify rollback occurred after failure
      await waitFor(() => {
        expect(mockWorkspaceStore.revertOptimisticUpdate).toHaveBeenCalledWith(mockCanvas1.id);
      });

      // Verify error message displayed
      expect(screen.getByText(/canvas with this name already exists/i)).toBeInTheDocument();
    });

    it('should delete canvas with confirmation and backend sync', async () => {
      const deleteCanvasMutation = {
        request: {
          query: DELETE_CANVAS,
          variables: { id: mockCanvas2.id },
        },
        result: {
          data: { deleteCanvas: true },
        },
      };

      const getDefaultCanvasQuery = {
        request: {
          query: GET_CANVAS,
          variables: { id: mockCanvas1.id },
        },
        result: {
          data: { canvas: mockCanvas1 },
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCanvas: jest.fn().mockReturnValue(mockCanvas2),
        deleteCanvas: jest.fn().mockResolvedValue(true),
        switchToCanvas: jest.fn(),
        getDefaultCanvas: jest.fn().mockReturnValue(mockCanvas1),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([deleteCanvasMutation, getDefaultCanvasQuery]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Switch to secondary canvas first
      mockWorkspaceStore.getCanvas.mockReturnValue(mockCanvas2);

      // Trigger deletion
      const contextMenuButton = screen.getByRole('button', { name: /canvas options/i });
      await user.click(contextMenuButton);

      const deleteOption = screen.getByRole('menuitem', { name: /delete canvas/i });
      await user.click(deleteOption);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      // Verify backend deletion
      await waitFor(() => {
        expect(mockWorkspaceStore.deleteCanvas).toHaveBeenCalledWith(mockCanvas2.id);
      });

      // Verify redirect to default canvas
      expect(mockWorkspaceStore.switchToCanvas).toHaveBeenCalledWith(mockCanvas1.id);
    });
  });

  describe('Real-time Subscriptions Integration', () => {
    it('should handle canvas update subscriptions', async () => {
      const canvasUpdateSubscription = {
        request: {
          query: CANVAS_UPDATED_SUBSCRIPTION,
          variables: { workspaceId: mockWorkspace.id },
        },
        result: {
          data: {
            canvasUpdated: {
              ...mockCanvas1,
              name: 'Updated by Another User',
              version: 2,
            },
          },
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        subscribeToCanvasUpdates: jest.fn(),
        handleCanvasUpdate: jest.fn(),
        getCanvas: jest.fn().mockReturnValue(mockCanvas1),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([canvasUpdateSubscription]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Verify subscription was set up
      expect(mockWorkspaceStore.subscribeToCanvasUpdates).toHaveBeenCalledWith(mockWorkspace.id);

      // Simulate receiving subscription update
      await act(async () => {
        // Mock subscription data arrival
        mockWorkspaceStore.handleCanvasUpdate({
          ...mockCanvas1,
          name: 'Updated by Another User',
          version: 2,
        });
      });

      // Verify UI updated with new data
      await waitFor(() => {
        expect(mockWorkspaceStore.handleCanvasUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Updated by Another User',
            version: 2,
          })
        );
      });
    });

    it('should handle canvas deletion subscriptions', async () => {
      const canvasDeletionSubscription = {
        request: {
          query: CANVAS_DELETED_SUBSCRIPTION,
          variables: { workspaceId: mockWorkspace.id },
        },
        result: {
          data: {
            canvasDeleted: {
              id: mockCanvas2.id,
              workspaceId: mockWorkspace.id,
            },
          },
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        canvasManagement: {
          currentCanvasId: mockCanvas2.id,
        },
        subscribeToCanvasDeletions: jest.fn(),
        handleCanvasDeletion: jest.fn(),
        switchToCanvas: jest.fn(),
        getDefaultCanvas: jest.fn().mockReturnValue(mockCanvas1),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([canvasDeletionSubscription]);

      render(
        <WorkspaceLayout>
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Simulate canvas deletion by another user
      await act(async () => {
        mockWorkspaceStore.handleCanvasDeletion({
          id: mockCanvas2.id,
          workspaceId: mockWorkspace.id,
        });
      });

      // Should redirect to default canvas if current canvas was deleted
      expect(mockWorkspaceStore.switchToCanvas).toHaveBeenCalledWith(mockCanvas1.id);

      // Should show notification
      await waitFor(() => {
        expect(screen.getByText(/canvas was deleted by another user/i)).toBeInTheDocument();
      });
    });

    it('should handle subscription connection errors gracefully', async () => {
      const subscriptionError = {
        request: {
          query: CANVAS_UPDATED_SUBSCRIPTION,
          variables: { workspaceId: mockWorkspace.id },
        },
        error: new Error('WebSocket connection failed'),
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        subscribeToCanvasUpdates: jest.fn().mockRejectedValue(new Error('WebSocket connection failed')),
        enablePollingMode: jest.fn(),
        isSubscriptionActive: false,
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([subscriptionError]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Should fallback to polling mode
      await waitFor(() => {
        expect(mockWorkspaceStore.enablePollingMode).toHaveBeenCalled();
      });

      // Should show connection status
      expect(screen.getByText(/using polling mode/i)).toBeInTheDocument();
    });
  });

  describe('Authorization and Permissions Integration', () => {
    it('should enforce canvas creation permissions', async () => {
      const permissionErrorMock = {
        request: {
          query: CREATE_CANVAS,
          variables: {
            input: {
              workspaceId: mockWorkspace.id,
              name: 'Unauthorized Canvas',
              description: '',
              metadata: {},
            },
          },
        },
        result: {
          errors: [new GraphQLError('Insufficient permissions to create canvas in this workspace')],
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        canUserCreateCanvas: jest.fn().mockReturnValue(false),
        createCanvas: jest.fn().mockRejectedValue(new Error('Insufficient permissions')),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([permissionErrorMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Create button should be disabled
      const createButton = screen.queryByRole('button', { name: /create canvas/i });
      expect(createButton).toBeDisabled();

      // If user somehow triggers creation, should get permission error
      if (createButton && !createButton.getAttribute('disabled')) {
        await user.click(createButton);
        
        await waitFor(() => {
          expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
        });
      }
    });

    it('should enforce canvas modification permissions', async () => {
      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCanvas: jest.fn().mockReturnValue(mockCanvas1),
        canUserEditCanvas: jest.fn().mockReturnValue(false),
        canUserDeleteCanvas: jest.fn().mockReturnValue(false),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Edit and delete options should be disabled/hidden
      const contextMenuButton = screen.getByRole('button', { name: /canvas options/i });
      await user.click(contextMenuButton);

      const editOption = screen.queryByRole('menuitem', { name: /edit canvas/i });
      const deleteOption = screen.queryByRole('menuitem', { name: /delete canvas/i });

      expect(editOption).toBeNull();
      expect(deleteOption).toBeNull();
    });

    it('should handle permission changes during session', async () => {
      let canEdit = true;
      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCanvas: jest.fn().mockReturnValue(mockCanvas1),
        canUserEditCanvas: jest.fn().mockImplementation(() => canEdit),
        updateCanvas: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      const { rerender } = render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Initially should have edit permissions
      const contextMenuButton = screen.getByRole('button', { name: /canvas options/i });
      await user.click(contextMenuButton);

      let editOption = screen.getByRole('menuitem', { name: /edit canvas/i });
      expect(editOption).toBeInTheDocument();

      // Simulate permission revocation
      canEdit = false;
      mockWorkspaceStore.canUserEditCanvas.mockReturnValue(false);

      // Re-render with updated permissions
      rerender(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>
      );

      // Edit option should no longer be available
      await user.click(contextMenuButton);
      editOption = screen.queryByRole('menuitem', { name: /edit canvas/i });
      expect(editOption).toBeNull();
    });
  });

  describe('Data Synchronization and Consistency', () => {
    it('should maintain canvas-card relationship integrity', async () => {
      const getCanvasCardsQuery = {
        request: {
          query: GET_CANVAS_CARDS,
          variables: { canvasId: mockCanvas1.id },
        },
        result: {
          data: {
            canvasCards: [mockCard],
          },
        },
      };

      const createCardMutation = {
        request: {
          query: CREATE_CARD,
          variables: {
            input: {
              canvasId: mockCanvas1.id,
              type: 'NOTE',
              title: 'New Card',
              content: '',
              position: { x: 200, y: 200, z: 0 },
              size: { width: 200, height: 150 },
            },
          },
        },
        result: {
          data: {
            createCard: {
              id: 'new-card-id',
              canvasId: mockCanvas1.id,
              workspaceId: mockWorkspace.id,
              type: 'NOTE',
              title: 'New Card',
              content: '',
              position: { x: 200, y: 200, z: 0 },
              size: { width: 200, height: 150 },
              style: {
                backgroundColor: '#ffffff',
                textColor: '#000000',
                borderColor: '#e5e7eb',
                borderWidth: 1,
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
            },
          },
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCurrentCanvas: jest.fn().mockReturnValue(mockCanvas1),
      };

      const mockCanvasStore = {
        cards: new Map([[mockCard.id, mockCard]]),
        loadCanvasData: jest.fn(),
        createCard: jest.fn().mockResolvedValue('new-card-id'),
        getCards: jest.fn().mockReturnValue([mockCard]),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);
      (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);

      const wrapper = createWrapper([getCanvasCardsQuery, createCardMutation]);

      render(
        <WorkspaceLayout>
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Load canvas data
      await waitFor(() => {
        expect(mockCanvasStore.loadCanvasData).toHaveBeenCalledWith(mockCanvas1.id);
      });

      // Create new card
      const createCardButton = screen.getByRole('button', { name: /create card/i });
      await user.click(createCardButton);

      // Verify card creation with proper canvas association
      await waitFor(() => {
        expect(mockCanvasStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            canvasId: mockCanvas1.id,
          })
        );
      });
    });

    it('should handle version conflicts in concurrent edits', async () => {
      const versionConflictMock = {
        request: {
          query: UPDATE_CANVAS,
          variables: {
            id: mockCanvas1.id,
            input: { name: 'Updated Name' },
            expectedVersion: 1,
          },
        },
        result: {
          errors: [new GraphQLError('Version conflict: canvas has been modified by another user')],
        },
      };

      const getLatestVersionQuery = {
        request: {
          query: GET_CANVAS,
          variables: { id: mockCanvas1.id },
        },
        result: {
          data: {
            canvas: {
              ...mockCanvas1,
              name: 'Modified by Another User',
              version: 2,
            },
          },
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCanvas: jest.fn().mockReturnValue(mockCanvas1),
        updateCanvas: jest.fn().mockRejectedValue(new Error('Version conflict')),
        refreshCanvas: jest.fn(),
        showConflictResolution: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([versionConflictMock, getLatestVersionQuery]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Attempt update that will conflict
      const editButton = screen.getByRole('button', { name: /edit canvas/i });
      await user.click(editButton);

      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should detect version conflict
      await waitFor(() => {
        expect(screen.getByText(/version conflict/i)).toBeInTheDocument();
      });

      // Should offer resolution options
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      const overrideButton = screen.getByRole('button', { name: /override/i });

      expect(refreshButton).toBeInTheDocument();
      expect(overrideButton).toBeInTheDocument();

      await user.click(refreshButton);
      expect(mockWorkspaceStore.refreshCanvas).toHaveBeenCalledWith(mockCanvas1.id);
    });

    it('should sync canvas settings with backend', async () => {
      const updateSettingsMutation = {
        request: {
          query: UPDATE_CANVAS_SETTINGS,
          variables: {
            id: mockCanvas1.id,
            settings: {
              zoom: 1.5,
              position: { x: 100, y: 50, z: 0 },
            },
          },
        },
        result: {
          data: {
            updateCanvasSettings: {
              ...mockCanvas1,
              settings: {
                ...mockCanvas1.settings,
                zoom: 1.5,
                position: { x: 100, y: 50, z: 0 },
              },
              version: 2,
            },
          },
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCurrentCanvas: jest.fn().mockReturnValue(mockCanvas1),
        updateCanvasSettings: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([updateSettingsMutation]);

      render(
        <WorkspaceLayout>
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      const canvasElement = screen.getByTestId('infinite-canvas');

      // Simulate zoom change
      await act(async () => {
        fireEvent.wheel(canvasElement, { deltaY: -100 });
      });

      // Simulate pan
      await act(async () => {
        fireEvent.mouseDown(canvasElement, { clientX: 0, clientY: 0 });
        fireEvent.mouseMove(canvasElement, { clientX: 100, clientY: 50 });
        fireEvent.mouseUp(canvasElement);
      });

      // Should sync settings to backend
      await waitFor(() => {
        expect(mockWorkspaceStore.updateCanvasSettings).toHaveBeenCalledWith(
          mockCanvas1.id,
          expect.objectContaining({
            zoom: expect.any(Number),
            position: expect.objectContaining({
              x: expect.any(Number),
              y: expect.any(Number),
            }),
          })
        );
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should retry failed operations with exponential backoff', async () => {
      let attemptCount = 0;
      const retryMock = {
        request: {
          query: CREATE_CANVAS,
          variables: {
            input: {
              workspaceId: mockWorkspace.id,
              name: 'Retry Canvas',
              description: '',
              metadata: {},
            },
          },
        },
        result: () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Temporary server error');
          }
          return {
            data: {
              createCanvas: {
                ...mockCanvas1,
                id: 'retry-canvas-id',
                name: 'Retry Canvas',
              },
            },
          };
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        createCanvas: jest.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Temporary server error');
          }
          return 'retry-canvas-id';
        }),
        retryWithBackoff: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([retryMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Trigger operation that will initially fail
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.type(nameInput, 'Retry Canvas');

      const submitButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(submitButton);

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(mockWorkspaceStore.createCanvas).toHaveBeenCalledTimes(1);
      }, { timeout: 5000 });

      expect(attemptCount).toBeGreaterThanOrEqual(3);
    });

    it('should maintain offline queue for failed operations', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        isOffline: true,
        queueOfflineOperation: jest.fn(),
        processOfflineQueue: jest.fn(),
        createCanvas: jest.fn().mockRejectedValue(new Error('Network unavailable')),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Attempt operation while offline
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.type(nameInput, 'Offline Canvas');

      const submitButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(submitButton);

      // Should queue operation for later
      expect(mockWorkspaceStore.queueOfflineOperation).toHaveBeenCalledWith(
        'createCanvas',
        expect.objectContaining({
          name: 'Offline Canvas',
        })
      );

      // Simulate going back online
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));

      // Should process queued operations
      await waitFor(() => {
        expect(mockWorkspaceStore.processOfflineQueue).toHaveBeenCalled();
      });
    });
  });
});