'use client';

import React, { useMemo } from 'react';
import { Layer, Line, Rect } from 'react-konva';

interface CanvasBackgroundProps {
  width: number;
  height: number;
  showGrid?: boolean;
  zoom: number;
  gridSize?: number;
  gridColor?: string;
  backgroundColor?: string;
}

/**
 * Canvas background component that renders an optional grid pattern.
 * The grid adapts to zoom level for optimal visibility.
 */
export const CanvasBackground: React.FC<CanvasBackgroundProps> = ({
  width,
  height,
  showGrid = true,
  zoom,
  gridSize = 40,
  gridColor = '#E5E7EB', // gray-200
  backgroundColor = '#F9FAFB', // gray-50
}) => {
  const gridLines = useMemo(() => {
    if (!showGrid) return { vertical: [], horizontal: [] };

    const lines = {
      vertical: [] as number[][],
      horizontal: [] as number[][],
    };

    // Adjust grid spacing based on zoom level
    const effectiveGridSize = gridSize;
    
    // Calculate visible area in canvas coordinates
    const startX = -width / zoom;
    const endX = (width * 2) / zoom;
    const startY = -height / zoom;
    const endY = (height * 2) / zoom;

    // Generate vertical lines
    for (let x = Math.floor(startX / effectiveGridSize) * effectiveGridSize; x <= endX; x += effectiveGridSize) {
      lines.vertical.push([x, startY, x, endY]);
    }

    // Generate horizontal lines
    for (let y = Math.floor(startY / effectiveGridSize) * effectiveGridSize; y <= endY; y += effectiveGridSize) {
      lines.horizontal.push([startX, y, endX, y]);
    }

    return lines;
  }, [width, height, showGrid, zoom, gridSize]);

  // Only show grid at reasonable zoom levels
  const isGridVisible = showGrid && zoom >= 0.25 && zoom <= 4;

  return (
    <Layer listening={false}>
      {/* Background */}
      <Rect
        x={-width / zoom}
        y={-height / zoom}
        width={(width * 2) / zoom}
        height={(height * 2) / zoom}
        fill={backgroundColor}
      />
      
      {/* Grid lines */}
      {isGridVisible && (
        <>
          {gridLines.vertical.map((points, index) => (
            <Line
              key={`v-${index}`}
              points={points}
              stroke={gridColor}
              strokeWidth={1 / zoom}
              listening={false}
            />
          ))}
          {gridLines.horizontal.map((points, index) => (
            <Line
              key={`h-${index}`}
              points={points}
              stroke={gridColor}
              strokeWidth={1 / zoom}
              listening={false}
            />
          ))}
        </>
      )}
    </Layer>
  );
};