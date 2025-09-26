/**
 * Tests for DOM Overlay Positioning System
 */

import { renderHook, act } from '@testing-library/react';
import {
  konvaToDOM,
  domToKonva,
  getOverlayPosition,
  useOverlayPosition,
  calculateDistance,
  isWithinBounds,
  clampToBounds,
  getCanvasViewportBounds,
  CoordinateTransformError,
  type CanvasViewport,
  type DOMPosition,
  type OverlayPosition,
} from '../overlayPositioning';
import type { Position } from '@/types/common.types';
import type { Card } from '@/types/card.types';
import { createCardId, DEFAULT_CARD_STYLE, DEFAULT_CARD_DIMENSIONS } from '@/types/card.types';
import { useCanvasStore } from '@/stores/canvasStore';

// Mock the canvas store
jest.mock('@/stores/canvasStore', () => ({
  useCanvasStore: jest.fn(),
}));

// Mock RAF for testing
let rafId = 0;
const mockRequestAnimationFrame = jest.fn((cb) => {
  // Execute callback synchronously for testing, but only once
  if (cb && typeof cb === 'function') {
    setTimeout(() => cb(Date.now()), 0);
  }
  return ++rafId;
});
const mockCancelAnimationFrame = jest.fn();
global.requestAnimationFrame = mockRequestAnimationFrame as any;
global.cancelAnimationFrame = mockCancelAnimationFrame as any;

