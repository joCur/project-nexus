/**
 * Workspace Store Implementation
 * 
 * Manages workspace context, canvas operations, and integration
 * with the GraphQL API for canvas CRUD operations.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  WorkspaceStore,
  WorkspaceContext,
  CanvasManagement,
  Canvas,
  CanvasId,
  CreateCanvasParams,
  UpdateCanvasParams,
  DuplicateCanvasParams,
  CanvasFilter,
  CanvasSettings,
} from '@/types/workspace.types';
import { createCanvasId } from '@/types/workspace.types';
import type { EntityId } from '@/types/common.types';
import type { CanvasPosition } from '@/types/canvas.types';

/**
 * Default workspace context
 */
const DEFAULT_CONTEXT: WorkspaceContext = {
  currentWorkspaceId: undefined,
  currentCanvasId: undefined,
  workspaceName: undefined,
  canvasName: undefined,
};

/**
 * Default canvas management state
 */
const DEFAULT_CANVAS_MANAGEMENT: CanvasManagement = {
  canvases: new Map(),
  defaultCanvasId: undefined,
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
};

/**
 * Workspace store implementation
 */
export const useWorkspaceStore = create<WorkspaceStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        context: DEFAULT_CONTEXT,
        canvasManagement: DEFAULT_CANVAS_MANAGEMENT,
        isInitialized: false,

        // Context management
        setCurrentWorkspace: (workspaceId: EntityId, workspaceName?: string) => {
          set((state) => ({
            context: {
              ...state.context,
              currentWorkspaceId: workspaceId,
              workspaceName,
              // Clear canvas context when workspace changes
              currentCanvasId: undefined,
              canvasName: undefined,
            },
            // Clear canvas data when workspace changes
            canvasManagement: {
              ...DEFAULT_CANVAS_MANAGEMENT,
              canvases: new Map(), // Create a fresh Map instance
            },
            isInitialized: false,
          }));
        },

        setCurrentCanvas: (canvasId: CanvasId, canvasName?: string) => {
          set((state) => ({
            context: {
              ...state.context,
              currentCanvasId: canvasId,
              canvasName,
            },
          }));
        },

        switchCanvas: async (canvasId: CanvasId) => {
          const { canvasManagement } = get();
          const canvas = canvasManagement.canvases.get(canvasId);
          
          if (canvas) {
            get().setCurrentCanvas(canvasId, canvas.name);
            return;
          }
          
          // If canvas not in cache, trigger a load
          // This would typically integrate with the GraphQL hook
          console.warn(`Canvas ${canvasId} not found in local cache`);
        },

        clearContext: () => {
          set({
            context: DEFAULT_CONTEXT,
            canvasManagement: {
              ...DEFAULT_CANVAS_MANAGEMENT,
              canvases: new Map(), // Create a fresh Map instance
            },
            isInitialized: false,
          });
        },

        // Canvas CRUD operations (stubs - will be enhanced by hooks)
        createCanvas: async (params: CreateCanvasParams): Promise<CanvasId | null> => {
          set((state) => ({
            canvasManagement: {
              ...state.canvasManagement,
              loadingStates: {
                ...state.canvasManagement.loadingStates,
                creatingCanvas: true,
              },
            },
          }));

          try {
            // Validate required parameters
            if (!params.workspaceId || !params.name) {
              throw new Error('Missing required parameters: workspaceId and name are required');
            }

            // This will be replaced by the actual GraphQL mutation in hooks
            const newCanvasId = createCanvasId(`canvas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
            
            const newCanvas: Canvas = {
              id: newCanvasId,
              workspaceId: params.workspaceId,
              name: params.name,
              description: params.description,
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
                ...params.settings,
              },
              status: 'active',
              priority: params.priority || 'normal',
              tags: params.tags || [],
              metadata: params.metadata || {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
            };

            set((state) => ({
              canvasManagement: {
                ...state.canvasManagement,
                canvases: new Map(state.canvasManagement.canvases).set(newCanvasId, newCanvas),
                loadingStates: {
                  ...state.canvasManagement.loadingStates,
                  creatingCanvas: false,
                },
              },
            }));

            return newCanvasId;
          } catch (error) {
            set((state) => ({
              canvasManagement: {
                ...state.canvasManagement,
                loadingStates: {
                  ...state.canvasManagement.loadingStates,
                  creatingCanvas: false,
                },
                errors: {
                  ...state.canvasManagement.errors,
                  mutationError: `Failed to create canvas: ${error}`,
                },
              },
            }));
            return null;
          }
        },

        updateCanvas: async (params: UpdateCanvasParams): Promise<boolean> => {
          set((state) => ({
            canvasManagement: {
              ...state.canvasManagement,
              loadingStates: {
                ...state.canvasManagement.loadingStates,
                updatingCanvas: true,
              },
            },
          }));

          try {
            const { canvasManagement } = get();
            const existingCanvas = canvasManagement.canvases.get(params.id);
            
            if (!existingCanvas) {
              throw new Error('Canvas not found');
            }

            const updatedCanvas: Canvas = {
              ...existingCanvas,
              ...params.updates,
              settings: params.updates.settings
                ? { ...existingCanvas.settings, ...params.updates.settings }
                : existingCanvas.settings,
              updatedAt: new Date().toISOString(),
              version: existingCanvas.version + 1,
            };

            set((state) => ({
              canvasManagement: {
                ...state.canvasManagement,
                canvases: new Map(state.canvasManagement.canvases).set(params.id, updatedCanvas),
                loadingStates: {
                  ...state.canvasManagement.loadingStates,
                  updatingCanvas: false,
                },
              },
            }));

            return true;
          } catch (error) {
            set((state) => ({
              canvasManagement: {
                ...state.canvasManagement,
                loadingStates: {
                  ...state.canvasManagement.loadingStates,
                  updatingCanvas: false,
                },
                errors: {
                  ...state.canvasManagement.errors,
                  mutationError: `Failed to update canvas: ${error}`,
                },
              },
            }));
            return false;
          }
        },

        deleteCanvas: async (canvasId: CanvasId): Promise<boolean> => {
          set((state) => ({
            canvasManagement: {
              ...state.canvasManagement,
              loadingStates: {
                ...state.canvasManagement.loadingStates,
                deletingCanvas: true,
              },
            },
          }));

          try {
            set((state) => {
              const newCanvases = new Map(state.canvasManagement.canvases);
              newCanvases.delete(canvasId);

              return {
                canvasManagement: {
                  ...state.canvasManagement,
                  canvases: newCanvases,
                  defaultCanvasId: state.canvasManagement.defaultCanvasId === canvasId
                    ? undefined
                    : state.canvasManagement.defaultCanvasId,
                  loadingStates: {
                    ...state.canvasManagement.loadingStates,
                    deletingCanvas: false,
                  },
                },
                context: state.context.currentCanvasId === canvasId
                  ? { ...state.context, currentCanvasId: undefined, canvasName: undefined }
                  : state.context,
              };
            });

            return true;
          } catch (error) {
            set((state) => ({
              canvasManagement: {
                ...state.canvasManagement,
                loadingStates: {
                  ...state.canvasManagement.loadingStates,
                  deletingCanvas: false,
                },
                errors: {
                  ...state.canvasManagement.errors,
                  mutationError: `Failed to delete canvas: ${error}`,
                },
              },
            }));
            return false;
          }
        },

        duplicateCanvas: async (params: DuplicateCanvasParams): Promise<CanvasId | null> => {
          set((state) => ({
            canvasManagement: {
              ...state.canvasManagement,
              loadingStates: {
                ...state.canvasManagement.loadingStates,
                duplicatingCanvas: true,
              },
            },
          }));

          try {
            const { canvasManagement } = get();
            const originalCanvas = canvasManagement.canvases.get(params.id);
            
            if (!originalCanvas) {
              throw new Error('Original canvas not found');
            }

            const duplicateId = createCanvasId(`canvas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
            
            const duplicatedCanvas: Canvas = {
              ...originalCanvas,
              id: duplicateId,
              name: params.name,
              description: params.description || originalCanvas.description,
              settings: {
                ...originalCanvas.settings,
                isDefault: false, // Duplicates are never default
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
            };

            set((state) => ({
              canvasManagement: {
                ...state.canvasManagement,
                canvases: new Map(state.canvasManagement.canvases).set(duplicateId, duplicatedCanvas),
                loadingStates: {
                  ...state.canvasManagement.loadingStates,
                  duplicatingCanvas: false,
                },
              },
            }));

            return duplicateId;
          } catch (error) {
            set((state) => ({
              canvasManagement: {
                ...state.canvasManagement,
                loadingStates: {
                  ...state.canvasManagement.loadingStates,
                  duplicatingCanvas: false,
                },
                errors: {
                  ...state.canvasManagement.errors,
                  mutationError: `Failed to duplicate canvas: ${error}`,
                },
              },
            }));
            return null;
          }
        },

        // Canvas management
        setDefaultCanvas: async (workspaceId: EntityId, canvasId: CanvasId): Promise<boolean> => {
          set((state) => ({
            canvasManagement: {
              ...state.canvasManagement,
              loadingStates: {
                ...state.canvasManagement.loadingStates,
                settingDefault: true,
              },
            },
          }));

          try {
            // Check if canvas exists
            const { canvasManagement } = get();
            if (!canvasManagement.canvases.has(canvasId)) {
              throw new Error('Canvas not found');
            }

            // Update the default canvas
            set((state) => {
              const newCanvases = new Map(state.canvasManagement.canvases);
              
              // Remove default from all canvases
              for (const [id, canvas] of newCanvases) {
                if (canvas.settings.isDefault) {
                  newCanvases.set(id, {
                    ...canvas,
                    settings: { ...canvas.settings, isDefault: false },
                    updatedAt: new Date().toISOString(),
                    version: canvas.version + 1,
                  });
                }
              }
              
              // Set new default
              const targetCanvas = newCanvases.get(canvasId);
              if (targetCanvas) {
                newCanvases.set(canvasId, {
                  ...targetCanvas,
                  settings: { ...targetCanvas.settings, isDefault: true },
                  updatedAt: new Date().toISOString(),
                  version: targetCanvas.version + 1,
                });
              }

              return {
                canvasManagement: {
                  ...state.canvasManagement,
                  canvases: newCanvases,
                  defaultCanvasId: canvasId,
                  loadingStates: {
                    ...state.canvasManagement.loadingStates,
                    settingDefault: false,
                  },
                },
              };
            });

            return true;
          } catch (error) {
            set((state) => ({
              canvasManagement: {
                ...state.canvasManagement,
                loadingStates: {
                  ...state.canvasManagement.loadingStates,
                  settingDefault: false,
                },
                errors: {
                  ...state.canvasManagement.errors,
                  mutationError: `Failed to set default canvas: ${error}`,
                },
              },
            }));
            return false;
          }
        },

        loadWorkspaceCanvases: async (workspaceId: EntityId, filter?: CanvasFilter): Promise<void> => {
          set((state) => ({
            canvasManagement: {
              ...state.canvasManagement,
              loadingStates: {
                ...state.canvasManagement.loadingStates,
                fetchingCanvases: true,
              },
            },
          }));

          try {
            // This will be replaced by GraphQL query in hooks
            // For now, we'll create a mock default canvas if none exist
            const { canvasManagement } = get();
            
            if (canvasManagement.canvases.size === 0) {
              const defaultCanvasId = createCanvasId(`default_${workspaceId}`);
              const defaultCanvas: Canvas = {
                id: defaultCanvasId,
                workspaceId,
                name: 'Main Canvas',
                description: 'Default workspace canvas',
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
                    type: 'COLOR',
                    color: '#ffffff',
                    opacity: 1.0,
                  },
                },
                status: 'active',
                priority: 'normal',
                tags: [],
                metadata: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
              };

              set((state) => ({
                canvasManagement: {
                  ...state.canvasManagement,
                  canvases: new Map().set(defaultCanvasId, defaultCanvas),
                  defaultCanvasId,
                  loadingStates: {
                    ...state.canvasManagement.loadingStates,
                    fetchingCanvases: false,
                  },
                },
                context: {
                  ...state.context,
                  currentCanvasId: defaultCanvasId,
                  canvasName: defaultCanvas.name,
                },
                isInitialized: true,
              }));
            } else {
              set((state) => ({
                canvasManagement: {
                  ...state.canvasManagement,
                  loadingStates: {
                    ...state.canvasManagement.loadingStates,
                    fetchingCanvases: false,
                  },
                },
                isInitialized: true,
              }));
            }
          } catch (error) {
            set((state) => ({
              canvasManagement: {
                ...state.canvasManagement,
                loadingStates: {
                  ...state.canvasManagement.loadingStates,
                  fetchingCanvases: false,
                },
                errors: {
                  ...state.canvasManagement.errors,
                  fetchError: `Failed to load canvases: ${error}`,
                },
              },
            }));
          }
        },

        refreshCanvases: async (): Promise<void> => {
          const { context } = get();
          if (context.currentWorkspaceId) {
            await get().loadWorkspaceCanvases(context.currentWorkspaceId);
          }
        },

        // Canvas settings
        updateCanvasSettings: async (canvasId: CanvasId, settings: Partial<CanvasSettings>): Promise<boolean> => {
          return get().updateCanvas({ id: canvasId, updates: { settings } });
        },

        saveCurrentViewport: async (position: CanvasPosition, zoom: number): Promise<void> => {
          const { context } = get();
          if (context.currentCanvasId) {
            await get().updateCanvasSettings(context.currentCanvasId, {
              position,
              zoom,
            });
          }
        },

        // Utility methods
        getCanvas: (canvasId: CanvasId): Canvas | undefined => {
          return get().canvasManagement.canvases.get(canvasId);
        },

        getDefaultCanvas: (): Canvas | undefined => {
          const { canvasManagement } = get();
          if (canvasManagement.defaultCanvasId) {
            return canvasManagement.canvases.get(canvasManagement.defaultCanvasId);
          }
          
          // Find first canvas marked as default
          for (const canvas of canvasManagement.canvases.values()) {
            if (canvas.settings.isDefault) {
              return canvas;
            }
          }
          
          return undefined;
        },

        getCurrentCanvas: (): Canvas | undefined => {
          const { context } = get();
          if (context.currentCanvasId) {
            return get().getCanvas(context.currentCanvasId);
          }
          return undefined;
        },

        getCanvasesByFilter: (filter: CanvasFilter): Canvas[] => {
          const { canvasManagement } = get();
          const canvases = Array.from(canvasManagement.canvases.values());
          
          return canvases.filter((canvas) => {
            if (filter.status && !filter.status.includes(canvas.status)) {
              return false;
            }
            
            if (filter.priority && !filter.priority.includes(canvas.priority)) {
              return false;
            }
            
            if (filter.tags && !filter.tags.some(tag => canvas.tags.includes(tag))) {
              return false;
            }
            
            if (filter.isDefault !== undefined && canvas.settings.isDefault !== filter.isDefault) {
              return false;
            }
            
            if (filter.searchQuery && !canvas.name.toLowerCase().includes(filter.searchQuery.toLowerCase())) {
              return false;
            }
            
            return true;
          });
        },

        // Error handling
        clearErrors: () => {
          set((state) => ({
            canvasManagement: {
              ...state.canvasManagement,
              errors: {
                fetchError: undefined,
                mutationError: undefined,
              },
            },
          }));
        },

        setError: (type: 'fetch' | 'mutation', error: string) => {
          set((state) => ({
            canvasManagement: {
              ...state.canvasManagement,
              errors: {
                ...state.canvasManagement.errors,
                [type === 'fetch' ? 'fetchError' : 'mutationError']: error,
              },
            },
          }));
        },
      }),
      {
        name: 'workspace-store',
        // Only persist context and canvas metadata, not loading states
        partialize: (state) => ({
          context: state.context,
          canvasManagement: {
            canvases: Array.from(state.canvasManagement.canvases.entries()),
            defaultCanvasId: state.canvasManagement.defaultCanvasId,
          },
          isInitialized: state.isInitialized,
        }),
        // Custom merge function to handle Map serialization
        merge: (persistedState: any, currentState) => ({
          ...currentState,
          context: persistedState?.context || DEFAULT_CONTEXT,
          canvasManagement: {
            ...currentState.canvasManagement,
            canvases: new Map(persistedState?.canvasManagement?.canvases || []),
            defaultCanvasId: persistedState?.canvasManagement?.defaultCanvasId,
          },
          isInitialized: persistedState?.isInitialized || false,
        }),
      }
    ),
    {
      name: 'WorkspaceStore',
    }
  )
);

// Selectors for common use cases
export const workspaceSelectors = {
  getCurrentWorkspace: (state: WorkspaceStore) => ({
    id: state.context.currentWorkspaceId,
    name: state.context.workspaceName,
  }),
  getCurrentCanvas: (state: WorkspaceStore) => ({
    id: state.context.currentCanvasId,
    name: state.context.canvasName,
    canvas: state.getCurrentCanvas(),
  }),
  getAllCanvases: (state: WorkspaceStore) => Array.from(state.canvasManagement.canvases.values()),
  getCanvasCount: (state: WorkspaceStore) => state.canvasManagement.canvases.size,
  isLoading: (state: WorkspaceStore) => Object.values(state.canvasManagement.loadingStates).some(Boolean),
  hasErrors: (state: WorkspaceStore) => Boolean(
    state.canvasManagement.errors.fetchError || state.canvasManagement.errors.mutationError
  ),
  getErrors: (state: WorkspaceStore) => state.canvasManagement.errors,
};