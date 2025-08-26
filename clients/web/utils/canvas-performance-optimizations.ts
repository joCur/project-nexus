/**
 * Canvas Performance Optimizations (NEX-177)
 * 
 * Performance optimizations based on test results including:
 * - Canvas state caching
 * - GraphQL query optimization
 * - Loading state improvements
 * - Bundle optimization utilities
 * - Memory management
 * - Viewport culling
 */

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { debounce, throttle } from 'lodash-es';
import type { CanvasId } from '@/types/workspace.types';
import type { EntityId } from '@/types/common.types';

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTracking(metricName: string): string {
    const markName = `${metricName}-start`;
    performance.mark(markName);
    return markName;
  }

  endTracking(metricName: string, startMark?: string): number {
    const endMark = `${metricName}-end`;
    const measureName = `${metricName}-measure`;
    
    performance.mark(endMark);
    
    if (startMark) {
      performance.measure(measureName, startMark, endMark);
    } else {
      performance.measure(measureName, `${metricName}-start`, endMark);
    }

    const measure = performance.getEntriesByName(measureName)[0];
    const duration = measure?.duration || 0;

    // Store metric
    const existing = this.metrics.get(metricName) || [];
    existing.push(duration);
    
    // Keep only last 100 measurements
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.metrics.set(metricName, existing);

    // Clean up marks and measures
    performance.clearMarks(startMark || `${metricName}-start`);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);

    return duration;
  }

  getAverageMetric(metricName: string): number {
    const values = this.metrics.get(metricName) || [];
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  getMetricPercentile(metricName: string, percentile: number): number {
    const values = this.metrics.get(metricName) || [];
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[Math.min(index, sorted.length - 1)];
  }

  logMetrics(): void {
    console.group('Performance Metrics');
    this.metrics.forEach((values, name) => {
      const avg = this.getAverageMetric(name);
      const p95 = this.getMetricPercentile(name, 95);
      const p99 = this.getMetricPercentile(name, 99);
      console.log(`${name}: avg=${avg.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, p99=${p99.toFixed(2)}ms`);
    });
    console.groupEnd();
  }

  setupObservers(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Long tasks observer
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) {
            console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
          }
        });
      });
      
      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        // Long tasks may not be supported
      }

      // Layout shift observer
      const layoutShiftObserver = new PerformanceObserver((list) => {
        let totalShift = 0;
        list.getEntries().forEach((entry: any) => {
          if (entry.hadRecentInput) return;
          totalShift += entry.value;
        });
        
        if (totalShift > 0.1) {
          console.warn(`Cumulative Layout Shift: ${totalShift.toFixed(4)}`);
        }
      });

      try {
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);
      } catch (e) {
        // Layout shift may not be supported
      }
    }
  }

  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// Canvas state caching system
export class CanvasStateCache {
  private cache: Map<string, any> = new Map();
  private timestamps: Map<string, number> = new Map();
  private maxAge: number = 5 * 60 * 1000; // 5 minutes
  private maxSize: number = 50;

  set(key: string, value: any): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.getOldestKey();
      if (oldestKey) {
        this.delete(oldestKey);
      }
    }

    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
  }

  get(key: string): any | null {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.maxAge) {
      this.delete(key);
      return null;
    }

    return this.cache.get(key) || null;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }

  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.timestamps.forEach((time, key) => {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    });

    return oldestKey;
  }

  // Generate cache key for canvas state
  generateCanvasKey(canvasId: CanvasId, zoom: number, viewport: { x: number; y: number }): string {
    return `canvas:${canvasId}:${Math.round(zoom * 100)}:${Math.round(viewport.x / 100)}:${Math.round(viewport.y / 100)}`;
  }

  // Generate cache key for card queries
  generateCardKey(canvasId: CanvasId, filters?: any): string {
    const filterHash = filters ? JSON.stringify(filters) : '';
    return `cards:${canvasId}:${btoa(filterHash)}`;
  }
}

