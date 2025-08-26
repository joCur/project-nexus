/**
 * Canvas Operations Hooks
 * 
 * Integrates GraphQL canvas operations with the workspace store, providing 
 * real-time synchronization, optimistic updates, and server persistence.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { 
  useQuery, 
  useMutation, 
  useSubscription,
  useApolloClient 
} from '@apollo/client';
import {
  GET_WORKSPACE_CANVASES,
  GET_CANVAS,
  GET_DEFAULT_CANVAS,
  SEARCH_CANVASES,
  CREATE_CANVAS,
  UPDATE_CANVAS,
  DELETE_CANVAS,
  SET_DEFAULT_CANVAS,
  DUPLICATE_CANVAS,
  CANVAS_CREATED_SUBSCRIPTION,
  CANVAS_UPDATED_SUBSCRIPTION,
  CANVAS_DELETED_SUBSCRIPTION,
  DEFAULT_CANVAS_CHANGED_SUBSCRIPTION,
  type CanvasResponse,
  type CanvasesConnectionResponse,
  type WorkspaceCanvasesQueryVariables,
  type CreateCanvasMutationVariables,
  type UpdateCanvasMutationVariables,
  type DuplicateCanvasMutationVariables,
} from '@/lib/graphql/canvasOperations';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { 
  Canvas, 
  CanvasId, 
  CreateCanvasParams, 
  UpdateCanvasParams,
  DuplicateCanvasParams,
  CanvasFilter,
  CanvasSettings,
  UseCanvasesReturn,
  UseCanvasReturn,
  UseCanvasMutationReturn,
} from '@/types/workspace.types';
import { createCanvasId } from '@/types/workspace.types';
import type { EntityId } from '@/types/common.types';
import type { CanvasPosition } from '@/types/canvas.types';

/**
 * Transform backend GraphQL response to frontend Canvas type
 * Handles case conversion and type alignment
 */
