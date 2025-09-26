/**
 * Card Store Implementation
 *
 * Manages only transient UI state: selection, drag operations, resize, hover.
 * Server data (cards) comes from GraphQL queries for multi-device synchronization.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  CardStore,
  CardId,
} from '@/types/card.types';
import type { Position } from '@/types/common.types';
import type { CanvasPosition } from '@/types/canvas.types';

/**
 * Minimal card store implementation with UI state only
 */
export const useCardStore = create<CardStore>()(
  devtools(
    persist(
      (set, get) => ({
        // UI State only - server data comes from GraphQL queries
        selection: {
          selectedIds: new Set(),
          lastSelected: undefined,
          primarySelected: undefined,
          selectionBounds: undefined,
          mode: 'single',
          isDragSelection: false,
        },
        dragState: {
          isDragging: false,
          draggedIds: new Set(),
          startPosition: { x: 0, y: 0 },
          currentOffset: { x: 0, y: 0 },
        },
        resizeState: {
          isResizing: false,
          cardId: undefined,
          handle: undefined,
          originalDimensions: undefined,
          minDimensions: { width: 100, height: 50 },
          maxDimensions: { width: 2000, height: 2000 },
          maintainAspectRatio: false,
        },
        hoverState: {
          hoveredId: undefined,
          hoverStartTime: undefined,
          showTooltip: false,
          tooltipPosition: undefined,
        },

        // Selection management (UI state only)
        selectCard: (id: CardId, addToSelection: boolean = false) => {
          set((state) => {
            let selectedIds = new Set(state.selection.selectedIds);

            if (addToSelection) {
              if (selectedIds.has(id)) {
                selectedIds.delete(id);
              } else {
                selectedIds.add(id);
              }
            } else {
              selectedIds = new Set([id]);
            }

            return {
              ...state,
              selection: {
                ...state.selection,
                selectedIds,
                lastSelected: id,
                primarySelected: selectedIds.size === 1 ? id : state.selection.primarySelected,
              },
            };
          });
        },

        selectCards: (ids: CardId[]) => {
          set((state) => ({
            ...state,
            selection: {
              ...state.selection,
              selectedIds: new Set(ids),
              lastSelected: ids[ids.length - 1],
              primarySelected: ids[0],
            },
          }));
        },

        clearSelection: () => {
          set((state) => ({
            ...state,
            selection: {
              ...state.selection,
              selectedIds: new Set(),
              lastSelected: undefined,
              primarySelected: undefined,
              selectionBounds: undefined,
            },
          }));
        },

        isCardSelected: (id: CardId) => {
          return get().selection.selectedIds.has(id);
        },

        // Drag operations
        startDrag: (ids: CardId[], startPosition: CanvasPosition) => {
          set((state) => ({
            ...state,
            dragState: {
              ...state.dragState,
              isDragging: true,
              draggedIds: new Set(ids),
              startPosition,
              currentOffset: { x: 0, y: 0 },
            },
          }));
        },

        updateDrag: (currentOffset: Position) => {
          set((state) => ({
            ...state,
            dragState: {
              ...state.dragState,
              currentOffset,
            },
          }));
        },

        endDrag: (finalPosition?: CanvasPosition) => {
          set((state) => ({
            ...state,
            dragState: {
              ...state.dragState,
              isDragging: false,
              draggedIds: new Set(),
              currentOffset: { x: 0, y: 0 },
            },
          }));
        },

        cancelDrag: () => {
          set((state) => ({
            ...state,
            dragState: {
              ...state.dragState,
              isDragging: false,
              draggedIds: new Set(),
              currentOffset: { x: 0, y: 0 },
            },
          }));
        },

        // Resize operations
        startResize: (id: CardId, handle: any) => {
          set((state) => ({
            ...state,
            resizeState: {
              ...state.resizeState,
              isResizing: true,
              cardId: id,
              handle,
              minDimensions: { width: 100, height: 50 },
              maxDimensions: { width: 2000, height: 2000 },
            },
          }));
        },

        updateResize: (dimensions: any) => {
          set((state) => ({
            ...state,
            resizeState: {
              ...state.resizeState,
              // Store the new dimensions in originalDimensions for now
              originalDimensions: dimensions,
            },
          }));
        },

        endResize: () => {
          set((state) => ({
            ...state,
            resizeState: {
              ...state.resizeState,
              isResizing: false,
              cardId: undefined,
              handle: undefined,
            },
          }));
        },

        cancelResize: () => {
          set((state) => ({
            ...state,
            resizeState: {
              ...state.resizeState,
              isResizing: false,
              cardId: undefined,
              handle: undefined,
            },
          }));
        },

        // Hover operations
        setHoveredCard: (id: CardId | undefined) => {
          set((state) => ({
            ...state,
            hoverState: {
              ...state.hoverState,
              hoveredId: id,
            },
          }));
        },
      }),
      {
        name: 'card-store',
        // Only persist UI state, not server data
        partialize: (state) => ({
          selection: {
            selectedIds: Array.from(state.selection.selectedIds), // Convert Set to Array for JSON serialization
            lastSelected: state.selection.lastSelected,
            primarySelected: state.selection.primarySelected,
            mode: state.selection.mode,
          },
        }),
        // Custom merge function to handle Set serialization
        merge: (persistedState: any, currentState: CardStore): CardStore => ({
          ...currentState,
          selection: {
            ...currentState.selection,
            selectedIds: new Set(persistedState?.selection?.selectedIds || []),
            lastSelected: persistedState?.selection?.lastSelected,
            primarySelected: persistedState?.selection?.primarySelected,
            mode: persistedState?.selection?.mode || 'single',
          },
        }),
      }
    ),
    {
      name: 'CardStore',
    }
  )
);

// Selectors for common use cases
export const cardSelectors = {
  getSelection: (state: CardStore) => state.selection,
  getDragState: (state: CardStore) => state.dragState,
  getResizeState: (state: CardStore) => state.resizeState,
  getHoverState: (state: CardStore) => state.hoverState,
  getSelectedIds: (state: CardStore) => Array.from(state.selection.selectedIds),
  getSelectedCount: (state: CardStore) => state.selection.selectedIds.size,
  isDragging: (state: CardStore) => state.dragState.isDragging,
  isResizing: (state: CardStore) => state.resizeState.isResizing,
  getHoveredCardId: (state: CardStore) => state.hoverState.hoveredId,
};