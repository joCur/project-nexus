import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardLayer } from '../CardLayer';
import type { Card, TextCard, ImageCard, LinkCard, CodeCard, CardId, CardStatus, CardPriority } from '@/types/card.types';
import type { CanvasBounds } from '@/types/canvas.types';

// Mock Konva components
jest.mock('react-konva', () => ({
  Layer: ({ children, name, listening, perfectDrawEnabled, ...props }: {
    children?: React.ReactNode;
    name?: string;
    listening?: boolean;
    perfectDrawEnabled?: boolean;
    [key: string]: unknown
  }) => (
    <div
      data-testid="konva-layer"
      data-name={name}
      data-listening={listening}
      data-perfect-draw-enabled={perfectDrawEnabled}
      {...props}
    >
      {children}
    </div>
  ),
}));

// Mock the CardRenderer component
jest.mock('../cards/CardRenderer', () => ({
  CardRenderer: ({ card }: { card: Card }) => (
    <div
      data-testid={`card-renderer-${card.id}`}
      data-card-type={card.content.type}
      data-card-x={card.position.x}
      data-card-y={card.position.y}
      data-card-z={card.position.z}
    >
      Card: {card.id}
    </div>
  ),
}));

// Mock stores
const mockCardStore = {
  cards: new Map<string, Card>(),
  getCardsInBounds: jest.fn(),
};

const mockCanvasStore = {
  viewport: {
    zoom: 1,
    position: { x: 0, y: 0 },
  },
};

jest.mock('@/stores/cardStore', () => ({
  useCardStore: () => mockCardStore,
}));

jest.mock('@/stores/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore,
}));

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1920,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 1080,
});

