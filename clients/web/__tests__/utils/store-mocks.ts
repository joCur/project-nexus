/**
 * Store mocks for testing components that use Zustand stores
 */

import type { Card, CardId, CardType, CreateCardParams } from '@/types/card.types';
import { createCardId } from '@/types/card.types';
import type { CanvasPosition } from '@/types/canvas.types';
import { DEFAULT_CANVAS_CONFIG } from '@/lib/canvas-defaults';

// Mock card store state
export const createMockCardStore = (initialCards: Card[] = []) => {
  const cards = new Map<CardId, Card>();

  // Populate initial cards
  initialCards.forEach(card => {
    cards.set(card.id, card);
  });

  return {
    cards,
    isLoading: false,
    error: null,

    // Card operations
    createCard: jest.fn((params: CreateCardParams): CardId => {
      const idString = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const id = createCardId(idString);
      // Create a proper card using createTestCard
      const card = createTestCard(id, params.type || 'text', params.position || { x: 0, y: 0, z: 0 });
      cards.set(id, card);
      return id;
    }),

    updateCard: jest.fn(),
    deleteCard: jest.fn(),
    getCard: jest.fn((id: CardId) => cards.get(id)),
    getCardsInBounds: jest.fn(),
    selectCard: jest.fn(),
    deselectCard: jest.fn(),
    clearSelection: jest.fn(),

    // State getters
    getSelectedCards: jest.fn(() => []),
    getCardsByType: jest.fn((type: CardType) =>
      Array.from(cards.values()).filter(card => card.content.type === type)
    ),

    // Bulk operations
    deleteSelectedCards: jest.fn(),
    duplicateSelectedCards: jest.fn(),

    // Loading state
    setLoading: jest.fn(),
    setError: jest.fn(),
    clearError: jest.fn(),
  };
};

// Mock canvas store state
export const createMockCanvasStore = (
  viewport = {
    position: { x: 0, y: 0 },
    zoom: 1,
    bounds: { x: 0, y: 0, width: 1024, height: 768 }
  }
) => ({
  viewport,
  config: DEFAULT_CANVAS_CONFIG,

  // Viewport operations
  setPosition: jest.fn(),
  setZoom: jest.fn(),
  zoomToFit: jest.fn(),
  centerOn: jest.fn(),
  panTo: jest.fn(),

  // Canvas operations
  resetCanvas: jest.fn(),
  getCanvasBounds: jest.fn(() => viewport.bounds),
  screenToCanvas: jest.fn((x: number, y: number) => ({
    x: (x - viewport.position.x) / viewport.zoom,
    y: (y - viewport.position.y) / viewport.zoom,
  })),
  canvasToScreen: jest.fn((x: number, y: number) => ({
    x: x * viewport.zoom + viewport.position.x,
    y: y * viewport.zoom + viewport.position.y,
  })),

  // Selection state
  selectedCards: new Set<CardId>(),
  setSelectedCards: jest.fn(),
  addToSelection: jest.fn(),
  removeFromSelection: jest.fn(),
  clearSelection: jest.fn(),

  // Canvas state
  isGridVisible: true,
  isRulerVisible: false,
  snapToGrid: false,
  gridSize: 20,

  setGridVisible: jest.fn(),
  setRulerVisible: jest.fn(),
  setSnapToGrid: jest.fn(),
  setGridSize: jest.fn(),
});

// Mock workspace store (if needed)
export const createMockWorkspaceStore = () => ({
  currentWorkspace: null,
  workspaces: [],
  isLoading: false,
  error: null,

  setCurrentWorkspace: jest.fn(),
  loadWorkspaces: jest.fn(),
  createWorkspace: jest.fn(),
  updateWorkspace: jest.fn(),
  deleteWorkspace: jest.fn(),
});

// Store mock setup function for tests
export const setupStoreMocks = () => {
  // Mock card store
  jest.mock('@/stores/cardStore', () => ({
    useCardStore: () => createMockCardStore(),
  }));

  // Mock canvas store
  jest.mock('@/stores/canvasStore', () => ({
    useCanvasStore: () => createMockCanvasStore(),
  }));

  // Mock workspace store
  jest.mock('@/stores/workspaceStore', () => ({
    useWorkspaceStore: () => createMockWorkspaceStore(),
  }));
};

// Helper to create test cards
export const createTestCard = (
  id: CardId,
  type: CardType = 'text',
  position: CanvasPosition = { x: 0, y: 0, z: 0 }
): Card => {
  // Create content based on type with proper discriminated union
  let content;
  switch (type) {
    case 'text':
      content = {
        type: 'text' as const,
        content: 'Test content',
        markdown: false,
        wordCount: 2,
        lastEditedAt: new Date().toISOString(),
      };
      break;
    case 'image':
      content = {
        type: 'image' as const,
        url: 'https://example.com/image.jpg',
        alt: 'Test image',
        caption: 'Test caption',
      };
      break;
    case 'link':
      content = {
        type: 'link' as const,
        url: 'https://example.com',
        title: 'Test link',
        domain: 'example.com',
        isAccessible: true,
      };
      break;
    case 'code':
      content = {
        type: 'code' as const,
        language: 'javascript',
        content: 'console.log("test");',
        lineCount: 1,
      };
      break;
    default:
      throw new Error(`Unsupported card type: ${type}`);
  }

  return {
    id,
    content,
    position,
    dimensions: { width: 200, height: 100 },
    style: {
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      textColor: '#000000',
      borderWidth: 1,
      borderRadius: 8,
      opacity: 1,
      shadow: false,
    },
    isSelected: false,
    isLocked: false,
    isHidden: false,
    isMinimized: false,
    status: 'active',
    priority: 'normal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user',
      version: 1,
      status: 'active',
      priority: 'normal',
    },
    animation: {
      isAnimating: false,
    },
  } as Card;
};

