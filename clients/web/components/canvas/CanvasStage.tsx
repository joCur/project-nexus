'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import { Stage } from 'react-konva';
import Konva from 'konva';
import { useCanvasStore } from '@/stores/canvasStore';

interface CanvasStageProps {
  width: number;
  height: number;
  scale: { x: number; y: number };
  position: { x: number; y: number };
  children: React.ReactNode;
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (position: { x: number; y: number }) => void;
}

/**
 * React-Konva Stage wrapper that handles canvas rendering and interactions.
 * Provides the main rendering context for all canvas elements.
 * 
 * Accessibility Features:
 * - ARIA-compliant interaction handling
 * - Zoom range enforcement (0.25x - 4.0x)
 * - Smooth pan and zoom transitions
 * - Context menu prevention for better UX
 * - Performance optimizations for 60fps rendering
 */
export const CanvasStage: React.FC<CanvasStageProps> = ({
  width,
  height,
  scale,
  position,
  children,
  onZoomChange,
  onPanChange,
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const { setZoom, setPosition } = useCanvasStore();
  
  // Constants from design tokens
  const ZOOM_MIN = 0.25; // 25% minimum zoom
  const ZOOM_MAX = 4.0;   // 400% maximum zoom
  const ZOOM_STEP = 1.05; // Zoom sensitivity
  
  // Handle wheel events for zooming with accessibility considerations
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;
    
    const oldScale = scale.x;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };
    
    // Calculate new scale with design token zoom limits
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(
      Math.max(oldScale * Math.pow(ZOOM_STEP, direction), ZOOM_MIN),
      ZOOM_MAX
    );
    
    // Skip if scale didn't change (at zoom limits)
    if (newScale === oldScale) return;
    
    // Calculate new position to zoom toward cursor
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    
    setZoom(newScale);
    setPosition(newPos);
    
    // Notify parent components for accessibility announcements
    onZoomChange?.(newScale);
  }, [scale.x, position, setZoom, setPosition, onZoomChange, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP]);
  
  // Handle drag events for panning with accessibility notifications
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const stage = e.target as Konva.Stage;
    const newPosition = {
      x: stage.x(),
      y: stage.y(),
    };
    
    setPosition(newPosition);
    
    // Notify parent components for accessibility announcements
    onPanChange?.(newPosition);
  }, [setPosition, onPanChange]);
  
  // Prevent default context menu for better UX
  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
  }, []);
  
  // Set stage focus for keyboard accessibility
  useEffect(() => {
    const stage = stageRef.current;
    if (stage && typeof stage.container === 'function') {
      const container = stage.container();
      if (container) {
        // Ensure the canvas can receive focus for keyboard events
        container.setAttribute('role', 'img');
        container.setAttribute('aria-label', 'Canvas rendering area');
        container.style.outline = 'none'; // Let parent handle focus styles
      }
    }
  }, [width, height]); // Re-run when canvas dimensions change

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      scaleX={scale.x}
      scaleY={scale.y}
      x={position.x}
      y={position.y}
      draggable
      onWheel={handleWheel}
      onDragEnd={handleDragEnd}
      onContextMenu={handleContextMenu}
      // Performance optimizations for 60fps target
      perfectDrawEnabled={false}
      listening={true}
      // Accessibility: Prevent focus on canvas element itself
      // (parent container handles focus management)
      tabIndex={-1}
    >
      {children}
    </Stage>
  );
};