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
  CardContent, 
  CardStyle,
  CardSelection,
  CardDragState,
  CardHistory 
} from '@/types/card.types';
import type { Position, Dimensions, Bounds, EntityId } from '@/types/common.types';

/**
 * Generate a unique ID for entities
 */
const generateId = (): EntityId => {
  return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Default card style
 */
const DEFAULT_STYLE: CardStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#e5e7eb',
  textColor: '#1f2937',
  borderWidth: 1,
  borderRadius: 8,
  opacity: 1,
  shadow: true,
};

/**
 * Default card dimensions by type
 */
const DEFAULT_DIMENSIONS: Record<CardType, Dimensions> = {
  text: { width: 300, height: 200 },
  image: { width: 400, height: 300 },
  link: { width: 350, height: 150 },
  code: { width: 500, height: 300 },
};

/**
 * Create a new card with defaults
 */
const createNewCard = (
  type: CardType,
  position: Position,
  content?: Partial<CardContent>
): Card => {
  const now = new Date().toISOString();
  
  return {
    id: generateId(),
    type,
    content: content || {},
    position,
    dimensions: DEFAULT_DIMENSIONS[type],
    style: DEFAULT_STYLE,
    zIndex: Date.now(), // Simple z-index based on creation time
    isSelected: false,
    isLocked: false,
    createdAt: now,
    updatedAt: now,
    tags: [],
    metadata: {},
  };
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
          selectionBounds: undefined,
        },
        dragState: {
          isDragging: false,
          draggedIds: [],
          startPosition: { x: 0, y: 0 },
          currentOffset: { x: 0, y: 0 },
        },
        clipboard: [],
        history: {
          past: [],
          present: new Map(),
          future: [],
        },

        // CRUD operations
        createCard: (type: CardType, position: Position, content?: Partial<CardContent>) => {
          const newCard = createNewCard(type, position, content);
          
          set((state) => {
            const newCards = new Map(state.cards);
            newCards.set(newCard.id, newCard);
            
            return {
              cards: newCards,
              history: {
                past: [...state.history.past, state.cards],
                present: newCards,
                future: [],
              },
            };
          });
          
          return newCard.id;
        },

        updateCard: (id: EntityId, updates: Partial<Card>) => {
          set((state) => {
            const card = state.cards.get(id);
            if (!card) return state;
            
            const updatedCard = {
              ...card,
              ...updates,
              updatedAt: new Date().toISOString(),
            };
            
            const newCards = new Map(state.cards);
            newCards.set(id, updatedCard);
            
            return {
              cards: newCards,
              history: {
                past: [...state.history.past, state.cards],
                present: newCards,
                future: [],
              },
            };
          });
        },

        deleteCard: (id: EntityId) => {
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
              history: {
                past: [...state.history.past, state.cards],
                present: newCards,
                future: [],
              },
            };
          });
        },

        deleteCards: (ids: EntityId[]) => {
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
                lastSelected: ids.includes(state.selection.lastSelected || '') 
                  ? undefined 
                  : state.selection.lastSelected,
              },
              history: {
                past: [...state.history.past, state.cards],
                present: newCards,
                future: [],
              },
            };
          });
        },

        duplicateCard: (id: EntityId, offset: Position = { x: 20, y: 20 }) => {
          const card = get().cards.get(id);
          if (!card) return '';
          
          const newCard = {
            ...card,
            id: generateId(),
            position: {
              x: card.position.x + offset.x,
              y: card.position.y + offset.y,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          set((state) => {
            const newCards = new Map(state.cards);
            newCards.set(newCard.id, newCard);
            
            return {
              cards: newCards,
              history: {
                past: [...state.history.past, state.cards],
                present: newCards,
                future: [],
              },
            };
          });
          
          return newCard.id;
        },

        // Selection management
        selectCard: (id: EntityId, addToSelection: boolean = false) => {
          set((state) => {
            const newSelectedIds = addToSelection 
              ? new Set(state.selection.selectedIds)
              : new Set<EntityId>();
            
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

        selectCards: (ids: EntityId[]) => {
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
              selectedIds: new Set(),
              lastSelected: undefined,
              selectionBounds: undefined,
            },
          }));
        },

        isCardSelected: (id: EntityId) => {
          return get().selection.selectedIds.has(id);
        },

        // Card manipulation
        moveCard: (id: EntityId, position: Position) => {
          get().updateCard(id, { position });
        },

        moveCards: (ids: EntityId[], offset: Position) => {
          set((state) => {
            const newCards = new Map(state.cards);
            
            ids.forEach((id) => {
              const card = newCards.get(id);
              if (card) {
                newCards.set(id, {
                  ...card,
                  position: {
                    x: card.position.x + offset.x,
                    y: card.position.y + offset.y,
                  },
                  updatedAt: new Date().toISOString(),
                });
              }
            });
            
            return {
              cards: newCards,
              history: {
                past: [...state.history.past, state.cards],
                present: newCards,
                future: [],
              },
            };
          });
        },

        resizeCard: (id: EntityId, dimensions: Dimensions) => {
          get().updateCard(id, { dimensions });
        },

        updateCardStyle: (id: EntityId, style: Partial<CardStyle>) => {
          const card = get().cards.get(id);
          if (!card) return;
          
          get().updateCard(id, {
            style: { ...card.style, ...style },
          });
        },

        bringToFront: (id: EntityId) => {
          get().updateCard(id, { zIndex: Date.now() });
        },

        sendToBack: (id: EntityId) => {
          const minZIndex = Math.min(
            ...Array.from(get().cards.values()).map((c) => c.zIndex)
          );
          get().updateCard(id, { zIndex: minZIndex - 1 });
        },

        // Drag operations
        startDrag: (ids: EntityId[], startPosition: Position) => {
          set({
            dragState: {
              isDragging: true,
              draggedIds: ids,
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

        endDrag: (finalPosition?: Position) => {
          const { draggedIds, startPosition } = get().dragState;
          
          if (finalPosition && draggedIds.length > 0) {
            const offset = {
              x: finalPosition.x - startPosition.x,
              y: finalPosition.y - startPosition.y,
            };
            get().moveCards(draggedIds, offset);
          }
          
          set({
            dragState: {
              isDragging: false,
              draggedIds: [],
              startPosition: { x: 0, y: 0 },
              currentOffset: { x: 0, y: 0 },
            },
          });
        },

        // Clipboard operations
        copyCards: (ids: EntityId[]) => {
          const cards = ids
            .map((id) => get().cards.get(id))
            .filter((card): card is Card => card !== undefined);
          
          set({ clipboard: cards });
        },

        cutCards: (ids: EntityId[]) => {
          get().copyCards(ids);
          get().deleteCards(ids);
        },

        pasteCards: (position: Position = { x: 100, y: 100 }) => {
          const { clipboard } = get();
          if (clipboard.length === 0) return [];
          
          const pastedIds: EntityId[] = [];
          const baseOffset = { x: 20, y: 20 };
          
          clipboard.forEach((card, index) => {
            const newId = get().createCard(
              card.type,
              {
                x: position.x + baseOffset.x * index,
                y: position.y + baseOffset.y * index,
              },
              card.content
            );
            pastedIds.push(newId);
          });
          
          return pastedIds;
        },

        // History operations
        undo: () => {
          set((state) => {
            if (state.history.past.length === 0) return state;
            
            const previous = state.history.past[state.history.past.length - 1];
            const newPast = state.history.past.slice(0, -1);
            
            return {
              cards: previous,
              history: {
                past: newPast,
                present: previous,
                future: [state.cards, ...state.history.future],
              },
            };
          });
        },

        redo: () => {
          set((state) => {
            if (state.history.future.length === 0) return state;
            
            const next = state.history.future[0];
            const newFuture = state.history.future.slice(1);
            
            return {
              cards: next,
              history: {
                past: [...state.history.past, state.cards],
                present: next,
                future: newFuture,
              },
            };
          });
        },

        canUndo: () => get().history.past.length > 0,
        canRedo: () => get().history.future.length > 0,

        // Utility
        getCard: (id: EntityId) => get().cards.get(id),
        
        getCards: () => Array.from(get().cards.values()),
        
        getSelectedCards: () => {
          const { selectedIds } = get().selection;
          return Array.from(selectedIds)
            .map((id) => get().cards.get(id))
            .filter((card): card is Card => card !== undefined);
        },
        
        getCardsInBounds: (bounds: Bounds) => {
          return Array.from(get().cards.values()).filter((card) => {
            const cardRight = card.position.x + card.dimensions.width;
            const cardBottom = card.position.y + card.dimensions.height;
            const boundsRight = bounds.x + bounds.width;
            const boundsBottom = bounds.y + bounds.height;
            
            return !(
              card.position.x > boundsRight ||
              cardRight < bounds.x ||
              card.position.y > boundsBottom ||
              cardBottom < bounds.y
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
        merge: (persistedState: any, currentState) => ({
          ...currentState,
          cards: new Map(persistedState?.cards || []),
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
  getCardById: (id: EntityId) => (state: CardStore) => state.cards.get(id),
  getSelectedCards: (state: CardStore) => state.getSelectedCards(),
  getSelectionCount: (state: CardStore) => state.selection.selectedIds.size,
  isDragging: (state: CardStore) => state.dragState.isDragging,
  canUndo: (state: CardStore) => state.canUndo(),
  canRedo: (state: CardStore) => state.canRedo(),
};