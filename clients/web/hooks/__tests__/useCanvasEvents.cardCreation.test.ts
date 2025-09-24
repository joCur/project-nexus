/**
 * Integration tests for useCanvasEvents card creation functionality
 *
 * This test suite covers:
 * - Keyboard shortcuts for card creation (N, Shift+N, T, I, L, C)
 * - Right-click context menu integration
 * - Input detection to avoid conflicts
 * - Canvas focus requirements
 * - Position calculations for card placement
 */

import { renderHook, act } from '@testing-library/react';
import { useCanvasEvents } from '../useCanvasEvents';
import { createMockCanvasStore } from '../../__tests__/utils';
import { fireEvent } from '@testing-library/react';
import { RefObject } from 'react';

// Mock the canvas store
let mockCanvasStore: ReturnType<typeof createMockCanvasStore>;

jest.mock('@/stores/canvasStore', () => ({
  useCanvasStore: jest.fn(),
}));

// Mock window.matchMedia for accessibility features
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

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

describe('useCanvasEvents - Card Creation Integration', () => {
  let mockElement: HTMLDivElement;
  let containerRef: RefObject<HTMLDivElement>;
  let mockOnCreateCard: jest.Mock;
  let mockOnOpenCardTypeSelector: jest.Mock;
  let mockOnOpenContextMenu: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock instances
    mockCanvasStore = createMockCanvasStore();

    // Setup the mock implementation
    const { useCanvasStore } = require('@/stores/canvasStore');
    (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);

    // Store event listeners for manual triggering
    const eventListeners: { [key: string]: EventListener[] } = {};

    // Create mock element with all required methods including context menu setup
    mockElement = {
      tabIndex: 0,
      contains: jest.fn(),
      addEventListener: jest.fn((eventType: string, handler: EventListener) => {
        if (!eventListeners[eventType]) {
          eventListeners[eventType] = [];
        }
        eventListeners[eventType].push(handler);
      }),
      removeEventListener: jest.fn((eventType: string, handler: EventListener) => {
        if (eventListeners[eventType]) {
          const index = eventListeners[eventType].indexOf(handler);
          if (index > -1) {
            eventListeners[eventType].splice(index, 1);
          }
        }
      }),
      querySelector: jest.fn().mockReturnValue(null),
      setAttribute: jest.fn(),
      getBoundingClientRect: jest.fn().mockReturnValue({
        width: 1024,
        height: 768,
        left: 0,
        top: 0,
        right: 1024,
        bottom: 768,
      }),
      focus: jest.fn(),
      dispatchEvent: jest.fn((event: Event) => {
        const listeners = eventListeners[event.type];
        if (listeners) {
          listeners.forEach(listener => listener(event));
        }
        return true;
      }),
      // Add context menu support - mock element as infinite canvas
      closest: jest.fn((selector: string) => {
        if (selector === '[data-testid="infinite-canvas"]') {
          return mockElement; // This element IS the infinite canvas
        }
        if (selector === '[data-card-id]') {
          return null; // This element is NOT a card
        }
        return null;
      }),
      // Ensure contains works for context menu events
      contains: jest.fn((node: Node) => {
        return node === mockElement; // Contains itself and its "children"
      }),
    } as unknown as HTMLDivElement;

    // Create ref
    containerRef = { current: mockElement };

    // Create mock handlers
    mockOnCreateCard = jest.fn();
    mockOnOpenCardTypeSelector = jest.fn();
    mockOnOpenContextMenu = jest.fn();

    // Reset canvas store
    mockCanvasStore.viewport = {
      position: { x: 0, y: 0 },
      zoom: 1,
      bounds: { x: 0, y: 0, width: 1024, height: 768 },
    };
    mockCanvasStore.config = {
      zoom: { min: 0.1, max: 10, step: 0.1 },
      grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
      performance: { enableCulling: true, enableVirtualization: true, maxVisibleCards: 1000 },
    };

    // Mock document.activeElement
    Object.defineProperty(document, 'activeElement', {
      writable: true,
      value: mockElement,
    });
  });

  const getCardCreationHandlers = () => ({
    onCreateCard: mockOnCreateCard,
    onOpenCardTypeSelector: mockOnOpenCardTypeSelector,
    onOpenContextMenu: mockOnOpenContextMenu,
  });

  describe('Focus Requirements', () => {
    it('should only handle events when canvas is focused', () => {
      const { result } = renderHook(() =>
        useCanvasEvents(containerRef, getCardCreationHandlers())
      );

      // Mock container.contains to return false (not focused)
      mockElement.contains = jest.fn().mockReturnValue(false);

      // Trigger keyboard event
      const keyEvent = new KeyboardEvent('keydown', { key: 't' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should handle events when canvas is focused', () => {
      const { result } = renderHook(() =>
        useCanvasEvents(containerRef, getCardCreationHandlers())
      );

      // Mock container.contains to return true (focused)
      mockElement.contains = jest.fn().mockReturnValue(true);

      // Trigger keyboard event
      const keyEvent = new KeyboardEvent('keydown', { key: 't' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('text', expect.any(Object));
    });
  });

  describe('Input Detection', () => {
    it('should ignore keyboard shortcuts when typing in input fields', () => {
      const { result } = renderHook(() =>
        useCanvasEvents(containerRef, getCardCreationHandlers())
      );

      mockElement.contains = jest.fn().mockReturnValue(true);

      // Mock active element as input field
      const mockInput = document.createElement('input');
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: mockInput,
      });

      const keyEvent = new KeyboardEvent('keydown', { key: 't' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should ignore shortcuts when typing in textarea', () => {
      const { result } = renderHook(() =>
        useCanvasEvents(containerRef, getCardCreationHandlers())
      );

      mockElement.contains = jest.fn().mockReturnValue(true);

      // Mock active element as textarea
      const mockTextarea = document.createElement('textarea');
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: mockTextarea,
      });

      const keyEvent = new KeyboardEvent('keydown', { key: 'i' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should ignore shortcuts when typing in select fields', () => {
      const { result } = renderHook(() =>
        useCanvasEvents(containerRef, getCardCreationHandlers())
      );

      mockElement.contains = jest.fn().mockReturnValue(true);

      // Mock active element as select
      const mockSelect = document.createElement('select');
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: mockSelect,
      });

      const keyEvent = new KeyboardEvent('keydown', { key: 'l' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should ignore shortcuts when typing in contentEditable elements', () => {
      const { result } = renderHook(() =>
        useCanvasEvents(containerRef, getCardCreationHandlers())
      );

      mockElement.contains = jest.fn().mockReturnValue(true);

      // Mock active element as contentEditable div
      const mockDiv = document.createElement('div');
      mockDiv.contentEditable = 'true';

      // Ensure isContentEditable is true in Jest environment
      Object.defineProperty(mockDiv, 'isContentEditable', {
        value: true,
        writable: false,
      });

      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: mockDiv,
      });

      const keyEvent = new KeyboardEvent('keydown', { key: 'c' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });
  });

  describe('Card Creation Shortcuts', () => {
    let hookResult: any;
    let currentHookCleanup: (() => void) | null = null;

    beforeEach(() => {
      hookResult = renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));
      currentHookCleanup = hookResult.unmount;
      mockElement.contains = jest.fn().mockReturnValue(true);
    });

    afterEach(() => {
      // Clean up hook to remove event listeners
      if (currentHookCleanup) {
        currentHookCleanup();
        currentHookCleanup = null;
      }
    });

    it('should create text card with N key', () => {
      const keyEvent = new KeyboardEvent('keydown', { key: 'n' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('text', {
        x: 512, // (1024 / 2)
        y: 384, // (768 / 2)
      });
    });

    it('should open card type selector with Shift+N', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'n',
        shiftKey: true,
      });
      fireEvent(document, keyEvent);

      expect(mockOnOpenCardTypeSelector).toHaveBeenCalled();
      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should create text card with T key', () => {
      const keyEvent = new KeyboardEvent('keydown', { key: 't' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('text', {
        x: 512,
        y: 384,
      });
    });

    it('should create image card with I key', () => {
      const keyEvent = new KeyboardEvent('keydown', { key: 'i' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('image', {
        x: 512,
        y: 384,
      });
    });

    it('should create link card with L key', () => {
      const keyEvent = new KeyboardEvent('keydown', { key: 'l' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('link', {
        x: 512,
        y: 384,
      });
    });

    it('should create code card with C key', () => {
      const keyEvent = new KeyboardEvent('keydown', { key: 'c' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('code', {
        x: 512,
        y: 384,
      });
    });

    it('should handle uppercase keys', () => {
      const keyEvent = new KeyboardEvent('keydown', { key: 'T' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('text', expect.any(Object));
    });

    it('should ignore shortcuts with Ctrl modifier', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
      });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should ignore shortcuts with Meta modifier', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'i',
        metaKey: true,
      });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should ignore shortcuts with Alt modifier', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'l',
        altKey: true,
      });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should not trigger when handlers are not provided', () => {
      // Clean up the existing hook first
      if (currentHookCleanup) {
        currentHookCleanup();
        currentHookCleanup = null;
      }

      // Clear all mocks after cleanup
      jest.clearAllMocks();

      // Render hook without handlers - completely fresh instance
      const { unmount } = renderHook(() => useCanvasEvents(containerRef));
      mockElement.contains = jest.fn().mockReturnValue(true);

      const keyEvent = new KeyboardEvent('keydown', { key: 't' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).not.toHaveBeenCalled();

      // Clean up the no-handler hook
      unmount();
    });
  });

  describe('Position Calculations', () => {
    it('should calculate center position with viewport offset', () => {
      // Set viewport with offset BEFORE rendering hook
      mockCanvasStore.viewport.position = { x: -100, y: -50 };

      renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));
      mockElement.contains = jest.fn().mockReturnValue(true);

      const keyEvent = new KeyboardEvent('keydown', { key: 't' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('text', {
        x: 612, // (-(-100) + 1024/2) / 1
        y: 434, // (-(-50) + 768/2) / 1
      });
    });

    it('should calculate center position with zoom', () => {
      // Set viewport with zoom BEFORE rendering hook
      mockCanvasStore.viewport.zoom = 2;

      renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));
      mockElement.contains = jest.fn().mockReturnValue(true);

      const keyEvent = new KeyboardEvent('keydown', { key: 'i' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('image', {
        x: 256, // (1024 / 2) / 2
        y: 192, // (768 / 2) / 2
      });
    });

    it('should calculate center position with both offset and zoom', () => {
      // Set viewport with both offset and zoom BEFORE rendering hook
      mockCanvasStore.viewport.position = { x: -200, y: -100 };
      mockCanvasStore.viewport.zoom = 1.5;

      renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));
      mockElement.contains = jest.fn().mockReturnValue(true);

      const keyEvent = new KeyboardEvent('keydown', { key: 'c' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('code', {
        x: 474.6666666666667, // (-(-200) + 1024/2) / 1.5
        y: 322.6666666666667, // (-(-100) + 768/2) / 1.5
      });
    });
  });

  describe('Right-click Context Menu', () => {
    let contextMenuHookCleanup: (() => void) | null = null;

    beforeEach(() => {
      // Ensure contains returns true for context menu events and can handle Node objects
      mockElement.contains = jest.fn().mockImplementation((node: any) => {
        // Return true for all nodes to simulate the element contains check
        return true;
      });
      const hookResult = renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));
      contextMenuHookCleanup = hookResult.unmount;
    });

    afterEach(() => {
      // Clean up hook to remove event listeners
      if (contextMenuHookCleanup) {
        contextMenuHookCleanup();
        contextMenuHookCleanup = null;
      }
    });

    it('should trigger context menu on right-click', () => {
      // Create a proper target element that will pass the context menu checks
      const targetElement = {
        closest: jest.fn((selector: string) => {
          if (selector === '[data-testid="infinite-canvas"]') {
            return mockElement; // Element is within infinite canvas
          }
          if (selector === '[data-card-id]') {
            return null; // Element is NOT a card
          }
          return null;
        }),
      };

      const contextMenuEvent = new MouseEvent('contextmenu', {
        clientX: 300,
        clientY: 400,
        bubbles: true,
      });

      // Mock the event target to be the target element
      Object.defineProperty(contextMenuEvent, 'target', {
        value: targetElement,
        enumerable: true,
      });

      // Directly trigger the event on the element using dispatchEvent
      // which should trigger the addEventListener handlers
      mockElement.dispatchEvent(contextMenuEvent);

      expect(mockOnOpenContextMenu).toHaveBeenCalledWith({
        x: 300,
        y: 400,
      });
    });

    it('should prevent default context menu behavior', () => {
      // Create a proper target element that will pass the context menu checks
      const targetElement = {
        closest: jest.fn((selector: string) => {
          if (selector === '[data-testid="infinite-canvas"]') {
            return mockElement; // Element is within infinite canvas
          }
          if (selector === '[data-card-id]') {
            return null; // Element is NOT a card
          }
          return null;
        }),
      };

      const contextMenuEvent = new MouseEvent('contextmenu', {
        clientX: 300,
        clientY: 400,
        bubbles: true,
      });

      const preventDefaultSpy = jest.spyOn(contextMenuEvent, 'preventDefault');

      // Mock the event target to be the target element
      Object.defineProperty(contextMenuEvent, 'target', {
        value: targetElement,
        enumerable: true,
      });

      // Directly trigger the event on the element using dispatchEvent
      mockElement.dispatchEvent(contextMenuEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not trigger context menu when handler not provided', () => {
      // Clean up the existing hook first
      if (contextMenuHookCleanup) {
        contextMenuHookCleanup();
        contextMenuHookCleanup = null;
      }

      // Clear all mocks after cleanup
      jest.clearAllMocks();

      // Re-render without handlers - completely fresh instance
      const { unmount } = renderHook(() => useCanvasEvents(containerRef));

      // Create a proper target element that will pass the context menu checks
      const targetElement = {
        closest: jest.fn((selector: string) => {
          if (selector === '[data-testid="infinite-canvas"]') {
            return mockElement; // Element is within infinite canvas
          }
          if (selector === '[data-card-id]') {
            return null; // Element is NOT a card
          }
          return null;
        }),
      };

      const contextMenuEvent = new MouseEvent('contextmenu', {
        clientX: 300,
        clientY: 400,
        bubbles: true,
      });

      // Mock the event target to be the target element
      Object.defineProperty(contextMenuEvent, 'target', {
        value: targetElement,
        enumerable: true,
      });

      mockElement.dispatchEvent(contextMenuEvent);

      expect(mockOnOpenContextMenu).not.toHaveBeenCalled();

      // Clean up the no-handler hook
      unmount();
    });
  });

  describe('Canvas Navigation Integration', () => {
    beforeEach(() => {
      renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));
      mockElement.contains = jest.fn().mockReturnValue(true);
    });

    it('should not interfere with arrow key navigation', () => {
      const arrowUpEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      fireEvent(document, arrowUpEvent);

      expect(mockCanvasStore.setPosition).toHaveBeenCalledWith({
        x: 0,
        y: 20, // panSpeed
      });
      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should not interfere with zoom controls', () => {
      const plusEvent = new KeyboardEvent('keydown', { key: '+' });
      fireEvent(document, plusEvent);

      expect(mockCanvasStore.setZoom).toHaveBeenCalledWith(1.1); // zoom * (1 + zoomSpeed)
      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should handle card creation after navigation', () => {
      // First navigate
      const arrowRightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      fireEvent(document, arrowRightEvent);

      expect(mockCanvasStore.setPosition).toHaveBeenCalledWith({
        x: -20, // -panSpeed
        y: 0,
      });

      // Update store position to simulate navigation and re-render hook
      mockCanvasStore.viewport.position = { x: -20, y: 0 };

      // Re-render hook to pick up the new position
      renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));

      // Then create card
      const createCardEvent = new KeyboardEvent('keydown', { key: 't' });
      fireEvent(document, createCardEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('text', {
        x: 532, // (-(-20) + 1024/2) / 1
        y: 384, // (768/2) / 1
      });
    });
  });

  describe('Accessibility Integration', () => {
    beforeEach(() => {
      renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));
      mockElement.contains = jest.fn().mockReturnValue(true);
    });

    it('should respect reduced motion preferences for navigation', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      // Re-render to pick up new matchMedia mock
      renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));

      const arrowUpEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      fireEvent(document, arrowUpEvent);

      expect(mockCanvasStore.setPosition).toHaveBeenCalledWith({
        x: 0,
        y: 10, // reduced panSpeed
      });
    });

    it('should still create cards normally with reduced motion', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
        })),
      });

      renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));
      mockElement.contains = jest.fn().mockReturnValue(true);

      const keyEvent = new KeyboardEvent('keydown', { key: 't' });
      fireEvent(document, keyEvent);

      expect(mockOnCreateCard).toHaveBeenCalledWith('text', expect.any(Object));
    });
  });

  describe('Event Cleanup', () => {
    it('should clean up event listeners on unmount', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should clean up container event listeners on unmount', () => {
      const addEventListenerSpy = jest.spyOn(mockElement, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(mockElement, 'removeEventListener');

      const { unmount } = renderHook(() => useCanvasEvents(containerRef, getCardCreationHandlers()));

      expect(addEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });
  });
});