const transformBackendCanvasToFrontend = (backendCanvas: CanvasResponse): Canvas => {
  return {
    id: createCanvasId(backendCanvas.id),
    workspaceId: backendCanvas.workspaceId as EntityId,
    name: backendCanvas.name,
    description: backendCanvas.description,
    settings: {
      isDefault: backendCanvas.isDefault,
      position: { x: 0, y: 0, z: 0 }, // Default position since backend doesn't store viewport
      zoom: 1.0, // Default zoom
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
    status: 'active', // Default from backend
    priority: 'normal', // Default from backend
    tags: [], // Will be added when backend supports it
    metadata: {}, // Default metadata
    createdAt: backendCanvas.createdAt,
    updatedAt: backendCanvas.updatedAt,
    version: 1, // Default version since backend doesn't have this field yet
  };
};

/**
 * Transform frontend CreateCanvasParams to backend mutation input
 */
const transformCreateParamsToBackend = (params: CreateCanvasParams): CreateCanvasMutationVariables['input'] => {
  return {
    workspaceId: params.workspaceId,
    name: params.name,
    description: params.description,
    isDefault: params.settings?.isDefault || false,
    position: undefined, // Backend will auto-assign position
  };
};

/**
 * Hook for fetching workspace canvases
 */
export const useCanvases = (
  workspaceId: EntityId | undefined,
  filter?: CanvasFilter
): UseCanvasesReturn => {
  const workspaceStore = useWorkspaceStore();

  // Build GraphQL variables
  const variables: WorkspaceCanvasesQueryVariables | undefined = workspaceId ? {
    workspaceId,
    filter: filter ? {
      isDefault: filter.isDefault,
      searchQuery: filter.searchQuery,
      createdDateRange: filter.createdDateRange,
      updatedDateRange: filter.updatedDateRange,
    } : undefined,
  } : undefined;

  const {
    data,
    loading,
    error,
    refetch: apolloRefetch,
    fetchMore,
  } = useQuery<{ workspaceCanvases: CanvasesConnectionResponse }>(GET_WORKSPACE_CANVASES, {
    variables,
    skip: !workspaceId,
    fetchPolicy: 'cache-and-network',
    onCompleted: (data) => {
      // Sync to workspace store
      if (data.workspaceCanvases?.items) {
        data.workspaceCanvases.items.forEach(canvasResponse => {
          const canvas = transformBackendCanvasToFrontend(canvasResponse);
          const existingCanvas = workspaceStore.getCanvas(canvas.id);
          
          if (!existingCanvas || existingCanvas.version < canvas.version) {
            workspaceStore.canvasManagement.canvases.set(canvas.id, canvas);
          }
        });
      }
    },
  });

  const refetch = useCallback(async () => {
    if (workspaceId) {
      await apolloRefetch();
    }
  }, [apolloRefetch, workspaceId]);

  const loadMore = useCallback(async () => {
    if (data?.workspaceCanvases?.hasNextPage && fetchMore) {
      await fetchMore({
        variables: {
          ...variables,
          pagination: {
            page: (data.workspaceCanvases.page || 0) + 1,
            limit: data.workspaceCanvases.limit,
          },
        },
      });
    }
  }, [data, fetchMore, variables]);

  const canvases = useMemo(() => {
    // Prefer store data for real-time updates
    return workspaceStore.canvasManagement.canvases.size > 0
      ? Array.from(workspaceStore.canvasManagement.canvases.values())
      : (data?.workspaceCanvases?.items || []).map(transformBackendCanvasToFrontend);
  }, [workspaceStore.canvasManagement.canvases, data]);

  return {
    canvases,
    loading,
    error: error?.message,
    refetch,
    hasMore: data?.workspaceCanvases?.hasNextPage || false,
    loadMore,
  };
};

/**
 * Hook for fetching a single canvas
 */
export const useCanvas = (canvasId: CanvasId | undefined): UseCanvasReturn => {
  const workspaceStore = useWorkspaceStore();

  const { data, loading, error, refetch } = useQuery<{ canvas: CanvasResponse }>(GET_CANVAS, {
    variables: { id: canvasId },
    skip: !canvasId,
    fetchPolicy: 'cache-and-network',
    onCompleted: (data) => {
      if (data.canvas) {
        const canvas = transformBackendCanvasToFrontend(data.canvas);
        workspaceStore.canvasManagement.canvases.set(canvas.id, canvas);
      }
    },
  });

  const canvas = useMemo(() => {
    if (!canvasId) return undefined;
    
    // Prefer store data for real-time updates
    const storeCanvas = workspaceStore.getCanvas(canvasId);
    if (storeCanvas) return storeCanvas;
    
    return data?.canvas ? transformBackendCanvasToFrontend(data.canvas) : undefined;
  }, [canvasId, workspaceStore, data]);

  return {
    canvas,
    loading,
    error: error?.message,
    refetch: useCallback(async () => {
      await refetch();
    }, [refetch]),
  };
};

/**
 * Hook for creating canvases
 */
export const useCreateCanvas = (): UseCanvasMutationReturn => {
  const workspaceStore = useWorkspaceStore();
  const [createCanvasMutation, { loading, error, reset }] = useMutation(CREATE_CANVAS);

  const mutate = useCallback(async (params: CreateCanvasParams): Promise<CanvasId | null> => {
    try {
      // Optimistic update
      const optimisticCanvasId = await workspaceStore.createCanvas(params);
      
      // Server mutation
      const input = transformCreateParamsToBackend(params);
      const { data } = await createCanvasMutation({ variables: { input } });

      if (data?.createCanvas) {
        const serverCanvas = transformBackendCanvasToFrontend(data.createCanvas);
        
        // Replace optimistic canvas with server version
        if (optimisticCanvasId) {
          workspaceStore.canvasManagement.canvases.delete(optimisticCanvasId);
        }
        workspaceStore.canvasManagement.canvases.set(serverCanvas.id, serverCanvas);
        
        return serverCanvas.id;
      }

      return optimisticCanvasId;
    } catch (err) {
      console.error('Failed to create canvas:', err);
      return null;
    }
  }, [workspaceStore, createCanvasMutation]);

  return {
    mutate,
    loading,
    error: error?.message,
    reset,
  };
};

/**
 * Hook for updating canvases
 */
export const useUpdateCanvas = (): UseCanvasMutationReturn => {
  const workspaceStore = useWorkspaceStore();
  const [updateCanvasMutation, { loading, error, reset }] = useMutation(UPDATE_CANVAS);

  const mutate = useCallback(async (params: UpdateCanvasParams): Promise<boolean> => {
    try {
      // Optimistic update
      await workspaceStore.updateCanvas(params);

      // Server mutation
      const { data } = await updateCanvasMutation({ 
        variables: { 
          id: params.id, 
          input: params.updates,
        } 
      });

      if (data?.updateCanvas) {
        const serverCanvas = transformBackendCanvasToFrontend(data.updateCanvas);
        workspaceStore.canvasManagement.canvases.set(serverCanvas.id, serverCanvas);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Failed to update canvas:', err);
      // TODO: Revert optimistic update
      return false;
    }
  }, [workspaceStore, updateCanvasMutation]);

  return {
    mutate,
    loading,
    error: error?.message,
    reset,
  };
};

/**
 * Hook for deleting canvases
 */
export const useDeleteCanvas = (): UseCanvasMutationReturn => {
  const workspaceStore = useWorkspaceStore();
  const [deleteCanvasMutation, { loading, error, reset }] = useMutation(DELETE_CANVAS);

  const mutate = useCallback(async (canvasId: CanvasId): Promise<boolean> => {
    try {
      // Store current canvas for potential rollback
      const canvasToDelete = workspaceStore.getCanvas(canvasId);
      
      // Optimistic delete
      await workspaceStore.deleteCanvas(canvasId);

      // Server mutation
      const { data } = await deleteCanvasMutation({ variables: { id: canvasId } });

      if (data?.deleteCanvas) {
        return true;
      } else {
        // Rollback on failure
        if (canvasToDelete) {
          workspaceStore.canvasManagement.canvases.set(canvasId, canvasToDelete);
        }
        return false;
      }
    } catch (err) {
      console.error('Failed to delete canvas:', err);
      // TODO: Revert optimistic delete
      return false;
    }
  }, [workspaceStore, deleteCanvasMutation]);

  return {
    mutate,
    loading,
    error: error?.message,
    reset,
  };
};

/**
 * Hook for setting default canvas
 */
export const useSetDefaultCanvas = (): UseCanvasMutationReturn => {
  const workspaceStore = useWorkspaceStore();
  const [setDefaultCanvasMutation, { loading, error, reset }] = useMutation(SET_DEFAULT_CANVAS);

  const mutate = useCallback(async (workspaceId: EntityId, canvasId: CanvasId): Promise<boolean> => {
    try {
      // Optimistic update
      await workspaceStore.setDefaultCanvas(workspaceId, canvasId);

      // Server mutation
      const { data } = await setDefaultCanvasMutation({ 
        variables: { workspaceId, canvasId } 
      });

      if (data?.setDefaultCanvas) {
        const updatedCanvas = transformBackendCanvasToFrontend(data.setDefaultCanvas);
        workspaceStore.canvasManagement.canvases.set(updatedCanvas.id, updatedCanvas);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Failed to set default canvas:', err);
      // TODO: Revert optimistic update
      return false;
    }
  }, [workspaceStore, setDefaultCanvasMutation]);

  return {
    mutate,
    loading,
    error: error?.message,
    reset,
  };
};

/**
 * Hook for duplicating canvases
 */
export const useDuplicateCanvas = (): UseCanvasMutationReturn => {
  const workspaceStore = useWorkspaceStore();
  const [duplicateCanvasMutation, { loading, error, reset }] = useMutation(DUPLICATE_CANVAS);

  const mutate = useCallback(async (params: DuplicateCanvasParams): Promise<CanvasId | null> => {
    try {
      // Optimistic update
      const optimisticCanvasId = await workspaceStore.duplicateCanvas(params);

      // Server mutation
      const input: DuplicateCanvasMutationVariables['input'] = {
        name: params.name,
        description: params.description,
        includeCards: params.includeCards,
        includeConnections: params.includeConnections,
      };
      
      const { data } = await duplicateCanvasMutation({ 
        variables: { id: params.id, input } 
      });

      if (data?.duplicateCanvas) {
        const serverCanvas = transformBackendCanvasToFrontend(data.duplicateCanvas);
        
        // Replace optimistic canvas with server version
        if (optimisticCanvasId) {
          workspaceStore.canvasManagement.canvases.delete(optimisticCanvasId);
        }
        workspaceStore.canvasManagement.canvases.set(serverCanvas.id, serverCanvas);
        
        return serverCanvas.id;
      }

      return optimisticCanvasId;
    } catch (err) {
      console.error('Failed to duplicate canvas:', err);
      return null;
    }
  }, [workspaceStore, duplicateCanvasMutation]);

  return {
    mutate,
    loading,
    error: error?.message,
    reset,
  };
};

// Note: Canvas settings hooks will be added when backend supports them

/**
 * Hook for real-time canvas subscriptions
 */
export const useCanvasSubscriptions = (workspaceId: EntityId | undefined) => {
  const workspaceStore = useWorkspaceStore();

  // Subscribe to canvas created events
  useSubscription(CANVAS_CREATED_SUBSCRIPTION, {
    variables: { workspaceId },
    skip: !workspaceId,
    onData: ({ data }) => {
      if (data?.data?.canvasCreated) {
        const canvas = transformBackendCanvasToFrontend(data.data.canvasCreated);
        workspaceStore.canvasManagement.canvases.set(canvas.id, canvas);
      }
    },
  });

  // Subscribe to canvas updated events
  useSubscription(CANVAS_UPDATED_SUBSCRIPTION, {
    variables: { workspaceId },
    skip: !workspaceId,
    onData: ({ data }) => {
      if (data?.data?.canvasUpdated) {
        const canvas = transformBackendCanvasToFrontend(data.data.canvasUpdated);
        workspaceStore.canvasManagement.canvases.set(canvas.id, canvas);
      }
    },
  });

  // Subscribe to canvas deleted events
  useSubscription(CANVAS_DELETED_SUBSCRIPTION, {
    variables: { workspaceId },
    skip: !workspaceId,
    onData: ({ data }) => {
      if (data?.data?.canvasDeleted) {
        const canvasId = createCanvasId(data.data.canvasDeleted);
        workspaceStore.canvasManagement.canvases.delete(canvasId);
        
        // Clear current canvas if deleted
        if (workspaceStore.context.currentCanvasId === canvasId) {
          workspaceStore.setCurrentCanvas(
            workspaceStore.getDefaultCanvas()?.id || createCanvasId(''),
            workspaceStore.getDefaultCanvas()?.name
          );
        }
      }
    },
  });

  // Subscribe to default canvas changes
  useSubscription(DEFAULT_CANVAS_CHANGED_SUBSCRIPTION, {
    variables: { workspaceId },
    skip: !workspaceId,
    onData: ({ data }) => {
      if (data?.data?.defaultCanvasChanged && workspaceId) {
        const newDefaultId = createCanvasId(data.data.defaultCanvasChanged);
        workspaceStore.canvasManagement.defaultCanvasId = newDefaultId;
      }
    },
  });
};

// Note: Canvas settings sync hooks will be added when backend supports them

// Export all hooks
export {
  transformBackendCanvasToFrontend,
  transformCreateParamsToBackend,
};