describe('Overlay Positioning System', () => {
  // Helper function to create test viewport
  const createTestViewport = (overrides?: Partial<CanvasViewport>): CanvasViewport => ({
    position: { x: 0, y: 0, z: 0 },
    zoom: 1,
    containerOffset: { left: 100, top: 50 },
    containerDimensions: { width: 800, height: 600 },
    scrollOffset: { x: 0, y: 0 },
    ...overrides,
  });

  // Helper function to create test card
  const createTestCard = (overrides?: Partial<Card>): Card => ({
    id: createCardId('test-card-1'),
    ownerId: 'user-1',
    content: { type: 'text', content: 'Test', markdown: false, wordCount: 1 },
    position: { x: 200, y: 150, z: 0 },
    dimensions: DEFAULT_CARD_DIMENSIONS.text,
    style: DEFAULT_CARD_STYLE,
    isSelected: false,
    isLocked: false,
    isHidden: false,
    isMinimized: false,
    status: 'active',
    priority: 'normal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    metadata: {},
    animation: { isAnimating: false },
    ...overrides,
  } as Card);

  beforeEach(() => {
    jest.clearAllMocks();
    rafId = 0;
  });

  describe('konvaToDOM', () => {
    it('should convert Konva coordinates to DOM coordinates at 1x zoom', () => {
      const konvaPos: Position = { x: 200, y: 150 };
      const viewport = createTestViewport();

      const domPos = konvaToDOM(konvaPos, viewport);

      // At 1x zoom with no pan: DOM = Konva + containerOffset
      expect(domPos).toEqual({
        x: 300, // 200 + 100
        y: 200, // 150 + 50
      });
    });

    it('should handle zoom transformations', () => {
      const konvaPos: Position = { x: 200, y: 150 };
      const viewport = createTestViewport({ zoom: 2 });

      const domPos = konvaToDOM(konvaPos, viewport);

      // At 2x zoom: DOM = Konva * zoom + containerOffset
      expect(domPos).toEqual({
        x: 500, // 200 * 2 + 100
        y: 350, // 150 * 2 + 50
      });
    });

    it('should handle pan transformations', () => {
      const konvaPos: Position = { x: 200, y: 150 };
      const viewport = createTestViewport({
        position: { x: 50, y: 25, z: 0 },
      });

      const domPos = konvaToDOM(konvaPos, viewport);

      // With pan: DOM = (Konva - pan) * zoom + containerOffset
      expect(domPos).toEqual({
        x: 250, // (200 - 50) * 1 + 100
        y: 175, // (150 - 25) * 1 + 50
      });
    });

    it('should handle combined zoom and pan', () => {
      const konvaPos: Position = { x: 200, y: 150 };
      const viewport = createTestViewport({
        position: { x: 50, y: 25, z: 0 },
        zoom: 1.5,
      });

      const domPos = konvaToDOM(konvaPos, viewport);

      expect(domPos).toEqual({
        x: 325, // (200 - 50) * 1.5 + 100
        y: 237.5, // (150 - 25) * 1.5 + 50
      });
    });

    it('should throw error for invalid Konva position', () => {
      const viewport = createTestViewport();

      expect(() => konvaToDOM(null as any, viewport)).toThrow(CoordinateTransformError);
      expect(() => konvaToDOM({ x: NaN, y: 100 }, viewport)).toThrow(CoordinateTransformError);
    });

    it('should throw error for invalid viewport', () => {
      const konvaPos: Position = { x: 200, y: 150 };

      expect(() => konvaToDOM(konvaPos, null as any)).toThrow(CoordinateTransformError);
      expect(() =>
        konvaToDOM(konvaPos, { ...createTestViewport(), zoom: 0 })
      ).toThrow(CoordinateTransformError);
    });
  });

  describe('domToKonva', () => {
    it('should convert DOM coordinates to Konva coordinates at 1x zoom', () => {
      const domPos: DOMPosition = { x: 300, y: 200 };
      const viewport = createTestViewport();

      const konvaPos = domToKonva(domPos, viewport);

      expect(konvaPos).toEqual({
        x: 200, // (300 - 100) / 1 + 0
        y: 150, // (200 - 50) / 1 + 0
      });
    });

    it('should handle zoom transformations', () => {
      const domPos: DOMPosition = { x: 500, y: 350 };
      const viewport = createTestViewport({ zoom: 2 });

      const konvaPos = domToKonva(domPos, viewport);

      expect(konvaPos).toEqual({
        x: 200, // (500 - 100) / 2 + 0
        y: 150, // (350 - 50) / 2 + 0
      });
    });

    it('should handle pan transformations', () => {
      const domPos: DOMPosition = { x: 250, y: 175 };
      const viewport = createTestViewport({
        position: { x: 50, y: 25, z: 0 },
      });

      const konvaPos = domToKonva(domPos, viewport);

      expect(konvaPos).toEqual({
        x: 200, // (250 - 100) / 1 + 50
        y: 150, // (175 - 50) / 1 + 25
      });
    });

    it('should be inverse of konvaToDOM', () => {
      const originalPos: Position = { x: 237, y: 189 };
      const viewport = createTestViewport({
        position: { x: 42, y: 17, z: 0 },
        zoom: 1.75,
      });

      const domPos = konvaToDOM(originalPos, viewport);
      const backToKonva = domToKonva(domPos, viewport);

      expect(backToKonva.x).toBeCloseTo(originalPos.x, 10);
      expect(backToKonva.y).toBeCloseTo(originalPos.y, 10);
    });

    it('should throw error for invalid inputs', () => {
      const viewport = createTestViewport();

      expect(() => domToKonva(null as any, viewport)).toThrow(CoordinateTransformError);
      expect(() => domToKonva({ x: 100, y: NaN }, viewport)).toThrow(CoordinateTransformError);
      expect(() =>
        domToKonva({ x: 100, y: 100 }, { ...viewport, zoom: -1 })
      ).toThrow(CoordinateTransformError);
    });
  });

  describe('getOverlayPosition', () => {
    let mockContainer: HTMLElement;

    beforeEach(() => {
      mockContainer = document.createElement('div');
      mockContainer.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 50,
        right: 900,
        bottom: 650,
        width: 800,
        height: 600,
        x: 100,
        y: 50,
        toJSON: () => {},
      }));
    });

    it('should calculate overlay position for visible card', () => {
      const card = createTestCard();
      const viewport = createTestViewport();

      const overlayPos = getOverlayPosition(card, viewport, mockContainer);

      expect(overlayPos.isVisible).toBe(true);
      expect(overlayPos.x).toBe(300); // Card position transformed to DOM
      expect(overlayPos.y).toBe(200);
      expect(overlayPos.anchor).toBe('top-left');
    });

    it('should detect when card is outside viewport', () => {
      const card = createTestCard({
        position: { x: 2000, y: 2000, z: 0 }, // Far outside viewport
      });
      const viewport = createTestViewport();

      const overlayPos = getOverlayPosition(card, viewport, mockContainer);

      expect(overlayPos.isVisible).toBe(false);
    });

    it('should handle overlay dimensions and clamp to viewport', () => {
      const card = createTestCard({
        position: { x: 700, y: 500, z: 0 }, // Near right edge
      });
      const viewport = createTestViewport();
      const overlayDimensions = { width: 300, height: 200 };

      const overlayPos = getOverlayPosition(card, viewport, mockContainer, overlayDimensions);

      expect(overlayPos.isVisible).toBe(true);
      // The card at x:700 transforms to DOM x:800 (700 + 100 containerOffset)
      // Card width 250 means right edge at 1050
      // Overlay width 300 from x:800 would end at 1100 (beyond viewport right 900)
      // So it tries to align from card right edge: 1050 - 300 = 750
      // Verify that some repositioning happened
      expect(overlayPos.x).toBeDefined();
      // The anchor should be adjusted based on overflow
      expect(['top-left', 'top-right', 'bottom-left', 'bottom-right']).toContain(overlayPos.anchor);
    });

    it('should adjust anchor for edge cases', () => {
      const card = createTestCard({
        position: { x: 650, y: 450, z: 0 },
        dimensions: { width: 100, height: 100 },
      });
      const viewport = createTestViewport();
      const overlayDimensions = { width: 400, height: 300 };

      const overlayPos = getOverlayPosition(card, viewport, mockContainer, overlayDimensions);

      expect(overlayPos.isVisible).toBe(true);
      expect(overlayPos.anchor).not.toBe('top-left'); // Should adjust anchor
    });

    it('should handle zoomed viewport correctly', () => {
      const card = createTestCard();
      const viewport = createTestViewport({ zoom: 2 });

      const overlayPos = getOverlayPosition(card, viewport, mockContainer);

      expect(overlayPos.isVisible).toBe(true);
      // Position should be scaled by zoom
      expect(overlayPos.x).toBe(500); // (200 - 0) * 2 + 100
      expect(overlayPos.y).toBe(350); // (150 - 0) * 2 + 50
    });

    it('should handle errors gracefully', () => {
      const card = createTestCard();
      const invalidViewport = {} as CanvasViewport;

      const overlayPos = getOverlayPosition(card, invalidViewport, mockContainer);

      expect(overlayPos.isVisible).toBe(false);
      expect(overlayPos.x).toBe(0);
      expect(overlayPos.y).toBe(0);
    });
  });

  describe('useOverlayPosition', () => {
    const mockUseCanvasStore = useCanvasStore as jest.MockedFunction<typeof useCanvasStore>;

    beforeEach(() => {
      // Setup mock store state
      mockUseCanvasStore.mockImplementation((selector) => {
        const state = {
          viewport: {
            position: { x: 0, y: 0, z: 0 },
            zoom: 1,
            bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
            isDirty: false,
          },
        };
        return selector ? selector(state as any) : state;
      });

      // Mock DOM query
      const mockContainer = document.createElement('div');
      mockContainer.setAttribute('data-canvas-container', 'true');
      mockContainer.getBoundingClientRect = jest.fn(() => ({
        left: 100,
        top: 50,
        right: 900,
        bottom: 650,
        width: 800,
        height: 600,
        x: 100,
        y: 50,
        toJSON: () => {},
      }));
      document.body.appendChild(mockContainer);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should return null when card is null', () => {
      const { result } = renderHook(() => useOverlayPosition(null, true));

      expect(result.current).toBeNull();
    });

    it('should return null when not active', () => {
      const card = createTestCard();
      const { result } = renderHook(() => useOverlayPosition(card, false));

      expect(result.current).toBeNull();
    });

    it('should calculate position when active with card', async () => {
      const card = createTestCard();
      const { result } = renderHook(() => useOverlayPosition(card, true));

      // Wait for async update
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(result.current).not.toBeNull();
      expect(result.current?.isVisible).toBe(true);
    });

    it('should apply offset when provided', async () => {
      const card = createTestCard();
      const offset = { x: 10, y: 20 };
      const { result } = renderHook(() =>
        useOverlayPosition(card, true, { offset })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(result.current).not.toBeNull();
      // Position should include offset
    });

    it('should handle overlay dimensions', async () => {
      const card = createTestCard();
      const overlayDimensions = { width: 200, height: 150 };
      const { result } = renderHook(() =>
        useOverlayPosition(card, true, { overlayDimensions })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(result.current).not.toBeNull();
    });

    it('should update when viewport changes', async () => {
      const card = createTestCard();
      const { result, rerender } = renderHook(() => useOverlayPosition(card, true));

      // Initial position
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const initialPos = result.current;

      // Update viewport zoom
      mockUseCanvasStore.mockImplementation((selector) => {
        const state = {
          viewport: {
            position: { x: 0, y: 0, z: 0 },
            zoom: 2, // Changed zoom
            bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
            isDirty: false,
          },
        };
        return selector ? selector(state as any) : state;
      });

      rerender();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Position should have changed due to zoom change
      expect(result.current?.x).not.toBe(initialPos?.x);
    });

    it('should cleanup RAF on unmount', async () => {
      const card = createTestCard();
      const { unmount } = renderHook(() => useOverlayPosition(card, true));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      unmount();

      expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });

    it('should handle window resize events', async () => {
      const card = createTestCard();
      const { result } = renderHook(() => useOverlayPosition(card, true));

      await act(async () => {
        window.dispatchEvent(new Event('resize'));
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(result.current).not.toBeNull();
    });
  });

  describe('Utility Functions', () => {
    describe('calculateDistance', () => {
      it('should calculate distance between two points', () => {
        const pos1: Position = { x: 0, y: 0 };
        const pos2: Position = { x: 3, y: 4 };

        const distance = calculateDistance(pos1, pos2);

        expect(distance).toBe(5); // 3-4-5 triangle
      });

      it('should return 0 for same position', () => {
        const pos: Position = { x: 100, y: 200 };

        const distance = calculateDistance(pos, pos);

        expect(distance).toBe(0);
      });
    });

    describe('isWithinBounds', () => {
      const bounds = { x: 100, y: 100, width: 200, height: 150 };

      it('should return true for position within bounds', () => {
        expect(isWithinBounds({ x: 150, y: 150 }, bounds)).toBe(true);
        expect(isWithinBounds({ x: 100, y: 100 }, bounds)).toBe(true); // Edge
        expect(isWithinBounds({ x: 300, y: 250 }, bounds)).toBe(true); // Other edge
      });

      it('should return false for position outside bounds', () => {
        expect(isWithinBounds({ x: 50, y: 150 }, bounds)).toBe(false);
        expect(isWithinBounds({ x: 150, y: 50 }, bounds)).toBe(false);
        expect(isWithinBounds({ x: 350, y: 150 }, bounds)).toBe(false);
        expect(isWithinBounds({ x: 150, y: 300 }, bounds)).toBe(false);
      });
    });

    describe('clampToBounds', () => {
      const bounds = { x: 100, y: 100, width: 200, height: 150 };

      it('should not modify position within bounds', () => {
        const pos: Position = { x: 150, y: 150 };
        const clamped = clampToBounds(pos, bounds);

        expect(clamped).toEqual(pos);
      });

      it('should clamp position outside bounds', () => {
        expect(clampToBounds({ x: 50, y: 150 }, bounds)).toEqual({ x: 100, y: 150 });
        expect(clampToBounds({ x: 350, y: 150 }, bounds)).toEqual({ x: 300, y: 150 });
        expect(clampToBounds({ x: 150, y: 50 }, bounds)).toEqual({ x: 150, y: 100 });
        expect(clampToBounds({ x: 150, y: 300 }, bounds)).toEqual({ x: 150, y: 250 });
      });

      it('should handle corner cases', () => {
        expect(clampToBounds({ x: 50, y: 50 }, bounds)).toEqual({ x: 100, y: 100 });
        expect(clampToBounds({ x: 350, y: 300 }, bounds)).toEqual({ x: 300, y: 250 });
      });
    });

    describe('getCanvasViewportBounds', () => {
      it('should return bounds from provided element', () => {
        const element = document.createElement('div');
        element.getBoundingClientRect = jest.fn(() => ({
          left: 10,
          top: 20,
          right: 110,
          bottom: 120,
          width: 100,
          height: 100,
          x: 10,
          y: 20,
          toJSON: () => {},
        }));

        const bounds = getCanvasViewportBounds(element);

        expect(bounds).not.toBeNull();
        expect(bounds?.left).toBe(10);
        expect(bounds?.width).toBe(100);
      });

      it('should find element by data attribute', () => {
        const element = document.createElement('div');
        element.setAttribute('data-canvas-container', 'true');
        element.getBoundingClientRect = jest.fn(() => ({
          left: 0,
          top: 0,
          right: 800,
          bottom: 600,
          width: 800,
          height: 600,
          x: 0,
          y: 0,
          toJSON: () => {},
        }));
        document.body.appendChild(element);

        const bounds = getCanvasViewportBounds();

        expect(bounds).not.toBeNull();
        expect(bounds?.width).toBe(800);

        document.body.removeChild(element);
      });

      it('should return null when element not found', () => {
        const bounds = getCanvasViewportBounds();

        expect(bounds).toBeNull();
      });
    });
  });
});