'use client';

import React, { useState, useCallback } from 'react';
import { InfiniteCanvas, type CanvasEntity, type CullingInfo } from './InfiniteCanvas';
import type { PerformanceMetrics } from './CanvasStage';
import type { CanvasPosition, ZoomLevel } from '@/types/canvas.types';

/**
 * Example usage of the enhanced InfiniteCanvas component
 * Demonstrates viewport culling, performance monitoring, and entity management
 */
export const InfiniteCanvasExample: React.FC = () => {
  // Example entities for demonstration
  const [entities] = useState<CanvasEntity[]>([
    {
      id: 'card-1',
      type: 'card',
      bounds: { minX: 0, minY: 0, maxX: 200, maxY: 150 },
      priority: 5,
      complexity: 'medium',
      data: { title: 'Example Card 1' },
    },
    {
      id: 'card-2', 
      type: 'card',
      bounds: { minX: 300, minY: 100, maxX: 500, maxY: 250 },
      priority: 3,
      complexity: 'high',
      data: { title: 'Example Card 2' },
    },
    {
      id: 'connection-1',
      type: 'connection',
      bounds: { minX: 200, minY: 75, maxX: 300, maxY: 175 },
      priority: 1,
      complexity: 'low',
      data: { from: 'card-1', to: 'card-2' },
    },
  ]);

  const [visibleEntities, setVisibleEntities] = useState<CanvasEntity[]>([]);
  const [performanceInfo, setPerformanceInfo] = useState<string>('');
  const [viewportInfo, setViewportInfo] = useState<string>('');

  const handleEntityVisibilityChange = useCallback((visible: CanvasEntity[]) => {
    setVisibleEntities(visible);
  }, []);

  const handlePerformanceUpdate = useCallback((
    metrics: PerformanceMetrics & { cullingInfo: CullingInfo }
  ) => {
    const { currentFPS, averageFPS, isOptimal, warnings, cullingInfo } = metrics;
    setPerformanceInfo(
      `FPS: ${Math.round(currentFPS)} (avg: ${Math.round(averageFPS)}) | ` +
      `Status: ${isOptimal ? 'Optimal' : 'Suboptimal'} | ` +
      `Entities: ${cullingInfo.visibleEntities}/${cullingInfo.totalEntities} | ` +
      `LOD: ${cullingInfo.levelOfDetail} | ` +
      `Warnings: ${warnings.length}`
    );
  }, []);

  const handleViewportChange = useCallback((viewport: {
    position: CanvasPosition;
    zoom: ZoomLevel;
    bounds: unknown;
  }) => {
    setViewportInfo(
      `Position: (${Math.round(viewport.position.x)}, ${Math.round(viewport.position.y)}) | ` +
      `Zoom: ${Math.round(viewport.zoom * 100)}%`
    );
  }, []);

  return (
    <div className="w-full h-screen flex flex-col bg-neutral-100">
      {/* Performance and Status Info */}
      <div className="bg-neutral-800 text-neutral-50 p-4 text-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <h3 className="font-medium mb-1">Performance</h3>
            <p className="text-xs text-neutral-300">{performanceInfo || 'Initializing...'}</p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Viewport</h3>
            <p className="text-xs text-neutral-300">{viewportInfo || 'Initializing...'}</p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Visible Entities</h3>
            <p className="text-xs text-neutral-300">
              {visibleEntities.length} visible: {visibleEntities.map(e => e.id).join(', ')}
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Infinite Canvas */}
      <div className="flex-1 relative">
        <InfiniteCanvas
          debug={true}
          showGrid={true}
          entities={entities}
          viewportCulling={{
            enabled: true,
            bufferZone: 400,
            maxEntities: 500,
            priorityThreshold: 4,
            enableLevelOfDetail: true,
            simplificationThreshold: 15,
          }}
          performanceOptimization={{
            enablePerformanceMonitoring: true,
            enableAdaptiveQuality: true,
            targetFPS: 60,
            enableMemoryManagement: true,
          }}
          viewportConfig={{
            enableDynamicBounds: true,
            boundsPadding: 200,
            bufferZone: 400,
            autoFitContent: false,
            constrainToBounds: false,
            enableViewportTracking: true,
          }}
          navigationConfig={{
            enableMomentum: true,
            momentumFriction: 0.95,
            animationDuration: 300,
            velocityThreshold: 50,
            maxVelocity: 2000,
            enableInertia: true,
            enableSmoothing: true,
          }}
          onEntityVisibilityChange={handleEntityVisibilityChange}
          onPerformanceUpdate={handlePerformanceUpdate}
          onViewportChange={handleViewportChange}
          ariaLabel="Enhanced infinite canvas example with performance optimization"
          ariaDescription="Demonstrates viewport culling, performance monitoring, and smooth navigation. Use arrow keys to pan, plus and minus to zoom."
        />
      </div>

      {/* Usage Instructions */}
      <div className="bg-neutral-50 border-t border-neutral-200 p-4 text-sm">
        <h3 className="font-medium mb-2">Enhanced Features Demonstration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <h4 className="font-medium text-neutral-800">Viewport Culling</h4>
            <p className="text-neutral-600">
              Only renders visible entities plus buffer zone. Zoom out to see culling in action.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-neutral-800">Level of Detail</h4>
            <p className="text-neutral-600">
              Rendering quality adapts to zoom level. Small entities use simplified rendering.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-neutral-800">Performance Monitoring</h4>
            <p className="text-neutral-600">
              Real-time FPS tracking with adaptive quality based on performance metrics.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-neutral-800">Smooth Navigation</h4>
            <p className="text-neutral-600">
              Momentum-based scrolling with smooth animations and gesture handling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};