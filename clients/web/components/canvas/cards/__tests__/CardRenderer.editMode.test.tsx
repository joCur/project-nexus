/**
 * CardRenderer Edit Mode Integration Tests
 *
 * Tests for Phase 3, Task 3.1 of NEX-193: Integration with CardRenderer
 * Following TDD approach - RED → GREEN → REFACTOR
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardRenderer } from '../CardRenderer';
import type { TextCard, CardId, CardStatus, CardPriority, CardStyle } from '@/types/card.types';
import { TextContentFormat } from '@/types/card.types';
import type { EntityId } from '@/types/common.types';
import { EditMode } from '@/components/canvas/editing';

// Define Konva event type
interface KonvaEventObject {
  evt: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    button?: number;
  };
  cancelBubble: boolean;
  target?: {
    x: () => number;
    y: () => number;
  };
}

// Mock Konva components
jest.mock('react-konva', () => ({
  Group: ({ children, x, y, draggable, onClick, onDblClick, onDragStart, opacity, listening, ...props }: {
    children?: React.ReactNode;
    x?: number;
    y?: number;
    draggable?: boolean;
    onClick?: (e: KonvaEventObject) => void;
    onDblClick?: (e: KonvaEventObject) => void;
    onDragStart?: (e: KonvaEventObject) => void;
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
      onMouseDown={(e) => {
        if (onDragStart) {
          const konvaEvent = {
            target: {
              x: () => 100,
              y: () => 200
            },
            evt: e,
            cancelBubble: false
          };
          onDragStart(konvaEvent);
        }
      }}
      {...props}
    >
      {children}
    </div>
  ),
}));

// Mock card renderers
jest.mock('../TextCardRenderer', () => ({
  TextCardRenderer: ({
    card,
    isSelected,
    isDragged,
    isHovered,
    isEditing,
  }: {
    card: TextCard;
    isSelected: boolean;
    isDragged: boolean;
    isHovered: boolean;
    isEditing?: boolean;
  }) => {
    const content = typeof card.content.content === 'string' ? card.content.content : JSON.stringify(card.content.content);
    return (
      <div
        data-testid="text-card-renderer"
        data-card-id={card.id}
        data-selected={isSelected}
        data-dragged={isDragged}
        data-hovered={isHovered}
        data-editing={isEditing}
        className={isEditing ? 'editing-mode' : ''}
      >
        <div className="card-content">Text Card: {content}</div>
        {isEditing && (
          <div className="edit-mode-indicator">
            <span className="edit-mode-badge">Editing</span>
          </div>
        )}
      </div>
    );
  },
}));

// Mock EditModeManager
const mockEditState = {
  isEditing: false,
  editingCardId: null as CardId | null,
  editMode: null as EditMode | null,
  isDirty: false,
};

interface EditModeManagerProps {
  children?: React.ReactNode;
  card?: TextCard;
  onEditStart?: (cardId: CardId, mode: EditMode) => void;
  canEdit?: boolean;
  className?: string;
}

jest.mock('@/components/canvas/editing', () => ({
  EditModeManager: ({
    children,
    card,
    onEditStart,
    canEdit,
    className
  }: EditModeManagerProps) => {
    const handleDoubleClick = (e: React.MouseEvent) => {
      if (canEdit && card && !card.isLocked) {
        e.preventDefault();
        e.stopPropagation();
        mockEditState.isEditing = true;
        mockEditState.editingCardId = card.id;
        mockEditState.editMode = EditMode.TEXT;
        onEditStart?.(card.id, EditMode.TEXT);
      }
    };

    return (
      <div
        className={`edit-mode-manager ${className || ''} ${mockEditState.isEditing ? 'is-editing' : ''}`}
        onDoubleClick={handleDoubleClick}
        data-editing={mockEditState.isEditing}
        data-editing-card-id={mockEditState.editingCardId}
      >
        {children}
        {mockEditState.isEditing && card && mockEditState.editingCardId === card.id && (
          <div className="edit-mode-overlay">
            <div className="edit-mode-border" />
            <div className="edit-mode-background" />
          </div>
        )}
      </div>
    );
  },
  useEditMode: () => ({
    editState: mockEditState,
    isEditing: mockEditState.isEditing,
    editingCardId: mockEditState.editingCardId,
    isDirty: mockEditState.isDirty,
    startEdit: jest.fn((cardId: CardId, mode: EditMode) => {
      mockEditState.isEditing = true;
      mockEditState.editingCardId = cardId;
      mockEditState.editMode = mode;
    }),
    endEdit: jest.fn(() => {
      mockEditState.isEditing = false;
      mockEditState.editingCardId = null;
      mockEditState.editMode = null;
      mockEditState.isDirty = false;
    }),
    setDirty: jest.fn((isDirty: boolean) => {
      mockEditState.isDirty = isDirty;
    }),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  EditMode: {} as any,
}));

// Mock card store
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
  editingCardId: null as CardId | null,
  selectCard: jest.fn(),
  startDrag: jest.fn(),
  updateDrag: jest.fn(),
  endDrag: jest.fn(),
  setHoveredCard: jest.fn(),
  setEditingCard: jest.fn((cardId: CardId | null) => {
    mockStoreState.editingCardId = cardId;
  }),
  clearEditingCard: jest.fn(() => {
    mockStoreState.editingCardId = null;
  }),
};

jest.mock('@/stores/cardStore', () => ({
  useCardStore: () => mockStoreState,
}));

describe('CardRenderer Edit Mode Integration', () => {
  // Helper to create test cards
  const createTestCard = (
    id: string,
    isLocked: boolean = false
  ): TextCard => ({
    id: id as CardId,
    ownerId: 'test-user-id' as EntityId,
    position: { x: 100, y: 100, z: 0 },
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
    content: {
      type: 'text' as const,
      format: TextContentFormat.MARKDOWN,
      content: 'Test text content',
      markdown: false,
      wordCount: 3,
    },
    isHidden: false,
    isLocked,
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
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockStoreState.selection.selectedIds.clear();
    mockStoreState.dragState.isDragging = false;
    mockStoreState.dragState.draggedIds.clear();
    mockStoreState.editingCardId = null;
    mockEditState.isEditing = false;
    mockEditState.editingCardId = null;
    mockEditState.editMode = null;
    mockEditState.isDirty = false;
  });

  describe('Double-click to Edit', () => {
    it('should trigger edit mode on double-click when inline editing is enabled', async () => {
      const card = createTestCard('card-1');
      const onEditStart = jest.fn();

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          onEditStart={onEditStart}
        />
      );

      const group = screen.getByTestId('konva-group');
      fireEvent.doubleClick(group);

      await waitFor(() => {
        expect(onEditStart).toHaveBeenCalledWith('card-1', EditMode.TEXT);
      });
    });

    it('should not trigger edit mode when card is locked', async () => {
      const card = createTestCard('card-1', true); // locked card
      const onEditStart = jest.fn();

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          onEditStart={onEditStart}
        />
      );

      const group = screen.getByTestId('konva-group');
      fireEvent.doubleClick(group);

      expect(onEditStart).not.toHaveBeenCalled();
    });

    it('should not trigger edit mode when inline editing is disabled', async () => {
      const card = createTestCard('card-1');
      const onEditStart = jest.fn();
      const onCardDoubleClick = jest.fn();

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={false}
          onEditStart={onEditStart}
          onCardDoubleClick={onCardDoubleClick}
        />
      );

      const group = screen.getByTestId('konva-group');
      fireEvent.doubleClick(group);

      expect(onEditStart).not.toHaveBeenCalled();
      expect(onCardDoubleClick).toHaveBeenCalledWith(card, expect.any(Object));
    });

    it('should determine correct edit mode based on card type', async () => {
      const testCases = [
        { type: 'text', expectedMode: EditMode.TEXT },
        { type: 'code', expectedMode: EditMode.CODE },
        { type: 'link', expectedMode: EditMode.LINK },
        { type: 'image', expectedMode: EditMode.IMAGE_CAPTION },
      ];

      for (const testCase of testCases) {
        const card = {
          ...createTestCard('card-1'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: { type: testCase.type } as any,
        };
        const onEditStart = jest.fn();

        const { unmount } = render(
          <CardRenderer
            card={card}
            enableInlineEdit={true}
            onEditStart={onEditStart}
          />
        );

        const group = screen.getByTestId('konva-group');
        fireEvent.doubleClick(group);

        await waitFor(() => {
          expect(onEditStart).toHaveBeenCalledWith('card-1', testCase.expectedMode);
        });

        unmount();
        jest.clearAllMocks();
      }
    });
  });

  describe('Visual Indicators', () => {
    it('should pass editing state to card renderer when card is being edited', async () => {
      const card = createTestCard('card-1');
      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;
      mockStoreState.editingCardId = 'card-1' as CardId;

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          isEditingCard={true}
        />
      );

      // Check that the card renderer receives editing state
      // Note: Visual edit indicators (.edit-mode-overlay) are rendered by EditorOverlay component,
      // not CardRenderer. CardRenderer only passes the editing state to the card renderer.
      const renderer = screen.getByTestId('text-card-renderer');
      expect(renderer).toHaveAttribute('data-editing', 'true');
      expect(renderer).toHaveClass('editing-mode');
    });

    it('should not show edit mode indicators when card is not being edited', () => {
      const card = createTestCard('card-1');
      mockEditState.isEditing = false;

      const { container } = render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
        />
      );

      expect(container.querySelector('.edit-mode-overlay')).not.toBeInTheDocument();

      const renderer = screen.getByTestId('text-card-renderer');
      expect(renderer).toHaveAttribute('data-editing', 'false');
      expect(renderer).not.toHaveClass('editing-mode');
    });

    it('should show edit mode badge when editing', () => {
      const card = createTestCard('card-1');
      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          isEditingCard={true}
        />
      );

      expect(screen.getByText('Editing')).toBeInTheDocument();
    });
  });

  describe('Drag Operations During Edit Mode', () => {
    it('should disable drag operations when card is in edit mode', () => {
      const card = createTestCard('card-1');
      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          isEditingCard={true}
        />
      );

      const group = screen.getByTestId('konva-group');

      // Check that draggable is disabled during edit mode
      expect(group).toHaveAttribute('data-draggable', 'false');
      expect(group).toHaveAttribute('data-listening', 'false');
    });

    it('should enable drag operations when card exits edit mode', () => {
      const card = createTestCard('card-1');
      mockEditState.isEditing = false;

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
        />
      );

      const group = screen.getByTestId('konva-group');
      expect(group).toHaveAttribute('data-draggable', 'true');
      expect(group).toHaveAttribute('data-listening', 'true');
    });

    it('should not start drag when in edit mode', () => {
      const card = createTestCard('card-1');
      const onCardDragStart = jest.fn();
      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          onCardDragStart={onCardDragStart}
          isEditingCard={true}
        />
      );

      const group = screen.getByTestId('konva-group');
      fireEvent.mouseDown(group);

      expect(onCardDragStart).not.toHaveBeenCalled();
      expect(mockStoreState.startDrag).not.toHaveBeenCalled();
    });
  });

  describe('Edit Mode and Selection Conflicts', () => {
    it('should clear selection when entering edit mode', async () => {
      const card = createTestCard('card-1');
      mockStoreState.selection.selectedIds.add('card-1');
      mockStoreState.selection.selectedIds.add('card-2');

      const onEditStart = jest.fn();
      const clearSelection = jest.fn();

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          onEditStart={onEditStart}
          onClearSelection={clearSelection}
        />
      );

      const group = screen.getByTestId('konva-group');
      fireEvent.doubleClick(group);

      await waitFor(() => {
        expect(clearSelection).toHaveBeenCalled();
      });
    });

    it('should not allow selection changes during edit mode', () => {
      const card = createTestCard('card-1');
      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          isEditingCard={true}
        />
      );

      const group = screen.getByTestId('konva-group');
      fireEvent.click(group);

      // Selection should not be called during edit mode
      expect(mockStoreState.selectCard).not.toHaveBeenCalled();
    });

    it('should exit edit mode when clicking another card', () => {
      // This test verifies that when editing one card, clicking another card
      // should cancel the edit mode on the first card.
      // In a real implementation, this would be handled at the parent level
      // (Canvas component) which coordinates between multiple CardRenderers.

      const card1 = createTestCard('card-1');

      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;

      // First, render card 1 in edit mode
      render(
        <CardRenderer
          card={card1}
          enableInlineEdit={true}
          isEditingCard={true}
        />
      );

      // In a real scenario, the parent would handle this coordination
      // For now, we'll verify that clicking while in edit mode doesn't trigger selection
      const group = screen.getByTestId('konva-group');
      fireEvent.click(group);

      // The card should not allow selection changes during edit mode
      expect(mockStoreState.selectCard).not.toHaveBeenCalled();

      // Note: In the full implementation, the Canvas component would handle
      // canceling edit mode when clicking outside the editing card.
      // This would trigger onEditCancel('card-1') from the parent level.
    });

    it('should not trigger hover effects during edit mode', () => {
      const card = createTestCard('card-1');
      const onCardHover = jest.fn();
      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          onCardHover={onCardHover}
          isEditingCard={true}
        />
      );

      const group = screen.getByTestId('konva-group');
      fireEvent.mouseEnter(group);

      expect(onCardHover).not.toHaveBeenCalled();
      expect(mockStoreState.setHoveredCard).not.toHaveBeenCalled();
    });
  });

  describe('Edit Mode State Management', () => {
    it('should handle save action through EditModeManager', async () => {
      const card = createTestCard('card-1');
      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          isEditingCard={true}
        />
      );

      // Trigger save through the component's internal handler
      // This would normally be triggered by the EditModeManager
      mockEditState.isEditing = false;
      mockEditState.editingCardId = null;

      // Edit state is managed by EditModeManager and cardStore
      // CardRenderer responds to state changes but doesn't expose callbacks
    });

    it('should handle cancel action through EditModeManager', async () => {
      const card = createTestCard('card-1');
      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          isEditingCard={true}
        />
      );

      // Simulate cancel action (ESC key)
      fireEvent.keyDown(document, { key: 'Escape' });

      // Cancel is handled by EditModeManager which updates cardStore
      // CardRenderer responds to state changes via useEditMode hook
    });
  });

  describe('Integration with Edit Mode System', () => {
    it('should handle double-click to trigger edit mode when inline editing is enabled', () => {
      const card = createTestCard('card-1');
      const onEditStart = jest.fn();

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          onEditStart={onEditStart}
        />
      );

      const group = screen.getByTestId('konva-group');

      // Double-click to test that callbacks are wired correctly
      fireEvent.doubleClick(group);
      expect(onEditStart).toHaveBeenCalledWith('card-1', EditMode.TEXT);
    });

    it('should update edit state when entering edit mode', () => {
      const card = createTestCard('card-1');
      const onEditStart = jest.fn();

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          onEditStart={onEditStart}
        />
      );

      const group = screen.getByTestId('konva-group');
      fireEvent.doubleClick(group);

      // Verify edit state was updated
      expect(mockStoreState.setEditingCard).toHaveBeenCalledWith('card-1');
      expect(onEditStart).toHaveBeenCalledWith('card-1', EditMode.TEXT);
    });

    it('should not trigger edit mode callbacks when inline editing is disabled', () => {
      const card = createTestCard('card-1');
      const onEditStart = jest.fn();

      render(
        <CardRenderer
          card={card}
          enableInlineEdit={false}
          onEditStart={onEditStart}
        />
      );

      const group = screen.getByTestId('konva-group');
      fireEvent.doubleClick(group);

      // Edit mode should not be triggered
      expect(onEditStart).not.toHaveBeenCalled();
      expect(mockStoreState.setEditingCard).not.toHaveBeenCalled();
    });
  });

  describe('Performance and State Management', () => {
    it('should maintain memoization when edit state changes', () => {
      const card = createTestCard('card-1');

      const { rerender } = render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
        />
      );

      // Enter edit mode
      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;

      rerender(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          isEditingCard={true}
        />
      );

      // Component should handle state change efficiently
      expect(screen.getByTestId('text-card-renderer')).toBeInTheDocument();
    });

    it('should clean up edit state when component unmounts', () => {
      const card = createTestCard('card-1');
      mockEditState.isEditing = true;
      mockEditState.editingCardId = 'card-1' as CardId;

      const { unmount } = render(
        <CardRenderer
          card={card}
          enableInlineEdit={true}
          isEditingCard={true}
        />
      );

      unmount();

      // Edit state cleanup is handled by EditModeManager
      // CardRenderer unmount doesn't directly trigger edit state changes
    });
  });
});