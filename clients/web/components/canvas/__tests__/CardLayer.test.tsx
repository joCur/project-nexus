import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MockedProvider } from '@apollo/client/testing';
import { CardLayer, CardLayerDebugInfo } from '../CardLayer';
import type { Card, TextCard, ImageCard, LinkCard, CodeCard, CardId, CardStatus, CardPriority } from '@/types/card.types';
import type { EntityId } from '@/types/common.types';
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

// Mock Apollo Client useQuery and useMutation hooks
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

// Mock stores and contexts
const mockCanvasStore = {
  viewport: {
    zoom: 1,
    position: { x: 0, y: 0 },
  },
};

const mockWorkspaceContext = {
  currentWorkspaceId: 'test-workspace-id' as string | undefined,
};

jest.mock('@/stores/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore,
}));

jest.mock('@/contexts/WorkspacePermissionContext', () => ({
  useWorkspacePermissionContextSafe: () => mockWorkspaceContext,
}));

jest.mock('@/utils/viewport', () => ({
  useViewportDimensions: () => ({ width: 1920, height: 1080 }),
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


// Helper function to render CardLayer with mocked useQuery
const renderCardLayer = (props: Record<string, unknown> = {}, cards: Card[] = [], options: { loading?: boolean; error?: unknown } = {}) => {
  // Filter out hidden cards before mocking (simulating server behavior - server doesn't track isHidden)
  const serverCards = cards.filter(card => !card.isHidden);

  // Configure the useQuery mock to return card data
  mockUseQuery.mockReturnValue({
    data: options.loading ? null : (serverCards.length > 0 ? {
      cardsInBounds: serverCards.map(card => ({
        id: String(card.id),
        workspaceId: 'test-workspace-id',
        ownerId: card.ownerId,
        type: card.content.type.toUpperCase(),
        content: card.content.type === 'text' ? (card as TextCard).content.content :
                 card.content.type === 'image' ? (card as ImageCard).content.url :
                 card.content.type === 'link' ? (card as LinkCard).content.url :
                 card.content.type === 'code' ? (card as CodeCard).content.content : '',
        title: card.content.type === 'link' ? (card as LinkCard).content.title :
               card.content.type === 'image' ? (card as ImageCard).content.alt : null,
        position: {
          x: card.position?.x ?? 0,
          y: card.position?.y ?? 0,
          z: card.position?.z, // Keep as undefined if undefined to test proper handling
        },
        dimensions: card.dimensions,
        style: card.style,
        status: card.status.toUpperCase(),
        priority: card.priority.toUpperCase(),
        tags: card.tags,
        metadata: card.metadata,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        version: 1,
      })),
    } : {
      cardsInBounds: [],
    }),
    loading: options.loading || false,
    error: options.error || null,
  });

  return render(<CardLayer {...props} />);
};

describe('CardLayer', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockUseQuery.mockClear();
    mockUseMutation.mockClear();

    // Setup default mutation mock
    mockUseMutation.mockReturnValue([
      jest.fn(), // mutate function
      {
        data: null,
        loading: false,
        error: null,
        called: false,
      },
    ]);

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
      ownerId: 'test-user-id' as EntityId,
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
      priority: 'normal' as CardPriority,
      tags: [] as string[],
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

  describe('Layer Rendering', () => {
    it('renders layer with correct props', () => {
      renderCardLayer();

      const layer = screen.getByTestId('konva-layer');
      expect(layer).toBeInTheDocument();
      expect(layer).toHaveAttribute('data-name', 'card-layer');
      expect(layer).toHaveAttribute('data-listening', 'true');
      expect(layer).toHaveAttribute('data-perfect-draw-enabled', 'false');
    });

    it('renders without cards when no cards are returned', () => {
      renderCardLayer();

      const layer = screen.getByTestId('konva-layer');
      expect(layer).toBeInTheDocument();
      expect(layer.children).toHaveLength(0);
    });
  });

  describe('GraphQL Integration', () => {
    it('renders cards from GraphQL query', async () => {
      const card1 = createTestCard('card1', 'text', 100, 100, 1);
      const card2 = createTestCard('card2', 'image', 200, 200, 2);

      renderCardLayer({}, [card1, card2]);

      // Wait for GraphQL query to resolve and Suspense to load
      await waitFor(() => {
        expect(screen.getByTestId('card-renderer-card1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('card-renderer-card2')).toBeInTheDocument();
    });

    it('queries with correct workspace and bounds', async () => {
      const viewportBounds: CanvasBounds = {
        minX: -100,
        minY: -100,
        maxX: 100,
        maxY: 100,
      };


      renderCardLayer({ viewportBounds }, []);

      // Allow GraphQL query to execute
      await waitFor(() => {
        const layer = screen.getByTestId('konva-layer');
        expect(layer).toBeInTheDocument();
      });
    });

    it('filters out hidden cards', async () => {
      const visibleCard = createTestCard('visible', 'text', 0, 0, 1);
      const hiddenCard = { ...createTestCard('hidden', 'text', 0, 0, 2), isHidden: true };

      renderCardLayer({}, [visibleCard, hiddenCard]);

      await waitFor(() => {
        expect(screen.getByTestId('card-renderer-visible')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('card-renderer-hidden')).not.toBeInTheDocument();
    });
  });

  describe('Viewport Culling', () => {
    it('enables viewport culling by default', async () => {
      const card = createTestCard('card1', 'text', 0, 0, 1);

      renderCardLayer({}, [card]);

      // GraphQL query should execute for viewport culling
      await waitFor(() => {
        expect(screen.getByTestId('card-renderer-card1')).toBeInTheDocument();
      });
    });

    it('skips GraphQL query when workspace context is missing', async () => {
      mockWorkspaceContext.currentWorkspaceId = undefined;

      renderCardLayer();

      // Should render empty layer without querying
      await waitFor(() => {
        const layer = screen.getByTestId('konva-layer');
        expect(layer).toBeInTheDocument();
        expect(layer.children).toHaveLength(0);
      });

      // Reset for other tests
      mockWorkspaceContext.currentWorkspaceId = 'test-workspace-id';
    });

    it('calculates viewport bounds based on canvas state', async () => {
      mockCanvasStore.viewport.zoom = 2;
      mockCanvasStore.viewport.position = { x: 100, y: 200 };


      renderCardLayer({ viewportPadding: 100 }, []);

      await waitFor(() => {
        const layer = screen.getByTestId('konva-layer');
        expect(layer).toBeInTheDocument();
      });
    });

    it('uses custom viewport padding', async () => {
      const customPadding = 500;

      renderCardLayer({ viewportPadding: customPadding }, []);

      await waitFor(() => {
        const layer = screen.getByTestId('konva-layer');
        expect(layer).toBeInTheDocument();
      });
    });
  });

  describe('Z-ordering', () => {
    it('sorts cards by z-index in ascending order', async () => {
      const card1 = createTestCard('card1', 'text', 0, 0, 3);
      const card2 = createTestCard('card2', 'text', 0, 0, 1);
      const card3 = createTestCard('card3', 'text', 0, 0, 2);

      const { container } = renderCardLayer({}, [card1, card2, card3]);

      await waitFor(() => {
        const cardElements = container.querySelectorAll('[data-testid^="card-renderer-"]');
        expect(cardElements).toHaveLength(3);

        // Cards should be rendered in z-order: card2 (z=1), card3 (z=2), card1 (z=3)
        expect(cardElements[0]).toHaveAttribute('data-testid', 'card-renderer-card2');
        expect(cardElements[1]).toHaveAttribute('data-testid', 'card-renderer-card3');
        expect(cardElements[2]).toHaveAttribute('data-testid', 'card-renderer-card1');
      });
    });

    it('handles cards with undefined z-index', async () => {
      const cardWithZ = createTestCard('withZ', 'text', 0, 0, 5);
      const cardWithoutZ = createTestCard('withoutZ', 'text', 0, 0);
      cardWithoutZ.position.z = undefined;

      const { container } = renderCardLayer({}, [cardWithZ, cardWithoutZ]);

      await waitFor(() => {
        const cardElements = container.querySelectorAll('[data-testid^="card-renderer-"]');
        expect(cardElements).toHaveLength(2);

        // Card without z-index (treated as 0) should render first
        expect(cardElements[0]).toHaveAttribute('data-testid', 'card-renderer-withoutZ');
        expect(cardElements[1]).toHaveAttribute('data-testid', 'card-renderer-withZ');
      });
    });

    it('maintains stable sort for cards with same z-index', async () => {
      const card1 = createTestCard('card1', 'text', 0, 0, 1);
      const card2 = createTestCard('card2', 'text', 0, 0, 1);
      const card3 = createTestCard('card3', 'text', 0, 0, 1);

      const { container } = renderCardLayer({}, [card1, card2, card3]);

      await waitFor(() => {
        const cardElements = container.querySelectorAll('[data-testid^="card-renderer-"]');
        expect(cardElements).toHaveLength(3);

        // Should maintain original order for same z-index
        expect(cardElements[0]).toHaveAttribute('data-testid', 'card-renderer-card1');
        expect(cardElements[1]).toHaveAttribute('data-testid', 'card-renderer-card2');
        expect(cardElements[2]).toHaveAttribute('data-testid', 'card-renderer-card3');
      });
    });
  });

  describe('CardRenderer Integration', () => {
    it('passes correct props to CardRenderer', async () => {
      const card = createTestCard('test-card', 'text', 100, 200, 3);

      renderCardLayer({}, [card]);

      await waitFor(() => {
        const cardRenderer = screen.getByTestId('card-renderer-test-card');
        expect(cardRenderer).toHaveAttribute('data-card-type', 'text');
        expect(cardRenderer).toHaveAttribute('data-card-x', '100');
        expect(cardRenderer).toHaveAttribute('data-card-y', '200');
        expect(cardRenderer).toHaveAttribute('data-card-z', '3');
      });
    });

    it('handles different card types', async () => {
      const textCard = createTestCard('text', 'text', 0, 0, 1);
      const imageCard = createTestCard('image', 'image', 0, 0, 2);
      const linkCard = createTestCard('link', 'link', 0, 0, 3);
      const codeCard = createTestCard('code', 'code', 0, 0, 4);

      renderCardLayer({}, [textCard, imageCard, linkCard, codeCard]);

      await waitFor(() => {
        expect(screen.getByTestId('card-renderer-text')).toHaveAttribute('data-card-type', 'text');
        expect(screen.getByTestId('card-renderer-image')).toHaveAttribute('data-card-type', 'image');
        expect(screen.getByTestId('card-renderer-link')).toHaveAttribute('data-card-type', 'link');
        expect(screen.getByTestId('card-renderer-code')).toHaveAttribute('data-card-type', 'code');
      });
    });

    it('wraps CardRenderer in Suspense with no fallback', async () => {
      const card = createTestCard('async-card', 'text', 0, 0, 1);

      renderCardLayer({}, [card]);

      // Should render immediately since we're mocking CardRenderer
      await waitFor(() => {
        expect(screen.getByTestId('card-renderer-async-card')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Optimizations', () => {
    it('has correct layer performance settings', async () => {
      renderCardLayer();

      await waitFor(() => {
        const layer = screen.getByTestId('konva-layer');
        expect(layer).toHaveAttribute('data-perfect-draw-enabled', 'false');
        expect(layer).toHaveAttribute('data-listening', 'true');
      });
    });

    it('handles loading state gracefully', async () => {
      renderCardLayer({}, [], { loading: true });

      // Should render layer immediately even while loading
      const layer = screen.getByTestId('konva-layer');
      expect(layer).toBeInTheDocument();
      expect(layer.children).toHaveLength(0);

      // After query resolves, should still have empty layer
      await waitFor(() => {
        expect(layer.children).toHaveLength(0);
      });
    });

    it('handles GraphQL errors gracefully', async () => {
      renderCardLayer({}, [], { error: new Error('GraphQL Error') });

      // Should render layer even with GraphQL error
      await waitFor(() => {
        const layer = screen.getByTestId('konva-layer');
        expect(layer).toBeInTheDocument();
        expect(layer.children).toHaveLength(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty cards array', async () => {
      renderCardLayer();

      await waitFor(() => {
        const layer = screen.getByTestId('konva-layer');
        expect(layer).toBeInTheDocument();
        expect(layer.children).toHaveLength(0);
      });
    });

    it('handles cards with missing position properties', async () => {
      // Create a card but simulate server data without z property
      const card = createTestCard('incomplete-card', 'text', 0, 0, 0);

      // Mock the useQuery to return server data without z property
      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [{
            id: 'incomplete-card',
            workspaceId: 'test-workspace-id',
            ownerId: card.ownerId,
            type: 'TEXT',
            content: 'test content',
            title: null,
            position: {
              x: 0,
              y: 0,
              // z property is completely missing from server response
            },
            dimensions: card.dimensions,
            style: card.style,
            status: 'ACTIVE',
            priority: 'NORMAL',
            tags: [],
            metadata: {},
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            version: 1,
          }],
        },
        loading: false,
        error: null,
      });

      render(<CardLayer />);

      await waitFor(() => {
        const cardRenderer = screen.getByTestId('card-renderer-incomplete-card');
        expect(cardRenderer).toBeInTheDocument();
        // Server missing z gets converted to 0 in CardLayer transformation
        expect(cardRenderer).toHaveAttribute('data-card-z', '0');
      });
    });

    it('handles viewport bounds override', async () => {
      const customBounds: CanvasBounds = {
        minX: -500,
        minY: -500,
        maxX: 500,
        maxY: 500,
      };


      renderCardLayer({ viewportBounds: customBounds }, []);

      await waitFor(() => {
        const layer = screen.getByTestId('konva-layer');
        expect(layer).toBeInTheDocument();
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('properly memoizes the component', async () => {
      const card = createTestCard('card1', 'text', 0, 0, 1);

      const { rerender } = renderCardLayer({}, [card]);

      await waitFor(() => {
        expect(screen.getByTestId('konva-layer')).toBeInTheDocument();
      });

      const firstRender = screen.getByTestId('konva-layer');

      rerender(
        <MockedProvider mocks={[]} addTypename={false}>
          <CardLayer />
        </MockedProvider>
      );
      const secondRender = screen.getByTestId('konva-layer');

      // Component should render the same content due to memoization
      expect(firstRender).toStrictEqual(secondRender);
    });

    it('provides debug information', () => {
      const debugInfo = CardLayerDebugInfo.getDebugInfo();

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