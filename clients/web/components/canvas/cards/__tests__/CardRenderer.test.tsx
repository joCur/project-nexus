import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardRenderer } from '../CardRenderer';
import type { Card, TextCard, ImageCard, LinkCard, CodeCard, CardId, CardStatus, CardPriority, CardStyle } from '@/types/card.types';
import type { EntityId } from '@/types/common.types';
import type { KonvaEventObject } from 'konva/lib/Node';

// Mock Konva components
jest.mock('react-konva', () => ({
  Group: ({ children, x, y, draggable, onClick, onDblClick, onDragStart, onDragMove, onDragEnd, onMouseEnter, onMouseLeave, opacity, listening, ...props }: {
    children?: React.ReactNode;
    x?: number;
    y?: number;
    draggable?: boolean;
    onClick?: (e: any) => void;
    onDblClick?: (e: any) => void;
    onDragStart?: (e: any) => void;
    onDragMove?: (e: any) => void;
    onDragEnd?: (e: any) => void;
    onMouseEnter?: (e: any) => void;
    onMouseLeave?: (e: any) => void;
    opacity?: number;
    listening?: boolean;
    [key: string]: unknown;
  }) => (
    <div
      data-testid="konva-group"
      data-x={x}
      data-y={y}
      data-draggable={draggable}
      data-opacity={opacity}
      data-listening={listening}
      onClick={(e) => {
      if (onClick) {
        const konvaEvent = {
          evt: {
            ctrlKey: e.ctrlKey || false,
            metaKey: e.metaKey || false,
            shiftKey: e.shiftKey || false,
            altKey: e.altKey || false,
            button: e.button || 0,
          },
          cancelBubble: false,
        };
        onClick(konvaEvent);
      }
    }}
      onDoubleClick={(e) => {
      if (onDblClick) {
        const konvaEvent = {
          evt: {
            ctrlKey: e.ctrlKey || false,
            metaKey: e.metaKey || false,
            shiftKey: e.shiftKey || false,
            altKey: e.altKey || false,
            button: e.button || 0,
          },
          cancelBubble: false,
        };
        onDblClick(konvaEvent);
      }
    }}
      onMouseDown={(e) => { if (onDragStart) { const konvaEvent = { target: { x: () => 100, y: () => 200, getStage: () => ({ getPointerPosition: () => ({ x: e.clientX || 0, y: e.clientY || 0 }) }) }, evt: e, cancelBubble: false }; onDragStart(konvaEvent); } }}
      onMouseMove={(e) => { if (onDragMove) { const konvaEvent = { target: { x: () => 100, y: () => 200, getStage: () => ({ getPointerPosition: () => ({ x: e.clientX || 0, y: e.clientY || 0 }) }) }, evt: e, cancelBubble: false }; onDragMove(konvaEvent); } }}
      onMouseUp={(e) => { if (onDragEnd) { const konvaEvent = { target: { x: () => 100, y: () => 200, getStage: () => ({ getPointerPosition: () => ({ x: e.clientX || 0, y: e.clientY || 0 }) }) }, evt: e, cancelBubble: false }; onDragEnd(konvaEvent); } }}
      onMouseEnter={(e) => { if (onMouseEnter) { const konvaEvent = { target: { x: () => 100, y: () => 200, getStage: () => ({ getPointerPosition: () => ({ x: e.clientX || 0, y: e.clientY || 0 }) }) }, evt: e, cancelBubble: false }; onMouseEnter(konvaEvent); } }}
      onMouseLeave={(e) => { if (onMouseLeave) { const konvaEvent = { target: { x: () => 100, y: () => 200, getStage: () => ({ getPointerPosition: () => ({ x: e.clientX || 0, y: e.clientY || 0 }) }) }, evt: e, cancelBubble: false }; onMouseLeave(konvaEvent); } }}
      {...props}
    >
      {children}
    </div>
  ),
}));

// Mock specific card renderers
jest.mock('../TextCardRenderer', () => ({
  TextCardRenderer: ({ card, isSelected, isDragged, isHovered }: {
    card: TextCard;
    isSelected: boolean;
    isDragged: boolean;
    isHovered: boolean;
  }) => (
    <div
      data-testid="text-card-renderer"
      data-card-id={card.id}
      data-selected={isSelected}
      data-dragged={isDragged}
      data-hovered={isHovered}
    >
      Text Card: {card.content.content}
    </div>
  ),
}));

