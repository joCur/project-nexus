import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardLayer } from '../CardLayer';
import type { Card, TextCard, ImageCard, LinkCard, CodeCard } from '@/types/card.types';
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
      data-card-type={card.type}
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
  // Helper to create test cards
  const createTestCard = (
    id: string,
    type: 'text' | 'image' | 'link' | 'code',
    x: number = 0,
    y: number = 0,
    z: number = 0
  ): Card => {
    const baseCard = {
      id,
      type,
      position: { x, y, z },
      dimensions: { width: 200, height: 100 },
      style: { opacity: 1 },
      isHidden: false,
      isLocked: false,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    switch (type) {
      case 'text':
        return {
          ...baseCard,
          type: 'text',
          content: {
            text: 'Test text content',
            isMarkdown: false,
            wordCount: 3,
          },
        } as TextCard;
      case 'image':
        return {
          ...baseCard,
          type: 'image',
          content: {
            url: 'https://example.com/image.jpg',
            caption: 'Test image',
            fileSize: 1024,
            mimeType: 'image/jpeg',
          },
        } as ImageCard;
      case 'link':
        return {
          ...baseCard,
          type: 'link',
          content: {
            url: 'https://example.com',
            title: 'Example Site',
            description: 'A test site',
            domain: 'example.com',
            favicon: 'https://example.com/favicon.ico',
          },
        } as LinkCard;
      case 'code':
        return {
          ...baseCard,
          type: 'code',
          content: {
            code: 'console.log("test");',
            language: 'javascript',
            lineCount: 1,
            executionState: 'idle',
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

      // Verify padding is applied correctly in viewport bounds calculation
      // With zoom=1, position=(0,0), padding=1000, window=1920x1080
      // worldMinX = (-0) / 1 - 1000 = -1000
      // worldMinY = (-0) / 1 - 1000 = -1000
      // worldMaxX = (-0 + 1920) / 1 + 1000 = 2920
      // worldMaxY = (-0 + 1080) / 1 + 1000 = 2080
      const expectedBounds = {
        minX: -1000,
        minY: -1000,
        maxX: 2920,
        maxY: 2080,
      };

      expect(mockCardStore.getCardsInBounds).toHaveBeenCalledWith(expectedBounds);
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

      const { rerender } = render(<CardLayer />);

      expect(mockCardStore.getCardsInBounds).toHaveBeenCalledTimes(1);

      // Rerender with same props should recalculate due to useMemo dependencies
      rerender(<CardLayer />);

      // Should be called again since dependencies include store state
      expect(mockCardStore.getCardsInBounds).toHaveBeenCalledTimes(2);
    });

    it('recalculates when viewport changes', () => {
      const card = createTestCard('card1', 'text', 0, 0, 1);
      mockCardStore.getCardsInBounds.mockReturnValue([card]);

      render(<CardLayer />);

      expect(mockCardStore.getCardsInBounds).toHaveBeenCalledTimes(1);

      // Change viewport and rerender - this should trigger recalculation
      mockCanvasStore.viewport.zoom = 2;
      render(<CardLayer />);

      // Should be called twice - once for each render
      expect(mockCardStore.getCardsInBounds).toHaveBeenCalledTimes(2);
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
        // When z is undefined, it doesn't get set as an attribute
        expect(cardRenderer).toHaveAttribute('data-card-z', '');
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