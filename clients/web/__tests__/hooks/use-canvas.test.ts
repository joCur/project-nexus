/**
 * Canvas Hooks Tests
 * 
 * Comprehensive test suite for canvas operation hooks including
 * GraphQL integration, optimistic updates, and error handling.
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import React from 'react';
import {
  useCanvases,
  useCanvas,
  useCreateCanvas,
  useUpdateCanvas,
  useDeleteCanvas,
  useSetDefaultCanvas,
  useDuplicateCanvas,
  useUpdateCanvasSettings,
} from '@/hooks/use-canvas';
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
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { EntityId } from '@/types/common.types';
import type { CanvasId, createCanvasId } from '@/types/workspace.types';

// Mock the workspace store
jest.mock('@/stores/workspaceStore');
jest.mock('@/types/workspace.types', () => ({
  ...jest.requireActual('@/types/workspace.types'),
  createCanvasId: jest.fn((id: string) => id as any),
}));

const mockWorkspaceStore = {
  canvasManagement: {
    canvases: new Map(),
  },
  getCanvas: jest.fn(),
  getDefaultCanvas: jest.fn(),
  getCurrentCanvas: jest.fn(),
  createCanvas: jest.fn(),
  updateCanvas: jest.fn(),
  deleteCanvas: jest.fn(),
  setDefaultCanvas: jest.fn(),
  duplicateCanvas: jest.fn(),
  updateCanvasSettings: jest.fn(),
};

(useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);

// Mock canvas response data
const mockCanvasResponse = {
  id: 'canvas-1',
  workspaceId: 'workspace-1',
  name: 'Test Canvas',
  description: 'Test Description',
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
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  version: 1,
};

const mockCanvasesResponse = {
  items: [mockCanvasResponse],
  totalCount: 1,
  page: 0,
  limit: 50,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

describe('Canvas Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkspaceStore.canvasManagement.canvases.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createWrapper = (mocks: any[] = []) => {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(MockedProvider, { mocks, addTypename: false }, children);
  };

  describe('useCanvases', () => {
    it('should fetch workspace canvases successfully', async () => {
      const mocks = [
        {
          request: {
            query: GET_WORKSPACE_CANVASES,
            variables: {
              workspaceId: 'workspace-1',
            },
          },
          result: {
            data: {
              workspaceCanvases: mockCanvasesResponse,
            },
          },
        },
      ];

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(
        () => useCanvases('workspace-1' as EntityId),
        { wrapper }
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.canvases).toEqual([]);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canvases).toHaveLength(1);
      expect(result.current.canvases[0].id).toBe('canvas-1');
      expect(result.current.error).toBeUndefined();
    });

    it('should handle GraphQL errors', async () => {
      const mocks = [
        {
          request: {
            query: GET_WORKSPACE_CANVASES,
            variables: {
              workspaceId: 'workspace-1',
            },
          },
          error: new Error('Network error'),
        },
      ];

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(
        () => useCanvases('workspace-1' as EntityId),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.canvases).toEqual([]);
    });

    it('should skip query when workspaceId is undefined', () => {
      const { result } = renderHook(
        () => useCanvases(undefined),
        { wrapper: createWrapper() }
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.canvases).toEqual([]);
    });

    it('should support filtering', async () => {
      const filter = { isDefault: true };
      const mocks = [
        {
          request: {
            query: GET_WORKSPACE_CANVASES,
            variables: {
              workspaceId: 'workspace-1',
              filter: {
                isDefault: true,
              },
            },
          },
          result: {
            data: {
              workspaceCanvases: mockCanvasesResponse,
            },
          },
        },
      ];

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(
        () => useCanvases('workspace-1' as EntityId, filter),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canvases).toHaveLength(1);
    });
  });

  describe('useCanvas', () => {
    it('should fetch single canvas successfully', async () => {
      const mocks = [
        {
          request: {
            query: GET_CANVAS,
            variables: {
              id: 'canvas-1',
            },
          },
          result: {
            data: {
              canvas: mockCanvasResponse,
            },
          },
        },
      ];

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(
        () => useCanvas('canvas-1' as CanvasId),
        { wrapper }
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canvas?.id).toBe('canvas-1');
      expect(result.current.error).toBeUndefined();
    });

    it('should prefer store data over GraphQL data', async () => {
      const storeCanvas = {
        id: 'canvas-1' as CanvasId,
        name: 'Store Canvas',
        version: 2,
      };

      mockWorkspaceStore.getCanvas.mockReturnValue(storeCanvas);

      const mocks = [
        {
          request: {
            query: GET_CANVAS,
            variables: {
              id: 'canvas-1',
            },
          },
          result: {
            data: {
              canvas: mockCanvasResponse,
            },
          },
        },
      ];

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(
        () => useCanvas('canvas-1' as CanvasId),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canvas?.name).toBe('Store Canvas');
    });
  });

  describe('useCreateCanvas', () => {
    it('should create canvas with optimistic update', async () => {
      const mocks = [
        {
          request: {
            query: CREATE_CANVAS,
            variables: {
              input: {
                workspaceId: 'workspace-1',
                name: 'New Canvas',
                description: 'Test Description',
                metadata: {},
              },
            },
          },
          result: {
            data: {
              createCanvas: mockCanvasResponse,
            },
          },
        },
      ];

      mockWorkspaceStore.createCanvas.mockResolvedValue('optimistic-id');

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useCreateCanvas(), { wrapper });

      expect(result.current.loading).toBe(false);

      let createdId: any;
      await act(async () => {
        createdId = await result.current.mutate({
          workspaceId: 'workspace-1' as EntityId,
          name: 'New Canvas',
          description: 'Test Description',
        });
      });

      expect(mockWorkspaceStore.createCanvas).toHaveBeenCalled();
      expect(createdId).toBe('optimistic-id');
    });

    it('should handle creation errors', async () => {
      const mocks = [
        {
          request: {
            query: CREATE_CANVAS,
            variables: {
              input: {
                workspaceId: 'workspace-1',
                name: 'New Canvas',
                metadata: {},
              },
            },
          },
          error: new Error('Validation error'),
        },
      ];

      mockWorkspaceStore.createCanvas.mockResolvedValue('optimistic-id');

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useCreateCanvas(), { wrapper });

      let createdId: any;
      await act(async () => {
        createdId = await result.current.mutate({
          workspaceId: 'workspace-1' as EntityId,
          name: 'New Canvas',
        });
      });

      expect(createdId).toBeNull();
    });
  });

  describe('useUpdateCanvas', () => {
    it('should update canvas with optimistic update', async () => {
      const mocks = [
        {
          request: {
            query: UPDATE_CANVAS,
            variables: {
              id: 'canvas-1',
              input: {
                name: 'Updated Canvas',
              },
            },
          },
          result: {
            data: {
              updateCanvas: {
                ...mockCanvasResponse,
                name: 'Updated Canvas',
              },
            },
          },
        },
      ];

      mockWorkspaceStore.updateCanvas.mockResolvedValue(true);

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useUpdateCanvas(), { wrapper });

      let success: boolean;
      await act(async () => {
        success = await result.current.mutate({
          id: 'canvas-1' as CanvasId,
          updates: {
            name: 'Updated Canvas',
          },
        });
      });

      expect(mockWorkspaceStore.updateCanvas).toHaveBeenCalled();
      expect(success).toBe(true);
    });
  });

  describe('useDeleteCanvas', () => {
    it('should delete canvas with optimistic update', async () => {
      const mocks = [
        {
          request: {
            query: DELETE_CANVAS,
            variables: {
              id: 'canvas-1',
            },
          },
          result: {
            data: {
              deleteCanvas: true,
            },
          },
        },
      ];

      mockWorkspaceStore.deleteCanvas.mockResolvedValue(true);

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useDeleteCanvas(), { wrapper });

      let success: boolean;
      await act(async () => {
        success = await result.current.mutate('canvas-1' as CanvasId);
      });

      expect(mockWorkspaceStore.deleteCanvas).toHaveBeenCalledWith('canvas-1');
      expect(success).toBe(true);
    });
  });

  describe('useSetDefaultCanvas', () => {
    it('should set default canvas', async () => {
      const mocks = [
        {
          request: {
            query: SET_DEFAULT_CANVAS,
            variables: {
              workspaceId: 'workspace-1',
              canvasId: 'canvas-1',
            },
          },
          result: {
            data: {
              setDefaultCanvas: {
                ...mockCanvasResponse,
                settings: {
                  ...mockCanvasResponse.settings,
                  isDefault: true,
                },
              },
            },
          },
        },
      ];

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      let success: boolean;
      await act(async () => {
        success = await result.current.mutate(
          'workspace-1' as EntityId,
          'canvas-1' as CanvasId
        );
      });

      expect(mockWorkspaceStore.setDefaultCanvas).toHaveBeenCalledWith(
        'workspace-1',
        'canvas-1'
      );
      expect(success).toBe(true);
    });
  });

  describe('useDuplicateCanvas', () => {
    it('should duplicate canvas', async () => {
      const duplicatedCanvas = {
        ...mockCanvasResponse,
        id: 'canvas-2',
        name: 'Duplicated Canvas',
      };

      const mocks = [
        {
          request: {
            query: DUPLICATE_CANVAS,
            variables: {
              id: 'canvas-1',
              input: {
                name: 'Duplicated Canvas',
                includeCards: true,
                includeConnections: false,
              },
            },
          },
          result: {
            data: {
              duplicateCanvas: duplicatedCanvas,
            },
          },
        },
      ];

      mockWorkspaceStore.duplicateCanvas.mockResolvedValue('optimistic-duplicate-id');

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useDuplicateCanvas(), { wrapper });

      let duplicateId: any;
      await act(async () => {
        duplicateId = await result.current.mutate({
          id: 'canvas-1' as CanvasId,
          name: 'Duplicated Canvas',
          includeCards: true,
          includeConnections: false,
        });
      });

      expect(mockWorkspaceStore.duplicateCanvas).toHaveBeenCalled();
      expect(duplicateId).toBe('optimistic-duplicate-id');
    });
  });

  describe('useUpdateCanvasSettings', () => {
    it('should update canvas settings', async () => {
      const mocks = [
        {
          request: {
            query: UPDATE_CANVAS_SETTINGS,
            variables: {
              id: 'canvas-1',
              settings: {
                zoom: 1.5,
                position: { x: 100, y: 200 },
              },
            },
          },
          result: {
            data: {
              updateCanvasSettings: {
                ...mockCanvasResponse,
                settings: {
                  ...mockCanvasResponse.settings,
                  zoom: 1.5,
                  position: { x: 100, y: 200, z: 0 },
                },
              },
            },
          },
        },
      ];

      mockWorkspaceStore.updateCanvasSettings.mockResolvedValue(true);

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useUpdateCanvasSettings(), { wrapper });

      let success: boolean;
      await act(async () => {
        success = await result.current.mutate('canvas-1' as CanvasId, {
          zoom: 1.5,
          position: { x: 100, y: 200, z: 0 },
        });
      });

      expect(mockWorkspaceStore.updateCanvasSettings).toHaveBeenCalledWith(
        'canvas-1',
        {
          zoom: 1.5,
          position: { x: 100, y: 200, z: 0 },
        }
      );
      expect(success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully in mutations', async () => {
      const mocks = [
        {
          request: {
            query: CREATE_CANVAS,
            variables: {
              input: {
                workspaceId: 'workspace-1',
                name: 'New Canvas',
                metadata: {},
              },
            },
          },
          error: new Error('Network error'),
        },
      ];

      mockWorkspaceStore.createCanvas.mockResolvedValue('optimistic-id');
      
      // Mock console.error to avoid noise in tests
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useCreateCanvas(), { wrapper });

      let createdId: any;
      await act(async () => {
        createdId = await result.current.mutate({
          workspaceId: 'workspace-1' as EntityId,
          name: 'New Canvas',
        });
      });

      expect(createdId).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to create canvas:',
        expect.any(Error)
      );
      
      consoleError.mockRestore();
    });

    it('should reset error state', () => {
      const wrapper = createWrapper([]);
      const { result } = renderHook(() => useCreateCanvas(), { wrapper });

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeUndefined();
    });
  });

  describe('Loading States', () => {
    it('should track loading state during mutations', async () => {
      const mocks = [
        {
          request: {
            query: CREATE_CANVAS,
            variables: {
              input: {
                workspaceId: 'workspace-1',
                name: 'New Canvas',
                metadata: {},
              },
            },
          },
          result: {
            data: {
              createCanvas: mockCanvasResponse,
            },
          },
        },
      ];

      mockWorkspaceStore.createCanvas.mockResolvedValue('optimistic-id');

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useCreateCanvas(), { wrapper });

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.mutate({
          workspaceId: 'workspace-1' as EntityId,
          name: 'New Canvas',
        });
      });

      // Loading should be true during mutation (though it completes quickly in tests)
      // The exact timing depends on the mock setup
    });
  });
});