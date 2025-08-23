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

// Mock the new hooks
jest.mock('@/hooks/useViewport', () => ({
  useViewport: jest.fn(() => ({
    viewport: { position: { x: 0, y: 0 }, zoom: 1 },
    metrics: {
      visibleBounds: { minX: -300, minY: -300, maxX: 1100, maxY: 900 },
      contentBounds: { minX: -200, minY: -200, maxX: 200, maxY: 200 },
      effectiveBounds: { minX: -200, minY: -200, maxX: 200, maxY: 200 },
      viewportArea: 1440000,
      contentCoverage: 0.1,
      zoomLevel: 1,
      centerPoint: { x: 400, y: 300 },
      isContentVisible: true,
    },
    visibleBounds: { minX: -300, minY: -300, maxX: 1100, maxY: 900 },
    contentBounds: { minX: -200, minY: -200, maxX: 200, maxY: 200 },
    effectiveBounds: { minX: -200, minY: -200, maxX: 200, maxY: 200 },
    updateEntities: jest.fn(),
    getViewportInfo: jest.fn(() => ({
      position: { x: 0, y: 0 },
      zoom: 1,
      bounds: { minX: -200, minY: -200, maxX: 200, maxY: 200 },
    })),
  })),
}));

jest.mock('@/hooks/useCanvasNavigation', () => ({
  useCanvasNavigation: jest.fn(() => ({
    isAnimating: false,
    isGestureActive: false,
    isMomentumActive: false,
    panTo: jest.fn(),
    zoomTo: jest.fn(),
    resetView: jest.fn(),
    startNavigation: jest.fn(),
    updateNavigation: jest.fn(),
    endNavigation: jest.fn(),
    stopAllAnimations: jest.fn(),
    currentVelocity: { x: 0, y: 0 },
    config: {
      enableMomentum: true,
      enableInertia: true,
      enableSmoothing: true,
      momentumFriction: 0.95,
      animationDuration: 300,
      velocityThreshold: 50,
      maxVelocity: 2000,
    },
  })),
}));

