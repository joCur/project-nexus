/**
 * Test helper utilities for card creation testing
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock window.matchMedia for components that use media queries
export const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// Mock ResizeObserver for components that observe element sizes
export const mockResizeObserver = () => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
};

// Mock getBoundingClientRect for position calculations
export const mockGetBoundingClientRect = (
  rect = { x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100 }
) => {
  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    ...rect,
    toJSON: () => rect,
  }));
};

// Keyboard event helpers
export const createKeyboardEvent = (key: string, options: Partial<KeyboardEvent> = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  return event;
};

// Mouse event helpers
export const createMouseEvent = (
  type: string,
  coordinates = { clientX: 0, clientY: 0 },
  options: Partial<MouseEvent> = {}
): MouseEvent => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    ...coordinates,
    ...options,
  });
  return event;
};

// Simulate right-click context menu
export const simulateRightClick = async (element: Element, coordinates = { clientX: 100, clientY: 100 }) => {
  const user = userEvent.setup();

  await user.pointer({
    keys: '[MouseRight]',
    target: element,
    coords: coordinates,
  });
};

// Simulate keyboard navigation
export const simulateKeyboardNavigation = async (keys: string[]) => {
  const user = userEvent.setup();

  for (const key of keys) {
    await user.keyboard(key);
  }
};

// Wait for element with custom timeout
export const waitForElementWithTimeout = async (
  selector: () => HTMLElement | null,
  timeout = 1000
) => {
  return waitFor(() => {
    const element = selector();
    expect(element).toBeInTheDocument();
    return element;
  }, { timeout });
};

// Assert aria attributes
export const expectAriaAttributes = (element: Element, attributes: Record<string, string | boolean>) => {
  Object.entries(attributes).forEach(([key, value]) => {
    const ariaKey = key.startsWith('aria-') ? key : `aria-${key}`;
    expect(element).toHaveAttribute(ariaKey, String(value));
  });
};

// Check keyboard accessibility
export const checkKeyboardAccessibility = async (element: Element, keys = ['Enter', ' ']) => {
  const user = userEvent.setup();

  // Focus the element
  await user.tab();
  expect(element).toHaveFocus();

  // Test keyboard activation
  for (const key of keys) {
    await user.keyboard(`{${key}}`);
  }
};

// Mock canvas context for tests that need canvas operations
export const mockCanvasContext = () => {
  const mockContext = {
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    arc: jest.fn(),
    rect: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    strokeStyle: '#000000',
    fillStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 4,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };

  HTMLCanvasElement.prototype.getContext = jest.fn().mockImplementation((contextId: string) => {
    if (contextId === '2d') {
      return mockContext;
    }
    return null;
  });
  return mockContext;
};

// Assert focus management
export const expectProperFocusManagement = async (
  activeElement: Element,
  nextElement?: Element
) => {
  expect(document.activeElement).toBe(activeElement);

  if (nextElement) {
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(nextElement);
  }
};

// Test component cleanup
export const expectCleanupAfterUnmount = (cleanup: () => void) => {
  expect(() => cleanup()).not.toThrow();
};

// Assert position calculations
export const expectPositionCalculation = (
  actualPosition: { x: number; y: number },
  expectedPosition: { x: number; y: number },
  tolerance = 1
) => {
  expect(Math.abs(actualPosition.x - expectedPosition.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actualPosition.y - expectedPosition.y)).toBeLessThanOrEqual(tolerance);
};

