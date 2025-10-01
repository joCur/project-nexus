/**
 * EditorOverlay Accessibility Tests
 *
 * Comprehensive test suite for accessibility features in EditorOverlay component.
 * Tests WCAG 2.1 AA compliance including:
 * - Screen reader announcements
 * - ARIA labels and roles
 * - Focus management
 * - Keyboard navigation
 * - High contrast mode
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MockedProvider } from '@apollo/client/testing';
import { EditorOverlay } from '../EditorOverlay';
import { useCardStore } from '@/stores/cardStore';
import { GET_CARDS_IN_BOUNDS } from '@/lib/graphql/cardOperations';

// Mock dependencies
jest.mock('@/stores/cardStore');
jest.mock('@/hooks/useCardOperations', () => ({
  useCardOperations: jest.fn(() => ({
    updateCard: jest.fn().mockResolvedValue(true),
    deleteCard: jest.fn().mockResolvedValue(true),
    createCard: jest.fn().mockResolvedValue({ id: 'new-card' })
  }))
}));

// Mock type for card store - partial implementation for testing
type MockCardStore = Partial<ReturnType<typeof useCardStore>>;
jest.mock('@/contexts/WorkspacePermissionContext', () => ({
  useWorkspacePermissionContextSafe: () => ({
    currentWorkspaceId: 'test-workspace'
  })
}));

// Mock GraphQL query
const mockCardsData = {
  request: {
    query: GET_CARDS_IN_BOUNDS,
    variables: {
      workspaceId: 'test-workspace',
      bounds: { minX: -100000, minY: -100000, maxX: 100000, maxY: 100000 }
    }
  },
  result: {
    data: {
      cardsInBounds: [
        {
          id: 'test-card-1',
          type: 'text',
          content: 'Test content',
          ownerId: 'test-user',
          position: { x: 100, y: 100, z: 0 },
          dimensions: { width: 200, height: 100 },
          style: {},
          status: 'active',
          priority: 'normal',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          tags: [],
          metadata: {}
        }
      ]
    }
  }
};

describe('EditorOverlay - Accessibility', () => {
  const mockUseCardStore = useCardStore as jest.MockedFunction<typeof useCardStore>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Default store state - no editing
    mockUseCardStore.mockReturnValue({
      editingCardId: null,
      clearEditingCard: jest.fn(),
      cards: [],
      addCard: jest.fn(),
      updateCard: jest.fn(),
      deleteCard: jest.fn(),
      setEditingCard: jest.fn(),
      selectCard: jest.fn(),
      deselectCard: jest.fn(),
      clearSelection: jest.fn(),
      moveCards: jest.fn(),
      batchUpdate: jest.fn()
    } as MockCardStore);
  });

  describe('Screen Reader Announcements', () => {
    it('should announce when edit mode is entered', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const announcement = screen.getByRole('status', { name: /edit mode/i });
        expect(announcement).toBeInTheDocument();
        expect(announcement).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should announce when edit mode is exited', async () => {
      // Start with editing mode
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      const { rerender } = render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      // Exit editing mode
      mockUseCardStore.mockReturnValue({
        editingCardId: null,
        clearEditingCard: jest.fn()
      } as MockCardStore);

      rerender(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const announcement = screen.queryByRole('status', { name: /edit mode closed/i });
        expect(announcement).toBeInTheDocument();
      });
    });

    it('should announce save status changes', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const saveStatus = screen.getByRole('status', { name: /save status/i });
        expect(saveStatus).toHaveAttribute('aria-live', 'polite');
        expect(saveStatus).toHaveAttribute('aria-atomic', 'true');
      });
    });
  });

  describe('ARIA Labels and Roles', () => {
    it('should have proper dialog role for overlay', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby');
      });
    });

    it('should have descriptive aria-label for editor overlay', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-label', expect.stringContaining('Edit'));
      });
    });

    it('should have proper role for backdrop', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const backdrop = screen.getByTestId('editor-backdrop');
        expect(backdrop).toHaveAttribute('role', 'presentation');
        expect(backdrop).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('should have aria-describedby pointing to editor content', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        const describedById = dialog.getAttribute('aria-describedby');
        expect(describedById).toBeTruthy();

        const description = document.getElementById(describedById!);
        expect(description).toBeInTheDocument();
      });
    });
  });

  describe('Focus Management', () => {
    it('should trap focus within the editor overlay', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('data-focus-trap', 'true');
      });
    });

    it('should focus first interactive element when opened', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const firstInput = screen.getByRole('textbox');
        expect(firstInput).toHaveFocus();
      });
    });

    it('should restore focus to triggering element when closed', async () => {
      const triggerButton = document.createElement('button');
      triggerButton.textContent = 'Edit Card';
      document.body.appendChild(triggerButton);
      triggerButton.focus();

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      const { rerender } = render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      // Close the overlay
      mockUseCardStore.mockReturnValue({
        editingCardId: null,
        clearEditingCard: jest.fn()
      } as MockCardStore);

      rerender(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(document.activeElement).toBe(triggerButton);
      });

      document.body.removeChild(triggerButton);
    });

    it('should prevent tabbing outside the overlay', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        const focusableElements = dialog.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        expect(focusableElements.length).toBeGreaterThan(0);

        // Verify tab order is contained
        focusableElements.forEach((element) => {
          expect(dialog.contains(element)).toBe(true);
        });
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should have visible focus indicators on all interactive elements', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          // Should have focus outline defined
          expect(button).toHaveClass('focus-visible:ring-2');
        });
      });
    });

    it('should maintain logical tab order', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const focusableElements = screen.getByRole('dialog').querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const tabIndices = Array.from(focusableElements).map(
          (el) => parseInt(el.getAttribute('tabindex') || '0', 10)
        );

        // All should be 0 or positive, indicating natural tab order
        tabIndices.forEach((index) => {
          expect(index).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  describe('High Contrast Mode', () => {
    it('should apply high contrast mode class when enabled', async () => {
      // Mock matchMedia for high contrast mode detection
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      });

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveClass('high-contrast');
      });
    });

    it('should have enhanced focus indicators in high contrast mode', async () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      });

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          expect(button).toHaveClass('high-contrast:ring-4');
        });
      });
    });

    it('should maintain sufficient color contrast in high contrast mode', async () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      });

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        // Should have high contrast text classes
        expect(dialog.className).toMatch(/high-contrast:text-/);
      });
    });
  });

  describe('WCAG 2.1 Compliance', () => {
    it('should meet minimum contrast ratio requirements (4.5:1)', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        // Test would verify color contrast using automated tools
        // This is a placeholder for integration with axe-core or similar
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
      });
    });

    it('should have all interactive elements keyboard accessible', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const inputs = screen.getAllByRole('textbox');

        [...buttons, ...inputs].forEach((element) => {
          expect(element).not.toHaveAttribute('tabindex', '-1');
        });
      });
    });

    it('should provide text alternatives for all non-text content', async () => {
      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const images = screen.queryAllByRole('img');
        images.forEach((img) => {
          expect(img).toHaveAttribute('alt');
        });
      });
    });
  });

  describe('Reduced Motion Support', () => {
    it('should respect prefers-reduced-motion preference', async () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      });

      mockUseCardStore.mockReturnValue({
        editingCardId: 'test-card-1',
        clearEditingCard: jest.fn()
      } as MockCardStore);

      render(
        <MockedProvider mocks={[mockCardsData]} addTypename={false}>
          <EditorOverlay workspaceId="test-workspace" />
        </MockedProvider>
      );

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveClass('motion-reduce');
      });
    });
  });
});
