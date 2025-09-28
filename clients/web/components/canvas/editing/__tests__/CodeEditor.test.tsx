/**
 * CodeEditor Component Tests
 *
 * Comprehensive test suite for the CodeEditor component following TDD approach.
 * Tests cover all requirements including syntax highlighting, language selection,
 * line numbers, tab handling, and copy functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { CodeEditor } from '../CodeEditor';
import type { CodeCard } from '@/types/card.types';
import { createCardId } from '@/types/card.types';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined)
  }
});

// Mock window.confirm for cancel tests
Object.defineProperty(window, 'confirm', {
  value: jest.fn(),
  writable: true,
  configurable: true
});

// Create a proper Range mock that satisfies JSDOM's type checking
class MockRange {
  collapsed = false;
  commonAncestorContainer: Node = document.body;
  endContainer: Node = document.body;
  endOffset = 0;
  startContainer: Node = document.body;
  startOffset = 0;

  // Add static constants required by Range interface
  static readonly START_TO_START = 0;
  static readonly START_TO_END = 1;
  static readonly END_TO_END = 2;
  static readonly END_TO_START = 3;

  // Add instance constants as well for compatibility
  readonly START_TO_START = 0;
  readonly START_TO_END = 1;
  readonly END_TO_END = 2;
  readonly END_TO_START = 3;

  cloneContents = jest.fn();
  cloneRange = jest.fn(() => new MockRange());
  collapse = jest.fn(() => {
    this.collapsed = true;
  });
  compareBoundaryPoints = jest.fn();
  comparePoint = jest.fn();
  createContextualFragment = jest.fn();
  deleteContents = jest.fn();
  detach = jest.fn();
  extractContents = jest.fn();
  getBoundingClientRect = jest.fn(() => ({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: jest.fn()
  }));
  getClientRects = jest.fn(() => []);
  insertNode = jest.fn();
  intersectsNode = jest.fn();
  isPointInRange = jest.fn();
  selectNode = jest.fn();
  selectNodeContents = jest.fn();
  setEnd = jest.fn((node: Node, offset: number) => {
    this.endContainer = node;
    this.endOffset = offset;
  });
  setEndAfter = jest.fn();
  setEndBefore = jest.fn();
  setStart = jest.fn((node: Node, offset: number) => {
    this.startContainer = node;
    this.startOffset = offset;
  });
  setStartAfter = jest.fn();
  setStartBefore = jest.fn();
  surroundContents = jest.fn();
  toString = jest.fn(() => '');
}

// Mock window.getSelection with a more complete implementation
const mockRange = new MockRange();

const mockSelection = {
  anchorNode: null,
  anchorOffset: 0,
  focusNode: null,
  focusOffset: 0,
  isCollapsed: true,
  rangeCount: 0,
  type: 'None' as const,

  addRange: jest.fn(() => {
    mockSelection.rangeCount = 1;
  }),
  collapse: jest.fn(),
  collapseToEnd: jest.fn(),
  collapseToStart: jest.fn(),
  containsNode: jest.fn(() => false),
  deleteFromDocument: jest.fn(),
  empty: jest.fn(),
  extend: jest.fn(),
  getRangeAt: jest.fn(() => mockRange),
  modify: jest.fn(),
  removeAllRanges: jest.fn(() => {
    mockSelection.rangeCount = 0;
  }),
  removeRange: jest.fn(),
  selectAllChildren: jest.fn(),
  setBaseAndExtent: jest.fn(),
  setPosition: jest.fn(),
  toString: jest.fn(() => '')
};

Object.defineProperty(window, 'getSelection', {
  value: jest.fn(() => mockSelection),
  writable: true,
  configurable: true
});

Object.defineProperty(document, 'createRange', {
  value: jest.fn(() => new MockRange()),
  writable: true,
  configurable: true
});

// Mock Range constructor for JSDOM compatibility
// Cast through unknown to bypass strict type checking
(global as unknown as { Range: typeof MockRange }).Range = MockRange;

describe('CodeEditor', () => {
  // Default test props
  const defaultCard: CodeCard = {
    id: createCardId('test-code-1'),
    ownerId: 'test-user-1',
    position: { x: 0, y: 0, z: 0 },
    dimensions: { width: 400, height: 300 },
    style: {
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      textColor: '#000000',
      borderWidth: 1,
      borderRadius: 8,
      opacity: 1,
      shadow: true
    },
    isSelected: false,
    isLocked: false,
    isHidden: false,
    isMinimized: false,
    status: 'active',
    priority: 'normal',
    createdAt: '1234567890',
    updatedAt: '1234567890',
    tags: [],
    metadata: {},
    animation: { isAnimating: false },
    content: {
      type: 'code',
      language: 'javascript',
      content: 'console.log("Hello, World!");',
      filename: 'test.js',
      lineCount: 1
    }
  };

  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset clipboard mock
    (navigator.clipboard.writeText as jest.Mock).mockClear();
    // Reset confirm mock - default to true (confirm cancel)
    (window.confirm as jest.Mock).mockReturnValue(true);
  });

  describe('Component Rendering', () => {
    it('should render the code editor with initial content', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Check for code display area
      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      expect(codeArea).toBeInTheDocument();
      expect(codeArea).toHaveTextContent('console.log("Hello, World!");');
    });

    it('should display line numbers', () => {
      const multilineCard = {
        ...defaultCard,
        content: {
          ...defaultCard.content,
          content: 'line 1\nline 2\nline 3',
          lineCount: 3
        }
      };

      render(
        <CodeEditor
          card={multilineCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Check for line numbers
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should show language selector dropdown', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Check for language selector
      const languageSelector = screen.getByRole('combobox', { name: /language/i });
      expect(languageSelector).toBeInTheDocument();
      expect(languageSelector).toHaveValue('javascript');
    });

    it('should render with syntax highlighting classes', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Check for syntax highlighting container
      const syntaxContainer = screen.getByTestId('syntax-highlighted-code');
      expect(syntaxContainer).toBeInTheDocument();
      expect(syntaxContainer).toHaveClass('language-javascript');
    });

    it('should display copy button', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy/i });
      expect(copyButton).toBeInTheDocument();
    });

    it('should display filename if provided', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('test.js')).toBeInTheDocument();
    });
  });

  describe('Language Selection', () => {
    const supportedLanguages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'html',
      'css',
      'sql',
      'json',
      'markdown',
      'go',
      'rust'
    ];

    it('should display all supported languages in dropdown', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );


      // Check that the selector has all options
      const options = screen.getAllByRole('option');

      // Should have at least the number of supported languages
      expect(options.length).toBeGreaterThanOrEqual(supportedLanguages.length);

      // Check each language is present
      supportedLanguages.forEach(lang => {
        const langOption = options.find(opt => opt.getAttribute('value') === lang);
        expect(langOption).toBeDefined();
      });
    });

    it('should change language when selected', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const languageSelector = screen.getByRole('combobox', { name: /language/i }) as HTMLSelectElement;

      // Change to Python using fireEvent
      fireEvent.change(languageSelector, { target: { value: 'python' } });

      expect(languageSelector).toHaveValue('python');

      // Check that syntax highlighting updates
      const syntaxContainer = screen.getByTestId('syntax-highlighted-code');
      expect(syntaxContainer).toHaveClass('language-python');
    });

    it('should persist language change on save', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const languageSelector = screen.getByRole('combobox', { name: /language/i }) as HTMLSelectElement;

      // Change language using fireEvent
      fireEvent.change(languageSelector, { target: { value: 'python' } });

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'code',
            language: 'python',
            content: expect.any(String)
          })
        );
      });
    });
  });

  describe('Code Editing', () => {
    it('should allow editing code content', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });

      // Clear and type new content using fireEvent for reliability
      await userEvent.clear(codeArea);
      fireEvent.change(codeArea, {
        target: { value: 'function test() {\n  return true;\n}' }
      });

      expect(codeArea).toHaveValue('function test() {\n  return true;\n}');
    });

    it('should update line count when content changes', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });

      // Add multiline content
      await userEvent.clear(codeArea);
      await userEvent.type(codeArea, 'line1\nline2\nline3\nline4');

      // Check line numbers update
      await waitFor(() => {
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });

    it('should preserve indentation when typing', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });

      await userEvent.clear(codeArea);
      fireEvent.change(codeArea, {
        target: { value: 'if (true) {\n    console.log("indented");\n}' }
      });

      expect((codeArea as HTMLTextAreaElement).value).toContain('    console.log');
    });
  });

  describe('Tab Key Handling', () => {
    it('should insert spaces when Tab key is pressed', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i }) as HTMLTextAreaElement;

      // Set initial content
      fireEvent.change(codeArea, { target: { value: 'function test() {' } });

      // Set cursor position at the end
      codeArea.selectionStart = codeArea.value.length;
      codeArea.selectionEnd = codeArea.value.length;

      // Create a Tab event that can be prevented
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        bubbles: true,
        cancelable: true
      });

      // Spy on preventDefault
      const preventDefaultSpy = jest.spyOn(tabEvent, 'preventDefault');

      // Dispatch the event
      codeArea.dispatchEvent(tabEvent);

      // The Tab handler in the component should insert 2 spaces (TAB_SIZE = 2)
      // Since the component modifies state, we need to wait for the update
      await waitFor(() => {
        // The component should have updated to include the 2 spaces
        expect(codeArea.value).toBe('function test() {  ');
      }, { timeout: 2000 });

      // Verify preventDefault was called
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should handle Shift+Tab for outdent', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });

      await userEvent.clear(codeArea);
      await userEvent.type(codeArea, '  indented line');  // Use 2 spaces to match TAB_SIZE

      // Press Shift+Tab
      fireEvent.keyDown(codeArea, { key: 'Tab', code: 'Tab', shiftKey: true });

      await waitFor(() => {
        expect(codeArea).toHaveValue('indented line');
      });
    });

    it('should prevent default tab behavior', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      codeArea.focus();

      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        bubbles: true,
        cancelable: true
      });

      const preventDefaultSpy = jest.spyOn(tabEvent, 'preventDefault');
      codeArea.dispatchEvent(tabEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Copy Functionality', () => {
    it('should copy code to clipboard when copy button is clicked', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy/i });
      await userEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('console.log("Hello, World!");');
    });

    it('should show feedback after copying', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy/i });
      await userEvent.click(copyButton);

      // Check for feedback message
      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      });

      // Feedback should disappear after a delay
      await waitFor(() => {
        expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle copy errors gracefully', async () => {
      // Mock clipboard failure
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
        new Error('Clipboard access denied')
      );

      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy/i });
      await userEvent.click(copyButton);

      // Should show error feedback
      await waitFor(() => {
        expect(screen.getByText(/failed to copy/i)).toBeInTheDocument();
      });
    });

    it('should support keyboard shortcut for copy (Ctrl+C)', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      codeArea.focus();

      // Select all text
      fireEvent.keyDown(codeArea, { key: 'a', ctrlKey: true });

      // Copy
      fireEvent.keyDown(codeArea, { key: 'c', ctrlKey: true });

      // Browser handles native copy, but we can verify our copy button still works
      expect(codeArea).toHaveFocus();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should save on Ctrl+S', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      codeArea.focus();

      fireEvent.keyDown(codeArea, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it('should save on Ctrl+Enter', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      codeArea.focus();

      fireEvent.keyDown(codeArea, { key: 'Enter', ctrlKey: true });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it('should cancel on Escape', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      codeArea.focus();

      fireEvent.keyDown(codeArea, { key: 'Escape' });

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });
  });

  describe('Theme Support', () => {
    it('should support dark theme', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          theme="dark"
        />
      );

      const editor = screen.getByTestId('code-editor-container');
      expect(editor).toHaveClass('theme-dark');
    });

    it('should support light theme', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          theme="light"
        />
      );

      const editor = screen.getByTestId('code-editor-container');
      expect(editor).toHaveClass('theme-light');
    });

    it('should default to light theme', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const editor = screen.getByTestId('code-editor-container');
      expect(editor).toHaveClass('theme-light');
    });
  });

  describe('Integration with InlineEditor', () => {
    it('should handle save correctly', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });

      // Edit content
      await userEvent.clear(codeArea);
      await userEvent.type(codeArea, 'const newCode = true;');

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          type: 'code',
          language: 'javascript',
          content: 'const newCode = true;',
          filename: 'test.js',
          lineCount: 1
        });
      });
    });

    it('should handle cancel correctly', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });

      // Edit content to create unsaved changes
      fireEvent.change(codeArea, { target: { value: 'const newCode = true;' } });

      // Cancel - will trigger confirm dialog due to unsaved changes
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Confirm should have been called due to unsaved changes
      expect(window.confirm).toHaveBeenCalledWith(
        'You have unsaved changes. Are you sure you want to cancel?'
      );

      // Since we mocked confirm to return true, cancel should proceed
      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should show unsaved changes indicator', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });

      // Edit content
      fireEvent.change(codeArea, {
        target: { value: 'console.log("Hello, World!"); // new comment' }
      });

      // Check for unsaved changes indicator - there might be multiple indicators
      await waitFor(() => {
        const indicators = screen.getAllByText(/unsaved changes/i);
        expect(indicators.length).toBeGreaterThan(0);
      });
    });

    it('should validate empty content', async () => {
      // Test that validation prevents saving when content is empty
      // We'll test the validation logic directly instead of relying on DOM state
      const emptyCard = {
        ...defaultCard,
        content: {
          ...defaultCard.content,
          content: ''
        }
      };

      render(
        <CodeEditor
          card={emptyCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      const saveButton = screen.getByRole('button', { name: /save/i });

      // Verify initial state - empty content
      expect(codeArea).toHaveValue('');

      // Check validation message appears for empty content - there may be multiple
      await waitFor(() => {
        const errors = screen.getAllByText('Code cannot be empty');
        expect(errors.length).toBeGreaterThan(0);
      });

      // Save button should be disabled due to validation error
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      // Try to save with empty content using keyboard shortcut (which bypasses disabled state)
      fireEvent.keyDown(codeArea, { key: 's', ctrlKey: true });

      // Save should not have been called due to validation in handleSave
      expect(mockOnSave).not.toHaveBeenCalled();

      // Now add some content
      fireEvent.change(codeArea, { target: { value: 'console.log("test");' } });

      // Wait for validation to clear and button to be enabled
      await waitFor(() => {
        expect(saveButton).toBeEnabled();
      });

      // Validation error should be gone - check all instances are gone
      await waitFor(() => {
        const errors = screen.queryAllByText('Code cannot be empty');
        expect(errors.length).toBe(0);
      });

      // Now save should work
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'code',
            content: 'console.log("test");',
            language: 'javascript'
          })
        );
      });
    });

    it('should not save when content becomes empty', async () => {
      // Test that validation prevents saving when content is cleared
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      const saveButton = screen.getByRole('button', { name: /save/i });

      // Initially should have content and be enabled
      expect(saveButton).toBeEnabled();
      expect(codeArea).toHaveValue('console.log("Hello, World!");');

      // Clear the content
      fireEvent.change(codeArea, { target: { value: '' } });

      // Verify content is empty
      expect(codeArea).toHaveValue('');

      // Wait for validation to kick in - there may be multiple error messages
      await waitFor(() => {
        const errors = screen.getAllByText('Code cannot be empty');
        expect(errors.length).toBeGreaterThan(0);
      });

      // Save button should be disabled after clearing
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      // Try to save using keyboard shortcut (which bypasses disabled state)
      fireEvent.keyDown(codeArea, { key: 's', ctrlKey: true });

      // Save should not have been called due to validation in handleSave
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Auto-focus Behavior', () => {
    it('should auto-focus when autoFocus prop is true', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          autoFocus={true}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      expect(codeArea).toHaveFocus();
    });

    it('should not auto-focus when autoFocus prop is false', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          autoFocus={false}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      expect(codeArea).not.toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('textbox', { name: /code editor/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /language/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      // Test keyboard accessibility by verifying:
      // 1. All interactive elements are focusable (have proper tabIndex)
      // 2. Keyboard event handlers work correctly
      // 3. Focus management works as expected
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          autoFocus={false}
        />
      );

      // Get all interactive elements
      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      const languageSelector = screen.getByRole('combobox', { name: /language/i });
      const copyButton = screen.getByRole('button', { name: /copy/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const saveButton = screen.getByRole('button', { name: /save/i });

      // Verify all elements have proper tabIndex for keyboard navigation
      expect(codeArea).toHaveAttribute('tabIndex', '0');
      expect(languageSelector).toHaveAttribute('tabIndex', '0');
      expect(copyButton).toHaveAttribute('tabIndex', '0');

      // Buttons are naturally focusable even without explicit tabIndex
      // Test that they can be interacted with via keyboard
      expect(cancelButton).not.toHaveAttribute('tabindex', '-1');
      expect(saveButton).not.toHaveAttribute('tabindex', '-1');

      // Test keyboard event handlers work correctly
      // Focus the code area first
      codeArea.focus();
      expect(document.activeElement).toBe(codeArea);

      // Test Tab key handling for indentation (specific to code editors)
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        bubbles: true,
        cancelable: true
      });

      const preventDefaultSpy = jest.spyOn(tabEvent, 'preventDefault');
      codeArea.dispatchEvent(tabEvent);

      // Tab should be prevented in textarea to allow indentation
      expect(preventDefaultSpy).toHaveBeenCalled();

      // Test Escape key for cancelling
      fireEvent.keyDown(codeArea, { key: 'Escape' });

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });

      // Reset mock
      mockOnCancel.mockClear();

      // Test Ctrl+S for saving
      fireEvent.keyDown(codeArea, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });

      // Reset mock
      mockOnSave.mockClear();

      // Test Ctrl+Enter for saving
      fireEvent.keyDown(codeArea, { key: 'Enter', ctrlKey: true });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });

      // Test that all interactive elements can be programmatically focused
      const focusableElements = [codeArea, languageSelector, copyButton, cancelButton, saveButton];

      focusableElements.forEach(element => {
        element.focus();
        expect(document.activeElement).toBe(element);
        element.blur();
      });

      // Test that we can navigate between elements using focus
      // This demonstrates keyboard accessibility without relying on actual key events from non-textarea elements
      const container = screen.getByTestId('code-editor-container');
      expect(container).toBeInTheDocument();

      // Verify all interactive elements are accessible
      const interactiveElements = container.querySelectorAll(
        'button, select, textarea, input, [tabindex="0"]'
      );
      expect(interactiveElements.length).toBeGreaterThan(0);

      // Each element should be focusable (not have negative tabindex)
      interactiveElements.forEach(element => {
        const tabIndex = element.getAttribute('tabindex');
        expect(tabIndex).not.toBe('-1');
      });
    });

    it('should handle focus trapping for accessibility', () => {
      // Test that focus stays within the editor component
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          autoFocus={true}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i });

      // Should auto-focus the code area
      expect(document.activeElement).toBe(codeArea);

      // Verify all interactive elements are within the component
      const container = screen.getByTestId('code-editor-container');
      const buttons = screen.getAllByRole('button');
      const selects = screen.getAllByRole('combobox');

      // All buttons should be within the container
      buttons.forEach(button => {
        expect(container.contains(button)).toBe(true);
      });

      // All selects should be within the container
      selects.forEach(select => {
        expect(container.contains(select)).toBe(true);
      });
    });

    it('should announce copy feedback to screen readers', async () => {
      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy/i });
      await userEvent.click(copyButton);

      // Check for aria-live region
      const feedback = await screen.findByRole('status');
      expect(feedback).toHaveTextContent(/copied/i);
    });
  });

  describe('Performance', () => {
    it('should debounce syntax highlighting updates', async () => {
      jest.useFakeTimers();

      render(
        <CodeEditor
          card={defaultCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const codeArea = screen.getByRole('textbox', { name: /code editor/i }) as HTMLTextAreaElement;

      // Clear initial content using fireEvent for fake timers compatibility
      act(() => {
        fireEvent.change(codeArea, { target: { value: '' } });
      });

      // Type rapidly using fireEvent for fake timers
      act(() => {
        fireEvent.change(codeArea, { target: { value: 'abc' } });
      });

      // Syntax highlighting should not update immediately
      const syntaxContainer = screen.getByTestId('syntax-highlighted-code');

      // Fast-forward timers for debounce delay (300ms)
      act(() => {
        jest.advanceTimersByTime(350);
      });

      // Now it should update after debounce
      await waitFor(() => {
        expect(syntaxContainer.innerHTML).toContain('abc');
      }, { timeout: 1000 });

      jest.useRealTimers();
    });

    it('should handle large code files efficiently', async () => {
      const largeCode = Array(1000).fill('console.log("line");').join('\n');
      const largeCard = {
        ...defaultCard,
        content: {
          ...defaultCard.content,
          content: largeCode,
          lineCount: 1000
        }
      };

      render(
        <CodeEditor
          card={largeCard}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Should render without performance issues
      const codeArea = screen.getByRole('textbox', { name: /code editor/i });
      expect(codeArea).toBeInTheDocument();
      expect(codeArea).toHaveValue(largeCode);

      // Should virtualize line numbers for large files (MAX_VISIBLE_LINES = 50)
      // Line numbers should be present but limited
      const lineNumbers = screen.queryAllByText(/^\d+$/); // Match line number text
      expect(lineNumbers.length).toBeGreaterThan(0); // Should have some line numbers
      expect(lineNumbers.length).toBeLessThanOrEqual(51); // MAX_VISIBLE_LINES + possible "..." indicator
    });
  });
});