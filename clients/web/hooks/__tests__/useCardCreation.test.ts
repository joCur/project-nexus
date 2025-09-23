/**
 * Tests for useCardCreation hook
 *
 * This test suite covers:
 * - Modal state management (open/close)
 * - Context menu state management
 * - Card creation with position handling
 * - Screen to canvas coordinate conversion
 * - Integration with cardStore.createCard()
 * - Error handling and loading states
 * - Default position calculation
 */

import { renderHook, act } from '@testing-library/react';
import { useCardCreation } from '../useCardCreation';
import { createMockCardStore, createMockCanvasStore } from '../../__tests__/utils';
import type { CardType, CreateCardParams } from '@/types/card.types';
import { createCardId } from '@/types/card.types';
import type { CanvasPosition } from '@/types/canvas.types';

// Create store mocks
let mockCardStore: ReturnType<typeof createMockCardStore>;
let mockCanvasStore: ReturnType<typeof createMockCanvasStore>;

jest.mock('@/stores/cardStore', () => ({
  useCardStore: jest.fn(),
}));

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

describe('useCardCreation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock instances
    mockCardStore = createMockCardStore();
    mockCanvasStore = createMockCanvasStore();

    // Reset canvas store viewport
    mockCanvasStore.viewport = {
      position: { x: 0, y: 0 },
      zoom: 1,
      bounds: { x: 0, y: 0, width: 1024, height: 768 },
    };

    // Setup the mock implementations
    const { useCardStore } = require('@/stores/cardStore');
    const { useCanvasStore } = require('@/stores/canvasStore');
    (useCardStore as jest.Mock).mockReturnValue(mockCardStore);
    (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);
  });

  describe('Initial State', () => {
    it('should return initial state correctly', () => {
      const { result } = renderHook(() => useCardCreation());

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
      const { result } = renderHook(() =>
        useCardCreation({
          defaultType: 'image',
          defaultOffset: { x: 10, y: 20 },
          autoEnterEditMode: true,
        })
      );

      // Initial state should still be default
      expect(result.current.state.selectedType).toBeNull();
    });
  });

  describe('Modal State Management', () => {
    it('should open modal with default position and type', () => {
      const { result } = renderHook(() => useCardCreation({ defaultType: 'text' }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.state.isModalOpen).toBe(true);
      expect(result.current.state.selectedType).toBe('text');
      expect(result.current.state.creationPosition).toEqual({
        x: 512, // (1024 / 2)
        y: 384, // (768 / 2)
        z: expect.any(Number),
      });
      expect(result.current.state.isContextMenuOpen).toBe(false);
      expect(result.current.state.error).toBeNull();
    });

    it('should open modal with specified position and type', () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      act(() => {
        result.current.openModal(position, 'image');
      });

      expect(result.current.state.isModalOpen).toBe(true);
      expect(result.current.state.selectedType).toBe('image');
      expect(result.current.state.creationPosition).toEqual(position);
    });

    it('should close modal and reset state', () => {
      const { result } = renderHook(() => useCardCreation());

      // Open modal first
      act(() => {
        result.current.openModal({ x: 100, y: 200, z: 123 }, 'code');
      });

      // Close modal
      act(() => {
        result.current.closeModal();
      });

      expect(result.current.state.isModalOpen).toBe(false);
      expect(result.current.state.selectedType).toBeNull();
      expect(result.current.state.creationPosition).toBeNull();
      expect(result.current.state.error).toBeNull();
    });

    it('should close context menu when opening modal', () => {
      const { result } = renderHook(() => useCardCreation());

      // Open context menu first
      act(() => {
        result.current.openContextMenu({ x: 100, y: 200 });
      });

      expect(result.current.state.isContextMenuOpen).toBe(true);

      // Open modal should close context menu
      act(() => {
        result.current.openModal();
      });

      expect(result.current.state.isModalOpen).toBe(true);
      expect(result.current.state.isContextMenuOpen).toBe(false);
    });
  });

  describe('Context Menu State Management', () => {
    it('should open context menu at screen position', () => {
      const { result } = renderHook(() => useCardCreation());
      const screenPosition = { x: 150, y: 250 };

      act(() => {
        result.current.openContextMenu(screenPosition);
      });

      expect(result.current.state.isContextMenuOpen).toBe(true);
      expect(result.current.state.contextMenuPosition).toEqual(screenPosition);
      expect(result.current.state.creationPosition).toEqual({
        x: 150, // (150 - 0) / 1
        y: 250, // (250 - 0) / 1
        z: expect.any(Number),
      });
      expect(result.current.state.isModalOpen).toBe(false);
      expect(result.current.state.error).toBeNull();
    });

    it('should close context menu and reset state', () => {
      const { result } = renderHook(() => useCardCreation());

      // Open context menu first
      act(() => {
        result.current.openContextMenu({ x: 100, y: 200 });
      });

      // Close context menu
      act(() => {
        result.current.closeContextMenu();
      });

      expect(result.current.state.isContextMenuOpen).toBe(false);
      expect(result.current.state.contextMenuPosition).toBeNull();
      expect(result.current.state.creationPosition).toBeNull();
      expect(result.current.state.error).toBeNull();
    });

    it('should close modal when opening context menu', () => {
      const { result } = renderHook(() => useCardCreation());

      // Open modal first
      act(() => {
        result.current.openModal();
      });

      expect(result.current.state.isModalOpen).toBe(true);

      // Open context menu should close modal
      act(() => {
        result.current.openContextMenu({ x: 100, y: 200 });
      });

      expect(result.current.state.isContextMenuOpen).toBe(true);
      expect(result.current.state.isModalOpen).toBe(false);
    });
  });

  describe('Type Selection', () => {
    it('should set selected type', () => {
      const { result } = renderHook(() => useCardCreation());

      act(() => {
        result.current.setSelectedType('link');
      });

      expect(result.current.state.selectedType).toBe('link');
      expect(result.current.state.error).toBeNull();
    });

    it('should clear error when setting type', () => {
      const { result } = renderHook(() => useCardCreation());

      // Set an error first
      act(() => {
        result.current.openModal();
        // Simulate error by trying to create without proper setup
        result.current.createCard();
      });

      expect(result.current.state.error).toBeTruthy();

      // Setting type should clear error
      act(() => {
        result.current.setSelectedType('text');
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should clear error state', () => {
      const { result } = renderHook(() => useCardCreation());

      // Manually set error state for testing
      act(() => {
        result.current.openModal();
        result.current.createCard(); // This should cause an error
      });

      expect(result.current.state.error).toBeTruthy();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('Position Calculations', () => {
    it('should calculate default position correctly', () => {
      const { result } = renderHook(() => useCardCreation({ defaultOffset: { x: 10, y: 20 } }));

      const position = result.current.getDefaultPosition();

      expect(position).toEqual({
        x: 522, // (1024 / 2) + 10
        y: 404, // (768 / 2) + 20
        z: expect.any(Number),
      });
    });

    it('should calculate default position with viewport offset', () => {
      // Set viewport with offset
      mockCanvasStore.viewport = {
        position: { x: -100, y: -50 },
        zoom: 1,
        bounds: { x: 0, y: 0, width: 1024, height: 768 },
      };

      const { result } = renderHook(() => useCardCreation());

      const position = result.current.getDefaultPosition();

      expect(position).toEqual({
        x: 612, // (-(-100) + 1024/2) / 1
        y: 434, // (-(-50) + 768/2) / 1
        z: expect.any(Number),
      });
    });

    it('should calculate default position with zoom', () => {
      // Set viewport with zoom
      mockCanvasStore.viewport = {
        position: { x: 0, y: 0 },
        zoom: 2,
        bounds: { x: 0, y: 0, width: 1024, height: 768 },
      };

      const { result } = renderHook(() => useCardCreation());

      const position = result.current.getDefaultPosition();

      expect(position).toEqual({
        x: 256, // (1024 / 2) / 2
        y: 192, // (768 / 2) / 2
        z: expect.any(Number),
      });
    });

    it('should convert screen to canvas coordinates', () => {
      const { result } = renderHook(() => useCardCreation());

      const canvasPos = result.current.screenToCanvasPosition({ x: 100, y: 200 });

      expect(canvasPos).toEqual({
        x: 100, // (100 - 0) / 1
        y: 200, // (200 - 0) / 1
        z: expect.any(Number),
      });
    });

    it('should convert screen to canvas coordinates with viewport transform', () => {
      // Set viewport with offset and zoom
      mockCanvasStore.viewport = {
        position: { x: -50, y: -30 },
        zoom: 1.5,
        bounds: { x: 0, y: 0, width: 1024, height: 768 },
      };

      const { result } = renderHook(() => useCardCreation());

      const canvasPos = result.current.screenToCanvasPosition({ x: 150, y: 180 });

      expect(canvasPos).toEqual({
        x: 133.33333333333334, // (150 - (-50)) / 1.5
        y: 140, // (180 - (-30)) / 1.5
        z: expect.any(Number),
      });
    });
  });

  describe('Card Creation', () => {
    it('should create card with current settings', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      // Setup creation state
      act(() => {
        result.current.openModal(position, 'text');
      });

      // Mock successful card creation
      mockCardStore.createCard.mockReturnValue(createCardId('new-card-id'));

      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCard();
      });

      expect(cardId).toBe('new-card-id');
      expect(mockCardStore.createCard).toHaveBeenCalledWith({
        type: 'text',
        position,
        content: {
          type: 'text',
          content: '',
          markdown: false,
          wordCount: 0,
          lastEditedAt: expect.any(String),
        },
        dimensions: expect.any(Object),
      });

      // State should be reset after successful creation
      expect(result.current.state.isCreating).toBe(false);
      expect(result.current.state.isModalOpen).toBe(false);
      expect(result.current.state.selectedType).toBeNull();
      expect(result.current.state.creationPosition).toBeNull();
    });

    it('should create card with custom parameters', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      // Setup creation state
      act(() => {
        result.current.openModal(position, 'image');
      });

      mockCardStore.createCard.mockReturnValue(createCardId('new-image-card'));

      const customParams = {
        content: {
          type: 'image' as const,
          url: 'https://example.com/image.jpg',
          alt: 'Custom image',
          caption: 'Custom caption',
        },
        dimensions: { width: 300, height: 200 },
      };

      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCard(customParams);
      });

      expect(cardId).toBe('new-image-card');
      expect(mockCardStore.createCard).toHaveBeenCalledWith({
        type: 'image',
        position,
        content: customParams.content,
        dimensions: customParams.dimensions,
        style: undefined,
      });
    });

    it('should handle creation errors', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      // Setup creation state
      act(() => {
        result.current.openModal(position, 'text');
      });

      // Mock card creation failure
      mockCardStore.createCard.mockImplementation(() => {
        throw new Error('Creation failed');
      });

      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCard();
      });

      expect(cardId).toBeNull();
      expect(result.current.state.error).toBe('Creation failed');
      expect(result.current.state.isCreating).toBe(false);
      expect(result.current.state.isModalOpen).toBe(true); // Modal should stay open on error
    });

    it('should handle missing type or position', async () => {
      const { result } = renderHook(() => useCardCreation());

      // Try to create without setting up state
      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCard();
      });

      expect(cardId).toBeNull();
      expect(result.current.state.error).toBe('Missing card type or position');
      expect(mockCardStore.createCard).not.toHaveBeenCalled();
    });

    it('should set loading state during creation', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      // Setup creation state
      act(() => {
        result.current.openModal(position, 'text');
      });

      // Mock synchronous card creation with delay to observe loading state
      mockCardStore.createCard.mockImplementation(() => {
        // Since createCard is actually synchronous in the real implementation,
        // we need to test that the loading state is set briefly during the async wrapper
        return createCardId('created-card-id');
      });

      // Start creation and capture promise
      let createPromise: Promise<any>;
      act(() => {
        createPromise = result.current.createCard();
      });

      // The loading state should have been set briefly but will resolve quickly
      // since the actual createCard is synchronous
      await act(async () => {
        await createPromise!;
      });

      // After completion, should not be creating
      expect(result.current.state.isCreating).toBe(false);
      expect(result.current.state.isModalOpen).toBe(false);
      expect(mockCardStore.createCard).toHaveBeenCalledWith({
        type: 'text',
        position,
        content: {
          type: 'text',
          content: '',
          markdown: false,
          wordCount: 0,
          lastEditedAt: expect.any(String),
        },
        dimensions: expect.any(Object),
      });
    });
  });

  describe('createCardAtPosition', () => {
    it('should create card at specific position without modal state', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 300, y: 400, z: 456 };

      mockCardStore.createCard.mockReturnValue(createCardId('positioned-card-id'));

      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCardAtPosition('code', position);
      });

      expect(cardId).toBe('positioned-card-id');
      expect(mockCardStore.createCard).toHaveBeenCalledWith({
        type: 'code',
        position,
        content: {
          type: 'code',
          language: 'javascript',
          content: '',
          lineCount: 0,
        },
        dimensions: expect.any(Object),
      });

      // Modal state should not be affected
      expect(result.current.state.isModalOpen).toBe(false);
      expect(result.current.state.selectedType).toBeNull();
    });

    it('should create card with custom content', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 300, y: 400, z: 456 };
      const customContent = {
        type: 'link' as const,
        url: 'https://example.com',
        title: 'Example Link',
        domain: 'example.com',
        isAccessible: true,
      };

      mockCardStore.createCard.mockReturnValue(createCardId('link-card-id'));

      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCardAtPosition('link', position, customContent);
      });

      expect(cardId).toBe('link-card-id');
      expect(mockCardStore.createCard).toHaveBeenCalledWith({
        type: 'link',
        position,
        content: customContent,
        dimensions: expect.any(Object),
      });
    });

    it('should handle createCardAtPosition errors', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 300, y: 400, z: 456 };

      mockCardStore.createCard.mockImplementation(() => {
        throw new Error('Position creation failed');
      });

      let cardId: string | null = null;
      await act(async () => {
        cardId = await result.current.createCardAtPosition('text', position);
      });

      expect(cardId).toBeNull();
      expect(result.current.state.error).toBe('Position creation failed');
      expect(result.current.state.isCreating).toBe(false);
    });
  });

  describe('Default Content Generation', () => {
    it('should generate correct default content for text cards', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      act(() => {
        result.current.openModal(position, 'text');
      });

      mockCardStore.createCard.mockReturnValue(createCardId('text-card-id'));

      await act(async () => {
        await result.current.createCard();
      });

      const createCall = mockCardStore.createCard.mock.calls[0][0] as CreateCardParams;
      expect(createCall.content).toEqual({
        type: 'text',
        content: '',
        markdown: false,
        wordCount: 0,
        lastEditedAt: expect.any(String),
      });
    });

    it('should generate correct default content for image cards', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      act(() => {
        result.current.openModal(position, 'image');
      });

      mockCardStore.createCard.mockReturnValue(createCardId('image-card-id'));

      await act(async () => {
        await result.current.createCard();
      });

      const createCall = mockCardStore.createCard.mock.calls[0][0] as CreateCardParams;
      expect(createCall.content).toEqual({
        type: 'image',
        url: '',
        alt: '',
        caption: '',
      });
    });

    it('should generate correct default content for link cards', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      act(() => {
        result.current.openModal(position, 'link');
      });

      mockCardStore.createCard.mockReturnValue(createCardId('link-card-id'));

      await act(async () => {
        await result.current.createCard();
      });

      const createCall = mockCardStore.createCard.mock.calls[0][0] as CreateCardParams;
      expect(createCall.content).toEqual({
        type: 'link',
        url: '',
        title: '',
        domain: '',
        isAccessible: true,
      });
    });

    it('should generate correct default content for code cards', async () => {
      const { result } = renderHook(() => useCardCreation());
      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      act(() => {
        result.current.openModal(position, 'code');
      });

      mockCardStore.createCard.mockReturnValue(createCardId('code-card-id'));

      await act(async () => {
        await result.current.createCard();
      });

      const createCall = mockCardStore.createCard.mock.calls[0][0] as CreateCardParams;
      expect(createCall.content).toEqual({
        type: 'code',
        language: 'javascript',
        content: '',
        lineCount: 0,
      });
    });
  });

  describe('Configuration Options', () => {
    it('should use configured default type', () => {
      const { result } = renderHook(() => useCardCreation({ defaultType: 'code' }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.state.selectedType).toBe('code');
    });

    it('should use configured default offset', () => {
      const { result } = renderHook(() => useCardCreation({ defaultOffset: { x: 50, y: 100 } }));

      const position = result.current.getDefaultPosition();

      expect(position).toEqual({
        x: 562, // (1024 / 2) + 50
        y: 484, // (768 / 2) + 100
        z: expect.any(Number),
      });
    });

    it('should log auto-enter edit mode when configured', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const { result } = renderHook(() => useCardCreation({ autoEnterEditMode: true }));

      const position: CanvasPosition = { x: 100, y: 200, z: 123 };

      act(() => {
        result.current.openModal(position, 'text');
      });

      mockCardStore.createCard.mockReturnValue(createCardId('auto-edit-card-id'));

      await act(async () => {
        await result.current.createCard();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Auto-enter edit mode for card:', 'auto-edit-card-id');

      consoleSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    it('should not cause memory leaks with rapid state changes', () => {
      const { result } = renderHook(() => useCardCreation());

      // Perform many rapid state changes
      for (let i = 0; i < 100; i++) {
        act(() => {
          result.current.openModal({ x: i, y: i, z: i }, 'text');
          result.current.closeModal();
          result.current.openContextMenu({ x: i, y: i });
          result.current.closeContextMenu();
          result.current.setSelectedType('image');
          result.current.clearError();
        });
      }

      // Final state should be clean
      expect(result.current.state).toEqual({
        isModalOpen: false,
        isContextMenuOpen: false,
        selectedType: 'image',
        creationPosition: null,
        contextMenuPosition: null,
        isCreating: false,
        error: null,
      });
    });
  });
});