'use client';

import React, { useEffect, useRef } from 'react';
import { CanvasStage } from './CanvasStage';
import { CanvasBackground } from './CanvasBackground';
import { useCanvasSize } from '@/hooks/useCanvasSize';
import { useCanvasEvents } from '@/hooks/useCanvasEvents';
import { useCanvasStore } from '@/stores/canvasStore';

interface InfiniteCanvasProps {
  className?: string;
  showGrid?: boolean;
  debug?: boolean;
}

/**
 * Main infinite canvas component that provides the foundation for the visual workspace.
 * Integrates React-Konva for high-performance 2D rendering with responsive sizing.
 */
export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  className = '',
  showGrid = true,
  debug = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useCanvasSize(containerRef);
  const { viewport, initialize } = useCanvasStore();
  const { zoom, panOffset } = viewport;
  
  // Set up canvas event handlers
  useCanvasEvents(containerRef);

  // Initialize canvas dimensions
  useEffect(() => {
    if (width > 0 && height > 0) {
      initialize({ width, height });
    }
  }, [width, height, initialize]);

  useEffect(() => {
    if (debug) {
      console.log('Canvas initialized:', { width, height, zoom, panOffset });
    }
  }, [width, height, zoom, panOffset, debug]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-canvas-background ${className}`}
      data-testid="infinite-canvas"
    >
      <CanvasStage
        width={width}
        height={height}
        scale={{ x: zoom, y: zoom }}
        position={panOffset}
      >
        <CanvasBackground
          width={width}
          height={height}
          showGrid={showGrid}
          zoom={zoom}
        />
        {/* Future: Card and connection layers will be added here */}
      </CanvasStage>
      
      {debug && (
        <div className="absolute top-4 left-4 bg-black/50 text-white text-xs p-2 rounded">
          <div>Size: {width}x{height}</div>
          <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
          <div>Position: ({panOffset.x.toFixed(0)}, {panOffset.y.toFixed(0)})</div>
        </div>
      )}
    </div>
  );
};