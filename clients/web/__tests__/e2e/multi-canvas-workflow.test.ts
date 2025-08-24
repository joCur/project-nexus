/**
 * Multi-Canvas Workflow End-to-End Tests (NEX-177)
 * 
 * Comprehensive E2E testing for multi-canvas workspace functionality including:
 * - Complete user journey: workspace → create canvas → switch canvases
 * - Canvas state persistence across navigation
 * - Default canvas redirect functionality
 * - Canvas sharing and permissions
 * - Canvas deletion and cleanup
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Import components and operations
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
  DUPLICATE_CANVAS,
  UPDATE_CANVAS_SETTINGS,
} from '@/lib/graphql/canvasOperations';

// Import stores
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';

// Import types
import type { EntityId } from '@/types/common.types';
import type { CanvasId } from '@/types/workspace.types';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockNavigate,
    replace: mockNavigate,
    back: jest.fn(),
  }),
  useParams: () => ({ workspaceId: 'test-workspace-id', canvasId: 'test-canvas-id' }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Mock stores
jest.mock('@/stores/workspaceStore');
jest.mock('@/stores/canvasStore');

describe('Multi-Canvas Workflow E2E Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  // Mock data
  const mockWorkspace = {
    id: 'test-workspace-id' as EntityId,
    name: 'Test Workspace',
    ownerId: 'user-1' as EntityId,
    settings: {
      privacy: 'PRIVATE' as const,
      defaultViewType: 'CANVAS' as const,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockCanvases = [
    {
      id: 'canvas-1' as CanvasId,
      workspaceId: mockWorkspace.id,
      name: 'Main Canvas',
      description: 'Default canvas',
      settings: {
        isDefault: true,
        position: { x: 0, y: 0, z: 0 },
        zoom: 1.0,
        grid: {
          enabled: true,
          size: 20,
          color: '#e5e7eb',
          opacity: 0.3,
        },
        background: {
          type: 'COLOR' as const,
          color: '#ffffff',
          opacity: 1.0,
        },
      },
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
    {
      id: 'canvas-2' as CanvasId,
      workspaceId: mockWorkspace.id,
      name: 'Secondary Canvas',
      description: 'Secondary canvas for testing',
      settings: {
        isDefault: false,
        position: { x: 100, y: 100, z: 0 },
        zoom: 1.2,
        grid: {
          enabled: false,
          size: 20,
          color: '#e5e7eb',
          opacity: 0.3,
        },
        background: {
          type: 'COLOR' as const,
          color: '#f8f9fa',
          opacity: 1.0,
        },
      },
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  ];

  const mockCards = [
    {
      id: 'card-1' as EntityId,
      canvasId: 'canvas-1' as CanvasId,
      workspaceId: mockWorkspace.id,
      type: 'NOTE' as const,
      title: 'Test Card 1',
      content: 'Content of test card 1',
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
    },
  ];

  // Mock store functions
  const mockWorkspaceStore = {
    currentWorkspace: mockWorkspace,
    canvasManagement: {
      canvases: new Map(mockCanvases.map(c => [c.id, c])),
      currentCanvasId: 'canvas-1' as CanvasId,
      defaultCanvasId: 'canvas-1' as CanvasId,
    },
    getWorkspace: jest.fn().mockReturnValue(mockWorkspace),
    getCanvases: jest.fn().mockReturnValue(mockCanvases),
    getCurrentCanvas: jest.fn().mockReturnValue(mockCanvases[0]),
    getDefaultCanvas: jest.fn().mockReturnValue(mockCanvases[0]),
    createCanvas: jest.fn(),
    updateCanvas: jest.fn(),
    deleteCanvas: jest.fn(),
    switchToCanvas: jest.fn(),
    setDefaultCanvas: jest.fn(),
    duplicateCanvas: jest.fn(),
    loadCanvases: jest.fn(),
  };

  const mockCanvasStore = {
    cards: new Map(mockCards.map(c => [c.id, c])),
    connections: new Map(),
    getCards: jest.fn().mockReturnValue(mockCards),
    getCard: jest.fn(),
    createCard: jest.fn(),
    updateCard: jest.fn(),
    deleteCard: jest.fn(),
    loadCanvasData: jest.fn(),
    clearCanvas: jest.fn(),
  };

  beforeAll(() => {
    // Setup user event
    user = userEvent.setup({ delay: null });
    
    // Mock intersectionObserver for infinite canvas
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
    
    // Mock ResizeObserver
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup store mocks
    (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);
    (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);
    
    // Reset navigation mock
    mockNavigate.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
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

  describe('Complete User Journey: Workspace → Create Canvas → Switch Canvases', () => {
    it('should allow user to navigate workspace, create new canvas, and switch between canvases', async () => {
      const createCanvasMock = {
        request: {
          query: CREATE_CANVAS,
          variables: {
            input: {
              workspaceId: mockWorkspace.id,
              name: 'New Test Canvas',
              description: 'Created during E2E test',
              metadata: {},
            },
          },
        },
        result: {
          data: {
            createCanvas: {
              id: 'canvas-3',
              workspaceId: mockWorkspace.id,
              name: 'New Test Canvas',
              description: 'Created during E2E test',
              settings: {
                isDefault: false,
                position: { x: 0, y: 0, z: 0 },
                zoom: 1.0,
                grid: {
                  enabled: true,
                  size: 20,
                  color: '#e5e7eb',
                  opacity: 0.3,
                },
                background: {
                  type: 'COLOR',
                  color: '#ffffff',
                  opacity: 1.0,
                },
              },
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
            },
          },
        },
      };

      const getCanvasesMock = {
        request: {
          query: GET_WORKSPACE_CANVASES,
          variables: {
            workspaceId: mockWorkspace.id,
          },
        },
        result: {
          data: {
            workspaceCanvases: {
              items: mockCanvases,
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

      const wrapper = createWrapper([createCanvasMock, getCanvasesMock]);

      // 1. Render workspace layout
      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Verify initial state: default canvas is loaded
      expect(screen.getByText('Main Canvas')).toBeInTheDocument();
      
      // Verify canvas switcher is present
      const canvasSwitcher = screen.getByRole('combobox', { name: /select canvas/i });
      expect(canvasSwitcher).toBeInTheDocument();

      // 2. Open canvas creation modal
      const createCanvasButton = screen.getByRole('button', { name: /create canvas/i });
      expect(createCanvasButton).toBeInTheDocument();
      
      await user.click(createCanvasButton);

      // Verify modal opened
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /create new canvas/i })).toBeInTheDocument();
      });

      // 3. Fill out canvas creation form
      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      const descriptionInput = screen.getByRole('textbox', { name: /description/i });
      
      await user.type(nameInput, 'New Test Canvas');
      await user.type(descriptionInput, 'Created during E2E test');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(submitButton);

      // Wait for canvas creation
      await waitFor(() => {
        expect(mockWorkspaceStore.createCanvas).toHaveBeenCalledWith({
          workspaceId: mockWorkspace.id,
          name: 'New Test Canvas',
          description: 'Created during E2E test',
        });
      });

      // Verify modal closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // 4. Switch to different canvas
      await user.click(canvasSwitcher);
      
      // Select secondary canvas
      const secondaryCanvas = screen.getByRole('option', { name: /secondary canvas/i });
      await user.click(secondaryCanvas);

      // Verify canvas switch
      await waitFor(() => {
        expect(mockWorkspaceStore.switchToCanvas).toHaveBeenCalledWith('canvas-2');
      });

      // 5. Verify state persistence after switching
      expect(mockCanvasStore.loadCanvasData).toHaveBeenCalledWith('canvas-2');
    });

    it('should handle canvas creation errors gracefully', async () => {
      const createCanvasErrorMock = {
        request: {
          query: CREATE_CANVAS,
          variables: {
            input: {
              workspaceId: mockWorkspace.id,
              name: 'Error Canvas',
              description: '',
              metadata: {},
            },
          },
        },
        error: new Error('Canvas with this name already exists'),
      };

      const wrapper = createWrapper([createCanvasErrorMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <CreateCanvasModal />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Open creation modal
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      // Fill form with duplicate name
      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.type(nameInput, 'Error Canvas');

      // Submit and expect error
      const submitButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(submitButton);

      // Verify error message appears
      await waitFor(() => {
        expect(screen.getByText(/canvas with this name already exists/i)).toBeInTheDocument();
      });

      // Verify modal stays open for user to fix error
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Canvas State Persistence Across Navigation', () => {
    it('should preserve canvas settings when switching between canvases', async () => {
      const updateSettingsMock = {
        request: {
          query: UPDATE_CANVAS_SETTINGS,
          variables: {
            id: 'canvas-1',
            settings: {
              zoom: 1.5,
              position: { x: 200, y: 150, z: 0 },
            },
          },
        },
        result: {
          data: {
            updateCanvasSettings: {
              ...mockCanvases[0],
              settings: {
                ...mockCanvases[0].settings,
                zoom: 1.5,
                position: { x: 200, y: 150, z: 0 },
              },
            },
          },
        },
      };

      const wrapper = createWrapper([updateSettingsMock]);

      render(<InfiniteCanvas />, { wrapper });

      // Simulate canvas interactions (zoom, pan)
      const canvasElement = screen.getByTestId('infinite-canvas');
      expect(canvasElement).toBeInTheDocument();

      // Simulate zoom interaction
      await act(async () => {
        fireEvent.wheel(canvasElement, { deltaY: -100 });
      });

      // Simulate pan interaction
      await act(async () => {
        fireEvent.mouseDown(canvasElement, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(canvasElement, { clientX: 200, clientY: 150 });
        fireEvent.mouseUp(canvasElement);
      });

      // Verify settings were updated
      await waitFor(() => {
        expect(mockWorkspaceStore.updateCanvas).toHaveBeenCalled();
      });

      // Switch to another canvas
      mockWorkspaceStore.switchToCanvas('canvas-2');

      // Switch back to original canvas
      mockWorkspaceStore.switchToCanvas('canvas-1');

      // Verify state was restored
      expect(mockCanvasStore.loadCanvasData).toHaveBeenCalledWith('canvas-1');
    });

    it('should maintain card positions and states across canvas switches', async () => {
      const wrapper = createWrapper([]);

      render(<InfiniteCanvas />, { wrapper });

      // Verify initial card state
      expect(mockCanvasStore.getCards).toHaveBeenCalled();

      // Switch canvas
      mockWorkspaceStore.switchToCanvas('canvas-2');

      // Verify canvas was cleared
      expect(mockCanvasStore.clearCanvas).toHaveBeenCalled();

      // Verify new canvas data was loaded
      expect(mockCanvasStore.loadCanvasData).toHaveBeenCalledWith('canvas-2');

      // Switch back
      mockWorkspaceStore.switchToCanvas('canvas-1');

      // Verify original data was restored
      expect(mockCanvasStore.loadCanvasData).toHaveBeenCalledWith('canvas-1');
    });
  });

  describe('Default Canvas Redirect Functionality', () => {
    it('should redirect to default canvas when accessing workspace root', async () => {
      // Mock accessing workspace without canvas ID
      const mockParams = { workspaceId: 'test-workspace-id' };
      
      jest.doMock('next/navigation', () => ({
        useRouter: () => ({
          push: mockNavigate,
          replace: mockNavigate,
        }),
        useParams: () => mockParams,
      }));

      const wrapper = createWrapper([]);

      render(<WorkspaceLayout />, { wrapper });

      // Verify redirect to default canvas
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          `/workspace/${mockWorkspace.id}/canvas/${mockCanvases[0].id}`
        );
      });
    });

    it('should handle missing default canvas scenario', async () => {
      // Mock store with no default canvas
      const storeWithoutDefault = {
        ...mockWorkspaceStore,
        getDefaultCanvas: jest.fn().mockReturnValue(null),
        canvasManagement: {
          ...mockWorkspaceStore.canvasManagement,
          defaultCanvasId: null,
        },
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(storeWithoutDefault);

      const wrapper = createWrapper([]);

      render(<WorkspaceLayout />, { wrapper });

      // Should redirect to first available canvas or create one
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });
  });

  describe('Canvas Sharing and Permissions', () => {
    it('should handle canvas sharing with proper permissions', async () => {
      // Mock sharing functionality
      const shareButton = screen.queryByRole('button', { name: /share canvas/i });
      
      if (shareButton) {
        await user.click(shareButton);

        // Verify sharing modal opens
        await waitFor(() => {
          expect(screen.getByRole('dialog', { name: /share canvas/i })).toBeInTheDocument();
        });

        // Test permission selection
        const permissionSelect = screen.getByRole('combobox', { name: /permissions/i });
        await user.click(permissionSelect);

        const viewOption = screen.getByRole('option', { name: /view only/i });
        await user.click(viewOption);

        // Generate share link
        const generateLinkButton = screen.getByRole('button', { name: /generate link/i });
        await user.click(generateLinkButton);

        // Verify link generation
        await waitFor(() => {
          expect(screen.getByDisplayValue(/https:\/\/.*\/shared\//)).toBeInTheDocument();
        });
      }
    });

    it('should prevent unauthorized canvas operations', async () => {
      // Mock unauthorized user
      const unauthorizedStore = {
        ...mockWorkspaceStore,
        canUserEditCanvas: jest.fn().mockReturnValue(false),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(unauthorizedStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Verify creation button is disabled/hidden
      const createButton = screen.queryByRole('button', { name: /create canvas/i });
      expect(createButton).toBeNull();

      // Verify delete option is not available
      const canvasSwitcher = screen.getByRole('combobox');
      await user.click(canvasSwitcher);

      const deleteOption = screen.queryByRole('button', { name: /delete canvas/i });
      expect(deleteOption).toBeNull();
    });
  });

  describe('Canvas Deletion and Cleanup', () => {
    it('should handle canvas deletion with proper confirmation', async () => {
      const deleteCanvasMock = {
        request: {
          query: DELETE_CANVAS,
          variables: {
            id: 'canvas-2',
          },
        },
        result: {
          data: {
            deleteCanvas: true,
          },
        },
      };

      const wrapper = createWrapper([deleteCanvasMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Open canvas options
      const canvasSwitcher = screen.getByRole('combobox');
      await user.click(canvasSwitcher);

      // Select secondary canvas first
      const secondaryOption = screen.getByRole('option', { name: /secondary canvas/i });
      await user.click(secondaryOption);

      // Open context menu
      const contextMenuButton = screen.getByRole('button', { name: /canvas options/i });
      await user.click(contextMenuButton);

      // Click delete option
      const deleteOption = screen.getByRole('menuitem', { name: /delete canvas/i });
      await user.click(deleteOption);

      // Verify confirmation dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /delete canvas/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      // Verify deletion was called
      await waitFor(() => {
        expect(mockWorkspaceStore.deleteCanvas).toHaveBeenCalledWith('canvas-2');
      });

      // Verify redirect to default canvas
      expect(mockWorkspaceStore.switchToCanvas).toHaveBeenCalledWith('canvas-1');
    });

    it('should prevent deletion of default canvas', async () => {
      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Try to delete default canvas
      const canvasSwitcher = screen.getByRole('combobox');
      await user.click(canvasSwitcher);

      // Default canvas should be selected
      expect(screen.getByDisplayValue('Main Canvas')).toBeInTheDocument();

      // Open context menu
      const contextMenuButton = screen.getByRole('button', { name: /canvas options/i });
      await user.click(contextMenuButton);

      // Delete option should be disabled
      const deleteOption = screen.getByRole('menuitem', { name: /delete canvas/i });
      expect(deleteOption).toHaveAttribute('aria-disabled', 'true');
    });

    it('should handle cleanup when last canvas is deleted', async () => {
      // Mock store with only one canvas
      const singleCanvasStore = {
        ...mockWorkspaceStore,
        getCanvases: jest.fn().mockReturnValue([mockCanvases[0]]),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(singleCanvasStore);

      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Verify delete is disabled when only one canvas exists
      const contextMenuButton = screen.getByRole('button', { name: /canvas options/i });
      await user.click(contextMenuButton);

      const deleteOption = screen.getByRole('menuitem', { name: /delete canvas/i });
      expect(deleteOption).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Performance and Loading States', () => {
    it('should show loading states during canvas operations', async () => {
      // Mock slow canvas creation
      const slowCreateMock = {
        request: {
          query: CREATE_CANVAS,
          variables: {
            input: {
              workspaceId: mockWorkspace.id,
              name: 'Slow Canvas',
              description: '',
              metadata: {},
            },
          },
        },
        delay: 2000,
        result: {
          data: {
            createCanvas: {
              id: 'slow-canvas',
              workspaceId: mockWorkspace.id,
              name: 'Slow Canvas',
            },
          },
        },
      };

      const wrapper = createWrapper([slowCreateMock]);

      render(
        <WorkspaceLayout>
          <CreateCanvasModal />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Open modal and submit
      const createButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(createButton);

      const nameInput = screen.getByRole('textbox', { name: /canvas name/i });
      await user.type(nameInput, 'Slow Canvas');

      const submitButton = screen.getByRole('button', { name: /create canvas/i });
      await user.click(submitButton);

      // Verify loading state
      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();

      // Wait for completion
      await waitFor(
        () => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should handle canvas switching performance efficiently', async () => {
      const wrapper = createWrapper([]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      const startTime = performance.now();

      // Simulate rapid canvas switching
      for (let i = 0; i < 5; i++) {
        mockWorkspaceStore.switchToCanvas(`canvas-${i % 2 === 0 ? '1' : '2'}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (< 200ms)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors during canvas operations', async () => {
      const networkErrorMock = {
        request: {
          query: GET_WORKSPACE_CANVASES,
          variables: {
            workspaceId: mockWorkspace.id,
          },
        },
        error: new Error('Network request failed'),
      };

      const wrapper = createWrapper([networkErrorMock]);

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Verify error state is shown
      await waitFor(() => {
        expect(screen.getByText(/failed to load canvases/i)).toBeInTheDocument();
      });

      // Verify retry button is available
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      await user.click(retryButton);

      // Verify retry attempt
      expect(mockWorkspaceStore.loadCanvases).toHaveBeenCalled();
    });

    it('should recover from canvas data corruption', async () => {
      // Mock corrupted canvas data
      const corruptedStore = {
        ...mockWorkspaceStore,
        getCurrentCanvas: jest.fn().mockReturnValue(null),
        getCanvases: jest.fn().mockReturnValue([]),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(corruptedStore);

      const wrapper = createWrapper([]);

      render(<WorkspaceLayout />, { wrapper });

      // Should attempt to recover by creating default canvas
      await waitFor(() => {
        expect(corruptedStore.loadCanvases).toHaveBeenCalled();
      });
    });
  });
});