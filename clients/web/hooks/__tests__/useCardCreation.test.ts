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
import useCardCreation from '../useCardCreation';
import { createMockCanvasStore } from '../../__tests__/utils';
import type { CanvasPosition } from '@/types/canvas.types';
import { useCanvasStore } from '@/stores/canvasStore';

// Mock canvas store
let mockCanvasStore: ReturnType<typeof createMockCanvasStore>;

jest.mock('@/stores/canvasStore', () => ({
  useCanvasStore: jest.fn(),
}));

// Mock card store
const mockCardStore = {
  addCard: jest.fn(),
  updateCard: jest.fn(),
  removeCard: jest.fn(),
  selectCard: jest.fn(),
  deselectCard: jest.fn(),
  clearSelection: jest.fn(),
  setEditingCard: jest.fn(),
  clearEditingCard: jest.fn(),
  cards: new Map(),
  selectedIds: new Set(),
};

jest.mock('@/stores/cardStore', () => ({
  useCardStore: jest.fn(() => mockCardStore),
}));

// Mock useMutation directly
const mockMutationResult = jest.fn();

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useMutation: jest.fn((query, options) => {
    // Store the update function for later use
    if (options?.update) {
    }
    return [
      mockMutationResult,
      { loading: false, error: null, data: null }
    ];
  }),
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

// Test constants
const mockWorkspaceId = 'test-workspace-id';

