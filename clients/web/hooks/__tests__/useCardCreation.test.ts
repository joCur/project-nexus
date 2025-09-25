/**
 * Tests for useCardCreation hook with GraphQL integration
 *
 * This test suite covers:
 * - Modal state management (open/close)
 * - Context menu state management
 * - Card creation with GraphQL mutations
 * - Screen to canvas coordinate conversion
 * - Apollo cache integration
 * - Error handling and loading states
 * - Default position calculation
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import useCardCreation from '../useCardCreation';
import { CREATE_CARD, GET_CARDS } from '@/lib/graphql/cardOperations';
import { createMockCanvasStore } from '../../__tests__/utils';
import type { CardType } from '@/types/card.types';
import type { CanvasPosition } from '@/types/canvas.types';

// Mock canvas store
let mockCanvasStore: ReturnType<typeof createMockCanvasStore>;

jest.mock('@/stores/canvasStore', () => ({
  useCanvasStore: jest.fn(),
}));

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

// Apollo mocks for successful card creation
const mockWorkspaceId = 'test-workspace-id';
// Use a simple successful mock with flexible z value
const successfulMock = {
  request: {
    query: CREATE_CARD,
  },
  newData: () => ({
    data: {
      createCard: {
        id: 'test-card-id',
        workspaceId: mockWorkspaceId,
        ownerId: 'test-user-id',
        title: 'New text card',
        content: '',
        type: 'TEXT',
        position: { x: 100, y: 200, z: 123 },
        dimensions: { width: 250, height: 150 },
        style: {
          backgroundColor: '#ffffff',
          borderColor: '#e5e7eb',
          textColor: '#1f2937',
          borderWidth: 1,
          borderRadius: 8,
          opacity: 1,
          shadow: true,
        },
        tags: [],
        metadata: {},
        status: 'DRAFT',
        priority: 'NORMAL',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        version: 1,
      },
    },
  }),
};

const createSuccessfulMock = () => successfulMock;

const successfulMocks = [createSuccessfulMock()];

// Apollo mocks for error cases
const createErrorMock = () => ({
  request: {
    query: CREATE_CARD,
    variableMatcher: (variables: any) => {
      const input = variables.input;
      return (
        input.workspaceId === mockWorkspaceId &&
        input.type === 'TEXT' &&
        input.title === 'New text card' &&
        input.content === '' &&
        input.position.x === 100 &&
        input.position.y === 200 &&
        typeof input.position.z === 'number' &&
        input.dimensions.width === 250 &&
        input.dimensions.height === 150 &&
        input.style === undefined &&
        Array.isArray(input.tags) &&
        input.tags.length === 0 &&
        input.priority === 'NORMAL'
      );
    },
  },
  error: new Error('Failed to create card'),
});

const errorMocks = [createErrorMock()];

const TestWrapper = ({ children, mocks = successfulMocks }: { children: React.ReactNode; mocks?: any[] }) =>
  React.createElement(MockedProvider, { mocks, addTypename: false }, children);

describe('useCardCreation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock instances
    mockCanvasStore = createMockCanvasStore();

    // Reset canvas store viewport
    mockCanvasStore.viewport = {
      position: { x: 0, y: 0 },
      zoom: 1,
      bounds: { x: 0, y: 0, width: 1024, height: 768 },
    };

    // Setup mocks
    const { useCanvasStore } = require('@/stores/canvasStore');
    (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);
  });

  describe('Initial State', () => {
    it('should return initial state correctly', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );

      expect(result.current.state).toEqual({
        isModalOpen: false,
        isContextMenuOpen: false,
        selectedType: null,
        creationPosition: null,
        contextMenuPosition: null,
        isCreating: false,
        error: null,
      });
    });

    it('should accept configuration options', () => {
      const { result } = renderHook(
        () =>
          useCardCreation({
            workspaceId: mockWorkspaceId,
            defaultType: 'image',
            defaultOffset: { x: 10, y: 20 },
            autoEnterEditMode: true,
          }),
        { wrapper: TestWrapper }
      );

      // Initial state should still be default
      expect(result.current.state.selectedType).toBeNull();
    });
  });

  describe('Modal State Management', () => {
    it('should open modal with default position and type', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId, defaultType: 'text' }),
        { wrapper: TestWrapper }
      );

      act(() => {
        result.current.openModal();
      });

      expect(result.current.state.isModalOpen).toBe(true);
      expect(result.current.state.selectedType).toBe('text');
      expect(result.current.state.creationPosition).toBeTruthy();
    });

    it('should open modal with specified position and type', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      act(() => {
        result.current.openModal(position, 'image');
      });

      expect(result.current.state.isModalOpen).toBe(true);
      expect(result.current.state.selectedType).toBe('image');
      expect(result.current.state.creationPosition).toEqual(position);
    });

    it('should close modal and reset state', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );

      // Open modal first
      act(() => {
        result.current.openModal({ x: 100, y: 200 }, 'text');
      });

      // Close modal
      act(() => {
        result.current.closeModal();
      });

      expect(result.current.state.isModalOpen).toBe(false);
      expect(result.current.state.selectedType).toBeNull();
      expect(result.current.state.creationPosition).toBeNull();
    });
  });

  describe('Context Menu State Management', () => {
    it('should open context menu at screen position', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );
      const screenPosition = { x: 150, y: 250 };

      act(() => {
        result.current.openContextMenu(screenPosition);
      });

      expect(result.current.state.isContextMenuOpen).toBe(true);
      expect(result.current.state.contextMenuPosition).toEqual(screenPosition);
      expect(result.current.state.creationPosition).toBeTruthy();
    });

    it('should close context menu and reset state', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );

      // Open context menu first
      act(() => {
        result.current.openContextMenu({ x: 150, y: 250 });
      });

      // Close context menu
      act(() => {
        result.current.closeContextMenu();
      });

      expect(result.current.state.isContextMenuOpen).toBe(false);
      expect(result.current.state.contextMenuPosition).toBeNull();
      expect(result.current.state.creationPosition).toBeNull();
    });
  });

  describe('Type Selection', () => {
    it('should set selected type', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );

      act(() => {
        result.current.setSelectedType('code');
      });

      expect(result.current.state.selectedType).toBe('code');
    });

    it('should clear error when setting type', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );

      // Set an error first
      act(() => {
        result.current.createCard(); // This should fail and set error
      });

      expect(result.current.state.error).toBeTruthy();

      // Setting type should clear error
      act(() => {
        result.current.setSelectedType('text');
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('Position Calculations', () => {
    it('should calculate default position at center of viewport', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );

      const position = result.current.getDefaultPosition();

      // Should be center of viewport (512, 384) with zoom 1 and position 0,0
      expect(position.x).toBe(512);
      expect(position.y).toBe(384);
      expect(position.z).toBeDefined();
    });

    it('should convert screen to canvas coordinates', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );

      const canvasPos = result.current.screenToCanvasPosition({ x: 100, y: 200 });

      expect(canvasPos.x).toBe(100);
      expect(canvasPos.y).toBe(200);
      expect(canvasPos.z).toBeDefined();
    });
  });

  describe('Card Creation with GraphQL', () => {
    it('should create card successfully via GraphQL', async () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      // Set up state for card creation
      act(() => {
        result.current.openModal(position, 'text');
      });

      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCard();
      });

      await waitFor(() => {
        expect(cardId).toBe('test-card-id');
        expect(result.current.state.isModalOpen).toBe(false);
        expect(result.current.state.isContextMenuOpen).toBe(false);
        expect(result.current.state.selectedType).toBeNull();
      });
    });

    it('should handle creation errors gracefully', async () => {
      const ErrorWrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(MockedProvider, { mocks: errorMocks, addTypename: false }, children);

      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: ErrorWrapper }
      );
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      // Set up state for card creation
      act(() => {
        result.current.openModal(position, 'text');
      });

      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCard();
      });

      await waitFor(() => {
        expect(cardId).toBeNull();
        expect(result.current.state.error).toContain('Failed to create card');
      });
    });

    it('should handle missing type or position', async () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );

      // Try to create without setting up state
      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCard();
      });

      expect(cardId).toBeNull();
      expect(result.current.state.error).toBe('Missing card type or position');
    });
  });

  describe('createCardAtPosition', () => {
    it('should create card at specific position without modal state', async () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCardAtPosition('text', position);
      });

      await waitFor(() => {
        expect(cardId).toBe('test-card-id');
      });
    });
  });

  describe('Error Handling', () => {
    it('should clear error state', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId }),
        { wrapper: TestWrapper }
      );

      // Simulate error state
      act(() => {
        result.current.createCard(); // This will fail due to missing state
      });

      expect(result.current.state.error).toBeTruthy();

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('Configuration Options', () => {
    it('should use configured default type', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId, defaultType: 'code' }),
        { wrapper: TestWrapper }
      );

      act(() => {
        result.current.openModal();
      });

      expect(result.current.state.selectedType).toBe('code');
    });

    it('should use configured default offset', () => {
      const { result } = renderHook(
        () => useCardCreation({ workspaceId: mockWorkspaceId, defaultOffset: { x: 10, y: 20 } }),
        { wrapper: TestWrapper }
      );

      const position = result.current.getDefaultPosition();

      // Should be center + offset
      expect(position.x).toBe(522); // 512 + 10
      expect(position.y).toBe(404); // 384 + 20
    });
  });
});