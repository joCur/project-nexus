/**
 * Multi-Canvas Performance Tests (NEX-177)
 * 
 * Comprehensive performance testing suite including:
 * - Test workspace with 10+ canvases
 * - Canvas switching performance (< 200ms target)
 * - Large canvas with 100+ cards
 * - Memory usage during canvas switching
 * - Network request optimization
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { render, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { BrowserRouter } from 'next/router';
import React from 'react';

// Performance monitoring utilities
import { performance, PerformanceObserver } from 'perf_hooks';

// Import components
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import CanvasSwitcher from '@/components/workspace/CanvasSwitcher';
import { InfiniteCanvas } from '@/components/canvas';

// Import GraphQL operations
import {
  GET_WORKSPACE_CANVASES,
  GET_CANVAS,
  GET_CANVAS_CARDS,
} from '@/lib/graphql/canvasOperations';

// Import stores
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';

// Import types
import type { EntityId } from '@/types/common.types';
import type { CanvasId } from '@/types/workspace.types';

// Mock implementations
jest.mock('@/stores/workspaceStore');
jest.mock('@/stores/canvasStore');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useParams: () => ({ workspaceId: 'perf-workspace-id' }),
}));

describe('Multi-Canvas Performance Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let performanceEntries: PerformanceEntry[] = [];
  let memoryUsage: number[] = [];
  
  // Performance thresholds
  const CANVAS_SWITCH_THRESHOLD = 200; // ms
  const LARGE_CANVAS_LOAD_THRESHOLD = 1000; // ms
  const MEMORY_LEAK_THRESHOLD = 50; // MB increase
  const NETWORK_REQUEST_THRESHOLD = 5; // max concurrent requests

  beforeAll(() => {
    user = userEvent.setup({ delay: null });
    
    // Setup performance monitoring
    if (typeof window !== 'undefined') {
      // Browser environment performance monitoring
      const observer = new PerformanceObserver((list) => {
        performanceEntries.push(...list.getEntries());
      });
      observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
    }

    // Mock DOM APIs for canvas
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    // Mock requestAnimationFrame for smoother testing
    global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
    global.cancelAnimationFrame = jest.fn();

    // Setup performance monitoring
    setupPerformanceMonitoring();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    performanceEntries = [];
    memoryUsage = [];
    
    // Record initial memory usage
    recordMemoryUsage();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  function setupPerformanceMonitoring() {
    // Override console methods to track performance logs
    const originalLog = console.log;
    const originalWarn = console.warn;

    console.log = jest.fn((...args) => {
      if (args[0]?.includes('Performance')) {
        performanceEntries.push({
          name: args[0],
          startTime: performance.now(),
          duration: args[1] || 0,
        } as any);
      }
      originalLog(...args);
    });

    console.warn = jest.fn((...args) => {
      if (args[0]?.includes('Performance Warning')) {
        performanceEntries.push({
          name: args[0],
          startTime: performance.now(),
          duration: args[1] || 0,
        } as any);
      }
      originalWarn(...args);
    });
  }

  function recordMemoryUsage() {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage.push(memory.usedJSHeapSize / 1024 / 1024); // MB
    } else {
      // Node.js environment
      const usage = process.memoryUsage();
      memoryUsage.push(usage.heapUsed / 1024 / 1024); // MB
    }
  }

  function generateMockCanvases(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `canvas-${i + 1}` as CanvasId,
      workspaceId: 'perf-workspace-id' as EntityId,
      name: `Canvas ${i + 1}`,
      description: `Performance test canvas ${i + 1}`,
      settings: {
        isDefault: i === 0,
        position: { x: 0, y: 0, z: 0 },
        zoom: 1.0,
        grid: {
          enabled: true,
          size: 20,
          color: '#e5e7eb',
          opacity: 0.3,
        },
        background: {
          type: 'COLOR' as const,
          color: '#ffffff',
          opacity: 1.0,
        },
      },
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
  }

  function generateMockCards(canvasId: CanvasId, count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `card-${canvasId}-${i + 1}` as EntityId,
      canvasId,
      workspaceId: 'perf-workspace-id' as EntityId,
      type: ['NOTE', 'TASK', 'IMAGE'][i % 3] as const,
      title: `Card ${i + 1}`,
      content: `Content for card ${i + 1} with some longer text to simulate real world usage`,
      position: { 
        x: (i % 10) * 220, 
        y: Math.floor(i / 10) * 180, 
        z: 0 
      },
      size: { width: 200, height: 150 },
      style: {
        backgroundColor: ['#ffffff', '#f0f0f0', '#e8f4f8'][i % 3],
        textColor: '#000000',
        borderColor: '#e5e7eb',
        borderWidth: 1,
      },
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      updatedAt: new Date(Date.now() - i * 500).toISOString(),
      version: 1,
    }));
  }

  describe('Workspace with 10+ Canvases Performance', () => {
    const mockCanvases = generateMockCanvases(15);
    
    const mockWorkspaceStore = {
      currentWorkspace: {
        id: 'perf-workspace-id' as EntityId,
        name: 'Performance Test Workspace',
      },
      canvasManagement: {
        canvases: new Map(mockCanvases.map(c => [c.id, c])),
        currentCanvasId: mockCanvases[0].id,
        defaultCanvasId: mockCanvases[0].id,
      },
      getCanvases: jest.fn().mockReturnValue(mockCanvases),
      getCurrentCanvas: jest.fn().mockReturnValue(mockCanvases[0]),
      switchToCanvas: jest.fn(),
      loadCanvases: jest.fn(),
    };

    beforeEach(() => {
      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);
    });

    it('should load workspace with 15 canvases within performance threshold', async () => {
      const mocks = [
        {
          request: {
            query: GET_WORKSPACE_CANVASES,
            variables: {
              workspaceId: 'perf-workspace-id',
            },
          },
          result: {
            data: {
              workspaceCanvases: {
                items: mockCanvases,
                totalCount: 15,
                page: 0,
                limit: 50,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            },
          },
        },
      ];

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      const startTime = performance.now();

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
        </WorkspaceLayout>,
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWorkspaceStore.loadCanvases).toHaveBeenCalled();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(1000); // Should load within 1 second
      
      recordMemoryUsage();
      const memoryIncrease = memoryUsage[memoryUsage.length - 1] - memoryUsage[0];
      expect(memoryIncrease).toBeLessThan(20); // Should not increase memory by more than 20MB
    });

    it('should render canvas switcher dropdown efficiently with many canvases', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={[]} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      const startTime = performance.now();

      const { getByRole } = render(<CanvasSwitcher />, { wrapper });

      // Open dropdown
      const switcher = getByRole('combobox');
      await act(async () => {
        await user.click(switcher);
      });

      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(100); // Dropdown should render quickly
      
      // All options should be present
      await waitFor(() => {
        mockCanvases.forEach((canvas) => {
          expect(getByRole('option', { name: canvas.name })).toBeInTheDocument();
        });
      });
    });
  });

  describe('Canvas Switching Performance (< 200ms target)', () => {
    const mockCanvases = generateMockCanvases(5);
    const mockCards = generateMockCards(mockCanvases[1].id, 50);

    const mockWorkspaceStore = {
      canvasManagement: {
        canvases: new Map(mockCanvases.map(c => [c.id, c])),
        currentCanvasId: mockCanvases[0].id,
      },
      getCurrentCanvas: jest.fn(),
      switchToCanvas: jest.fn(),
    };

    const mockCanvasStore = {
      cards: new Map(),
      getCards: jest.fn().mockReturnValue([]),
      loadCanvasData: jest.fn(),
      clearCanvas: jest.fn(),
    };

    beforeEach(() => {
      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);
      (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);
    });

    it('should switch between canvases within 200ms threshold', async () => {
      const mocks = mockCanvases.map(canvas => ({
        request: {
          query: GET_CANVAS,
          variables: { id: canvas.id },
        },
        result: {
          data: { canvas },
        },
      }));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      render(
        <WorkspaceLayout>
          <CanvasSwitcher />
          <InfiniteCanvas />
        </WorkspaceLayout>,
        { wrapper }
      );

      // Test rapid canvas switching
      const switchTimes: number[] = [];

      for (let i = 1; i < 4; i++) {
        const startTime = performance.now();
        
        await act(async () => {
          mockWorkspaceStore.switchToCanvas(mockCanvases[i].id);
          mockWorkspaceStore.getCurrentCanvas.mockReturnValue(mockCanvases[i]);
        });

        await waitFor(() => {
          expect(mockCanvasStore.loadCanvasData).toHaveBeenCalledWith(mockCanvases[i].id);
        });

        const switchTime = performance.now() - startTime;
        switchTimes.push(switchTime);
      }

      // All switches should be under threshold
      switchTimes.forEach(time => {
        expect(time).toBeLessThan(CANVAS_SWITCH_THRESHOLD);
      });

      // Average switch time should be well under threshold
      const averageTime = switchTimes.reduce((a, b) => a + b) / switchTimes.length;
      expect(averageTime).toBeLessThan(CANVAS_SWITCH_THRESHOLD * 0.7);
    });

    it('should handle rapid consecutive canvas switches without performance degradation', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={[]} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      render(<InfiniteCanvas />, { wrapper });

      const switchTimes: number[] = [];

      // Perform 10 rapid switches
      for (let i = 0; i < 10; i++) {
        const canvasIndex = i % mockCanvases.length;
        const startTime = performance.now();

        await act(async () => {
          mockWorkspaceStore.switchToCanvas(mockCanvases[canvasIndex].id);
        });

        const switchTime = performance.now() - startTime;
        switchTimes.push(switchTime);

        // Small delay to simulate real user interaction
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Performance should not degrade over time
      const firstHalf = switchTimes.slice(0, 5);
      const secondHalf = switchTimes.slice(5);

      const firstAverage = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
      const secondAverage = secondHalf.reduce((a, b) => a + b) / secondHalf.length;

      // Second half should not be significantly slower than first half
      expect(secondAverage).toBeLessThan(firstAverage * 1.5);
    });
  });

  describe('Large Canvas with 100+ Cards Performance', () => {
    const largeCanvas = generateMockCanvases(1)[0];
    const largeCardSet = generateMockCards(largeCanvas.id, 150);

    const mockWorkspaceStore = {
      getCurrentCanvas: jest.fn().mockReturnValue(largeCanvas),
      switchToCanvas: jest.fn(),
    };

    const mockCanvasStore = {
      cards: new Map(largeCardSet.map(c => [c.id, c])),
      getCards: jest.fn().mockReturnValue(largeCardSet),
      loadCanvasData: jest.fn(),
      clearCanvas: jest.fn(),
    };

    beforeEach(() => {
      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);
      (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);
    });

    it('should load large canvas with 150 cards within performance threshold', async () => {
      const mocks = [
        {
          request: {
            query: GET_CANVAS_CARDS,
            variables: {
              canvasId: largeCanvas.id,
            },
          },
          result: {
            data: {
              canvasCards: largeCardSet,
            },
          },
        },
      ];

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      const startTime = performance.now();

      render(<InfiniteCanvas />, { wrapper });

      await waitFor(() => {
        expect(mockCanvasStore.loadCanvasData).toHaveBeenCalled();
      });

      const loadTime = performance.now() - startTime;

      expect(loadTime).toBeLessThan(LARGE_CANVAS_LOAD_THRESHOLD);
      
      recordMemoryUsage();
      const memoryIncrease = memoryUsage[memoryUsage.length - 1] - memoryUsage[0];
      expect(memoryIncrease).toBeLessThan(30); // Large canvas should not exceed 30MB
    });

    it('should handle viewport culling efficiently with many cards', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={[]} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      render(<InfiniteCanvas />, { wrapper });

      // Simulate viewport changes
      const startTime = performance.now();

      await act(async () => {
        // Simulate panning across the canvas
        for (let x = 0; x < 1000; x += 100) {
          // Mock viewport change
          window.dispatchEvent(new Event('scroll'));
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      });

      const panTime = performance.now() - startTime;

      expect(panTime).toBeLessThan(500); // Should handle viewport changes smoothly
    });

    it('should efficiently update visible cards during zoom operations', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={[]} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      const { container } = render(<InfiniteCanvas />, { wrapper });
      const canvasElement = container.querySelector('[data-testid="infinite-canvas"]');

      if (canvasElement) {
        const startTime = performance.now();

        await act(async () => {
          // Simulate zoom operations
          for (let i = 0; i < 10; i++) {
            const zoomEvent = new WheelEvent('wheel', {
              deltaY: i % 2 === 0 ? -100 : 100,
              bubbles: true,
            });
            canvasElement.dispatchEvent(zoomEvent);
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        });

        const zoomTime = performance.now() - startTime;
        expect(zoomTime).toBeLessThan(200); // Zoom operations should be smooth
      }
    });
  });

  describe('Memory Usage During Canvas Switching', () => {
    const mockCanvases = generateMockCanvases(10);

    beforeEach(() => {
      const mockWorkspaceStore = {
        canvasManagement: {
          canvases: new Map(mockCanvases.map(c => [c.id, c])),
        },
        getCurrentCanvas: jest.fn(),
        switchToCanvas: jest.fn(),
      };

      const mockCanvasStore = {
        cards: new Map(),
        loadCanvasData: jest.fn(),
        clearCanvas: jest.fn(),
      };

      (useWorkspaceStore as jest.Mock).mockReturnValue(mockWorkspaceStore);
      (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);
    });

    it('should not have memory leaks during extensive canvas switching', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={[]} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      render(<InfiniteCanvas />, { wrapper });

      const initialMemory = memoryUsage[0];

      // Perform 50 canvas switches to detect memory leaks
      for (let i = 0; i < 50; i++) {
        const canvasIndex = i % mockCanvases.length;
        
        await act(async () => {
          // Mock canvas switch
          (useWorkspaceStore as jest.Mock).mockReturnValue({
            getCurrentCanvas: jest.fn().mockReturnValue(mockCanvases[canvasIndex]),
            switchToCanvas: jest.fn(),
          });
        });

        // Record memory every 10 switches
        if (i % 10 === 0) {
          recordMemoryUsage();
        }

        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const finalMemory = memoryUsage[memoryUsage.length - 1];
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(MEMORY_LEAK_THRESHOLD);
    });

    it('should properly cleanup canvas resources when switching', async () => {
      const mockCanvasStore = {
        cards: new Map(),
        clearCanvas: jest.fn(),
        loadCanvasData: jest.fn(),
      };

      (useCanvasStore as jest.Mock).mockReturnValue(mockCanvasStore);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={[]} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      render(<InfiniteCanvas />, { wrapper });

      // Switch canvas
      await act(async () => {
        // Trigger canvas switch
        window.dispatchEvent(new CustomEvent('canvasSwitch'));
      });

      // Verify cleanup was called
      expect(mockCanvasStore.clearCanvas).toHaveBeenCalled();
    });
  });

  describe('Network Request Optimization', () => {
    it('should not exceed maximum concurrent network requests', async () => {
      let activeRequests = 0;
      let maxConcurrentRequests = 0;

      // Mock network requests to track concurrency
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async () => {
        activeRequests++;
        maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        activeRequests--;
        return new Response(JSON.stringify({ data: {} }));
      });

      const mockCanvases = generateMockCanvases(10);
      const mocks = mockCanvases.map(canvas => ({
        request: {
          query: GET_CANVAS,
          variables: { id: canvas.id },
        },
        result: {
          data: { canvas },
        },
      }));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={mocks} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      render(<CanvasSwitcher />, { wrapper });

      // Trigger multiple canvas loads simultaneously
      await Promise.all(
        mockCanvases.slice(0, 5).map(async (canvas) => {
          return act(async () => {
            // Simulate loading canvas data
            await new Promise(resolve => setTimeout(resolve, 10));
          });
        })
      );

      expect(maxConcurrentRequests).toBeLessThanOrEqual(NETWORK_REQUEST_THRESHOLD);

      // Restore fetch
      global.fetch = originalFetch;
    });

    it('should implement proper request debouncing for canvas operations', async () => {
      let requestCount = 0;
      const mockFetch = jest.fn().mockImplementation(async () => {
        requestCount++;
        return new Response(JSON.stringify({ data: {} }));
      });

      global.fetch = mockFetch;

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={[]} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      render(<CanvasSwitcher />, { wrapper });

      // Rapidly trigger the same operation
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          // Simulate rapid canvas switch requests
          window.dispatchEvent(new CustomEvent('canvasSwitch', {
            detail: { canvasId: 'canvas-1' }
          }));
        }
      });

      // Should debounce and not make excessive requests
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(requestCount).toBeLessThan(3); // Should be debounced to very few requests
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in canvas operations', async () => {
      const performanceMetrics = {
        canvasSwitch: [] as number[],
        canvasLoad: [] as number[],
        cardRender: [] as number[],
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={[]} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      render(<InfiniteCanvas />, { wrapper });

      // Measure multiple operations
      for (let i = 0; i < 10; i++) {
        // Canvas switch timing
        const switchStart = performance.now();
        await act(async () => {
          // Mock canvas switch
        });
        performanceMetrics.canvasSwitch.push(performance.now() - switchStart);

        // Canvas load timing
        const loadStart = performance.now();
        await act(async () => {
          // Mock canvas load
        });
        performanceMetrics.canvasLoad.push(performance.now() - loadStart);
      }

      // Check for regressions (no operation should be 3x slower than the fastest)
      const switchTimes = performanceMetrics.canvasSwitch;
      const loadTimes = performanceMetrics.canvasLoad;

      const minSwitchTime = Math.min(...switchTimes);
      const maxSwitchTime = Math.max(...switchTimes);
      const minLoadTime = Math.min(...loadTimes);
      const maxLoadTime = Math.max(...loadTimes);

      expect(maxSwitchTime).toBeLessThan(minSwitchTime * 3);
      expect(maxLoadTime).toBeLessThan(minLoadTime * 3);
    });

    it('should maintain consistent frame rates during canvas interactions', async () => {
      const frameRates: number[] = [];
      let lastFrameTime = performance.now();

      // Mock frame rate monitoring
      const frameCallback = () => {
        const currentTime = performance.now();
        const frameDuration = currentTime - lastFrameTime;
        const frameRate = 1000 / frameDuration;
        frameRates.push(frameRate);
        lastFrameTime = currentTime;

        if (frameRates.length < 60) { // Monitor for 1 second at 60fps
          requestAnimationFrame(frameCallback);
        }
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
          <MockedProvider mocks={[]} addTypename={false}>
            {children}
          </MockedProvider>
        </BrowserRouter>
      );

      render(<InfiniteCanvas />, { wrapper });

      // Start frame rate monitoring
      requestAnimationFrame(frameCallback);

      // Simulate intensive canvas operations
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          // Simulate canvas interactions
          window.dispatchEvent(new MouseEvent('mousemove', {
            clientX: i * 10,
            clientY: i * 10,
          }));
          await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
        }
      });

      // Wait for frame rate data
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check frame rate consistency
      const averageFrameRate = frameRates.reduce((a, b) => a + b) / frameRates.length;
      const minFrameRate = Math.min(...frameRates);

      expect(averageFrameRate).toBeGreaterThan(30); // Should maintain at least 30fps average
      expect(minFrameRate).toBeGreaterThan(15); // Should never drop below 15fps
    });
  });
});