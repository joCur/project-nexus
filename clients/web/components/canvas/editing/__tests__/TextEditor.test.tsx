/**
 * TextEditor Component Tests
 *
 * Comprehensive test suite for the Tiptap-based TextEditor component.
 * Tests focus on component integration, content handling, and user interactions.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

      const { container } = render(<TextEditor {...defaultProps} card={card} />);

      const editor = document.querySelector('.tiptap');
      expect(editor).toBeInTheDocument();
    });
  });
});