// Viewport culling optimization
export class ViewportCuller {
  private visibleItems: Set<string> = new Set();
  private viewportBounds: DOMRect | null = null;
  private buffer: number = 100; // Pixels to expand viewport for pre-loading

  updateViewport(bounds: DOMRect): void {
    this.viewportBounds = {
      ...bounds,
      x: bounds.x - this.buffer,
      y: bounds.y - this.buffer,
      width: bounds.width + this.buffer * 2,
      height: bounds.height + this.buffer * 2,
    } as DOMRect;
  }

  isItemVisible(itemBounds: DOMRect): boolean {
    if (!this.viewportBounds) return true;

    return !(
      itemBounds.right < this.viewportBounds.left ||
      itemBounds.left > this.viewportBounds.right ||
      itemBounds.bottom < this.viewportBounds.top ||
      itemBounds.top > this.viewportBounds.bottom
    );
  }

  updateVisibleItems(items: Array<{ id: string; bounds: DOMRect }>): Set<string> {
    const newVisible = new Set<string>();

    items.forEach(item => {
      if (this.isItemVisible(item.bounds)) {
        newVisible.add(item.id);
      }
    });

    this.visibleItems = newVisible;
    return newVisible;
  }

  getVisibleItems(): Set<string> {
    return this.visibleItems;
  }
}

// GraphQL query optimization
export class QueryOptimizer {
  private queryCache: Map<string, { data: any; timestamp: number }> = new Map();
  private pendingQueries: Map<string, Promise<any>> = new Map();
  private cacheTTL: number = 30 * 1000; // 30 seconds

  // Deduplicate identical queries
  async deduplicateQuery<T>(queryKey: string, queryFn: () => Promise<T>): Promise<T> {
    // Check cache first
    const cached = this.queryCache.get(queryKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // Check if query is already pending
    const pending = this.pendingQueries.get(queryKey);
    if (pending) {
      return pending;
    }

    // Execute query
    const queryPromise = queryFn().then(data => {
      this.queryCache.set(queryKey, { data, timestamp: Date.now() });
      this.pendingQueries.delete(queryKey);
      return data;
    }).catch(error => {
      this.pendingQueries.delete(queryKey);
      throw error;
    });

    this.pendingQueries.set(queryKey, queryPromise);
    return queryPromise;
  }

  // Batch multiple queries together
  batchQueries<T>(queries: Array<{ key: string; fn: () => Promise<T> }>): Promise<T[]> {
    return Promise.all(queries.map(query => this.deduplicateQuery(query.key, query.fn)));
  }

  // Generate query key from variables
  generateQueryKey(operationName: string, variables: any): string {
    const variableHash = JSON.stringify(variables, Object.keys(variables).sort());
    return `${operationName}:${btoa(variableHash)}`;
  }

  clearCache(): void {
    this.queryCache.clear();
    this.pendingQueries.clear();
  }
}

// Memory management utilities
export class MemoryManager {
  private static instance: MemoryManager;
  private memoryThreshold: number = 100 * 1024 * 1024; // 100MB

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  getCurrentMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  isMemoryPressure(): boolean {
    const usage = this.getCurrentMemoryUsage();
    return usage > this.memoryThreshold;
  }

  // Force garbage collection if available
  forceGC(): void {
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    }
  }

  // Clean up unused references
  cleanupReferences(refs: WeakRef<any>[]): WeakRef<any>[] {
    return refs.filter(ref => ref.deref() !== undefined);
  }
}

