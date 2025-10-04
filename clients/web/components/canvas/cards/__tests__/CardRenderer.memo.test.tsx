/**
 * CardRenderer Memoization Tests
 *
 * Tests for custom React.memo comparison function that prevents unnecessary
 * re-renders during viewport changes while maintaining reactivity for actual
 * card data changes and interaction states.
 *
 * Related: Phase 2, Task 2.3 of fix-card-rerender-on-zoom-pan
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardRenderer } from '../CardRenderer';
import type { TextCard, CardStatus, CardPriority, CardStyle } from '@/types/card.types';
import { createCardId, TextContentFormat } from '@/types/card.types';
import type { EntityId } from '@/types/common.types';

// Mock Konva components
jest.mock('react-konva', () => ({
  Group: ({ children, x, y, ...props }: { children?: React.ReactNode; x?: number; y?: number; [key: string]: unknown }) => (
    <div
      data-testid="konva-group"
      data-x={x}
      data-y={y}
      {...props}
    >
      {children}
    </div>
  ),
}));

// Track render count for memoization tests
let textCardRenderCount = 0;

// Mock TextCardRenderer with render tracking
jest.mock('../TextCardRenderer', () => ({
  TextCardRenderer: ({ card, isSelected, isDragged, isHovered }: {
    card: TextCard;
    isSelected: boolean;
    isDragged: boolean;
    isHovered: boolean;
  }) => {
    textCardRenderCount++;
    const content = typeof card.content.content === 'string' ? card.content.content : JSON.stringify(card.content.content);
    return (
      <div
        data-testid="text-card-renderer"
        data-card-id={card.id}
        data-selected={isSelected}
        data-dragged={isDragged}
        data-hovered={isHovered}
        data-render-count={textCardRenderCount}
      >
        Text Card: {content}
      </div>
    );
  },
}));

// Mock other renderers
jest.mock('../ImageCardRenderer', () => ({
  ImageCardRenderer: () => <div data-testid="image-card-renderer">Image</div>,
}));

jest.mock('../LinkCardRenderer', () => ({
  LinkCardRenderer: () => <div data-testid="link-card-renderer">Link</div>,
}));

jest.mock('../CodeCardRenderer', () => ({
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
    startPosition: { x: 0, y: 0 },
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

describe('CardRenderer - Custom Memoization', () => {
  beforeEach(() => {
    // Reset mock state and render count
    mockStoreState.selection.selectedIds.clear();
    mockStoreState.dragState.isDragging = false;
    mockStoreState.dragState.draggedIds.clear();
    mockStoreState.hoverState.hoveredId = undefined;
    mockStoreState.editingCardId = undefined;
    textCardRenderCount = 0;
    jest.clearAllMocks();
  });

  // Helper to create test cards
  const createTestCard = (
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
    priority: 'medium' as CardPriority,
    tags: [],
    animation: {
      isAnimating: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {},
    content: {
      type: 'text' as const,
      format: TextContentFormat.MARKDOWN,
      content,
      markdown: false,
      wordCount: content.split(' ').length,
    },
  });

  describe('Prevent Re-renders on Stable Props', () => {
    it('should NOT re-render when card props have not changed', () => {
      const card = createTestCard('test-card-1');
      const onCardClick = jest.fn();

      const { rerender } = render(
        <CardRenderer card={card} onCardClick={onCardClick} />
      );

      const initialRenderCount = textCardRenderCount;
      expect(initialRenderCount).toBe(1);

      // Rerender with same props (simulating parent re-render due to viewport change)
      rerender(<CardRenderer card={card} onCardClick={onCardClick} />);

      // Should NOT re-render
      expect(textCardRenderCount).toBe(initialRenderCount);
    });

    it('should NOT re-render when callback references change but card is stable', () => {
      const card = createTestCard('test-card-2');

      const { rerender } = render(
        <CardRenderer card={card} onCardClick={jest.fn()} />
      );

      const initialRenderCount = textCardRenderCount;

      // Rerender with new callback reference (common during viewport pan/zoom)
      rerender(<CardRenderer card={card} onCardClick={jest.fn()} />);

      // Should NOT re-render because card data hasn't changed
      expect(textCardRenderCount).toBe(initialRenderCount);
    });

    it('should NOT re-render when enableInlineEdit prop has same value', () => {
      const card = createTestCard('test-card-3');

      const { rerender } = render(
        <CardRenderer card={card} enableInlineEdit={false} />
      );

      const initialRenderCount = textCardRenderCount;

      // Rerender with same enableInlineEdit value
      rerender(<CardRenderer card={card} enableInlineEdit={false} />);

      // Should NOT re-render
      expect(textCardRenderCount).toBe(initialRenderCount);
    });
  });

  describe('Trigger Re-renders on Card Data Changes', () => {
    it('should re-render when card.id changes', () => {
      const card1 = createTestCard('card-1');
      const card2 = createTestCard('card-2');

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      // Change card ID
      rerender(<CardRenderer card={card2} />);

      // Should re-render
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
      expect(screen.getByTestId('text-card-renderer')).toHaveAttribute('data-card-id', 'card-2');
    });

    it('should re-render when card.position.x changes', () => {
      const card1 = createTestCard('position-test', 100, 100);
      const card2 = createTestCard('position-test', 150, 100); // Changed x

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card2} />);

      // Should re-render
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should re-render when card.position.y changes', () => {
      const card1 = createTestCard('position-test-y', 100, 100);
      const card2 = createTestCard('position-test-y', 100, 150); // Changed y

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card2} />);

      // Should re-render
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should re-render when card.position.z changes', () => {
      const card1 = createTestCard('position-test-z', 100, 100);
      card1.position.z = 0;
      const card2 = createTestCard('position-test-z', 100, 100);
      card2.position.z = 1; // Changed z

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card2} />);

      // Should re-render
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should re-render when card.dimensions.width changes', () => {
      const card1 = createTestCard('dimensions-test');
      const card2 = createTestCard('dimensions-test');
      card2.dimensions.width = 300; // Changed width

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card2} />);

      // Should re-render
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should re-render when card.dimensions.height changes', () => {
      const card1 = createTestCard('dimensions-test-h');
      const card2 = createTestCard('dimensions-test-h');
      card2.dimensions.height = 200; // Changed height

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card2} />);

      // Should re-render
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should re-render when card.content changes', () => {
      const card1 = createTestCard('content-test', 100, 100, 'Original content');
      const card2 = createTestCard('content-test', 100, 100, 'Updated content');

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card2} />);

      // Should re-render
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
      expect(screen.getByText('Text Card: Updated content')).toBeInTheDocument();
    });

    it('should re-render when enableInlineEdit changes from false to true', () => {
      const card = createTestCard('inline-edit-test');

      const { rerender } = render(
        <CardRenderer card={card} enableInlineEdit={false} />
      );

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card} enableInlineEdit={true} />);

      // Should re-render
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should re-render when onCardDragEnd callback changes', () => {
      const card = createTestCard('drag-end-test');
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const { rerender } = render(
        <CardRenderer card={card} onCardDragEnd={callback1} />
      );

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card} onCardDragEnd={callback2} />);

      // Should re-render because onCardDragEnd is important for drag persistence
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined position gracefully', () => {
      const card1 = createTestCard('undefined-test');
      const card2 = { ...card1, position: undefined } as unknown as TextCard;

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card2} />);

      // Should re-render due to position change
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should handle null dimensions gracefully', () => {
      const card1 = createTestCard('null-test');
      const card2 = { ...card1, dimensions: null } as unknown as TextCard;

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card2} />);

      // Should re-render due to dimensions change
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should handle deep content changes in nested objects', () => {
      const card1 = createTestCard('deep-content-test');
      const card2 = createTestCard('deep-content-test');
      card2.content.markdown = true; // Deep change in content

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      rerender(<CardRenderer card={card2} />);

      // Should re-render due to content change
      expect(textCardRenderCount).toBeGreaterThan(initialRenderCount);
    });
  });

  describe('Integration with CardLayer Optimization', () => {
    it('should NOT re-render when viewport bounds change but card is in view', () => {
      // This simulates CardLayer passing same card data during viewport pan
      const card = createTestCard('viewport-test');

      const { rerender } = render(
        <CardRenderer
          card={card}
          onCardClick={jest.fn()}
          onCardDragStart={jest.fn()}
        />
      );

      const initialRenderCount = textCardRenderCount;

      // Simulate CardLayer re-render with new callback instances (viewport changed)
      // but same card data
      rerender(
        <CardRenderer
          card={card}
          onCardClick={jest.fn()} // New reference
          onCardDragStart={jest.fn()} // New reference
        />
      );

      // Should NOT re-render
      expect(textCardRenderCount).toBe(initialRenderCount);
    });

    it('should maintain reactivity for interaction states from store', () => {
      // This verifies that store-based selection/hover/drag states still work
      const card = createTestCard('interaction-test');

      const { unmount } = render(<CardRenderer card={card} />);

      // First render - not selected
      expect(screen.getByTestId('text-card-renderer')).toHaveAttribute('data-selected', 'false');

      unmount();

      // Update store state
      mockStoreState.selection.selectedIds.add('interaction-test');

      // Re-render with updated store
      render(<CardRenderer card={card} />);

      // Should reflect new selection state
      expect(screen.getByTestId('text-card-renderer')).toHaveAttribute('data-selected', 'true');
    });
  });

  describe('Performance Characteristics', () => {
    it('should prevent multiple unnecessary re-renders in sequence', () => {
      const card = createTestCard('perf-test');

      const { rerender } = render(<CardRenderer card={card} />);

      const initialRenderCount = textCardRenderCount;

      // Simulate multiple parent re-renders (e.g., during continuous viewport pan)
      for (let i = 0; i < 10; i++) {
        rerender(<CardRenderer card={card} onCardClick={jest.fn()} />);
      }

      // Should NOT re-render any of the 10 times
      expect(textCardRenderCount).toBe(initialRenderCount);
    });

    it('should only re-render when card data actually changes', () => {
      const card1 = createTestCard('data-change-test', 100, 100);
      const card2 = createTestCard('data-change-test', 110, 100); // Position changed

      const { rerender } = render(<CardRenderer card={card1} />);

      const initialRenderCount = textCardRenderCount;

      // Multiple re-renders with same data
      rerender(<CardRenderer card={card1} />);
      rerender(<CardRenderer card={card1} />);
      rerender(<CardRenderer card={card1} />);

      expect(textCardRenderCount).toBe(initialRenderCount);

      // One re-render with changed data
      rerender(<CardRenderer card={card2} />);

      expect(textCardRenderCount).toBe(initialRenderCount + 1);
    });
  });
});
