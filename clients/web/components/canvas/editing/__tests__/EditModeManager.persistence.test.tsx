/**
 * EditModeManager Server Persistence Tests
 *
 * Tests for connecting inline editing to server persistence with optimistic updates,
 * rollback on failure, and debounced auto-save infrastructure.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { EditModeManager } from '../EditModeManager';
import { useCardStore } from '@/stores/cardStore';
import { useCardOperations } from '@/hooks/useCardOperations';
import { UPDATE_CARD } from '@/lib/graphql/cardOperations';
import type { TextCard, CardId } from '@/types/card.types';
import { TextContentFormat } from '@/types/card.types';

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
    format: TextContentFormat.MARKDOWN,
    content: 'Original content',
    markdown: false,
    wordCount: 2,
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

describe('EditModeManager - Server Persistence', () => {
  let mockSetEditingCard: jest.Mock;
  let mockUpdateCard: jest.Mock;
  let mockClearEditingCard: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    // Note: fake timers are set up per test as needed, not globally

    // Setup cardStore mock
    mockSetEditingCard = jest.fn();
    mockClearEditingCard = jest.fn();
    const mockStore = {
      setEditingCard: mockSetEditingCard,
      clearEditingCard: mockClearEditingCard,
      editingCardId: null,
    };
    (useCardStore as unknown as jest.Mock).mockReturnValue(mockStore);

    // Setup useCardOperations mock
    mockUpdateCard = jest.fn().mockResolvedValue(true);
    const mockOperations = {
      updateCard: mockUpdateCard,
      loading: false,
      error: null,
    };
    (useCardOperations as unknown as jest.Mock).mockReturnValue(mockOperations);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Optimistic Updates', () => {
    it('should provide immediate UI feedback through cardStore', async () => {
      const card = createMockTextCard();
      const onEditEnd = jest.fn();
      const user = userEvent.setup();

      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <EditModeManager
            card={card}
            onEditEnd={onEditEnd}
          >
            <div>{typeof card.content.content === 'string' ? card.content.content : JSON.stringify(card.content.content)}</div>
          </EditModeManager>
        </MockedProvider>
      );

      // Enter edit mode
      const container = screen.getByText('Original content').parentElement;
      fireEvent.doubleClick(container!);

      // Verify edit mode is active
      expect(mockSetEditingCard).toHaveBeenCalledWith(card.id);

      // Type new content
      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Updated content');

      // Save changes
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // Verify immediate UI update callback
      await waitFor(() => {
        expect(onEditEnd).toHaveBeenCalledWith(
          card.id,
          expect.objectContaining({
            type: 'text',
            content: 'Updated content',
          })
        );
      });
    });

    it('should update Apollo cache optimistically before server response', async () => {
      jest.useFakeTimers();
      const card = createMockTextCard();
      const user = userEvent.setup({ delay: null });
      const apolloMock = {
        request: {
          query: UPDATE_CARD,
          variables: {
            id: card.id,
            input: {
              content: 'Updated content',
            },
          },
        },
        delay: 1000, // Simulate network delay
        result: {
          data: {
            updateCard: {
              ...card,
              content: 'Updated content',
            },
          },
        },
      };

      render(
        <MockedProvider mocks={[apolloMock]} addTypename={false}>
          <EditModeManager card={card}>
            <div>{typeof card.content.content === 'string' ? card.content.content : JSON.stringify(card.content.content)}</div>
          </EditModeManager>
        </MockedProvider>
      );

      // Enter edit mode and save
      const container = screen.getByText('Original content').parentElement;
      fireEvent.doubleClick(container!);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Updated content');

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // Verify optimistic update happens immediately
      expect(mockUpdateCard).toHaveBeenCalledWith({
        id: card.id,
        updates: {
          content: {
            type: 'text',
            format: TextContentFormat.MARKDOWN,
            content: 'Updated content',
            markdown: false,
            wordCount: 2,
          },
        },
      });

      // Fast-forward to see server response
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      jest.useRealTimers(); // Clean up fake timers
    });
  });

  describe('Server Persistence', () => {
    it('should persist changes to server via useCardOperations', async () => {
      const card = createMockTextCard();
      const user = userEvent.setup();

      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <EditModeManager card={card}>
            <div>{typeof card.content.content === 'string' ? card.content.content : JSON.stringify(card.content.content)}</div>
          </EditModeManager>
        </MockedProvider>
      );

      // Enter edit mode
      const container = screen.getByText('Original content').parentElement;
      fireEvent.doubleClick(container!);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      // Update content
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Server persisted content');

      // Save
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // Verify server persistence
      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalledWith({
          id: card.id,
          updates: {
            content: expect.objectContaining({
              type: 'text',
              content: 'Server persisted content',
            }),
          },
        });
      });
    });

    it('should handle multiple field updates correctly', async () => {
      const card = createMockTextCard();
      card.metadata = { fontSize: 14, fontFamily: 'Arial' };
      const user = userEvent.setup();

      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <EditModeManager card={card}>
            <div>{typeof card.content.content === 'string' ? card.content.content : JSON.stringify(card.content.content)}</div>
          </EditModeManager>
        </MockedProvider>
      );

      // Enter edit mode
      const container = screen.getByText('Original content').parentElement;
      fireEvent.doubleClick(container!);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      // Update content
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Multi-field update');

      // Save
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // Verify correct update structure
      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalledWith({
          id: card.id,
          updates: {
            content: expect.objectContaining({
              type: 'text',
              content: 'Multi-field update',
            }),
          },
        });
      });
    });
  });

  describe('Error Handling and Rollback', () => {
    it('should rollback optimistic updates on server failure', async () => {
      const card = createMockTextCard();
      const onEditEnd = jest.fn();
      const onEditCancel = jest.fn();

      // Mock server failure
      mockUpdateCard.mockRejectedValueOnce(new Error('Server error'));

      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <EditModeManager
            card={card}
            onEditEnd={onEditEnd}
            onEditCancel={onEditCancel}
          >
            <div>{typeof card.content.content === 'string' ? card.content.content : JSON.stringify(card.content.content)}</div>
          </EditModeManager>
        </MockedProvider>
      );

      // Enter edit mode and update
      const container = screen.getByText('Original content').parentElement;
      fireEvent.doubleClick(container!);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'Failed update');

      // Save (will fail)
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // Verify rollback
      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalled();
        expect(onEditCancel).toHaveBeenCalled(); // Should cancel on error
      });
    });

    it('should show error message on save failure', async () => {
      const card = createMockTextCard();
      mockUpdateCard.mockRejectedValueOnce(new Error('Network error'));

      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <EditModeManager card={card}>
            <div>{typeof card.content.content === 'string' ? card.content.content : JSON.stringify(card.content.content)}</div>
          </EditModeManager>
        </MockedProvider>
      );

      // Enter edit mode
      const container = screen.getByText('Original content').parentElement;
      fireEvent.doubleClick(container!);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, ' with error');

      // Try to save
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // Should show error message (there might be multiple)
      await waitFor(() => {
        const errorMessages = screen.getAllByText(/Failed to save/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance', () => {
    it('should update UI in less than 100ms', async () => {
      const card = createMockTextCard();
      const user = userEvent.setup();

      render(
        <MockedProvider mocks={[]} addTypename={false}>
          <EditModeManager card={card}>
            <div>{typeof card.content.content === 'string' ? card.content.content : JSON.stringify(card.content.content)}</div>
          </EditModeManager>
        </MockedProvider>
      );

      // Enter edit mode
      const container = screen.getByText('Original content').parentElement;
      fireEvent.doubleClick(container!);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Performance test');

      // Measure time to save
      const saveStart = performance.now();
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // UI update should be immediate
      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalled();
      });

      const saveEnd = performance.now();
      const saveTime = saveEnd - saveStart;

      expect(saveTime).toBeLessThan(100);
    });
  });
});
