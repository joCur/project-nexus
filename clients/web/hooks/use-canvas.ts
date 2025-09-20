/**
 * Canvas Operations Hooks
 * 
 * Integrates GraphQL canvas operations with the workspace store, providing 
 * real-time synchronization, optimistic updates, and server persistence.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useQuery,
  useMutation,
  // useSubscription, // 🚨 TODO: Uncomment when subscriptions are re-enabled - See "GraphQL Subscriptions Status" in Notion
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
  const storeRef = useRef(workspaceStore);
  storeRef.current = workspaceStore;

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
    fetchPolicy: 'cache-and-network', // Always check server for updates
    onCompleted: () => {
      // Update UI loading state
      storeRef.current?.setCanvasLoading?.('fetchingCanvases', false);
    },
    onError: (error) => {
      storeRef.current?.setError?.('fetch', error.message);
      storeRef.current?.setCanvasLoading?.('fetchingCanvases', false);
    },
  });

  // Set loading state when query starts
  useEffect(() => {
    if (loading) {
      storeRef.current?.setCanvasLoading?.('fetchingCanvases', true);
    }
  }, [loading]); // Using ref to avoid infinite re-renders

  // Auto-refetch on window focus for fresh data
  useEffect(() => {
    const handleFocus = () => {
      if (workspaceId && !loading) {
        apolloRefetch().catch(() => {});
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [workspaceId, loading]); // Remove apolloRefetch from deps - it's captured in closure

  const refetch = useCallback(async () => {
    if (workspaceId) {
      storeRef.current?.setCanvasLoading?.('fetchingCanvases', true);
      try {
        await apolloRefetch();
      } catch (error) {
        storeRef.current?.setError?.('fetch', error instanceof Error ? error.message : 'Failed to refetch canvases');
      }
    }
  }, [apolloRefetch, workspaceId]); // Using ref to avoid infinite re-renders

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

  // Transform data directly from Apollo cache - no store duplication
  const canvases = useMemo(() => {
    return (data?.workspaceCanvases?.items || []).map(transformBackendCanvasToFrontend);
  }, [data]);

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
  const { data, loading, error, refetch } = useQuery<{ canvas: CanvasResponse }>(GET_CANVAS, {
    variables: { id: canvasId },
    skip: !canvasId,
    fetchPolicy: 'cache-and-network',
  });

  const canvas = useMemo(() => {
    return data?.canvas ? transformBackendCanvasToFrontend(data.canvas) : undefined;
  }, [data]);

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
  const storeRef = useRef(workspaceStore);
  storeRef.current = workspaceStore;
  const [createCanvasMutation, { loading, error, reset }] = useMutation(CREATE_CANVAS);

  // Update UI loading state
  useEffect(() => {
    storeRef.current?.setCanvasLoading?.('creatingCanvas', loading);
  }, [loading]); // Using ref to avoid infinite re-renders

  const mutate = useCallback(async (params: CreateCanvasParams): Promise<CanvasId | null> => {
    try {
      storeRef.current?.clearErrors?.();

      // Server mutation with proper cache update
      const input = transformCreateParamsToBackend(params);
      const { data } = await createCanvasMutation({
        variables: { input },
        update: (cache, { data }) => {
          if (data?.createCanvas) {
            try {
              // Read current workspace canvases cache
              const existingData = cache.readQuery<{ workspaceCanvases: CanvasesConnectionResponse }>({
                query: GET_WORKSPACE_CANVASES,
                variables: { workspaceId: params.workspaceId },
              });

              if (existingData?.workspaceCanvases?.items) {
                // Check if canvas already exists in cache (prevent duplicate)
                const canvasExists = existingData.workspaceCanvases.items.some(
                  canvas => canvas.id === data.createCanvas.id
                );

                if (!canvasExists) {
                  // Add new canvas to cache
                  const updatedItems = [...existingData.workspaceCanvases.items, data.createCanvas];

                  cache.writeQuery({
                    query: GET_WORKSPACE_CANVASES,
                    variables: { workspaceId: params.workspaceId },
                    data: {
                      workspaceCanvases: {
                        ...existingData.workspaceCanvases,
                        items: updatedItems,
                        totalCount: existingData.workspaceCanvases.totalCount + 1,
                      },
                    },
                  });
                }
              }
            } catch (cacheError) {
              // Cache update failed silently
            }
          }
        }
      });

      if (data?.createCanvas) {
        // Canvas created successfully
        return createCanvasId(data.createCanvas.id);
      }

      return null;
    } catch (err) {
      // Canvas creation failed
      storeRef.current?.setError?.('mutation', `Failed to create canvas: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, [createCanvasMutation]); // Using ref to avoid infinite re-renders

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
  const storeRef = useRef(workspaceStore);
  storeRef.current = workspaceStore;
  const [updateCanvasMutation, { loading, error, reset }] = useMutation(UPDATE_CANVAS);

  // Update UI loading state
  useEffect(() => {
    storeRef.current?.setCanvasLoading?.('updatingCanvas', loading);
  }, [loading]); // Using ref to avoid infinite re-renders

  const mutate = useCallback(async (params: UpdateCanvasParams): Promise<boolean> => {
    try {
      storeRef.current?.clearErrors?.();

      // Server mutation - Apollo cache will handle updates
      const { data } = await updateCanvasMutation({
        variables: {
          id: params.id,
          input: params.updates,
        }
      });

      if (data?.updateCanvas) {
        // Canvas updated successfully
        return true;
      }

      return false;
    } catch (err) {
      // Canvas update failed
      storeRef.current?.setError?.('mutation', `Failed to update canvas: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, [updateCanvasMutation]); // Using ref to avoid infinite re-renders

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
  const storeRef = useRef(workspaceStore);
  storeRef.current = workspaceStore;
  const [deleteCanvasMutation, { loading, error, reset }] = useMutation(DELETE_CANVAS);

  // Update UI loading state
  useEffect(() => {
    storeRef.current?.setCanvasLoading?.('deletingCanvas', loading);
  }, [loading]); // Using ref to avoid infinite re-renders

  const mutate = useCallback(async (canvasId: CanvasId): Promise<boolean> => {
    try {
      storeRef.current?.clearErrors?.();

      // Clear current canvas if we're deleting it
      if (storeRef.current?.context?.currentCanvasId === canvasId) {
        storeRef.current?.setCurrentCanvas?.(createCanvasId(''), undefined);
      }

      // Server mutation - Apollo cache will handle removal
      const { data } = await deleteCanvasMutation({
        variables: { id: canvasId },
        update: (cache) => {
          // Evict the deleted canvas from cache
          cache.evict({ id: cache.identify({ __typename: 'Canvas', id: canvasId }) });
          cache.gc();
        }
      });

      if (data?.deleteCanvas) {
        // Canvas deleted successfully
        return true;
      }

      return false;
    } catch (err) {
      // Canvas deletion failed
      storeRef.current?.setError?.('mutation', `Failed to delete canvas: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, [deleteCanvasMutation]); // Using ref to avoid infinite re-renders

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
  const storeRef = useRef(workspaceStore);
  storeRef.current = workspaceStore;
  const [setDefaultCanvasMutation, { loading, error, reset }] = useMutation(SET_DEFAULT_CANVAS);

  // Update UI loading state
  useEffect(() => {
    storeRef.current?.setCanvasLoading?.('settingDefault', loading);
  }, [loading]); // Using ref to avoid infinite re-renders

  const mutate = useCallback(async (workspaceId: EntityId, canvasId: CanvasId): Promise<boolean> => {
    try {
      storeRef.current?.clearErrors?.();

      // Server mutation with Apollo cache update
      const { data } = await setDefaultCanvasMutation({
        variables: { id: canvasId },
        update: (cache, { data }) => {
          if (data?.setDefaultCanvas) {
            try {
              // Read workspace canvases cache
              let cacheData: { workspaceCanvases: CanvasesConnectionResponse } | null = null;
              try {
                cacheData = cache.readQuery<{ workspaceCanvases: CanvasesConnectionResponse }>({
                  query: GET_WORKSPACE_CANVASES,
                  variables: { workspaceId },
                });
              } catch (error) {
                // Workspace canvases query not in cache, skipping cache update
              }

              if (cacheData?.workspaceCanvases?.items) {
                // Update all canvases: set new default to true, others to false
                const updatedItems = cacheData.workspaceCanvases.items.map(canvas => ({
                  ...canvas,
                  isDefault: canvas.id === canvasId,
                }));

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

              // Update individual canvas cache entries
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
            } catch (cacheError) {
              // Failed to update Apollo cache for default canvas
            }
          }
        }
      });

      if (data?.setDefaultCanvas) {
        // Default canvas set successfully
        return true;
      }

      return false;
    } catch (err) {
      // Failed to set default canvas
      storeRef.current?.setError?.('mutation', `Failed to set default canvas: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, [setDefaultCanvasMutation]); // Using ref to avoid infinite re-renders

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
  const storeRef = useRef(workspaceStore);
  storeRef.current = workspaceStore;
  const [duplicateCanvasMutation, { loading, error, reset }] = useMutation(DUPLICATE_CANVAS);

  // Update UI loading state
  useEffect(() => {
    storeRef.current?.setCanvasLoading?.('duplicatingCanvas', loading);
  }, [loading]); // Using ref to avoid infinite re-renders

  const mutate = useCallback(async (params: DuplicateCanvasParams): Promise<CanvasId | null> => {
    try {
      storeRef.current?.clearErrors?.();

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
        // Canvas duplicated successfully
        return createCanvasId(data.duplicateCanvas.id);
      }

      return null;
    } catch (err) {
      // Failed to duplicate canvas
      storeRef.current?.setError?.('mutation', `Failed to duplicate canvas: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, [duplicateCanvasMutation]); // Using ref to avoid infinite re-renders

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
 *
 * ⚠️ TEMPORARILY DISABLED - TODO: Re-enable real-time subscriptions
 *
 * Reason: Backend subscriptions return null for non-nullable fields
 * Likely cause: Authentication/permission issues in subscription resolvers
 *
 * @see Notion documentation: "GraphQL Subscriptions Status" for detailed re-enabling steps
 * @see TodoWrite: "Re-enable canvas subscriptions in useCanvasSubscriptions hook"
 */
export const useCanvasSubscriptions = (workspaceId: EntityId | undefined) => {
  // 🚨 SUBSCRIPTIONS DISABLED - See "GraphQL Subscriptions Status" in Notion for details

  // 🚨 Canvas subscriptions disabled - authentication/permission issues in backend
  // Related documentation: "GraphQL Subscriptions Status" in Notion

  // TODO: Re-enable these subscriptions when backend auth issues are resolved:
  /*
  useSubscription(CANVAS_CREATED_SUBSCRIPTION, {
    variables: { workspaceId },
    skip: !workspaceId,
    onData: ({ data }) => {
      if (data?.data?.canvasCreated) {
        // Canvas created via subscription
      }
    },
    onError: (error) => {
      // Canvas created subscription error
    },
  });

  useSubscription(CANVAS_UPDATED_SUBSCRIPTION, { ... });
  useSubscription(CANVAS_DELETED_SUBSCRIPTION, { ... });
  useSubscription(DEFAULT_CANVAS_CHANGED_SUBSCRIPTION, { ... });
  */
};

// Note: Canvas settings sync hooks will be added when backend supports them

// Export all hooks
export {
  transformBackendCanvasToFrontend,
  transformCreateParamsToBackend,
};