/**
 * Card Store Implementation
 * 
 * Manages card entities, selection, drag operations, and undo/redo history
 * for the infinite canvas system.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  CardStore,
  Card,
  CardType,
  CardStyle,
  CardStatus,
  CardPriority,
  CardId,
  UpdateCardParams} from '@/types/card.types';
import { createCardId } from '@/types/card.types';
import type { Position, Dimensions } from '@/types/common.types';
import type { CanvasPosition, CanvasBounds } from '@/types/canvas.types';

/**
 * Generate a unique card ID (used for client-side operations like duplicateCard)
 */
const generateCardId = (): CardId => {
  return createCardId(`card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
};

/**
 * Card store implementation
 */
export const useCardStore = create<CardStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        cards: new Map(),
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
          maxDimensions: { width: 1000, height: 800 },
          maintainAspectRatio: false,
        },
        hoverState: {
          hoveredId: undefined,
          hoverStartTime: undefined,
          showTooltip: false,
          tooltipPosition: undefined,
        },
        clipboard: [],
        history: {
          past: [],
          present: new Map(),
          future: [],
          maxHistorySize: 50,
        },
        templates: new Map(),
        activeFilter: {},
        searchResults: [],

        // CRUD operations - Cards are now created via GraphQL mutations only

        // Add card from server response (for Apollo cache updates)
        addCard: (card: Card) => {
          set((state) => {
            const newCards = new Map(state.cards);
            newCards.set(card.id, card);

            return {
              cards: newCards,
              history: state.history,
            };
          });
        },

        updateCard: (params: UpdateCardParams) => {
          const { id, updates } = params;
          set((state) => {
            const card = state.cards.get(id);
            if (!card) return state;
            
            const updatedCard = {
              ...card,
              ...updates,
              updatedAt: new Date().toISOString(),
            } as Card;
            
            const newCards = new Map(state.cards);
            newCards.set(id, updatedCard);
            
            return {
              cards: newCards,
              history: state.history, // Simplified - not tracking history for now
            };
          });
        },

        deleteCard: (id: CardId) => {
          set((state) => {
            const newCards = new Map(state.cards);
            newCards.delete(id);
            
            const newSelectedIds = new Set(state.selection.selectedIds);
            newSelectedIds.delete(id);
            
            return {
              cards: newCards,
              selection: {
                ...state.selection,
                selectedIds: newSelectedIds,
                lastSelected: state.selection.lastSelected === id 
                  ? undefined 
                  : state.selection.lastSelected,
              },
            };
          });
        },

        deleteCards: (ids: CardId[]) => {
          set((state) => {
            const newCards = new Map(state.cards);
            const newSelectedIds = new Set(state.selection.selectedIds);
            
            ids.forEach((id) => {
              newCards.delete(id);
              newSelectedIds.delete(id);
            });
            
            return {
              cards: newCards,
              selection: {
                ...state.selection,
                selectedIds: newSelectedIds,
                lastSelected: state.selection.lastSelected && ids.includes(state.selection.lastSelected) 
                  ? undefined 
                  : state.selection.lastSelected,
              },
            };
          });
        },

        duplicateCard: (id: CardId, offset: Position = { x: 20, y: 20 }) => {
          const card = get().cards.get(id);
          if (!card) return createCardId('');
          
          const newCard = {
            ...card,
            id: generateCardId(),
            position: {
              x: card.position.x + offset.x,
              y: card.position.y + offset.y,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Card;
          
          set((state) => {
            const newCards = new Map(state.cards);
            newCards.set(newCard.id, newCard);
            
            return {
              cards: newCards,
              history: state.history, // Simplified - not tracking history for now
            };
          });
          
          return newCard.id;
        },

        // Selection management
        selectCard: (id: CardId, addToSelection: boolean = false) => {
          set((state) => {
            const newSelectedIds = addToSelection 
              ? new Set(state.selection.selectedIds)
              : new Set<CardId>();
            
            newSelectedIds.add(id);
            
            return {
              selection: {
                ...state.selection,
                selectedIds: newSelectedIds,
                lastSelected: id,
              },
            };
          });
        },

        selectCards: (ids: CardId[]) => {
          set((state) => ({
            selection: {
              ...state.selection,
              selectedIds: new Set(ids),
              lastSelected: ids[ids.length - 1],
            },
          }));
        },

        selectAll: () => {
          set((state) => ({
            selection: {
              ...state.selection,
              selectedIds: new Set(state.cards.keys()),
              lastSelected: Array.from(state.cards.keys()).pop(),
            },
          }));
        },

        clearSelection: () => {
          set((state) => ({
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

        // Card manipulation
        moveCard: (id: CardId, position: CanvasPosition) => {
          get().updateCard({ id, updates: { position } });
        },

        moveCards: (ids: CardId[], offset: Position) => {
          set((state) => {
            const newCards = new Map(state.cards);

            ids.forEach((id) => {
              const card = newCards.get(id);
              if (card) {
                const newPosition = {
                  x: card.position.x + offset.x,
                  y: card.position.y + offset.y,
                  z: card.position.z,
                };
                newCards.set(id, {
                  ...card,
                  position: newPosition,
                  updatedAt: new Date().toISOString(),
                });
              }
            });

            return {
              cards: newCards,
              history: state.history, // Simplified - not tracking history for now
            };
          });
        },

        resizeCard: (id: CardId, dimensions: Dimensions) => {
          get().updateCard({ id, updates: { dimensions } });
        },

        updateCardStyle: (id: CardId, style: Partial<CardStyle>) => {
          const card = get().cards.get(id);
          if (!card) return;
          
          get().updateCard({ 
            id, 
            updates: {
              style: { ...card.style, ...style },
            }
          });
        },

        bringToFront: (id: CardId) => {
          const card = get().cards.get(id);
          if (!card) return;
          
          get().updateCard({ 
            id, 
            updates: { 
              position: {
                ...card.position,
                z: Date.now()
              }
            }
          });
        },

        sendToBack: (id: CardId) => {
          const card = get().cards.get(id);
          if (!card) return;
          
          const minZ = Math.min(
            ...Array.from(get().cards.values()).map((c) => c.position.z ?? 0)
          );
          get().updateCard({ 
            id, 
            updates: { 
              position: {
                ...card.position,
                z: minZ - 1
              }
            }
          });
        },

        // Drag operations
        startDrag: (ids: CardId[], startPosition: CanvasPosition) => {
          set({
            dragState: {
              isDragging: true,
              draggedIds: new Set(ids),
              startPosition,
              currentOffset: { x: 0, y: 0 },
            },
          });
        },

        updateDrag: (currentOffset: Position) => {
          set((state) => ({
            dragState: {
              ...state.dragState,
              currentOffset,
            },
          }));
        },

        endDrag: (finalPosition?: CanvasPosition) => {
          const { draggedIds, startPosition } = get().dragState;

          if (finalPosition && draggedIds.size > 0) {
            const offset = {
              x: finalPosition.x - startPosition.x,
              y: finalPosition.y - startPosition.y,
            };
            get().moveCards(Array.from(draggedIds), offset);
          }

          set({
            dragState: {
              isDragging: false,
              draggedIds: new Set(),
              startPosition: { x: 0, y: 0 },
              currentOffset: { x: 0, y: 0 },
            },
          });
        },

        // Clipboard operations
        copyCards: (ids: CardId[]) => {
          const cards = ids
            .map((id) => get().cards.get(id))
            .filter((card): card is Card => card !== undefined);
          
          set({ clipboard: cards });
        },

        cutCards: (ids: CardId[]) => {
          get().copyCards(ids);
          get().deleteCards(ids);
        },

        pasteCards: () => {
          console.warn('pasteCards: Card creation should be done via GraphQL mutations');
          return [];
        },

        // History operations - simplified implementation
        undo: () => {
          // Stub implementation - history tracking disabled for now
        },

        redo: () => {
          // Stub implementation - history tracking disabled for now
        },

        canUndo: () => get().history.past.length > 0,
        canRedo: () => get().history.future.length > 0,

        // Missing CRUD operations
        createCardFromTemplate: () => {
          console.warn('createCardFromTemplate: Card creation should be done via GraphQL mutations');
          return createCardId('');
        },
        
        updateCards: (updates: UpdateCardParams[]) => {
          // Stub implementation
          updates.forEach(update => get().updateCard(update));
        },
        
        duplicateCards: (ids: CardId[], offset: Position = { x: 20, y: 20 }) => {
          return ids.map(id => get().duplicateCard(id, offset));
        },
        
        // Missing selection methods
        selectCardsInBounds: (bounds: CanvasBounds) => {
          const cardsInBounds = get().getCardsInBounds(bounds);
          get().selectCards(cardsInBounds.map(card => card.id));
        },
        
        invertSelection: () => {
          const allCards = Array.from(get().cards.keys());
          const selected = get().selection.selectedIds;
          const inverted = allCards.filter(id => !selected.has(id));
          get().selectCards(inverted);
        },
        
        // Missing card manipulation
        updateCardStatus: (id: CardId, status: CardStatus) => {
          get().updateCard({ id, updates: { status } });
        },

        updateCardPriority: (id: CardId, priority: CardPriority) => {
          get().updateCard({ id, updates: { priority } });
        },
        
        arrangeCards: () => {
          // Stub implementation
        },
        
        // Missing locking and visibility
        lockCard: (id: CardId) => {
          get().updateCard({ id, updates: { isLocked: true } });
        },
        
        unlockCard: (id: CardId) => {
          get().updateCard({ id, updates: { isLocked: false } });
        },
        
        toggleCardLock: (id: CardId) => {
          const card = get().getCard(id);
          if (card) {
            get().updateCard({ id, updates: { isLocked: !card.isLocked } });
          }
        },
        
        hideCard: (id: CardId) => {
          get().updateCard({ id, updates: { isHidden: true } });
        },
        
        showCard: (id: CardId) => {
          get().updateCard({ id, updates: { isHidden: false } });
        },
        
        toggleCardVisibility: (id: CardId) => {
          const card = get().getCard(id);
          if (card) {
            get().updateCard({ id, updates: { isHidden: !card.isHidden } });
          }
        },
        
        minimizeCard: (id: CardId) => {
          get().updateCard({ id, updates: { isMinimized: true } });
        },
        
        maximizeCard: (id: CardId) => {
          get().updateCard({ id, updates: { isMinimized: false } });
        },
        
        // Missing drag operations
        cancelDrag: () => {
          get().endDrag();
        },
        
        // Missing resize operations
        startResize: () => {
          // Stub implementation
        },

        updateResize: () => {
          // Stub implementation
        },
        
        endResize: () => {
          // Stub implementation
        },
        
        cancelResize: () => {
          // Stub implementation
        },
        
        // Missing hover operations
        setHoveredCard: (id: CardId | undefined) => {
          set((state) => ({
            hoverState: {
              ...state.hoverState,
              hoveredId: id,
              hoverStartTime: id ? Date.now() : undefined,
            },
          }));
        },
        
        // Missing history operations
        clearHistory: () => {
          set((state) => ({
            history: {
              ...state.history,
              past: [],
              future: [],
            },
          }));
        },
        
        // Missing template operations
        saveAsTemplate: () => {
          // Stub implementation
          return `template_${Date.now()}`;
        },

        deleteTemplate: () => {
          // Stub implementation
        },
        
        // Missing filtering and search
        setFilter: (filter: Record<string, unknown>) => {
          set({ activeFilter: filter });
        },
        
        clearFilter: () => {
          set({ activeFilter: {} });
        },
        
        searchCards: () => {
          // Stub implementation
          set({ searchResults: [] });
        },
        
        clearSearch: () => {
          set({ searchResults: [] });
        },
        
        // Utility
        getCard: (id: CardId) => get().cards.get(id),
        
        getCards: (ids?: CardId[]) => {
          if (ids) {
            return ids.map(id => get().cards.get(id)).filter((card): card is Card => card !== undefined);
          }
          return Array.from(get().cards.values());
        },
        
        getCardsByType: (type: CardType) => {
          return Array.from(get().cards.values()).filter(card => card.content.type === type);
        },
        
        getCardsByStatus: (status: CardStatus) => {
          return Array.from(get().cards.values()).filter(card => card.status === status);
        },
        
        getCardsByTag: (tag: string) => {
          return Array.from(get().cards.values()).filter(card => card.tags.includes(tag));
        },
        
        getCardCount: () => {
          return get().cards.size;
        },
        
        getCardBounds: (id: CardId) => {
          const card = get().getCard(id);
          if (!card) return undefined;
          return {
            minX: card.position.x,
            minY: card.position.y,
            maxX: card.position.x + card.dimensions.width,
            maxY: card.position.y + card.dimensions.height,
          };
        },
        
        getAllCardsBounds: () => {
          const cards = get().getCards();
          if (cards.length === 0) return undefined;
          
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          
          cards.forEach(card => {
            minX = Math.min(minX, card.position.x);
            minY = Math.min(minY, card.position.y);
            maxX = Math.max(maxX, card.position.x + card.dimensions.width);
            maxY = Math.max(maxY, card.position.y + card.dimensions.height);
          });
          
          return { minX, minY, maxX, maxY };
        },
        
        getSelectedCards: () => {
          const { selectedIds } = get().selection;
          return Array.from(selectedIds)
            .map((id) => get().cards.get(id))
            .filter((card): card is Card => card !== undefined);
        },
        
        getCardsInBounds: (bounds: CanvasBounds) => {
          return Array.from(get().cards.values()).filter((card) => {
            const cardRight = card.position.x + card.dimensions.width;
            const cardBottom = card.position.y + card.dimensions.height;
            const boundsRight = bounds.minX + (bounds.maxX - bounds.minX);
            const boundsBottom = bounds.minY + (bounds.maxY - bounds.minY);
            
            return !(
              card.position.x > boundsRight ||
              cardRight < bounds.minX ||
              card.position.y > boundsBottom ||
              cardBottom < bounds.minY
            );
          });
        },
      }),
      {
        name: 'card-store',
        // Only persist cards, not selection or drag state
        partialize: (state) => ({
          cards: Array.from(state.cards.entries()),
        }),
        // Custom merge function to handle Map serialization
        merge: (persistedState: unknown, currentState: CardStore): CardStore => ({
          ...currentState,
          cards: new Map((persistedState as { cards?: [CardId, Card][] })?.cards || []),
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
  getAllCards: (state: CardStore) => Array.from(state.cards.values()),
  getCardById: (id: CardId) => (state: CardStore) => state.cards.get(id),
  getSelectedCards: (state: CardStore) => state.getSelectedCards(),
  getSelectionCount: (state: CardStore) => state.selection.selectedIds.size,
  isDragging: (state: CardStore) => state.dragState.isDragging,
  canUndo: (state: CardStore) => state.canUndo(),
  canRedo: (state: CardStore) => state.canRedo(),
};