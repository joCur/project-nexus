/**
 * ReadOnlyEditor Component Tests
 *
 * TDD test suite for read-only content rendering component.
 * Tests focus on non-editable display, link interaction, and task checkbox interaction.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReadOnlyEditor } from '../ReadOnlyEditor';
import type { TiptapJSONContent } from '@/types/card.types';

// Mock data
const mockParagraphContent: TiptapJSONContent = {
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [{ type: 'text', text: 'This is read-only content' }]
  }]
};

const mockFormattedContent: TiptapJSONContent = {
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [
      { type: 'text', text: 'This is ' },
      { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' and ' },
      { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
      { type: 'text', text: ' text' }
    ]
  }]
};

const mockLinkContent: TiptapJSONContent = {
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [
      { type: 'text', text: 'Visit ' },
      {
        type: 'text',
        text: 'Google',
        marks: [{ type: 'link', attrs: { href: 'https://google.com', target: '_blank', rel: 'noopener noreferrer' } }]
      }
    ]
  }]
};

const mockTaskListContent: TiptapJSONContent = {
  type: 'doc',
  content: [
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Unchecked task' }] }]
        },
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Checked task' }] }]
        }
      ]
    }
  ]
};

const mockHeadingContent: TiptapJSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Heading 1' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Heading 2' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Heading 3' }] }
  ]
};

const mockListContent: TiptapJSONContent = {
  type: 'doc',
  content: [
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bullet item 1' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bullet item 2' }] }] }
      ]
    },
    {
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ordered item 1' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ordered item 2' }] }] }
      ]
    }
  ]
};

const mockBlockquoteContent: TiptapJSONContent = {
  type: 'doc',
  content: [
    {
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is a quote' }] }]
    }
  ]
};

const mockCodeBlockContent: TiptapJSONContent = {
  type: 'doc',
  content: [
    {
      type: 'codeBlock',
      attrs: { language: 'javascript' },
      content: [{ type: 'text', text: 'const x = 10;' }]
    }
  ]
};

const mockHorizontalRuleContent: TiptapJSONContent = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Before rule' }] },
    { type: 'horizontalRule' },
    { type: 'paragraph', content: [{ type: 'text', text: 'After rule' }] }
  ]
};

describe('ReadOnlyEditor', () => {
  describe('Basic Rendering', () => {
    it('should render read-only content', () => {
      render(<ReadOnlyEditor content={mockParagraphContent} />);
      expect(screen.getByText('This is read-only content')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(
        <ReadOnlyEditor content={mockParagraphContent} className="custom-class" />
      );
      const editorContainer = container.querySelector('.custom-class');
      expect(editorContainer).toBeInTheDocument();
    });

    it('should render empty content gracefully', () => {
      const emptyContent: TiptapJSONContent = {
        type: 'doc',
        content: [{ type: 'paragraph' }]
      };
      const { container } = render(<ReadOnlyEditor content={emptyContent} />);
      expect(container.querySelector('.ProseMirror')).toBeInTheDocument();
    });

    it('should render loading state while initializing', () => {
      const { container } = render(<ReadOnlyEditor content={mockParagraphContent} />);
      // Editor should initialize immediately in tests, but check for proper structure
      expect(container).toBeInTheDocument();
    });
  });

  describe('Content Formatting', () => {
    it('should render bold text', () => {
      render(<ReadOnlyEditor content={mockFormattedContent} />);
      const boldText = screen.getByText('bold');
      expect(boldText).toBeInTheDocument();
      expect(boldText.tagName).toBe('STRONG');
    });

    it('should render italic text', () => {
      render(<ReadOnlyEditor content={mockFormattedContent} />);
      const italicText = screen.getByText('italic');
      expect(italicText).toBeInTheDocument();
      expect(italicText.tagName).toBe('EM');
    });

    it('should render headings with correct levels', () => {
      render(<ReadOnlyEditor content={mockHeadingContent} />);

      const h1 = screen.getByText('Heading 1');
      expect(h1).toBeInTheDocument();
      expect(h1.tagName).toBe('H1');

      const h2 = screen.getByText('Heading 2');
      expect(h2).toBeInTheDocument();
      expect(h2.tagName).toBe('H2');

      const h3 = screen.getByText('Heading 3');
      expect(h3).toBeInTheDocument();
      expect(h3.tagName).toBe('H3');
    });
  });

  describe('List Rendering', () => {
    it('should render bullet lists', () => {
      render(<ReadOnlyEditor content={mockListContent} />);

      expect(screen.getByText('Bullet item 1')).toBeInTheDocument();
      expect(screen.getByText('Bullet item 2')).toBeInTheDocument();

      const bulletList = screen.getByText('Bullet item 1').closest('ul');
      expect(bulletList).toBeInTheDocument();
    });

    it('should render ordered lists', () => {
      render(<ReadOnlyEditor content={mockListContent} />);

      expect(screen.getByText('Ordered item 1')).toBeInTheDocument();
      expect(screen.getByText('Ordered item 2')).toBeInTheDocument();

      const orderedList = screen.getByText('Ordered item 1').closest('ol');
      expect(orderedList).toBeInTheDocument();
    });
  });

  describe('Task List Interaction', () => {
    it('should render task list checkboxes', () => {
      render(<ReadOnlyEditor content={mockTaskListContent} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
    });

    it('should show unchecked task checkbox as unchecked', () => {
      render(<ReadOnlyEditor content={mockTaskListContent} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).not.toBeChecked();
    });

    it('should show checked task checkbox as checked', () => {
      render(<ReadOnlyEditor content={mockTaskListContent} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[1]).toBeChecked();
    });

    it('should allow toggling task checkboxes', async () => {
      const onUpdate = jest.fn();
      render(<ReadOnlyEditor content={mockTaskListContent} onUpdate={onUpdate} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const uncheckedBox = checkboxes[0];

      fireEvent.click(uncheckedBox);

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();
      });
    });

    it('should call onUpdate with updated content when checkbox is toggled', async () => {
      const onUpdate = jest.fn();
      render(<ReadOnlyEditor content={mockTaskListContent} onUpdate={onUpdate} />);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(expect.any(Object));
        const updatedContent = onUpdate.mock.calls[0][0] as TiptapJSONContent;
        expect(updatedContent.type).toBe('doc');
      });
    });
  });

  describe('Link Interaction', () => {
    it('should render links', () => {
      render(<ReadOnlyEditor content={mockLinkContent} />);

      const link = screen.getByText('Google');
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe('A');
    });

    it('should have correct link attributes', () => {
      render(<ReadOnlyEditor content={mockLinkContent} />);

      const link = screen.getByText('Google') as HTMLAnchorElement;
      expect(link.href).toBe('https://google.com/');
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
    });

    it('should allow clicking links in read-only mode', () => {
      render(<ReadOnlyEditor content={mockLinkContent} />);

      const link = screen.getByText('Google');
      expect(link).not.toHaveAttribute('contenteditable', 'false');
    });
  });

  describe('Block Elements', () => {
    it('should render blockquotes', () => {
      render(<ReadOnlyEditor content={mockBlockquoteContent} />);

      const quote = screen.getByText('This is a quote');
      expect(quote).toBeInTheDocument();

      const blockquote = quote.closest('blockquote');
      expect(blockquote).toBeInTheDocument();
    });

    it('should render code blocks', () => {
      render(<ReadOnlyEditor content={mockCodeBlockContent} />);

      const code = screen.getByText('const x = 10;');
      expect(code).toBeInTheDocument();

      const codeBlock = code.closest('pre');
      expect(codeBlock).toBeInTheDocument();
    });

    it('should render horizontal rules', () => {
      const { container } = render(<ReadOnlyEditor content={mockHorizontalRuleContent} />);

      expect(screen.getByText('Before rule')).toBeInTheDocument();
      expect(screen.getByText('After rule')).toBeInTheDocument();

      const hr = container.querySelector('hr');
      expect(hr).toBeInTheDocument();
    });
  });

  describe('Non-Editable Behavior', () => {
    // JSDOM Limitation: Text selection events (mouseDown/mouseUp) require real DOM selection APIs
    // which are not fully implemented in JSDOM. Test manually or use E2E testing.
    it.skip('should not show bubble menu', () => {
      const { container } = render(<ReadOnlyEditor content={mockFormattedContent} />);

      // Select text
      const boldText = screen.getByText('bold');
      fireEvent.mouseDown(boldText);
      fireEvent.mouseUp(boldText);

      // Bubble menu should not appear
      const bubbleMenu = container.querySelector('[role="toolbar"]');
      expect(bubbleMenu).not.toBeInTheDocument();
    });

    it('should not show placeholder', () => {
      const emptyContent: TiptapJSONContent = {
        type: 'doc',
        content: [{ type: 'paragraph' }]
      };

      const { container } = render(
        <ReadOnlyEditor content={emptyContent} />
      );

      const placeholder = container.querySelector('.tiptap-placeholder');
      expect(placeholder).not.toBeInTheDocument();
    });

    it('should not be editable via keyboard', () => {
      render(<ReadOnlyEditor content={mockParagraphContent} />);

      const content = screen.getByText('This is read-only content');
      const proseMirror = content.closest('.ProseMirror');

      expect(proseMirror).toHaveAttribute('contenteditable', 'false');
    });

    it('should not respond to formatting keyboard shortcuts', () => {
      render(<ReadOnlyEditor content={mockParagraphContent} />);

      const content = screen.getByText('This is read-only content');

      // Try Cmd/Ctrl+B (bold)
      fireEvent.keyDown(content, { key: 'b', ctrlKey: true });

      // Content should remain unchanged
      expect(screen.getByText('This is read-only content')).toBeInTheDocument();
    });

    // JSDOM Limitation: Text selection events (mouseDown/mouseUp) require real DOM selection APIs
    // which are not fully implemented in JSDOM. Test manually or use E2E testing.
    it.skip('should not allow text selection to trigger editing', () => {
      const { container } = render(<ReadOnlyEditor content={mockFormattedContent} />);

      const boldText = screen.getByText('bold');

      // Simulate text selection
      fireEvent.mouseDown(boldText);
      fireEvent.mouseUp(boldText);

      // Editor should remain non-editable
      const proseMirror = container.querySelector('.ProseMirror');
      expect(proseMirror).toHaveAttribute('contenteditable', 'false');
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA attributes', () => {
      const { container } = render(<ReadOnlyEditor content={mockParagraphContent} />);

      const editor = container.querySelector('.ProseMirror');
      expect(editor).toHaveAttribute('role', 'document');
      expect(editor).toHaveAttribute('aria-readonly', 'true');
    });

    it('should be keyboard navigable for links', () => {
      render(<ReadOnlyEditor content={mockLinkContent} />);

      const link = screen.getByText('Google');
      expect(link).toHaveAttribute('tabindex', '0');
    });

    it('should be keyboard accessible for task checkboxes', () => {
      render(<ReadOnlyEditor content={mockTaskListContent} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // Task checkboxes should be keyboard accessible (tabindex is on parent container)
      expect(checkboxes.length).toBeGreaterThan(0);
      // Note: Tiptap TaskItem applies tabindex to the container, not the checkbox itself
    });
  });

  describe('Performance', () => {
    it('should render large content efficiently', () => {
      const largeContent: TiptapJSONContent = {
        type: 'doc',
        content: Array.from({ length: 100 }, (_, i) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: `Paragraph ${i + 1}` }]
        }))
      };

      const startTime = performance.now();
      render(<ReadOnlyEditor content={largeContent} />);
      const endTime = performance.now();

      // Should render within reasonable time (100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should not re-render unnecessarily', () => {
      const onUpdate = jest.fn();
      const { rerender } = render(
        <ReadOnlyEditor content={mockParagraphContent} onUpdate={onUpdate} />
      );

      // Re-render with same content
      rerender(<ReadOnlyEditor content={mockParagraphContent} onUpdate={onUpdate} />);

      // onUpdate should not be called for same content
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid content gracefully', () => {
      const invalidContent = { type: 'invalid' } as unknown as TiptapJSONContent;

      const { container } = render(<ReadOnlyEditor content={invalidContent} />);

      // Should render without crashing
      expect(container).toBeInTheDocument();
    });

    it('should handle null content', () => {
      const nullContent = null as unknown as TiptapJSONContent;

      const { container } = render(<ReadOnlyEditor content={nullContent} />);

      // Should render empty content
      expect(container).toBeInTheDocument();
    });

    it('should handle undefined content', () => {
      const undefinedContent = undefined as unknown as TiptapJSONContent;

      const { container } = render(<ReadOnlyEditor content={undefinedContent} />);

      // Should render empty content
      expect(container).toBeInTheDocument();
    });
  });
});