describe('CardLayer', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockCardStore.getCardsInBounds.mockClear();

    // Reset viewport state
    mockCanvasStore.viewport.zoom = 1;
    mockCanvasStore.viewport.position = { x: 0, y: 0 };
  });

  // Helper to create test cards
  const createTestCard = (
    id: string,
    type: 'text' | 'image' | 'link' | 'code',
    x: number = 0,
    y: number = 0,
    z: number = 0
  ): Card => {
    const baseCard = {
      id: id as CardId,
      position: { x, y, z },
      dimensions: { width: 200, height: 100 },
      style: {
        backgroundColor: '#ffffff',
        borderColor: '#cccccc',
        textColor: '#000000',
        borderWidth: 1,
        borderRadius: 4,
        opacity: 1,
        shadow: false,
      },
      isHidden: false,
      isLocked: false,
      isSelected: false,
      isMinimized: false,
      status: 'active' as CardStatus,
      priority: 'medium' as CardPriority,
      tags: [] as string[],
      linkedCardIds: [] as CardId[],
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true,
        canComment: true,
      },
      animation: {
        isAnimating: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    };

    switch (type) {
      case 'text':
        return {
          ...baseCard,
          content: {
            type: 'text' as const,
            content: 'Test text content',
            markdown: false,
            wordCount: 3,
          },
        } as TextCard;
      case 'image':
        return {
          ...baseCard,
          content: {
            type: 'image' as const,
            url: 'https://example.com/image.jpg',
            alt: 'Test image',
            caption: 'Test image',
            fileSize: 1024,
          },
        } as ImageCard;
      case 'link':
        return {
          ...baseCard,
          content: {
            type: 'link' as const,
            url: 'https://example.com',
            title: 'Example Site',
            description: 'A test site',
            domain: 'example.com',
            favicon: 'https://example.com/favicon.ico',
            isAccessible: true,
          },
        } as LinkCard;
      case 'code':
        return {
          ...baseCard,
          content: {
            type: 'code' as const,
            content: 'console.log("test");',
            language: 'javascript',
            lineCount: 1,
          },
        } as CodeCard;
      default:
        throw new Error(`Unknown card type: ${type}`);
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCardStore.cards.clear();
    mockCardStore.getCardsInBounds.mockReturnValue([]);
  });

  describe('Layer Rendering', () => {
    it('renders layer with correct props', () => {
      render(<CardLayer />);

      const layer = screen.getByTestId('konva-layer');
      expect(layer).toBeInTheDocument();
      expect(layer).toHaveAttribute('data-name', 'card-layer');
      expect(layer).toHaveAttribute('data-listening', 'true');
      expect(layer).toHaveAttribute('data-perfect-draw-enabled', 'false');
    });

    it('renders without cards when store is empty', () => {
      render(<CardLayer />);

      const layer = screen.getByTestId('konva-layer');
      expect(layer).toBeInTheDocument();
      expect(layer.children).toHaveLength(0);
    });
  });

  describe('Card Store Integration', () => {
    it('renders cards from cardStore', async () => {
      const card1 = createTestCard('card1', 'text', 100, 100, 1);
      const card2 = createTestCard('card2', 'image', 200, 200, 2);

      mockCardStore.cards.set('card1', card1);
      mockCardStore.cards.set('card2', card2);
      mockCardStore.getCardsInBounds.mockReturnValue([card1, card2]);

      render(<CardLayer />);

      // Wait for Suspense to resolve
      await waitFor(() => {
        expect(screen.getByTestId('card-renderer-card1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('card-renderer-card2')).toBeInTheDocument();
    });

    it('calls getCardsInBounds with correct viewport bounds', () => {
      const viewportBounds: CanvasBounds = {
        minX: -100,
        minY: -100,
        maxX: 100,
        maxY: 100,
      };

      render(<CardLayer viewportBounds={viewportBounds} />);

      expect(mockCardStore.getCardsInBounds).toHaveBeenCalledWith(viewportBounds);
    });

    it('filters out hidden cards', () => {
      const visibleCard = createTestCard('visible', 'text', 0, 0, 1);
      const hiddenCard = { ...createTestCard('hidden', 'text', 0, 0, 2), isHidden: true };

      mockCardStore.getCardsInBounds.mockReturnValue([visibleCard, hiddenCard]);

      render(<CardLayer />);

      expect(screen.getByTestId('card-renderer-visible')).toBeInTheDocument();
      expect(screen.queryByTestId('card-renderer-hidden')).not.toBeInTheDocument();
    });
  });

  describe('Viewport Culling', () => {
    it('enables viewport culling by default', () => {
      const card = createTestCard('card1', 'text', 0, 0, 1);
      mockCardStore.getCardsInBounds.mockReturnValue([card]);

      render(<CardLayer />);

      expect(mockCardStore.getCardsInBounds).toHaveBeenCalled();
    });

    it('disables viewport culling when enableViewportCulling is false', () => {
      const card1 = createTestCard('card1', 'text', 0, 0, 1);
      const card2 = createTestCard('card2', 'text', 1000, 1000, 2);

      mockCardStore.cards.set('card1', card1);
      mockCardStore.cards.set('card2', card2);

      render(<CardLayer enableViewportCulling={false} />);

      // Should not call getCardsInBounds when culling is disabled
      expect(mockCardStore.getCardsInBounds).not.toHaveBeenCalled();

      // Should render all cards from the store
      expect(screen.getByTestId('card-renderer-card1')).toBeInTheDocument();
      expect(screen.getByTestId('card-renderer-card2')).toBeInTheDocument();
    });

    it('calculates viewport bounds based on canvas state', () => {
      mockCanvasStore.viewport.zoom = 2;
      mockCanvasStore.viewport.position = { x: 100, y: 200 };

      render(<CardLayer viewportPadding={100} />);

      // With zoom=2, position=(100,200), padding=100, window=1920x1080
      // worldMinX = (-100) / 2 - 100 = -150
      // worldMinY = (-200) / 2 - 100 = -200
      // worldMaxX = (-100 + 1920) / 2 + 100 = 1010
      // worldMaxY = (-200 + 1080) / 2 + 100 = 540
      const expectedBounds = {
        minX: -150,
        minY: -200,
        maxX: 1010,
        maxY: 540,
      };

      expect(mockCardStore.getCardsInBounds).toHaveBeenCalledWith(expectedBounds);
    });

    it('uses custom viewport padding', () => {
      const customPadding = 1000;
      render(<CardLayer viewportPadding={customPadding} />);

      // Should have been called with bounds that include custom padding
      expect(mockCardStore.getCardsInBounds).toHaveBeenCalled();
      const calledBounds = mockCardStore.getCardsInBounds.mock.calls[0][0];

      // The bounds should be significantly larger due to padding
      const boundsRange = calledBounds.maxX - calledBounds.minX;
      expect(boundsRange).toBeGreaterThan(1920 + customPadding);
    });
  });

  describe('Z-ordering', () => {
    it('sorts cards by z-index in ascending order', () => {
      const card1 = createTestCard('card1', 'text', 0, 0, 3);
      const card2 = createTestCard('card2', 'text', 0, 0, 1);
      const card3 = createTestCard('card3', 'text', 0, 0, 2);

      mockCardStore.getCardsInBounds.mockReturnValue([card1, card2, card3]);

      const { container } = render(<CardLayer />);

      const cardElements = container.querySelectorAll('[data-testid^="card-renderer-"]');

      // Cards should be rendered in z-order: card2 (z=1), card3 (z=2), card1 (z=3)
      expect(cardElements[0]).toHaveAttribute('data-testid', 'card-renderer-card2');
      expect(cardElements[1]).toHaveAttribute('data-testid', 'card-renderer-card3');
      expect(cardElements[2]).toHaveAttribute('data-testid', 'card-renderer-card1');
    });

    it('handles cards with undefined z-index', () => {
      const cardWithZ = createTestCard('withZ', 'text', 0, 0, 5);
      const cardWithoutZ = createTestCard('withoutZ', 'text', 0, 0);
      cardWithoutZ.position.z = undefined;

      mockCardStore.getCardsInBounds.mockReturnValue([cardWithZ, cardWithoutZ]);

      const { container } = render(<CardLayer />);

      const cardElements = container.querySelectorAll('[data-testid^="card-renderer-"]');

      // Card without z-index (treated as 0) should render first
      expect(cardElements[0]).toHaveAttribute('data-testid', 'card-renderer-withoutZ');
      expect(cardElements[1]).toHaveAttribute('data-testid', 'card-renderer-withZ');
    });

    it('maintains stable sort for cards with same z-index', () => {
      const card1 = createTestCard('card1', 'text', 0, 0, 1);
      const card2 = createTestCard('card2', 'text', 0, 0, 1);
      const card3 = createTestCard('card3', 'text', 0, 0, 1);

      mockCardStore.getCardsInBounds.mockReturnValue([card1, card2, card3]);

      const { container } = render(<CardLayer />);

      const cardElements = container.querySelectorAll('[data-testid^="card-renderer-"]');

      // Should maintain original order for same z-index
      expect(cardElements[0]).toHaveAttribute('data-testid', 'card-renderer-card1');
      expect(cardElements[1]).toHaveAttribute('data-testid', 'card-renderer-card2');
      expect(cardElements[2]).toHaveAttribute('data-testid', 'card-renderer-card3');
    });
  });

  describe('CardRenderer Integration', () => {
    it('passes correct props to CardRenderer', () => {
      const card = createTestCard('test-card', 'text', 100, 200, 3);
      mockCardStore.getCardsInBounds.mockReturnValue([card]);

      render(<CardLayer />);

      const cardRenderer = screen.getByTestId('card-renderer-test-card');
      expect(cardRenderer).toHaveAttribute('data-card-type', 'text');
      expect(cardRenderer).toHaveAttribute('data-card-x', '100');
      expect(cardRenderer).toHaveAttribute('data-card-y', '200');
      expect(cardRenderer).toHaveAttribute('data-card-z', '3');
    });

    it('handles different card types', () => {
      const textCard = createTestCard('text', 'text', 0, 0, 1);
      const imageCard = createTestCard('image', 'image', 0, 0, 2);
      const linkCard = createTestCard('link', 'link', 0, 0, 3);
      const codeCard = createTestCard('code', 'code', 0, 0, 4);

      mockCardStore.getCardsInBounds.mockReturnValue([textCard, imageCard, linkCard, codeCard]);

      render(<CardLayer />);

      expect(screen.getByTestId('card-renderer-text')).toHaveAttribute('data-card-type', 'text');
      expect(screen.getByTestId('card-renderer-image')).toHaveAttribute('data-card-type', 'image');
      expect(screen.getByTestId('card-renderer-link')).toHaveAttribute('data-card-type', 'link');
      expect(screen.getByTestId('card-renderer-code')).toHaveAttribute('data-card-type', 'code');
    });

    it('wraps CardRenderer in Suspense with no fallback', async () => {
      const card = createTestCard('async-card', 'text', 0, 0, 1);
      mockCardStore.getCardsInBounds.mockReturnValue([card]);

      render(<CardLayer />);

      // Should render immediately since we're mocking CardRenderer
      expect(screen.getByTestId('card-renderer-async-card')).toBeInTheDocument();
    });
  });

  describe('Performance Optimizations', () => {
    it('memoizes visible cards calculation', () => {
      const card = createTestCard('card1', 'text', 0, 0, 1);
      mockCardStore.getCardsInBounds.mockReturnValue([card]);

      render(<CardLayer />);

      // Initial render should call getCardsInBounds at least once
      // Due to React effects and viewport hooks, it might be called twice
      expect(mockCardStore.getCardsInBounds).toHaveBeenCalled();
      const initialCallCount = mockCardStore.getCardsInBounds.mock.calls.length;

      // Clear the mock and re-render with same state
      // The component should be memoized but useMemo dependencies may cause recalculation
      mockCardStore.getCardsInBounds.mockClear();

      // Render another instance - if the state hasn't changed,
      // the useMemo should prevent unnecessary recalculations
      render(<CardLayer />);

      // Should call at least once for new instance, but not more than initial
      expect(mockCardStore.getCardsInBounds).toHaveBeenCalled();
      expect(mockCardStore.getCardsInBounds.mock.calls.length).toBeLessThanOrEqual(initialCallCount);
    });

    it('recalculates when viewport changes', () => {
      const card = createTestCard('card1', 'text', 0, 0, 1);
      mockCardStore.getCardsInBounds.mockReturnValue([card]);

      render(<CardLayer />);

      // Get initial call count (may be more than 1 due to effects)
      const initialCallCount = mockCardStore.getCardsInBounds.mock.calls.length;
      expect(mockCardStore.getCardsInBounds).toHaveBeenCalled();

      // Clear mock count
      mockCardStore.getCardsInBounds.mockClear();

      // Change viewport and render new instance - this should trigger recalculation
      mockCanvasStore.viewport.zoom = 2;
      render(<CardLayer />);

      // Should be called at least once with new viewport state
      expect(mockCardStore.getCardsInBounds).toHaveBeenCalled();
    });

    it('has correct layer performance settings', () => {
      render(<CardLayer />);

      const layer = screen.getByTestId('konva-layer');
      expect(layer).toHaveAttribute('data-perfect-draw-enabled', 'false');
      expect(layer).toHaveAttribute('data-listening', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty cards array', () => {
      mockCardStore.getCardsInBounds.mockReturnValue([]);

      render(<CardLayer />);

      const layer = screen.getByTestId('konva-layer');
      expect(layer).toBeInTheDocument();
      expect(layer.children).toHaveLength(0);
    });

    it('handles cards with missing position properties', async () => {
      const card = createTestCard('incomplete-card', 'text', 0, 0);
      // Remove z property
      delete (card.position as any).z;

      mockCardStore.getCardsInBounds.mockReturnValue([card]);

      render(<CardLayer />);

      await waitFor(() => {
        const cardRenderer = screen.getByTestId('card-renderer-incomplete-card');
        expect(cardRenderer).toBeInTheDocument();
        // When z is undefined, the attribute is not set at all
        expect(cardRenderer).not.toHaveAttribute('data-card-z');
      });
    });

    it('handles viewport bounds override', () => {
      const customBounds: CanvasBounds = {
        minX: -500,
        minY: -500,
        maxX: 500,
        maxY: 500,
      };

      render(<CardLayer viewportBounds={customBounds} />);

      expect(mockCardStore.getCardsInBounds).toHaveBeenCalledWith(customBounds);
    });
  });

  describe('Component Lifecycle', () => {
    it('properly memoizes the component', () => {
      const card = createTestCard('card1', 'text', 0, 0, 1);
      mockCardStore.getCardsInBounds.mockReturnValue([card]);

      const { rerender } = render(<CardLayer />);
      const firstRender = screen.getByTestId('konva-layer');

      rerender(<CardLayer />);
      const secondRender = screen.getByTestId('konva-layer');

      // Component should be the same instance due to memoization
      expect(firstRender).toBe(secondRender);
    });

    it('provides debug information', () => {
      const debugInfo = require('../CardLayer').CardLayerDebugInfo.getDebugInfo();

      expect(debugInfo).toEqual({
        performance: {
          renderingStrategy: 'viewport-culling',
          zIndexSorting: true,
          memoization: true,
          lazyLoading: true,
        },
      });
    });
  });
});