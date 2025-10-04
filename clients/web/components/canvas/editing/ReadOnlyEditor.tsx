/**
 * ReadOnlyEditor Component
 *
 * Lightweight read-only content renderer using Tiptap v3.
 * Displays Tiptap JSON content in non-editable mode with:
 * - No editing UI (bubble menu, placeholders, controls)
 * - Clickable links that open in new tabs
 * - Interactive task checkboxes for toggling completion state
 * - Full content formatting support (bold, italic, lists, headings, etc.)
 * - Optimized for fast rendering with minimal bundle size
 *
 * Required Context Providers:
 * - None (self-contained component)
 *
 * @remarks This component is designed for displaying content only.
 * For editing, use TextEditor component with mode switching.
 */

import React, { useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
import Link from '@tiptap/extension-link';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { common, createLowlight } from 'lowlight';
import type { TiptapJSONContent } from '@/types/card.types';
import { createContextLogger } from '@/utils/logger';

// Create logger at module level with component context
const logger = createContextLogger({ component: 'ReadOnlyEditor' });

// Create lowlight instance with common language support for syntax highlighting
const lowlight = createLowlight(common);

/**
 * Props for ReadOnlyEditor component
 */
export interface ReadOnlyEditorProps {
  /** Tiptap JSON content to render */
  content: TiptapJSONContent;
  /** Callback when content is updated (e.g., task checkbox toggled) */
  onUpdate?: (content: TiptapJSONContent) => void;
  /** Additional class names */
  className?: string;
}

/**
 * ReadOnlyEditor implementation
 */
export const ReadOnlyEditor: React.FC<ReadOnlyEditorProps> = ({
  content,
  onUpdate,
  className = ''
}) => {
  // Normalize content to handle null/undefined/invalid values
  const normalizedContent = useMemo((): TiptapJSONContent => {
    if (!content || typeof content !== 'object') {
      logger.warn('Invalid content provided, using empty document', { content });
      return {
        type: 'doc',
        content: [{ type: 'paragraph' }]
      };
    }

    if (content.type !== 'doc') {
      logger.warn('Content is not a valid Tiptap document, wrapping in doc', { content });
      return {
        type: 'doc',
        content: [{ type: 'paragraph' }]
      };
    }

    return content;
  }, [content]);

  // Initialize Tiptap editor in read-only mode
  const editor = useEditor({
    immediatelyRender: false, // Prevent SSR hydration mismatches in Next.js
    extensions: [
      StarterKit.configure({
        // Disable built-in formatting extensions (we configure them explicitly below)
        bold: false,
        italic: false,
        strike: false,
        code: false,
        // Disable built-in list extensions (we configure them explicitly below)
        bulletList: false,
        orderedList: false,
        listItem: false,
        // Disable built-in blockquote and code block (we configure them explicitly below)
        blockquote: false,
        codeBlock: false,
        // Enable and configure heading levels explicitly
        heading: {
          levels: [1, 2, 3],
          HTMLAttributes: {
            class: 'tiptap-heading'
          }
        }
      }),
      // Text formatting extensions
      Bold,
      Italic,
      Underline,
      Strike,
      Code,
      // Link extension with clickable links in read-only mode
      Link.configure({
        openOnClick: true, // Enable link clicking in read-only mode
        HTMLAttributes: {
          // Security attributes for external links
          target: '_blank',
          rel: 'noopener noreferrer',
          // Design system styling: primary blue color with underline
          class: 'text-primary-600 hover:text-primary-700 underline cursor-pointer transition-colors duration-150',
          // Accessibility
          tabindex: '0'
        }
      }),
      // List extensions
      BulletList.configure({
        HTMLAttributes: {
          class: 'tiptap-bullet-list'
        }
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'tiptap-ordered-list'
        }
      }),
      ListItem.configure({
        HTMLAttributes: {
          class: 'tiptap-list-item'
        }
      }),
      // Task list extensions with interactive checkboxes
      TaskList.configure({
        HTMLAttributes: {
          class: 'tiptap-task-list'
        }
      }),
      TaskItem.configure({
        HTMLAttributes: {
          class: 'tiptap-task-item',
          tabindex: '0'
        },
        nested: true,
        // Enable checkbox interaction in read-only mode
        onReadOnlyChecked: (node, checked) => {
          logger.debug('Task checkbox toggled in read-only mode', {
            checked,
            taskContent: node.textContent
          });
          return checked; // Allow checkbox state to be toggled
        }
      }),
      // Blockquote extension
      Blockquote.configure({
        HTMLAttributes: {
          class: 'tiptap-blockquote'
        }
      }),
      // Code block with syntax highlighting
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'tiptap-code-block'
        },
        languageClassPrefix: 'language-'
      }),
      // Horizontal rule extension
      HorizontalRule.configure({
        HTMLAttributes: {
          class: 'tiptap-horizontal-rule'
        }
      })
    ],
    content: normalizedContent,
    editable: false, // Non-editable mode
    autofocus: false, // Don't auto-focus in read-only mode
    onUpdate: ({ editor: updatedEditor }) => {
      // Call onUpdate callback with new content when task checkboxes are toggled
      if (onUpdate) {
        const updatedContent = updatedEditor.getJSON() as TiptapJSONContent;
        onUpdate(updatedContent);
      }
    },
    editorProps: {
      attributes: {
        class: 'w-full h-full p-3 outline-none prose prose-sm max-w-none tiptap-editor-custom-headings read-only-editor',
        role: 'document',
        'aria-readonly': 'true'
      }
    }
  });

  // Log component mount
  useEffect(() => {
    logger.debug('ReadOnlyEditor mounted', {
      hasContent: !!content,
      contentType: content?.type
    });

    return (): void => {
      logger.debug('ReadOnlyEditor unmounting');
      editor?.destroy();
    };
  }, [content, editor]);

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content) {
      const currentContent = editor.getJSON();
      // Only update if content has actually changed (avoid unnecessary re-renders)
      if (JSON.stringify(currentContent) !== JSON.stringify(normalizedContent)) {
        editor.commands.setContent(normalizedContent);
        logger.debug('ReadOnlyEditor content updated', {
          contentType: normalizedContent.type
        });
      }
    }
  }, [editor, content, normalizedContent]);

  // Don't render until editor is initialized
  if (!editor) {
    return (
      <div className={`relative w-full h-full flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-sm">Loading content...</span>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      <EditorContent
        editor={editor}
        className="w-full h-full overflow-auto"
      />
    </div>
  );
};

ReadOnlyEditor.displayName = 'ReadOnlyEditor';

export default ReadOnlyEditor;
