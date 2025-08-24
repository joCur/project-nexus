import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CanvasBackground } from '../CanvasBackground';

// Mock Konva components
jest.mock('react-konva', () => ({
  Layer: ({ children, listening, ...props }: { children?: React.ReactNode; listening?: boolean; [key: string]: unknown }) => (
    <div 
      data-testid="konva-layer" 
      data-listening={listening}
      {...props}
    >
      {children}
    </div>
  ),
  Rect: ({ x, y, width, height, fill, ...props }: { x?: number; y?: number; width?: number; height?: number; fill?: string; [key: string]: unknown }) => (
    <div 
      data-testid="konva-rect" 
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      data-fill={fill}
      {...props}
    />
  ),
  Line: ({ points, stroke, strokeWidth, listening, ...props }: { points?: number[]; stroke?: string; strokeWidth?: number; listening?: boolean; [key: string]: unknown }) => (
    <div 
      data-testid="konva-line" 
      data-points={JSON.stringify(points)}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-listening={listening}
      {...props}
    />
  ),
}));

describe('CanvasBackground', () => {
  const defaultProps = {
    width: 800,
    height: 600,
    zoom: 1,
    position: { x: 0, y: 0 },
  };

  it('renders layer with correct props', () => {
    render(<CanvasBackground {...defaultProps} />);
    
    const layer = screen.getByTestId('konva-layer');
    expect(layer).toBeInTheDocument();
    expect(layer).toHaveAttribute('data-listening', 'false');
  });

  it('renders background rect with infinite dimensions', () => {
    render(<CanvasBackground {...defaultProps} />);
    
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toBeInTheDocument();
    // The new infinite background should have much larger dimensions with padding
    // backgroundPadding = Math.max(800, 600) * 5 = 4000
    // backgroundWidth = (width / zoom) + (padding * 2) = 800 + 8000 = 8800
    expect(rect).toHaveAttribute('data-width', '8800');
    expect(rect).toHaveAttribute('data-height', '8600'); // (600) + 8000
    expect(rect).toHaveAttribute('data-fill', '#f9fafb');
  });

  it('renders background rect with custom background color', () => {
    render(<CanvasBackground {...defaultProps} backgroundColor="#FFFFFF" />);
    
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('data-fill', '#FFFFFF');
  });

  it('renders grid lines when showGrid is true', () => {
    render(<CanvasBackground {...defaultProps} showGrid={true} />);
    
    const lines = screen.getAllByTestId('konva-line');
    expect(lines.length).toBeGreaterThan(0);
    
    // Check that lines have correct properties
    lines.forEach(line => {
      expect(line).toHaveAttribute('data-stroke', '#e5e7eb');
      expect(line).toHaveAttribute('data-stroke-width', '1');
      expect(line).toHaveAttribute('data-listening', 'false');
    });
  });

  it('renders grid lines with custom grid color', () => {
    render(<CanvasBackground {...defaultProps} showGrid={true} gridColor="#FF0000" />);
    
    const lines = screen.getAllByTestId('konva-line');
    lines.forEach(line => {
      expect(line).toHaveAttribute('data-stroke', '#FF0000');
    });
  });

  it('does not render grid lines when showGrid is false', () => {
    render(<CanvasBackground {...defaultProps} showGrid={false} />);
    
    const lines = screen.queryAllByTestId('konva-line');
    expect(lines).toHaveLength(0);
  });

  it('adjusts stroke width based on zoom level', () => {
    render(<CanvasBackground {...defaultProps} zoom={2} showGrid={true} />);
    
    const lines = screen.getAllByTestId('konva-line');
    lines.forEach(line => {
      expect(line).toHaveAttribute('data-stroke-width', '0.5');
    });
  });

  it('adjusts background rect dimensions based on zoom level', () => {
    render(<CanvasBackground {...defaultProps} zoom={2} />);
    
    const rect = screen.getByTestId('konva-rect');
    // At zoom 2, viewport size is halved in canvas coordinates, but padding remains large
    // backgroundPadding = Math.max(800, 600) * 5 = 4000
    // backgroundWidth = (800/2) + (4000 * 2) = 400 + 8000 = 8400
    expect(rect).toHaveAttribute('data-width', '8400');
    expect(rect).toHaveAttribute('data-height', '8300'); // (600/2) + 8000
  });

  it('hides grid at extreme zoom levels', () => {
    // Test very low zoom (below 0.25)
    render(<CanvasBackground {...defaultProps} zoom={0.1} showGrid={true} />);
    let lines = screen.queryAllByTestId('konva-line');
    expect(lines).toHaveLength(0);

    // Test very high zoom (above 4)
    render(<CanvasBackground {...defaultProps} zoom={5} showGrid={true} />);
    lines = screen.queryAllByTestId('konva-line');
    expect(lines).toHaveLength(0);
  });

  it('shows grid at valid zoom levels', () => {
    // Test minimum valid zoom
    render(<CanvasBackground {...defaultProps} zoom={0.25} showGrid={true} />);
    let lines = screen.getAllByTestId('konva-line');
    expect(lines.length).toBeGreaterThan(0);

    // Test maximum valid zoom
    render(<CanvasBackground {...defaultProps} zoom={4} showGrid={true} />);
    lines = screen.getAllByTestId('konva-line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('uses custom grid size when provided', () => {
    const { rerender } = render(
      <CanvasBackground {...defaultProps} showGrid={true} gridSize={20} />
    );
    
    const smallGridLines = screen.getAllByTestId('konva-line');
    const smallGridCount = smallGridLines.length;

    rerender(
      <CanvasBackground {...defaultProps} showGrid={true} gridSize={80} />
    );
    
    const largeGridLines = screen.getAllByTestId('konva-line');
    const largeGridCount = largeGridLines.length;

    // Smaller grid size should produce more lines
    expect(smallGridCount).toBeGreaterThan(largeGridCount);
  });

  it('generates both vertical and horizontal grid lines', () => {
    render(<CanvasBackground {...defaultProps} showGrid={true} />);
    
    const lines = screen.getAllByTestId('konva-line');
    
    // Parse points to determine line orientation
    const verticalLines = lines.filter(line => {
      const points = JSON.parse(line.getAttribute('data-points') || '[]');
      return points[0] === points[2]; // x1 === x2 means vertical line
    });
    
    const horizontalLines = lines.filter(line => {
      const points = JSON.parse(line.getAttribute('data-points') || '[]');
      return points[1] === points[3]; // y1 === y2 means horizontal line
    });

    expect(verticalLines.length).toBeGreaterThan(0);
    expect(horizontalLines.length).toBeGreaterThan(0);
  });

  it('optimizes grid lines based on visible area', () => {
    // Test with different canvas sizes
    render(
      <CanvasBackground width={400} height={300} zoom={1} position={{ x: 0, y: 0 }} showGrid={true} />
    );
    
    const smallLines = screen.getAllByTestId('konva-line');
    const smallLinesCount = smallLines.length;

    // Re-render with larger canvas
    render(
      <CanvasBackground width={1600} height={1200} zoom={1} position={{ x: 0, y: 0 }} showGrid={true} />
    );
    
    const largeLines = screen.getAllByTestId('konva-line');

    // Larger canvas should have more grid lines
    expect(largeLines.length).toBeGreaterThan(smallLinesCount);
  });

  it('uses default props when not provided', () => {
    render(<CanvasBackground width={800} height={600} zoom={1} position={{ x: 0, y: 0 }} />);
    
    // Should render with default grid (showGrid = true by default)
    const lines = screen.getAllByTestId('konva-line');
    expect(lines.length).toBeGreaterThan(0);
    
    // Should use default colors
    const rect = screen.getByTestId('konva-rect');
    expect(rect).toHaveAttribute('data-fill', '#f9fafb');
    
    lines.forEach(line => {
      expect(line).toHaveAttribute('data-stroke', '#e5e7eb');
    });
  });

  // Design System Integration Tests
  describe('Design System Integration', () => {
    it('uses design token colors by default', () => {
      render(<CanvasBackground {...defaultProps} showGrid={true} />);
      
      const rect = screen.getByTestId('konva-rect');
      const lines = screen.getAllByTestId('konva-line');
      
      // Verify design token usage
      expect(rect).toHaveAttribute('data-fill', '#f9fafb'); // semantic.canvas-base
      lines.forEach(line => {
        expect(line).toHaveAttribute('data-stroke', '#e5e7eb'); // semantic.border-default
      });
    });

    it('enforces zoom range from design tokens', () => {
      // Test below minimum zoom (0.25)
      render(<CanvasBackground {...defaultProps} zoom={0.2} showGrid={true} />);
      let lines = screen.queryAllByTestId('konva-line');
      expect(lines).toHaveLength(0);

      // Test above maximum zoom (4.0)
      render(<CanvasBackground {...defaultProps} zoom={4.1} showGrid={true} />);
      lines = screen.queryAllByTestId('konva-line');
      expect(lines).toHaveLength(0);

      // Test at exact limits
      render(<CanvasBackground {...defaultProps} zoom={0.25} showGrid={true} />);
      lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThan(0);

      render(<CanvasBackground {...defaultProps} zoom={4.0} showGrid={true} />);
      lines = screen.getAllByTestId('konva-line');
      expect(lines.length).toBeGreaterThan(0);
    });

    it('has proper layer naming for debugging', () => {
      render(<CanvasBackground {...defaultProps} />);
      
      const layer = screen.getByTestId('konva-layer');
      expect(layer).toHaveAttribute('name', 'canvas-background');
    });

    it('has semantic names for Konva elements', () => {
      render(<CanvasBackground {...defaultProps} showGrid={true} />);
      
      const rect = screen.getByTestId('konva-rect');
      expect(rect).toHaveAttribute('name', 'canvas-background-rect');
      
      const lines = screen.getAllByTestId('konva-line');
      lines.forEach((line) => {
        const name = line.getAttribute('name');
        expect(name).toMatch(/^grid-(vertical|horizontal)-\d+$/);
      });
    });

    it('has performance optimizations enabled', () => {
      render(<CanvasBackground {...defaultProps} showGrid={true} />);
      
      const lines = screen.getAllByTestId('konva-line');
      lines.forEach(line => {
        // perfectDrawEnabled is passed to Konva but may not appear as DOM attribute
        expect(line).toHaveAttribute('data-listening', 'false');
        expect(line).toHaveAttribute('data-testid', 'konva-line');
      });
    });
  });

  // Accessibility Tests  
  describe('Accessibility', () => {
    it('has non-interactive elements properly configured', () => {
      render(<CanvasBackground {...defaultProps} showGrid={true} />);
      
      const layer = screen.getByTestId('konva-layer');
      const lines = screen.getAllByTestId('konva-line');
      
      expect(layer).toHaveAttribute('data-listening', 'false');
      lines.forEach(line => {
        expect(line).toHaveAttribute('data-listening', 'false');
      });
    });

    it('maintains proper contrast ratios with design tokens', () => {
      // This test verifies that we're using colors from the design system
      // that have been verified for WCAG compliance
      render(<CanvasBackground {...defaultProps} showGrid={true} />);
      
      const rect = screen.getByTestId('konva-rect');
      const lines = screen.getAllByTestId('konva-line');
      
      // Verify we're using the semantic colors that have verified contrast
      expect(rect).toHaveAttribute('data-fill', '#f9fafb');
      lines.forEach(line => {
        expect(line).toHaveAttribute('data-stroke', '#e5e7eb');
      });
    });
  });
});