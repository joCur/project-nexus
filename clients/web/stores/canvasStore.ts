/**
 * Canvas Store Implementation
 * 
 * Manages viewport state, canvas configuration, and interaction handling
 * for the infinite canvas system. Now integrates with workspace context
 * for multi-canvas support.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { CanvasStore, ViewportState, CanvasConfig, CanvasInteraction, CanvasPosition, ZoomLevel } from '@/types/canvas.types';
import type { CanvasId } from '@/types/workspace.types';
import type { EntityId } from '@/types/common.types';

/**
 * Default viewport state
 */
const DEFAULT_VIEWPORT: ViewportState = {
  position: { x: 0, y: 0 },
  zoom: 1.0,
  bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  isDirty: false,
};

/**
 * Default canvas configuration
 */
const DEFAULT_CONFIG: CanvasConfig = {
  grid: {
    enabled: true,
    size: 20,
    color: '#e5e7eb',
    opacity: 0.3,
  },
  zoom: {
    min: 0.25,
    max: 4.0,
    step: 0.1,
  },
  performance: {
    enableCulling: true,
    enableVirtualization: true,
    maxVisibleCards: 1000,
  },
};

/**
 * Default interaction state
 */
const DEFAULT_INTERACTION: CanvasInteraction = {
  mode: 'select',
  isActive: false,
  selection: {
    selectedIds: new Set(),
  },
  lastInteractionTime: Date.now(),
};

/**
 * Extended canvas store interface with canvas context support
 */
interface CanvasStoreExtended extends CanvasStore {
  // Canvas context state
  currentCanvasId?: CanvasId;
  canvasViewports: Map<CanvasId, ViewportState>;
  
  // Canvas context actions
  setCurrentCanvas: (canvasId: CanvasId) => void;
  switchCanvas: (canvasId: CanvasId, preserveViewport?: boolean) => void;
  getCanvasViewport: (canvasId: CanvasId) => ViewportState | undefined;
  saveCanvasViewport: (canvasId?: CanvasId) => void;
  loadCanvasViewport: (canvasId: CanvasId) => void;
  clearCanvasViewports: () => void;
}

/**
 * Canvas store implementation with multi-canvas support
 */
