/**
 * Simple EditModeManager Server Persistence Tests
 *
 * Focused tests for server persistence integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { EditModeManager } from '../EditModeManager';
import { useCardStore } from '@/stores/cardStore';
import { useCardOperations } from '@/hooks/useCardOperations';
import type { TextCard, CardId } from '@/types/card.types';

// Mock the hooks
jest.mock('@/stores/cardStore');
jest.mock('@/hooks/useCardOperations');

// Mock card data
const createMockTextCard = (id: CardId = 'card-1' as CardId): TextCard => ({
  id,
  ownerId: 'user-1',
  position: { x: 100, y: 100, z: 0 },
  dimensions: { width: 300, height: 200 },
  style: {
    backgroundColor: '#ffffff',
    borderColor: '#e0e0e0',
    textColor: '#000000',
    borderWidth: 1,
    borderRadius: 4,
    opacity: 1,
    shadow: false,
  },
  content: {
    type: 'text' as const,
    content: 'Original content',
    markdown: false,
    wordCount: 2,
    lastEditedAt: '2024-01-01T00:00:00Z',
  },
  isSelected: false,
  isLocked: false,
  isHidden: false,
  isMinimized: false,
  status: 'active' as const,
  priority: 'normal' as const,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  tags: [],
  metadata: {},
  animation: { isAnimating: false },
});

describe('EditModeManager - Simple Persistence Tests', () => {
  let mockSetEditingCard: jest.Mock;
  let mockUpdateCard: jest.Mock;
  let mockClearEditingCard: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup cardStore mock
    mockSetEditingCard = jest.fn();
    mockClearEditingCard = jest.fn();
    (useCardStore as unknown as jest.Mock).mockReturnValue({
      setEditingCard: mockSetEditingCard,
      clearEditingCard: mockClearEditingCard,
      editingCardId: null,
    });

    // Setup useCardOperations mock
    mockUpdateCard = jest.fn().mockResolvedValue(true);
    (useCardOperations as unknown as jest.Mock).mockReturnValue({
      updateCard: mockUpdateCard,
      loading: false,
      error: null,
    });
  });

  it('should call setEditingCard when entering edit mode', async () => {
    const card = createMockTextCard();

    const { container } = render(
      <MockedProvider mocks={[]} addTypename={false}>
        <EditModeManager card={card}>
          <div data-testid="card-content">{card.content.content}</div>
        </EditModeManager>
      </MockedProvider>
    );

    // Double-click to enter edit mode
    const content = screen.getByTestId('card-content');
    fireEvent.doubleClick(content.parentElement!);

    // Verify store method was called
    await waitFor(() => {
      expect(mockSetEditingCard).toHaveBeenCalledWith(card.id);
    });
  });

  it('should call updateCard when saving content', async () => {
    const card = createMockTextCard();
    const onEditEnd = jest.fn();

    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <EditModeManager
          card={card}
          onEditEnd={onEditEnd}
          enableServerPersistence={true}
        >
          <div data-testid="card-content">{card.content.content}</div>
        </EditModeManager>
      </MockedProvider>
    );

    // Double-click to enter edit mode
    const content = screen.getByTestId('card-content');
    fireEvent.doubleClick(content.parentElement!);

    // Wait for editor to appear
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    // Change content
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New content' } });

    // Click save
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    // Verify update was called
    await waitFor(() => {
      expect(mockUpdateCard).toHaveBeenCalledWith({
        id: card.id,
        updates: {
          content: expect.objectContaining({
            type: 'text',
            content: 'New content'
          })
        }
      });
    });

    // Verify callback was called
    expect(onEditEnd).toHaveBeenCalled();
  });

  it('should handle server errors gracefully', async () => {
    const card = createMockTextCard();
    const onEditCancel = jest.fn();

    // Mock server failure
    mockUpdateCard.mockRejectedValueOnce(new Error('Server error'));

    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <EditModeManager
          card={card}
          onEditCancel={onEditCancel}
          enableServerPersistence={true}
        >
          <div data-testid="card-content">{card.content.content}</div>
        </EditModeManager>
      </MockedProvider>
    );

    // Enter edit mode
    const content = screen.getByTestId('card-content');
    fireEvent.doubleClick(content.parentElement!);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    // Change and save
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Failed content' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    // Verify error handling
    await waitFor(() => {
      expect(mockUpdateCard).toHaveBeenCalled();
      expect(onEditCancel).toHaveBeenCalledWith(card.id);
    });
  });

  it('should clear editing card on successful save', async () => {
    const card = createMockTextCard();

    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <EditModeManager
          card={card}
          enableServerPersistence={true}
        >
          <div data-testid="card-content">{card.content.content}</div>
        </EditModeManager>
      </MockedProvider>
    );

    // Enter edit mode
    const content = screen.getByTestId('card-content');
    fireEvent.doubleClick(content.parentElement!);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    // Save
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    // Verify clear was called after successful save
    await waitFor(() => {
      expect(mockClearEditingCard).toHaveBeenCalled();
    });
  });

  it('should trigger auto-save preparation after delay', async () => {
    jest.useFakeTimers();

    const card = createMockTextCard();
    const onAutoSavePrepare = jest.fn();

    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <EditModeManager
          card={card}
          onAutoSavePrepare={onAutoSavePrepare}
          autoSaveDelay={5000}
        >
          <div data-testid="card-content">{card.content.content}</div>
        </EditModeManager>
      </MockedProvider>
    );

    // Enter edit mode
    const content = screen.getByTestId('card-content');
    fireEvent.doubleClick(content.parentElement!);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    // Type content
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Auto save content' } });

    // Advance time
    jest.advanceTimersByTime(5000);

    // Verify auto-save preparation was called
    expect(onAutoSavePrepare).toHaveBeenCalledWith(
      card.id,
      expect.objectContaining({
        type: 'text',
        content: 'Auto save content'
      })
    );

    jest.useRealTimers();
  });

  it('should work without server persistence', async () => {
    const card = createMockTextCard();
    const onEditEnd = jest.fn();

    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <EditModeManager
          card={card}
          onEditEnd={onEditEnd}
          enableServerPersistence={false}
        >
          <div data-testid="card-content">{card.content.content}</div>
        </EditModeManager>
      </MockedProvider>
    );

    // Enter edit mode
    const content = screen.getByTestId('card-content');
    fireEvent.doubleClick(content.parentElement!);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    // Save
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    // Should not call server update
    expect(mockUpdateCard).not.toHaveBeenCalled();

    // But should call local callback
    expect(onEditEnd).toHaveBeenCalled();
  });
});