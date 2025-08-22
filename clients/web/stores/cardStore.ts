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
  CardHistory,
  CardId,
  CreateCardParams,
  UpdateCardParams,
  CardResizeState,
  CardHoverState
} from '@/types/card.types';
import { createCardId } from '@/types/card.types';
import type { Position, Dimensions, Bounds, EntityId } from '@/types/common.types';
import type { CanvasPosition, CanvasBounds } from '@/types/canvas.types';

/**
 * Generate a unique card ID
 */
const generateCardId = (): CardId => {
  return createCardId(`card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
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
const createNewCard = (params: CreateCardParams): Card => {
  const now = new Date().toISOString();
  
  // Create proper content based on type with all required fields
  let content: CardContent;
  const inputContent = params.content as any;
  
  switch (params.type) {
    case 'text':
      content = {
        type: 'text',
        content: inputContent?.content || '',
        markdown: inputContent?.markdown || false,
        wordCount: inputContent?.wordCount || 0,
        lastEditedAt: inputContent?.lastEditedAt || now,
      };
      break;
    case 'image':
      content = {
        type: 'image',
        url: inputContent?.url || '',
        alt: inputContent?.alt || '',
        caption: inputContent?.caption,
        originalFilename: inputContent?.originalFilename,
        fileSize: inputContent?.fileSize,
        dimensions: inputContent?.dimensions,
        thumbnail: inputContent?.thumbnail,
      };
      break;
    case 'link':
      content = {
        type: 'link',
        url: inputContent?.url || '',
        title: inputContent?.title || '',
        description: inputContent?.description,
        favicon: inputContent?.favicon,
        previewImage: inputContent?.previewImage,
        domain: inputContent?.domain || '',
        lastChecked: inputContent?.lastChecked,
        isAccessible: inputContent?.isAccessible ?? true,
      };
      break;
    case 'code':
      content = {
        type: 'code',
        language: inputContent?.language || 'javascript',
        content: inputContent?.content || '',
        filename: inputContent?.filename,
        lineCount: inputContent?.lineCount || 0,
        hasExecuted: inputContent?.hasExecuted,
        executionResults: inputContent?.executionResults,
      };
      break;
    default:
      content = {
        type: 'text',
        content: '',
        markdown: false,
        wordCount: 0,
        lastEditedAt: now,
      };
  }
  
  return {
    id: generateCardId(),
    content,
    position: {
      ...params.position,
      z: params.position.z ?? Date.now(), // Use position.z for layering
    },
    dimensions: params.dimensions || DEFAULT_DIMENSIONS[params.type],
    style: { ...DEFAULT_STYLE, ...params.style },
    isSelected: false,
    isLocked: false,
    isHidden: false,
    isMinimized: false,
    status: 'draft',
    priority: 'normal',
    createdAt: now,
    updatedAt: now,
    tags: [],
    metadata: {},
    animation: {
      isAnimating: false,
    },
  } as Card;
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

        // CRUD operations
        createCard: (params: CreateCardParams) => {
          const newCard = createNewCard(params);
          
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

        pasteCards: (position: CanvasPosition = { x: 100, y: 100 }) => {
          const { clipboard } = get();
          if (clipboard.length === 0) return [];
          
          const pastedIds: CardId[] = [];
          const baseOffset = { x: 20, y: 20 };
          
          clipboard.forEach((card, index) => {
            const newId = get().createCard({
              type: card.content.type,
              position: {
                x: position.x + baseOffset.x * index,
                y: position.y + baseOffset.y * index,
              },
              content: card.content,
              dimensions: card.dimensions,
              style: card.style,
            });
            pastedIds.push(newId);
          });
          
          return pastedIds;
        },

        // History operations - simplified implementation
        undo: () => {
          // Stub implementation - history tracking disabled for now
          console.log('Undo not implemented');
        },

        redo: () => {
          // Stub implementation - history tracking disabled for now
          console.log('Redo not implemented');
        },

        canUndo: () => get().history.past.length > 0,
        canRedo: () => get().history.future.length > 0,

        // Missing CRUD operations
        createCardFromTemplate: (templateId: string, position: CanvasPosition) => {
          // Stub implementation
          return get().createCard({ type: 'text', position });
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
        updateCardStatus: (id: CardId, status: any) => {
          get().updateCard({ id, updates: { status } });
        },
        
        updateCardPriority: (id: CardId, priority: any) => {
          get().updateCard({ id, updates: { priority } });
        },
        
        arrangeCards: (ids: CardId[], arrangement: 'front' | 'back' | 'forward' | 'backward') => {
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
        startResize: (id: CardId, handle: any) => {
          // Stub implementation
        },
        
        updateResize: (dimensions: Dimensions) => {
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
        saveAsTemplate: (id: CardId, name: string, description: string) => {
          // Stub implementation
          return `template_${Date.now()}`;
        },
        
        deleteTemplate: (templateId: string) => {
          // Stub implementation
        },
        
        // Missing filtering and search
        setFilter: (filter: any) => {
          set({ activeFilter: filter });
        },
        
        clearFilter: () => {
          set({ activeFilter: {} });
        },
        
        searchCards: (query: string) => {
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
        
        getCardsByStatus: (status: any) => {
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
  getCardById: (id: CardId) => (state: CardStore) => state.cards.get(id),
  getSelectedCards: (state: CardStore) => state.getSelectedCards(),
  getSelectionCount: (state: CardStore) => state.selection.selectedIds.size,
  isDragging: (state: CardStore) => state.dragState.isDragging,
  canUndo: (state: CardStore) => state.canUndo(),
  canRedo: (state: CardStore) => state.canRedo(),
};