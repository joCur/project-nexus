'use client';

import React, { useRef, useCallback, useState } from 'react';
import { Stage } from 'react-konva';
import Konva from 'konva';
import { useCanvasStore } from '@/stores/canvasStore';

interface CanvasStageProps {
  width: number;
  height: number;
  scale: { x: number; y: number };
  position: { x: number; y: number };
  children: React.ReactNode;
}

/**
 * Simple React-Konva Stage wrapper that handles basic canvas interactions.
 * Provides zoom and pan functionality with proper bounds checking.
 */
export const CanvasStage: React.FC<CanvasStageProps> = ({
  width,
  height,
  scale,
  position,
  children,
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const { setZoom, setPosition, config } = useCanvasStore();
  const [isDragging, setIsDragging] = useState(false);
  
  // Zoom step for mouse wheel
  const ZOOM_STEP = 1.1;
  
  // Handle wheel events for zooming
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
    
    // Calculate new scale with zoom limits
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(
      Math.max(oldScale * Math.pow(ZOOM_STEP, direction), config.zoom.min),
      config.zoom.max
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
  }, [scale.x, position, setZoom, setPosition, config.zoom]);
  
  // Handle drag start
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Handle drag events for panning
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const stage = e.target as Konva.Stage;
    const newPosition = {
      x: stage.x(),
      y: stage.y(),
    };
    
    setPosition(newPosition);
    setIsDragging(false);
  }, [setPosition]);
  
  // Prevent context menu
  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
  }, []);

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      scaleX={scale.x}
      scaleY={scale.y}
      x={isDragging ? undefined : position.x}
      y={isDragging ? undefined : position.y}
      draggable
      onWheel={handleWheel}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onContextMenu={handleContextMenu}
    >
      {children}
    </Stage>
  );
};