/**
 * EditModeManager Component Tests
 *
 * Tests for the inline editing functionality of cards in the canvas
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { EditModeManager, useEditMode } from '../EditModeManager';
import type { Card } from '@/types/card.types';
import { createCardId } from '@/types/card.types';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  }
}));

describe('EditModeManager', () => {
  const mockCard: Card = {
    id: createCardId('test-card-1'),
    ownerId: 'user-1' as any,
    content: {
      type: 'text',
      content: 'Test card content',
      markdown: false,
      wordCount: 3,
    },
    position: { x: 100, y: 100, z: 1 },
    dimensions: { width: 200, height: 150 },
    style: {
      backgroundColor: '#FFFFFF',
      borderColor: '#E5E7EB',
      textColor: '#1F2937',
      borderWidth: 1,
      borderRadius: 8,
      opacity: 1,
      shadow: true,
    },
    isSelected: false,
    isLocked: false,
    isHidden: false,
    isMinimized: false,
    status: 'active',
    priority: 'normal',
    createdAt: Date.now().toString(),
    updatedAt: Date.now().toString(),
    tags: [],
    metadata: {},
    animation: { isAnimating: false },
  };

  const mockOnEditStart = jest.fn();
  const mockOnEditEnd = jest.fn();
  const mockOnEditCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children content by default', () => {
    render(
      <EditModeManager card={mockCard}>
        <div>Card Content</div>
      </EditModeManager>
    );

    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('enters edit mode on double click when enabled', async () => {
    const user = userEvent.setup();

    render(
      <EditModeManager
        card={mockCard}
        canEdit={true}
        onEditStart={mockOnEditStart}
      >
        <div>Card Content</div>
      </EditModeManager>
    );

    const container = screen.getByText('Card Content').parentElement;
    await user.dblClick(container!);

    await waitFor(() => {
      expect(mockOnEditStart).toHaveBeenCalledWith(mockCard.id, 'text');
    });
  });

  it('does not enter edit mode when card is locked', async () => {
    const user = userEvent.setup();
    const lockedCard = { ...mockCard, isLocked: true };

    render(
      <EditModeManager
        card={lockedCard}
        canEdit={true}
        onEditStart={mockOnEditStart}
      >
        <div>Card Content</div>
      </EditModeManager>
    );

    const container = screen.getByText('Card Content').parentElement;
    await user.dblClick(container!);

    expect(mockOnEditStart).not.toHaveBeenCalled();
  });

  it('does not enter edit mode when canEdit is false', async () => {
    const user = userEvent.setup();

    render(
      <EditModeManager
        card={mockCard}
        canEdit={false}
        onEditStart={mockOnEditStart}
      >
        <div>Card Content</div>
      </EditModeManager>
    );

    const container = screen.getByText('Card Content').parentElement;
    await user.dblClick(container!);

    expect(mockOnEditStart).not.toHaveBeenCalled();
  });

  it('shows default text editor in edit mode', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <EditModeManager
        card={mockCard}
        canEdit={true}
      >
        <div>Card Content</div>
      </EditModeManager>
    );

    const contentDiv = screen.getByText('Card Content').parentElement;
    await user.dblClick(contentDiv!);

    await waitFor(() => {
      expect(container.querySelector('textarea')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('cancels edit mode with Escape key', async () => {
    const user = userEvent.setup();

    render(
      <EditModeManager
        card={mockCard}
        canEdit={true}
        onEditCancel={mockOnEditCancel}
      >
        <div>Card Content</div>
      </EditModeManager>
    );

    const container = screen.getByText('Card Content').parentElement;
    await user.dblClick(container!);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(mockOnEditCancel).toHaveBeenCalledWith(mockCard.id);
    });
  });

  it('saves content when Save button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <EditModeManager
        card={mockCard}
        canEdit={true}
        onEditEnd={mockOnEditEnd}
      >
        <div>Card Content</div>
      </EditModeManager>
    );

    const container = screen.getByText('Card Content').parentElement;
    await user.dblClick(container!);

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'Updated content');

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    expect(mockOnEditEnd).toHaveBeenCalledWith(
      mockCard.id,
      expect.objectContaining({
        type: 'text',
        content: 'Updated content'
      })
    );
  });

  it('handles different card types correctly', () => {
    const codeCard: Card = {
      ...mockCard,
      content: {
        type: 'code',
        language: 'javascript',
        content: 'console.log("test");',
        lineCount: 1,
      }
    };

    render(
      <EditModeManager
        card={codeCard}
        canEdit={true}
        onEditStart={mockOnEditStart}
      >
        <div>Code Card</div>
      </EditModeManager>
    );

    const container = screen.getByText('Code Card').parentElement;
    fireEvent.doubleClick(container!);

    expect(mockOnEditStart).toHaveBeenCalledWith(codeCard.id, 'code');
  });
});

describe('useEditMode hook', () => {
  it('manages edit state correctly', () => {
    const TestComponent = () => {
      const { editState, startEdit, endEdit, setDirty } = useEditMode();

      return (
        <div>
          <div data-testid="is-editing">{editState.isEditing ? 'true' : 'false'}</div>
          <div data-testid="editing-id">{editState.editingCardId || 'none'}</div>
          <div data-testid="is-dirty">{editState.isDirty ? 'true' : 'false'}</div>
          <button onClick={() => startEdit(createCardId('test-1'), 'text')}>Start Edit</button>
          <button onClick={endEdit}>End Edit</button>
          <button onClick={() => setDirty(true)}>Set Dirty</button>
        </div>
      );
    };

    const { rerender } = render(<TestComponent />);

    expect(screen.getByTestId('is-editing')).toHaveTextContent('false');
    expect(screen.getByTestId('editing-id')).toHaveTextContent('none');
    expect(screen.getByTestId('is-dirty')).toHaveTextContent('false');

    fireEvent.click(screen.getByText('Start Edit'));
    rerender(<TestComponent />);

    expect(screen.getByTestId('is-editing')).toHaveTextContent('true');
    expect(screen.getByTestId('editing-id')).toHaveTextContent('test-1');

    fireEvent.click(screen.getByText('Set Dirty'));
    rerender(<TestComponent />);

    expect(screen.getByTestId('is-dirty')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('End Edit'));
    rerender(<TestComponent />);

    expect(screen.getByTestId('is-editing')).toHaveTextContent('false');
    expect(screen.getByTestId('editing-id')).toHaveTextContent('none');
    expect(screen.getByTestId('is-dirty')).toHaveTextContent('false');
  });
});