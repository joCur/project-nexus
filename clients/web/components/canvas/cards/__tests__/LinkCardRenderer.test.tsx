import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LinkCardRenderer } from '../LinkCardRenderer';
import type { LinkCard, CardId } from '@/types/card.types';

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
  Text: ({ x, y, width, height, text, fontSize, fontFamily, fontStyle, fill, align, verticalAlign, wrap, lineHeight, ellipsis, ...props }: {
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
      data-font-style={fontStyle}
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
  Image: ({ x, y, width, height, image, cornerRadius, ...props }: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    image?: HTMLImageElement;
    cornerRadius?: number;
    [key: string]: unknown;
  }) => (
    <div
      data-testid="konva-image"
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      data-image-src={image?.src}
      data-corner-radius={cornerRadius}
      {...props}
    />
  ),
}));

// Mock HTMLImageElement
class MockHTMLImageElement {
  src = '';
  width = 16;
  height = 16;
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    // Simulate async loading
    setTimeout(() => {
      if (this.src.includes('error') || this.src.includes('fail')) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    }, 10);
  }
}

// Mock window.Image
Object.defineProperty(window, 'Image', {
  value: MockHTMLImageElement,
  writable: true,
});

describe('LinkCardRenderer', () => {
  // Helper to create test link cards
  const createLinkCard = (
    id: string = 'test-link-card',
    overrides: Partial<LinkCard> = {}
  ): LinkCard => ({
    id: id as CardId,
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width: 300, height: 200 },
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
      type: 'link' as const,
      url: 'https://example.com/article',
      title: 'Example Article Title',
      description: 'This is a description of the example article with useful information.',
      domain: 'example.com',
      favicon: 'https://example.com/favicon.ico',
      previewImage: 'https://example.com/preview.jpg',
      isAccessible: true,
      lastChecked: '2024-01-15T10:30:00Z',
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders link card with basic elements', () => {
      const card = createLinkCard();
      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // There can be multiple groups due to nested structure
      const groups = screen.getAllByTestId('konva-group');
      expect(groups.length).toBeGreaterThan(0);

      // Should have background rect
      const rects = screen.getAllByTestId('konva-rect');
      expect(rects.length).toBeGreaterThanOrEqual(1);

      // Should display title and domain
      expect(screen.getByText('Example Article Title')).toBeInTheDocument();
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('renders with correct dimensions', () => {
      const card = createLinkCard('sized-card', {
        dimensions: { width: 350, height: 250 },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-width', '350');
      expect(backgroundRect).toHaveAttribute('data-height', '250');
    });

    it('renders with correct background and border styling', () => {
      const card = createLinkCard('styled-card', {
        style: {
          ...createLinkCard().style,
          backgroundColor: '#F8F9FA',
          borderColor: '#DEE2E6',
          borderWidth: 2,
          borderRadius: 12,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-fill', '#F8F9FA');
      expect(backgroundRect).toHaveAttribute('data-stroke', '#DEE2E6');
      expect(backgroundRect).toHaveAttribute('data-stroke-width', '2');
      expect(backgroundRect).toHaveAttribute('data-corner-radius', '12');
    });
  });

  describe('Link Preview Display', () => {
    it('displays link title with correct styling', () => {
      const card = createLinkCard('title-card', {
        content: {
          ...createLinkCard().content,
          title: 'Amazing Article Title',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const titleText = screen.getByText('Amazing Article Title');
      expect(titleText).toBeInTheDocument();
      expect(titleText).toHaveAttribute('data-font-size', '14');
      expect(titleText).toHaveAttribute('data-font-style', 'bold');
      expect(titleText).toHaveAttribute('data-align', 'left');
      expect(titleText).toHaveAttribute('data-wrap', 'word');
    });

    it('truncates long titles', () => {
      const longTitle = 'This is an extremely long title that should be truncated because it exceeds the maximum character limit';
      const card = createLinkCard('long-title', {
        content: {
          ...createLinkCard().content,
          title: longTitle,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const texts = screen.getAllByTestId('konva-text');
      const titleText = texts.find(text =>
        text.getAttribute('data-font-style') === 'bold' &&
        text.getAttribute('data-font-size') === '14'
      );
      const displayedText = titleText?.getAttribute('data-text') || '';

      expect(displayedText.length).toBeLessThan(longTitle.length);
      expect(displayedText).toMatch(/\.\.\.$/);
    });

    it('displays description when provided', () => {
      const card = createLinkCard('with-description', {
        content: {
          ...createLinkCard().content,
          description: 'This is a detailed description of the article content.',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const descriptionText = screen.getByText('This is a detailed description of the article content.');
      expect(descriptionText).toBeInTheDocument();
      expect(descriptionText).toHaveAttribute('data-font-size', '12');
      expect(descriptionText).toHaveAttribute('data-fill', '#6B7280');
      expect(descriptionText).toHaveAttribute('data-wrap', 'word');
      expect(descriptionText).toHaveAttribute('data-ellipsis', 'true');
    });

    it('does not render description when not provided', () => {
      const card = createLinkCard('no-description', {
        content: {
          ...createLinkCard().content,
          description: undefined,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const texts = screen.getAllByTestId('konva-text');
      const descriptionText = texts.find(text =>
        text.getAttribute('data-font-size') === '12' &&
        text.getAttribute('data-fill') === '#6B7280' &&
        text.getAttribute('data-wrap') === 'word'
      );

      // Should be undefined when no description with matching attributes
      expect(descriptionText).toBeUndefined();
    });

    it('truncates long descriptions', () => {
      const longDescription = 'This is an extremely long description that contains way too much text and should definitely be truncated to fit within the available space in the card layout without overflowing or causing display issues.';
      const card = createLinkCard('long-description', {
        content: {
          ...createLinkCard().content,
          description: longDescription,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const texts = screen.getAllByTestId('konva-text');
      const descriptionText = texts.find(text =>
        text.getAttribute('data-fill') === '#6B7280' &&
        text.getAttribute('data-wrap') === 'word'
      );

      const displayedText = descriptionText?.getAttribute('data-text') || '';
      expect(displayedText.length).toBeLessThan(longDescription.length);
      expect(displayedText).toMatch(/\.\.\.$/);
    });
  });

  describe('Favicon Rendering', () => {
    it('displays favicon when loaded successfully', async () => {
      const card = createLinkCard('with-favicon', {
        content: {
          ...createLinkCard().content,
          favicon: 'https://example.com/success-favicon.ico',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      await waitFor(() => {
        const images = screen.queryAllByTestId('konva-image');
        expect(images.length).toBeGreaterThan(0);
      });

      const faviconImage = screen.getAllByTestId('konva-image').find(img =>
        img.getAttribute('data-width') === '16' &&
        img.getAttribute('data-height') === '16'
      );

      expect(faviconImage).toBeDefined();
      expect(faviconImage).toHaveAttribute('data-image-src', 'https://example.com/success-favicon.ico');
    });

    it('shows placeholder when favicon fails to load', async () => {
      const card = createLinkCard('failed-favicon', {
        content: {
          ...createLinkCard().content,
          favicon: 'https://example.com/error-favicon.ico',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      await waitFor(() => {
        const rects = screen.getAllByTestId('konva-rect');
        const placeholderRect = rects.find(rect =>
          rect.getAttribute('data-width') === '16' &&
          rect.getAttribute('data-height') === '16' &&
          rect.getAttribute('data-fill') === '#E5E7EB'
        );
        expect(placeholderRect).toBeInTheDocument();
      });
    });

    it('shows placeholder when no favicon URL provided', () => {
      const card = createLinkCard('no-favicon', {
        content: {
          ...createLinkCard().content,
          favicon: undefined,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const placeholderRect = rects.find(rect =>
        rect.getAttribute('data-width') === '16' &&
        rect.getAttribute('data-height') === '16' &&
        rect.getAttribute('data-fill') === '#E5E7EB'
      );

      expect(placeholderRect).toBeInTheDocument();
    });

    it('positions favicon correctly in header', () => {
      const card = createLinkCard();

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const faviconRect = rects.find(rect =>
        rect.getAttribute('data-width') === '16' &&
        rect.getAttribute('data-height') === '16'
      );

      expect(faviconRect).toHaveAttribute('data-x', '12'); // padding
      expect(faviconRect).toHaveAttribute('data-y', '16'); // padding + centered in header
    });
  });

  describe('Domain and URL Display', () => {
    it('displays domain in header', () => {
      const card = createLinkCard('domain-card', {
        content: {
          ...createLinkCard().content,
          domain: 'github.com',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const domainText = screen.getByText('github.com');
      expect(domainText).toBeInTheDocument();
      expect(domainText).toHaveAttribute('data-font-size', '12');
      expect(domainText).toHaveAttribute('data-fill', '#6B7280');
      expect(domainText).toHaveAttribute('data-align', 'left');
      expect(domainText).toHaveAttribute('data-ellipsis', 'true');
    });

    it('positions domain text correctly after favicon', () => {
      const card = createLinkCard();

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const domainText = screen.getByText('example.com');
      expect(domainText).toHaveAttribute('data-x', '36'); // padding + faviconSize + 8
    });

    it('displays truncated URL in status area', () => {
      const card = createLinkCard('url-display', {
        content: {
          ...createLinkCard().content,
          url: 'https://example.com/very/long/path/to/article',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const texts = screen.getAllByTestId('konva-text');
      const urlText = texts.find(text =>
        text.getAttribute('data-font-family')?.includes('monospace') &&
        text.getAttribute('data-font-size') === '10'
      );

      expect(urlText).toBeInTheDocument();
      expect(urlText).toHaveAttribute('data-fill', '#9CA3AF');
      expect(urlText).toHaveAttribute('data-ellipsis', 'true');
    });
  });

  describe('Preview Image Handling', () => {
    it('displays preview image when available and loaded', async () => {
      const card = createLinkCard('with-preview', {
        content: {
          ...createLinkCard().content,
          previewImage: 'https://example.com/preview-success.jpg',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      await waitFor(() => {
        const images = screen.getAllByTestId('konva-image');
        const previewImage = images.find(img =>
          img.getAttribute('data-height') === '60' // preview height
        );
        expect(previewImage).toBeInTheDocument();
      });
    });

    it('shows placeholder when preview image fails to load', async () => {
      const card = createLinkCard('failed-preview', {
        content: {
          ...createLinkCard().content,
          previewImage: 'https://example.com/preview-error.jpg',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      await waitFor(() => {
        const rects = screen.getAllByTestId('konva-rect');
        const placeholderRect = rects.find(rect =>
          rect.getAttribute('data-height') === '60' &&
          rect.getAttribute('data-fill') === '#F3F4F6'
        );
        expect(placeholderRect).toBeInTheDocument();
      });
    });

    it('does not render preview area when no preview image', () => {
      const card = createLinkCard('no-preview', {
        content: {
          ...createLinkCard().content,
          previewImage: undefined,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const previewRect = rects.find(rect =>
        rect.getAttribute('data-height') === '60'
      );

      // Should be undefined when no preview rect found
      expect(previewRect).toBeUndefined();
    });

    it('positions preview image correctly', async () => {
      const card = createLinkCard('positioned-preview');

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      await waitFor(() => {
        const images = screen.getAllByTestId('konva-image');
        const previewImage = images.find(img =>
          img.getAttribute('data-height') === '60'
        );

        if (previewImage) {
          expect(previewImage).toHaveAttribute('data-x', '12'); // padding
          expect(previewImage).toHaveAttribute('data-y', '40'); // padding + headerHeight + 4
        }
      });
    });
  });

  describe('Accessibility Indicators', () => {
    it('displays green indicator for accessible links', () => {
      const card = createLinkCard('accessible-link', {
        content: {
          ...createLinkCard().content,
          isAccessible: true,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const accessibilityRect = rects.find(rect =>
        rect.getAttribute('data-width') === '8' &&
        rect.getAttribute('data-height') === '8' &&
        rect.getAttribute('data-fill') === '#10B981'
      );

      expect(accessibilityRect).toBeInTheDocument();
    });

    it('displays red indicator for inaccessible links', () => {
      const card = createLinkCard('inaccessible-link', {
        content: {
          ...createLinkCard().content,
          isAccessible: false,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const accessibilityRect = rects.find(rect =>
        rect.getAttribute('data-width') === '8' &&
        rect.getAttribute('data-height') === '8' &&
        rect.getAttribute('data-fill') === '#EF4444'
      );

      expect(accessibilityRect).toBeInTheDocument();
    });

    it('applies red border for inaccessible links', () => {
      const card = createLinkCard('inaccessible-border', {
        content: {
          ...createLinkCard().content,
          isAccessible: false,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#EF4444');
    });

    it('uses normal border for accessible links', () => {
      const card = createLinkCard('accessible-border', {
        content: {
          ...createLinkCard().content,
          isAccessible: true,
        },
        style: {
          ...createLinkCard().style,
          borderColor: '#E5E7EB',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#E5E7EB');
    });
  });

  describe('Last Checked Date', () => {
    it('displays last checked date when provided', () => {
      const card = createLinkCard('with-date', {
        content: {
          ...createLinkCard().content,
          lastChecked: '2024-01-15T10:30:00Z',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Check for date format (will vary based on locale)
      const texts = screen.getAllByTestId('konva-text');
      const dateText = texts.find(text =>
        text.getAttribute('data-font-size') === '9' &&
        text.getAttribute('data-align') === 'right'
      );

      expect(dateText).toBeInTheDocument();
      expect(dateText).toHaveAttribute('data-fill', '#9CA3AF');
    });

    it('does not display date when not provided', () => {
      const card = createLinkCard('no-date', {
        content: {
          ...createLinkCard().content,
          lastChecked: undefined,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const texts = screen.getAllByTestId('konva-text');
      const dateText = texts.find(text =>
        text.getAttribute('data-font-size') === '9' &&
        text.getAttribute('data-align') === 'right'
      );

      // Should be undefined when no date text with matching attributes
      expect(dateText).toBeUndefined();
    });

    it('positions date correctly in status area', () => {
      const card = createLinkCard('positioned-date', {
        dimensions: { width: 300, height: 200 },
        content: {
          ...createLinkCard().content,
          lastChecked: '2024-01-15T10:30:00Z',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const texts = screen.getAllByTestId('konva-text');
      const dateText = texts.find(text =>
        text.getAttribute('data-font-size') === '9'
      );

      expect(dateText).toHaveAttribute('data-x', '228'); // Actual calculated position
      expect(dateText).toHaveAttribute('data-width', '60');
    });
  });

  describe('External Link Indicator', () => {
    it('displays external link indicator', () => {
      const card = createLinkCard();

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const externalText = screen.getByText('↗');
      expect(externalText).toBeInTheDocument();
      expect(externalText).toHaveAttribute('data-font-size', '8');
      expect(externalText).toHaveAttribute('data-fill', 'white');
      expect(externalText).toHaveAttribute('data-align', 'center');

      const rects = screen.getAllByTestId('konva-rect');
      const externalRect = rects.find(rect =>
        rect.getAttribute('data-width') === '16' &&
        rect.getAttribute('data-height') === '12' &&
        rect.getAttribute('data-fill') === '#6B7280'
      );
      expect(externalRect).toBeInTheDocument();
    });

    it('positions external link indicator correctly', () => {
      const card = createLinkCard('positioned-external', {
        dimensions: { width: 300, height: 200 },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const externalText = screen.getByText('↗');
      expect(externalText).toHaveAttribute('data-x', '278'); // width - 22
      expect(externalText).toHaveAttribute('data-y', '10');

      const rects = screen.getAllByTestId('konva-rect');
      const externalRect = rects.find(rect =>
        rect.getAttribute('data-width') === '16' &&
        rect.getAttribute('data-height') === '12' &&
        rect.getAttribute('data-fill') === '#6B7280'
      );
      expect(externalRect).toHaveAttribute('data-x', '276'); // width - 24
      expect(externalRect).toHaveAttribute('data-y', '8');
    });
  });

  describe('Selection and Hover States', () => {
    it('applies selection styling when selected', () => {
      const card = createLinkCard();
      render(<LinkCardRenderer card={card} isSelected={true} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Background should have selection border
      const backgroundRect = rects[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#3B82F6');
      expect(backgroundRect).toHaveAttribute('data-stroke-width', '2');

      // Should have selection highlight
      const highlightRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#3B82F6' &&
        rect.getAttribute('data-opacity') === '0.1'
      );
      expect(highlightRect).toBeInTheDocument();
    });

    it('applies hover styling when hovered', () => {
      const card = createLinkCard();
      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={true} />);

      const rects = screen.getAllByTestId('konva-rect');

      // Background should have hover border
      const backgroundRect = rects[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#6B7280');

      // Should have hover highlight
      const highlightRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#6B7280' &&
        rect.getAttribute('data-opacity') === '0.05'
      );
      expect(highlightRect).toBeInTheDocument();
    });

    it('prioritizes selection over hover and accessibility', () => {
      const card = createLinkCard('priority-test', {
        content: {
          ...createLinkCard().content,
          isAccessible: false, // Would normally show red border
        },
      });

      render(<LinkCardRenderer card={card} isSelected={true} isDragged={false} isHovered={true} />);

      const backgroundRect = screen.getAllByTestId('konva-rect')[0];
      expect(backgroundRect).toHaveAttribute('data-stroke', '#3B82F6'); // Selection wins
    });
  });

  describe('Drag State Visual Feedback', () => {
    it('displays drag indicator when being dragged', () => {
      const card = createLinkCard();
      render(<LinkCardRenderer card={card} isSelected={false} isDragged={true} isHovered={false} />);

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
      const card = createLinkCard();
      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const dragRect = rects.find(rect =>
        rect.getAttribute('data-dash') === '[5,5]'
      );

      // Should be undefined when no drag rect found
      expect(dragRect).toBeUndefined();
    });
  });

  describe('Shadow Effects', () => {
    it('renders shadow when enabled', () => {
      const card = createLinkCard('with-shadow', {
        style: {
          ...createLinkCard().style,
          shadow: true,
          shadowConfig: {
            color: '#00000025',
            offsetX: 2,
            offsetY: 4,
            blur: 12,
            spread: 0,
          },
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const shadowRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#00000025' &&
        rect.getAttribute('data-x') === '2' &&
        rect.getAttribute('data-y') === '4' &&
        rect.getAttribute('data-blur') === '12'
      );

      expect(shadowRect).toBeInTheDocument();
    });

    it('enhances shadow when highlighted', () => {
      const card = createLinkCard('enhanced-shadow', {
        style: {
          ...createLinkCard().style,
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

      render(<LinkCardRenderer card={card} isSelected={true} isDragged={false} isHovered={false} />);

      const rects = screen.getAllByTestId('konva-rect');
      const shadowRect = rects.find(rect =>
        rect.getAttribute('data-fill') === '#00000020' &&
        rect.getAttribute('data-y') === '4' && // offsetY + 2
        rect.getAttribute('data-blur') === '12' // blur + 4
      );

      expect(shadowRect).toBeInTheDocument();
    });
  });

  describe('Layout and Positioning', () => {
    it('calculates content areas correctly', () => {
      const card = createLinkCard('layout-test', {
        dimensions: { width: 400, height: 300 },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Title should be positioned in content area
      const titleText = screen.getByText('Example Article Title');
      expect(titleText).toHaveAttribute('data-x', '12'); // padding
      expect(titleText).toHaveAttribute('data-width', '376'); // width - padding * 2
    });

    it('adjusts layout when preview image is present', () => {
      const card = createLinkCard('with-preview-layout', {
        content: {
          ...createLinkCard().content,
          previewImage: 'https://example.com/preview.jpg',
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Title should be positioned lower when preview is present
      const titleText = screen.getByText('Example Article Title');
      const titleY = parseInt(titleText.getAttribute('data-y') || '0');
      expect(titleY).toBeGreaterThan(40); // Should be below preview area
    });

    it('adjusts layout when no preview image', () => {
      const card = createLinkCard('no-preview-layout', {
        content: {
          ...createLinkCard().content,
          previewImage: undefined,
        },
      });

      render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Title should be positioned higher when no preview
      const titleText = screen.getByText('Example Article Title');
      const titleY = parseInt(titleText.getAttribute('data-y') || '0');
      expect(titleY).toBeLessThan(50); // Should be closer to header
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles missing content gracefully', () => {
      const card = {
        ...createLinkCard(),
        content: {
          url: '',
          title: '',
          domain: '',
          isAccessible: true,
        },
      } as any;

      expect(() => render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();
    });

    it('handles very small dimensions', () => {
      const card = createLinkCard('tiny-card', {
        dimensions: { width: 100, height: 80 },
      });

      expect(() => render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();
    });

    it('handles missing style properties', () => {
      const card = {
        ...createLinkCard(),
        style: {
          opacity: 1,
        } as any,
      };

      expect(() => render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();
    });

    it('handles invalid date strings', () => {
      const card = createLinkCard('invalid-date', {
        content: {
          ...createLinkCard().content,
          lastChecked: 'invalid-date-string',
        },
      });

      expect(() => render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />)).not.toThrow();
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('cleans up image references on unmount', () => {
      const card = createLinkCard();
      const { unmount } = render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });

    it('handles URL changes correctly', () => {
      const card = createLinkCard('changing-url', {
        content: {
          ...createLinkCard().content,
          favicon: 'https://example.com/first-favicon.ico',
        },
      });

      const { rerender } = render(<LinkCardRenderer card={card} isSelected={false} isDragged={false} isHovered={false} />);

      // Change the favicon URL
      const updatedCard = {
        ...card,
        content: {
          ...card.content,
          favicon: 'https://example.com/second-favicon.ico',
        },
      };

      rerender(<LinkCardRenderer card={updatedCard} isSelected={false} isDragged={false} isHovered={false} />);

      // Should handle the change without errors
      // There can be multiple groups due to nested structure
      const groups = screen.getAllByTestId('konva-group');
      expect(groups.length).toBeGreaterThan(0);
    });
  });
});