jest.mock('../ImageCardRenderer', () => ({
  ImageCardRenderer: ({ card, isSelected, isDragged, isHovered }: {
    card: ImageCard;
    isSelected: boolean;
    isDragged: boolean;
    isHovered: boolean;
  }) => (
    <div
      data-testid="image-card-renderer"
      data-card-id={card.id}
      data-selected={isSelected}
      data-dragged={isDragged}
      data-hovered={isHovered}
    >
      Image Card: {card.content.url}
    </div>
  ),
}));

jest.mock('../LinkCardRenderer', () => ({
  LinkCardRenderer: ({ card, isSelected, isDragged, isHovered }: {
    card: LinkCard;
    isSelected: boolean;
    isDragged: boolean;
    isHovered: boolean;
  }) => (
    <div
      data-testid="link-card-renderer"
      data-card-id={card.id}
      data-selected={isSelected}
      data-dragged={isDragged}
      data-hovered={isHovered}
    >
      Link Card: {card.content.url}
    </div>
  ),
}));

jest.mock('../CodeCardRenderer', () => ({
  CodeCardRenderer: ({ card, isSelected, isDragged, isHovered }: {
    card: CodeCard;
    isSelected: boolean;
    isDragged: boolean;
    isHovered: boolean;
  }) => (
    <div
      data-testid="code-card-renderer"
      data-card-id={card.id}
      data-selected={isSelected}
      data-dragged={isDragged}
      data-hovered={isHovered}
    >
      Code Card: {card.content.language}
    </div>
  ),
}));

// Mock card store with reactive behavior
let mockStoreState = {
  selection: {
    selectedIds: new Set<string>(),
  },
  dragState: {
    isDragging: false,
    draggedIds: new Set<string>(),
    startPosition: { x: 0, y: 0 },
  },
  resizeState: {
    isResizing: false,
    resizedId: undefined,
  },
  hoverState: {
    hoveredId: undefined,
  },
  selectCard: jest.fn(),
  startDrag: jest.fn(),
  updateDrag: jest.fn(),
  endDrag: jest.fn(),
  setHoveredCard: jest.fn(),
};

const getMockCardStore = () => ({
  selection: {
    selectedIds: mockStoreState.selection.selectedIds,
  },
  dragState: {
    isDragging: mockStoreState.dragState.isDragging,
    draggedIds: mockStoreState.dragState.draggedIds,
    startPosition: mockStoreState.dragState.startPosition,
  },
  resizeState: {
    isResizing: mockStoreState.resizeState.isResizing,
    resizedId: mockStoreState.resizeState.resizedId,
  },
  hoverState: {
    hoveredId: mockStoreState.hoverState.hoveredId,
  },
  selectCard: mockStoreState.selectCard,
  startDrag: mockStoreState.startDrag,
  updateDrag: mockStoreState.updateDrag,
  endDrag: mockStoreState.endDrag,
  setHoveredCard: mockStoreState.setHoveredCard,
});

jest.mock('@/stores/cardStore', () => ({
  useCardStore: () => getMockCardStore(),
}));

