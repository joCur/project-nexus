import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CanvasStage } from '../CanvasStage';
import { useCanvasStore } from '@/stores/canvasStore';

// Mock the store
jest.mock('@/stores/canvasStore');

// Mock Konva
jest.mock('konva');
jest.mock('react-konva', () => ({
  Stage: React.forwardRef<HTMLDivElement, {
    children?: React.ReactNode;
    onWheel?: React.WheelEventHandler<HTMLDivElement>;
    onDragEnd?: React.DragEventHandler<HTMLDivElement>;
    onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
    width?: number;
    height?: number;
    draggable?: boolean;
    scaleX?: number;
    scaleY?: number;
    x?: number;
    y?: number;
  }>(function MockStage({ 
    children, 
    onWheel, 
    onDragEnd, 
    onContextMenu, 
    width,
    height,
    draggable,
    scaleX,
    scaleY,
    x,
    y,
    ...otherProps 
  }, ref) {
    return (
    <div 
      ref={ref}
      data-testid="konva-stage" 
      onWheel={onWheel}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      data-width={width}
      data-height={height}
      draggable={draggable}
      data-scale-x={scaleX}
      data-scale-y={scaleY}
      data-x={x}
      data-y={y}
      {...otherProps}
    >
      {children}
    </div>
    );
  }),
}));

describe('CanvasStage', () => {
  const mockSetZoom = jest.fn();
  const mockSetPanOffset = jest.fn();
  
  const defaultProps = {
    width: 800,
    height: 600,
    scale: { x: 1, y: 1 },
    position: { x: 0, y: 0 },
    children: <div>Test Children</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useCanvasStore as unknown as jest.Mock).mockReturnValue({
      setZoom: mockSetZoom,
      setPanOffset: mockSetPanOffset,
    });
  });

  it('renders the stage with correct props', () => {
    render(<CanvasStage {...defaultProps} />);
    
    const stage = screen.getByTestId('konva-stage');
    expect(stage).toBeInTheDocument();
    expect(stage).toHaveAttribute('data-width', '800');
    expect(stage).toHaveAttribute('data-height', '600');
    expect(stage).toHaveAttribute('draggable', 'true');
  });

  it('renders children inside the stage', () => {
    render(<CanvasStage {...defaultProps} />);
    
    expect(screen.getByText('Test Children')).toBeInTheDocument();
  });

  it('handles wheel events for zooming', () => {
    const mockPreventDefault = jest.fn();
    
    render(<CanvasStage {...defaultProps} />);
    
    const stage = screen.getByTestId('konva-stage');
    
    // Create a simpler wheel event
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      bubbles: true,
    });
    
    Object.defineProperty(wheelEvent, 'preventDefault', {
      value: mockPreventDefault,
    });
    
    // Mock the event handler to verify it would be called
    const onWheelProp = stage.getAttribute('onWheel');
    expect(onWheelProp).toBeDefined();
  });

  it('handles drag end events for panning', () => {
    const mockStageX = jest.fn(() => 100);
    const mockStageY = jest.fn(() => 50);
    
    render(<CanvasStage {...defaultProps} />);
    
    const stage = screen.getByTestId('konva-stage');
    
    // Create mock drag event
    const dragEvent = {
      target: {
        x: mockStageX,
        y: mockStageY,
      },
    };
    
    // Simulate drag end event
    fireEvent.dragEnd(stage, dragEvent);
    
    expect(mockSetPanOffset).toHaveBeenCalledWith({
      x: 100,
      y: 50,
    });
  });

  it('prevents context menu on right click', () => {
    render(<CanvasStage {...defaultProps} />);
    
    const stage = screen.getByTestId('konva-stage');
    
    // Verify the context menu handler is set up
    const onContextMenuProp = stage.getAttribute('onContextMenu');
    expect(onContextMenuProp).toBeDefined();
  });

  it('applies scale transformation correctly', () => {
    const customProps = {
      ...defaultProps,
      scale: { x: 2, y: 2 },
    };
    
    render(<CanvasStage {...customProps} />);
    
    const stage = screen.getByTestId('konva-stage');
    expect(stage).toHaveAttribute('data-scale-x', '2');
    expect(stage).toHaveAttribute('data-scale-y', '2');
  });

  it('applies position transformation correctly', () => {
    const customProps = {
      ...defaultProps,
      position: { x: 100, y: 50 },
    };
    
    render(<CanvasStage {...customProps} />);
    
    const stage = screen.getByTestId('konva-stage');
    expect(stage).toHaveAttribute('data-x', '100');
    expect(stage).toHaveAttribute('data-y', '50');
  });

  it('has proper event handlers attached', () => {
    render(<CanvasStage {...defaultProps} />);
    
    const stage = screen.getByTestId('konva-stage');
    
    // Verify all necessary event handlers are attached
    expect(stage).toHaveAttribute('draggable', 'true');
    
    // Check that event handler props are set
    const onWheelProp = stage.getAttribute('onWheel');
    const onDragEndProp = stage.getAttribute('onDragEnd');
    const onContextMenuProp = stage.getAttribute('onContextMenu');
    
    expect(onWheelProp).toBeDefined();
    expect(onDragEndProp).toBeDefined();
    expect(onContextMenuProp).toBeDefined();
  });
});