import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CodeCardRenderer } from '../CodeCardRenderer';
import { CARD_CONFIG } from '../cardConfig';
import type { CodeCard, CardId } from '@/types/card.types';
import type { EntityId } from '@/types/common.types';

// Mock Konva components
jest.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="konva-group" {...props}>
      {children}
    </div>
  ),
  Rect: ({ x, y, width, height, fill, stroke, strokeWidth, cornerRadius, opacity, blur, dash, ...props }: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    cornerRadius?: number | number[];
    opacity?: number;
    blur?: number;
    dash?: number[];
    [key: string]: unknown;
  }) => (
    <div
      data-testid="konva-rect"
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      data-fill={fill}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-corner-radius={JSON.stringify(cornerRadius)}
      data-opacity={opacity}
      data-blur={blur}
      data-dash={JSON.stringify(dash)}
      {...props}
    />
  ),
  Text: ({ x, y, width, height, text, fontSize, fontFamily, fontStyle, fill, align, verticalAlign, lineHeight, ellipsis, ...props }: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontStyle?: string;
    fill?: string;
    align?: string;
    verticalAlign?: string;
    lineHeight?: number;
    ellipsis?: boolean;
    [key: string]: unknown;
  }) => (
    <div
      data-testid="konva-text"
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      data-text={text}
      data-font-size={fontSize}
      data-font-family={fontFamily}
      data-font-style={fontStyle}
      data-fill={fill}
      data-align={align}
      data-vertical-align={verticalAlign}
      data-line-height={lineHeight}
      data-ellipsis={ellipsis}
      {...props}
    >
      {text}
    </div>
  ),
}));

