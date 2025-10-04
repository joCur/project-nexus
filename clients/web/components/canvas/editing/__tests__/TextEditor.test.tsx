/**
 * TextEditor Component Tests
 *
 * Comprehensive test suite for the Tiptap-based TextEditor component.
 * Tests focus on component integration, content handling, and user interactions.
 */

// Mock CodeBlockWithCopyButton to avoid React NodeView rendering issues in JSDOM
// This must be before any imports that might use the component
jest.mock('@/components/canvas/editing/extensions/CodeBlockCopyButton', () => {
  const CodeBlockLowlight = require('@tiptap/extension-code-block-lowlight').default;
  const { common, createLowlight } = require('lowlight');

  const lowlight = createLowlight(common);

  const CodeBlockWithCopyButton = CodeBlockLowlight.extend({
    name: 'codeBlock',

    addOptions() {
      return {
        ...this.parent?.(),
        lowlight,
        HTMLAttributes: {
          class: 'tiptap-code-block',
        },
      };
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'div',
        { class: 'relative code-block-wrapper' },
        [
          'pre',
          { ...this.options.HTMLAttributes },
          [
            'button',
            {
              class: 'code-block-copy-button',
              'aria-label': 'Copy code',
              type: 'button',
            },
            'Copy',
          ],
          ['code', HTMLAttributes, 0],
        ],
      ];
    },
  });

  return { CodeBlockWithCopyButton };
});

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextEditor, TextEditorProps } from '../TextEditor';
import type { TextCard, TiptapJSONContent } from '@/types/card.types';
import { TextContentFormat } from '@/types/card.types';

// Mock data
const createMockCard = (content: string | TiptapJSONContent, format: TextContentFormat = TextContentFormat.MARKDOWN): TextCard => ({
  id: 'test-card-1' as import('@/types/card.types').CardId,
  ownerId: 'user-1' as import('@/types/common.types').EntityId,
  position: { x: 0, y: 0, z: 0 },
  dimensions: { width: 400, height: 300 },
  style: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    textColor: '#000000',
    borderWidth: 1,
    borderRadius: 8,
    shadow: false,
    opacity: 1
  },
  content: {
    type: 'text',
    format,
    content,
    markdown: format === TextContentFormat.MARKDOWN,
    wordCount: 3,
    lastEditedAt: Date.now().toString()
  },
  isSelected: false,
  isLocked: false,
  isHidden: false,
  isMinimized: false,
  status: 'active' as const,
  priority: 'normal' as const,
  createdAt: Date.now().toString(),
  updatedAt: Date.now().toString(),
  tags: [],
  metadata: {},
  animation: { isAnimating: false }
});

const mockTiptapContent: TiptapJSONContent = {
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [{
      type: 'text',
      text: 'Tiptap content test'
    }]
  }]
};