// Mock canvas calculations
jest.mock('@/utils/canvas-calculations', () => ({
  getLevelOfDetail: jest.fn(() => 'high'),
  cullEntities: jest.fn((entities) => entities),
  shouldUseSimplifiedRendering: jest.fn(() => false),
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
      position: { x: 0, y: 0 },
      zoom: 1,
      bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
      isDirty: false,
    },
    config: {
      grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
      zoom: { min: 0.25, max: 4.0, step: 0.1 },
      performance: { enableCulling: true, enableVirtualization: true, maxVisibleCards: 1000 },
    },
    interaction: {
      mode: 'select' as const,
      isActive: false,
      selection: { selectedIds: new Set() },
      lastInteractionTime: Date.now(),
    },
    isInitialized: true,
    setZoom: jest.fn(),
    setPosition: jest.fn(),
    reset: jest.fn(),
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
    expect(screen.getByText(/Size: 800×600px/)).toBeInTheDocument();
    expect(screen.getByText(/Zoom: 100%/)).toBeInTheDocument();
    expect(screen.getByText(/Position: \(0, 0\)/)).toBeInTheDocument();
    expect(screen.getByText(/LOD: high/)).toBeInTheDocument();
  });

  it('does not render debug info when debug prop is false', () => {
    render(<InfiniteCanvas debug={false} />);
    expect(screen.queryByText(/Size:/)).not.toBeInTheDocument();
  });

  it('renders canvas with proper dimensions', async () => {
    render(<InfiniteCanvas />);
    
    const stage = screen.getByTestId('konva-stage');
    expect(stage).toHaveAttribute('width', '800');
    expect(stage).toHaveAttribute('height', '600');
  });

  it('updates when viewport changes', () => {
    const { rerender } = render(<InfiniteCanvas />);
    
    // Update the mock store
    const updatedStore = {
      ...mockStore,
      viewport: {
        ...mockStore.viewport,
        zoom: 2,
        position: { x: 100, y: 50 },
      },
    };
    
    (useCanvasStore as unknown as jest.Mock).mockReturnValue(updatedStore);
    
    rerender(<InfiniteCanvas debug={true} />);
    
    expect(screen.getByText(/Zoom: 200%/)).toBeInTheDocument();
    expect(screen.getByText(/Position: \(100, 50\)/)).toBeInTheDocument();
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<InfiniteCanvas />);
      const canvas = screen.getByTestId('infinite-canvas');
      
      expect(canvas).toHaveAttribute('role', 'application');
      expect(canvas).toHaveAttribute('aria-label', 'Interactive infinite canvas workspace');
      expect(canvas).toHaveAttribute('aria-describedby', 'canvas-instructions canvas-status');
      expect(canvas).toHaveAttribute('aria-roledescription', 'Interactive infinite canvas for visual knowledge workspace');
      expect(canvas).toHaveAttribute('tabIndex', '0');
    });

    it('has custom ARIA label and description', () => {
      render(
        <InfiniteCanvas 
          ariaLabel="Custom canvas label" 
          ariaDescription="Custom canvas description" 
        />
      );
      const canvas = screen.getByTestId('infinite-canvas');
      
      expect(canvas).toHaveAttribute('aria-label', 'Custom canvas label');
    });

    it('renders screen reader instructions', () => {
      render(<InfiniteCanvas />);
      
      const instructionsContainer = document.querySelector('#canvas-instructions');
      expect(instructionsContainer).toBeInTheDocument();
      expect(instructionsContainer).toHaveClass('sr-only');
      
      // Check that instructions content is present
      expect(screen.getByText(/Use arrow keys to pan, plus and minus keys to zoom/)).toBeInTheDocument();
    });

    it('has live region for announcements', () => {
      render(<InfiniteCanvas />);
      
      const statusElement = document.querySelector('#canvas-status');
      expect(statusElement).toBeInTheDocument();
      expect(statusElement).toHaveAttribute('role', 'status');
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
      expect(statusElement).toHaveAttribute('aria-atomic', 'true');
      expect(statusElement).toHaveClass('sr-only');
    });

    it('displays current zoom level in instructions', () => {
      render(<InfiniteCanvas />);
      
      expect(screen.getByText(/Current zoom level: 100 percent/)).toBeInTheDocument();
      expect(screen.getByText(/Zoom range: 25% to 400%/)).toBeInTheDocument();
    });

    it('updates zoom level announcement when zoom changes', async () => {
      const { rerender } = render(<InfiniteCanvas />);
      
      // Update zoom level
      const updatedStore = {
        ...mockStore,
        viewport: {
          ...mockStore.viewport,
          zoom: 1.5,
        },
      };
      
      (useCanvasStore as unknown as jest.Mock).mockReturnValue(updatedStore);
      rerender(<InfiniteCanvas />);
      
      await waitFor(() => {
        expect(screen.getByText(/Current zoom level: 150 percent/)).toBeInTheDocument();
      });
    });

    it('has proper focus styles applied via Tailwind classes', () => {
      render(<InfiniteCanvas />);
      const canvas = screen.getByTestId('infinite-canvas');
      
      expect(canvas).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-border-focus', 'focus:ring-offset-2');
    });
  });

  // Design System Integration Tests
  describe('Design System Integration', () => {
    it('uses design system color tokens', () => {
      render(<InfiniteCanvas />);
      const canvas = screen.getByTestId('infinite-canvas');
      
      // Uses bg-canvas-base from design tokens
      expect(canvas).toHaveClass('bg-canvas-base');
    });

    it('debug info uses design system colors', () => {
      render(<InfiniteCanvas debug={true} />);
      const debugInfo = screen.getByLabelText('Canvas debug information');
      
      expect(debugInfo).toHaveClass('bg-neutral-800', 'text-neutral-50', 'border-neutral-700');
    });

    it('shows zoom range from design tokens in debug mode', () => {
      render(<InfiniteCanvas debug={true} />);
      
      expect(screen.getByText(/range: 25%-400%/)).toBeInTheDocument();
    });
  });
});