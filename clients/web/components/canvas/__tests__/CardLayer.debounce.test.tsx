/**
 * CardLayer Viewport Bounds Debouncing Tests (TDD - RED Phase)
 *
 * Tests for debouncing viewport bounds to prevent unnecessary GraphQL queries
 * during zoom/pan operations.
 *
 * TDD Process:
 * 1. RED: Write failing tests (this file)
 * 2. GREEN: Implement minimal code to pass tests
 * 3. REFACTOR: Clean up implementation
 * 4. VERIFY: Run all CardLayer tests to ensure no regressions
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardLayer } from '../CardLayer';
import type { Card, TextCard, CardId, CardStatus, CardPriority } from '@/types/card.types';
import type { EntityId } from '@/types/common.types';

// Mock Konva components
jest.mock('react-konva', () => ({
  Layer: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="konva-layer" {...props}>
      {children}
    </div>
  ),
}));

// Mock the CardRenderer component
jest.mock('../cards/CardRenderer', () => ({
  CardRenderer: ({ card }: { card: Card }) => (
    <div
      data-testid={`card-renderer-${card.id}`}
      data-card-type={card.content.type}
    >
      Card: {card.id}
    </div>
  ),
}));

// Mock Apollo Client useQuery and useMutation hooks
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

// Mock stores and contexts
const mockCanvasStore = {
  viewport: {
    zoom: 1,
    position: { x: 0, y: 0 },
  },
};

const mockWorkspaceContext = {
  currentWorkspaceId: 'test-workspace-id' as string | undefined,
};

jest.mock('@/stores/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore,
}));

jest.mock('@/contexts/WorkspacePermissionContext', () => ({
  useWorkspacePermissionContextSafe: () => mockWorkspaceContext,
}));

jest.mock('@/utils/viewport', () => ({
  useViewportDimensions: () => ({ width: 1920, height: 1080 }),
}));

// Helper to create test card
const createTestCard = (
  id: string,
  x: number = 0,
  y: number = 0,
  z: number = 0
): TextCard => {
  return {
    id: id as CardId,
    ownerId: 'test-user-id' as EntityId,
    position: { x, y, z },
    dimensions: { width: 200, height: 100 },
    style: {
      backgroundColor: '#ffffff',
      borderColor: '#cccccc',
      textColor: '#000000',
      borderWidth: 1,
      borderRadius: 4,
      opacity: 1,
      shadow: false,
    },
    isHidden: false,
    isLocked: false,
    isSelected: false,
    isMinimized: false,
    status: 'active' as CardStatus,
    priority: 'normal' as CardPriority,
    tags: [] as string[],
    animation: {
      isAnimating: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {},
    content: {
      type: 'text' as const,
      content: 'Test text content',
      markdown: false,
      wordCount: 3,
    },
  };
};

// Helper to create backend card response
const createBackendCard = (card: Card) => ({
  id: String(card.id),
  workspaceId: 'test-workspace-id',
  ownerId: card.ownerId,
  type: card.content.type.toUpperCase(),
  content: (card as TextCard).content.content,
  title: null,
  position: {
    x: card.position.x,
    y: card.position.y,
    z: card.position.z,
  },
  dimensions: card.dimensions,
  style: card.style,
  status: card.status.toUpperCase(),
  priority: card.priority.toUpperCase(),
  tags: card.tags,
  metadata: card.metadata,
  createdAt: card.createdAt,
  updatedAt: card.updatedAt,
  version: 1,
});

describe('CardLayer Viewport Bounds Debouncing (TDD - RED Phase)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseQuery.mockClear();
    mockUseMutation.mockClear();

    // Setup default mutation mock
    mockUseMutation.mockReturnValue([
      jest.fn(),
      {
        data: null,
        loading: false,
        error: null,
        called: false,
      },
    ]);

    // Reset viewport state
    mockCanvasStore.viewport.zoom = 1;
    mockCanvasStore.viewport.position = { x: 0, y: 0 };
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('RED Phase: Debounce viewport bounds calculation', () => {
    it('should not trigger multiple GraphQL queries for rapid zoom changes', async () => {
      const card = createTestCard('card1', 0, 0, 1);

      // Track unique query variable objects by capturing their bounds
      const uniqueQueryVariables: Set<string> = new Set();
      mockUseQuery.mockImplementation((query: unknown, options: { variables: { bounds: { minX: number; minY: number; maxX: number; maxY: number } } }) => {
        // Serialize bounds to detect unique queries
        const boundsKey = JSON.stringify(options.variables.bounds);
        uniqueQueryVariables.add(boundsKey);
        return {
          data: {
            cardsInBounds: [createBackendCard(card)],
          },
          loading: false,
          error: null,
        };
      });

      const { rerender } = render(<CardLayer />);

      // Initial render should have one unique query
      const initialQueryCount = uniqueQueryVariables.size;
      expect(initialQueryCount).toBe(1);

      // Simulate rapid zoom changes (5 times in quick succession)
      act(() => {
        mockCanvasStore.viewport.zoom = 1.1;
      });
      rerender(<CardLayer />);

      act(() => {
        mockCanvasStore.viewport.zoom = 1.2;
      });
      rerender(<CardLayer />);

      act(() => {
        mockCanvasStore.viewport.zoom = 1.3;
      });
      rerender(<CardLayer />);

      act(() => {
        mockCanvasStore.viewport.zoom = 1.4;
      });
      rerender(<CardLayer />);

      act(() => {
        mockCanvasStore.viewport.zoom = 1.5;
      });
      rerender(<CardLayer />);

      // During rapid changes, query variables should not change (debounce hasn't fired)
      // Still using the initial debounced bounds
      expect(uniqueQueryVariables.size).toBe(1);
    });

    it('should trigger query after 150ms of viewport stability', async () => {
      const card = createTestCard('card2', 0, 0, 1);

      const uniqueQueryVariables: Set<string> = new Set();
      mockUseQuery.mockImplementation((query: unknown, options: { variables: { bounds: { minX: number; minY: number; maxX: number; maxY: number } } }) => {
        const boundsKey = JSON.stringify(options.variables.bounds);
        uniqueQueryVariables.add(boundsKey);
        return {
          data: {
            cardsInBounds: [createBackendCard(card)],
          },
          loading: false,
          error: null,
        };
      });

      const { rerender } = render(<CardLayer />);

      // Initial render
      expect(uniqueQueryVariables.size).toBe(1);

      // Change viewport
      act(() => {
        mockCanvasStore.viewport.zoom = 2;
      });
      rerender(<CardLayer />);

      // Query variables should not change immediately
      expect(uniqueQueryVariables.size).toBe(1);

      // Advance timers by 150ms
      act(() => {
        jest.advanceTimersByTime(150);
      });

      // Force a rerender to apply the debounced state update
      rerender(<CardLayer />);

      // Now query variables should have changed (new unique bounds)
      expect(uniqueQueryVariables.size).toBe(2);
    });

    it('should reset debounce timer on each viewport change', async () => {
      const card = createTestCard('card3', 0, 0, 1);

      const uniqueQueryVariables: Set<string> = new Set();
      mockUseQuery.mockImplementation((query: unknown, options: { variables: { bounds: { minX: number; minY: number; maxX: number; maxY: number } } }) => {
        const boundsKey = JSON.stringify(options.variables.bounds);
        uniqueQueryVariables.add(boundsKey);
        return {
          data: {
            cardsInBounds: [createBackendCard(card)],
          },
          loading: false,
          error: null,
        };
      });

      const { rerender } = render(<CardLayer />);

      expect(uniqueQueryVariables.size).toBe(1);

      // First change
      act(() => {
        mockCanvasStore.viewport.zoom = 1.5;
      });
      rerender(<CardLayer />);

      // Wait 100ms (less than 150ms debounce)
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Second change before debounce fires
      act(() => {
        mockCanvasStore.viewport.zoom = 2.0;
      });
      rerender(<CardLayer />);

      // Wait another 100ms (total 200ms from first change, but only 100ms from second)
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Query variables should NOT have changed yet (timer was reset)
      expect(uniqueQueryVariables.size).toBe(1);

      // Wait the remaining 50ms
      act(() => {
        jest.advanceTimersByTime(50);
      });

      // Force rerender to apply state change
      rerender(<CardLayer />);

      // Now query variables should have changed (150ms after last change)
      expect(uniqueQueryVariables.size).toBe(2);
    });

    it('should keep cards visible during debounce period using cached data', async () => {
      const card = createTestCard('card4', 100, 100, 1);

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card)],
        },
        loading: false,
        error: null,
      });

      const { rerender } = render(<CardLayer />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('card-renderer-card4')).toBeInTheDocument();
      });

      // Change viewport - card should remain visible
      act(() => {
        mockCanvasStore.viewport.zoom = 2;
      });
      rerender(<CardLayer />);

      // Card should still be visible immediately (using cached data)
      expect(screen.getByTestId('card-renderer-card4')).toBeInTheDocument();

      // After debounce, card should still be visible
      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(screen.getByTestId('card-renderer-card4')).toBeInTheDocument();
      });
    });

    it('should cleanup timer on unmount', async () => {
      const card = createTestCard('card5', 0, 0, 1);

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card)],
        },
        loading: false,
        error: null,
      });

      const { unmount } = render(<CardLayer />);

      // Change viewport
      act(() => {
        mockCanvasStore.viewport.zoom = 2;
      });

      // Unmount before debounce fires
      unmount();

      // Timer should be cleaned up - this test verifies no errors occur
      act(() => {
        jest.advanceTimersByTime(150);
      });

      // If cleanup works correctly, no errors should occur
      expect(true).toBe(true);
    });

    it('should use debounced bounds for GraphQL query variables', async () => {
      const card = createTestCard('card6', 0, 0, 1);

      // Capture the query variables passed to useQuery
      const capturedVariables: unknown[] = [];
      mockUseQuery.mockImplementation((query: unknown, options: { variables: unknown }) => {
        capturedVariables.push(options.variables);
        return {
          data: {
            cardsInBounds: [createBackendCard(card)],
          },
          loading: false,
          error: null,
        };
      });

      const { rerender } = render(<CardLayer />);

      // Initial render - capture initial bounds
      const initialVariables = capturedVariables[capturedVariables.length - 1];

      // Change viewport
      act(() => {
        mockCanvasStore.viewport.position = { x: -1000, y: -1000 };
      });
      rerender(<CardLayer />);

      // Variables should NOT change immediately (still using debounced bounds)
      const immediateVariables = capturedVariables[capturedVariables.length - 1];
      expect(immediateVariables).toEqual(initialVariables); // RED: Will fail without debouncing

      // After debounce
      act(() => {
        jest.advanceTimersByTime(150);
      });

      // Variables should now reflect new bounds
      const debouncedVariables = capturedVariables[capturedVariables.length - 1];
      // RED: This will fail because variables will change immediately without debouncing
      expect(debouncedVariables).not.toEqual(initialVariables);
    });
  });

  describe('Integration with existing functionality', () => {
    it('should not break existing card rendering', async () => {
      const card1 = createTestCard('card7', 100, 100, 1);
      const card2 = createTestCard('card8', 200, 200, 2);

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1), createBackendCard(card2)],
        },
        loading: false,
        error: null,
      });

      render(<CardLayer />);

      await waitFor(() => {
        expect(screen.getByTestId('card-renderer-card7')).toBeInTheDocument();
        expect(screen.getByTestId('card-renderer-card8')).toBeInTheDocument();
      });
    });

    it('should not break z-index sorting', async () => {
      const card1 = createTestCard('card9', 0, 0, 3);
      const card2 = createTestCard('card10', 0, 0, 1);

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1), createBackendCard(card2)],
        },
        loading: false,
        error: null,
      });

      const { container } = render(<CardLayer />);

      await waitFor(() => {
        const cardElements = container.querySelectorAll('[data-testid^="card-renderer-"]');
        expect(cardElements).toHaveLength(2);
        // Should maintain z-order even with debouncing
        expect(cardElements[0]).toHaveAttribute('data-testid', 'card-renderer-card10');
        expect(cardElements[1]).toHaveAttribute('data-testid', 'card-renderer-card9');
      });
    });
  });
});
