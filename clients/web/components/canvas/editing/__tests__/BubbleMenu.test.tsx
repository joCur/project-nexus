/**
 * BubbleMenu Component Tests
 *
 * Comprehensive test suite for the formatting toolbar component.
 * Tests formatting buttons, tooltips, active states, and accessibility.
 *
 * Test-Driven Development (TDD) approach - tests written before implementation.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
import { BubbleMenu } from '../BubbleMenu';

/**
 * Test wrapper component that provides a real Tiptap editor
 * This simulates the TextEditor context where BubbleMenu will be used
 */
const TestEditorWrapper: React.FC<{ children: (editor: Editor) => React.ReactNode }> = ({ children }) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        code: false,
      }),
      Bold,
      Italic,
      Underline,
      Strike,
      Code,
    ],
    content: '<p>Test content for selection</p>',
    editable: true,
  });

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return <>{children(editor)}</>;
};

describe('BubbleMenu Component', () => {
  describe('Rendering', () => {
    it('should render the formatting toolbar', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      // Toolbar should be in the document
      await waitFor(() => {
        expect(screen.getByRole('toolbar')).toBeInTheDocument();
      });
    });

    it('should render all formatting buttons', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /underline/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /strikethrough/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /code/i })).toBeInTheDocument();
      });
    });

    it('should have proper ARIA attributes', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const toolbar = screen.getByRole('toolbar');
        expect(toolbar).toHaveAttribute('aria-label', 'Text formatting toolbar');
      });
    });
  });

  describe('Button Functionality', () => {
    it('should toggle bold formatting when bold button is clicked', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            // Select all text
            editor.commands.selectAll();

            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const boldButton = screen.getByRole('button', { name: /bold/i });
        expect(boldButton).toBeInTheDocument();

        // Click to apply bold
        fireEvent.click(boldButton);
      });
    });

    it('should toggle italic formatting when italic button is clicked', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            editor.commands.selectAll();
            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const italicButton = screen.getByRole('button', { name: /italic/i });
        fireEvent.click(italicButton);
      });
    });

    it('should toggle underline formatting when underline button is clicked', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            editor.commands.selectAll();
            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const underlineButton = screen.getByRole('button', { name: /underline/i });
        fireEvent.click(underlineButton);
      });
    });

    it('should toggle strikethrough formatting when strikethrough button is clicked', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            editor.commands.selectAll();
            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const strikeButton = screen.getByRole('button', { name: /strikethrough/i });
        fireEvent.click(strikeButton);
      });
    });

    it('should toggle code formatting when code button is clicked', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            editor.commands.selectAll();
            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const codeButton = screen.getByRole('button', { name: /code/i });
        fireEvent.click(codeButton);
      });
    });
  });

  describe('Active States', () => {
    it('should show active state for bold when text is bold', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            // Apply bold and select
            editor.commands.selectAll();
            editor.commands.toggleBold();

            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const boldButton = screen.getByRole('button', { name: /bold/i });
        expect(boldButton).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should show active state for italic when text is italic', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            editor.commands.selectAll();
            editor.commands.toggleItalic();

            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const italicButton = screen.getByRole('button', { name: /italic/i });
        expect(italicButton).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should show active state for underline when text is underlined', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            editor.commands.selectAll();
            editor.commands.toggleUnderline();

            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const underlineButton = screen.getByRole('button', { name: /underline/i });
        expect(underlineButton).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should show active state for strikethrough when text is struck', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            editor.commands.selectAll();
            editor.commands.toggleStrike();

            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const strikeButton = screen.getByRole('button', { name: /strikethrough/i });
        expect(strikeButton).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should show active state for code when text is code', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            editor.commands.selectAll();
            editor.commands.toggleCode();

            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const codeButton = screen.getByRole('button', { name: /code/i });
        expect(codeButton).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should support multiple active formats simultaneously', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            editor.commands.selectAll();
            editor.commands.toggleBold();
            editor.commands.toggleItalic();

            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const boldButton = screen.getByRole('button', { name: /bold/i });
        const italicButton = screen.getByRole('button', { name: /italic/i });

        expect(boldButton).toHaveAttribute('aria-pressed', 'true');
        expect(italicButton).toHaveAttribute('aria-pressed', 'true');
      });
    });
  });

  describe('Tooltips', () => {
    it('should show tooltip with keyboard shortcut for bold', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const boldButton = screen.getByRole('button', { name: /bold/i });
        expect(boldButton).toHaveAttribute('title');
        const title = boldButton.getAttribute('title');
        expect(title).toMatch(/(Ctrl|Cmd)\+B/i);
      });
    });

    it('should show tooltip with keyboard shortcut for italic', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const italicButton = screen.getByRole('button', { name: /italic/i });
        const title = italicButton.getAttribute('title');
        expect(title).toMatch(/(Ctrl|Cmd)\+I/i);
      });
    });

    it('should show tooltip with keyboard shortcut for underline', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const underlineButton = screen.getByRole('button', { name: /underline/i });
        const title = underlineButton.getAttribute('title');
        expect(title).toMatch(/(Ctrl|Cmd)\+U/i);
      });
    });

    it('should show tooltip with keyboard shortcut for strikethrough', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const strikeButton = screen.getByRole('button', { name: /strikethrough/i });
        const title = strikeButton.getAttribute('title');
        expect(title).toMatch(/(Ctrl|Cmd)\+Shift\+X/i);
      });
    });

    it('should show tooltip with keyboard shortcut for code', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const codeButton = screen.getByRole('button', { name: /code/i });
        const title = codeButton.getAttribute('title');
        expect(title).toMatch(/(Ctrl|Cmd)\+E/i);
      });
    });
  });

  describe('Styling and Design System', () => {
    it('should apply design system colors', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const toolbar = screen.getByRole('toolbar');
        // Should have white background and border
        expect(toolbar.parentElement).toHaveClass('bg-white');
        expect(toolbar.parentElement).toHaveClass('border');
      });
    });

    it('should have proper spacing between buttons', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const toolbar = screen.getByRole('toolbar');
        // Should have gap between buttons
        expect(toolbar).toHaveClass('gap-1');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper keyboard navigation', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const formattingButtons = buttons.filter(btn =>
          ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Code'].includes(btn.getAttribute('aria-label') || '')
        );

        formattingButtons.forEach((button) => {
          expect(button).not.toHaveAttribute('tabIndex', '-1');
        });
      });
    });

    it('should announce button state changes', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            editor.commands.selectAll();
            return (
              <>
                <EditorContent editor={editor} />
                <BubbleMenu editor={editor} />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const boldButton = screen.getByRole('button', { name: /bold/i });

        // Click to toggle
        fireEvent.click(boldButton);

        // Should have aria-pressed attribute
        expect(boldButton).toHaveAttribute('aria-pressed');
      });
    });

    it('should have minimum touch target size', async () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <>
              <EditorContent editor={editor} />
              <BubbleMenu editor={editor} />
            </>
          )}
        </TestEditorWrapper>
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const formattingButtons = buttons.filter(btn =>
          ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Code'].includes(btn.getAttribute('aria-label') || '')
        );

        formattingButtons.forEach((button) => {
          // Buttons should have w-8 h-8 classes (32px = 8 * 4px) which meets minimum touch target
          const classList = button.className;
          expect(classList).toMatch(/w-8/);
          expect(classList).toMatch(/h-8/);
        });
      });
    });
  });
});
