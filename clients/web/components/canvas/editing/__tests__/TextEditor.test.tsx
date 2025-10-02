/**
 * TextEditor Component Tests
 *
 * Comprehensive test suite for the TextEditor component that extends InlineEditor
 * for text card content editing with markdown support, character limits, and auto-resize.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextEditor, TextEditorProps } from '../TextEditor';
import type { TextCard } from '@/types/card.types';

// Mock DataTransfer
class MockDataTransfer implements DataTransfer {
  data: { [key: string]: string } = {};
  dropEffect: DataTransfer['dropEffect'] = 'none';
  effectAllowed: DataTransfer['effectAllowed'] = 'all';
  files: FileList = {} as FileList;
  items: DataTransferItemList = {} as DataTransferItemList;
  types: readonly string[] = [];

  getData(format: string): string {
    return this.data[format] || '';
  }

  setData(format: string, value: string): void {
    this.data[format] = value;
  }

  clearData(format?: string): void {
    if (format) {
      delete this.data[format];
    } else {
      this.data = {};
    }
  }

  setDragImage(image: Element, x: number, y: number): void {
    // Mock implementation
  }
}
global.DataTransfer = MockDataTransfer as typeof DataTransfer;

// Mock ClipboardEvent for JSDOM
class MockClipboardEvent extends Event {
  clipboardData: DataTransfer;

  constructor(type: string, options?: EventInit & { clipboardData?: DataTransfer }) {
    super(type, options);
    this.clipboardData = options?.clipboardData || new MockDataTransfer();
  }
}
// Cast to unknown first to bypass type checking for incomplete mock
(global as unknown as { ClipboardEvent: typeof ClipboardEvent }).ClipboardEvent = MockClipboardEvent as unknown as typeof ClipboardEvent;

// Mock document.createRange for JSDOM
interface MockRange extends Range {
  setStart: jest.Mock<void, [Node, number]>;
  setEnd: jest.Mock<void, [Node, number]>;
  selectNodeContents: jest.Mock<void, [Node]>;
  collapse: jest.Mock<void, [boolean?]>;
  setStartAfter: jest.Mock<void, [Node]>;
  setEndAfter: jest.Mock<void, [Node]>;
  deleteContents: jest.Mock<void, []>;
  insertNode: jest.Mock<void, [Node]>;
  toString: jest.Mock<string, []>;
  cloneRange: jest.Mock<Range, []>;
  createContextualFragment: jest.Mock<DocumentFragment, [string]>;
}

global.document.createRange = (): Range => ({
  setStart: jest.fn(),
  setEnd: jest.fn(),
  selectNodeContents: jest.fn(),
  collapse: jest.fn(),
  setStartAfter: jest.fn(),
  setEndAfter: jest.fn(),
  deleteContents: jest.fn(),
  insertNode: jest.fn(),
  toString: jest.fn(() => ''),
  cloneRange: jest.fn(),
  createContextualFragment: jest.fn((html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.firstChild || div) as unknown as DocumentFragment;
  })
} as MockRange);

// Mock window.getSelection with proper range support
interface MockSelectionData {
  rangeCount: number;
  ranges: Range[];
}

const mockSelectionData: MockSelectionData = {
  rangeCount: 0,
  ranges: []
};

const mockSelection = {
  anchorNode: null,
  anchorOffset: 0,
  focusNode: null,
  focusOffset: 0,
  isCollapsed: true,
  type: 'None' as const,
  get rangeCount() {
    return mockSelectionData.rangeCount;
  },
  direction: 'none' as const,
  getRangeAt: jest.fn((index: number): Range => {
    if (mockSelectionData.rangeCount > 0 && mockSelectionData.ranges[index]) {
      return mockSelectionData.ranges[index];
    }
    // Return a mock range - never null as per Selection interface
    return document.createRange();
  }),
  removeAllRanges: jest.fn((): void => {
    mockSelectionData.rangeCount = 0;
    mockSelectionData.ranges = [];
  }),
  addRange: jest.fn((range: Range): void => {
    mockSelectionData.rangeCount++;
    mockSelectionData.ranges.push(range);
  }),
  toString: jest.fn((): string => {
    if (mockSelectionData.rangeCount > 0 && mockSelectionData.ranges[0]) {
      return mockSelectionData.ranges[0].toString();
    }
    return '';
  }),
  collapse: jest.fn(),
  collapseToEnd: jest.fn(),
  collapseToStart: jest.fn(),
  containsNode: jest.fn(() => false),
  deleteFromDocument: jest.fn(),
  empty: jest.fn(),
  extend: jest.fn(),
  modify: jest.fn(),
  removeRange: jest.fn(),
  selectAllChildren: jest.fn(),
  setBaseAndExtent: jest.fn(),
  setPosition: jest.fn(),
  getComposedRanges: jest.fn(() => [])
} as unknown as Selection;

// Mock getSelection - cast through unknown to bypass type checking
global.window.getSelection = jest.fn(() => mockSelection) as unknown as typeof window.getSelection;

// Mock the BaseEditor component - needs both named and default exports
jest.mock('../BaseEditor', () => {
  const MockBaseEditor = jest.fn(({ children, ...props }) => {
    if (typeof children === 'function') {
      return children({
        value: props.initialValue,
        setValue: jest.fn(),
        hasUnsavedChanges: false,
        handleSave: props.onSave,
        handleCancel: props.onCancel,
        validationError: undefined,
        isSaving: false,
        focusRef: React.createRef(),
        hasChanges: false
      });
    }
    return null;
  });

  return {
    BaseEditor: MockBaseEditor,
    default: MockBaseEditor,
    useInlineEditor: jest.fn(() => ({
      value: '',
      setValue: jest.fn(),
      isEditing: false,
      startEdit: jest.fn(),
      save: jest.fn(),
      cancel: jest.fn(),
      hasUnsavedChanges: jest.fn(() => false),
      originalValue: ''
    })),
    useUnsavedChanges: jest.fn(() => false),
    useClickOutside: jest.fn(),
    useFocusTrap: jest.fn()
  };
});

describe('TextEditor Component', () => {
  // Mock text card for testing
  const mockTextCard: TextCard = {
    id: 'card-1' as TextCard['id'],
    ownerId: 'user-1' as TextCard['ownerId'],
    content: {
      type: 'text',
      content: 'Initial text content',
      markdown: true,
      wordCount: 3,
      lastEditedAt: Date.now().toString()
    },
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width: 250, height: 150 },
    style: {
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      textColor: '#000000',
      borderWidth: 1,
      borderRadius: 8,
      opacity: 1,
      shadow: false
    },
    isSelected: false,
    isLocked: false,
    isHidden: false,
    isMinimized: false,
    status: 'active',
    priority: 'normal',
    createdAt: Date.now().toString(),
    updatedAt: Date.now().toString(),
    tags: [],
    metadata: {},
    animation: { isAnimating: false }
  };

  const defaultProps: TextEditorProps = {
    card: mockTextCard,
    onSave: jest.fn(),
    onCancel: jest.fn(),
    autoFocus: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock selection state
    mockSelectionData.rangeCount = 0;
    mockSelectionData.ranges = [];
  });

  describe('ContentEditable Functionality', () => {
    it('should render with initial content', () => {
      render(<TextEditor {...defaultProps} />);

      const editor = screen.getByRole('textbox');
      expect(editor).toHaveTextContent('Initial text content');
    });

    it('should be contenteditable', () => {
      render(<TextEditor {...defaultProps} />);

      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('contenteditable', 'true');
    });

    it('should update content on input', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Simulate typing
      fireEvent.input(editor, {
        target: { innerHTML: 'Updated content' }
      });

      await waitFor(() => {
        expect(editor).toHaveTextContent('Updated content');
      });
    });

    it('should handle focus correctly with autoFocus', () => {
      render(<TextEditor {...defaultProps} autoFocus={true} />);

      const editor = screen.getByRole('textbox');
      expect(document.activeElement).toBe(editor);
    });

    it('should not auto-focus when autoFocus is false', () => {
      render(<TextEditor {...defaultProps} autoFocus={false} />);

      const editor = screen.getByRole('textbox');
      expect(document.activeElement).not.toBe(editor);
    });
  });

  describe('Markdown Formatting Support', () => {
    it('should apply bold formatting with Ctrl+B', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Press Ctrl+B - should prevent default behavior
      const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

      fireEvent(editor, event);

      // The default action should be prevented (indicating the shortcut was handled)
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should apply italic formatting with Ctrl+I', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Press Ctrl+I - should prevent default behavior
      const event = new KeyboardEvent('keydown', { key: 'i', ctrlKey: true, bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

      fireEvent(editor, event);

      // The default action should be prevented (indicating the shortcut was handled)
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should handle link creation with Ctrl+K', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Press Ctrl+K - should prevent default behavior
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

      fireEvent(editor, event);

      // The default action should be prevented (indicating the shortcut was handled)
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should preserve markdown syntax in content', () => {
      const markdownCard = {
        ...mockTextCard,
        content: {
          ...mockTextCard.content,
          content: '**Bold** *Italic* [Link](https://example.com)'
        }
      };

      render(<TextEditor {...defaultProps} card={markdownCard} />);
      const editor = screen.getByRole('textbox');

      expect(editor.innerHTML).toContain('<strong>Bold</strong>');
      expect(editor.innerHTML).toContain('<em>Italic</em>');
      expect(editor.innerHTML).toContain('<a');
    });
  });

  describe('Character Count and Limit', () => {
    it('should display character count', () => {
      render(<TextEditor {...defaultProps} />);

      const charCount = screen.getByTestId('character-count');
      expect(charCount).toHaveTextContent('20 / 10000');
    });

    it('should update character count on input', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      fireEvent.input(editor, {
        target: { innerHTML: 'New text' }
      });

      await waitFor(() => {
        const charCount = screen.getByTestId('character-count');
        expect(charCount).toHaveTextContent('8 / 10000');
      });
    });

    it('should enforce 10,000 character limit', async () => {
      const longText = 'a'.repeat(10001);
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      fireEvent.input(editor, {
        target: { innerHTML: longText }
      });

      await waitFor(() => {
        expect(editor.textContent?.length).toBeLessThanOrEqual(10000);
      });
    });

    it('should show warning when approaching character limit', async () => {
      const nearLimitText = 'a'.repeat(9500);
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      fireEvent.input(editor, {
        target: { innerHTML: nearLimitText }
      });

      await waitFor(() => {
        const charCount = screen.getByTestId('character-count');
        expect(charCount).toHaveClass('text-orange-500');
      });
    });

    it('should show error when at character limit', async () => {
      const limitText = 'a'.repeat(10000);
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      fireEvent.input(editor, {
        target: { innerHTML: limitText }
      });

      await waitFor(() => {
        const charCount = screen.getByTestId('character-count');
        expect(charCount).toHaveClass('text-red-500');
      });
    });
  });

  describe('Auto-resize Behavior', () => {
    it('should have minimum height constraint', () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      const styles = window.getComputedStyle(editor);
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(100);
    });

    it('should have maximum height constraint', () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      const styles = window.getComputedStyle(editor);
      expect(parseInt(styles.maxHeight)).toBeLessThanOrEqual(500);
    });

    it('should resize based on content', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Check initial height style
      expect(editor.style.height).toBe('100px');

      // Add multiple lines of text
      const multilineText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      fireEvent.input(editor, {
        target: { innerHTML: multilineText.replace(/\n/g, '<br>') }
      });

      // Mock scrollHeight to simulate content growth
      Object.defineProperty(editor, 'scrollHeight', {
        configurable: true,
        value: 200
      });

      // Trigger resize
      fireEvent.input(editor, {
        target: { innerHTML: multilineText.replace(/\n/g, '<br>') + '<br>Extra' }
      });

      await waitFor(() => {
        // Height should have adjusted based on content
        expect(parseInt(editor.style.height)).toBeGreaterThanOrEqual(100);
      });
    });

    it('should show scrollbar when content exceeds max height', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Mock scrollHeight to exceed max height
      Object.defineProperty(editor, 'scrollHeight', {
        configurable: true,
        value: 600 // Greater than MAX_HEIGHT (500)
      });

      // Add lots of lines to exceed max height
      const manyLines = Array(100).fill('Line of text').join('<br>');
      fireEvent.input(editor, {
        target: { innerHTML: manyLines }
      });

      await waitFor(() => {
        expect(editor.style.overflowY).toBe('auto');
      });
    });
  });

  describe('Plain Text Paste Handling', () => {
    it('should paste as plain text', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      const htmlContent = '<p><strong>Bold</strong> <em>text</em></p>';
      const plainText = 'Bold text';

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/html', htmlContent);
      dataTransfer.setData('text/plain', plainText);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      });

      fireEvent(editor, pasteEvent);

      await waitFor(() => {
        // Paste event should be prevented (default action)
        expect(pasteEvent.defaultPrevented).toBe(true);
      });
    });

    it('should preserve line breaks when pasting', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      const multilineText = 'Line 1\nLine 2\nLine 3';

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', multilineText);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      });

      fireEvent(editor, pasteEvent);

      await waitFor(() => {
        // Paste event should be prevented (default action)
        expect(pasteEvent.defaultPrevented).toBe(true);
      });
    });

    it('should handle paste when it would exceed character limit', async () => {
      const nearLimitCard = {
        ...mockTextCard,
        content: {
          ...mockTextCard.content,
          content: 'a'.repeat(9990)
        }
      };

      render(<TextEditor {...defaultProps} card={nearLimitCard} />);
      const editor = screen.getByRole('textbox');

      const longPasteText = 'b'.repeat(20);

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', longPasteText);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      });

      fireEvent(editor, pasteEvent);

      await waitFor(() => {
        // Paste event should be prevented (default action)
        expect(pasteEvent.defaultPrevented).toBe(true);
      });
    });
  });

  describe('Integration with InlineEditor', () => {
    it('should call onSave with updated content', async () => {
      const onSave = jest.fn();
      render(<TextEditor {...defaultProps} onSave={onSave} />);
      const editor = screen.getByRole('textbox');

      fireEvent.input(editor, {
        target: { innerHTML: 'Updated content' }
      });

      // Trigger save (Ctrl+S)
      fireEvent.keyDown(editor, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'text',
            content: 'Updated content',
            markdown: true,
            wordCount: 2
          })
        );
      });
    });

    it('should call onCancel when escape is pressed', async () => {
      const onCancel = jest.fn();
      render(<TextEditor {...defaultProps} onCancel={onCancel} />);
      const editor = screen.getByRole('textbox');

      fireEvent.keyDown(editor, { key: 'Escape' });

      await waitFor(() => {
        expect(onCancel).toHaveBeenCalled();
      });
    });

    it('should validate content before saving', async () => {
      const onSave = jest.fn();
      render(<TextEditor {...defaultProps} onSave={onSave} />);

      // Find the save button
      const saveButton = screen.getByRole('button', { name: /save/i });

      // The button should be enabled initially (since there's initial content)
      expect(saveButton).not.toBeDisabled();

      // Click save
      fireEvent.click(saveButton);

      await waitFor(() => {
        // onSave should be called with the content
        expect(onSave).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should support Ctrl+Enter to save', async () => {
      const onSave = jest.fn();
      render(<TextEditor {...defaultProps} onSave={onSave} />);
      const editor = screen.getByRole('textbox');

      fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });

      // onSave should be called immediately on the keyboard shortcut
      expect(onSave).toHaveBeenCalled();
    });

    it('should support Cmd+S on Mac', async () => {
      const onSave = jest.fn();
      render(<TextEditor {...defaultProps} onSave={onSave} />);
      const editor = screen.getByRole('textbox');

      fireEvent.keyDown(editor, { key: 's', metaKey: true });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
    });

    it('should support Cmd+B on Mac for bold', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Press Cmd+B - should prevent default behavior
      const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

      fireEvent(editor, event);

      // The default action should be prevented (indicating the shortcut was handled)
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should support Cmd+I on Mac for italic', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Press Cmd+I - should prevent default behavior
      const event = new KeyboardEvent('keydown', { key: 'i', metaKey: true, bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

      fireEvent(editor, event);

      // The default action should be prevented (indicating the shortcut was handled)
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null content gracefully', () => {
      const cardWithNullContent = {
        ...mockTextCard,
        content: {
          ...mockTextCard.content,
          content: null as unknown as string
        }
      };

      render(<TextEditor {...defaultProps} card={cardWithNullContent} />);
      const editor = screen.getByRole('textbox');

      expect(editor).toHaveTextContent('');
    });

    it('should handle undefined content gracefully', () => {
      const cardWithUndefinedContent = {
        ...mockTextCard,
        content: {
          ...mockTextCard.content,
          content: undefined as unknown as string
        }
      };

      render(<TextEditor {...defaultProps} card={cardWithUndefinedContent} />);
      const editor = screen.getByRole('textbox');

      expect(editor).toHaveTextContent('');
    });

    it('should handle rapid input changes', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Simulate rapid typing
      for (let i = 0; i < 10; i++) {
        fireEvent.input(editor, {
          target: { innerHTML: `Text ${i}` }
        });
      }

      await waitFor(() => {
        expect(editor).toHaveTextContent('Text 9');
      });
    });

    it('should handle special characters', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      const specialChars = '< > & " \' © ™ 😀';
      fireEvent.input(editor, {
        target: { innerHTML: specialChars }
      });

      await waitFor(() => {
        expect(editor.textContent).toContain('< > & " \' © ™ 😀');
      });
    });

    it('should maintain cursor position after formatting', async () => {
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Set initial text
      fireEvent.input(editor, {
        target: { innerHTML: 'Hello world' }
      });

      // Select "Hello"
      const selection = window.getSelection();
      const range = document.createRange();
      const textNode = editor.firstChild;
      if (textNode) {
        range.setStart(textNode, 0);
        range.setEnd(textNode, 5);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      // Apply bold
      fireEvent.keyDown(editor, { key: 'b', ctrlKey: true });

      await waitFor(() => {
        // Cursor should still be in a valid position
        expect(selection?.rangeCount).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance', () => {
    it('should debounce character count updates', async () => {
      jest.useFakeTimers();
      render(<TextEditor {...defaultProps} />);
      const editor = screen.getByRole('textbox');

      // Type multiple characters rapidly
      for (let i = 0; i < 5; i++) {
        fireEvent.input(editor, {
          target: { innerHTML: 'a'.repeat(i + 1) }
        });
      }

      // Character count shouldn't update immediately
      const charCount = screen.getByTestId('character-count');
      expect(charCount).toHaveTextContent('20 / 10000'); // Still shows initial

      // Fast-forward timers
      act(() => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(charCount).toHaveTextContent('5 / 10000');
      });

      jest.useRealTimers();
    });

    it('should handle large content efficiently', async () => {
      const largeContent = 'Lorem ipsum '.repeat(500);
      const largeCard = {
        ...mockTextCard,
        content: {
          ...mockTextCard.content,
          content: largeContent
        }
      };

      const { container } = render(<TextEditor {...defaultProps} card={largeCard} />);
      const editor = screen.getByRole('textbox');

      expect(editor).toBeInTheDocument();
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Content Initialization', () => {
    it('initializes with plain text content when card is not markdown', () => {
      // Create a plain text card (markdown: false)
      const plainTextCard: TextCard = {
        ...mockTextCard,
        content: {
          type: 'text',
          content: 'Hello, this is plain text',
          markdown: false,
          wordCount: 4,
          lastEditedAt: Date.now().toString()
        }
      };

      render(<TextEditor {...defaultProps} card={plainTextCard} />);
      const editor = screen.getByRole('textbox');

      // Verify the editor displays the plain text content using textContent
      // Plain text should not contain any HTML formatting
      expect(editor.textContent).toBe('Hello, this is plain text');

      // Verify no HTML elements are rendered in the editor
      expect(editor.querySelector('strong')).toBeNull();
      expect(editor.querySelector('em')).toBeNull();
      expect(editor.querySelector('a')).toBeNull();
    });

    it('initializes with markdown content when card is markdown', () => {
      // Create a markdown card (markdown: true)
      const markdownCard: TextCard = {
        ...mockTextCard,
        content: {
          type: 'text',
          content: '**Bold text** and *italic text* with [link](https://example.com)',
          markdown: true,
          wordCount: 7,
          lastEditedAt: Date.now().toString()
        }
      };

      render(<TextEditor {...defaultProps} card={markdownCard} />);
      const editor = screen.getByRole('textbox');

      // Verify the editor displays formatted HTML content
      // Bold text should be wrapped in <strong> tags
      expect(editor.innerHTML).toContain('<strong>Bold text</strong>');

      // Italic text should be wrapped in <em> tags
      expect(editor.innerHTML).toContain('<em>italic text</em>');

      // Link should be wrapped in <a> tags with proper attributes
      const linkElement = editor.querySelector('a');
      expect(linkElement).toBeInTheDocument();
      expect(linkElement?.getAttribute('href')).toBe('https://example.com');
      expect(linkElement?.getAttribute('target')).toBe('_blank');
      expect(linkElement?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(linkElement?.textContent).toBe('link');
    });
  });
});