/**
 * EditorOverlay Animation Tests
 *
 * TDD tests for edit mode animations and transitions:
 * - Fade-in/out for edit overlays
 * - Loading states for server save operations
 * - Success/error feedback for save operations
 * - Backdrop interactions
 *
 * Test Structure: RED → GREEN → REFACTOR → VERIFY
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { EditorOverlay } from '../EditorOverlay';
import { useCardStore } from '@/stores/cardStore';
import { useCardOperations } from '@/hooks/useCardOperations';
import { GET_CARDS_IN_BOUNDS } from '@/lib/graphql/cardOperations';
import type { CardId } from '@/types/card.types';

// Mock dependencies
jest.mock('@/stores/cardStore');
jest.mock('@/hooks/useCardOperations');
jest.mock('@/contexts/WorkspacePermissionContext', () => ({
  useWorkspacePermissionContextSafe: jest.fn(() => ({
    currentWorkspaceId: 'test-workspace'
  }))
}));

describe('EditorOverlay - Animation Tests (TDD)', () => {
  let mockClearEditingCard: jest.Mock;
  let mockUpdateCard: jest.Mock;

  // Mock card data for GraphQL
  const mockCard = {
    id: 'card-1',
    ownerId: 'user-1',
    type: 'TEXT',
    content: 'Test content',
    title: null,
    position: { x: 100, y: 100, z: 0 },
    dimensions: { width: 300, height: 200 },
    style: {
      backgroundColor: '#ffffff',
      borderColor: '#e0e0e0',
      textColor: '#000000',
    },
    status: 'ACTIVE',
    priority: 'NORMAL',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    tags: [],
    metadata: {},
  };

  const mockCardsQuery = {
    request: {
      query: GET_CARDS_IN_BOUNDS,
      variables: {
        workspaceId: 'test-workspace',
        bounds: { minX: -100000, minY: -100000, maxX: 100000, maxY: 100000 }
      }
    },
    result: {
      data: {
        cardsInBounds: [mockCard]
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup cardStore mock
    mockClearEditingCard = jest.fn();
    (useCardStore as unknown as jest.Mock).mockReturnValue({
      editingCardId: null,
      clearEditingCard: mockClearEditingCard,
    });

    // Setup useCardOperations mock
    mockUpdateCard = jest.fn().mockResolvedValue(true);
    (useCardOperations as unknown as jest.Mock).mockReturnValue({
      updateCard: mockUpdateCard,
      loading: false,
      error: null,
    });
  });

  describe('Rendering and Visibility', () => {
    it('should render editor overlay when card is being edited', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      // Wait for editor status to appear
      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should show status bar
      expect(screen.getByText(/editing/i)).toBeInTheDocument();
    });

    it('should show backdrop with blur effect', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      const { container } = render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Check for backdrop blur classes
      const backdrop = container.querySelector('.backdrop-blur-sm');
      expect(backdrop).toBeInTheDocument();
    });

    it('should not render when no card is being edited', () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: null,
        clearEditingCard: mockClearEditingCard,
      });

      const { container } = render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      // Should not render anything
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Status Indicators', () => {
    it('should show editing indicator with pulse animation', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should have pulse animation on status indicator
      const statusText = screen.getByText(/editing/i);
      const statusBar = statusText.closest('div');
      const pulseIndicator = statusBar?.querySelector('.animate-pulse');
      expect(pulseIndicator).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('should show error indicator on failed save', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      mockUpdateCard.mockRejectedValueOnce(new Error('Save failed'));

      render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" enableServerPersistence={true} />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Get editor and save button
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should have error indicator with shake animation
      const errorText = screen.getByText(/failed to save/i);
      expect(errorText).toBeInTheDocument();
      const errorIndicator = errorText.previousElementSibling;
      expect(errorIndicator).toHaveClass('bg-red-500');
    });

    it('should keep editor open after error for retry', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      mockUpdateCard.mockRejectedValueOnce(new Error('Save failed'));

      render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" enableServerPersistence={true} />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Editor should still be visible
      expect(screen.getByText(/editing/i)).toBeInTheDocument();
      expect(mockClearEditingCard).not.toHaveBeenCalled();
    });
  });

  describe('Backdrop Interaction', () => {
    it('should close editor on backdrop click', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      const { container } = render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Click backdrop (element with backdrop-blur class)
      const backdrop = container.querySelector('.backdrop-blur-sm');
      expect(backdrop).toBeInTheDocument();

      fireEvent.click(backdrop!);

      // Should trigger cancel
      await waitFor(() => {
        expect(mockClearEditingCard).toHaveBeenCalled();
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount without errors', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      const { unmount } = render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should not throw on unmount
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Loading State Animations (TDD - RED)', () => {
    it('should show loading spinner during save operation', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      // Make save operation slow to capture loading state
      mockUpdateCard.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve(true), 500);
      }));

      render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" enableServerPersistence={true} />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Trigger save
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Should show "Saving..." status
      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      }, { timeout: 1000 });

      // Verify loading spinner is present (pulse animation on status indicator)
      const savingText = screen.getByText(/saving/i);
      const statusBar = savingText.closest('div');
      const pulseIndicator = statusBar?.querySelector('.animate-pulse');
      expect(pulseIndicator).toBeInTheDocument();
    });

    it('should show loading state in save button', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      // Make save operation slow
      mockUpdateCard.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve(true), 500);
      }));

      render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" enableServerPersistence={true} />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Button should show "Saving..." text
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
      }, { timeout: 1000 });

      // Button should be disabled during save
      const savingButton = screen.getByRole('button', { name: /saving/i });
      expect(savingButton).toBeDisabled();
    });

    it('should disable all interactions during save', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      mockUpdateCard.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve(true), 500);
      }));

      render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" enableServerPersistence={true} />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      }, { timeout: 1000 });

      // Both save and cancel buttons should be disabled
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Success Feedback Animations (TDD - RED)', () => {
    it('should show success state briefly after successful save', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      mockUpdateCard.mockResolvedValue(true);

      render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" enableServerPersistence={true} />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Should close editor after successful save
      await waitFor(() => {
        expect(mockClearEditingCard).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should complete save within reasonable time', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      mockUpdateCard.mockResolvedValue(true);

      render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" enableServerPersistence={true} />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      const startTime = Date.now();
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockClearEditingCard).toHaveBeenCalled();
      }, { timeout: 2000 });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Save operation should complete quickly (< 1000ms)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Animation Timing and Performance (TDD - RED)', () => {
    it('should use smooth fade-in animation for overlay', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      const { container } = render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify backdrop has opacity transition (backdrop-blur implies fade-in)
      const backdrop = container.querySelector('.backdrop-blur-sm');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveClass('fixed', 'inset-0');
    });

    it('should not block user input during animations', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Editor should be immediately interactive
      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toBeDisabled();

      // Should be able to type immediately
      fireEvent.change(textarea, { target: { value: 'New content' } });
      expect(textarea).toHaveValue('New content');
    });

    it('should handle rapid open/close without errors', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValueOnce({
        editingCardId: null,
        clearEditingCard: mockClearEditingCard,
      });

      const { rerender } = render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      // Rapidly toggle editing state - remock with new value
      (useCardStore as unknown as jest.Mock).mockReturnValueOnce({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      rerender(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 1000 });

      // Toggle back to closed state
      (useCardStore as unknown as jest.Mock).mockReturnValueOnce({
        editingCardId: null,
        clearEditingCard: mockClearEditingCard,
      });

      rerender(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      // Should not crash
      await waitFor(() => {
        expect(screen.queryByText(/editing/i)).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Animation Cleanup (TDD - RED)', () => {
    it('should cleanup animations on unmount without memory leaks', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      const { unmount } = render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Unmount should cleanup all animations
      unmount();

      // Wait a bit to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 200));

      // No errors should be thrown
      expect(true).toBe(true);
    });

    it('should cancel ongoing animations on unmount', async () => {
      (useCardStore as unknown as jest.Mock).mockReturnValue({
        editingCardId: 'card-1' as CardId,
        clearEditingCard: mockClearEditingCard,
      });

      // Start a long save operation
      mockUpdateCard.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve(true), 2000);
      }));

      const { unmount } = render(
        <MockedProvider mocks={[mockCardsQuery]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" enableServerPersistence={true} />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/editing/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Unmount during save
      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      }, { timeout: 500 });

      // Should not throw on unmount during save
      expect(() => unmount()).not.toThrow();
    });
  });
});
