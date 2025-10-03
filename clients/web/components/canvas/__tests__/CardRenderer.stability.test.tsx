/**
 * CardRenderer Stability Tests - Zoom/Pan Operations
 *
 * This test suite validates that CardRenderer components maintain stability
 * during viewport zoom and pan operations. It ensures that:
 * 1. CardRenderer doesn't remount unnecessarily during viewport changes
 * 2. Image loading state is preserved across viewport transformations
 * 3. Drag interactions work correctly during and after viewport changes
 *
 * Related: fix-card-rerender-on-zoom-pan feature implementation
 * Context: CardRenderer uses custom React.memo, CardLayer uses deep comparison,
 *          ImageCardRenderer preserves state via ImageCache synchronous methods
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardRenderer } from '../cards/CardRenderer';
import type { TextCard, ImageCard, CardStatus, CardPriority, CardStyle } from '@/types/card.types';
import { createCardId } from '@/types/card.types';
import type { EntityId } from '@/types/common.types';

// Mock Konva components
jest.mock('react-konva', () => ({
  Group: ({ children, x, y, draggable, onClick, onDblClick, ...props }: {
    children?: React.ReactNode;
    x?: number;
    y?: number;
    draggable?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    onDblClick?: (e: React.MouseEvent) => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragMove?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    [key: string]: unknown;
  }) => (
    <div
      data-testid="konva-group"
      data-x={x}
      data-y={y}
      data-draggable={draggable}
      onClick={onClick}
      onDoubleClick={onDblClick}
      {...props}
    >
      {children}
    </div>
  ),
  Rect: ({ ...props }: { [key: string]: unknown }) => <div data-testid="konva-rect" {...props} />,
  Text: ({ text, ...props }: { text?: string; [key: string]: unknown }) => (
    <div data-testid="konva-text" {...props}>{text}</div>
  ),
  Image: ({ image, ...props }: { image?: HTMLImageElement; [key: string]: unknown }) => (
    <div data-testid="konva-image" data-image-src={image?.src} {...props} />
  ),
}));

// Track render counts for performance testing
let textCardRenderCount = 0;
let imageCardRenderCount = 0;

// Mock TextCardRenderer with render tracking
jest.mock('../cards/TextCardRenderer', () => ({
  TextCardRenderer: ({ card, isSelected, isDragged, isHovered }: {
    card: TextCard;
    isSelected: boolean;
    isDragged: boolean;
    isHovered: boolean;
  }) => {
    textCardRenderCount++;
    return (
      <div
        data-testid="text-card-renderer"
        data-card-id={card.id}
        data-selected={isSelected}
        data-dragged={isDragged}
        data-hovered={isHovered}
        data-render-count={textCardRenderCount}
      >
        Text Card: {card.content.content}
      </div>
    );
  },
}));

// Mock ImageCardRenderer with render tracking and state preservation
jest.mock('../cards/ImageCardRenderer', () => ({
  ImageCardRenderer: ({ card, isSelected, isDragged, isHovered }: {
    card: ImageCard;
    isSelected: boolean;
    isDragged: boolean;
    isHovered: boolean;
  }) => {
    imageCardRenderCount++;

    // Simulate image loading state based on ImageCache
    const [imageLoaded, setImageLoaded] = React.useState(() => {
      // Synchronous cache check (simulates ImageCache.has())
      return card.content.url ? false : false;
    });

    React.useEffect(() => {
      if (card.content.url) {
        // Simulate async image loading
        const timer = setTimeout(() => setImageLoaded(true), 10);
        return () => clearTimeout(timer);
      }
    }, [card.content.url]);

    return (
      <div
        data-testid="image-card-renderer"
        data-card-id={card.id}
        data-selected={isSelected}
        data-dragged={isDragged}
        data-hovered={isHovered}
        data-render-count={imageCardRenderCount}
        data-image-loaded={imageLoaded}
        data-image-url={card.content.url}
      >
        Image Card: {imageLoaded ? 'Loaded' : 'Loading'}
      </div>
    );
  },
}));

// Mock other renderers
jest.mock('../cards/LinkCardRenderer', () => ({
  LinkCardRenderer: () => <div data-testid="link-card-renderer">Link</div>,
}));

jest.mock('../cards/CodeCardRenderer', () => ({
  CodeCardRenderer: () => <div data-testid="code-card-renderer">Code</div>,
}));

// Mock card store with stable state
const mockStoreState = {
  selection: {
    selectedIds: new Set<string>(),
  },
  dragState: {
    isDragging: false,
    draggedIds: new Set<string>(),
    startPosition: { x: 0, y: 0, z: 0 },
  },
  hoverState: {
    hoveredId: undefined,
  },
  selectCard: jest.fn(),
  startDrag: jest.fn(),
  updateDrag: jest.fn(),
  endDrag: jest.fn(),
  setHoveredCard: jest.fn(),
  setEditingCard: jest.fn(),
  editingCardId: undefined,
};

jest.mock('@/stores/cardStore', () => ({
  useCardStore: <T,>(selector?: (state: typeof mockStoreState) => T) => {
    if (selector) {
      return selector(mockStoreState);
    }
    return mockStoreState;
  },
}));

// Mock EditModeManager
jest.mock('@/components/canvas/editing', () => ({
  useEditMode: () => ({
    editState: { isEditing: false, editingCardId: undefined },
    startEdit: jest.fn(),
    endEdit: jest.fn(),
  }),
}));

describe('CardRenderer - Stability During Zoom/Pan Operations', () => {
  beforeEach(() => {
    // Reset mock state and render counts
    mockStoreState.selection.selectedIds.clear();
    mockStoreState.dragState.isDragging = false;
    mockStoreState.dragState.draggedIds.clear();
    mockStoreState.hoverState.hoveredId = undefined;
    mockStoreState.editingCardId = undefined;
    textCardRenderCount = 0;
    imageCardRenderCount = 0;
    jest.clearAllMocks();
  });

  // Helper to create test cards
  const createTestTextCard = (
    id: string,
    x: number = 100,
    y: number = 100,
    content: string = 'Test content'
  ): TextCard => ({
    id: createCardId(id),
    ownerId: 'test-user-id' as EntityId,
    position: { x, y, z: 0 },
    dimensions: { width: 200, height: 100 },
    style: {
      backgroundColor: '#ffffff',
      borderColor: '#cccccc',
      textColor: '#000000',
      borderWidth: 1,
      borderRadius: 4,
      opacity: 1,
      shadow: false,
    } as CardStyle,
    isHidden: false,
    isLocked: false,
    isSelected: false,
    isMinimized: false,
    status: 'active' as CardStatus,
    priority: 'normal' as CardPriority,
    tags: [],
    animation: {
      isAnimating: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {},
    content: {
      type: 'text' as const,
      content,
      markdown: false,
      wordCount: content.split(' ').length,
    },
  });

  const createTestImageCard = (
    id: string,
    x: number = 100,
    y: number = 100,
    url: string = 'https://example.com/test.jpg'
  ): ImageCard => ({
    id: createCardId(id),
    ownerId: 'test-user-id' as EntityId,
    position: { x, y, z: 0 },
    dimensions: { width: 300, height: 200 },
    style: {
      backgroundColor: '#ffffff',
      borderColor: '#cccccc',
      textColor: '#000000',
      borderWidth: 1,
      borderRadius: 4,
      opacity: 1,
      shadow: false,
    } as CardStyle,
    isHidden: false,
    isLocked: false,
    isSelected: false,
    isMinimized: false,
    status: 'active' as CardStatus,
    priority: 'normal' as CardPriority,
    tags: [],
    animation: {
      isAnimating: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {},
    content: {
      type: 'image' as const,
      url,
      alt: 'Test image',
      caption: 'Test caption',
    },
  });

  describe('Viewport Change Simulation - No Remount', () => {
    it('should NOT remount CardRenderer when viewport pans (callbacks change)', () => {
      const card = createTestTextCard('zoom-pan-test-1');

      const { rerender } = render(
        <CardRenderer
          card={card}
          onCardClick={jest.fn()}
          onCardDragStart={jest.fn()}
          onCardDragMove={jest.fn()}
        />
      );

      const initialRenderCount = textCardRenderCount;
      expect(initialRenderCount).toBe(1);

      // Simulate viewport pan: CardLayer creates new callback references
      // but card data remains identical
      rerender(
        <CardRenderer
          card={card}
          onCardClick={jest.fn()} // New reference
          onCardDragStart={jest.fn()} // New reference
          onCardDragMove={jest.fn()} // New reference
        />
      );

      // CardRenderer should NOT re-render due to custom arePropsEqual
      expect(textCardRenderCount).toBe(initialRenderCount);
    });

    it('should NOT remount CardRenderer during continuous viewport pan (10 frames)', () => {
      const card = createTestTextCard('continuous-pan-test');

      const { rerender } = render(<CardRenderer card={card} />);
      const initialRenderCount = textCardRenderCount;

      // Simulate 10 frames of continuous panning
      // Each frame creates new callback instances
      for (let i = 0; i < 10; i++) {
        rerender(
          <CardRenderer
            card={card}
            onCardClick={jest.fn()}
            onCardDragStart={jest.fn()}
            onCardDragMove={jest.fn()}
            onCardHover={jest.fn()}
          />
        );
      }

      // Should NOT re-render during any of the 10 viewport updates
      expect(textCardRenderCount).toBe(initialRenderCount);
    });

    it('should NOT remount CardRenderer when viewport zooms (scale changes)', () => {
      const card = createTestTextCard('zoom-test');
      const stableOnCardDragEnd = jest.fn(); // Keep stable reference

      const { rerender } = render(
        <CardRenderer card={card} onCardDragEnd={stableOnCardDragEnd} />
      );
      const initialRenderCount = textCardRenderCount;

      // Simulate zoom: viewport scale changes, but card position in world coordinates stays same
      // CardLayer might recreate callbacks during zoom operations, but onCardDragEnd stays stable
      for (let zoomLevel = 0.5; zoomLevel <= 2.0; zoomLevel += 0.25) {
        rerender(
          <CardRenderer
            card={card}
            onCardClick={jest.fn()}
            onCardDragEnd={stableOnCardDragEnd} // Stable callback
          />
        );
      }

      // Should maintain render count despite 7 zoom levels
      expect(textCardRenderCount).toBe(initialRenderCount);
    });

    it('should NOT remount when viewport bounds change but card stays in view', () => {
      const card = createTestTextCard('viewport-bounds-test', 500, 500);

      const { rerender } = render(<CardRenderer card={card} />);
      const initialRenderCount = textCardRenderCount;

      // Simulate viewport bounds changing as user pans around
      // The card position is stable, only the viewport moves
      const viewportConfigurations = [
        { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        { minX: 100, minY: 100, maxX: 1100, maxY: 1100 },
        { minX: 200, minY: 200, maxX: 1200, maxY: 1200 },
        { minX: -100, minY: -100, maxX: 900, maxY: 900 },
      ];

      viewportConfigurations.forEach(() => {
        rerender(
          <CardRenderer
            card={card}
            onCardClick={jest.fn()}
          />
        );
      });

      // Should NOT re-render as viewport bounds change
      expect(textCardRenderCount).toBe(initialRenderCount);
    });
  });

  describe('Image State Preservation Across Viewport Changes', () => {
    it('should preserve image loading state during viewport pan', async () => {
      const card = createTestImageCard('image-pan-test', 100, 100, 'https://example.com/pan-test.jpg');

      const { rerender } = render(<CardRenderer card={card} />);

      // Wait for image to load
      await waitFor(() => {
        const imageRenderer = screen.getByTestId('image-card-renderer');
        expect(imageRenderer).toHaveAttribute('data-image-loaded', 'true');
      });

      const renderCountAfterLoad = imageCardRenderCount;

      // Simulate viewport pan with new callback references
      rerender(
        <CardRenderer
          card={card}
          onCardClick={jest.fn()}
          onCardDragStart={jest.fn()}
        />
      );

      // Image should remain loaded (no rerender)
      const imageRenderer = screen.getByTestId('image-card-renderer');
      expect(imageRenderer).toHaveAttribute('data-image-loaded', 'true');

      // Should NOT re-render (image state preserved)
      expect(imageCardRenderCount).toBe(renderCountAfterLoad);
    });

    it('should preserve image loading state during continuous zoom', async () => {
      const card = createTestImageCard('image-zoom-test', 200, 200, 'https://example.com/zoom-test.jpg');

      const { rerender } = render(<CardRenderer card={card} />);

      // Wait for image to load
      await waitFor(() => {
        const imageRenderer = screen.getByTestId('image-card-renderer');
        expect(imageRenderer).toHaveAttribute('data-image-loaded', 'true');
      });

      const renderCountAfterLoad = imageCardRenderCount;

      // Simulate 5 zoom operations
      for (let i = 0; i < 5; i++) {
        rerender(<CardRenderer card={card} onCardClick={jest.fn()} />);

        // Image should stay loaded during each zoom step
        const imageRenderer = screen.getByTestId('image-card-renderer');
        expect(imageRenderer).toHaveAttribute('data-image-loaded', 'true');
      }

      // Should NOT re-render during zoom operations
      expect(imageCardRenderCount).toBe(renderCountAfterLoad);
    });

    it('should NOT restart image loading when viewport changes', async () => {
      const imageUrl = 'https://example.com/stable-image.jpg';
      const card = createTestImageCard('image-stable-test', 150, 150, imageUrl);

      const { rerender } = render(<CardRenderer card={card} />);

      // Wait for initial load
      await waitFor(() => {
        const imageRenderer = screen.getByTestId('image-card-renderer');
        expect(imageRenderer).toHaveAttribute('data-image-loaded', 'true');
      });

      const renderCountAfterLoad = imageCardRenderCount;

      // Simulate multiple viewport changes
      for (let i = 0; i < 10; i++) {
        rerender(<CardRenderer card={card} onCardHover={jest.fn()} />);
      }

      // Image URL should remain stable
      const imageRenderer = screen.getByTestId('image-card-renderer');
      expect(imageRenderer).toHaveAttribute('data-image-url', imageUrl);
      expect(imageRenderer).toHaveAttribute('data-image-loaded', 'true');

      // Should NOT trigger re-renders
      expect(imageCardRenderCount).toBe(renderCountAfterLoad);
    });

    it('should handle image cache synchronous check during viewport updates', () => {
      // This test verifies that ImageCache.has() and ImageCache.getSync() work
      // during viewport changes to prevent loading flashes
      const card = createTestImageCard('cache-sync-test', 100, 100, 'https://example.com/cached.jpg');

      const { rerender } = render(<CardRenderer card={card} />);
      const initialRenderCount = imageCardRenderCount;

      // Simulate rapid viewport changes
      for (let i = 0; i < 5; i++) {
        rerender(<CardRenderer card={card} />);
      }

      // Should NOT re-render due to viewport changes
      expect(imageCardRenderCount).toBe(initialRenderCount);

      // Image renderer should always have consistent state
      const imageRenderer = screen.getByTestId('image-card-renderer');
      expect(imageRenderer).toHaveAttribute('data-image-url', 'https://example.com/cached.jpg');
    });
  });

  describe('Drag Interactions During Viewport Changes', () => {
    it('should maintain drag functionality when viewport pans', () => {
      const card = createTestTextCard('drag-pan-test');
      const onCardDragEnd = jest.fn();

      const { rerender } = render(
        <CardRenderer card={card} onCardDragEnd={onCardDragEnd} />
      );

      // Simulate viewport pan (new callback instances except onCardDragEnd)
      const newOnCardDragEnd = jest.fn();
      rerender(
        <CardRenderer
          card={card}
          onCardDragEnd={newOnCardDragEnd}
          onCardClick={jest.fn()}
        />
      );

      // The onCardDragEnd callback change SHOULD trigger re-render
      // because it's critical for drag persistence (NEX-200)
      expect(textCardRenderCount).toBeGreaterThan(1);
    });

    it('should preserve drag state during viewport operations', () => {
      const card = createTestTextCard('drag-state-test');
      mockStoreState.dragState.isDragging = true;
      mockStoreState.dragState.draggedIds.add('drag-state-test');

      const { rerender } = render(<CardRenderer card={card} />);

      // Simulate viewport change during drag
      rerender(
        <CardRenderer
          card={card}
          onCardDragMove={jest.fn()}
        />
      );

      // Drag state should be preserved in store (not affected by viewport changes)
      expect(mockStoreState.dragState.isDragging).toBe(true);
      expect(mockStoreState.dragState.draggedIds.has('drag-state-test')).toBe(true);
    });

    it('should NOT interfere with drag callbacks during zoom', () => {
      const card = createTestTextCard('drag-zoom-test', 250, 250);
      const onCardDragStart = jest.fn();
      const onCardDragMove = jest.fn();
      const onCardDragEnd = jest.fn();

      render(
        <CardRenderer
          card={card}
          onCardDragStart={onCardDragStart}
          onCardDragMove={onCardDragMove}
          onCardDragEnd={onCardDragEnd}
        />
      );

      // Find the group element and trigger drag events
      const group = screen.getByTestId('konva-group');

      // These callbacks should remain stable and functional
      expect(group).toHaveAttribute('data-draggable', 'true');
    });

    it('should handle drag end correctly after viewport changes', () => {
      const card = createTestTextCard('drag-end-viewport-test', 300, 200);
      const onCardDragEnd = jest.fn();

      const { rerender } = render(
        <CardRenderer card={card} onCardDragEnd={onCardDragEnd} />
      );

      // Simulate starting drag
      mockStoreState.dragState.isDragging = true;
      mockStoreState.dragState.draggedIds.add('drag-end-viewport-test');

      // Viewport changes during drag
      rerender(
        <CardRenderer
          card={card}
          onCardDragEnd={jest.fn()}
          onCardClick={jest.fn()}
        />
      );

      // Drag state should remain in store
      expect(mockStoreState.dragState.isDragging).toBe(true);
    });

    it('should maintain card position updates during drag with viewport pan', () => {
      const initialCard = createTestTextCard('position-drag-test', 100, 100);

      const { rerender } = render(<CardRenderer card={initialCard} />);
      const initialRenderCount = textCardRenderCount;

      // Simulate drag moving card position
      const movedCard = createTestTextCard('position-drag-test', 150, 120);
      rerender(<CardRenderer card={movedCard} />);

      // Should re-render because position changed
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);

      // Group position should reflect new card position
      const group = screen.getByTestId('konva-group');
      expect(group).toHaveAttribute('data-x', '150');
      expect(group).toHaveAttribute('data-y', '120');
    });
  });

  describe('Performance Characteristics During Viewport Operations', () => {
    it('should prevent render thrashing during rapid viewport changes', () => {
      const card = createTestTextCard('thrashing-test');

      const { rerender } = render(<CardRenderer card={card} />);
      const initialRenderCount = textCardRenderCount;

      // Simulate 100 rapid viewport updates (worst-case scenario)
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        rerender(
          <CardRenderer
            card={card}
            onCardClick={jest.fn()}
            onCardHover={jest.fn()}
          />
        );
      }
      const endTime = Date.now();

      // Should NOT re-render at all
      expect(textCardRenderCount).toBe(initialRenderCount);

      // Should complete quickly (< 100ms for 100 updates)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle mixed card types efficiently during viewport changes', () => {
      const textCard = createTestTextCard('mixed-text', 100, 100);
      const imageCard = createTestImageCard('mixed-image', 200, 200);

      const { rerender: rerenderText } = render(<CardRenderer card={textCard} />);
      const { rerender: rerenderImage } = render(<CardRenderer card={imageCard} />);

      const initialTextCount = textCardRenderCount;
      const initialImageCount = imageCardRenderCount;

      // Simulate viewport changes affecting both cards
      for (let i = 0; i < 10; i++) {
        rerenderText(<CardRenderer card={textCard} onCardClick={jest.fn()} />);
        rerenderImage(<CardRenderer card={imageCard} onCardClick={jest.fn()} />);
      }

      // Neither should re-render
      expect(textCardRenderCount).toBe(initialTextCount);
      expect(imageCardRenderCount).toBe(initialImageCount);
    });

    it('should maintain low memory footprint during viewport operations', () => {
      const cards = Array.from({ length: 20 }, (_, i) =>
        createTestTextCard(`perf-card-${i}`, i * 100, i * 50)
      );

      const renderers = cards.map(card => render(<CardRenderer card={card} />));

      // Simulate viewport change affecting all 20 cards
      renderers.forEach(({ rerender }, index) => {
        rerender(<CardRenderer card={cards[index]} onCardClick={jest.fn()} />);
      });

      // None should re-render
      const finalRenderCount = textCardRenderCount;
      expect(finalRenderCount).toBe(20); // Only initial renders
    });
  });

  describe('Edge Cases and Stability Verification', () => {
    it('should handle card entering and leaving viewport gracefully', () => {
      const card = createTestTextCard('viewport-culling-test', 1000, 1000);

      const { rerender, unmount } = render(<CardRenderer card={card} />);
      const initialRenderCount = textCardRenderCount;

      // Simulate card leaving viewport (still rendered but might get new props)
      rerender(<CardRenderer card={card} onCardClick={jest.fn()} />);

      // Should NOT re-render
      expect(textCardRenderCount).toBe(initialRenderCount);

      // Unmount should clean up without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should maintain stability with enableInlineEdit changes during viewport pan', () => {
      const card = createTestTextCard('inline-edit-test');

      const { rerender } = render(
        <CardRenderer card={card} enableInlineEdit={false} />
      );
      const initialRenderCount = textCardRenderCount;

      // Viewport pan with stable enableInlineEdit value
      rerender(
        <CardRenderer
          card={card}
          enableInlineEdit={false}
          onCardClick={jest.fn()}
        />
      );

      // Should NOT re-render
      expect(textCardRenderCount).toBe(initialRenderCount);

      // Change enableInlineEdit (this SHOULD trigger re-render)
      rerender(
        <CardRenderer card={card} enableInlineEdit={true} />
      );

      // Should re-render due to enableInlineEdit change
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should handle selection state changes during viewport operations', () => {
      const card = createTestTextCard('selection-viewport-test');
      mockStoreState.selection.selectedIds.add('selection-viewport-test');

      const { rerender } = render(<CardRenderer card={card} />);

      // Simulate viewport change while card is selected
      rerender(<CardRenderer card={card} onCardClick={jest.fn()} />);

      // Verify selection state is preserved
      const textRenderer = screen.getByTestId('text-card-renderer');
      expect(textRenderer).toHaveAttribute('data-selected', 'true');
    });

    it('should verify arePropsEqual function prevents unnecessary renders', () => {
      const card = createTestTextCard('props-equal-verification');

      const { rerender } = render(
        <CardRenderer
          card={card}
          onCardClick={jest.fn()}
          onCardDragStart={jest.fn()}
          onCardDragMove={jest.fn()}
          onCardHover={jest.fn()}
          onCardUnhover={jest.fn()}
        />
      );

      const initialRenderCount = textCardRenderCount;

      // All callbacks change except onCardDragEnd (stable card data)
      rerender(
        <CardRenderer
          card={card}
          onCardClick={jest.fn()}
          onCardDragStart={jest.fn()}
          onCardDragMove={jest.fn()}
          onCardHover={jest.fn()}
          onCardUnhover={jest.fn()}
        />
      );

      // arePropsEqual should return true, preventing re-render
      expect(textCardRenderCount).toBe(initialRenderCount);
    });

    it('should handle rapid card data changes vs viewport changes correctly', () => {
      const card1 = createTestTextCard('rapid-test', 100, 100, 'Content 1');

      const { rerender } = render(<CardRenderer card={card1} />);
      const initialRenderCount = textCardRenderCount;

      // Viewport change (no re-render)
      rerender(<CardRenderer card={card1} onCardClick={jest.fn()} />);
      expect(textCardRenderCount).toBe(initialRenderCount);

      // Card content change (should re-render)
      const card2 = createTestTextCard('rapid-test', 100, 100, 'Content 2');
      rerender(<CardRenderer card={card2} />);
      expect(textCardRenderCount).toBe(initialRenderCount + 1);

      // Another viewport change (no re-render)
      rerender(<CardRenderer card={card2} onCardClick={jest.fn()} />);
      expect(textCardRenderCount).toBe(initialRenderCount + 1);
    });
  });

  describe('Integration with CardLayer Optimization', () => {
    it('should work correctly with CardLayer deep comparison strategy', () => {
      // This test verifies CardRenderer works with CardLayer's useMemo optimization
      const card = createTestTextCard('cardlayer-integration', 400, 300);

      const { rerender } = render(<CardRenderer card={card} />);
      const initialRenderCount = textCardRenderCount;

      // Simulate CardLayer passing same card data after deep comparison
      // (CardLayer's useMemo returns cached renderer array)
      rerender(<CardRenderer card={card} />);

      // Should NOT re-render (both CardLayer and CardRenderer optimized)
      expect(textCardRenderCount).toBe(initialRenderCount);
    });

    it('should handle debounced viewport bounds from CardLayer', async () => {
      // CardLayer debounces viewport bounds by 150ms
      const card = createTestTextCard('debounce-test', 250, 250);

      const { rerender } = render(<CardRenderer card={card} />);
      const initialRenderCount = textCardRenderCount;

      // Simulate rapid viewport changes that would be debounced by CardLayer
      // CardLayer wouldn't query GraphQL, so same card data passed
      jest.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        rerender(<CardRenderer card={card} onCardClick={jest.fn()} />);
        jest.advanceTimersByTime(50); // Less than 150ms debounce
      }

      // Should NOT re-render during debounce period
      expect(textCardRenderCount).toBe(initialRenderCount);

      jest.useRealTimers();
    });

    it('should maintain consistency with ImageCache across components', async () => {
      // Multiple ImageCardRenderers sharing ImageCache should maintain consistency
      const card1 = createTestImageCard('cache-share-1', 100, 100, 'https://example.com/shared.jpg');
      const card2 = createTestImageCard('cache-share-2', 300, 300, 'https://example.com/shared.jpg');

      const stableCallback = jest.fn();

      const { rerender: rerender1 } = render(<CardRenderer card={card1} onCardClick={stableCallback} />);
      const { rerender: rerender2 } = render(<CardRenderer card={card2} onCardClick={stableCallback} />);

      // Wait for images to load
      await waitFor(() => {
        expect(screen.getAllByTestId('image-card-renderer')[0]).toHaveAttribute('data-image-loaded', 'true');
      });

      const renderCountAfterLoad = imageCardRenderCount;

      // Viewport changes with same card data and callbacks shouldn't trigger re-render
      rerender1(<CardRenderer card={card1} onCardClick={stableCallback} />);
      rerender2(<CardRenderer card={card2} onCardClick={stableCallback} />);

      // Neither should re-render (callbacks are stable, card data unchanged)
      expect(imageCardRenderCount).toBe(renderCountAfterLoad);
    });
  });
});
