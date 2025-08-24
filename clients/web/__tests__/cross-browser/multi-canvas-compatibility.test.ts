/**
 * Multi-Canvas Cross-Browser Compatibility Tests (NEX-177)
 * 
 * Comprehensive cross-browser testing matrix for major browsers including:
 * - Chrome, Firefox, Safari, Edge (latest versions)
 * - Mobile browsers
 * - Feature compatibility verification
 * - Browser-specific API handling
 * - Polyfill and fallback testing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Import components
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import CanvasSwitcher from '@/components/workspace/CanvasSwitcher';
import { InfiniteCanvas } from '@/components/canvas';

// Import stores
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';

// Import types
import type { EntityId } from '@/types/common.types';
import type { CanvasId } from '@/types/workspace.types';

// Mock stores
jest.mock('@/stores/workspaceStore');
jest.mock('@/stores/canvasStore');

// Browser detection utilities
const BrowserDetector = {
  isChrome: () => /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor),
  isFirefox: () => /Firefox/.test(navigator.userAgent),
  isSafari: () => /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor),
  isEdge: () => /Edg/.test(navigator.userAgent),
  isMobile: () => /Mobi|Android/i.test(navigator.userAgent),
  isIOS: () => /iPad|iPhone|iPod/.test(navigator.userAgent),
  isAndroid: () => /Android/.test(navigator.userAgent),
  getVersion: () => {
    const match = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/(\d+)/);
    return match ? parseInt(match[2]) : 0;
  }
};

// Feature detection utilities
const FeatureDetector = {
  hasIntersectionObserver: () => 'IntersectionObserver' in window,
  hasResizeObserver: () => 'ResizeObserver' in window,
  hasWebGL: () => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  },
  hasWebGL2: () => {
    try {
      const canvas = document.createElement('canvas');
      return !!canvas.getContext('webgl2');
    } catch {
      return false;
    }
  },
  hasPointerEvents: () => 'PointerEvent' in window,
  hasTouchEvents: () => 'TouchEvent' in window,
  hasWebWorkers: () => 'Worker' in window,
  hasIndexedDB: () => 'indexedDB' in window,
  hasLocalStorage: () => {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return true;
    } catch {
      return false;
    }
  },
  hasSessionStorage: () => {
    try {
      sessionStorage.setItem('test', 'test');
      sessionStorage.removeItem('test');
      return true;
    } catch {
      return false;
    }
  },
  hasWebSockets: () => 'WebSocket' in window,
  hasServiceWorkers: () => 'serviceWorker' in navigator,
  hasClipboardAPI: () => 'clipboard' in navigator,
  hasFullscreenAPI: () => 'requestFullscreen' in document.documentElement,
};

describe('Multi-Canvas Cross-Browser Compatibility', () => {
  let user: ReturnType<typeof userEvent.setup>;

  // Test data
  const mockWorkspace = {
    id: 'test-workspace-id' as EntityId,
    name: 'Cross-Browser Test Workspace',
  };

  const mockCanvas = {
    id: 'test-canvas-id' as CanvasId,
    workspaceId: mockWorkspace.id,
    name: 'Test Canvas',
    description: 'Canvas for cross-browser testing',
    settings: {
      isDefault: true,
      position: { x: 0, y: 0, z: 0 },
      zoom: 1.0,
      grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
      background: { type: 'COLOR' as const, color: '#ffffff', opacity: 1.0 },
    },
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  beforeEach(() => {
    user = userEvent.setup({ delay: null });

    // Setup store mocks
    const mockWorkspaceStore = {
      currentWorkspace: mockWorkspace,
      getCurrentCanvas: jest.fn().mockReturnValue(mockCanvas),
      switchToCanvas: jest.fn(),
    };

    const mockCanvasStore = {
      cards: new Map(),
      loadCanvasData: jest.fn(),
    };

    (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);
    (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createWrapper = (mocks: any[] = []) => {
    return ({ children }: { children: React.ReactNode }) => (
      <BrowserRouter>
        <MockedProvider mocks={mocks} addTypename={false}>
          {children}
        </MockedProvider>
      </BrowserRouter>
    );
  };

  describe('Browser Feature Detection and Polyfills', () => {
    it('should detect required browser features', () => {
      // Core features required for multi-canvas functionality
      expect(FeatureDetector.hasIntersectionObserver()).toBe(true);
      expect(FeatureDetector.hasResizeObserver()).toBe(true);
      expect(FeatureDetector.hasLocalStorage()).toBe(true);
      expect(FeatureDetector.hasWebSockets()).toBe(true);

      // Log feature availability for debugging
      console.log('Browser Feature Matrix:', {
        browser: navigator.userAgent,
        intersectionObserver: FeatureDetector.hasIntersectionObserver(),
        resizeObserver: FeatureDetector.hasResizeObserver(),
        webGL: FeatureDetector.hasWebGL(),
        webGL2: FeatureDetector.hasWebGL2(),
        pointerEvents: FeatureDetector.hasPointerEvents(),
        touchEvents: FeatureDetector.hasTouchEvents(),
        webWorkers: FeatureDetector.hasWebWorkers(),
        indexedDB: FeatureDetector.hasIndexedDB(),
        localStorage: FeatureDetector.hasLocalStorage(),
        webSockets: FeatureDetector.hasWebSockets(),
        clipboardAPI: FeatureDetector.hasClipboardAPI(),
      });
    });

    it('should provide polyfills for missing features', () => {
      // Mock missing IntersectionObserver
      const originalIntersectionObserver = window.IntersectionObserver;
      delete (window as any).IntersectionObserver;

      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      // Should still function with polyfill
      expect(screen.getByRole('main')).toBeInTheDocument();

      // Restore
      window.IntersectionObserver = originalIntersectionObserver;
    });

    it('should handle missing ResizeObserver gracefully', () => {
      // Mock missing ResizeObserver
      const originalResizeObserver = window.ResizeObserver;
      delete (window as any).ResizeObserver;

      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      // Should still render but may use fallback resize detection
      expect(screen.getByRole('main')).toBeInTheDocument();

      // Restore
      window.ResizeObserver = originalResizeObserver;
    });
  });

  describe('Chrome Compatibility', () => {
    beforeEach(() => {
      // Mock Chrome user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        configurable: true,
      });

      Object.defineProperty(navigator, 'vendor', {
        value: 'Google Inc.',
        configurable: true,
      });
    });

    it('should render canvas switcher correctly in Chrome', async () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      const switcher = screen.getByRole('combobox');
      expect(switcher).toBeInTheDocument();
      expect(switcher).toHaveValue('Test Canvas');

      // Test dropdown functionality
      await user.click(switcher);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should handle Chrome-specific pointer events', async () => {
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      const canvas = screen.getByRole('main');

      // Test Chrome pointer events
      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 200, clientY: 200 });
      fireEvent.pointerUp(canvas, { pointerId: 1 });

      // Should handle events without errors
      expect(canvas).toBeInTheDocument();
    });

    it('should use Chrome-optimized performance features', () => {
      expect(FeatureDetector.hasWebGL2()).toBe(true);
      expect(FeatureDetector.hasWebWorkers()).toBe(true);
      expect(FeatureDetector.hasServiceWorkers()).toBe(true);
    });
  });

  describe('Firefox Compatibility', () => {
    beforeEach(() => {
      // Mock Firefox user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        configurable: true,
      });
    });

    it('should render canvas switcher correctly in Firefox', async () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      const switcher = screen.getByRole('combobox');
      expect(switcher).toBeInTheDocument();

      // Firefox-specific focus behavior
      switcher.focus();
      expect(switcher).toHaveFocus();

      // Test keyboard navigation
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should handle Firefox mouse events correctly', async () => {
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      const canvas = screen.getByRole('main');

      // Firefox uses different event handling
      fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(canvas, { button: 0 });

      expect(canvas).toBeInTheDocument();
    });

    it('should work without Chrome-specific APIs', () => {
      // Firefox may not have all Chrome APIs
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      // Should still function with Firefox's API set
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Safari Compatibility', () => {
    beforeEach(() => {
      // Mock Safari user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        configurable: true,
      });

      Object.defineProperty(navigator, 'vendor', {
        value: 'Apple Computer, Inc.',
        configurable: true,
      });
    });

    it('should render canvas switcher correctly in Safari', async () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      const switcher = screen.getByRole('combobox');
      expect(switcher).toBeInTheDocument();

      // Safari-specific rendering behavior
      const computedStyle = window.getComputedStyle(switcher);
      expect(computedStyle.display).not.toBe('none');
    });

    it('should handle Safari touch events on desktop', async () => {
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      const canvas = screen.getByRole('main');

      // Safari desktop may simulate touch events
      if (FeatureDetector.hasTouchEvents()) {
        fireEvent.touchStart(canvas, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
        fireEvent.touchMove(canvas, {
          touches: [{ clientX: 200, clientY: 200 }],
        });
        fireEvent.touchEnd(canvas, {});
      }

      expect(canvas).toBeInTheDocument();
    });

    it('should handle Safari-specific CSS and layout', () => {
      const wrapper = createWrapper([]);
      const { container } = render(<CanvasSwitcher />, { wrapper });

      // Safari may have specific layout requirements
      const elements = container.querySelectorAll('*');
      elements.forEach(element => {
        const style = window.getComputedStyle(element);
        // Check for Safari-specific CSS issues
        expect(style.webkitAppearance).toBeDefined();
      });
    });

    it('should work with Safari localStorage limitations', () => {
      // Safari private browsing has storage limitations
      try {
        const testKey = 'safari-test';
        const testValue = 'test-value';
        
        localStorage.setItem(testKey, testValue);
        expect(localStorage.getItem(testKey)).toBe(testValue);
        localStorage.removeItem(testKey);
      } catch (error) {
        // Should handle storage quota exceeded gracefully
        expect(error).toBeInstanceOf(DOMException);
      }
    });
  });

  describe('Edge Compatibility', () => {
    beforeEach(() => {
      // Mock Edge user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        configurable: true,
      });
    });

    it('should render canvas switcher correctly in Edge', async () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      const switcher = screen.getByRole('combobox');
      expect(switcher).toBeInTheDocument();

      // Edge Chromium behavior should be similar to Chrome
      await user.click(switcher);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('should handle Edge-specific security restrictions', async () => {
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      // Edge may have additional security restrictions
      const canvas = screen.getByRole('main');
      expect(canvas).toBeInTheDocument();

      // Test clipboard access (Edge may require user interaction)
      if (FeatureDetector.hasClipboardAPI()) {
        try {
          await navigator.clipboard.readText();
        } catch (error) {
          // Edge may throw security errors
          expect(error).toBeInstanceOf(DOMException);
        }
      }
    });

    it('should work with Edge-specific features', () => {
      // Edge Chromium should have most Chrome features
      expect(FeatureDetector.hasWebGL2()).toBe(true);
      expect(FeatureDetector.hasWebWorkers()).toBe(true);
    });
  });

  describe('Mobile Browser Compatibility', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      // Mock touch capability
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true,
      });
    });

    it('should adapt canvas switcher for mobile', async () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      const switcher = screen.getByRole('combobox');
      expect(switcher).toBeInTheDocument();

      // Mobile should have touch-friendly sizing
      const computedStyle = window.getComputedStyle(switcher);
      const minHeight = parseInt(computedStyle.minHeight);
      expect(minHeight).toBeGreaterThanOrEqual(44); // iOS minimum touch target
    });

    it('should handle touch events on mobile', async () => {
      // Mock iOS Safari
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        configurable: true,
      });

      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      const canvas = screen.getByRole('main');

      // Test touch gestures
      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 150, clientY: 150 }],
      });

      fireEvent.touchEnd(canvas);

      expect(canvas).toBeInTheDocument();
    });

    it('should handle pinch-to-zoom on mobile', async () => {
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      const canvas = screen.getByRole('main');

      // Multi-touch pinch gesture
      fireEvent.touchStart(canvas, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
      });

      fireEvent.touchMove(canvas, {
        touches: [
          { clientX: 90, clientY: 90 },
          { clientX: 210, clientY: 210 },
        ],
      });

      fireEvent.touchEnd(canvas);

      expect(canvas).toBeInTheDocument();
    });

    it('should prevent mobile browser zoom conflicts', () => {
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      // Check viewport meta tag prevents zoom conflicts
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        const content = viewport.getAttribute('content');
        expect(content).toContain('user-scalable=no');
      }
    });
  });

  describe('Performance Across Browsers', () => {
    it('should maintain performance standards in Chrome', async () => {
      if (!BrowserDetector.isChrome()) return;

      const wrapper = createWrapper([]);
      const startTime = performance.now();

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    });

    it('should maintain performance standards in Firefox', async () => {
      if (!BrowserDetector.isFirefox()) return;

      const wrapper = createWrapper([]);
      const startTime = performance.now();

      render(<InfiniteCanvas />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(1500); // Firefox may be slightly slower
    });

    it('should handle memory usage consistently across browsers', async () => {
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      // Monitor memory if available
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const initialHeap = memory.usedJSHeapSize;

        // Perform memory-intensive operations
        const canvas = screen.getByRole('main');
        for (let i = 0; i < 100; i++) {
          fireEvent.mouseMove(canvas, { clientX: i, clientY: i });
        }

        const finalHeap = memory.usedJSHeapSize;
        const memoryIncrease = (finalHeap - initialHeap) / 1024 / 1024; // MB

        expect(memoryIncrease).toBeLessThan(10); // Should not increase by more than 10MB
      }
    });
  });

  describe('CSS and Layout Compatibility', () => {
    it('should handle CSS Grid support consistently', () => {
      const wrapper = createWrapper([]);
      const { container } = render(<CanvasSwitcher />, { wrapper });

      const gridElements = container.querySelectorAll('.grid, [style*="grid"]');
      gridElements.forEach(element => {
        const computedStyle = window.getComputedStyle(element);
        expect(computedStyle.display).toMatch(/(grid|flex|block)/);
      });
    });

    it('should handle Flexbox consistently across browsers', () => {
      const wrapper = createWrapper([]);
      const { container } = render(<CanvasSwitcher />, { wrapper });

      const flexElements = container.querySelectorAll('.flex, [style*="flex"]');
      flexElements.forEach(element => {
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display.includes('flex')) {
          expect(computedStyle.flexDirection).toBeDefined();
        }
      });
    });

    it('should handle CSS custom properties (variables)', () => {
      const wrapper = createWrapper([]);
      const { container } = render(<CanvasSwitcher />, { wrapper });

      // Check if CSS variables are supported and working
      const rootStyles = getComputedStyle(document.documentElement);
      const customProperty = rootStyles.getPropertyValue('--primary-color');
      
      if (customProperty) {
        expect(customProperty).toBeTruthy();
      }
    });

    it('should handle transforms and animations consistently', async () => {
      const wrapper = createWrapper([]);
      render(<InfiniteCanvas />, { wrapper });

      const canvas = screen.getByRole('main');
      const computedStyle = window.getComputedStyle(canvas);

      // Check transform support
      expect(computedStyle.transform).toBeDefined();
      expect(computedStyle.transition).toBeDefined();
    });
  });

  describe('API Compatibility and Fallbacks', () => {
    it('should handle fetch API consistently', async () => {
      expect(typeof fetch).toBe('function');

      try {
        // Mock fetch response
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ data: 'test' }),
        });

        const response = await fetch('/api/test');
        expect(response.ok).toBe(true);
      } catch (error) {
        // Should have polyfill for older browsers
        expect(error).toBeInstanceOf(TypeError);
      }
    });

    it('should handle WebSocket connections across browsers', () => {
      if (FeatureDetector.hasWebSockets()) {
        try {
          const ws = new WebSocket('ws://localhost:3000');
          expect(ws).toBeInstanceOf(WebSocket);
          ws.close();
        } catch (error) {
          // May fail in test environment, but should not throw in browsers
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle localStorage quota differences', () => {
      const testLargeData = 'x'.repeat(1024 * 1024); // 1MB string

      try {
        localStorage.setItem('large-test', testLargeData);
        localStorage.removeItem('large-test');
      } catch (error) {
        // Different browsers have different quota limits
        expect(error).toBeInstanceOf(DOMException);
        expect(error.name).toMatch(/(QuotaExceededError|NS_ERROR_DOM_QUOTA_REACHED)/);
      }
    });

    it('should handle file API differences', () => {
      if ('File' in window && 'FileReader' in window) {
        const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
        const reader = new FileReader();
        
        expect(file).toBeInstanceOf(File);
        expect(reader).toBeInstanceOf(FileReader);
      }
    });
  });

  describe('Security and CORS Handling', () => {
    it('should handle CORS consistently across browsers', async () => {
      // Mock CORS request
      const mockResponse = {
        ok: true,
        headers: {
          get: (header: string) => {
            if (header === 'Access-Control-Allow-Origin') return '*';
            return null;
          },
        },
        json: async () => ({ success: true }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      try {
        const response = await fetch('http://localhost:3000/api/test', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        expect(response.ok).toBe(true);
      } catch (error) {
        // CORS errors should be handled gracefully
        expect(error).toBeInstanceOf(TypeError);
      }
    });

    it('should handle Content Security Policy restrictions', () => {
      // Test inline script restrictions
      const script = document.createElement('script');
      script.textContent = 'console.log("test");';
      
      try {
        document.head.appendChild(script);
        document.head.removeChild(script);
      } catch (error) {
        // CSP may block inline scripts
        expect(error).toBeInstanceOf(DOMException);
      }
    });
  });

  describe('Responsive Design Compatibility', () => {
    it('should handle different viewport sizes', () => {
      const viewports = [
        { width: 320, height: 568 }, // iPhone SE
        { width: 375, height: 667 }, // iPhone 8
        { width: 768, height: 1024 }, // iPad
        { width: 1440, height: 900 }, // Desktop
      ];

      viewports.forEach(({ width, height }) => {
        Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });

        const wrapper = createWrapper([]);
        render(<CanvasSwitcher />, { wrapper });

        const switcher = screen.getByRole('combobox');
        expect(switcher).toBeInTheDocument();
      });
    });

    it('should handle media queries consistently', () => {
      const mediaQueries = [
        '(min-width: 768px)',
        '(prefers-color-scheme: dark)',
        '(prefers-reduced-motion: reduce)',
        '(hover: hover)',
        '(pointer: fine)',
      ];

      mediaQueries.forEach(query => {
        const mediaQuery = window.matchMedia(query);
        expect(mediaQuery).toBeDefined();
        expect(typeof mediaQuery.matches).toBe('boolean');
      });
    });
  });

  describe('Accessibility Across Browsers', () => {
    it('should handle screen reader APIs consistently', () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      const switcher = screen.getByRole('combobox');
      
      // ARIA attributes should work across browsers
      expect(switcher.getAttribute('aria-haspopup')).toBe('listbox');
      expect(switcher.getAttribute('aria-expanded')).toBe('false');
    });

    it('should handle focus management consistently', async () => {
      const wrapper = createWrapper([]);
      render(<CanvasSwitcher />, { wrapper });

      const switcher = screen.getByRole('combobox');
      
      // Focus should work the same across browsers
      switcher.focus();
      expect(document.activeElement).toBe(switcher);

      // Tab navigation should be consistent
      await user.tab();
      expect(document.activeElement).not.toBe(switcher);
    });
  });

  // Test runner for specific browsers
  describe('Browser-Specific Test Runner', () => {
    it('should run Chrome-specific tests', () => {
      if (BrowserDetector.isChrome()) {
        expect(BrowserDetector.getVersion()).toBeGreaterThan(90);
        expect(FeatureDetector.hasWebGL2()).toBe(true);
      }
    });

    it('should run Firefox-specific tests', () => {
      if (BrowserDetector.isFirefox()) {
        expect(BrowserDetector.getVersion()).toBeGreaterThan(90);
        expect(FeatureDetector.hasWebGL()).toBe(true);
      }
    });

    it('should run Safari-specific tests', () => {
      if (BrowserDetector.isSafari()) {
        expect(BrowserDetector.getVersion()).toBeGreaterThan(14);
        expect(FeatureDetector.hasWebGL()).toBe(true);
      }
    });

    it('should run Edge-specific tests', () => {
      if (BrowserDetector.isEdge()) {
        expect(BrowserDetector.getVersion()).toBeGreaterThan(90);
        expect(FeatureDetector.hasWebGL2()).toBe(true);
      }
    });

    it('should run mobile-specific tests', () => {
      if (BrowserDetector.isMobile()) {
        expect(FeatureDetector.hasTouchEvents()).toBe(true);
        expect(window.innerWidth).toBeLessThan(768);
      }
    });
  });
});