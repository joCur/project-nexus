'use client';

import React, { useRef, useCallback } from 'react';
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
 * React-Konva Stage wrapper that handles canvas rendering and interactions.
 * Provides the main rendering context for all canvas elements.
 */
export const CanvasStage: React.FC<CanvasStageProps> = ({
  width,
  height,
  scale,
  position,
  children,
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const { setZoom, setPanOffset } = useCanvasStore();
  
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
    const scaleBy = 1.05;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(
      Math.max(oldScale * Math.pow(scaleBy, direction), 0.25),
      4
    );
    
    // Calculate new position to zoom toward cursor
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    
    setZoom(newScale);
    setPanOffset(newPos);
  }, [scale.x, position, setZoom, setPanOffset]);
  
  // Handle drag events for panning
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const stage = e.target as Konva.Stage;
    setPanOffset({
      x: stage.x(),
      y: stage.y(),
    });
  }, [setPanOffset]);
  
  // Prevent default context menu
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
      x={position.x}
      y={position.y}
      draggable
      onWheel={handleWheel}
      onDragEnd={handleDragEnd}
      onContextMenu={handleContextMenu}
      // Performance optimizations
      perfectDrawEnabled={false}
      listening={true}
    >
      {children}
    </Stage>
  );
};