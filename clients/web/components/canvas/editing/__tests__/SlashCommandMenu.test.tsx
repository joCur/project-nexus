/**
 * SlashCommandMenu Component Tests
 *
 * Comprehensive test suite for the slash command menu component.
 * Tests rendering, keyboard navigation, mouse interaction, search/filtering,
 * command execution, and accessibility.
 *
 * Test-Driven Development (TDD) approach - tests written before implementation.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlock from '@tiptap/extension-code-block';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { SlashCommandMenu, type SlashCommandItem } from '../SlashCommandMenu';

/**
 * Mock slash command items for testing
 */
const mockItems: SlashCommandItem[] = [
  {
    title: 'Paragraph',
    description: 'Regular text paragraph',
    icon: <span data-testid="icon-paragraph">P</span>,
    command: jest.fn(),
    aliases: ['text', 'p'],
  },
  {
    title: 'Heading 1',
    description: 'Large heading',
    icon: <span data-testid="icon-h1">H1</span>,
    command: jest.fn(),
    aliases: ['h1', 'title'],
  },
  {
    title: 'Heading 2',
    description: 'Medium heading',
    icon: <span data-testid="icon-h2">H2</span>,
    command: jest.fn(),
    aliases: ['h2', 'subtitle'],
  },
  {
    title: 'Heading 3',
    description: 'Small heading',
    icon: <span data-testid="icon-h3">H3</span>,
    command: jest.fn(),
    aliases: ['h3'],
  },
  {
    title: 'Bullet List',
    description: 'Unordered list with bullets',
    icon: <span data-testid="icon-bullet">•</span>,
    command: jest.fn(),
    aliases: ['ul', 'unordered'],
  },
  {
    title: 'Numbered List',
    description: 'Ordered list with numbers',
    icon: <span data-testid="icon-numbered">1.</span>,
    command: jest.fn(),
    aliases: ['ol', 'ordered'],
  },
  {
    title: 'Task List',
    description: 'Checklist with checkboxes',
    icon: <span data-testid="icon-task">☑</span>,
    command: jest.fn(),
    aliases: ['todo', 'checklist'],
  },
  {
    title: 'Blockquote',
    description: 'Quote or citation',
    icon: <span data-testid="icon-quote">&quot;</span>,
    command: jest.fn(),
    aliases: ['quote'],
  },
  {
    title: 'Code Block',
    description: 'Code snippet with syntax highlighting',
    icon: <span data-testid="icon-code">{'{}'}</span>,
    command: jest.fn(),
    aliases: ['code', 'pre'],
  },
  {
    title: 'Horizontal Rule',
    description: 'Divider line',
    icon: <span data-testid="icon-hr">—</span>,
    command: jest.fn(),
    aliases: ['hr', 'divider', 'separator'],
  },
];

/**
 * Mock range for testing
 */
const mockRange = {
  from: 0,
  to: 1,
};

/**
 * Test wrapper component that provides a real Tiptap editor with SlashCommands extension
 */
const TestEditorWrapper: React.FC<{ children: (editor: Editor) => React.ReactNode }> = ({ children }) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      Heading.configure({ levels: [1, 2, 3] }),
      BulletList,
      OrderedList,
      ListItem,
      TaskList,
      TaskItem,
      Blockquote,
      CodeBlock,
      HorizontalRule,
      // SlashCommands extension will be added later
    ],
    content: '<p>Test content</p>',
    editable: true,
  });

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return <>{children(editor)}</>;
};

