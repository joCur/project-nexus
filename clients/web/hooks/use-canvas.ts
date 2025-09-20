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
  useApolloClient,
  gql
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
    let optimisticCanvasId: CanvasId | null = null;

    try {
      // Optimistic update
      optimisticCanvasId = await workspaceStore.createCanvas(params);

      // Server mutation
      const input = transformCreateParamsToBackend(params);
      const { data } = await createCanvasMutation({ variables: { input } });

      if (data?.createCanvas) {
        const serverCanvas = transformBackendCanvasToFrontend(data.createCanvas);

        // Replace optimistic canvas with server version
        if (optimisticCanvasId) {
          workspaceStore.canvasManagement.canvases.delete(optimisticCanvasId);
        }
        workspaceStore.syncCanvasWithBackend(serverCanvas);

        console.log('Canvas created successfully:', serverCanvas.id);
        return serverCanvas.id;
      }

      // If mutation succeeded but no data returned, clean up optimistic update
      if (optimisticCanvasId) {
        workspaceStore.canvasManagement.canvases.delete(optimisticCanvasId);
      }
      return null;
    } catch (err) {
      console.error('Failed to create canvas:', err);

      // Clean up optimistic update on error
      if (optimisticCanvasId) {
        workspaceStore.canvasManagement.canvases.delete(optimisticCanvasId);

        // Reset default canvas if the optimistic canvas was set as default
        if (workspaceStore.canvasManagement.defaultCanvasId === optimisticCanvasId) {
          workspaceStore.canvasManagement.defaultCanvasId = workspaceStore.getDefaultCanvas()?.id;
        }
      }

      workspaceStore.setError('mutation', `Failed to create canvas: ${err}`);
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
    // Store previous state for rollback
    const previousCanvas = workspaceStore.getCanvas(params.id);
    if (!previousCanvas) {
      console.error('Canvas not found for update:', params.id);
      return false;
    }

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
        workspaceStore.syncCanvasWithBackend(serverCanvas);
        return true;
      }

      // If mutation succeeded but no data returned, revert optimistic update
      workspaceStore.canvasManagement.canvases.set(params.id, previousCanvas);
      return false;
    } catch (err) {
      console.error('Failed to update canvas:', err);

      // Revert optimistic update on error
      workspaceStore.canvasManagement.canvases.set(params.id, previousCanvas);
      workspaceStore.setError('mutation', `Failed to update canvas: ${err}`);

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
    // Store current canvas and context for potential rollback
    const canvasToDelete = workspaceStore.getCanvas(canvasId);
    const previousContext = { ...workspaceStore.context };
    const previousDefaultCanvasId = workspaceStore.canvasManagement.defaultCanvasId;

    if (!canvasToDelete) {
      console.error('Canvas not found for deletion:', canvasId);
      return false;
    }

    try {
      // Optimistic delete
      await workspaceStore.deleteCanvas(canvasId);

      // Server mutation
      const { data } = await deleteCanvasMutation({ variables: { id: canvasId } });

      if (data?.deleteCanvas) {
        console.log('Canvas deleted successfully:', canvasId);
        return true;
      } else {
        // Rollback on server failure
        workspaceStore.canvasManagement.canvases.set(canvasId, canvasToDelete);

        // Restore default canvas ID if this was the default
        if (canvasToDelete.settings.isDefault) {
          workspaceStore.canvasManagement.defaultCanvasId = previousDefaultCanvasId;
        }

        // Restore context if this was the current canvas
        if (previousContext.currentCanvasId === canvasId) {
          workspaceStore.setCurrentCanvas(canvasId, canvasToDelete.name);
        }

        return false;
      }
    } catch (err) {
      console.error('Failed to delete canvas:', err);

      // Revert optimistic delete on error
      workspaceStore.canvasManagement.canvases.set(canvasId, canvasToDelete);

      // Restore default canvas ID if this was the default
      if (canvasToDelete.settings.isDefault) {
        workspaceStore.canvasManagement.defaultCanvasId = previousDefaultCanvasId;
      }

      // Restore context if this was the current canvas
      if (previousContext.currentCanvasId === canvasId) {
        workspaceStore.setCurrentCanvas(canvasId, canvasToDelete.name);
      }

      workspaceStore.setError('mutation', `Failed to delete canvas: ${err}`);
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
  const apolloClient = useApolloClient();
  const [setDefaultCanvasMutation, { loading, error, reset }] = useMutation(SET_DEFAULT_CANVAS);

  const mutate = useCallback(async (workspaceId: EntityId, canvasId: CanvasId): Promise<boolean> => {
    // Store previous state for rollback
    const previousCanvases = new Map(workspaceStore.canvasManagement.canvases);
    const previousDefaultCanvasId = workspaceStore.canvasManagement.defaultCanvasId;

    try {
      // Optimistic update
      await workspaceStore.setDefaultCanvas(workspaceId, canvasId);

      // Server mutation
      const { data } = await setDefaultCanvasMutation({
        variables: { id: canvasId },
        update: (cache, { data }) => {
          if (data?.setDefaultCanvas) {
            try {
              // Read all potential cache entries for workspace canvases
              let cacheData: { workspaceCanvases: CanvasesConnectionResponse } | null = null;
              try {
                cacheData = cache.readQuery<{ workspaceCanvases: CanvasesConnectionResponse }>({
                  query: GET_WORKSPACE_CANVASES,
                  variables: { workspaceId },
                });
              } catch (error) {
                // Query not in cache, skip cache update
                console.debug('Workspace canvases query not in cache, skipping cache update');
              }

              if (cacheData?.workspaceCanvases?.items) {
                // Update all canvases atomically: set new default to true, others to false
                const updatedItems = cacheData.workspaceCanvases.items.map(canvas => ({
                  ...canvas,
                  isDefault: canvas.id === canvasId,
                }));

                // Write the updated data back to cache
                cache.writeQuery({
                  query: GET_WORKSPACE_CANVASES,
                  variables: { workspaceId },
                  data: {
                    workspaceCanvases: {
                      ...cacheData.workspaceCanvases,
                      items: updatedItems,
                    },
                  },
                });
              }

              // Also update individual canvas cache entries if they exist
              const serverCanvas = data.setDefaultCanvas;
              cache.writeFragment({
                id: cache.identify({ __typename: 'Canvas', id: serverCanvas.id }),
                fragment: gql`
                  fragment UpdatedCanvasDefault on Canvas {
                    isDefault
                    updatedAt
                  }
                `,
                data: {
                  isDefault: true,
                  updatedAt: serverCanvas.updatedAt,
                },
              });

              // Update other default canvases in cache to false
              Array.from(previousCanvases.values()).forEach(canvas => {
                if (canvas.id !== canvasId && canvas.settings.isDefault) {
                  cache.writeFragment({
                    id: cache.identify({ __typename: 'Canvas', id: canvas.id }),
                    fragment: gql`
                      fragment RemovedCanvasDefault on Canvas {
                        isDefault
                        updatedAt
                      }
                    `,
                    data: {
                      isDefault: false,
                      updatedAt: new Date().toISOString(),
                    },
                  });
                }
              });
            } catch (cacheError) {
              console.warn('Failed to update Apollo cache for default canvas:', cacheError);
              // Cache update failure should not fail the mutation
            }
          }
        }
      });

      if (data?.setDefaultCanvas) {
        const serverCanvas = transformBackendCanvasToFrontend(data.setDefaultCanvas);

        // Ensure workspace store is in sync with server response
        // Set the server canvas as the canonical source
        workspaceStore.canvasManagement.canvases.set(serverCanvas.id, serverCanvas);
        workspaceStore.canvasManagement.defaultCanvasId = serverCanvas.id;

        // Ensure all other canvases are marked as non-default
        workspaceStore.canvasManagement.canvases.forEach((canvas, id) => {
          if (id !== canvasId && canvas.settings.isDefault) {
            workspaceStore.canvasManagement.canvases.set(id, {
              ...canvas,
              settings: { ...canvas.settings, isDefault: false },
              updatedAt: new Date().toISOString(),
              version: canvas.version + 1,
            });
          }
        });

        return true;
      }

      // If mutation succeeded but no data returned, revert optimistic update
      workspaceStore.canvasManagement.canvases = previousCanvases;
      workspaceStore.canvasManagement.defaultCanvasId = previousDefaultCanvasId;
      return false;
    } catch (err) {
      console.error('Failed to set default canvas:', err);

      // Revert optimistic update on error
      workspaceStore.canvasManagement.canvases = previousCanvases;
      workspaceStore.canvasManagement.defaultCanvasId = previousDefaultCanvasId;

      return false;
    }
  }, [workspaceStore, setDefaultCanvasMutation, apolloClient]);

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
    // Verify source canvas exists
    const sourceCanvas = workspaceStore.getCanvas(params.id);
    if (!sourceCanvas) {
      console.error('Source canvas not found for duplication:', params.id);
      workspaceStore.setError('mutation', 'Source canvas not found for duplication');
      return null;
    }

    let optimisticCanvasId: CanvasId | null = null;

    try {
      // Optimistic update
      optimisticCanvasId = await workspaceStore.duplicateCanvas(params);

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
        workspaceStore.syncCanvasWithBackend(serverCanvas);

        console.log('Canvas duplicated successfully:', serverCanvas.id);
        return serverCanvas.id;
      }

      // If mutation succeeded but no data returned, clean up optimistic update
      if (optimisticCanvasId) {
        workspaceStore.canvasManagement.canvases.delete(optimisticCanvasId);
      }
      return null;
    } catch (err) {
      console.error('Failed to duplicate canvas:', err);

      // Clean up optimistic update on error
      if (optimisticCanvasId) {
        workspaceStore.canvasManagement.canvases.delete(optimisticCanvasId);
      }

      workspaceStore.setError('mutation', `Failed to duplicate canvas: ${err}`);
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
        workspaceStore.syncCanvasWithBackend(canvas);
        console.log('Canvas created via subscription:', canvas.id);
      }
    },
    onError: (error) => {
      console.error('Canvas created subscription error:', error);
      workspaceStore.setError('fetch', `Canvas creation subscription failed: ${error.message}`);
    },
  });

  // Subscribe to canvas updated events
  useSubscription(CANVAS_UPDATED_SUBSCRIPTION, {
    variables: { workspaceId },
    skip: !workspaceId,
    onData: ({ data }) => {
      if (data?.data?.canvasUpdated) {
        const canvas = transformBackendCanvasToFrontend(data.data.canvasUpdated);

        // Use the sync method to properly handle store updates
        workspaceStore.syncCanvasWithBackend(canvas);

        // Handle default canvas changes
        if (canvas.settings.isDefault) {
          // This canvas became the default, ensure others are not default
          workspaceStore.canvasManagement.canvases.forEach((existingCanvas, id) => {
            if (id !== canvas.id && existingCanvas.settings.isDefault) {
              const updatedCanvas = {
                ...existingCanvas,
                settings: { ...existingCanvas.settings, isDefault: false },
                updatedAt: new Date().toISOString(),
                version: existingCanvas.version + 1,
              };
              workspaceStore.canvasManagement.canvases.set(id, updatedCanvas);
            }
          });
        }

        console.log('Canvas updated via subscription:', canvas.id, {
          isDefault: canvas.settings.isDefault,
          name: canvas.name,
        });
      }
    },
    onError: (error) => {
      console.error('Canvas updated subscription error:', error);
      workspaceStore.setError('fetch', `Canvas update subscription failed: ${error.message}`);
    },
  });

  // Subscribe to canvas deleted events
  useSubscription(CANVAS_DELETED_SUBSCRIPTION, {
    variables: { workspaceId },
    skip: !workspaceId,
    onData: ({ data }) => {
      if (data?.data?.canvasDeleted) {
        const canvasId = createCanvasId(data.data.canvasDeleted);
        const deletedCanvas = workspaceStore.getCanvas(canvasId);

        console.log('Canvas deleted via subscription:', canvasId);

        // Remove from store
        workspaceStore.canvasManagement.canvases.delete(canvasId);

        // Update default canvas ID if this was the default
        if (workspaceStore.canvasManagement.defaultCanvasId === canvasId) {
          const newDefault = workspaceStore.getDefaultCanvas();
          workspaceStore.canvasManagement.defaultCanvasId = newDefault?.id;
        }

        // Clear current canvas if deleted and switch to default or first available
        if (workspaceStore.context.currentCanvasId === canvasId) {
          const nextCanvas = workspaceStore.getDefaultCanvas() ||
            Array.from(workspaceStore.canvasManagement.canvases.values())[0];

          if (nextCanvas) {
            workspaceStore.setCurrentCanvas(nextCanvas.id, nextCanvas.name);
          } else {
            workspaceStore.setCurrentCanvas(createCanvasId(''), undefined);
          }
        }
      }
    },
    onError: (error) => {
      console.error('Canvas deleted subscription error:', error);
      workspaceStore.setError('fetch', `Canvas deletion subscription failed: ${error.message}`);
    },
  });

  // Subscribe to default canvas changes
  useSubscription(DEFAULT_CANVAS_CHANGED_SUBSCRIPTION, {
    variables: { workspaceId },
    skip: !workspaceId,
    onData: ({ data }) => {
      if (data?.data?.defaultCanvasChanged && workspaceId) {
        const newDefaultId = createCanvasId(data.data.defaultCanvasChanged);

        console.log('Default canvas changed via subscription:', newDefaultId);

        // Update all canvas default states atomically
        const currentTime = new Date().toISOString();
        const updatedCanvases = new Map(workspaceStore.canvasManagement.canvases);

        for (const [id, canvas] of updatedCanvases) {
          const shouldBeDefault = id === newDefaultId;
          const isCurrentlyDefault = canvas.settings.isDefault;

          if (shouldBeDefault !== isCurrentlyDefault) {
            updatedCanvases.set(id, {
              ...canvas,
              settings: { ...canvas.settings, isDefault: shouldBeDefault },
              updatedAt: currentTime,
              version: canvas.version + 1,
            });
          }
        }

        // Update store state
        workspaceStore.canvasManagement.canvases = updatedCanvases;
        workspaceStore.canvasManagement.defaultCanvasId = newDefaultId;

        // Update current canvas if this is the new default and no canvas is currently selected
        const currentContext = workspaceStore.context;
        if (!currentContext.currentCanvasId) {
          const newDefaultCanvas = updatedCanvases.get(newDefaultId);
          if (newDefaultCanvas) {
            workspaceStore.setCurrentCanvas(newDefaultId, newDefaultCanvas.name);
          }
        }
      }
    },
    onError: (error) => {
      console.error('Default canvas changed subscription error:', error);
      workspaceStore.setError('fetch', `Default canvas subscription failed: ${error.message}`);
    },
  });
};

// Note: Canvas settings sync hooks will be added when backend supports them

// Export all hooks
export {
  transformBackendCanvasToFrontend,
  transformCreateParamsToBackend,
};