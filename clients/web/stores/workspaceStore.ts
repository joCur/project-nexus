/**
 * Workspace Store Implementation
 *
 * Manages workspace navigation context and UI state only.
 * Canvas data is now managed entirely by Apollo GraphQL cache.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  WorkspaceContext,
  CanvasId,
} from '@/types/workspace.types';
import { createCanvasId } from '@/types/workspace.types';
import type { EntityId } from '@/types/common.types';

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
 * Default UI state for canvas operations
 */
const DEFAULT_UI_STATE = {
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
 * Simplified workspace store interface - UI state and navigation only
 */
interface SimplifiedWorkspaceStore {
  // State
  context: WorkspaceContext;
  uiState: typeof DEFAULT_UI_STATE;
  isInitialized: boolean;

  // Context management
  setCurrentWorkspace: (workspaceId: EntityId, workspaceName?: string) => void;
  setCurrentCanvas: (canvasId: CanvasId, canvasName?: string) => void;
  clearCurrentCanvas: () => void;
  switchCanvas: (canvasId: CanvasId) => Promise<void>;
  clearContext: () => void;

  // UI state management
  setCanvasLoading: (operation: keyof typeof DEFAULT_UI_STATE.loadingStates, loading: boolean) => void;
  setError: (type: 'fetch' | 'mutation', error?: string) => void;
  clearErrors: () => void;
}

/**
 * Simplified workspace store implementation
 */
export const useWorkspaceStore = create<SimplifiedWorkspaceStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        context: DEFAULT_CONTEXT,
        uiState: DEFAULT_UI_STATE,
        isInitialized: false,

        // Context management
        setCurrentWorkspace: (workspaceId: EntityId, workspaceName?: string) => {
          set((state) => ({
            context: {
              ...state.context,
              currentWorkspaceId: workspaceId,
              workspaceName: workspaceName || `Workspace ${workspaceId}`,
            },
            isInitialized: true,
          }));
        },

        setCurrentCanvas: (canvasId: CanvasId, canvasName?: string) => {
          set((state) => ({
            context: {
              ...state.context,
              currentCanvasId: canvasId,
              canvasName: canvasName || `Canvas ${canvasId}`,
            },
          }));
        },

        clearCurrentCanvas: () => {
          set((state) => ({
            context: {
              ...state.context,
              currentCanvasId: undefined,
              canvasName: undefined,
            },
          }));
        },

        switchCanvas: async (canvasId: CanvasId): Promise<void> => {
          // Just update the context - canvas data comes from Apollo
          const { setCurrentCanvas } = get();
          setCurrentCanvas(canvasId);
        },

        clearContext: () => {
          set({
            context: DEFAULT_CONTEXT,
            uiState: DEFAULT_UI_STATE,
            isInitialized: false,
          });
        },

        // UI state management
        setCanvasLoading: (operation: keyof typeof DEFAULT_UI_STATE.loadingStates, loading: boolean) => {
          set((state) => ({
            uiState: {
              ...state.uiState,
              loadingStates: {
                ...state.uiState.loadingStates,
                [operation]: loading,
              },
            },
          }));
        },

        setError: (type: 'fetch' | 'mutation', error?: string) => {
          set((state) => ({
            uiState: {
              ...state.uiState,
              errors: {
                ...state.uiState.errors,
                [type === 'fetch' ? 'fetchError' : 'mutationError']: error,
              },
            },
          }));
        },

        clearErrors: () => {
          set((state) => ({
            uiState: {
              ...state.uiState,
              errors: {
                fetchError: undefined,
                mutationError: undefined,
              },
            },
          }));
        },
      }),
      {
        name: 'workspace-store',
        // Only persist navigation context, not canvas data
        partialize: (state) => ({
          context: state.context,
          isInitialized: state.isInitialized,
        }),
        // Simple merge function for context only
        merge: (persistedState: any, currentState) => ({
          ...currentState,
          context: persistedState?.context || DEFAULT_CONTEXT,
          isInitialized: persistedState?.isInitialized || false,
        }),
      }
    ),
    {
      name: 'WorkspaceStore',
    }
  )
);

// Cleanup complete - Apollo hooks handle all data selection and memoization