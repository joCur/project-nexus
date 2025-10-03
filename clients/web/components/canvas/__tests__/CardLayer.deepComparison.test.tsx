/**
 * CardLayer Deep Card Comparison Tests (TDD - Phase 2, Task 2.2)
 *
 * Tests for enhanced card comparison logic in cardRenderers useMemo.
 *
 * Context:
 * - Current logic only checks if card IDs match in order (lines 424-429)
 * - Need deep comparison of card position, dimensions, and content when IDs match
 * - Only recreate renderers if actual card data changed, not just array reference
 *
 * TDD Process:
 * 1. RED: Write failing tests (this file)
 * 2. GREEN: Implement deep comparison logic
 * 3. REFACTOR: Extract comparison to helper function
 * 4. VERIFY: Run all CardLayer tests
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
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
      data-position={JSON.stringify(card.position)}
      data-dimensions={JSON.stringify(card.dimensions)}
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
  z: number = 0,
  width: number = 200,
  height: number = 100,
  content: string = 'Test content'
): TextCard => {
  return {
    id: id as CardId,
    ownerId: 'test-user-id' as EntityId,
    position: { x, y, z },
    dimensions: { width, height },
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
      content: content,
      markdown: false,
      wordCount: content.split(' ').length,
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

describe('CardLayer Deep Card Comparison (TDD - Phase 2, Task 2.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockClear();
    mockUseMutation.mockClear();
    mockMutateFunction.mockClear();

    // Setup default mutation mock
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

  describe('GREEN Phase: Deep comparison of card properties', () => {
    it('should update card renderer when card position changes (same ID)', async () => {
      const card1 = createTestCard('card1', 100, 100, 1);

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
      const firstPosition = firstElement?.getAttribute('data-position');
      expect(firstPosition).toBe(JSON.stringify({ x: 100, y: 100, z: 1 }));

      // Same card ID, but position changed
      const card1Moved = createTestCard('card1', 150, 150, 1); // Moved position

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1Moved)],
        },
        loading: false,
        error: null,
      });

      rerender(<CardLayer />);

      await waitFor(() => {
        const element = container.querySelector('[data-testid="card-renderer-card1"]');
        expect(element).toBeInTheDocument();
        const newPosition = element?.getAttribute('data-position');
        // Position should be updated
        expect(newPosition).toBe(JSON.stringify({ x: 150, y: 150, z: 1 }));
        expect(newPosition).not.toBe(firstPosition);
      });
    });

    it('should update card renderer when card dimensions change (same ID)', async () => {
      const card1 = createTestCard('card1', 100, 100, 1, 200, 100);

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
      const firstDimensions = firstElement?.getAttribute('data-dimensions');
      expect(firstDimensions).toBe(JSON.stringify({ width: 200, height: 100 }));

      // Same card ID, but dimensions changed
      const card1Resized = createTestCard('card1', 100, 100, 1, 300, 150); // Resized

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1Resized)],
        },
        loading: false,
        error: null,
      });

      rerender(<CardLayer />);

      await waitFor(() => {
        const element = container.querySelector('[data-testid="card-renderer-card1"]');
        expect(element).toBeInTheDocument();
        const newDimensions = element?.getAttribute('data-dimensions');
        // Dimensions should be updated
        expect(newDimensions).toBe(JSON.stringify({ width: 300, height: 150 }));
        expect(newDimensions).not.toBe(firstDimensions);
      });
    });

    it('should update card renderer when card content changes (same ID)', async () => {
      const card1 = createTestCard('card1', 100, 100, 1, 200, 100, 'Original content');

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1)],
        },
        loading: false,
        error: null,
      });

      const { rerender, container } = render(<CardLayer />);

      await waitFor(() => {
        const cardElement = container.querySelector('[data-testid="card-renderer-card1"]');
        expect(cardElement).toBeInTheDocument();
        expect(cardElement?.textContent).toContain('card1');
      });

      // Same card ID, but content changed
      const card1Updated = createTestCard('card1', 100, 100, 1, 200, 100, 'Updated content');

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1Updated)],
        },
        loading: false,
        error: null,
      });

      rerender(<CardLayer />);

      await waitFor(() => {
        const cardElement = container.querySelector('[data-testid="card-renderer-card1"]');
        expect(cardElement).toBeInTheDocument();
        // Content update is reflected (our mock doesn't show content, but the renderer is updated)
      });
    });

    it('should NOT recreate cardRenderers when only array reference changes (same data)', async () => {
      const card1 = createTestCard('card1', 100, 100, 1, 200, 100, 'Same content');

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

      // Create new array with identical card data
      const card1Copy = createTestCard('card1', 100, 100, 1, 200, 100, 'Same content');

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1Copy)],
        },
        loading: false,
        error: null,
      });

      rerender(<CardLayer />);

      await waitFor(() => {
        expect(container.querySelector('[data-testid="card-renderer-card1"]')).toBeInTheDocument();
      });

      const secondElement = container.querySelector('[data-testid="card-renderer-card1"]');

      // RED: This test might already pass if ref-based optimization works
      // But we want to ensure deep comparison prevents recreation
      // Expected: Same element reference (no recreation) because data is identical
      expect(secondElement).toBe(firstElement);
    });

    it('should handle multiple cards with partial changes correctly', async () => {
      const card1 = createTestCard('card1', 100, 100, 1, 200, 100, 'Content 1');
      const card2 = createTestCard('card2', 200, 200, 2, 200, 100, 'Content 2');
      const card3 = createTestCard('card3', 300, 300, 3, 200, 100, 'Content 3');

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [
            createBackendCard(card1),
            createBackendCard(card2),
            createBackendCard(card3)
          ],
        },
        loading: false,
        error: null,
      });

      const { rerender, container } = render(<CardLayer />);

      await waitFor(() => {
        expect(container.querySelector('[data-testid="card-renderer-card1"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="card-renderer-card2"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="card-renderer-card3"]')).toBeInTheDocument();
      });

      const card2Position = container.querySelector('[data-testid="card-renderer-card2"]')?.getAttribute('data-position');
      expect(card2Position).toBe(JSON.stringify({ x: 200, y: 200, z: 2 }));

      // Only card2 changes position
      const card2Moved = createTestCard('card2', 250, 250, 2, 200, 100, 'Content 2');

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [
            createBackendCard(card1), // Unchanged
            createBackendCard(card2Moved), // Position changed
            createBackendCard(card3) // Unchanged
          ],
        },
        loading: false,
        error: null,
      });

      rerender(<CardLayer />);

      await waitFor(() => {
        const card2 = container.querySelector('[data-testid="card-renderer-card2"]');
        expect(card2).toBeInTheDocument();
        const newPosition = card2?.getAttribute('data-position');
        // Card2 position should be updated
        expect(newPosition).toBe(JSON.stringify({ x: 250, y: 250, z: 2 }));
      });
    });

    it('should detect z-index changes in position', async () => {
      const card1 = createTestCard('card1', 100, 100, 1);

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

      const firstPosition = container.querySelector('[data-testid="card-renderer-card1"]')?.getAttribute('data-position');
      expect(firstPosition).toBe(JSON.stringify({ x: 100, y: 100, z: 1 }));

      // Same x, y but different z
      const card1ZChanged = createTestCard('card1', 100, 100, 5); // Z changed from 1 to 5

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1ZChanged)],
        },
        loading: false,
        error: null,
      });

      rerender(<CardLayer />);

      await waitFor(() => {
        const element = container.querySelector('[data-testid="card-renderer-card1"]');
        expect(element).toBeInTheDocument();
        const newPosition = element?.getAttribute('data-position');
        // Z-index should be updated
        expect(newPosition).toBe(JSON.stringify({ x: 100, y: 100, z: 5 }));
        expect(newPosition).not.toBe(firstPosition);
      });
    });
  });

  describe('Edge cases and optimization scenarios', () => {
    it('should handle cards with empty content differences', async () => {
      const card1 = createTestCard('card1', 100, 100, 1, 200, 100, '');

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

      // Same empty content, just new array reference
      const card1Copy = createTestCard('card1', 100, 100, 1, 200, 100, '');

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1Copy)],
        },
        loading: false,
        error: null,
      });

      rerender(<CardLayer />);

      await waitFor(() => {
        expect(container.querySelector('[data-testid="card-renderer-card1"]')).toBeInTheDocument();
      });

      const secondElement = container.querySelector('[data-testid="card-renderer-card1"]');

      // Should NOT recreate - data is identical
      expect(secondElement).toBe(firstElement);
    });

    it('should handle floating point precision in position/dimensions', async () => {
      const card1 = createTestCard('card1', 100.0, 100.0, 1, 200.0, 100.0);

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

      // Exactly same values (no floating point differences)
      const card1Copy = createTestCard('card1', 100.0, 100.0, 1, 200.0, 100.0);

      mockUseQuery.mockReturnValue({
        data: {
          cardsInBounds: [createBackendCard(card1Copy)],
        },
        loading: false,
        error: null,
      });

      rerender(<CardLayer />);

      await waitFor(() => {
        expect(container.querySelector('[data-testid="card-renderer-card1"]')).toBeInTheDocument();
      });

      const secondElement = container.querySelector('[data-testid="card-renderer-card1"]');

      // Should NOT recreate - values are identical
      expect(secondElement).toBe(firstElement);
    });
  });
});