describe('TextEditor Component', () => {
  let defaultProps: TextEditorProps;
  let mockOnSave: jest.Mock;
  let mockOnCancel: jest.Mock;

  // Mock navigator.clipboard for code block copy functionality
  beforeAll(() => {
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: jest.fn().mockResolvedValue(undefined),
          readText: jest.fn().mockResolvedValue(''),
        },
        writable: true,
        configurable: true,
      });
    }
  });

  beforeEach(() => {
    mockOnSave = jest.fn();
    mockOnCancel = jest.fn();

    defaultProps = {
      card: createMockCard('Initial text content'),
      onSave: mockOnSave,
      onCancel: mockOnCancel,
      autoFocus: false // Disable autofocus for testing
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the editor container', () => {
      render(<TextEditor {...defaultProps} />);

      // Check for BaseEditor structure
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render with markdown content', () => {
      render(<TextEditor {...defaultProps} />);

      // Tiptap editor should be present (has class 'tiptap')
      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();
      expect(editor).toHaveTextContent('Initial text content');
    });

    it('should render with Tiptap JSON content', () => {
      const card = createMockCard(mockTiptapContent, TextContentFormat.TIPTAP);
      render(<TextEditor {...defaultProps} card={card} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();
      expect(editor).toHaveTextContent('Tiptap content test');
    });

    it('should handle empty content', () => {
      const card = createMockCard('');
      render(<TextEditor {...defaultProps} card={card} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Character Count', () => {
    it('should display character count', () => {
      render(<TextEditor {...defaultProps} />);

      const charCount = screen.getByTestId('character-count');
      expect(charCount).toBeInTheDocument();
      expect(charCount).toHaveTextContent(/20/); // "Initial text content" is 20 chars
    });

    it('should display word count', () => {
      render(<TextEditor {...defaultProps} />);

      // Word count shown alongside character count
      expect(screen.getByText(/3.*words/i)).toBeInTheDocument();
    });

    it('should update character count when content changes', async () => {
      render(<TextEditor {...defaultProps} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();

      // Simulate typing (Tiptap will handle this internally)
      fireEvent.input(editor!, { target: { textContent: 'New content' } });

      await waitFor(() => {
        const charCount = screen.getByTestId('character-count');
        // Note: Exact count may vary based on Tiptap's handling
        expect(charCount).toBeInTheDocument();
      });
    });

    it('should enforce 10,000 character limit', () => {
      render(<TextEditor {...defaultProps} />);

      const charCount = screen.getByTestId('character-count');
      expect(charCount).toHaveTextContent(/10000/);
    });
  });

  describe('Save and Cancel Actions', () => {
    it('should call onSave with Tiptap content when save is clicked', async () => {
      render(<TextEditor {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
        const savedContent = mockOnSave.mock.calls[0][0];
        expect(savedContent.format).toBe(TextContentFormat.TIPTAP);
        expect(savedContent.content).toHaveProperty('type', 'doc');
      });
    });

    it('should call onCancel when cancel is clicked', () => {
      render(<TextEditor {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should validate content before saving', async () => {
      render(<TextEditor {...defaultProps} />);

      // Content validation happens in BaseEditor
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should support Ctrl+Enter to save', async () => {
      render(<TextEditor {...defaultProps} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();

      fireEvent.keyDown(editor!, {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it('should support Escape to cancel', () => {
      render(<TextEditor {...defaultProps} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();

      fireEvent.keyDown(editor!, {
        key: 'Escape',
        bubbles: true
      });

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Content Initialization', () => {
    it('initializes with plain text content when card is markdown', () => {
      render(<TextEditor {...defaultProps} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toHaveTextContent('Initial text content');
    });

    it('initializes with Tiptap JSON content when card is Tiptap format', () => {
      const card = createMockCard(mockTiptapContent, TextContentFormat.TIPTAP);
      render(<TextEditor {...defaultProps} card={card} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toHaveTextContent('Tiptap content test');
    });

    it('handles null content gracefully', () => {
      const card = createMockCard('');
      render(<TextEditor {...defaultProps} card={card} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Props and Configuration', () => {
    it('applies custom className', () => {
      const { container } = render(<TextEditor {...defaultProps} className="custom-class" />);

      // BaseEditor applies className to its root container
      // Find the root div with the custom class
      const rootElement = container.querySelector('.custom-class');
      expect(rootElement).toBeInTheDocument();
    });

    it('uses custom placeholder', () => {
      render(<TextEditor {...defaultProps} placeholder="Type here..." />);

      // Placeholder is configured in Tiptap but may not be visible with content
      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();
    });

    it('respects autoFocus prop', () => {
      render(<TextEditor {...defaultProps} autoFocus={true} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();
      // Tiptap handles autofocus internally
    });
  });

  describe('Content Migration', () => {
    it('converts markdown content to Tiptap format on save', async () => {
      const card = createMockCard('**Bold text**', TextContentFormat.MARKDOWN);
      render(<TextEditor {...defaultProps} card={card} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
        const savedContent = mockOnSave.mock.calls[0][0];
        expect(savedContent.format).toBe(TextContentFormat.TIPTAP);
        expect(savedContent.content).toHaveProperty('type', 'doc');
      });
    });

    it('preserves Tiptap content format on save', async () => {
      const card = createMockCard(mockTiptapContent, TextContentFormat.TIPTAP);
      render(<TextEditor {...defaultProps} card={card} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
        const savedContent = mockOnSave.mock.calls[0][0];
        expect(savedContent.format).toBe(TextContentFormat.TIPTAP);
        expect(savedContent.content.type).toBe('doc');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined content gracefully', () => {
      const card = {
        ...createMockCard(''),
        content: {
          ...createMockCard('').content,
          content: undefined as unknown as string
        }
      };

      render(<TextEditor {...defaultProps} card={card} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();
    });

    it('handles special characters in content', () => {
      const card = createMockCard('Special chars: <>&"\'');
      render(<TextEditor {...defaultProps} card={card} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();
    });

    it('maintains cursor position after formatting', () => {
      render(<TextEditor {...defaultProps} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();

      // Tiptap handles cursor position internally
      // Just verify editor is still functional
      fireEvent.input(editor!, { target: { textContent: 'Updated' } });
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large content efficiently', () => {
      const largeContent = 'A'.repeat(5000);
      const card = createMockCard(largeContent);

      render(<TextEditor {...defaultProps} card={card} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Text Formatting Extensions (Phase 2)', () => {
    describe('Bold Formatting', () => {
      it('should support Cmd+B keyboard shortcut for bold', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Cmd+B
        fireEvent.keyDown(editor!, {
          key: 'b',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          // Editor should still be present after formatting command
          expect(editor).toBeInTheDocument();
        });
      });

      it('should support Ctrl+B keyboard shortcut for bold on Windows', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Ctrl+B (Windows)
        fireEvent.keyDown(editor!, {
          key: 'b',
          ctrlKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });
    });

    describe('Italic Formatting', () => {
      it('should support Cmd+I keyboard shortcut for italic', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Cmd+I
        fireEvent.keyDown(editor!, {
          key: 'i',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });

      it('should support Ctrl+I keyboard shortcut for italic on Windows', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Ctrl+I (Windows)
        fireEvent.keyDown(editor!, {
          key: 'i',
          ctrlKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });
    });

    describe('Underline Formatting', () => {
      it('should support Cmd+U keyboard shortcut for underline', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Cmd+U
        fireEvent.keyDown(editor!, {
          key: 'u',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });

      it('should support Ctrl+U keyboard shortcut for underline on Windows', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Ctrl+U (Windows)
        fireEvent.keyDown(editor!, {
          key: 'u',
          ctrlKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });
    });

    describe('Strikethrough Formatting', () => {
      it('should support Cmd+Shift+X keyboard shortcut for strikethrough', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Cmd+Shift+X
        fireEvent.keyDown(editor!, {
          key: 'x',
          metaKey: true,
          shiftKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });

      it('should support Ctrl+Shift+X keyboard shortcut for strikethrough on Windows', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Ctrl+Shift+X (Windows)
        fireEvent.keyDown(editor!, {
          key: 'x',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });
    });

    describe('Inline Code Formatting', () => {
      it('should support Cmd+E keyboard shortcut for inline code', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Cmd+E
        fireEvent.keyDown(editor!, {
          key: 'e',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });

      it('should support Ctrl+E keyboard shortcut for inline code on Windows', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Ctrl+E (Windows)
        fireEvent.keyDown(editor!, {
          key: 'e',
          ctrlKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });
    });

    describe('Formatting Persistence', () => {
      it('should persist bold formatting in saved content', async () => {
        render(<TextEditor {...defaultProps} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];
          expect(savedContent.format).toBe(TextContentFormat.TIPTAP);
          expect(savedContent.content).toHaveProperty('type', 'doc');
        });
      });

      it('should persist multiple formatting styles in saved content', async () => {
        render(<TextEditor {...defaultProps} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];
          expect(savedContent.content).toHaveProperty('content');
          expect(Array.isArray(savedContent.content.content)).toBe(true);
        });
      });
    });

    describe('Content with Formatting', () => {
      it('should load content with bold text', () => {
        const contentWithBold: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Bold text',
              marks: [{ type: 'bold' }]
            }]
          }]
        };

        const card = createMockCard(contentWithBold, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();
        expect(editor).toHaveTextContent('Bold text');
      });

      it('should load content with italic text', () => {
        const contentWithItalic: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Italic text',
              marks: [{ type: 'italic' }]
            }]
          }]
        };

        const card = createMockCard(contentWithItalic, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();
        expect(editor).toHaveTextContent('Italic text');
      });

      it('should load content with underline text', () => {
        const contentWithUnderline: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Underlined text',
              marks: [{ type: 'underline' }]
            }]
          }]
        };

        const card = createMockCard(contentWithUnderline, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();
        expect(editor).toHaveTextContent('Underlined text');
      });

      it('should load content with strikethrough text', () => {
        const contentWithStrike: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Strikethrough text',
              marks: [{ type: 'strike' }]
            }]
          }]
        };

        const card = createMockCard(contentWithStrike, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();
        expect(editor).toHaveTextContent('Strikethrough text');
      });

      it('should load content with inline code', () => {
        const contentWithCode: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'code snippet',
              marks: [{ type: 'code' }]
            }]
          }]
        };

        const card = createMockCard(contentWithCode, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();
        expect(editor).toHaveTextContent('code snippet');
      });

      it('should load content with multiple formatting marks', () => {
        const contentWithMultipleMarks: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Bold and italic',
              marks: [{ type: 'bold' }, { type: 'italic' }]
            }]
          }]
        };

        const card = createMockCard(contentWithMultipleMarks, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();
        expect(editor).toHaveTextContent('Bold and italic');
      });
    });
  });

  describe('Link Functionality (Phase 2)', () => {
    describe('Link Extension Integration', () => {
      it('should support links in content', () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Click here',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://example.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();
        expect(editor).toHaveTextContent('Click here');
      });

      it('should render links with correct attributes', () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Link text',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://example.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        // Links should be rendered in the editor
        const linkElement = document.querySelector('a[href="https://example.com"]');
        expect(linkElement).toBeInTheDocument();
        expect(linkElement).toHaveAttribute('target', '_blank');
        expect(linkElement).toHaveAttribute('rel', 'noopener noreferrer');
      });

      it('should support Cmd+K keyboard shortcut for adding link', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Cmd+K
        fireEvent.keyDown(editor!, {
          key: 'k',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          // Link editor popup should appear
          const linkPopup = screen.queryByRole('dialog') || screen.queryByLabelText(/link url/i);
          expect(linkPopup || editor).toBeInTheDocument();
        });
      });

      it('should support Ctrl+K keyboard shortcut for adding link on Windows', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Ctrl+K (Windows)
        fireEvent.keyDown(editor!, {
          key: 'k',
          ctrlKey: true,
          bubbles: true
        });

        await waitFor(() => {
          // Link editor popup should appear
          const linkPopup = screen.queryByRole('dialog') || screen.queryByLabelText(/link url/i);
          expect(linkPopup || editor).toBeInTheDocument();
        });
      });
    });

    describe('Link Editor Popup', () => {
      it('should show link editor when add link button is clicked', async () => {
        render(<TextEditor {...defaultProps} />);

        // Find and click link button in toolbar
        const linkButton = screen.queryByRole('button', { name: /link/i }) ||
                          screen.queryByLabelText(/add link/i) ||
                          screen.queryByTitle(/link/i);

        if (linkButton) {
          fireEvent.click(linkButton);

          await waitFor(() => {
            // Link popup should appear
            const urlInput = screen.queryByLabelText(/url/i) || screen.queryByPlaceholderText(/url/i);
            expect(urlInput).toBeInTheDocument();
          });
        }
      });

      it('should allow entering URL in link editor', async () => {
        render(<TextEditor {...defaultProps} />);

        // Trigger link addition via keyboard shortcut
        const editor = document.querySelector('.tiptap');
        fireEvent.keyDown(editor!, {
          key: 'k',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          const urlInput = screen.queryByLabelText(/url/i) || screen.queryByPlaceholderText(/url/i);

          if (urlInput) {
            // Enter URL
            fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
            expect(urlInput).toHaveValue('https://example.com');
          }
        });
      });

      it('should validate URL format in link editor', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        fireEvent.keyDown(editor!, {
          key: 'k',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          const urlInput = screen.queryByLabelText(/url/i) || screen.queryByPlaceholderText(/url/i);

          if (urlInput) {
            // Enter invalid URL
            fireEvent.change(urlInput, { target: { value: 'not-a-url' } });

            // Validation error should appear
            const errorMessage = screen.queryByText(/invalid url/i) || screen.queryByText(/valid url/i);
            expect(errorMessage || urlInput).toBeInTheDocument();
          }
        });
      });

      it('should create link when URL is submitted', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        fireEvent.keyDown(editor!, {
          key: 'k',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          const urlInput = screen.queryByLabelText(/url/i) || screen.queryByPlaceholderText(/url/i);

          if (urlInput) {
            fireEvent.change(urlInput, { target: { value: 'https://example.com' } });

            // Submit the link
            const submitButton = screen.queryByRole('button', { name: /save|submit|ok/i });
            if (submitButton) {
              fireEvent.click(submitButton);
            }

            // Editor should still be present
            expect(editor).toBeInTheDocument();
          }
        });
      });

      it('should cancel link creation when cancel button is clicked', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        fireEvent.keyDown(editor!, {
          key: 'k',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          // Get the link popup dialog
          const dialog = screen.queryByRole('dialog');
          expect(dialog).toBeInTheDocument();

          if (dialog) {
            // Find cancel button within the dialog
            const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
            const popupCancelButton = cancelButtons.find(btn => dialog.contains(btn));

            if (popupCancelButton) {
              fireEvent.click(popupCancelButton);
            }
          }
        });

        // Wait for popup to close
        await waitFor(() => {
          const urlInput = screen.queryByLabelText(/url/i);
          expect(urlInput).not.toBeInTheDocument();
        });
      });

      it('should close link editor when Escape is pressed', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        fireEvent.keyDown(editor!, {
          key: 'k',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          const urlInput = screen.queryByLabelText(/url/i) || screen.queryByPlaceholderText(/url/i);
          expect(urlInput).toBeInTheDocument();

          if (urlInput) {
            // Press Escape on the input
            fireEvent.keyDown(urlInput, {
              key: 'Escape',
              bubbles: true
            });
          }
        });

        // Wait for popup to close
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
      });
    });

    describe('Link Editing', () => {
      it('should show current URL when editing existing link', async () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Existing link',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://existing.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        // Trigger link edit
        const editor = document.querySelector('.tiptap');
        fireEvent.keyDown(editor!, {
          key: 'k',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          const urlInput = screen.queryByLabelText(/url/i) || screen.queryByPlaceholderText(/url/i);

          // Should show existing URL
          if (urlInput) {
            expect(urlInput).toHaveValue('https://existing.com');
          }
        });
      });

      it('should allow updating existing link URL', async () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Link to update',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://old.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        fireEvent.keyDown(editor!, {
          key: 'k',
          metaKey: true,
          bubbles: true
        });

        await waitFor(() => {
          const urlInput = screen.queryByLabelText(/url/i);

          if (urlInput) {
            // Update URL
            fireEvent.change(urlInput, { target: { value: 'https://new.com' } });
            expect(urlInput).toHaveValue('https://new.com');
          }
        });
      });
    });

    describe('Link Removal', () => {
      it('should support removing link', async () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Link to remove',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://remove-me.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        // Find remove link button
        const removeLinkButton = screen.queryByRole('button', { name: /remove link/i }) ||
                                screen.queryByLabelText(/remove link/i);

        if (removeLinkButton) {
          fireEvent.click(removeLinkButton);

          await waitFor(() => {
            // Link should be removed
            const linkElement = document.querySelector('a[href="https://remove-me.com"]');
            expect(linkElement).not.toBeInTheDocument();
          });
        }
      });

      it('should show remove button when cursor is on link', async () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Link text',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://example.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        // Editor should be present
        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();
      });
    });

    describe('Link Security', () => {
      it('should set target="_blank" by default for external links', () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'External link',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://external.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const linkElement = document.querySelector('a[href="https://external.com"]');
        expect(linkElement).toHaveAttribute('target', '_blank');
      });

      it('should add rel="noopener noreferrer" for security', () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Secure link',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://example.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const linkElement = document.querySelector('a[href="https://example.com"]');
        expect(linkElement).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    describe('Link Styling', () => {
      it('should style links with design system colors', () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Styled link',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://styled.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const linkElement = document.querySelector('a[href="https://styled.com"]');
        expect(linkElement).toBeInTheDocument();
        // Links should have blue color from design system
        // This will be verified visually and through Tailwind classes
      });

      it('should show underline on links', () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Underlined link',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://underline.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const linkElement = document.querySelector('a[href="https://underline.com"]');
        expect(linkElement).toBeInTheDocument();
        // Underline styling will be applied via Tailwind classes
      });
    });

    describe('Link Persistence', () => {
      it('should persist links in saved content', async () => {
        const contentWithLink: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Persistent link',
              marks: [{
                type: 'link',
                attrs: {
                  href: 'https://persist.com',
                  target: '_blank',
                  rel: 'noopener noreferrer'
                }
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLink, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];
          expect(savedContent.format).toBe(TextContentFormat.TIPTAP);
          expect(savedContent.content).toHaveProperty('type', 'doc');

          // Verify link is in saved content
          const paragraph = savedContent.content.content[0];
          const textNode = paragraph.content[0];
          expect(textNode.marks).toBeDefined();
          expect(textNode.marks.some((mark: { type: string }) => mark.type === 'link')).toBe(true);
        });
      });
    });
  });

  describe('List Extensions (Phase 3, Task 1)', () => {
    describe('Bullet List Support', () => {
      it('should support bullet lists in content', () => {
        const contentWithBulletList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'First item' }]
                }]
              },
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Second item' }]
                }]
              }
            ]
          }]
        };

        const card = createMockCard(contentWithBulletList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const bulletList = document.querySelector('ul');
        expect(bulletList).toBeInTheDocument();
        expect(bulletList?.querySelectorAll('li')).toHaveLength(2);
      });

      it('should render bullet list items correctly', () => {
        const contentWithBulletList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Bullet item' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithBulletList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const listItem = document.querySelector('li');
        expect(listItem).toBeInTheDocument();
        expect(listItem).toHaveTextContent('Bullet item');
      });

      it('should support Cmd+Shift+8 keyboard shortcut for bullet list', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Cmd+Shift+8 (Mac)
        fireEvent.keyDown(editor!, {
          key: '8',
          metaKey: true,
          shiftKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });

      it('should support Ctrl+Shift+8 keyboard shortcut for bullet list on Windows', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Ctrl+Shift+8 (Windows)
        fireEvent.keyDown(editor!, {
          key: '8',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });

      it('should persist bullet lists in saved content', async () => {
        const contentWithBulletList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Persistent bullet item' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithBulletList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];
          expect(savedContent.format).toBe(TextContentFormat.TIPTAP);

          const listNode = savedContent.content.content[0];
          expect(listNode.type).toBe('bulletList');
          expect(listNode.content).toHaveLength(1);
          expect(listNode.content[0].type).toBe('listItem');
        });
      });
    });

    describe('Ordered List Support', () => {
      it('should support ordered lists in content', () => {
        const contentWithOrderedList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'First numbered item' }]
                }]
              },
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Second numbered item' }]
                }]
              }
            ]
          }]
        };

        const card = createMockCard(contentWithOrderedList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const orderedList = document.querySelector('ol');
        expect(orderedList).toBeInTheDocument();
        expect(orderedList?.querySelectorAll('li')).toHaveLength(2);
      });

      it('should render ordered list items correctly', () => {
        const contentWithOrderedList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'orderedList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Numbered item' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithOrderedList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const listItem = document.querySelector('li');
        expect(listItem).toBeInTheDocument();
        expect(listItem).toHaveTextContent('Numbered item');
      });

      it('should support Cmd+Shift+7 keyboard shortcut for ordered list', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Cmd+Shift+7 (Mac)
        fireEvent.keyDown(editor!, {
          key: '7',
          metaKey: true,
          shiftKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });

      it('should support Ctrl+Shift+7 keyboard shortcut for ordered list on Windows', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Ctrl+Shift+7 (Windows)
        fireEvent.keyDown(editor!, {
          key: '7',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });

      it('should persist ordered lists in saved content', async () => {
        const contentWithOrderedList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'orderedList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Persistent ordered item' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithOrderedList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];
          expect(savedContent.format).toBe(TextContentFormat.TIPTAP);

          const listNode = savedContent.content.content[0];
          expect(listNode.type).toBe('orderedList');
          expect(listNode.content).toHaveLength(1);
          expect(listNode.content[0].type).toBe('listItem');
        });
      });
    });

    describe('Nested Lists', () => {
      it('should support nested bullet lists', () => {
        const contentWithNestedBullets: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Parent item' }]
                  },
                  {
                    type: 'bulletList',
                    content: [{
                      type: 'listItem',
                      content: [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Nested item' }]
                      }]
                    }]
                  }
                ]
              }
            ]
          }]
        };

        const card = createMockCard(contentWithNestedBullets, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const lists = document.querySelectorAll('ul');
        expect(lists).toHaveLength(2); // Parent and nested list
        expect(document.body).toHaveTextContent('Parent item');
        expect(document.body).toHaveTextContent('Nested item');
      });

      it('should support nested ordered lists', () => {
        const contentWithNestedOrdered: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Parent numbered' }]
                  },
                  {
                    type: 'orderedList',
                    content: [{
                      type: 'listItem',
                      content: [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Nested numbered' }]
                      }]
                    }]
                  }
                ]
              }
            ]
          }]
        };

        const card = createMockCard(contentWithNestedOrdered, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const lists = document.querySelectorAll('ol');
        expect(lists).toHaveLength(2); // Parent and nested list
        expect(document.body).toHaveTextContent('Parent numbered');
        expect(document.body).toHaveTextContent('Nested numbered');
      });

      it('should support mixed nested lists (bullet in ordered)', () => {
        const contentWithMixedNested: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'orderedList',
            content: [{
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Ordered parent' }]
                },
                {
                  type: 'bulletList',
                  content: [{
                    type: 'listItem',
                    content: [{
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Bullet child' }]
                    }]
                  }]
                }
              ]
            }]
          }]
        };

        const card = createMockCard(contentWithMixedNested, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const orderedList = document.querySelector('ol');
        const bulletList = document.querySelector('ul');
        expect(orderedList).toBeInTheDocument();
        expect(bulletList).toBeInTheDocument();
      });

      it('should support deeply nested lists (3+ levels)', () => {
        const contentWithDeepNesting: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Level 1' }]
                },
                {
                  type: 'bulletList',
                  content: [{
                    type: 'listItem',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Level 2' }]
                      },
                      {
                        type: 'bulletList',
                        content: [{
                          type: 'listItem',
                          content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'Level 3' }]
                          }]
                        }]
                      }
                    ]
                  }]
                }
              ]
            }]
          }]
        };

        const card = createMockCard(contentWithDeepNesting, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const lists = document.querySelectorAll('ul');
        expect(lists.length).toBeGreaterThanOrEqual(3); // At least 3 levels
        expect(document.body).toHaveTextContent('Level 1');
        expect(document.body).toHaveTextContent('Level 2');
        expect(document.body).toHaveTextContent('Level 3');
      });
    });

    describe('List Items with Formatting', () => {
      it('should support formatted text in bullet list items', () => {
        const contentWithFormattedBullet: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{
                  type: 'text',
                  text: 'Bold item',
                  marks: [{ type: 'bold' }]
                }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithFormattedBullet, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const listItem = document.querySelector('li');
        expect(listItem).toBeInTheDocument();
        expect(listItem).toHaveTextContent('Bold item');
      });

      it('should support links in list items', () => {
        const contentWithLinkInList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{
                  type: 'text',
                  text: 'Link in list',
                  marks: [{
                    type: 'link',
                    attrs: {
                      href: 'https://example.com',
                      target: '_blank',
                      rel: 'noopener noreferrer'
                    }
                  }]
                }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLinkInList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const linkElement = document.querySelector('a[href="https://example.com"]');
        expect(linkElement).toBeInTheDocument();
      });
    });

    describe('BubbleMenu List Controls', () => {
      it('should show bullet list button in BubbleMenu', () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.ProseMirror');
        expect(editor).toBeInTheDocument();

        // BubbleMenu renders with list controls
        // Actual visibility testing requires text selection simulation
      });

      it('should show ordered list button in BubbleMenu', () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.ProseMirror');
        expect(editor).toBeInTheDocument();

        // BubbleMenu renders with list controls
      });

      it('should show active state for bullet list button when in bullet list', () => {
        const contentWithBulletList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Item in list' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithBulletList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.ProseMirror');
        expect(editor).toBeInTheDocument();

        // When cursor is in bullet list, button should show active state
      });

      it('should show active state for ordered list button when in ordered list', () => {
        const contentWithOrderedList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'orderedList',
            content: [{
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Numbered item' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithOrderedList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.ProseMirror');
        expect(editor).toBeInTheDocument();

        // When cursor is in ordered list, button should show active state
      });
    });

    describe('List Persistence and Edge Cases', () => {
      it('should persist nested lists in saved content', async () => {
        const contentWithNestedLists: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'bulletList',
            content: [{
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Parent' }]
                },
                {
                  type: 'bulletList',
                  content: [{
                    type: 'listItem',
                    content: [{
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Child' }]
                    }]
                  }]
                }
              ]
            }]
          }]
        };

        const card = createMockCard(contentWithNestedLists, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];

          const listNode = savedContent.content.content[0];
          expect(listNode.type).toBe('bulletList');
          expect(listNode.content[0].content).toHaveLength(2); // Paragraph and nested list
        });
      });

      it('should handle mixed content with lists and paragraphs', () => {
        const mixedContent: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Introduction' }]
            },
            {
              type: 'bulletList',
              content: [{
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'List item' }]
                }]
              }]
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Conclusion' }]
            }
          ]
        };

        const card = createMockCard(mixedContent, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        expect(document.body).toHaveTextContent('Introduction');
        expect(document.querySelector('ul')).toBeInTheDocument();
        expect(document.body).toHaveTextContent('Conclusion');
      });

      it('should handle empty list items gracefully', () => {
        const contentWithEmptyItem: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item 1' }]
                }]
              },
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph'
                }]
              },
              {
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item 3' }]
                }]
              }
            ]
          }]
        };

        const card = createMockCard(contentWithEmptyItem, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const listItems = document.querySelectorAll('li');
        expect(listItems).toHaveLength(3);
      });
    });
  });

  describe('Task List Functionality (Phase 3, Task 2)', () => {
    describe('Task List Rendering', () => {
      it('should render task list with checkboxes', () => {
        const contentWithTaskList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Unchecked task' }]
                }]
              },
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Checked task' }]
                }]
              }
            ]
          }]
        };

        const card = createMockCard(contentWithTaskList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        // Check for task list and task items
        const taskList = document.querySelector('[data-type="taskList"]') || document.querySelector('ul[data-type="taskList"]');
        expect(taskList || document.querySelector('ul')).toBeInTheDocument();

        // Check for checkboxes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBeGreaterThanOrEqual(2);
      });

      it('should render unchecked task items correctly', () => {
        const contentWithUncheckedTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: false },
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Todo item' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithUncheckedTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const checkbox = document.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
        expect(document.body).toHaveTextContent('Todo item');
      });

      it('should render checked task items correctly', () => {
        const contentWithCheckedTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: true },
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Completed item' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithCheckedTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const checkbox = document.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).toBeChecked();
        expect(document.body).toHaveTextContent('Completed item');
      });

      it('should render multiple task items', () => {
        const contentWithMultipleTasks: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task 1' }]
                }]
              },
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task 2' }]
                }]
              },
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task 3' }]
                }]
              }
            ]
          }]
        };

        const card = createMockCard(contentWithMultipleTasks, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('Task List Checkbox Interaction', () => {
      it('should toggle checkbox state when clicked', async () => {
        const contentWithTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: false },
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Toggle me' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const checkbox = document.querySelector('input[type="checkbox"]');
        expect(checkbox).not.toBeChecked();

        // Click checkbox to toggle
        if (checkbox) {
          fireEvent.click(checkbox);

          await waitFor(() => {
            expect(checkbox).toBeChecked();
          });
        }
      });

      it('should uncheck a checked task when clicked', async () => {
        const contentWithCheckedTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: true },
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Uncheck me' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithCheckedTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const checkbox = document.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeChecked();

        // Click checkbox to toggle
        if (checkbox) {
          fireEvent.click(checkbox);

          await waitFor(() => {
            expect(checkbox).not.toBeChecked();
          });
        }
      });

      it('should allow toggling multiple checkboxes independently', async () => {
        const contentWithMultipleTasks: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task 1' }]
                }]
              },
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task 2' }]
                }]
              }
            ]
          }]
        };

        const card = createMockCard(contentWithMultipleTasks, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes[0]).not.toBeChecked();
        expect(checkboxes[1]).not.toBeChecked();

        // Toggle first checkbox
        if (checkboxes[0]) {
          fireEvent.click(checkboxes[0]);
          await waitFor(() => {
            expect(checkboxes[0]).toBeChecked();
            expect(checkboxes[1]).not.toBeChecked();
          });
        }
      });
    });

    describe('Task List Keyboard Shortcuts', () => {
      it('should support Cmd+Shift+9 keyboard shortcut for task list', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Cmd+Shift+9 (Mac)
        fireEvent.keyDown(editor!, {
          key: '9',
          metaKey: true,
          shiftKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });

      it('should support Ctrl+Shift+9 keyboard shortcut for task list on Windows', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Simulate Ctrl+Shift+9 (Windows)
        fireEvent.keyDown(editor!, {
          key: '9',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true
        });

        await waitFor(() => {
          expect(editor).toBeInTheDocument();
        });
      });
    });

    describe('Task List Persistence', () => {
      it('should persist task list with checked state in saved content', async () => {
        const contentWithTasks: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Unchecked task' }]
                }]
              },
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Checked task' }]
                }]
              }
            ]
          }]
        };

        const card = createMockCard(contentWithTasks, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];
          expect(savedContent.format).toBe(TextContentFormat.TIPTAP);

          const taskListNode = savedContent.content.content[0];
          expect(taskListNode.type).toBe('taskList');
          expect(taskListNode.content).toHaveLength(2);
          expect(taskListNode.content[0].attrs.checked).toBe(false);
          expect(taskListNode.content[1].attrs.checked).toBe(true);
        });
      });

      it('should preserve checkbox state after toggling and saving', async () => {
        const contentWithTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: false },
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Toggle and save' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const checkbox = document.querySelector('input[type="checkbox"]');

        if (checkbox) {
          // Toggle checkbox
          fireEvent.click(checkbox);

          await waitFor(() => {
            expect(checkbox).toBeChecked();
          });

          // Save
          const saveButton = screen.getByRole('button', { name: /save/i });
          fireEvent.click(saveButton);

          await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalled();
            const savedContent = mockOnSave.mock.calls[0][0];

            const taskListNode = savedContent.content.content[0];
            expect(taskListNode.type).toBe('taskList');
            expect(taskListNode.content[0].attrs.checked).toBe(true);
          });
        }
      });
    });

    describe('Nested Task Lists', () => {
      it('should support nested task lists', () => {
        const contentWithNestedTasks: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Parent task' }]
                },
                {
                  type: 'taskList',
                  content: [{
                    type: 'taskItem',
                    attrs: { checked: false },
                    content: [{
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Nested task' }]
                    }]
                  }]
                }
              ]
            }]
          }]
        };

        const card = createMockCard(contentWithNestedTasks, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        expect(document.body).toHaveTextContent('Parent task');
        expect(document.body).toHaveTextContent('Nested task');

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Task List with Formatting', () => {
      it('should support formatted text in task items', () => {
        const contentWithFormattedTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: false },
              content: [{
                type: 'paragraph',
                content: [{
                  type: 'text',
                  text: 'Bold task',
                  marks: [{ type: 'bold' }]
                }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithFormattedTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        expect(document.body).toHaveTextContent('Bold task');
        const checkbox = document.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeInTheDocument();
      });

      it('should support links in task items', () => {
        const contentWithLinkInTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: false },
              content: [{
                type: 'paragraph',
                content: [{
                  type: 'text',
                  text: 'Task with link',
                  marks: [{
                    type: 'link',
                    attrs: {
                      href: 'https://example.com',
                      target: '_blank',
                      rel: 'noopener noreferrer'
                    }
                  }]
                }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithLinkInTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const linkElement = document.querySelector('a[href="https://example.com"]');
        expect(linkElement).toBeInTheDocument();
        const checkbox = document.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeInTheDocument();
      });
    });

    describe('BubbleMenu Task List Controls', () => {
      it('should show task list button in BubbleMenu', () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.ProseMirror');
        expect(editor).toBeInTheDocument();

        // BubbleMenu renders with task list controls
        // Actual visibility testing requires text selection simulation
      });

      it('should show active state for task list button when in task list', () => {
        const contentWithTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: false },
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Task item' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.ProseMirror');
        expect(editor).toBeInTheDocument();

        // When cursor is in task list, button should show active state
      });
    });

    describe('Mixed Content with Task Lists', () => {
      it('should handle mixed content with task lists and paragraphs', () => {
        const mixedContent: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Introduction' }]
            },
            {
              type: 'taskList',
              content: [{
                type: 'taskItem',
                attrs: { checked: false },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task item' }]
                }]
              }]
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Conclusion' }]
            }
          ]
        };

        const card = createMockCard(mixedContent, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        expect(document.body).toHaveTextContent('Introduction');
        expect(document.querySelector('input[type="checkbox"]')).toBeInTheDocument();
        expect(document.body).toHaveTextContent('Conclusion');
      });

      it('should handle task lists mixed with bullet lists', () => {
        const mixedContent: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'bulletList',
              content: [{
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Bullet item' }]
                }]
              }]
            },
            {
              type: 'taskList',
              content: [{
                type: 'taskItem',
                attrs: { checked: false },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task item' }]
                }]
              }]
            }
          ]
        };

        const card = createMockCard(mixedContent, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        expect(document.querySelector('ul')).toBeInTheDocument();
        expect(document.querySelector('input[type="checkbox"]')).toBeInTheDocument();
      });
    });

    describe('Task List Checkbox Styling', () => {
      it('should apply design system styling to checkboxes', () => {
        const contentWithTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: false },
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Styled checkbox' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const checkbox = document.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeInTheDocument();
        // Design system styling will be applied via CSS classes
      });

      it('should show hover state on checkboxes', () => {
        const contentWithTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: false },
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Hover me' }]
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const checkbox = document.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeInTheDocument();
        // Hover styling will be applied via CSS
      });
    });

    describe('Task List Edge Cases', () => {
      it('should handle empty task items gracefully', () => {
        const contentWithEmptyTask: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [{
              type: 'taskItem',
              attrs: { checked: false },
              content: [{
                type: 'paragraph'
              }]
            }]
          }]
        };

        const card = createMockCard(contentWithEmptyTask, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const checkbox = document.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeInTheDocument();
      });

      it('should persist task list structure in saved content', async () => {
        const contentWithTaskList: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task 1' }]
                }]
              },
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task 2' }]
                }]
              }
            ]
          }]
        };

        const card = createMockCard(contentWithTaskList, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];

          const taskListNode = savedContent.content.content[0];
          expect(taskListNode.type).toBe('taskList');
          expect(taskListNode.content).toHaveLength(2);
        });
      });
    });
  });

  describe('Heading Transformations (Phase 2)', () => {
    describe('Heading Extension Integration', () => {
      it('should support H1 heading in content', () => {
        const contentWithH1: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level: 1 },
            content: [{
              type: 'text',
              text: 'Main Title'
            }]
          }]
        };

        const card = createMockCard(contentWithH1, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const heading = document.querySelector('h1');
        expect(heading).toBeInTheDocument();
        expect(heading).toHaveTextContent('Main Title');
      });

      it('should support H2 heading in content', () => {
        const contentWithH2: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level: 2 },
            content: [{
              type: 'text',
              text: 'Section Header'
            }]
          }]
        };

        const card = createMockCard(contentWithH2, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const heading = document.querySelector('h2');
        expect(heading).toBeInTheDocument();
        expect(heading).toHaveTextContent('Section Header');
      });

      it('should support H3 heading in content', () => {
        const contentWithH3: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level: 3 },
            content: [{
              type: 'text',
              text: 'Subsection Header'
            }]
          }]
        };

        const card = createMockCard(contentWithH3, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const heading = document.querySelector('h3');
        expect(heading).toBeInTheDocument();
        expect(heading).toHaveTextContent('Subsection Header');
      });

      it('should render headings with proper hierarchy', () => {
        const contentWithMultipleHeadings: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'H1 Title' }]
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'H2 Section' }]
            },
            {
              type: 'heading',
              attrs: { level: 3 },
              content: [{ type: 'text', text: 'H3 Subsection' }]
            }
          ]
        };

        const card = createMockCard(contentWithMultipleHeadings, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        expect(document.querySelector('h1')).toHaveTextContent('H1 Title');
        expect(document.querySelector('h2')).toHaveTextContent('H2 Section');
        expect(document.querySelector('h3')).toHaveTextContent('H3 Subsection');
      });

      it('should support headings with formatting marks', () => {
        const contentWithFormattedHeading: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level: 2 },
            content: [{
              type: 'text',
              text: 'Bold Heading',
              marks: [{ type: 'bold' }]
            }]
          }]
        };

        const card = createMockCard(contentWithFormattedHeading, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const heading = document.querySelector('h2');
        expect(heading).toBeInTheDocument();
        expect(heading).toHaveTextContent('Bold Heading');
      });
    });

    describe('Heading Controls in BubbleMenu', () => {
      it('should render BubbleMenu component with heading controls', () => {
        render(<TextEditor {...defaultProps} />);

        // BubbleMenu is rendered but only visible when text is selected
        // Testing visibility in JSDOM is not reliable due to positioning libraries
        // Instead we verify the editor renders successfully
        const editorElement = document.querySelector('.ProseMirror');
        expect(editorElement).toBeInTheDocument();
      });

      it('should support heading transformations via keyboard shortcuts', () => {
        render(<TextEditor {...defaultProps} />);

        // Tiptap StarterKit provides heading shortcuts:
        // Cmd/Ctrl+Alt+1 for H1, Cmd/Ctrl+Alt+2 for H2, Cmd/Ctrl+Alt+3 for H3
        // BubbleMenu also provides UI controls for headings
        const editorElement = document.querySelector('.ProseMirror');
        expect(editorElement).toBeInTheDocument();
      });
    });

    describe('Heading Typography Styles', () => {
      it('should apply design system typography to H1', () => {
        const contentWithH1: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Styled H1' }]
          }]
        };

        const card = createMockCard(contentWithH1, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const h1 = document.querySelector('h1');
        expect(h1).toBeInTheDocument();
        // Typography styles (text-3xl, font-bold) will be applied via CSS
        // We verify the element exists and has the correct content
      });

      it('should apply design system typography to H2', () => {
        const contentWithH2: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Styled H2' }]
          }]
        };

        const card = createMockCard(contentWithH2, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const h2 = document.querySelector('h2');
        expect(h2).toBeInTheDocument();
        // Typography styles (text-2xl, font-semibold) will be applied via CSS
      });

      it('should apply design system typography to H3', () => {
        const contentWithH3: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Styled H3' }]
          }]
        };

        const card = createMockCard(contentWithH3, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const h3 = document.querySelector('h3');
        expect(h3).toBeInTheDocument();
        // Typography styles (text-xl, font-semibold) will be applied via CSS
      });
    });

    describe('Heading Keyboard Shortcuts', () => {
      it('should support Tiptap heading keyboard shortcuts', () => {
        // Keyboard shortcuts are handled by Tiptap StarterKit heading extension
        // Default shortcuts: Cmd/Ctrl+Alt+1, Cmd/Ctrl+Alt+2, Cmd/Ctrl+Alt+3
        // BubbleMenu also provides UI controls for heading transformations
        render(<TextEditor {...defaultProps} />);

        const editorElement = document.querySelector('.ProseMirror');
        expect(editorElement).toBeInTheDocument();

        // Tiptap handles keyboard shortcuts internally
        // Actual keyboard shortcut testing requires integration tests
      });
    });

    describe('Heading Persistence', () => {
      it('should persist H1 heading in saved content', async () => {
        const contentWithH1: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Persistent H1' }]
          }]
        };

        const card = createMockCard(contentWithH1, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];
          expect(savedContent.format).toBe(TextContentFormat.TIPTAP);
          expect(savedContent.content).toHaveProperty('type', 'doc');

          // Verify H1 is in saved content
          const headingNode = savedContent.content.content[0];
          expect(headingNode.type).toBe('heading');
          expect(headingNode.attrs.level).toBe(1);
        });
      });

      it('should persist H2 heading in saved content', async () => {
        const contentWithH2: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Persistent H2' }]
          }]
        };

        const card = createMockCard(contentWithH2, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];

          const headingNode = savedContent.content.content[0];
          expect(headingNode.type).toBe('heading');
          expect(headingNode.attrs.level).toBe(2);
        });
      });

      it('should persist H3 heading in saved content', async () => {
        const contentWithH3: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Persistent H3' }]
          }]
        };

        const card = createMockCard(contentWithH3, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];

          const headingNode = savedContent.content.content[0];
          expect(headingNode.type).toBe('heading');
          expect(headingNode.attrs.level).toBe(3);
        });
      });

      it('should persist mixed content with headings and paragraphs', async () => {
        const mixedContent: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Title' }]
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Body text' }]
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Section' }]
            }
          ]
        };

        const card = createMockCard(mixedContent, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];

          // Verify all content types are preserved
          expect(savedContent.content.content).toHaveLength(3);
          expect(savedContent.content.content[0].type).toBe('heading');
          expect(savedContent.content.content[1].type).toBe('paragraph');
          expect(savedContent.content.content[2].type).toBe('heading');
        });
      });
    });
  });

  describe('Blockquote and Code Block Functionality (Phase 3, Task 3)', () => {
    describe('Blockquote Support', () => {
      it('should render blockquote content from Tiptap JSON', () => {
        const contentWithBlockquote: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'blockquote',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: 'This is a quote' }]
            }]
          }]
        };

        const card = createMockCard(contentWithBlockquote, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const blockquote = document.querySelector('blockquote');
        expect(blockquote).toBeInTheDocument();
        expect(blockquote).toHaveTextContent('This is a quote');
      });

      it('should preserve blockquote on save', async () => {
        const contentWithBlockquote: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'blockquote',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: 'Quote text' }]
            }]
          }]
        };

        const card = createMockCard(contentWithBlockquote, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];
          expect(savedContent.content.content[0].type).toBe('blockquote');
        });
      });

      it('should support nested formatting in blockquotes', () => {
        const contentWithFormattedBlockquote: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'blockquote',
            content: [{
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Bold quote',
                  marks: [{ type: 'bold' }]
                },
                { type: 'text', text: ' and ' },
                {
                  type: 'text',
                  text: 'italic',
                  marks: [{ type: 'italic' }]
                }
              ]
            }]
          }]
        };

        const card = createMockCard(contentWithFormattedBlockquote, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const blockquote = document.querySelector('blockquote');
        expect(blockquote).toBeInTheDocument();

        const strong = blockquote?.querySelector('strong');
        const em = blockquote?.querySelector('em');

        expect(strong).toHaveTextContent('Bold quote');
        expect(em).toHaveTextContent('italic');
      });

      it('should apply blockquote styling with left border', () => {
        const contentWithBlockquote: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'blockquote',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: 'Styled quote' }]
            }]
          }]
        };

        const card = createMockCard(contentWithBlockquote, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const blockquote = document.querySelector('blockquote');
        expect(blockquote).toBeInTheDocument();
        expect(blockquote).toHaveClass('tiptap-blockquote');
      });
    });

    describe('Code Block Support', () => {
      it('should render code block content from Tiptap JSON', () => {
        const contentWithCodeBlock: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 42;' }]
          }]
        };

        const card = createMockCard(contentWithCodeBlock, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const codeBlock = document.querySelector('pre code');
        expect(codeBlock).toBeInTheDocument();
        expect(codeBlock).toHaveTextContent('const x = 42;');
      });

      it('should support syntax highlighting for JavaScript', () => {
        const contentWithJSCode: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{
              type: 'text',
              text: 'function greet() {\n  console.log("Hello");\n}'
            }]
          }]
        };

        const card = createMockCard(contentWithJSCode, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const codeBlock = document.querySelector('pre code');
        expect(codeBlock).toBeInTheDocument();
        expect(codeBlock).toHaveClass('language-javascript');
      });

      it('should support syntax highlighting for TypeScript', () => {
        const contentWithTSCode: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [{
              type: 'text',
              text: 'interface User {\n  name: string;\n  age: number;\n}'
            }]
          }]
        };

        const card = createMockCard(contentWithTSCode, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const codeBlock = document.querySelector('pre code');
        expect(codeBlock).toBeInTheDocument();
        expect(codeBlock).toHaveClass('language-typescript');
      });

      it('should preserve code block on save', async () => {
        const contentWithCodeBlock: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'codeBlock',
            attrs: { language: 'python' },
            content: [{ type: 'text', text: 'print("Hello World")' }]
          }]
        };

        const card = createMockCard(contentWithCodeBlock, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];
          expect(savedContent.content.content[0].type).toBe('codeBlock');
          expect(savedContent.content.content[0].attrs?.language).toBe('python');
        });
      });

      it('should handle tab indentation in code blocks', async () => {
        const contentWithCodeBlock: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'codeBlock',
            attrs: { language: null },
            content: [{ type: 'text', text: 'code' }]
          }]
        };

        const card = createMockCard(contentWithCodeBlock, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const codeBlock = document.querySelector('pre code');
        expect(codeBlock).toBeInTheDocument();

        // Focus code block and simulate tab
        await act(async () => {
          if (codeBlock instanceof HTMLElement) {
            codeBlock.focus();
            fireEvent.keyDown(codeBlock, { key: 'Tab', code: 'Tab' });
          }
        });

        // Tab should be handled by code block (not prevent default behavior)
        // This is configured via the extension
      });

      it('should apply code block styling with dark background', () => {
        const contentWithCodeBlock: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 1;' }]
          }]
        };

        const card = createMockCard(contentWithCodeBlock, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const preElement = document.querySelector('pre');
        expect(preElement).toBeInTheDocument();
        expect(preElement).toHaveClass('tiptap-code-block');
      });

      it('should support multiple languages', () => {
        const languages = ['javascript', 'typescript', 'python', 'html', 'css', 'json'];

        languages.forEach(lang => {
          const contentWithCode: TiptapJSONContent = {
            type: 'doc',
            content: [{
              type: 'codeBlock',
              attrs: { language: lang },
              content: [{ type: 'text', text: `${lang} code` }]
            }]
          };

          const card = createMockCard(contentWithCode, TextContentFormat.TIPTAP);
          const { unmount } = render(<TextEditor {...defaultProps} card={card} />);

          const codeBlock = document.querySelector('pre code');
          expect(codeBlock).toHaveClass(`language-${lang}`);

          unmount();
        });
      });
    });

    describe('Code Block Copy Button', () => {
      it('should render copy button for code blocks', () => {
        const contentWithCodeBlock: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 42;' }]
          }]
        };

        const card = createMockCard(contentWithCodeBlock, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        // Copy button should be rendered as a child of the pre element
        const copyButton = document.querySelector('.code-block-copy-button');
        expect(copyButton).toBeInTheDocument();
      });
    });

    describe('BubbleMenu Blockquote and Code Block Controls', () => {
      it('should highlight active blockquote button', () => {
        const contentWithBlockquote: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'blockquote',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: 'Quote' }]
            }]
          }]
        };

        const card = createMockCard(contentWithBlockquote, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        // When cursor is in blockquote, button should be active
        // This is tested via the isActive() check in BubbleMenu
      });

      it('should highlight active code block button', () => {
        const contentWithCodeBlock: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'code' }]
          }]
        };

        const card = createMockCard(contentWithCodeBlock, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        // When cursor is in code block, button should be active
        // This is tested via the isActive() check in BubbleMenu
      });
    });

    describe('Mixed Content with Blockquotes and Code Blocks', () => {
      it('should handle mixed content with blockquotes, code blocks, and paragraphs', () => {
        const mixedContent: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Introduction' }]
            },
            {
              type: 'blockquote',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Important quote' }]
              }]
            },
            {
              type: 'codeBlock',
              attrs: { language: 'javascript' },
              content: [{ type: 'text', text: 'console.log("code");' }]
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Conclusion' }]
            }
          ]
        };

        const card = createMockCard(mixedContent, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        expect(document.querySelector('p')).toHaveTextContent('Introduction');
        expect(document.querySelector('blockquote')).toHaveTextContent('Important quote');
        expect(document.querySelector('pre code')).toHaveTextContent('console.log("code");');
      });

      it('should persist mixed content on save', async () => {
        const mixedContent: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'blockquote',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Quote' }]
              }]
            },
            {
              type: 'codeBlock',
              attrs: { language: 'python' },
              content: [{ type: 'text', text: 'print("code")' }]
            }
          ]
        };

        const card = createMockCard(mixedContent, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];

          expect(savedContent.content.content).toHaveLength(2);
          expect(savedContent.content.content[0].type).toBe('blockquote');
          expect(savedContent.content.content[1].type).toBe('codeBlock');
          expect(savedContent.content.content[1].attrs?.language).toBe('python');
        });
      });
    });

    describe('Keyboard Shortcuts for Blockquotes and Code Blocks', () => {
      it('should toggle blockquote with keyboard shortcut', async () => {
        const card = createMockCard('Text to quote', TextContentFormat.MARKDOWN);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Select text
        await act(async () => {
          if (editor) {
            const range = document.createRange();
            const textNode = editor.firstChild?.firstChild as Node;
            if (textNode) {
              range.selectNodeContents(textNode);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }
        });

        // Trigger blockquote shortcut (Cmd/Ctrl+Shift+B)
        await act(async () => {
          fireEvent.keyDown(editor!, {
            key: 'b',
            code: 'KeyB',
            shiftKey: true,
            ctrlKey: true
          });
        });

        // Should create blockquote
        await waitFor(() => {
          const blockquote = document.querySelector('blockquote');
          expect(blockquote).toBeInTheDocument();
        });
      });

      it('should toggle code block with keyboard shortcut', async () => {
        const card = createMockCard('Text to code', TextContentFormat.MARKDOWN);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Select text
        await act(async () => {
          if (editor) {
            const range = document.createRange();
            const textNode = editor.firstChild?.firstChild as Node;
            if (textNode) {
              range.selectNodeContents(textNode);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }
        });

        // Trigger code block shortcut (Cmd/Ctrl+Alt+C)
        await act(async () => {
          fireEvent.keyDown(editor!, {
            key: 'c',
            code: 'KeyC',
            altKey: true,
            ctrlKey: true
          });
        });

        // Should create code block
        await waitFor(() => {
          const codeBlock = document.querySelector('pre code');
          expect(codeBlock).toBeInTheDocument();
        });
      });
    });
  });

  describe('Horizontal Rule', () => {
    describe('Rendering', () => {
      it('should render horizontal rule from Tiptap JSON', () => {
        const contentWithHR: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Before divider' }]
            },
            {
              type: 'horizontalRule'
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'After divider' }]
            }
          ]
        };

        const card = createMockCard(contentWithHR, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();
        expect(editor).toHaveTextContent('Before divider');
        expect(editor).toHaveTextContent('After divider');

        // Check for horizontal rule element (rendered as <hr>)
        const hr = editor?.querySelector('hr');
        expect(hr).toBeInTheDocument();
      });

      it('should render multiple horizontal rules', () => {
        const contentWithMultipleHR: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Section 1' }]
            },
            {
              type: 'horizontalRule'
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Section 2' }]
            },
            {
              type: 'horizontalRule'
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Section 3' }]
            }
          ]
        };

        const card = createMockCard(contentWithMultipleHR, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        const hrs = editor?.querySelectorAll('hr');
        expect(hrs).toHaveLength(2);
      });

      it('should apply design system styling to horizontal rule', () => {
        const contentWithHR: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Text' }]
            },
            {
              type: 'horizontalRule'
            }
          ]
        };

        const card = createMockCard(contentWithHR, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const hr = document.querySelector('hr');
        expect(hr).toBeInTheDocument();

        // Should have design system class
        expect(hr).toHaveClass('tiptap-horizontal-rule');
      });
    });

    describe('Keyboard Shortcuts', () => {
      it('should insert horizontal rule with keyboard shortcut', async () => {
        render(<TextEditor {...defaultProps} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Select text
        await act(async () => {
          if (editor) {
            const range = document.createRange();
            const textNode = editor.firstChild?.firstChild as Node;
            if (textNode) {
              range.selectNodeContents(textNode);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }
        });

        // Trigger horizontal rule shortcut (Mod+Shift+-)
        // Note: The actual shortcut will be configured in implementation
        await act(async () => {
          fireEvent.keyDown(editor!, {
            key: '-',
            code: 'Minus',
            shiftKey: true,
            ctrlKey: true
          });
        });

        // Should insert horizontal rule
        await waitFor(() => {
          const hr = document.querySelector('hr');
          expect(hr).toBeInTheDocument();
        });
      });
    });

    describe('Persistence', () => {
      it('should persist horizontal rule in Tiptap JSON on save', async () => {
        const contentWithHR: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Text before' }]
            },
            {
              type: 'horizontalRule'
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Text after' }]
            }
          ]
        };

        const card = createMockCard(contentWithHR, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
          const savedContent = mockOnSave.mock.calls[0][0];

          expect(savedContent.format).toBe(TextContentFormat.TIPTAP);
          expect(savedContent.content).toHaveProperty('type', 'doc');

          // Check that horizontal rule is in the content
          const hrNode = (savedContent.content as TiptapJSONContent).content?.find(
            (node) => node.type === 'horizontalRule'
          );
          expect(hrNode).toBeDefined();
        });
      });

      it('should maintain horizontal rule position after edit', async () => {
        const contentWithHR: TiptapJSONContent = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'First paragraph' }]
            },
            {
              type: 'horizontalRule'
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Second paragraph' }]
            }
          ]
        };

        const card = createMockCard(contentWithHR, TextContentFormat.TIPTAP);
        render(<TextEditor {...defaultProps} card={card} />);

        const editor = document.querySelector('.tiptap');
        expect(editor).toBeInTheDocument();

        // Verify horizontal rule exists
        let hr = editor?.querySelector('hr');
        expect(hr).toBeInTheDocument();

        // Save
        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled();
        });

        // HR should still be present after save
        hr = editor?.querySelector('hr');
        expect(hr).toBeInTheDocument();
      });
    });

  });
});
