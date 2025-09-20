/**
 * Comprehensive tests for canvas hooks (NEX-187)
 * Tests the useSetDefaultCanvas hook with focus on bug fixes:
 * - Apollo cache updates and rollback scenarios
 * - Optimistic updates and error handling
 * - State restoration on failure
 * - Real-time subscription integration
 */

import { renderHook, act } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { ReactNode } from 'react';
import { useSetDefaultCanvas } from '../use-canvas';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { SET_DEFAULT_CANVAS, GET_WORKSPACE_CANVASES } from '@/lib/graphql/canvasOperations';
import { createCanvasId } from '@/types/workspace.types';
import type { Canvas, CanvasId } from '@/types/workspace.types';
import type { EntityId } from '@/types/common.types';

// Mock the workspace store
const mockWorkspaceStore = {
  canvasManagement: {
    canvases: new Map<CanvasId, Canvas>(),
    defaultCanvasId: undefined as CanvasId | undefined,
  },
  setDefaultCanvas: jest.fn(),
  getCanvas: jest.fn(),
  syncCanvasWithBackend: jest.fn(),
};

jest.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => mockWorkspaceStore,
}));

// Mock Apollo Client
const mockApolloClient = {
  cache: {
    readQuery: jest.fn(),
    writeQuery: jest.fn(),
    writeFragment: jest.fn(),
    identify: jest.fn(),
  },
};

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useApolloClient: () => mockApolloClient,
}));