export const useCanvasStore = create<CanvasStoreExtended>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        viewport: DEFAULT_VIEWPORT,
        config: DEFAULT_CONFIG,
        interaction: DEFAULT_INTERACTION,
        isInitialized: false,
        
        // Canvas context state
        currentCanvasId: undefined,
        canvasViewports: new Map(),

        // Viewport actions
        setZoom: (zoom: ZoomLevel) => {
          const { config } = get();
          const clampedZoom = Math.max(config.zoom.min, Math.min(config.zoom.max, zoom));
          
          set((state) => ({
            viewport: {
              ...state.viewport,
              zoom: clampedZoom,
              isDirty: true,
            },
          }));
        },

        setPosition: (position: CanvasPosition) => {
          set((state) => ({
            viewport: {
              ...state.viewport,
              position,
              isDirty: true,
            },
          }));
        },

        panBy: (offset: CanvasPosition) => {
          const currentPosition = get().viewport.position;
          get().setPosition({
            x: currentPosition.x + offset.x,
            y: currentPosition.y + offset.y,
          });
        },

        zoomToFit: () => {
          // Reset to default view
          get().setPosition({ x: 0, y: 0 });
          get().setZoom(1.0);
        },

        centerView: () => {
          get().setPosition({ x: 0, y: 0 });
        },

        // Configuration actions
        updateConfig: (config: Partial<CanvasConfig>) => {
          set((state) => ({
            config: {
              ...state.config,
              ...config,
            },
          }));
        },

        toggleGrid: () => {
          set((state) => ({
            config: {
              ...state.config,
              grid: {
                ...state.config.grid,
                enabled: !state.config.grid.enabled,
              },
            },
          }));
        },

        // Interaction actions
        setInteractionMode: (mode: CanvasInteraction['mode']) => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              mode,
              lastInteractionTime: Date.now(),
            },
          }));
        },

        startInteraction: (position: CanvasPosition) => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              isActive: true,
              startPosition: position,
              currentPosition: position,
              lastInteractionTime: Date.now(),
            },
          }));
        },

        updateInteraction: (position: CanvasPosition) => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              currentPosition: position,
              lastInteractionTime: Date.now(),
            },
          }));
        },

        endInteraction: () => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              isActive: false,
              startPosition: undefined,
              currentPosition: undefined,
              lastInteractionTime: Date.now(),
            },
          }));
        },

        // Selection actions
        selectCard: (cardId: import('@/types/common.types').EntityId) => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              selection: {
                selectedIds: new Set([cardId]),
              },
            },
          }));
        },

        selectMultiple: (cardIds: import('@/types/common.types').EntityId[]) => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              selection: {
                selectedIds: new Set(cardIds),
              },
            },
          }));
        },

        clearSelection: () => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              selection: {
                selectedIds: new Set(),
              },
            },
          }));
        },

        // Canvas context actions
        setCurrentCanvas: (canvasId: CanvasId) => {
          const currentCanvasId = get().currentCanvasId;
          
          // Save current viewport before switching
          if (currentCanvasId) {
            get().saveCanvasViewport(currentCanvasId);
          }
          
          set((state) => ({
            currentCanvasId: canvasId,
          }));
          
          // Load viewport for new canvas
          get().loadCanvasViewport(canvasId);
        },

        switchCanvas: (canvasId: CanvasId, preserveViewport = false) => {
          if (!preserveViewport) {
            get().setCurrentCanvas(canvasId);
          } else {
            set({ currentCanvasId: canvasId });
          }
        },

        getCanvasViewport: (canvasId: CanvasId): ViewportState | undefined => {
          return get().canvasViewports.get(canvasId);
        },

        saveCanvasViewport: (canvasId?: CanvasId) => {
          const currentId = canvasId || get().currentCanvasId;
          if (!currentId) return;
          
          const { viewport } = get();
          set((state) => ({
            canvasViewports: new Map(state.canvasViewports).set(currentId, {
              ...viewport,
              isDirty: false, // Mark as saved
            }),
          }));
        },

        loadCanvasViewport: (canvasId: CanvasId) => {
          const savedViewport = get().getCanvasViewport(canvasId);
          if (savedViewport) {
            set({
              viewport: {
                ...savedViewport,
                isDirty: false,
              },
            });
          } else {
            // Load default viewport for new canvas
            set({
              viewport: {
                ...DEFAULT_VIEWPORT,
                isDirty: false,
              },
            });
          }
        },

        clearCanvasViewports: () => {
          set({
            canvasViewports: new Map(),
            currentCanvasId: undefined,
          });
        },

        reset: () => {
          set({
            viewport: DEFAULT_VIEWPORT,
            config: DEFAULT_CONFIG,
            interaction: DEFAULT_INTERACTION,
            isInitialized: false,
            currentCanvasId: undefined,
            canvasViewports: new Map(),
          });
        },
      }),
      {
        name: 'canvas-store',
        // Persist viewport, config, and canvas contexts
        partialize: (state) => ({
          viewport: {
            position: state.viewport.position,
            zoom: state.viewport.zoom,
            bounds: state.viewport.bounds,
          },
          config: state.config,
          currentCanvasId: state.currentCanvasId,
          canvasViewports: Array.from(state.canvasViewports.entries()),
        }),
        // Custom merge function to handle Map serialization
        merge: (persistedState: any, currentState) => ({
          ...currentState,
          viewport: persistedState?.viewport || DEFAULT_VIEWPORT,
          config: persistedState?.config || DEFAULT_CONFIG,
          currentCanvasId: persistedState?.currentCanvasId,
          canvasViewports: new Map(persistedState?.canvasViewports || []),
        }),
      }
    ),
    {
      name: 'CanvasStore',
    }
  )
);

// Selectors for common use cases
export const canvasSelectors = {
  getViewport: (state: CanvasStoreExtended) => state.viewport,
  getConfig: (state: CanvasStoreExtended) => state.config,
  getInteraction: (state: CanvasStoreExtended) => state.interaction,
  getZoom: (state: CanvasStoreExtended) => state.viewport.zoom,
  getPosition: (state: CanvasStoreExtended) => state.viewport.position,
  isGridVisible: (state: CanvasStoreExtended) => state.config.grid.enabled,
  isInteractionActive: (state: CanvasStoreExtended) => state.interaction.isActive,
  getSelectedCards: (state: CanvasStoreExtended) => Array.from(state.interaction.selection.selectedIds),
  getInteractionMode: (state: CanvasStoreExtended) => state.interaction.mode,
  
  // Canvas context selectors
  getCurrentCanvasId: (state: CanvasStoreExtended) => state.currentCanvasId,
  getCanvasViewport: (canvasId: CanvasId) => (state: CanvasStoreExtended) => state.getCanvasViewport(canvasId),
  getCanvasViewportCount: (state: CanvasStoreExtended) => state.canvasViewports.size,
  getAllCanvasViewports: (state: CanvasStoreExtended) => Array.from(state.canvasViewports.entries()),
  hasCanvasViewport: (canvasId: CanvasId) => (state: CanvasStoreExtended) => state.canvasViewports.has(canvasId),
  isCurrentCanvas: (canvasId: CanvasId) => (state: CanvasStoreExtended) => state.currentCanvasId === canvasId,
};