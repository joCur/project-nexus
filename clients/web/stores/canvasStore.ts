/**
 * Canvas Store Implementation
 * 
 * Manages viewport state, canvas configuration, and interaction handling
 * for the infinite canvas system.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { CanvasStore, ViewportState, CanvasConfig, CanvasInteraction } from '@/types/canvas.types';
import type { Position, Dimensions, Bounds } from '@/types/common.types';

/**
 * Default viewport state
 */
const DEFAULT_VIEWPORT: ViewportState = {
  zoom: 1.0,
  minZoom: 0.1,
  maxZoom: 5.0,
  panOffset: { x: 0, y: 0 },
  center: { x: 0, y: 0 },
  bounds: { x: 0, y: 0, width: 0, height: 0 },
};

/**
 * Default canvas configuration
 */
const DEFAULT_CONFIG: CanvasConfig = {
  backgroundColor: '#f9fafb',
  showGrid: true,
  gridSize: 20,
  gridColor: '#e5e7eb',
  snapToGrid: false,
  performanceMode: false,
};

/**
 * Default interaction state
 */
const DEFAULT_INTERACTION: CanvasInteraction = {
  isPanning: false,
  isSelecting: false,
  selectionRect: undefined,
  lastInteractionPosition: { x: 0, y: 0 },
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

        // Viewport management actions
        setZoom: (zoom: number) => {
          const { minZoom, maxZoom } = get().viewport;
          const clampedZoom = Math.max(minZoom, Math.min(maxZoom, zoom));
          
          set((state) => ({
            viewport: {
              ...state.viewport,
              zoom: clampedZoom,
            },
          }));
        },

        zoomIn: (factor: number = 1.2) => {
          const currentZoom = get().viewport.zoom;
          get().setZoom(currentZoom * factor);
        },

        zoomOut: (factor: number = 1.2) => {
          const currentZoom = get().viewport.zoom;
          get().setZoom(currentZoom / factor);
        },

        resetZoom: () => {
          get().setZoom(1.0);
        },

        setPanOffset: (offset: Position) => {
          set((state) => ({
            viewport: {
              ...state.viewport,
              panOffset: offset,
            },
          }));
        },

        panBy: (delta: Position) => {
          const currentOffset = get().viewport.panOffset;
          get().setPanOffset({
            x: currentOffset.x + delta.x,
            y: currentOffset.y + delta.y,
          });
        },

        centerOn: (position: Position) => {
          const { bounds } = get().viewport;
          const centerX = bounds.width / 2;
          const centerY = bounds.height / 2;
          
          get().setPanOffset({
            x: centerX - position.x,
            y: centerY - position.y,
          });
        },

        fitToContent: () => {
          // This will be implemented when cardStore is available
          // For now, just reset to default
          get().setPanOffset({ x: 0, y: 0 });
          get().resetZoom();
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
              showGrid: !state.config.showGrid,
            },
          }));
        },

        toggleSnapToGrid: () => {
          set((state) => ({
            config: {
              ...state.config,
              snapToGrid: !state.config.snapToGrid,
            },
          }));
        },

        // Interaction actions
        startPanning: (position: Position) => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              isPanning: true,
              lastInteractionPosition: position,
            },
          }));
        },

        updatePanning: (position: Position) => {
          const { isPanning, lastInteractionPosition } = get().interaction;
          
          if (!isPanning) return;

          const delta = {
            x: position.x - lastInteractionPosition.x,
            y: position.y - lastInteractionPosition.y,
          };

          get().panBy(delta);
          
          set((state) => ({
            interaction: {
              ...state.interaction,
              lastInteractionPosition: position,
            },
          }));
        },

        endPanning: () => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              isPanning: false,
            },
          }));
        },

        startSelection: (position: Position) => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              isSelecting: true,
              selectionRect: {
                x: position.x,
                y: position.y,
                width: 0,
                height: 0,
              },
              lastInteractionPosition: position,
            },
          }));
        },

        updateSelection: (position: Position) => {
          const { isSelecting, selectionRect } = get().interaction;
          
          if (!isSelecting || !selectionRect) return;

          const width = position.x - selectionRect.x;
          const height = position.y - selectionRect.y;
          
          set((state) => ({
            interaction: {
              ...state.interaction,
              selectionRect: {
                x: selectionRect.x,
                y: selectionRect.y,
                width,
                height,
              },
              lastInteractionPosition: position,
            },
          }));
        },

        endSelection: () => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              isSelecting: false,
              selectionRect: undefined,
            },
          }));
        },

        // Initialization actions
        initialize: (canvasDimensions: Dimensions) => {
          set((state) => ({
            viewport: {
              ...state.viewport,
              bounds: {
                x: 0,
                y: 0,
                width: canvasDimensions.width,
                height: canvasDimensions.height,
              },
              center: {
                x: canvasDimensions.width / 2,
                y: canvasDimensions.height / 2,
              },
            },
            isInitialized: true,
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
            zoom: state.viewport.zoom,
            panOffset: state.viewport.panOffset,
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
  getPanOffset: (state: CanvasStore) => state.viewport.panOffset,
  isGridVisible: (state: CanvasStore) => state.config.showGrid,
  isSnapToGridEnabled: (state: CanvasStore) => state.config.snapToGrid,
  isPanning: (state: CanvasStore) => state.interaction.isPanning,
  isSelecting: (state: CanvasStore) => state.interaction.isSelecting,
};