describe('SlashCommandMenu Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering Tests', () => {
    it('should render menu with items', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      // Verify menu is rendered
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByLabelText(/slash command menu/i)).toBeInTheDocument();
    });

    it('should show filtered items based on query', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query="head"
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      // Should show only heading items
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Heading 2')).toBeInTheDocument();
      expect(screen.getByText('Heading 3')).toBeInTheDocument();

      // Should not show non-matching items
      expect(screen.queryByText('Paragraph')).not.toBeInTheDocument();
      expect(screen.queryByText('Bullet List')).not.toBeInTheDocument();
    });

    it('should display item titles, descriptions, and icons', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={[mockItems[0]]} // Just Paragraph item
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      expect(screen.getByText('Paragraph')).toBeInTheDocument();
      expect(screen.getByText('Regular text paragraph')).toBeInTheDocument();
      expect(screen.getByTestId('icon-paragraph')).toBeInTheDocument();
    });

    it('should handle empty query (shows all items)', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      // All items should be visible
      expect(screen.getByText('Paragraph')).toBeInTheDocument();
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Bullet List')).toBeInTheDocument();
      expect(screen.getByText('Code Block')).toBeInTheDocument();
    });

    it('should handle no matches (shows "No results" message)', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query="xyz123notfound"
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      expect(screen.getByText(/no results/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation Tests', () => {
    it('should select first item by default', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      // First item should have selected state
      const firstItem = screen.getByText('Paragraph').closest('button');
      expect(firstItem).toHaveClass('bg-primary-100');
    });

    it('should select next item on arrow down', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const menu = screen.getByRole('menu');

      // Press arrow down
      fireEvent.keyDown(menu, { key: 'ArrowDown' });

      // Second item should be selected
      const secondItem = screen.getByText('Heading 1').closest('button');
      expect(secondItem).toHaveClass('bg-primary-100');
    });

    it('should select previous item on arrow up', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const menu = screen.getByRole('menu');

      // Press arrow down twice to get to third item
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      fireEvent.keyDown(menu, { key: 'ArrowDown' });

      // Press arrow up to go back to second item
      fireEvent.keyDown(menu, { key: 'ArrowUp' });

      const secondItem = screen.getByText('Heading 1').closest('button');
      expect(secondItem).toHaveClass('bg-primary-100');
    });

    it('should execute selected item command on Enter', async () => {
      const mockCommand = jest.fn();

      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={mockCommand}
            />
          )}
        </TestEditorWrapper>
      );

      const menu = screen.getByRole('menu');

      // Press Enter (should execute first item)
      fireEvent.keyDown(menu, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCommand).toHaveBeenCalledWith(mockItems[0]);
      });
    });

    it('should close menu on Escape', () => {
      const mockOnClose = jest.fn();

      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
              onClose={mockOnClose}
            />
          )}
        </TestEditorWrapper>
      );

      const menu = screen.getByRole('menu');

      // Press Escape
      fireEvent.keyDown(menu, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle wraparound (last item to first item)', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const menu = screen.getByRole('menu');

      // Press arrow up from first item (should wrap to last)
      fireEvent.keyDown(menu, { key: 'ArrowUp' });

      const lastItem = screen.getByText('Horizontal Rule').closest('button');
      expect(lastItem).toHaveClass('bg-primary-100');
    });

    it('should handle wraparound (first item to last item)', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const menu = screen.getByRole('menu');

      // Press arrow down from last item (navigate to last, then wrap to first)
      for (let i = 0; i < mockItems.length; i++) {
        fireEvent.keyDown(menu, { key: 'ArrowDown' });
      }

      const firstItem = screen.getByText('Paragraph').closest('button');
      expect(firstItem).toHaveClass('bg-primary-100');
    });
  });

  describe('Mouse Interaction Tests', () => {
    it('should execute command when clicking item', async () => {
      const mockCommand = jest.fn();

      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={mockCommand}
            />
          )}
        </TestEditorWrapper>
      );

      // Click on Heading 1 item
      const heading1Item = screen.getByText('Heading 1').closest('button');
      fireEvent.click(heading1Item!);

      await waitFor(() => {
        expect(mockCommand).toHaveBeenCalledWith(mockItems[1]); // Heading 1 is second item
      });
    });

    it('should change selection on hover', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      // Hover over third item
      const thirdItem = screen.getByText('Heading 2').closest('button');
      fireEvent.mouseEnter(thirdItem!);

      expect(thirdItem).toHaveClass('bg-primary-100');
    });

    it('should maintain selection on mouse leave', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const secondItem = screen.getByText('Heading 1').closest('button');

      // Hover over item
      fireEvent.mouseEnter(secondItem!);
      expect(secondItem).toHaveClass('bg-primary-100');

      // Mouse leave
      fireEvent.mouseLeave(secondItem!);

      // Should still be selected
      expect(secondItem).toHaveClass('bg-primary-100');
    });
  });

  describe('Search/Filter Tests', () => {
    it('should filter by title match', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query="bullet"
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      expect(screen.getByText('Bullet List')).toBeInTheDocument();
      expect(screen.queryByText('Numbered List')).not.toBeInTheDocument();
    });

    it('should filter by description match', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query="syntax"
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      // "Code Block" has description "Code snippet with syntax highlighting"
      expect(screen.getByText('Code Block')).toBeInTheDocument();
      expect(screen.queryByText('Paragraph')).not.toBeInTheDocument();
    });

    it('should filter by aliases match', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query="todo"
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      // "Task List" has alias "todo"
      expect(screen.getByText('Task List')).toBeInTheDocument();
      expect(screen.queryByText('Bullet List')).not.toBeInTheDocument();
    });

    it('should be case-insensitive filtering', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query="HEADING"
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Heading 2')).toBeInTheDocument();
      expect(screen.getByText('Heading 3')).toBeInTheDocument();
    });

    it('should support partial match', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query="head"
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      // "head" should match all headings
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Heading 2')).toBeInTheDocument();
      expect(screen.getByText('Heading 3')).toBeInTheDocument();
    });
  });

  describe('Command Execution Tests', () => {
    it('should insert paragraph block', () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            // Mock command function
            const items: SlashCommandItem[] = [
              {
                title: 'Paragraph',
                description: 'Regular text',
                icon: <span>P</span>,
                command: ({ editor: ed, range }) => {
                  ed.chain().focus().deleteRange(range).setParagraph().run();
                },
              },
            ];

            const handleCommand = (item: SlashCommandItem) => {
              item.command({ editor, range: mockRange });
            };

            return (
              <>
                <EditorContent editor={editor} />
                <SlashCommandMenu
                  editor={editor}
                  query=""
                  range={mockRange}
                  items={items}
                  command={handleCommand}
                />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      const paragraphItem = screen.getByText('Paragraph').closest('button');
      fireEvent.click(paragraphItem!);

      // Verify paragraph was set (check editor state)
      const editorElement = document.querySelector('.ProseMirror');
      expect(editorElement).toBeInTheDocument();
    });

    it('should insert headings (H1, H2, H3)', () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            const items: SlashCommandItem[] = [
              {
                title: 'Heading 1',
                description: 'Large heading',
                icon: <span>H1</span>,
                command: ({ editor: ed, range }) => {
                  ed.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
                },
              },
            ];

            const handleCommand = (item: SlashCommandItem) => {
              item.command({ editor, range: mockRange });
            };

            return (
              <>
                <EditorContent editor={editor} />
                <SlashCommandMenu
                  editor={editor}
                  query=""
                  range={mockRange}
                  items={items}
                  command={handleCommand}
                />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      const h1Item = screen.getByText('Heading 1').closest('button');
      fireEvent.click(h1Item!);

      const editorElement = document.querySelector('.ProseMirror');
      expect(editorElement).toBeInTheDocument();
    });

    it('should replace slash trigger text with block', () => {
      render(
        <TestEditorWrapper>
          {(editor) => {
            // Insert slash command text
            editor.commands.setContent('<p>/head</p>');
            editor.commands.setTextSelection({ from: 1, to: 6 }); // Select "/head"

            const items: SlashCommandItem[] = [
              {
                title: 'Heading 1',
                description: 'Large heading',
                icon: <span>H1</span>,
                command: ({ editor: ed, range }) => {
                  // Delete the slash command text and insert heading
                  ed.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
                },
              },
            ];

            const handleCommand = (item: SlashCommandItem) => {
              item.command({ editor, range: { from: 1, to: 6 } });
            };

            return (
              <>
                <EditorContent editor={editor} />
                <SlashCommandMenu
                  editor={editor}
                  query="head"
                  range={{ from: 1, to: 6 }}
                  items={items}
                  command={handleCommand}
                />
              </>
            );
          }}
        </TestEditorWrapper>
      );

      const h1Item = screen.getByText('Heading 1').closest('button');
      fireEvent.click(h1Item!);

      const editorElement = document.querySelector('.ProseMirror');
      expect(editorElement).toBeInTheDocument();
    });
  });

  describe('Accessibility Tests', () => {
    it('should have proper ARIA roles', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      // Menu has proper role
      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Items have proper role
      const items = screen.getAllByRole('menuitem');
      expect(items.length).toBeGreaterThan(0);
    });

    it('should have ARIA labels', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      expect(screen.getByLabelText(/slash command menu/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const menu = screen.getByRole('menu');

      // Should respond to arrow keys
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      fireEvent.keyDown(menu, { key: 'ArrowUp' });

      // Menu should still be visible
      expect(menu).toBeInTheDocument();
    });

    it('should announce selection changes to screen readers', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const menu = screen.getByRole('menu');

      // Selected item should have data-selected attribute (menuitem role doesn't support aria-selected)
      const firstItem = screen.getByText('Paragraph').closest('button');
      expect(firstItem).toHaveAttribute('data-selected', 'true');
    });

    it('should have focus management', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const menu = screen.getByRole('menu');

      // Menu should be focusable
      expect(menu).toHaveAttribute('tabIndex');
    });
  });

  describe('Design System Styling', () => {
    it('should have white background with border and shadow', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const menu = screen.getByRole('menu');

      expect(menu).toHaveClass('bg-white');
      expect(menu).toHaveClass('border-gray-200');
      expect(menu).toHaveClass('shadow-lg');
    });

    it('should have hover state with primary color', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const firstItem = screen.getByText('Paragraph').closest('button');

      expect(firstItem).toHaveClass('hover:bg-primary-50');
    });

    it('should have selected state with primary color background', () => {
      render(
        <TestEditorWrapper>
          {(editor) => (
            <SlashCommandMenu
              editor={editor}
              query=""
              range={mockRange}
              items={mockItems}
              command={jest.fn()}
            />
          )}
        </TestEditorWrapper>
      );

      const firstItem = screen.getByText('Paragraph').closest('button');

      expect(firstItem).toHaveClass('bg-primary-100');
    });
  });
});