describe('useSetDefaultCanvas Hook (NEX-187)', () => {
  const testWorkspaceId = 'test-workspace-123' as EntityId;
  const testCanvasId = createCanvasId('canvas-123');
  const otherCanvasId = createCanvasId('canvas-456');

  const createMockCanvas = (id: CanvasId, isDefault = false): Canvas => ({
    id,
    workspaceId: testWorkspaceId,
    name: `Canvas ${id}`,
    description: undefined,
    settings: {
      isDefault,
      position: { x: 0, y: 0, z: 0 },
      zoom: 1.0,
      grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
      background: { type: 'COLOR', color: '#ffffff', opacity: 1.0 },
    },
    status: 'active',
    priority: 'normal',
    tags: [],
    metadata: {},
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    version: 1,
  });

  const createSuccessfulMock = (canvasId: CanvasId) => ({
    request: {
      query: SET_DEFAULT_CANVAS,
      variables: { id: canvasId },
    },
    result: {
      data: {
        setDefaultCanvas: {
          id: canvasId,
          workspaceId: testWorkspaceId,
          name: `Canvas ${canvasId}`,
          description: undefined,
          isDefault: true,
          position: 0,
          createdBy: 'test-user',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T12:00:00Z',
        },
      },
    },
  });

  const createErrorMock = (canvasId: CanvasId, error: Error) => ({
    request: {
      query: SET_DEFAULT_CANVAS,
      variables: { id: canvasId },
    },
    error,
  });

  const createWrapper = (mocks: any[] = []) => {
    return ({ children }: { children: ReactNode }) => (
      <MockedProvider mocks={mocks} addTypename={false}>
        {children}
      </MockedProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkspaceStore.canvasManagement.canvases.clear();
    mockWorkspaceStore.canvasManagement.defaultCanvasId = undefined;

    // Reset Apollo client mock methods
    mockApolloClient.cache.readQuery.mockClear();
    mockApolloClient.cache.writeQuery.mockClear();
    mockApolloClient.cache.writeFragment.mockClear();
    mockApolloClient.cache.identify.mockClear();
  });

  describe('Successful Operations', () => {
    it('should handle successful default canvas setting with optimistic updates', async () => {
      // Setup initial canvases
      const canvas1 = createMockCanvas(testCanvasId, false);
      const canvas2 = createMockCanvas(otherCanvasId, true); // Currently default

      mockWorkspaceStore.canvasManagement.canvases.set(testCanvasId, canvas1);
      mockWorkspaceStore.canvasManagement.canvases.set(otherCanvasId, canvas2);
      mockWorkspaceStore.canvasManagement.defaultCanvasId = otherCanvasId;

      const mocks = [createSuccessfulMock(testCanvasId)];
      const wrapper = createWrapper(mocks);

      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      // Simulate successful operation
      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      await act(async () => {
        const success = await result.current.mutate(testWorkspaceId, testCanvasId);
        expect(success).toBe(true);
      });

      // Verify optimistic update was called
      expect(mockWorkspaceStore.setDefaultCanvas).toHaveBeenCalledWith(testWorkspaceId, testCanvasId);

      // Verify store synchronization after successful mutation
      expect(mockWorkspaceStore.canvasManagement.canvases.set).toHaveBeenCalledWith(
        testCanvasId,
        expect.objectContaining({
          id: testCanvasId,
          settings: expect.objectContaining({ isDefault: true }),
        })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it('should update Apollo cache correctly with atomic canvas updates', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      const canvas2 = createMockCanvas(otherCanvasId, true);

      mockWorkspaceStore.canvasManagement.canvases.set(testCanvasId, canvas1);
      mockWorkspaceStore.canvasManagement.canvases.set(otherCanvasId, canvas2);

      // Mock cache data
      const mockCacheData = {
        workspaceCanvases: {
          items: [
            {
              id: testCanvasId,
              workspaceId: testWorkspaceId,
              name: 'Canvas 1',
              isDefault: false,
              updatedAt: '2023-01-01T00:00:00Z',
            },
            {
              id: otherCanvasId,
              workspaceId: testWorkspaceId,
              name: 'Canvas 2',
              isDefault: true,
              updatedAt: '2023-01-01T00:00:00Z',
            },
          ],
          hasNextPage: false,
          page: 0,
          limit: 100,
        },
      };

      mockApolloClient.cache.readQuery.mockReturnValue(mockCacheData);
      mockApolloClient.cache.identify.mockImplementation((obj) => `Canvas:${obj.id}`);

      const mocks = [createSuccessfulMock(testCanvasId)];
      const wrapper = createWrapper(mocks);

      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      await act(async () => {
        await result.current.mutate(testWorkspaceId, testCanvasId);
      });

      // Verify cache was read
      expect(mockApolloClient.cache.readQuery).toHaveBeenCalledWith({
        query: GET_WORKSPACE_CANVASES,
        variables: { workspaceId: testWorkspaceId },
      });

      // Verify cache was updated with atomic changes
      expect(mockApolloClient.cache.writeQuery).toHaveBeenCalledWith({
        query: GET_WORKSPACE_CANVASES,
        variables: { workspaceId: testWorkspaceId },
        data: {
          workspaceCanvases: {
            ...mockCacheData.workspaceCanvases,
            items: [
              expect.objectContaining({
                id: testCanvasId,
                isDefault: true,
              }),
              expect.objectContaining({
                id: otherCanvasId,
                isDefault: false,
              }),
            ],
          },
        },
      });

      // Verify individual cache fragments were updated
      expect(mockApolloClient.cache.writeFragment).toHaveBeenCalledWith({
        id: `Canvas:${testCanvasId}`,
        fragment: expect.any(Object),
        data: {
          isDefault: true,
          updatedAt: expect.any(String),
        },
      });

      expect(mockApolloClient.cache.writeFragment).toHaveBeenCalledWith({
        id: `Canvas:${otherCanvasId}`,
        fragment: expect.any(Object),
        data: {
          isDefault: false,
          updatedAt: expect.any(String),
        },
      });
    });

    it('should handle cache not in memory gracefully', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      mockWorkspaceStore.canvasManagement.canvases.set(testCanvasId, canvas1);

      // Mock cache not having the query
      mockApolloClient.cache.readQuery.mockImplementation(() => {
        throw new Error('Query not in cache');
      });

      const mocks = [createSuccessfulMock(testCanvasId)];
      const wrapper = createWrapper(mocks);

      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      // Should not throw error when cache is not available
      await act(async () => {
        const success = await result.current.mutate(testWorkspaceId, testCanvasId);
        expect(success).toBe(true);
      });

      // Verify operation continued successfully despite cache miss
      expect(mockWorkspaceStore.setDefaultCanvas).toHaveBeenCalled();
      expect(result.current.error).toBeUndefined();
    });
  });

  describe('Error Handling and Rollback', () => {
    it('should rollback optimistic updates on mutation failure', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      const canvas2 = createMockCanvas(otherCanvasId, true);

      // Store initial state
      const initialCanvases = new Map([
        [testCanvasId, canvas1],
        [otherCanvasId, canvas2],
      ]);
      const initialDefaultCanvasId = otherCanvasId;

      mockWorkspaceStore.canvasManagement.canvases = new Map(initialCanvases);
      mockWorkspaceStore.canvasManagement.defaultCanvasId = initialDefaultCanvasId;

      const error = new Error('Server error: Failed to set default canvas');
      const mocks = [createErrorMock(testCanvasId, error)];
      const wrapper = createWrapper(mocks);

      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      // Mock optimistic update success but mutation failure
      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      await act(async () => {
        const success = await result.current.mutate(testWorkspaceId, testCanvasId);
        expect(success).toBe(false);
      });

      // Verify optimistic update was attempted
      expect(mockWorkspaceStore.setDefaultCanvas).toHaveBeenCalledWith(testWorkspaceId, testCanvasId);

      // Verify state was rolled back
      expect(mockWorkspaceStore.canvasManagement.canvases).toEqual(initialCanvases);
      expect(mockWorkspaceStore.canvasManagement.defaultCanvasId).toBe(initialDefaultCanvasId);

      // Verify error is exposed
      expect(result.current.error).toBe(error.message);
    });

    it('should handle optimistic update failure', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      mockWorkspaceStore.canvasManagement.canvases.set(testCanvasId, canvas1);

      // Mock optimistic update failure
      const optimisticError = new Error('Optimistic update failed');
      mockWorkspaceStore.setDefaultCanvas.mockRejectedValue(optimisticError);

      const mocks = [createSuccessfulMock(testCanvasId)]; // Server would succeed
      const wrapper = createWrapper(mocks);

      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      await act(async () => {
        const success = await result.current.mutate(testWorkspaceId, testCanvasId);
        expect(success).toBe(false);
      });

      // Should fail early without attempting server mutation
      expect(mockWorkspaceStore.setDefaultCanvas).toHaveBeenCalledWith(testWorkspaceId, testCanvasId);
    });

    it('should handle server success but no data returned', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      const canvas2 = createMockCanvas(otherCanvasId, true);

      const initialCanvases = new Map([
        [testCanvasId, canvas1],
        [otherCanvasId, canvas2],
      ]);

      mockWorkspaceStore.canvasManagement.canvases = new Map(initialCanvases);
      mockWorkspaceStore.canvasManagement.defaultCanvasId = otherCanvasId;

      // Mock successful mutation but no data returned
      const mocks = [{
        request: {
          query: SET_DEFAULT_CANVAS,
          variables: { id: testCanvasId },
        },
        result: {
          data: { setDefaultCanvas: null },
        },
      }];

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      await act(async () => {
        const success = await result.current.mutate(testWorkspaceId, testCanvasId);
        expect(success).toBe(false);
      });

      // Verify rollback occurred
      expect(mockWorkspaceStore.canvasManagement.canvases).toEqual(initialCanvases);
      expect(mockWorkspaceStore.canvasManagement.defaultCanvasId).toBe(otherCanvasId);
    });

    it('should handle cache update failure gracefully', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      mockWorkspaceStore.canvasManagement.canvases.set(testCanvasId, canvas1);

      // Mock cache operations to throw errors
      mockApolloClient.cache.readQuery.mockImplementation(() => {
        throw new Error('Cache read failed');
      });

      const mocks = [createSuccessfulMock(testCanvasId)];
      const wrapper = createWrapper(mocks);

      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      // Should not fail the mutation due to cache errors
      await act(async () => {
        const success = await result.current.mutate(testWorkspaceId, testCanvasId);
        expect(success).toBe(true);
      });

      // Verify operation succeeded despite cache issues
      expect(result.current.error).toBeUndefined();
      expect(mockWorkspaceStore.setDefaultCanvas).toHaveBeenCalled();
    });
  });

  describe('State Synchronization', () => {
    it('should ensure only one canvas is marked as default after operation', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      const canvas2 = createMockCanvas(otherCanvasId, true);
      const canvas3 = createMockCanvas(createCanvasId('canvas-789'), true); // Another default (bug scenario)

      mockWorkspaceStore.canvasManagement.canvases.set(testCanvasId, canvas1);
      mockWorkspaceStore.canvasManagement.canvases.set(otherCanvasId, canvas2);
      mockWorkspaceStore.canvasManagement.canvases.set(canvas3.id, canvas3);

      const mocks = [createSuccessfulMock(testCanvasId)];
      const wrapper = createWrapper(mocks);

      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      // Mock the forEach method to track calls
      const mockForEach = jest.fn();
      mockWorkspaceStore.canvasManagement.canvases.forEach = mockForEach;

      await act(async () => {
        await result.current.mutate(testWorkspaceId, testCanvasId);
      });

      // Verify the forEach was called to update other canvases
      expect(mockForEach).toHaveBeenCalled();

      // Verify the store was updated to set the correct default
      expect(mockWorkspaceStore.canvasManagement.defaultCanvasId).toBe(testCanvasId);
    });

    it('should handle version incrementing correctly', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      const canvas2 = createMockCanvas(otherCanvasId, true);

      canvas1.version = 5;
      canvas2.version = 3;

      mockWorkspaceStore.canvasManagement.canvases.set(testCanvasId, canvas1);
      mockWorkspaceStore.canvasManagement.canvases.set(otherCanvasId, canvas2);

      const mocks = [createSuccessfulMock(testCanvasId)];
      const wrapper = createWrapper(mocks);

      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      // Mock canvases.set to track version updates
      const mockSet = jest.fn();
      mockWorkspaceStore.canvasManagement.canvases.set = mockSet;

      await act(async () => {
        await result.current.mutate(testWorkspaceId, testCanvasId);
      });

      // Verify other canvases had their versions incremented
      expect(mockSet).toHaveBeenCalledWith(
        otherCanvasId,
        expect.objectContaining({
          version: 4, // canvas2.version + 1
          settings: expect.objectContaining({ isDefault: false }),
        })
      );
    });
  });

  describe('Hook State Management', () => {
    it('should track loading state correctly', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      mockWorkspaceStore.canvasManagement.canvases.set(testCanvasId, canvas1);

      // Create a mock that will resolve after a delay
      const mocks = [{
        request: {
          query: SET_DEFAULT_CANVAS,
          variables: { id: testCanvasId },
        },
        delay: 100,
        result: {
          data: {
            setDefaultCanvas: {
              id: testCanvasId,
              workspaceId: testWorkspaceId,
              name: 'Canvas 1',
              isDefault: true,
              updatedAt: '2023-01-01T12:00:00Z',
            },
          },
        },
      }];

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      expect(result.current.loading).toBe(false);

      // Start mutation
      act(() => {
        result.current.mutate(testWorkspaceId, testCanvasId);
      });

      expect(result.current.loading).toBe(true);

      // Wait for completion
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.loading).toBe(false);
    });

    it('should provide reset functionality', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      mockWorkspaceStore.canvasManagement.canvases.set(testCanvasId, canvas1);

      const error = new Error('Test error');
      const mocks = [createErrorMock(testCanvasId, error)];
      const wrapper = createWrapper(mocks);

      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      // Trigger error
      await act(async () => {
        await result.current.mutate(testWorkspaceId, testCanvasId);
      });

      expect(result.current.error).toBe(error.message);

      // Reset error state
      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty workspace gracefully', async () => {
      // No canvases in workspace
      const wrapper = createWrapper([]);
      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      await act(async () => {
        const success = await result.current.mutate(testWorkspaceId, testCanvasId);
        expect(success).toBe(false);
      });

      // Should attempt optimistic update even with empty workspace
      expect(mockWorkspaceStore.setDefaultCanvas).toHaveBeenCalledWith(testWorkspaceId, testCanvasId);
    });

    it('should handle concurrent mutations correctly', async () => {
      const canvas1 = createMockCanvas(testCanvasId, false);
      const canvas2 = createMockCanvas(otherCanvasId, false);

      mockWorkspaceStore.canvasManagement.canvases.set(testCanvasId, canvas1);
      mockWorkspaceStore.canvasManagement.canvases.set(otherCanvasId, canvas2);

      const mocks = [
        createSuccessfulMock(testCanvasId),
        createSuccessfulMock(otherCanvasId),
      ];

      const wrapper = createWrapper(mocks);
      const { result } = renderHook(() => useSetDefaultCanvas(), { wrapper });

      mockWorkspaceStore.setDefaultCanvas.mockResolvedValue(true);

      // Start two concurrent mutations
      const promise1 = act(async () => {
        return result.current.mutate(testWorkspaceId, testCanvasId);
      });

      const promise2 = act(async () => {
        return result.current.mutate(testWorkspaceId, otherCanvasId);
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should attempt to complete, behavior depends on server/store implementation
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(mockWorkspaceStore.setDefaultCanvas).toHaveBeenCalledTimes(2);
    });
  });
});