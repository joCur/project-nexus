import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextCardRenderer } from '../TextCardRenderer';
import type { TextCard } from '@/types/card.types';

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
    cornerRadius?: number;
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
      data-corner-radius={cornerRadius}
      data-opacity={opacity}
      data-blur={blur}
      data-dash={JSON.stringify(dash)}
      {...props}
    />
  ),
  Text: ({ x, y, width, height, text, fontSize, fontFamily, fill, align, verticalAlign, wrap, lineHeight, ellipsis, ...props }: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fill?: string;
    align?: string;
    verticalAlign?: string;
    wrap?: string;
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
      data-fill={fill}
      data-align={align}
      data-vertical-align={verticalAlign}
      data-wrap={wrap}
      data-line-height={lineHeight}
      data-ellipsis={ellipsis}
      {...props}
    >
      {text}
    </div>
  ),
}));

describe('TextCardRenderer', () => {
  // Helper to create test text cards
  const createTextCard = (
    id: string = 'test-card',
    overrides: Partial<TextCard> = {}
  ): TextCard => ({
    id,
    type: 'text',
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width: 200, height: 150 },
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
      content: 'Test text content',
      text: 'Test text content',
      markdown: false,
      isMarkdown: false,
      wordCount: 3,
    },
    isHidden: false,
    isLocked: false,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ...overrides,
  });

  describe('Basic Rendering', () => {
    it('renders text card with basic elements', () => {
      const card = createTextCard();
      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      expect(screen.getByTestId('konva-group')).toBeInTheDocument();

      // Should have background rect and text
      const rects = screen.getAllByTestId('konva-rect');
      const texts = screen.getAllByTestId('konva-text');

      expect(rects.length).toBeGreaterThanOrEqual(1); // At least background
      expect(texts.length).toBeGreaterThanOrEqual(1); // At least main text
    });

    it('renders with correct dimensions', () => {
      const card = createTextCard('sized-card', {
        dimensions: { width: 300, height: 200 },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-width', '300');
      expect(backgroundRect).toHaveAttribute('data-height', '200');
    });

    it('renders with correct background color', () => {
      const card = createTextCard('colored-card', {
        style: {
          ...createTextCard().style,
          backgroundColor: '#FF0000',
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-fill', '#FF0000');
    });

    it('renders with correct border properties', () => {
      const card = createTextCard('bordered-card', {
        style: {
          ...createTextCard().style,
          borderColor: '#00FF00',
          borderWidth: 3,
          borderRadius: 12,
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#00FF00');
      expect(backgroundRect).toHaveAttribute('data-stroke-width', '3');
      expect(backgroundRect).toHaveAttribute('data-corner-radius', '12');
    });
  });

  describe('Text Content Rendering', () => {
    it('renders text content with proper formatting', () => {
      const card = createTextCard('text-card', {
        content: {
          content: 'Hello, World!',
          text: 'Hello, World!',
          markdown: false,
          isMarkdown: false,
          wordCount: 2,
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const textElement = screen.getByTestId('konva-text');
      expect(textElement).toHaveAttribute('data-text', 'Hello, World!');
      expect(textElement).toHaveAttribute('data-wrap', 'word');
      expect(textElement).toHaveAttribute('data-ellipsis', 'true');
    });

    it('calculates font size based on card dimensions', () => {
      const smallCard = createTextCard('small-card', {
        dimensions: { width: 100, height: 100 },
      });

      const largeCard = createTextCard('large-card', {
        dimensions: { width: 400, height: 300 },
      });

      const { rerender } = render(<TextCardRenderer card={smallCard} isSelected={false} isDragged={false} isHovered={false} />);
      const smallText = screen.getByTestId('konva-text');
      const smallFontSize = parseInt(smallText.getAttribute('data-font-size') || '0');

      rerender(<TextCardRenderer card={largeCard} isSelected={false} isDragged={false} isHovered={false} />);
      const largeText = screen.getByTestId('konva-text');
      const largeFontSize = parseInt(largeText.getAttribute('data-font-size') || '0');

      expect(largeFontSize).toBeGreaterThan(smallFontSize);
      expect(smallFontSize).toBeGreaterThanOrEqual(12); // Minimum font size
      expect(largeFontSize).toBeLessThanOrEqual(18); // Maximum font size
    });

    it('applies proper text positioning with padding', () => {
      const card = createTextCard();
      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const textElement = screen.getByTestId('konva-text');
      expect(textElement).toHaveAttribute('data-x', '16'); // padding
      expect(textElement).toHaveAttribute('data-y', '16'); // padding

      const expectedWidth = 200 - (16 * 2); // card width minus padding
      const expectedHeight = 150 - (16 * 2); // card height minus padding
      expect(textElement).toHaveAttribute('data-width', expectedWidth.toString());
      expect(textElement).toHaveAttribute('data-height', expectedHeight.toString());
    });

    it('uses correct text color from style', () => {
      const card = createTextCard('colored-text', {
        style: {
          ...createTextCard().style,
          textColor: '#FF0000',
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const textElement = screen.getByTestId('konva-text');
      expect(textElement).toHaveAttribute('data-fill', '#FF0000');
    });

    it('uses Inter font family', () => {
      const card = createTextCard();
      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const textElement = screen.getByTestId('konva-text');
      expect(textElement).toHaveAttribute('data-font-family', "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif");
    });

    it('truncates long text content', () => {
      const longText = 'This is a very long text content that should be truncated when it exceeds the available space in the card. It contains many words that cannot fit in a small card.';
      const card = createTextCard('long-text', {
        dimensions: { width: 150, height: 100 },
        content: {
          content: longText,
          text: longText,
          markdown: false,
          isMarkdown: false,
          wordCount: longText.split(' ').length,
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const textElement = screen.getByTestId('konva-text');
      const displayedText = textElement.getAttribute('data-text') || '';

      expect(displayedText.length).toBeLessThan(longText.length);
      expect(displayedText).toMatch(/\.\.\.$/); // Should end with ellipsis
    });
  });

  describe('Markdown Support', () => {
    it('displays markdown indicator when markdown is enabled', () => {
      const card = createTextCard('markdown-card', {
        content: {
          content: '# Markdown Title\nSome **bold** text.',
          text: '# Markdown Title\nSome **bold** text.',
          markdown: true,
          isMarkdown: true,
          wordCount: 4,
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const texts = screen.getAllByTestId('konva-text');

      // Should have markdown indicator rect
      const markdownRect = rects.find(rect =>
        rect.getAttribute('data-width') === '16' &&
        rect.getAttribute('data-height') === '12' &&
        rect.getAttribute('data-fill') === '#6B7280'
      );
      expect(markdownRect).toBeInTheDocument();

      // Should have markdown "M" text
      const markdownText = texts.find(text =>
        text.getAttribute('data-text') === 'M' &&
        text.getAttribute('data-font-size') === '8'
      );
      expect(markdownText).toBeInTheDocument();
    });

    it('does not display markdown indicator for plain text', () => {
      const card = createTextCard('plain-text', {
        content: {
          content: 'Plain text content',
          text: 'Plain text content',
          markdown: false,
          isMarkdown: false,
          wordCount: 3,
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const texts = screen.getAllByTestId('konva-text');

      // Should not have markdown "M" text
      const markdownText = texts.find(text => text.getAttribute('data-text') === 'M');
      expect(markdownText).toBeUndefined();
    });

    it('positions markdown indicator correctly', () => {
      const card = createTextCard('positioned-markdown', {
        dimensions: { width: 300, height: 200 },
        content: {
          content: 'Markdown content',
          text: 'Markdown content',
          markdown: true,
          isMarkdown: true,
          wordCount: 2,
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const texts = screen.getAllByTestId('konva-text');

      const markdownRect = rects.find(rect =>
        rect.getAttribute('data-width') === '16' &&
        rect.getAttribute('data-height') === '12'
      );
      expect(markdownRect).toHaveAttribute('data-x', (300 - 24).toString()); // width - 24
      expect(markdownRect).toHaveAttribute('data-y', '8');

      const markdownText = texts.find(text => text.getAttribute('data-text') === 'M');
      expect(markdownText).toHaveAttribute('data-x', (300 - 22).toString()); // width - 22
      expect(markdownText).toHaveAttribute('data-y', '10');
    });
  });

  describe('Word Count Display', () => {
    it('displays word count for long content', () => {
      const card = createTextCard('long-content', {
        content: {
          content: 'This is a very long text with many words that exceeds one hundred words in total length.',
          text: 'This is a very long text with many words that exceeds one hundred words in total length.',
          markdown: false,
          isMarkdown: false,
          wordCount: 150, // Over 100 words
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const texts = screen.getAllByTestId('konva-text');
      const wordCountText = texts.find(text =>
        text.getAttribute('data-text') === '150 words'
      );

      expect(wordCountText).toBeInTheDocument();
      expect(wordCountText).toHaveAttribute('data-font-size', '10');
      expect(wordCountText).toHaveAttribute('data-fill', '#9CA3AF');
      expect(wordCountText).toHaveAttribute('data-align', 'right');
    });

    it('does not display word count for short content', () => {
      const card = createTextCard('short-content', {
        content: {
          content: 'Short text',
          text: 'Short text',
          markdown: false,
          isMarkdown: false,
          wordCount: 2, // Under 100 words
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const texts = screen.getAllByTestId('konva-text');
      const wordCountText = texts.find(text =>
        text.getAttribute('data-text')?.includes('words')
      );

      expect(wordCountText).toBeUndefined();
    });

    it('positions word count indicator correctly', () => {
      const card = createTextCard('positioned-word-count', {
        dimensions: { width: 300, height: 200 },
        content: {
          content: 'Long content',
          text: 'Long content',
          markdown: false,
          isMarkdown: false,
          wordCount: 120,
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const texts = screen.getAllByTestId('konva-text');
      const wordCountText = texts.find(text =>
        text.getAttribute('data-text') === '120 words'
      );

      expect(wordCountText).toHaveAttribute('data-x', (300 - 60).toString()); // width - 60
      expect(wordCountText).toHaveAttribute('data-y', (200 - 20).toString()); // height - 20
    });
  });

  describe('Selection State Visual Feedback', () => {
    it('applies selection styling when selected', () => {
      const card = createTextCard();
      render(<TextCardRenderer card={card} isSelected={true} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Background rect should have selection border
      const backgroundRect = rects[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#3B82F6'); // Blue selection
      expect(backgroundRect).toHaveAttribute('data-stroke-width', '2'); // Enhanced border

      // Should have selection highlight overlay
      const highlightRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#3B82F6' &&
        rect.getAttribute('data-opacity') === '0.1'
      );
      expect(highlightRect).toBeInTheDocument();
    });

    it('applies hover styling when hovered', () => {
      const card = createTextCard();
      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={true} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Background rect should have hover border
      const backgroundRect = rects[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#6B7280'); // Gray hover

      // Should have hover highlight overlay
      const highlightRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#6B7280' &&
        rect.getAttribute('data-opacity') === '0.05'
      );
      expect(highlightRect).toBeInTheDocument();
    });

    it('prioritizes selection over hover styling', () => {
      const card = createTextCard();
      render(<TextCardRenderer card={card} isSelected={true} isDragged={false} isHovered={true} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Should use selection color, not hover
      const backgroundRect = rects[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#3B82F6'); // Selection blue

      // Should have selection highlight, not hover
      const highlightRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#3B82F6' &&
        rect.getAttribute('data-opacity') === '0.1'
      );
      expect(highlightRect).toBeInTheDocument();
    });

    it('maintains minimum border width for selection', () => {
      const card = createTextCard('thin-border', {
        style: {
          ...createTextCard().style,
          borderWidth: 0.5,
        },
      });

      render(<TextCardRenderer card={card} isSelected={true} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-stroke-width', '2'); // Should be at least 2
    });

    it('preserves larger border width for selection', () => {
      const card = createTextCard('thick-border', {
        style: {
          ...createTextCard().style,
          borderWidth: 4,
        },
      });

      render(<TextCardRenderer card={card} isSelected={true} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-stroke-width', '4'); // Should preserve original
    });
  });

  describe('Drag State Visual Feedback', () => {
    it('displays drag indicator when being dragged', () => {
      const card = createTextCard();
      render(<TextCardRenderer card={card} isSelected={false} isDragged={true} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Should have dashed border for drag feedback
      const dragRect = rects.find(rect =>
        rect.getAttribute('data-stroke') === '#3B82F6' &&
        rect.getAttribute('data-stroke-width') === '2' &&
        rect.getAttribute('data-dash') === '[5,5]' &&
        rect.getAttribute('data-opacity') === '0.8'
      );

      expect(dragRect).toBeInTheDocument();
    });

    it('does not display drag indicator when not being dragged', () => {
      const card = createTextCard();
      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Should not have dashed border
      const dragRect = rects.find(rect =>
        rect.getAttribute('data-dash') === '[5,5]'
      );

      expect(dragRect).toBeUndefined();
    });

    it('positions drag indicator correctly', () => {
      const card = createTextCard('dragged-card', {
        dimensions: { width: 250, height: 180 },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={true} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const dragRect = rects.find(rect =>
        rect.getAttribute('data-dash') === '[5,5]'
      );

      expect(dragRect).toHaveAttribute('data-x', '0');
      expect(dragRect).toHaveAttribute('data-y', '0');
      expect(dragRect).toHaveAttribute('data-width', '250');
      expect(dragRect).toHaveAttribute('data-height', '180');
    });
  });

  describe('Shadow Effects', () => {
    it('renders drop shadow when enabled', () => {
      const card = createTextCard('shadowed-card', {
        style: {
          ...createTextCard().style,
          shadow: true,
          shadowConfig: {
            color: '#00000030',
            offsetX: 2,
            offsetY: 4,
            blur: 12,
            spread: 0,
          },
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Should have shadow rect
      const shadowRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#00000030' &&
        rect.getAttribute('data-x') === '2' &&
        rect.getAttribute('data-y') === '4' &&
        rect.getAttribute('data-blur') === '12'
      );

      expect(shadowRect).toBeInTheDocument();
    });

    it('does not render shadow when disabled', () => {
      const card = createTextCard('no-shadow', {
        style: {
          ...createTextCard().style,
          shadow: false,
        },
      });

      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Should not have shadow rect with blur
      const shadowRect = rects.find(rect =>
        rect.getAttribute('data-blur') !== null
      );

      expect(shadowRect).toBeUndefined();
    });

    it('enhances shadow when highlighted', () => {
      const card = createTextCard('enhanced-shadow', {
        style: {
          ...createTextCard().style,
          shadow: true,
          shadowConfig: {
            color: '#00000020',
            offsetX: 0,
            offsetY: 2,
            blur: 8,
            spread: 0,
          },
        },
      });

      render(<TextCardRenderer card={card} isSelected={true} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Should have enhanced shadow
      const shadowRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#00000020' &&
        rect.getAttribute('data-y') === '4' && // offsetY + 2
        rect.getAttribute('data-blur') === '12' // blur + 4
      );

      expect(shadowRect).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles missing content gracefully', () => {
      const card = {
        ...createTextCard(),
        content: {
          content: '',
          text: '',
          markdown: false,
          isMarkdown: false,
          wordCount: 0,
        },
      };

      expect(() => render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();

      const textElement = screen.getByTestId('konva-text');
      expect(textElement).toHaveAttribute('data-text', '');
    });

    it('handles very small dimensions', () => {
      const card = createTextCard('tiny-card', {
        dimensions: { width: 50, height: 30 },
      });

      expect(() => render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();

      const textElement = screen.getByTestId('konva-text');
      const fontSize = parseInt(textElement.getAttribute('data-font-size') || '0');
      expect(fontSize).toBeGreaterThanOrEqual(12); // Should enforce minimum
    });

    it('handles undefined shadow config', () => {
      const card = createTextCard('no-shadow-config', {
        style: {
          ...createTextCard().style,
          shadow: true,
          shadowConfig: undefined,
        },
      });

      expect(() => render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();
    });

    it('handles missing style properties', () => {
      const card = {
        ...createTextCard(),
        style: {
          opacity: 1,
        } as any,
      };

      expect(() => render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();
    });
  });

  describe('Performance Optimizations', () => {
    it('calculates text metrics efficiently', () => {
      const card = createTextCard();

      const renderStart = performance.now();
      render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);
      const renderTime = performance.now() - renderStart;

      // Should render quickly (under 50ms in most cases)
      expect(renderTime).toBeLessThan(100);
    });

    it('handles state changes without full re-render', () => {
      const card = createTextCard();

      const { rerender } = render(<TextCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);
      const firstRender = screen.getByTestId('konva-group');

      rerender(<TextCardRenderer card={card} isSelected={true} isDragged={false} isHovered={false} />);
      const secondRender = screen.getByTestId('konva-group');

      // Component should be efficiently updated
      expect(firstRender).toBe(secondRender);
    });
  });
});