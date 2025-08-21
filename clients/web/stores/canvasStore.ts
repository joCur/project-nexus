/**
 * Canvas Store Implementation
 * 
 * Manages viewport state, canvas configuration, and interaction handling
 * for the infinite canvas system.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { CanvasStore, ViewportState, CanvasConfig, CanvasInteraction, CanvasPosition, ZoomLevel } from '@/types/canvas.types';

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
 * Canvas store implementation
 */
export const useCanvasStore = create<CanvasStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        viewport: DEFAULT_VIEWPORT,
        config: DEFAULT_CONFIG,
        interaction: DEFAULT_INTERACTION,
        isInitialized: false,

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

        reset: () => {
          set({
            viewport: DEFAULT_VIEWPORT,
            config: DEFAULT_CONFIG,
            interaction: DEFAULT_INTERACTION,
            isInitialized: false,
          });
        },
      }),
      {
        name: 'canvas-store',
        // Only persist viewport and config, not interaction state
        partialize: (state) => ({
          viewport: {
            position: state.viewport.position,
            zoom: state.viewport.zoom,
            bounds: state.viewport.bounds,
          },
          config: state.config,
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
  getViewport: (state: CanvasStore) => state.viewport,
  getConfig: (state: CanvasStore) => state.config,
  getInteraction: (state: CanvasStore) => state.interaction,
  getZoom: (state: CanvasStore) => state.viewport.zoom,
  getPosition: (state: CanvasStore) => state.viewport.position,
  isGridVisible: (state: CanvasStore) => state.config.grid.enabled,
  isInteractionActive: (state: CanvasStore) => state.interaction.isActive,
  getSelectedCards: (state: CanvasStore) => Array.from(state.interaction.selection.selectedIds),
  getInteractionMode: (state: CanvasStore) => state.interaction.mode,
};