describe('CardRenderer', () => {
  beforeEach(() => {
    // Reset mock state before each test
    mockStoreState.selection.selectedIds.clear();
    mockStoreState.dragState.isDragging = false;
    mockStoreState.dragState.draggedIds.clear();
    mockStoreState.resizeState.isResizing = false;
    mockStoreState.resizeState.resizedId = undefined;
    mockStoreState.hoverState.hoveredId = undefined;
    jest.clearAllMocks();
  });

  // Helper to create test cards
  const createTestCard = (
    id: string,
    type: 'text' | 'image' | 'link' | 'code',
    x: number = 0,
    y: number = 0,
    isLocked: boolean = false,
    isHidden: boolean = false
  ): Card => {
    const baseCard = {
      id: id as CardId,
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
      isHidden,
      isLocked,
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

  // Mock Konva event creation removed - not used


  describe('Card Type Determination', () => {
    it('renders TextCardRenderer for text cards', () => {
      const textCard = createTestCard('text-card', 'text');
      render(<CardRenderer card={textCard} />);

      expect(screen.getByTestId('text-card-renderer')).toBeInTheDocument();
      expect(screen.getByText('Text Card: Test text content')).toBeInTheDocument();
    });

    it('renders ImageCardRenderer for image cards', () => {
      const imageCard = createTestCard('image-card', 'image');
      render(<CardRenderer card={imageCard} />);

      expect(screen.getByTestId('image-card-renderer')).toBeInTheDocument();
      expect(screen.getByText('Image Card: https://example.com/image.jpg')).toBeInTheDocument();
    });

    it('renders LinkCardRenderer for link cards', () => {
      const linkCard = createTestCard('link-card', 'link');
      render(<CardRenderer card={linkCard} />);

      expect(screen.getByTestId('link-card-renderer')).toBeInTheDocument();
      expect(screen.getByText('Link Card: https://example.com')).toBeInTheDocument();
    });

    it('renders CodeCardRenderer for code cards', () => {
      const codeCard = createTestCard('code-card', 'code');
      render(<CardRenderer card={codeCard} />);

      expect(screen.getByTestId('code-card-renderer')).toBeInTheDocument();
      expect(screen.getByText('Code Card: javascript')).toBeInTheDocument();
    });

    it('falls back to TextCardRenderer for unknown card types', () => {
      const unknownCard = {
        ...createTestCard('unknown-card', 'text'),
        type: 'unknown' as any,
      };

      render(<CardRenderer card={unknownCard} />);

      expect(screen.getByTestId('text-card-renderer')).toBeInTheDocument();
    });
  });

  describe('Selection State Handling', () => {
    it('passes correct selection state to child renderers', () => {
      const card = createTestCard('selected-card', 'text');
      mockStoreState.selection.selectedIds.add('selected-card');

      render(<CardRenderer card={card} />);

      const renderer = screen.getByTestId('text-card-renderer');
      expect(renderer).toHaveAttribute('data-selected', 'true');
    });

    it('passes false selection state when card is not selected', () => {
      const card = createTestCard('unselected-card', 'text');

      render(<CardRenderer card={card} />);

      const renderer = screen.getByTestId('text-card-renderer');
      expect(renderer).toHaveAttribute('data-selected', 'false');
    });
  });

  describe('Hover State Handling', () => {
    it('passes correct hover state to child renderers', () => {
      const card = createTestCard('hovered-card', 'text');
      mockStoreState.hoverState.hoveredId = 'hovered-card' as any;

      render(<CardRenderer card={card} />);

      const renderer = screen.getByTestId('text-card-renderer');
      expect(renderer).toHaveAttribute('data-hovered', 'true');
    });

    it('passes false hover state when card is not hovered', () => {
      const card = createTestCard('unhovered-card', 'text');

      render(<CardRenderer card={card} />);

      const renderer = screen.getByTestId('text-card-renderer');
      expect(renderer).toHaveAttribute('data-hovered', 'false');
    });
  });

  describe('Drag State Handling', () => {
    it('passes correct drag state to child renderers', () => {
      const card = createTestCard('dragged-card', 'text');
      mockStoreState.dragState.draggedIds.add('dragged-card');

      render(<CardRenderer card={card} />);

      const renderer = screen.getByTestId('text-card-renderer');
      expect(renderer).toHaveAttribute('data-dragged', 'true');
    });

    it('passes false drag state when card is not being dragged', () => {
      const card = createTestCard('not-dragged-card', 'text');

      render(<CardRenderer card={card} />);

      const renderer = screen.getByTestId('text-card-renderer');
      expect(renderer).toHaveAttribute('data-dragged', 'false');
    });
  });

  describe('Group Properties', () => {
    it('sets correct position from card data', () => {
      const card = createTestCard('positioned-card', 'text', 150, 250);
      render(<CardRenderer card={card} />);

      const group = screen.getByTestId('konva-group');
      expect(group).toHaveAttribute('data-x', '150');
      expect(group).toHaveAttribute('data-y', '250');
    });

    it('sets correct opacity from card style', () => {
      const card = createTestCard('transparent-card', 'text');
      card.style.opacity = 0.5;

      render(<CardRenderer card={card} />);

      const group = screen.getByTestId('konva-group');
      expect(group).toHaveAttribute('data-opacity', '0.5');
    });

    it('sets draggable based on locked state', () => {
      const normalCard = createTestCard('normal-card', 'text');
      const lockedCard = createTestCard('locked-card', 'text', 0, 0, true);

      const { rerender } = render(<CardRenderer card={normalCard} />);
      expect(screen.getByTestId('konva-group')).toHaveAttribute('data-draggable', 'true');

      rerender(<CardRenderer card={lockedCard} />);
      expect(screen.getByTestId('konva-group')).toHaveAttribute('data-draggable', 'false');
    });

    it('sets listening based on locked state', () => {
      const normalCard = createTestCard('normal-card', 'text');
      const lockedCard = createTestCard('locked-card', 'text', 0, 0, true);

      const { rerender } = render(<CardRenderer card={normalCard} />);
      expect(screen.getByTestId('konva-group')).toHaveAttribute('data-listening', 'true');

      rerender(<CardRenderer card={lockedCard} />);
      expect(screen.getByTestId('konva-group')).toHaveAttribute('data-listening', 'false');
    });
  });

  describe('Event Handlers', () => {
    describe('Click Events', () => {
      it('handles click events and calls selectCard', () => {
        const card = createTestCard('clickable-card', 'text');
        const onCardClick = jest.fn();

        render(<CardRenderer card={card} onCardClick={onCardClick} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.click(group);

        expect(mockStoreState.selectCard).toHaveBeenCalledWith('clickable-card', false);
        expect(onCardClick).toHaveBeenCalledWith(card, expect.any(Object));
      });

      it('handles click with ctrl key for multi-selection', () => {
        const card = createTestCard('multi-select-card', 'text');

        render(<CardRenderer card={card} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.click(group, { ctrlKey: true });

        expect(mockStoreState.selectCard).toHaveBeenCalledWith('multi-select-card', true);
      });

      it('handles click with meta key for multi-selection', () => {
        const card = createTestCard('meta-select-card', 'text');

        render(<CardRenderer card={card} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.click(group, { metaKey: true });

        expect(mockStoreState.selectCard).toHaveBeenCalledWith('meta-select-card', true);
      });
    });

    describe('Double Click Events', () => {
      it('handles double click events', () => {
        const card = createTestCard('double-clickable-card', 'text');
        const onCardDoubleClick = jest.fn();

        render(<CardRenderer card={card} onCardDoubleClick={onCardDoubleClick} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.doubleClick(group);

        expect(onCardDoubleClick).toHaveBeenCalledWith(card, expect.any(Object));
      });
    });

    describe('Drag Events', () => {
      it('handles drag start for unlocked cards', () => {
        const card = createTestCard('draggable-card', 'text', 100, 200);
        const onCardDragStart = jest.fn();

        render(<CardRenderer card={card} onCardDragStart={onCardDragStart} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.mouseDown(group);

        expect(mockStoreState.startDrag).toHaveBeenCalledWith(['draggable-card'], {
          x: 100,
          y: 200,
          z: 0,
        });
        expect(onCardDragStart).toHaveBeenCalledWith(card, expect.any(Object));
      });

      it('ignores drag events for locked cards', () => {
        const card = createTestCard('locked-card', 'text', 0, 0, true);

        render(<CardRenderer card={card} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.mouseDown(group);

        expect(mockStoreState.startDrag).not.toHaveBeenCalled();
      });

      it('handles drag with selected cards', () => {
        const card = createTestCard('selected-drag-card', 'text', 100, 200);
        mockStoreState.selection.selectedIds.add('selected-drag-card');
        mockStoreState.selection.selectedIds.add('other-selected-card');

        render(<CardRenderer card={card} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.mouseDown(group);

        expect(mockStoreState.startDrag).toHaveBeenCalledWith(
          ['selected-drag-card', 'other-selected-card'],
          { x: 100, y: 200, z: 0 }
        );
      });

      it('handles drag move events', () => {
        const card = createTestCard('drag-move-card', 'text');
        const onCardDragMove = jest.fn();
        mockStoreState.dragState.isDragging = true;
        mockStoreState.dragState.startPosition = { x: 50, y: 75 };

        render(<CardRenderer card={card} onCardDragMove={onCardDragMove} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.mouseMove(group);

        expect(mockStoreState.updateDrag).toHaveBeenCalledWith({
          x: 50, // 100 - 50
          y: 125, // 200 - 75
        });
        expect(onCardDragMove).toHaveBeenCalledWith(card, expect.any(Object));
      });

      it('ignores drag move for locked cards', () => {
        const card = createTestCard('locked-move-card', 'text', 0, 0, true);
        mockStoreState.dragState.isDragging = true;

        render(<CardRenderer card={card} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.mouseMove(group);

        expect(mockStoreState.updateDrag).not.toHaveBeenCalled();
      });

      it('handles drag end events', () => {
        const card = createTestCard('drag-end-card', 'text', 100, 200);
        const onCardDragEnd = jest.fn();

        render(<CardRenderer card={card} onCardDragEnd={onCardDragEnd} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.mouseUp(group);

        expect(mockStoreState.endDrag).toHaveBeenCalledWith({
          x: 100,
          y: 200,
          z: 0,
        });
        expect(onCardDragEnd).toHaveBeenCalledWith(card, expect.any(Object));
      });

      it('ignores drag end for locked cards', () => {
        const card = createTestCard('locked-end-card', 'text', 0, 0, true);

        render(<CardRenderer card={card} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.mouseUp(group);

        expect(mockStoreState.endDrag).not.toHaveBeenCalled();
      });
    });

    describe('Hover Events', () => {
      it('handles mouse enter events', () => {
        const card = createTestCard('hoverable-card', 'text');
        const onCardHover = jest.fn();

        render(<CardRenderer card={card} onCardHover={onCardHover} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.mouseEnter(group);

        expect(mockStoreState.setHoveredCard).toHaveBeenCalledWith('hoverable-card');
        expect(onCardHover).toHaveBeenCalledWith(card, expect.any(Object));
      });

      it('handles mouse leave events', () => {
        const card = createTestCard('unhover-card', 'text');
        const onCardUnhover = jest.fn();

        render(<CardRenderer card={card} onCardUnhover={onCardUnhover} />);

        const group = screen.getByTestId('konva-group');
        fireEvent.mouseLeave(group);

        expect(mockStoreState.setHoveredCard).toHaveBeenCalledWith(undefined);
        expect(onCardUnhover).toHaveBeenCalledWith(card, expect.any(Object));
      });
    });
  });

  describe('Hidden Cards', () => {
    it('does not render hidden cards', () => {
      const hiddenCard = createTestCard('hidden-card', 'text', 0, 0, false, true);

      const { container } = render(<CardRenderer card={hiddenCard} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders visible cards normally', () => {
      const visibleCard = createTestCard('visible-card', 'text', 0, 0, false, false);

      render(<CardRenderer card={visibleCard} />);

      expect(screen.getByTestId('konva-group')).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('memoizes the component properly', () => {
      const card = createTestCard('memo-card', 'text');

      const { rerender } = render(<CardRenderer card={card} />);
      const firstRender = screen.getByTestId('text-card-renderer');

      // Rerender with same props
      rerender(<CardRenderer card={card} />);
      const secondRender = screen.getByTestId('text-card-renderer');

      // Should be memoized and not re-render
      expect(firstRender).toBe(secondRender);
    });

    it('re-renders when card changes', () => {
      const card1 = createTestCard('memo-card-1', 'text');
      const card2 = createTestCard('memo-card-2', 'text');

      const { rerender } = render(<CardRenderer card={card1} />);
      expect(screen.getByTestId('text-card-renderer')).toHaveAttribute('data-card-id', 'memo-card-1');

      rerender(<CardRenderer card={card2} />);
      expect(screen.getByTestId('text-card-renderer')).toHaveAttribute('data-card-id', 'memo-card-2');
    });

    it('re-renders when store state changes', () => {
      const card = createTestCard('state-card', 'text');

      // First render with card not selected
      const { unmount } = render(<CardRenderer card={card} />);
      expect(screen.getByTestId('text-card-renderer')).toHaveAttribute('data-selected', 'false');
      unmount();

      // Update the mock state and render again
      mockStoreState.selection.selectedIds.add('state-card');
      render(<CardRenderer card={card} />);
      expect(screen.getByTestId('text-card-renderer')).toHaveAttribute('data-selected', 'true');
    });
  });

  describe('Error Handling', () => {
    it('handles cards with missing content gracefully', () => {
      const incompleteCard = {
        ...createTestCard('incomplete-card', 'text'),
        content: undefined,
      } as any;

      // Should not throw an error, fallback to text renderer
      expect(() => render(<CardRenderer card={incompleteCard} />)).not.toThrow();
    });

    it('handles cards with invalid position gracefully', () => {
      const invalidCard = {
        ...createTestCard('invalid-position-card', 'text'),
        position: undefined,
      } as any;

      // Should not throw an error
      expect(() => render(<CardRenderer card={invalidCard} />)).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('has correct display name for debugging', () => {
      expect(CardRenderer.displayName).toBe('CardRenderer');
    });

    it('prevents excessive re-renders with stable event handlers', () => {
      const card = createTestCard('stable-card', 'text');
      const onCardClick = jest.fn();

      const { rerender } = render(<CardRenderer card={card} onCardClick={onCardClick} />);

      // Multiple rerenders should not create new event handlers
      rerender(<CardRenderer card={card} onCardClick={onCardClick} />);
      rerender(<CardRenderer card={card} onCardClick={onCardClick} />);

      // Event handler should remain stable
      const group = screen.getByTestId('konva-group');
      fireEvent.click(group);

      expect(onCardClick).toHaveBeenCalledTimes(1);
    });
  });
});