const TestWrapper = ({ children }: { children: React.ReactNode }) => children as React.ReactElement;

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

    // Reset card store mock
    mockCardStore.addCard.mockClear();
    mockCardStore.cards = new Map();
    mockCardStore.selectedIds = new Set();

    // Reset and configure successful mutation mock
    mockMutationResult.mockClear();
    mockMutationResult.mockResolvedValue({
      data: {
        createCard: {
          id: 'test-card-id',
          workspaceId: mockWorkspaceId,
          ownerId: 'test-user-id',
          title: 'New text card',
          content: 'Enter your text here',
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
    });

    // Setup mocks
    jest.mocked(useCanvasStore).mockReturnValue(mockCanvasStore);
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
      }, { timeout: 2000 });
    });

    it('should handle creation errors gracefully', async () => {
      // Configure mutation to reject
      mockMutationResult.mockRejectedValue(new Error('Failed to create card'));

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
      }, { timeout: 2000 });
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

  describe('Auto-Enter Edit Mode', () => {
    describe('Auto-enter enabled', () => {
      it('should enter edit mode automatically after successful card creation', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
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
          // Verify that setEditingCard was called with the new card ID
          expect(mockCardStore.setEditingCard).toHaveBeenCalledWith('test-card-id');
        }, { timeout: 2000 });
      });

      it('should enter edit mode after createCardAtPosition', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        let cardId: string | null = null;
        await act(async () => {
          cardId = await result.current.createCardAtPosition('text', position);
        });

        await waitFor(() => {
          expect(cardId).toBe('test-card-id');
          // Verify that setEditingCard was called with the new card ID
          expect(mockCardStore.setEditingCard).toHaveBeenCalledWith('test-card-id');
        }, { timeout: 2000 });
      });

      it('should enter edit mode with custom content', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        let cardId: string | null = null;
        await act(async () => {
          cardId = await result.current.createCardAtPosition('code', position, '// Custom code');
        });

        await waitFor(() => {
          expect(cardId).toBe('test-card-id');
          expect(mockCardStore.setEditingCard).toHaveBeenCalledWith('test-card-id');
        }, { timeout: 2000 });
      });

      it('should close modal/context menu before entering edit mode', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        // Set up state with modal open
        act(() => {
          result.current.openModal(position, 'text');
        });

        expect(result.current.state.isModalOpen).toBe(true);

        await act(async () => {
          await result.current.createCard();
        });

        await waitFor(() => {
          // Modal should be closed before entering edit mode
          expect(result.current.state.isModalOpen).toBe(false);
          expect(result.current.state.isContextMenuOpen).toBe(false);
          expect(mockCardStore.setEditingCard).toHaveBeenCalledWith('test-card-id');
        }, { timeout: 2000 });
      });
    });

    describe('Auto-enter disabled', () => {
      it('should NOT enter edit mode when autoEnterEditMode is false', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: false
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        act(() => {
          result.current.openModal(position, 'text');
        });

        await act(async () => {
          await result.current.createCard();
        });

        await waitFor(() => {
          // setEditingCard should NOT be called
          expect(mockCardStore.setEditingCard).not.toHaveBeenCalled();
        }, { timeout: 2000 });
      });

      it('should NOT enter edit mode by default when config not provided', async () => {
        const { result } = renderHook(
          () => useCardCreation({ workspaceId: mockWorkspaceId }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        act(() => {
          result.current.openModal(position, 'text');
        });

        await act(async () => {
          await result.current.createCard();
        });

        await waitFor(() => {
          expect(mockCardStore.setEditingCard).not.toHaveBeenCalled();
        }, { timeout: 2000 });
      });
    });

    describe('Error scenarios', () => {
      it('should NOT enter edit mode if card creation fails', async () => {
        // Configure mutation to reject
        mockMutationResult.mockRejectedValue(new Error('Failed to create card'));

        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        act(() => {
          result.current.openModal(position, 'text');
        });

        await act(async () => {
          await result.current.createCard();
        });

        await waitFor(() => {
          // setEditingCard should NOT be called on failure
          expect(mockCardStore.setEditingCard).not.toHaveBeenCalled();
          expect(result.current.state.error).toContain('Failed to create card');
        });
      });

      it('should NOT enter edit mode if no card ID is returned', async () => {
        // Configure mutation to return no card
        mockMutationResult.mockResolvedValue({
          data: {
            createCard: null
          }
        });

        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        act(() => {
          result.current.openModal(position, 'text');
        });

        await act(async () => {
          await result.current.createCard();
        });

        await waitFor(() => {
          expect(mockCardStore.setEditingCard).not.toHaveBeenCalled();
          expect(result.current.state.error).toContain('No card returned from mutation');
        });
      });

      it('should handle missing card ID gracefully', async () => {
        // Configure mutation to return card without ID
        mockMutationResult.mockResolvedValue({
          data: {
            createCard: {
              // Missing id field
              workspaceId: mockWorkspaceId,
              title: 'Test',
              content: 'Test content'
            }
          }
        });

        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        act(() => {
          result.current.openModal(position, 'text');
        });

        const cardId = await act(async () => {
          return await result.current.createCard();
        });

        // Should still succeed but not enter edit mode
        expect(cardId).toBe(undefined);
        expect(mockCardStore.setEditingCard).not.toHaveBeenCalled();
      });
    });

    describe('Animation timing and transitions', () => {
      it('should wait for modal close animation before entering edit mode', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        act(() => {
          result.current.openModal(position, 'text');
        });

        const startTime = Date.now();
        await act(async () => {
          await result.current.createCard();
        });

        await waitFor(() => {
          expect(mockCardStore.setEditingCard).toHaveBeenCalledWith('test-card-id');
          // Should have waited a brief moment for animation (at least 50ms)
          const elapsed = Date.now() - startTime;
          expect(elapsed).toBeGreaterThanOrEqual(50);
        }, { timeout: 2000 });
      });

      it('should enter edit mode smoothly without flickering', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        act(() => {
          result.current.openModal(position, 'text');
        });

        await act(async () => {
          await result.current.createCard();
        });

        await waitFor(() => {
          // Modal should be closed
          expect(result.current.state.isModalOpen).toBe(false);
          // Edit mode should be entered
          expect(mockCardStore.setEditingCard).toHaveBeenCalledWith('test-card-id');
          // Exactly one call to setEditingCard (no flickering)
          expect(mockCardStore.setEditingCard).toHaveBeenCalledTimes(1);
        }, { timeout: 2000 });
      });
    });

    describe('Integration with different card types', () => {
      it('should enter edit mode for text cards', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        await act(async () => {
          await result.current.createCardAtPosition('text', position);
        });

        await waitFor(() => {
          expect(mockCardStore.setEditingCard).toHaveBeenCalledWith('test-card-id');
        }, { timeout: 2000 });
      });

      it('should enter edit mode for code cards', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        await act(async () => {
          await result.current.createCardAtPosition('code', position);
        });

        await waitFor(() => {
          expect(mockCardStore.setEditingCard).toHaveBeenCalledWith('test-card-id');
        }, { timeout: 2000 });
      });

      it('should enter edit mode for link cards', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        await act(async () => {
          await result.current.createCardAtPosition('link', position);
        });

        await waitFor(() => {
          expect(mockCardStore.setEditingCard).toHaveBeenCalledWith('test-card-id');
        }, { timeout: 2000 });
      });

      it('should enter edit mode for image cards', async () => {
        const { result } = renderHook(
          () => useCardCreation({
            workspaceId: mockWorkspaceId,
            autoEnterEditMode: true
          }),
          { wrapper: TestWrapper }
        );
        const position: CanvasPosition = { x: 100, y: 200, z: 123 };

        await act(async () => {
          await result.current.createCardAtPosition('image', position);
        });

        await waitFor(() => {
          expect(mockCardStore.setEditingCard).toHaveBeenCalledWith('test-card-id');
        }, { timeout: 2000 });
      });
    });
  });
});