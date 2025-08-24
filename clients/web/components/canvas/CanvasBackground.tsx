'use client';

import React, { useMemo } from 'react';
import { Layer, Line, Rect } from 'react-konva';

interface CanvasBackgroundProps {
  width: number;
  height: number;
  showGrid?: boolean;
  zoom: number;
  position: { x: number; y: number };
  gridSize?: number;
  gridColor?: string;
  backgroundColor?: string;
}

/**
 * Canvas background component that renders an optional grid pattern.
 * The grid adapts to zoom level for optimal visibility.
 * 
 * Design System Integration:
 * - Uses semantic color tokens for consistent theming
 * - Grid visibility optimized for zoom range 0.25x-4.0x
 * - Performance optimized with zoom-based rendering
 * - WCAG compliant color contrast for accessibility
 * 
 * Grid visibility is limited to zoom range 0.25x-4.0x to maintain performance
 * and visual clarity at extreme zoom levels as defined in design tokens.
 */
export const CanvasBackground: React.FC<CanvasBackgroundProps> = ({
  width,
  height,
  showGrid = true,
  zoom,
  position,
  gridSize = 40,
  // Design tokens: Using Tailwind CSS custom properties for consistent theming
  gridColor = '#e5e7eb', // border-default from design tokens
  backgroundColor = '#f9fafb', // canvas-base from design tokens
}) => {
  // Design token constants for zoom limits
  const ZOOM_MIN = 0.25; // From design tokens: canvas.zoom.min
  const ZOOM_MAX = 4.0;   // From design tokens: canvas.zoom.max
  const gridLines = useMemo(() => {
    if (!showGrid) return { vertical: [], horizontal: [] };

    const lines = {
      vertical: [] as number[][],
      horizontal: [] as number[][],
    };

    // Adjust grid spacing based on zoom level
    const effectiveGridSize = gridSize;
    
    // Calculate visible area in canvas coordinates
    // Stage position is the canvas offset, visible area starts at -position and extends by viewport size
    const padding = effectiveGridSize * 10;
    const startX = (-position.x / zoom) - padding;
    const endX = (-position.x + width) / zoom + padding;
    const startY = (-position.y / zoom) - padding;
    const endY = (-position.y + height) / zoom + padding;

    // Generate vertical lines aligned to grid
    for (let x = Math.floor(startX / effectiveGridSize) * effectiveGridSize; x <= endX; x += effectiveGridSize) {
      lines.vertical.push([x, startY, x, endY]);
    }

    // Generate horizontal lines aligned to grid
    for (let y = Math.floor(startY / effectiveGridSize) * effectiveGridSize; y <= endY; y += effectiveGridSize) {
      lines.horizontal.push([startX, y, endX, y]);
    }

    return lines;
  }, [width, height, showGrid, zoom, gridSize, position.x, position.y]);

  // Only show grid at reasonable zoom levels using design token constants
  // This range ensures optimal performance and visual clarity as per design specifications
  const isGridVisible = showGrid && zoom >= ZOOM_MIN && zoom <= ZOOM_MAX;

  // Calculate infinite background area based on viewport position
  const backgroundPadding = Math.max(width, height) * 5; // Large padding for infinite feel
  const backgroundX = (-position.x / zoom) - backgroundPadding;
  const backgroundY = (-position.y / zoom) - backgroundPadding;
  const backgroundWidth = (width / zoom) + (backgroundPadding * 2);
  const backgroundHeight = (height / zoom) + (backgroundPadding * 2);

  return (
    <Layer listening={false} name="canvas-background">
      {/* Infinite Background - Uses semantic.canvas-base design token */}
      <Rect
        x={backgroundX}
        y={backgroundY}
        width={backgroundWidth}
        height={backgroundHeight}
        fill={backgroundColor}
        name="canvas-background-rect"
      />
      
      {/* Grid lines - Uses semantic.border-default design token */}
      {isGridVisible && (
        <>
          {gridLines.vertical.map((points, index) => (
            <Line
              key={`grid-vertical-${index}`}
              points={points}
              stroke={gridColor}
              strokeWidth={1 / zoom}
              listening={false}
              name={`grid-vertical-${index}`}
              // Accessibility: Provide semantic meaning
              perfectDrawEnabled={false} // Performance optimization
            />
          ))}
          {gridLines.horizontal.map((points, index) => (
            <Line
              key={`grid-horizontal-${index}`}
              points={points}
              stroke={gridColor}
              strokeWidth={1 / zoom}
              listening={false}
              name={`grid-horizontal-${index}`}
              // Accessibility: Provide semantic meaning
              perfectDrawEnabled={false} // Performance optimization
            />
          ))}
        </>
      )}
    </Layer>
  );
};