// Performance hooks
export const useCanvasPerformance = (canvasId: CanvasId) => {
  const monitor = PerformanceMonitor.getInstance();
  const cache = useRef(new CanvasStateCache());
  const culler = useRef(new ViewportCuller());

  // Debounced state saving
  const saveCanvasState = useCallback(
    debounce((state: any) => {
      const key = cache.current.generateCanvasKey(
        canvasId,
        state.zoom,
        state.viewport
      );
      cache.current.set(key, state);
    }, 500),
    [canvasId]
  );

  // Throttled viewport updates
  const updateViewport = useCallback(
    throttle((bounds: DOMRect) => {
      culler.current.updateViewport(bounds);
    }, 16), // ~60fps
    []
  );

  // Memoized visible items calculation
  const getVisibleItems = useCallback((items: Array<{ id: string; bounds: DOMRect }>) => {
    return culler.current.updateVisibleItems(items);
  }, []);

  // Performance tracking
  const trackCanvasOperation = useCallback((operation: string) => {
    return {
      start: () => monitor.startTracking(`canvas-${operation}`),
      end: (startMark?: string) => monitor.endTracking(`canvas-${operation}`, startMark),
    };
  }, [monitor]);

  return {
    cache: cache.current,
    culler: culler.current,
    saveCanvasState,
    updateViewport,
    getVisibleItems,
    trackCanvasOperation,
  };
};

export const useQueryOptimization = () => {
  const optimizer = useRef(new QueryOptimizer());

  const optimizedQuery = useCallback(async <T>(
    operationName: string,
    variables: any,
    queryFn: () => Promise<T>
  ): Promise<T> => {
    const queryKey = optimizer.current.generateQueryKey(operationName, variables);
    return optimizer.current.deduplicateQuery(queryKey, queryFn);
  }, []);

  const batchQueries = useCallback(<T>(
    queries: Array<{ operationName: string; variables: any; fn: () => Promise<T> }>
  ): Promise<T[]> => {
    const batchedQueries = queries.map(q => ({
      key: optimizer.current.generateQueryKey(q.operationName, q.variables),
      fn: q.fn,
    }));
    return optimizer.current.batchQueries(batchedQueries);
  }, []);

  return {
    optimizedQuery,
    batchQueries,
    clearCache: () => optimizer.current.clearCache(),
  };
};

// Bundle optimization utilities
export const lazyLoadComponent = (importFn: () => Promise<any>) => {
  return React.lazy(() => {
    return importFn().catch(() => {
      // Fallback for failed imports
      return { default: () => React.createElement('div', null, 'Component failed to load') };
    });
  });
};

// Memory-efficient event handling
export const useMemoryEfficientEventHandler = <T extends Event>(
  handler: (event: T) => void,
  dependencies: React.DependencyList
) => {
  const handlerRef = useRef<(event: T) => void>();
  
  useEffect(() => {
    handlerRef.current = handler;
  });

  return useCallback((event: T) => {
    handlerRef.current?.(event);
  }, dependencies);
};

// Optimized intersection observer
export const useOptimizedIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) => {
  const observer = useRef<IntersectionObserver>();

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    observer.current = new IntersectionObserver(callback, {
      rootMargin: '100px', // Pre-load items before they're visible
      threshold: [0, 0.25, 0.5, 0.75, 1], // Multiple thresholds for smooth transitions
      ...options,
    });

    return () => {
      observer.current?.disconnect();
    };
  }, [callback, options]);

  return observer.current;
};

// Resource preloading
export const preloadResource = (url: string, type: 'script' | 'style' | 'image' | 'font' = 'script') => {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  
  switch (type) {
    case 'script':
      link.as = 'script';
      break;
    case 'style':
      link.as = 'style';
      break;
    case 'image':
      link.as = 'image';
      break;
    case 'font':
      link.as = 'font';
      link.crossOrigin = 'anonymous';
      break;
  }

  document.head.appendChild(link);
};

// Performance monitoring React component
export const PerformanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const monitor = PerformanceMonitor.getInstance();
    monitor.setupObservers();

    // Log metrics periodically in development
    const interval = process.env.NODE_ENV === 'development' ? 
      setInterval(() => monitor.logMetrics(), 30000) : null;

    return () => {
      if (interval) clearInterval(interval);
      monitor.cleanup();
    };
  }, []);

  return React.createElement(React.Fragment, null, children);
};

export default {
  PerformanceMonitor,
  CanvasStateCache,
  ViewportCuller,
  QueryOptimizer,
  MemoryManager,
  useCanvasPerformance,
  useQueryOptimization,
  useMemoryEfficientEventHandler,
  useOptimizedIntersectionObserver,
  preloadResource,
  PerformanceProvider,
};