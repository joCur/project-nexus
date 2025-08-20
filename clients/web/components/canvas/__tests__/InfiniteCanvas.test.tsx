import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InfiniteCanvas } from '../InfiniteCanvas';
import { useCanvasStore } from '@/stores/canvasStore';

// Mock the store
jest.mock('@/stores/canvasStore');

// Mock the hooks
jest.mock('@/hooks/useCanvasSize', () => ({
  useCanvasSize: jest.fn(() => ({ width: 800, height: 600 })),
}));

jest.mock('@/hooks/useCanvasEvents', () => ({
  useCanvasEvents: jest.fn(),
}));

// Mock Konva components
jest.mock('react-konva', () => ({
  Stage: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="konva-stage" {...props}>
      {children}
    </div>
  ),
  Layer: ({ children }: { children?: React.ReactNode }) => <div data-testid="konva-layer">{children}</div>,
  Rect: ({ ...props }: { [key: string]: unknown }) => <div data-testid="konva-rect" {...props} />,
  Line: ({ ...props }: { [key: string]: unknown }) => <div data-testid="konva-line" {...props} />,
}));

describe('InfiniteCanvas', () => {
  const mockStore = {
    viewport: {
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      minZoom: 0.25,
      maxZoom: 4,
      center: { x: 400, y: 300 },
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    },
    initialize: jest.fn(),
    setZoom: jest.fn(),
    setPanOffset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useCanvasStore as unknown as jest.Mock).mockReturnValue(mockStore);
  });

  it('renders the canvas container', () => {
    render(<InfiniteCanvas />);
    const canvas = screen.getByTestId('infinite-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass('relative', 'w-full', 'h-full', 'overflow-hidden');
  });

  it('renders with custom className', () => {
    render(<InfiniteCanvas className="custom-class" />);
    const canvas = screen.getByTestId('infinite-canvas');
    expect(canvas).toHaveClass('custom-class');
  });

  it('renders the canvas stage with correct dimensions', () => {
    render(<InfiniteCanvas />);
    const stage = screen.getByTestId('konva-stage');
    expect(stage).toBeInTheDocument();
    expect(stage).toHaveAttribute('width', '800');
    expect(stage).toHaveAttribute('height', '600');
  });

  it('shows grid by default', () => {
    render(<InfiniteCanvas />);
    const layer = screen.getByTestId('konva-layer');
    expect(layer).toBeInTheDocument();
  });

  it('hides grid when showGrid is false', () => {
    render(<InfiniteCanvas showGrid={false} />);
    const layer = screen.getByTestId('konva-layer');
    expect(layer).toBeInTheDocument();
  });

  it('renders debug info when debug prop is true', () => {
    render(<InfiniteCanvas debug={true} />);
    expect(screen.getByText(/Size: 800x600/)).toBeInTheDocument();
    expect(screen.getByText(/Zoom: 100%/)).toBeInTheDocument();
    expect(screen.getByText(/Position: \(0, 0\)/)).toBeInTheDocument();
  });

  it('does not render debug info when debug prop is false', () => {
    render(<InfiniteCanvas debug={false} />);
    expect(screen.queryByText(/Size:/)).not.toBeInTheDocument();
  });

  it('initializes canvas dimensions on mount', async () => {
    render(<InfiniteCanvas />);
    
    await waitFor(() => {
      expect(mockStore.initialize).toHaveBeenCalledWith({
        width: 800,
        height: 600,
      });
    });
  });

  it('updates when viewport changes', () => {
    const { rerender } = render(<InfiniteCanvas />);
    
    // Update the mock store
    const updatedStore = {
      ...mockStore,
      viewport: {
        ...mockStore.viewport,
        zoom: 2,
        panOffset: { x: 100, y: 50 },
      },
    };
    
    (useCanvasStore as unknown as jest.Mock).mockReturnValue(updatedStore);
    
    rerender(<InfiniteCanvas debug={true} />);
    
    expect(screen.getByText(/Zoom: 200%/)).toBeInTheDocument();
    expect(screen.getByText(/Position: \(100, 50\)/)).toBeInTheDocument();
  });
});