describe('CodeCardRenderer', () => {
  // Helper to create test code cards
  const createCodeCard = (
    id: string = 'test-code-card',
    overrides: Partial<CodeCard> = {}
  ): CodeCard => ({
    id: id as CardId,
    ownerId: 'test-user-id' as EntityId,
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width: 400, height: 300 },
    style: {
      opacity: 1,
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      borderRadius: 8,
      shadow: false,
      shadowConfig: {
        color: '#00000015',
        offsetX: 0,
        offsetY: 2,
        blur: 8,
        spread: 0,
      },
    },
    content: {
      type: 'code' as const,
      content: 'console.log("Hello, World!");\nconst x = 42;\nreturn x;',
      language: 'javascript',
      lineCount: 3,
      filename: 'example.js',
      hasExecuted: false,
      executionResults: undefined,
    },
    isHidden: false,
    isLocked: false,
    isSelected: false,
    isMinimized: false,
    status: 'active' as const,
    priority: 'normal' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    animation: {
      isAnimating: false,
    },
    ...overrides,
  });

  describe('Basic Rendering', () => {
    it('renders code card with basic elements', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // There can be multiple groups due to nested structure
      const groups = screen.getAllByTestId('konva-group');
      expect(groups.length).toBeGreaterThan(0);

      // Should have multiple rects for background, header, etc.
      const rects = screen.getAllByTestId('konva-rect');
      expect(rects.length).toBeGreaterThanOrEqual(3);

      // Should display code content
      // The text content is stored in the data-text attribute with actual newlines
      const texts = screen.getAllByTestId('konva-text');
      const codeText = texts.find(el => el.getAttribute('data-text')?.includes('console.log("Hello, World!")'));
      expect(codeText).toBeDefined();
    });

    it('renders with correct dimensions', () => {
      const card = createCodeCard('sized-card', {
        dimensions: { width: 500, height: 350 },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-width', '500');
      expect(backgroundRect).toHaveAttribute('data-height', '350');
    });

    it('uses dark theme background', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-fill', CARD_CONFIG.colors.codeBackground);
    });
  });

  describe('Code Content Rendering', () => {
    it('renders code with correct styling', () => {
      const card = createCodeCard('styled-code', {
        content: {
          ...createCodeCard().content,
          content: 'function test() {\n  return "hello";\n}',
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Find code text by data-text attribute since the mock component stores text there
      const codeTexts = screen.getAllByTestId('konva-text');
      const codeText = codeTexts.find(el => el.getAttribute('data-text') === 'function test() {\n  return "hello";\n}');
      expect(codeText).toBeDefined();
      expect(codeText).toHaveAttribute('data-font-size', '12');
      expect(codeText).toHaveAttribute('data-font-family', "JetBrains Mono, Monaco, 'Cascadia Code', monospace");
      expect(codeText).toHaveAttribute('data-fill', '#F8F8F2');
      expect(codeText).toHaveAttribute('data-align', 'left');
      expect(codeText).toHaveAttribute('data-vertical-align', 'top');
    });

    it('positions code content correctly', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Find code text by data-text attribute
      const codeTexts = screen.getAllByTestId('konva-text');
      const codeText = codeTexts.find(el => el.getAttribute('data-text') === 'console.log("Hello, World!");\nconst x = 42;\nreturn x;');
      expect(codeText).toBeDefined();
      expect(codeText).toHaveAttribute('data-x', '52'); // padding + lineNumberWidth + 8
      expect(codeText).toHaveAttribute('data-y', '42'); // padding + headerHeight + 2
    });

    it('truncates long code content', () => {
      const longCode = Array.from({ length: 50 }, (_, i) => `console.log("Line ${i + 1}");`).join('\n');
      const card = createCodeCard('long-code', {
        dimensions: { width: 400, height: 200 }, // Small height
        content: {
          ...createCodeCard().content,
          content: longCode,
          lineCount: 50,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Should show truncation indicator
      expect(screen.getByText('...')).toBeInTheDocument();

      const truncationText = screen.getByText('...');
      expect(truncationText).toHaveAttribute('data-font-family', "JetBrains Mono, Monaco, 'Cascadia Code', monospace");
      expect(truncationText).toHaveAttribute('data-fill', '#6B7280');
      expect(truncationText).toHaveAttribute('data-align', 'right');
    });

    it('does not show truncation for short code', () => {
      const shortCode = 'console.log("short");';
      const card = createCodeCard('short-code', {
        content: {
          ...createCodeCard().content,
          content: shortCode,
          lineCount: 1,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.queryByText('...')).not.toBeInTheDocument();
    });
  });

  describe('Language Indicator Display', () => {
    it('displays language indicator with correct color for JavaScript', () => {
      const card = createCodeCard('js-card', {
        content: {
          ...createCodeCard().content,
          language: 'javascript',
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByText('JAVASCRIPT')).toBeInTheDocument();

      const rects = screen.getAllByTestId('konva-rect');
      const languageRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#F7DF1E' // JavaScript yellow
      );
      expect(languageRect).toBeInTheDocument();
    });

    it('displays language indicator with correct color for Python', () => {
      const card = createCodeCard('py-card', {
        content: {
          ...createCodeCard().content,
          language: 'python',
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByText('PYTHON')).toBeInTheDocument();

      const rects = screen.getAllByTestId('konva-rect');
      const languageRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#3776AB' // Python blue
      );
      expect(languageRect).toBeInTheDocument();
    });

    it('displays language indicator with default color for unknown language', () => {
      const card = createCodeCard('unknown-lang', {
        content: {
          ...createCodeCard().content,
          language: 'unknown-language',
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByText('UNKNOWN-LANGUAGE')).toBeInTheDocument();

      const rects = screen.getAllByTestId('konva-rect');
      const languageRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#6B7280' // Default gray
      );
      expect(languageRect).toBeInTheDocument();
    });

    it('positions language indicator correctly', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const languageText = screen.getByText('JAVASCRIPT');
      expect(languageText).toHaveAttribute('data-x', '16'); // headerArea.x + 4
      expect(languageText).toHaveAttribute('data-y', '18'); // headerArea.y + 6
      expect(languageText).toHaveAttribute('data-font-size', '10');
      expect(languageText).toHaveAttribute('data-fill', 'white');
    });

    it('handles case insensitive language matching', () => {
      const card = createCodeCard('case-test', {
        content: {
          ...createCodeCard().content,
          language: 'JavaScript', // Mixed case
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const languageRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#F7DF1E' // Should still match JavaScript
      );
      expect(languageRect).toBeInTheDocument();
    });
  });

  describe('Line Numbers', () => {
    it('displays line numbers for code', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('styles line numbers correctly', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const lineNumberOne = screen.getByText('1');
      expect(lineNumberOne).toHaveAttribute('data-font-size', '11');
      expect(lineNumberOne).toHaveAttribute('data-font-family', "JetBrains Mono, Monaco, 'Cascadia Code', monospace");
      expect(lineNumberOne).toHaveAttribute('data-fill', '#6B7280');
      expect(lineNumberOne).toHaveAttribute('data-align', 'right');
    });

    it('positions line numbers correctly', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const lineNumberOne = screen.getByText('1');
      expect(lineNumberOne).toHaveAttribute('data-x', '12'); // lineNumberArea.x
      expect(lineNumberOne).toHaveAttribute('data-y', '40'); // lineNumberArea.y
      expect(lineNumberOne).toHaveAttribute('data-width', '28'); // lineNumberWidth - 4

      const lineNumberTwo = screen.getByText('2');
      expect(lineNumberTwo).toHaveAttribute('data-y', '54'); // lineNumberArea.y + 14
    });

    it('displays line number background', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const lineNumberBg = rects.find(rect =>
        rect.getAttribute('data-fill') === '#252525' &&
        rect.getAttribute('data-width') === '44' // lineNumberWidth + padding
      );
      expect(lineNumberBg).toBeInTheDocument();
    });

    it('displays vertical separator', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const separator = rects.find(rect =>
        rect.getAttribute('data-fill') === '#404040' &&
        rect.getAttribute('data-width') === '1'
      );
      expect(separator).toBeInTheDocument();
    });

    it('limits line numbers to 20', () => {
      const manyLinesCode = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
      const card = createCodeCard('many-lines', {
        content: {
          ...createCodeCard().content,
          content: manyLinesCode,
          lineCount: 50,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.queryByText('21')).not.toBeInTheDocument();
    });
  });

  describe('Line Count Display', () => {
    it('displays line count indicator', () => {
      const card = createCodeCard('line-count', {
        content: {
          ...createCodeCard().content,
          lineCount: 25,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const lineCountText = screen.getByText('25 lines');
      expect(lineCountText).toBeInTheDocument();
      expect(lineCountText).toHaveAttribute('data-font-size', '10');
      expect(lineCountText).toHaveAttribute('data-fill', '#9CA3AF');
      expect(lineCountText).toHaveAttribute('data-align', 'right');
    });

    it('positions line count correctly', () => {
      const card = createCodeCard('positioned-count', {
        dimensions: { width: 400, height: 300 },
        content: {
          ...createCodeCard().content,
          lineCount: 15,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const lineCountText = screen.getByText('15 lines');
      expect(lineCountText).toHaveAttribute('data-x', '340'); // width - 60
      expect(lineCountText).toHaveAttribute('data-y', '8');
    });

    it('handles singular line count', () => {
      const card = createCodeCard('single-line', {
        content: {
          ...createCodeCard().content,
          content: 'console.log("hello");',
          lineCount: 1,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByText('1 lines')).toBeInTheDocument(); // Component uses "lines" regardless
    });
  });

  describe('Filename Display', () => {
    it('displays filename when provided', () => {
      const card = createCodeCard('with-filename', {
        content: {
          ...createCodeCard().content,
          filename: 'app.js',
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const filenameText = screen.getByText('app.js');
      expect(filenameText).toBeInTheDocument();
      expect(filenameText).toHaveAttribute('data-font-size', '11');
      expect(filenameText).toHaveAttribute('data-font-family', 'Inter, monospace');
      expect(filenameText).toHaveAttribute('data-fill', '#A0A0A0');
      expect(filenameText).toHaveAttribute('data-ellipsis', 'true');
    });

    it('does not display filename when not provided', () => {
      const card = createCodeCard('no-filename', {
        content: {
          ...createCodeCard().content,
          filename: undefined,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Filename is not displayed - should not find example.js text
      expect(screen.queryByText('example.js')).not.toBeInTheDocument();
    });

    it('positions filename correctly after language', () => {
      const card = createCodeCard('positioned-filename');
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const filenameText = screen.getByText('example.js');
      expect(filenameText).toHaveAttribute('data-x', '104'); // headerArea.x + langWidth + 12
    });
  });

  describe('Execution Status Indicators', () => {
    it('displays executed status when hasExecuted is true', () => {
      const card = createCodeCard('executed', {
        content: {
          ...createCodeCard().content,
          hasExecuted: true,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByText('RUN')).toBeInTheDocument();

      const rects = screen.getAllByTestId('konva-rect');
      const executedRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#10B981' && // Green for executed
        rect.getAttribute('data-width') === '40'
      );
      expect(executedRect).toBeInTheDocument();
    });

    it('displays code status when hasExecuted is false', () => {
      const card = createCodeCard('not-executed', {
        content: {
          ...createCodeCard().content,
          hasExecuted: false,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByText('CODE')).toBeInTheDocument();

      const rects = screen.getAllByTestId('konva-rect');
      const codeRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#6B7280' && // Gray for not executed
        rect.getAttribute('data-width') === '40'
      );
      expect(codeRect).toBeInTheDocument();
    });

    it('does not display execution status when hasExecuted is undefined', () => {
      const card = createCodeCard('no-execution-info', {
        content: {
          ...createCodeCard().content,
          hasExecuted: undefined,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.queryByText('RUN')).not.toBeInTheDocument();
      expect(screen.queryByText('CODE')).not.toBeInTheDocument();
    });

    it('positions execution status correctly', () => {
      const card = createCodeCard('positioned-status', {
        dimensions: { width: 400, height: 300 },
        content: {
          ...createCodeCard().content,
          hasExecuted: true,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const statusText = screen.getByText('RUN');
      expect(statusText).toHaveAttribute('data-x', '342'); // Adjusted for correct positioning
      expect(statusText).toHaveAttribute('data-y', '18'); // headerArea.y + 6
    });
  });

  describe('Execution Results', () => {
    it('displays execution results footer when present', () => {
      const card = createCodeCard('with-results', {
        content: {
          ...createCodeCard().content,
          executionResults: {
            output: 'Hello, World!',
            error: undefined,
            timestamp: '2024-01-15T10:30:00Z',
          },
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByText('SUCCESS')).toBeInTheDocument();

      // Should have success background color
      const rects = screen.getAllByTestId('konva-rect');
      const successRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#1E3A8A' // Blue for success
      );
      expect(successRect).toBeInTheDocument();
    });

    it('displays error results with error styling', () => {
      const card = createCodeCard('with-error', {
        content: {
          ...createCodeCard().content,
          executionResults: {
            output: undefined,
            error: 'ReferenceError: x is not defined',
            timestamp: '2024-01-15T10:30:00Z',
          },
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByText('ERROR')).toBeInTheDocument();

      // Should have error background color
      const rects = screen.getAllByTestId('konva-rect');
      const errorRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#7F1D1D' // Red for error
      );
      expect(errorRect).toBeInTheDocument();
    });

    it('displays execution timestamp', () => {
      const card = createCodeCard('with-timestamp', {
        content: {
          ...createCodeCard().content,
          executionResults: {
            output: 'Result',
            error: undefined,
            timestamp: '2024-01-15T10:30:00Z',
          },
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Look for text that starts with "Executed:"
      const texts = screen.getAllByTestId('konva-text');
      const timestampText = texts.find(text =>
        text.getAttribute('data-text')?.startsWith('Executed:')
      );

      expect(timestampText).toBeInTheDocument();
      expect(timestampText).toHaveAttribute('data-font-size', '9');
      expect(timestampText).toHaveAttribute('data-fill', '#A0A0A0');
    });

    it('does not display results footer when no execution results', () => {
      const card = createCodeCard('no-results', {
        content: {
          ...createCodeCard().content,
          executionResults: undefined,
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.queryByText('SUCCESS')).not.toBeInTheDocument();
      expect(screen.queryByText('ERROR')).not.toBeInTheDocument();

      const texts = screen.getAllByTestId('konva-text');
      const timestampText = texts.find(text =>
        text.getAttribute('data-text')?.startsWith('Executed:')
      );
      expect(timestampText).toBeUndefined();
    });
  });

  describe('Header Styling', () => {
    it('displays header background', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const headerRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#2D2D2D' &&
        rect.getAttribute('data-corner-radius') === '[8,8,0,0]'
      );
      expect(headerRect).toBeInTheDocument();
    });

    it('positions header correctly', () => {
      const card = createCodeCard('header-position', {
        dimensions: { width: 400, height: 300 },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const headerRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#2D2D2D'
      );

      expect(headerRect).toHaveAttribute('data-x', '0');
      expect(headerRect).toHaveAttribute('data-y', '0');
      expect(headerRect).toHaveAttribute('data-width', '400');
      expect(headerRect).toHaveAttribute('data-height', '40'); // headerHeight + padding
    });
  });

  describe('Selection and Hover States', () => {
    it('applies selection styling when selected', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={true} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Background should have selection border
      const backgroundRect = rects[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#3b82f6');
      expect(backgroundRect).toHaveAttribute('data-stroke-width', '2');

      // Should have selection highlight
      const highlightRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#3b82f6' &&
        rect.getAttribute('data-opacity') === '0.1'
      );
      expect(highlightRect).toBeInTheDocument();
    });

    it('applies hover styling when hovered', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={true} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Background should have hover border
      const backgroundRect = rects[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#93c5fd');

      // Should have hover highlight
      const highlightRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#93c5fd' &&
        rect.getAttribute('data-opacity') === '0.05'
      );
      expect(highlightRect).toBeInTheDocument();
    });

    it('prioritizes selection over hover', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={true} isDragged={false} isHovered={true} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Should use selection styling
      const backgroundRect = rects[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#3b82f6');
    });
  });

  describe('Drag State Visual Feedback', () => {
    it('displays drag indicator when being dragged', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={true} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const dragRect = rects.find(rect =>
        rect.getAttribute('data-stroke') === '#3B82F6' &&
        rect.getAttribute('data-stroke-width') === '2' &&
        rect.getAttribute('data-dash') === '[5,5]' &&
        rect.getAttribute('data-opacity') === '0.8'
      );

      expect(dragRect).toBeInTheDocument();
    });

    it('does not display drag indicator when not being dragged', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const dragRect = rects.find(rect =>
        rect.getAttribute('data-dash') === '[5,5]'
      );

      expect(dragRect).toBeUndefined();
    });
  });

  describe('Shadow Effects', () => {
    it('renders shadow when enabled', () => {
      const card = createCodeCard('with-shadow', {
        style: {
          ...createCodeCard().style,
          shadow: true,
          shadowConfig: {
            color: '#00000035',
            offsetX: 4,
            offsetY: 8,
            blur: 16,
            spread: 0,
          },
        },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const shadowRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#00000035' &&
        rect.getAttribute('data-x') === '4' &&
        rect.getAttribute('data-y') === '8' &&
        rect.getAttribute('data-blur') === '16'
      );

      expect(shadowRect).toBeInTheDocument();
    });

    it('enhances shadow when highlighted', () => {
      const card = createCodeCard('enhanced-shadow', {
        style: {
          ...createCodeCard().style,
          shadow: true,
          shadowConfig: {
            color: '#00000030',
            offsetX: 0,
            offsetY: 4,
            blur: 12,
            spread: 0,
          },
        },
      });

      render(<CodeCardRenderer card={card} isSelected={true} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const shadowRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#00000030' &&
        rect.getAttribute('data-y') === '6' && // offsetY + 2
        rect.getAttribute('data-blur') === '16' // blur + 4
      );

      expect(shadowRect).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles missing content gracefully', () => {
      const card = {
        ...createCodeCard(),
        content: {
          content: '',
          language: 'javascript',
          lineCount: 0,
        },
      } as any;

      expect(() => render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();
    });

    it('handles very small dimensions', () => {
      const card = createCodeCard('tiny-card', {
        dimensions: { width: 150, height: 100 },
      });

      expect(() => render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();
    });

    it('handles missing style properties', () => {
      const card = {
        ...createCodeCard(),
        style: {
          opacity: 1,
        } as any,
      };

      expect(() => render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();
    });

    it('handles single line code', () => {
      const card = createCodeCard('single-line', {
        content: {
          ...createCodeCard().content,
          content: 'console.log("hello");',
          lineCount: 1,
        },
      });

      expect(() => render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.queryByText('2')).not.toBeInTheDocument();
    });

    it('handles empty code content', () => {
      const card = createCodeCard('empty-code', {
        content: {
          ...createCodeCard().content,
          content: '',
          lineCount: 0,
        },
      });

      expect(() => render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();
    });
  });

  describe('Performance and Layout', () => {
    it('calculates layout areas correctly for different sizes', () => {
      const card = createCodeCard('layout-test', {
        dimensions: { width: 600, height: 400 },
      });

      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Code content should be properly positioned
      const codeTexts = screen.getAllByTestId('konva-text');
      const codeText = codeTexts.find(el => el.getAttribute('data-text') === 'console.log("Hello, World!");\nconst x = 42;\nreturn x;');
      expect(codeText).toBeDefined();
      expect(codeText).toHaveAttribute('data-x', '52'); // padding + lineNumberWidth + 8
      expect(codeText).toHaveAttribute('data-width', '536'); // width - padding*2 - lineNumberWidth - 8
    });

    it('handles responsive text sizing', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Font sizes should be consistent
      const codeTexts = screen.getAllByTestId('konva-text');
      const codeText = codeTexts.find(el => el.getAttribute('data-text') === 'console.log("Hello, World!");\nconst x = 42;\nreturn x;');
      expect(codeText).toBeDefined();
      expect(codeText).toHaveAttribute('data-font-size', '12');

      const lineNumber = screen.getByText('1');
      expect(lineNumber).toHaveAttribute('data-font-size', '11');
    });

    it('maintains consistent spacing between elements', () => {
      const card = createCodeCard();
      render(<CodeCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Check line height consistency
      const codeTexts = screen.getAllByTestId('konva-text');
      const codeText = codeTexts.find(el => el.getAttribute('data-text') === 'console.log("Hello, World!");\nconst x = 42;\nreturn x;');
      expect(codeText).toBeDefined();
      expect(codeText).toHaveAttribute('data-line-height', (14/12).toString()); // 14px / 12px
    });
  });
});