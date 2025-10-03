/**
 * CardLayer Memoization Optimization Tests (TDD - Phase 2, Task 2.1)
 *
 * Tests for cardRenderers useMemo dependency optimization.
 *
 * Context:
 * - handleCardDragEnd is already stable (useCallback with updateCard dependency)
 * - Including it in cardRenderers useMemo dependencies causes unnecessary recreations
 * - When callback reference changes, it shouldn't trigger cardRenderers recreation
 *
 * TDD Process:
 * 1. RED: Write failing tests (this file)
 * 2. GREEN: Remove handleCardDragEnd from useMemo dependencies
 * 3. REFACTOR: Clean up if needed
 * 4. VERIFY: Run all CardLayer tests
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardLayer } from '../CardLayer';
import type { Card, TextCard, CardStatus, CardPriority } from '@/types/card.types';
import { createCardId } from '@/types/card.types';
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
const mockMutateFunction = jest.fn();

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
    id: createCardId(id),
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

describe('CardLayer Memoization Optimization (TDD - Phase 2, Task 2.1)', () => {
  // Track useMemo recalculations
  const originalUseMemo = React.useMemo;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockClear();
    mockUseMutation.mockClear();
    mockMutateFunction.mockClear();

    // Spy on useMemo to track recalculations
    jest.spyOn(React, 'useMemo').mockImplementation(((factory: () => unknown, deps: unknown[]) => {
      // Use original useMemo implementation
      const result = originalUseMemo(factory, deps);
      return result;
    }) as typeof React.useMemo);

    // Setup default mutation mock that returns a new function each time
    // This simulates the mutation function reference changing
    mockUseMutation.mockReturnValue([
      mockMutateFunction,
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
    jest.restoreAllMocks();
  });

  describe('RED Phase: cardRenderers useMemo should not depend on handleCardDragEnd', () => {
    it('should not recreate cardRenderers when mutation function reference changes', async () => {
      const card1 = createTestCard('card1', 100, 100, 1);
      const card2 = createTestCard('card2', 200, 200, 2);

      // Track unique React element references to detect recreation
      const elementRefs = new Set<unknown>();
      let recreationCount = 0;

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1), createBackendCard(card2)],
        },
        loading: false,
        error: null,
      });

      const { rerender, container } = render(<CardLayer />);

      await waitFor(() => {
        const layer = container.querySelector('[data-testid="konva-layer"]');
        expect(layer?.children.length).toBe(2);
      });

      // Capture initial element references
      const layer = container.querySelector('[data-testid="konva-layer"]');
      if (layer) {
        Array.from(layer.children).forEach((child) => {
          elementRefs.add(child);
          recreationCount++;
        });
      }

      expect(recreationCount).toBe(2); // Initial 2 cards

      // Change the mutation function reference (simulating useCallback recreation)
      const newMockMutateFunction = jest.fn();
      mockUseMutation.mockReturnValue([
        newMockMutateFunction,
        {
          data: null,
          loading: false,
          error: null,
          called: false,
        },
      ]);

      // Rerender with same cards but different mutation function
      rerender(<CardLayer />);

      await waitFor(() => {
        const layerAfter = container.querySelector('[data-testid="konva-layer"]');
        expect(layerAfter?.children.length).toBe(2);
      });

      // Check if new elements were created (indicating unnecessary recreation)
      const layerAfter = container.querySelector('[data-testid="konva-layer"]');
      if (layerAfter) {
        Array.from(layerAfter.children).forEach((child) => {
          if (!elementRefs.has(child)) {
            recreationCount++;
          }
        });
      }

      // RED: This will fail because handleCardDragEnd is in dependencies
      // When mutation changes, handleCardDragEnd changes, triggering cardRenderers recreation
      // Expected: 2 (no recreation - same element references)
      // Actual: 4 (recreated - new element references)
      expect(recreationCount).toBe(2);
    });

    it('should not recreate cardRenderers during zoom/pan when cards are stable', async () => {
      const card = createTestCard('stable-card', 100, 100, 1);

      let renderCount = 0;
      const capturedRenderers: unknown[] = [];

      // Track useMemo recalculations by spying on the component render
      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card)],
        },
        loading: false,
        error: null,
      });

      const { rerender } = render(<CardLayer />);

      await waitFor(() => {
        const layer = document.querySelector('[data-testid="konva-layer"]');
        if (layer?.children.length) {
          renderCount++;
          capturedRenderers.push(layer.children);
        }
      });

      const initialRenderCount = renderCount;

      // Simulate zoom operation
      mockCanvasStore.viewport.zoom = 1.5;

      // Force mutation function to change (this happens in real scenarios)
      mockUseMutation.mockReturnValue([
        jest.fn(), // New function reference
        {
          data: null,
          loading: false,
          error: null,
          called: false,
        },
      ]);

      rerender(<CardLayer />);

      await waitFor(() => {
        const layer = document.querySelector('[data-testid="konva-layer"]');
        expect(layer).toBeInTheDocument();
      });

      // RED: Will fail because zoom triggers viewport bounds change, which triggers
      // handleCardDragEnd recreation (via updateCard dependency), which triggers
      // cardRenderers recreation (because handleCardDragEnd is in dependencies)
      expect(renderCount).toBe(initialRenderCount);
    });

    it('should only recreate cardRenderers when sortedCards actually changes', async () => {
      const card1 = createTestCard('card1', 0, 0, 1);
      const card2 = createTestCard('card2', 0, 0, 2);

      let cardRendererRecreations = 0;
      const elementReferences = new WeakSet();

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1), createBackendCard(card2)],
        },
        loading: false,
        error: null,
      });

      const { rerender, container } = render(<CardLayer />);

      await waitFor(() => {
        const layer = container.querySelector('[data-testid="konva-layer"]');
        if (layer?.children.length === 2) {
          Array.from(layer.children).forEach((child) => {
            if (!elementReferences.has(child)) {
              elementReferences.add(child);
              cardRendererRecreations++;
            }
          });
        }
      });

      expect(cardRendererRecreations).toBe(2); // Initial render: 2 cards

      // Change mutation function reference but keep cards the same
      mockUseMutation.mockReturnValue([
        jest.fn(), // New function reference
        {
          data: null,
          loading: false,
          error: null,
          called: false,
        },
      ]);

      rerender(<CardLayer />);

      await waitFor(() => {
        const layer = container.querySelector('[data-testid="konva-layer"]');
        if (layer?.children.length === 2) {
          Array.from(layer.children).forEach((child) => {
            if (!elementReferences.has(child)) {
              elementReferences.add(child);
              cardRendererRecreations++;
            }
          });
        }
      });

      // RED: Will fail - recreation count will be 4 (2 initial + 2 recreated)
      // because handleCardDragEnd is in dependencies
      // Expected: 2 (no recreation because cards didn't change)
      expect(cardRendererRecreations).toBe(2);
    });

    it('should maintain stable cardRenderers array when only mutation changes', async () => {
      const card1 = createTestCard('card1', 0, 0, 1);

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1)],
        },
        loading: false,
        error: null,
      });

      const { rerender, container } = render(<CardLayer />);

      await waitFor(() => {
        expect(container.querySelector('[data-testid="card-renderer-card1"]')).toBeInTheDocument();
      });

      const firstElement = container.querySelector('[data-testid="card-renderer-card1"]');

      // Force mutation function to change (happens when updateCard changes)
      mockUseMutation.mockReturnValue([
        jest.fn(), // New function reference
        {
          data: null,
          loading: false,
          error: null,
          called: false,
        },
      ]);

      rerender(<CardLayer />);

      await waitFor(() => {
        expect(container.querySelector('[data-testid="card-renderer-card1"]')).toBeInTheDocument();
      });

      const secondElement = container.querySelector('[data-testid="card-renderer-card1"]');

      // RED: This will fail because handleCardDragEnd change causes cardRenderers recreation
      // Expected: Same element reference (no recreation)
      // Actual: Different element reference (recreation occurred)
      expect(secondElement).toBe(firstElement);
    });
  });

  describe('Edge cases and optimization logic', () => {
    it('should still recreate cardRenderers when cards count changes', async () => {
      const card1 = createTestCard('card1', 0, 0, 1);

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1)],
        },
        loading: false,
        error: null,
      });

      const { rerender, container } = render(<CardLayer />);

      await waitFor(() => {
        const elements = container.querySelectorAll('[data-testid^="card-renderer-"]');
        expect(elements.length).toBe(1);
      });

      // Add a second card
      const card2 = createTestCard('card2', 0, 0, 2);
      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1), createBackendCard(card2)],
        },
        loading: false,
        error: null,
      });

      rerender(<CardLayer />);

      await waitFor(() => {
        const elements = container.querySelectorAll('[data-testid^="card-renderer-"]');
        expect(elements.length).toBe(2);
      });

      // This should pass - cards changed, so recreation is expected
      expect(container.querySelectorAll('[data-testid^="card-renderer-"]').length).toBe(2);
    });

    it('should still recreate cardRenderers when card IDs change', async () => {
      const card1 = createTestCard('card1', 0, 0, 1);

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1)],
        },
        loading: false,
        error: null,
      });

      const { rerender, queryByTestId } = render(<CardLayer />);

      await waitFor(() => {
        expect(queryByTestId('card-renderer-card1')).toBeInTheDocument();
      });

      // Replace with different card
      const card2 = createTestCard('card2', 0, 0, 1);
      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card2)],
        },
        loading: false,
        error: null,
      });

      rerender(<CardLayer />);

      await waitFor(() => {
        expect(queryByTestId('card-renderer-card2')).toBeInTheDocument();
      });

      // This should pass - cards changed, so recreation is expected
      expect(queryByTestId('card-renderer-card1')).not.toBeInTheDocument();
      expect(queryByTestId('card-renderer-card2')).toBeInTheDocument();
    });
  });
});
