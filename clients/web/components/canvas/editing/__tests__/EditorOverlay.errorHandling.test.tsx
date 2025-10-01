/**
 * EditorOverlay Error Handling Tests
 *
 * Tests for comprehensive error handling including:
 * - Network errors with retry
 * - Validation errors
 * - Conflict detection
 * - Error recovery
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MockedProvider } from '@apollo/client/testing';
import { EditorOverlay } from '../EditorOverlay';
import { useCardStore } from '@/stores/cardStore';
import { GET_CARDS_IN_BOUNDS } from '@/lib/graphql/cardOperations';
import { useCardOperations } from '@/hooks/useCardOperations';
import type { CardStore } from '@/types/card.types';

// Mock the card store
jest.mock('@/stores/cardStore');
const mockUseCardStore = useCardStore as jest.MockedFunction<typeof useCardStore>;

// Mock type for card store
type MockCardStore = Partial<ReturnType<typeof useCardStore>>;

// Static minimal CardStore mock (for use in jest.mock)
const staticMockCardStore: CardStore = {
  selection: {
    selectedIds: new Set(),
    lastSelected: undefined,
    primarySelected: undefined,
    selectionBounds: undefined,
    mode: 'single' as const,
    isDragSelection: false,
  },
  dragState: {
    isDragging: false,
    draggedIds: new Set(),
    startPosition: { x: 0, y: 0 },
    currentOffset: { x: 0, y: 0 },
  },
  resizeState: {
    isResizing: false,
    cardId: undefined,
    handle: undefined,
    originalDimensions: undefined,
    minDimensions: { width: 100, height: 50 },
    maxDimensions: { width: 2000, height: 2000 },
    maintainAspectRatio: false,
  },
  hoverState: {
    hoveredId: undefined,
    hoverStartTime: undefined,
    showTooltip: false,
    tooltipPosition: undefined,
  },
  editingCardId: null,
  selectCard: jest.fn(),
  selectCards: jest.fn(),
  clearSelection: jest.fn(),
  isCardSelected: jest.fn(),
  startDrag: jest.fn(),
  updateDrag: jest.fn(),
  endDrag: jest.fn(),
  cancelDrag: jest.fn(),
  startResize: jest.fn(),
  updateResize: jest.fn(),
  endResize: jest.fn(),
  cancelResize: jest.fn(),
  setHoveredCard: jest.fn(),
  setEditingCard: jest.fn(),
  clearEditingCard: jest.fn(),
};

// Create helper function for tests
const createMockCardStore = (): CardStore => staticMockCardStore;

// Mock the useCardOperations hook with default return
jest.mock('@/hooks/useCardOperations', () => ({
  useCardOperations: jest.fn(() => ({
    serverCards: [],
    loading: false,
    error: undefined,
    updateCard: jest.fn(),
    deleteCard: jest.fn(),
    createCard: jest.fn(),
    syncCardsFromServer: jest.fn(),
    refetchCards: jest.fn(),
    store: staticMockCardStore,
    cardSubscriptionErrors: {
      cardCreated: null,
      cardUpdated: null,
      cardDeleted: null
    },
    hasCardSubscriptionErrors: false
  }))
}));
const mockUseCardOperations = useCardOperations as jest.MockedFunction<typeof useCardOperations>;

// Mock workspace permission context
jest.mock('@/contexts/WorkspacePermissionContext', () => ({
  useWorkspacePermissionContextSafe: () => ({
    currentWorkspaceId: 'test-workspace'
  })
}));

describe('EditorOverlay - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Network Error Handling', () => {
    it('should display network error when save fails', async () => {
      const mockUpdateCard = jest.fn().mockRejectedValue(new Error('Network error'));
      mockUseCardOperations.mockReturnValue({
        serverCards: [],
        loading: false,
        error: undefined,
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
        syncCardsFromServer: jest.fn(),
        refetchCards: jest.fn(),
        store: createMockCardStore(),
        cardSubscriptionErrors: {
          cardCreated: null,
          cardUpdated: null,
          cardDeleted: null
        },
        hasCardSubscriptionErrors: false
      });

      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      const mocks = [
        {
          request: {
            query: GET_CARDS_IN_BOUNDS,
            variables: expect.any(Object),
          },
          result: {
            data: {
              cardsInBounds: [
                {
                  id: 'card-1',
                  type: 'TEXT',
                  content: 'Test content',
                  position: { x: 0, y: 0, z: 0 },
                  ownerId: 'user-1'
                }
              ]
            }
          }
        }
      ];

      render(
        <MockedProvider mocks={mocks}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on network error', async () => {
      const mockUpdateCard = jest.fn().mockRejectedValue(new Error('Connection failed'));
      mockUseCardOperations.mockReturnValue({
        serverCards: [],
        loading: false,
        error: undefined,
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
        syncCardsFromServer: jest.fn(),
        refetchCards: jest.fn(),
        store: createMockCardStore(),
        cardSubscriptionErrors: {
          cardCreated: null,
          cardUpdated: null,
          cardDeleted: null
        },
        hasCardSubscriptionErrors: false
      });

      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should retry save operation when retry button clicked', async () => {
      let callCount = 0;
      const mockUpdateCard = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(true);
      });

      mockUseCardOperations.mockReturnValue({
        serverCards: [],
        loading: false,
        error: undefined,
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
        syncCardsFromServer: jest.fn(),
        refetchCards: jest.fn(),
        store: createMockCardStore(),
        cardSubscriptionErrors: {
          cardCreated: null,
          cardUpdated: null,
          cardDeleted: null
        },
        hasCardSubscriptionErrors: false
      });

      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(mockUpdateCard).toHaveBeenCalledTimes(2);
      });
    });

    it('should track retry attempts', async () => {
      const mockUpdateCard = jest.fn().mockRejectedValue(new Error('Network error'));
      mockUseCardOperations.mockReturnValue({
        serverCards: [],
        loading: false,
        error: undefined,
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
        syncCardsFromServer: jest.fn(),
        refetchCards: jest.fn(),
        store: createMockCardStore(),
        cardSubscriptionErrors: {
          cardCreated: null,
          cardUpdated: null,
          cardDeleted: null
        },
        hasCardSubscriptionErrors: false
      });

      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/attempt 2/i)).toBeInTheDocument();
      });
    });

  });

  describe('Validation Error Handling', () => {
    it('should display validation errors', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      // Simulate validation error
      const saveButton = await screen.findByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
      });
    });

    it('should show field-specific validation errors', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/content is required/i)).toBeInTheDocument();
        expect(screen.getByText(/title must be at least 3 characters/i)).toBeInTheDocument();
      });
    });

    it('should prevent save when validation fails', async () => {
      const mockUpdateCard = jest.fn();
      mockUseCardOperations.mockReturnValue({
        serverCards: [],
        loading: false,
        error: undefined,
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
        syncCardsFromServer: jest.fn(),
        refetchCards: jest.fn(),
        store: createMockCardStore(),
        cardSubscriptionErrors: {
          cardCreated: null,
          cardUpdated: null,
          cardDeleted: null
        },
        hasCardSubscriptionErrors: false
      });

      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      const saveButton = await screen.findByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateCard).not.toHaveBeenCalled();
      });
    });

    it('should clear validation errors when input is corrected', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      // Initially has validation error
      await waitFor(() => {
        expect(screen.getByText(/content is required/i)).toBeInTheDocument();
      });

      // Fix the input
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Valid content' } });

      await waitFor(() => {
        expect(screen.queryByText(/content is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Message Accessibility', () => {
    it('should announce errors to screen readers', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('aria-live', 'assertive');
        expect(alert).toHaveTextContent(/error/i);
      });
    });

    it('should provide clear error descriptions', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveAttribute('aria-describedby');
      });
    });

    it('should focus error message when it appears', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(document.activeElement).toBe(errorElement);
      });
    });
  });

  describe('Error State Persistence', () => {
    it('should maintain error state when editor remains open', async () => {
      const mockUpdateCard = jest.fn().mockRejectedValue(new Error('Network error'));
      mockUseCardOperations.mockReturnValue({
        serverCards: [],
        loading: false,
        error: undefined,
        updateCard: mockUpdateCard,
        deleteCard: jest.fn(),
        createCard: jest.fn(),
        syncCardsFromServer: jest.fn(),
        refetchCards: jest.fn(),
        store: createMockCardStore(),
        cardSubscriptionErrors: {
          cardCreated: null,
          cardUpdated: null,
          cardDeleted: null
        },
        hasCardSubscriptionErrors: false
      });

      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      const { rerender } = render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Rerender should maintain error state
      rerender(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    it('should clear error state when editor is closed', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'card-1',
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      const { rerender } = render(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });

      // Close editor
      mockUseCardStore.mockReturnValue({
        editingCardId: null,
        clearEditingCard: jest.fn(),
      } as MockCardStore);

      rerender(
        <MockedProvider mocks={[]}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });
});
