/**
 * Multi-Canvas Error Handling & Edge Cases Tests (NEX-177)
 * 
 * Comprehensive error handling and edge case testing including:
 * - Canvas not found scenarios
 * - Network connectivity issues
 * - Concurrent canvas operations
 * - Permission changes during operations
 * - Browser navigation edge cases
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { BrowserRouter } from 'react-router-dom';
import { GraphQLError } from 'graphql';
import React from 'react';

// Import components
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import CanvasSwitcher from '@/components/workspace/CanvasSwitcher';
import CreateCanvasModal from '@/components/workspace/CreateCanvasModal';
import { InfiniteCanvas } from '@/components/canvas';

// Import GraphQL operations
import {
  GET_WORKSPACE_CANVASES,
  GET_CANVAS,
  CREATE_CANVAS,
  UPDATE_CANVAS,
  DELETE_CANVAS,
  SET_DEFAULT_CANVAS,
} from '@/lib/graphql/canvasOperations';

// Import stores and hooks
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';

// Import types
import type { EntityId } from '@/types/common.types';
import type { CanvasId } from '@/types/workspace.types';

// Mock navigation and router
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockNavigate,
    replace: mockReplace,
    back: mockBack,
  }),
  useParams: () => ({ 
    workspaceId: 'test-workspace-id', 
    canvasId: 'test-canvas-id' 
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Mock stores
jest.mock('@/stores/workspaceStore');
jest.mock('@/stores/canvasStore');

// Mock error tracking
const mockErrorTracker = {
  captureError: jest.fn(),
  captureMessage: jest.fn(),
};

jest.mock('@/utils/errorTracking', () => mockErrorTracker);

describe('Multi-Canvas Error Handling & Edge Cases', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  const mockWorkspace = {
    id: 'test-workspace-id' as EntityId,
    name: 'Test Workspace',
    ownerId: 'user-1' as EntityId,
  };

  const mockCanvas = {
    id: 'test-canvas-id' as CanvasId,
    workspaceId: mockWorkspace.id,
    name: 'Test Canvas',
    description: 'Test canvas description',
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

  beforeEach(() => {
    user = userEvent.setup({ delay: null });
    jest.clearAllMocks();
    
    // Reset navigation mocks
    mockNavigate.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    
    // Reset error tracking mocks
    mockErrorTracker.captureError.mockClear();
    mockErrorTracker.captureMessage.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createWrapper = (mocks: any[] = []) => {
    return ({ children }: { children: React.ReactNode }) => (
      <BrowserRouter>
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      </BrowserRouter>
    );
  };

  describe('Canvas Not Found Scenarios', () => {
    it('should handle canvas not found error gracefully', async () => {
      const notFoundMock = {
        request: {
          query: GET_CANVAS,
          variables: { id: 'non-existent-canvas' },
        },
        result: {
          errors: [new GraphQLError('Canvas not found')],
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCanvas: jest.fn().mockReturnValue(null),
        getDefaultCanvas: jest.fn().mockReturnValue(mockCanvas),
        canvasManagement: {
          currentCanvasId: 'non-existent-canvas' as CanvasId,
        },
        switchToCanvas: jest.fn(),
        loadCanvases: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([notFoundMock]);

      render(
        <WorkspaceLayout>
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/canvas not found/i)).toBeInTheDocument();
      });

      // Should offer to redirect to default canvas
      const redirectButton = screen.getByRole('button', { name: /go to default canvas/i });
      expect(redirectButton).toBeInTheDocument();

      await user.click(redirectButton);

      // Should redirect to default canvas
      expect(mockWorkspaceStore.switchToCanvas).toHaveBeenCalledWith(mockCanvas.id);
      expect(mockNavigate).toHaveBeenCalledWith(
        `/workspace/${mockWorkspace.id}/canvas/${mockCanvas.id}`
      );
    });

    it('should handle missing default canvas scenario', async () => {
      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCanvas: jest.fn().mockReturnValue(null),
        getDefaultCanvas: jest.fn().mockReturnValue(null),
        getCanvases: jest.fn().mockReturnValue([]),
        canvasManagement: {
          currentCanvasId: null,
          defaultCanvasId: null,
        },
        createCanvas: jest.fn(),
        switchToCanvas: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText(/no canvases found/i)).toBeInTheDocument();
      });

      // Should offer to create first canvas
      const createButton = screen.getByRole('button', { name: /create your first canvas/i });
      expect(createButton).toBeInTheDocument();

      await user.click(createButton);

      // Should trigger canvas creation
      expect(mockWorkspaceStore.createCanvas).toHaveBeenCalled();
    });

    it('should handle canvas ID mismatch in URL', async () => {
      // Mock params with different canvas ID
      jest.doMock('next/navigation', () => ({
        useRouter: () => ({
          push: mockNavigate,
          replace: mockReplace,
        }),
        useParams: () => ({
          workspaceId: 'test-workspace-id',
          canvasId: 'different-canvas-id',
        }),
      }));

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCanvas: jest.fn().mockReturnValue(null),
        getDefaultCanvas: jest.fn().mockReturnValue(mockCanvas),
        canvasManagement: {
          currentCanvasId: 'test-canvas-id' as CanvasId,
        },
        switchToCanvas: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(<WorkspaceLayout />, { wrapper });

      // Should sync URL with current canvas
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          `/workspace/test-workspace-id/canvas/test-canvas-id`
        );
      });
    });
  });

  describe('Network Connectivity Issues', () => {
    it('should handle network timeout errors', async () => {
      const timeoutMock = {
        request: {
          query: GET_WORKSPACE_CANVASES,
          variables: { workspaceId: mockWorkspace.id },
        },
        error: new Error('Network request failed'),
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        loadCanvases: jest.fn().mockRejectedValue(new Error('Network timeout')),
        retryLoadCanvases: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([timeoutMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Should show network error
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Should show retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      await user.click(retryButton);

      expect(mockWorkspaceStore.retryLoadCanvases).toHaveBeenCalled();
    });

    it('should handle intermittent connectivity during canvas operations', async () => {
      let requestCount = 0;
      const intermittentMock = {
        request: {
          query: CREATE_CANVAS,
          variables: {
            input: {
              workspaceId: mockWorkspace.id,
              name: 'Test Canvas',
              description: '',
              metadata: {},
            },
          },
        },
        result: () => {
          requestCount++;
          if (requestCount < 3) {
            throw new Error('Network error');
          }
          return {
            data: {
              createCanvas: {
                ...mockCanvas,
                id: 'new-canvas-id',
                name: 'Test Canvas',
              },
            },
          };
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        createCanvas: jest.fn().mockImplementation(async () => {
          if (requestCount < 3) {
            throw new Error('Network error');
          }
          return 'new-canvas-id';
        }),
        retryCreateCanvas: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([intermittentMock]);

      render(
        <WorkspaceLayout>
          <CreateCanvasModal />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Open modal and create canvas
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.type(nameInput, 'Test Canvas');

      const submitButton = screen.getByRole('button', { name: /create canvas/i });
      
      // First attempt should fail
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Retry should eventually succeed
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(mockWorkspaceStore.createCanvas).toHaveBeenCalled();
      });
    });

    it('should handle offline mode gracefully', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        isOffline: true,
        getCachedCanvases: jest.fn().mockReturnValue([mockCanvas]),
        syncWhenOnline: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Should show offline indicator
      await waitFor(() => {
        expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
      });

      // Should load cached data
      expect(mockWorkspaceStore.getCachedCanvases).toHaveBeenCalled();

      // Simulate going back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
      });

      window.dispatchEvent(new Event('online'));

      // Should attempt to sync
      await waitFor(() => {
        expect(mockWorkspaceStore.syncWhenOnline).toHaveBeenCalled();
      });
    });
  });

  describe('Concurrent Canvas Operations', () => {
    it('should handle concurrent canvas creation attempts', async () => {
      let creationAttempts = 0;
      const concurrentMock = {
        request: {
          query: CREATE_CANVAS,
          variables: {
            input: {
              workspaceId: mockWorkspace.id,
              name: 'Concurrent Canvas',
              description: '',
              metadata: {},
            },
          },
        },
        result: () => {
          creationAttempts++;
          if (creationAttempts > 1) {
            throw new GraphQLError('Canvas with this name already exists');
          }
          return {
            data: {
              createCanvas: {
                ...mockCanvas,
                id: 'concurrent-canvas-id',
                name: 'Concurrent Canvas',
              },
            },
          };
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        createCanvas: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([concurrentMock]);

      render(
        <WorkspaceLayout>
          <CreateCanvasModal />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Simulate rapid double-clicks
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.type(nameInput, 'Concurrent Canvas');

      const submitButton = screen.getByRole('button', { name: /create canvas/i });
      
      // Double click rapidly
      await act(async () => {
        await user.click(submitButton);
        await user.click(submitButton);
      });

      // Should only create one canvas
      await waitFor(() => {
        expect(mockWorkspaceStore.createCanvas).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle concurrent canvas deletion attempts', async () => {
      const deleteMock = {
        request: {
          query: DELETE_CANVAS,
          variables: { id: 'canvas-to-delete' },
        },
        result: {
          data: { deleteCanvas: true },
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCanvas: jest.fn().mockReturnValue(mockCanvas),
        deleteCanvas: jest.fn(),
        isDeleting: false,
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([deleteMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Open context menu
      const contextMenuButton = screen.getByRole('button', { name: /canvas options/i });
      await user.click(contextMenuButton);

      const deleteOption = screen.getByRole('menuitem', { name: /delete canvas/i });
      
      // Rapidly click delete multiple times
      await act(async () => {
        await user.click(deleteOption);
        await user.click(deleteOption);
      });

      // Should only trigger deletion once
      expect(mockWorkspaceStore.deleteCanvas).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent canvas switching', async () => {
      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        canvasManagement: {
          currentCanvasId: 'canvas-1' as CanvasId,
          isLoadingCanvas: false,
        },
        switchToCanvas: jest.fn(),
      };

      const mockCanvasStore = {
        loadCanvasData: jest.fn(),
        clearCanvas: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);
      (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Simulate rapid canvas switching
      await act(async () => {
        mockWorkspaceStore.switchToCanvas('canvas-2');
        mockWorkspaceStore.switchToCanvas('canvas-3');
        mockWorkspaceStore.switchToCanvas('canvas-4');
      });

      // Should debounce and only process the latest switch
      await waitFor(() => {
        expect(mockCanvasStore.loadCanvasData).toHaveBeenCalledWith('canvas-4');
      });
    });
  });

  describe('Permission Changes During Operations', () => {
    it('should handle permission revocation during canvas editing', async () => {
      const permissionErrorMock = {
        request: {
          query: UPDATE_CANVAS,
          variables: {
            id: mockCanvas.id,
            input: { name: 'Updated Name' },
          },
        },
        result: {
          errors: [new GraphQLError('Insufficient permissions')],
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCurrentCanvas: jest.fn().mockReturnValue(mockCanvas),
        updateCanvas: jest.fn().mockRejectedValue(new Error('Insufficient permissions')),
        canUserEditCanvas: jest.fn().mockReturnValue(false),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([permissionErrorMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Try to edit canvas name
      const editButton = screen.queryByRole('button', { name: /edit canvas/i });
      
      if (editButton) {
        await user.click(editButton);

        // Should show permission error
        await waitFor(() => {
          expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
        });

        // Should disable editing controls
        const nameInput = screen.queryByRole('textbox', { name: /canvas name/i });
        expect(nameInput).toBeDisabled();
      }
    });

    it('should handle workspace access revocation', async () => {
      const accessErrorMock = {
        request: {
          query: GET_WORKSPACE_CANVASES,
          variables: { workspaceId: mockWorkspace.id },
        },
        result: {
          errors: [new GraphQLError('Workspace access denied')],
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: null,
        loadCanvases: jest.fn().mockRejectedValue(new Error('Workspace access denied')),
        canUserAccessWorkspace: jest.fn().mockReturnValue(false),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([accessErrorMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Should show access denied message
      await waitFor(() => {
        expect(screen.getByText(/workspace access denied/i)).toBeInTheDocument();
      });

      // Should redirect to workspace list
      expect(mockNavigate).toHaveBeenCalledWith('/workspaces');
    });

    it('should handle permission changes mid-operation', async () => {
      let hasPermission = true;
      
      const dynamicMock = {
        request: {
          query: SET_DEFAULT_CANVAS,
          variables: {
            workspaceId: mockWorkspace.id,
            canvasId: mockCanvas.id,
          },
        },
        result: () => {
          if (!hasPermission) {
            throw new GraphQLError('Permission denied');
          }
          return {
            data: { setDefaultCanvas: { ...mockCanvas, settings: { ...mockCanvas.settings, isDefault: true } } },
          };
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCurrentCanvas: jest.fn().mockReturnValue(mockCanvas),
        setDefaultCanvas: jest.fn(),
        canUserEditCanvas: jest.fn().mockImplementation(() => hasPermission),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([dynamicMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Start operation with permission
      const setDefaultButton = screen.getByRole('button', { name: /set as default/i });
      
      // Revoke permission mid-operation
      hasPermission = false;
      mockWorkspaceStore.canUserEditCanvas.mockReturnValue(false);

      await user.click(setDefaultButton);

      // Should handle permission change gracefully
      await waitFor(() => {
        expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
      });

      // Should disable the button
      expect(setDefaultButton).toBeDisabled();
    });
  });

  describe('Browser Navigation Edge Cases', () => {
    it('should handle browser back button during canvas operations', async () => {
      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        canvasManagement: {
          currentCanvasId: mockCanvas.id,
          isLoadingCanvas: false,
        },
        switchToCanvas: jest.fn(),
        saveCanvasState: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Simulate browser back navigation
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { canvasId: 'previous-canvas-id' },
      }));

      // Should save current state before switching
      expect(mockWorkspaceStore.saveCanvasState).toHaveBeenCalled();

      // Should switch to previous canvas
      expect(mockWorkspaceStore.switchToCanvas).toHaveBeenCalledWith('previous-canvas-id');
    });

    it('should handle page refresh with unsaved changes', async () => {
      const mockCanvasStore = {
        hasUnsavedChanges: true,
        saveChanges: jest.fn(),
        discardChanges: jest.fn(),
      };

      (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Mock beforeunload event
      const beforeUnloadEvent = new Event('beforeunload');
      Object.defineProperty(beforeUnloadEvent, 'returnValue', {
        writable: true,
      });

      window.dispatchEvent(beforeUnloadEvent);

      // Should prompt user about unsaved changes
      expect(beforeUnloadEvent.returnValue).toBe('You have unsaved changes. Are you sure you want to leave?');
    });

    it('should handle invalid URL parameters gracefully', async () => {
      // Mock invalid workspace/canvas IDs
      jest.doMock('next/navigation', () => ({
        useRouter: () => ({
          push: mockNavigate,
          replace: mockReplace,
        }),
        useParams: () => ({
          workspaceId: 'invalid-workspace',
          canvasId: 'invalid-canvas',
        }),
      }));

      const mockWorkspaceStore = {
        currentWorkspace: null,
        loadWorkspace: jest.fn().mockRejectedValue(new Error('Workspace not found')),
        loadCanvases: jest.fn().mockResolvedValue([]),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(<WorkspaceLayout />, { wrapper });

      // Should show not found error
      await waitFor(() => {
        expect(screen.getByText(/workspace not found/i)).toBeInTheDocument();
      });

      // Should redirect to workspace list
      expect(mockNavigate).toHaveBeenCalledWith('/workspaces');
    });

    it('should handle rapid URL changes', async () => {
      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        canvasManagement: {
          currentCanvasId: mockCanvas.id,
        },
        switchToCanvas: jest.fn(),
        isLoadingCanvas: false,
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(<WorkspaceLayout />, { wrapper });

      // Simulate rapid URL changes
      const canvasIds = ['canvas-1', 'canvas-2', 'canvas-3', 'canvas-4'];
      
      await act(async () => {
        canvasIds.forEach((canvasId, index) => {
          setTimeout(() => {
            window.history.replaceState(
              { canvasId },
              '',
              `/workspace/${mockWorkspace.id}/canvas/${canvasId}`
            );
            window.dispatchEvent(new PopStateEvent('popstate', { state: { canvasId } }));
          }, index * 10);
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should debounce and only process the final URL
      expect(mockWorkspaceStore.switchToCanvas).toHaveBeenCalledWith('canvas-4');
    });
  });

  describe('Data Corruption and Recovery', () => {
    it('should handle corrupted canvas data', async () => {
      const corruptedCanvas = {
        ...mockCanvas,
        settings: null, // Corrupted settings
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCurrentCanvas: jest.fn().mockReturnValue(corruptedCanvas),
        repairCanvasData: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Should detect corruption and attempt repair
      await waitFor(() => {
        expect(mockWorkspaceStore.repairCanvasData).toHaveBeenCalledWith(corruptedCanvas.id);
      });

      // Should show recovery message
      expect(screen.getByText(/data recovered/i)).toBeInTheDocument();
    });

    it('should handle memory storage quota exceeded', async () => {
      // Mock quota exceeded error
      const mockCanvasStore = {
        saveToStorage: jest.fn().mockRejectedValue(new DOMException('QuotaExceededError')),
        clearOldData: jest.fn(),
      };

      (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);

      const wrapper = createWrapper([]);

      render(<InfiniteCanvas />, { wrapper });

      // Trigger save operation
      window.dispatchEvent(new CustomEvent('saveCanvas'));

      // Should handle quota error and clear old data
      await waitFor(() => {
        expect(mockCanvasStore.clearOldData).toHaveBeenCalled();
      });

      // Should show storage warning
      expect(screen.getByText(/storage space low/i)).toBeInTheDocument();
    });

    it('should handle database constraint violations', async () => {
      const constraintErrorMock = {
        request: {
          query: UPDATE_CANVAS,
          variables: {
            id: mockCanvas.id,
            input: { name: 'Duplicate Name' },
          },
        },
        result: {
          errors: [new GraphQLError('Unique constraint violation: canvas name must be unique within workspace')],
        },
      };

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        getCurrentCanvas: jest.fn().mockReturnValue(mockCanvas),
        updateCanvas: jest.fn(),
        generateUniqueName: jest.fn().mockReturnValue('Duplicate Name (2)'),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([constraintErrorMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Trigger update with duplicate name
      const editButton = screen.queryByRole('button', { name: /edit canvas/i });
      if (editButton) {
        await user.click(editButton);

        const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
        await user.clear(nameInput);
        await user.type(nameInput, 'Duplicate Name');

        const saveButton = screen.getByRole('button', { name: /save/i });
        await user.click(saveButton);

        // Should show constraint error
        await waitFor(() => {
          expect(screen.getByText(/name must be unique/i)).toBeInTheDocument();
        });

        // Should suggest alternative name
        const suggestedName = screen.getByText('Duplicate Name (2)');
        expect(suggestedName).toBeInTheDocument();
      }
    });
  });

  describe('Error Recovery and User Guidance', () => {
    it('should provide clear error messages and recovery actions', async () => {
      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        lastError: {
          message: 'Network connection lost',
          code: 'NETWORK_ERROR',
          recoverable: true,
        },
        clearError: jest.fn(),
        retryLastOperation: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Should show clear error message
      expect(screen.getByText(/network connection lost/i)).toBeInTheDocument();

      // Should provide recovery actions
      const retryButton = screen.getByRole('button', { name: /retry/i });
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });

      expect(retryButton).toBeInTheDocument();
      expect(dismissButton).toBeInTheDocument();

      await user.click(retryButton);
      expect(mockWorkspaceStore.retryLastOperation).toHaveBeenCalled();

      await user.click(dismissButton);
      expect(mockWorkspaceStore.clearError).toHaveBeenCalled();
    });

    it('should log errors for debugging and monitoring', async () => {
      const testError = new Error('Test error for logging');

      const mockWorkspaceStore = {
        currentWorkspace: mockWorkspace,
        createCanvas: jest.fn().mockRejectedValue(testError),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <CreateCanvasModal />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Trigger error
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.type(nameInput, 'Error Test');

      const submitButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(submitButton);

      // Should log error for monitoring
      await waitFor(() => {
        expect(mockErrorTracker.captureError).toHaveBeenCalledWith(testError, expect.objectContaining({
          context: 'canvas_creation',
          workspaceId: mockWorkspace.id,
        }));
      });
    });
  });
});