/**
 * TextEditor Component
 *
 * Tiptap v3-based text editor for inline editing of text cards.
 * Built on BaseEditor component with text-specific features:
 * - Rich text editing via Tiptap with StarterKit extensions
 * - Real-time character count with 10,000 character limit
 * - Auto-resize based on content with min/max constraints
 * - Backward compatibility with markdown content
 * - Tiptap JSON content format support
 *
 * Required Context Providers:
 * - None (self-contained component)
 *
 * @remarks This component has no external context dependencies and can be used standalone.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  KeyboardEvent
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  BaseEditor,
  type BaseEditorChildProps
} from './BaseEditor';
import type {
  TextCard,
  TextCardContent,
  TiptapJSONContent
} from '@/types/card.types';
import {
  TextContentFormat,
  isTextCardMarkdown,
  isTextCardTiptap
} from '@/types/card.types';
import { createContextLogger } from '@/utils/logger';

// Create logger at module level with component context
const logger = createContextLogger({ component: 'TextEditor' });

// Constants
const MAX_CHARACTERS = 10000;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 500;
const WARNING_THRESHOLD = 9000; // Show warning at 90% capacity

/**
 * Props for TextEditor component
 */
export interface TextEditorProps {
  /** Text card being edited */
  card: TextCard;
  /** Callback when content should be saved */
  onSave: (content: TextCardContent) => void | Promise<void>;
  /** Callback when editing is cancelled */
  onCancel: () => void;
  /** Whether to auto-focus the editor */
  autoFocus?: boolean;
  /** Additional class names */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Convert markdown string to Tiptap JSON format
 * Simple conversion - stores markdown as plain text in a paragraph
 * For backward compatibility with legacy markdown content
 */
const markdownToTiptap = (markdown: string): TiptapJSONContent => {
  if (!markdown || markdown.trim().length === 0) {
    return {
      type: 'doc',
      content: [{
        type: 'paragraph'
      }]
    };
  }

  return {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: markdown }]
    }]
  };
};

/**
 * Count words in text
 */
const countWords = (text: string): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

/**
 * TextEditor implementation
 */
export const TextEditor: React.FC<TextEditorProps> = ({
  card,
  onSave,
  onCancel,
  autoFocus = true,
  className = '',
  placeholder = 'Enter text...'
}) => {
  // Initialize content based on format
  const initialContent = useMemo((): TiptapJSONContent => {
    const cardContent = card.content;

    // Check if Tiptap format
    if (isTextCardTiptap(cardContent)) {
      logger.debug('Initializing with Tiptap content', {
        cardId: card.id,
        contentType: cardContent.content.type
      });
      return cardContent.content;
    }

    // Check if markdown format or legacy
    if (isTextCardMarkdown(cardContent)) {
      logger.debug('Initializing with markdown content (converting)', {
        cardId: card.id,
        contentLength: cardContent.content.length
      });
      return markdownToTiptap(cardContent.content);
    }

    // Fallback to empty document
    logger.warn('Initializing with empty content', {
      cardId: card.id,
      hasContent: !!cardContent.content
    });
    return markdownToTiptap('');
  }, [card.id, card.content]);

  // Initialize Tiptap editor
  const editor = useEditor({
    immediatelyRender: false, // Prevent SSR hydration mismatches in Next.js
    extensions: [
      StarterKit.configure({
        // Configure StarterKit extensions
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content: initialContent,
    autofocus: autoFocus ? 'end' : false,
    editable: true,
    onUpdate: ({ editor: updatedEditor }) => {
      const text = updatedEditor.getText();
      const charCount = text.length;

      // Enforce character limit
      if (charCount > MAX_CHARACTERS) {
        logger.warn('Character limit exceeded', {
          currentLength: charCount,
          limit: MAX_CHARACTERS,
          cardId: card.id
        });

        // Truncate content
        const truncatedText = text.slice(0, MAX_CHARACTERS);

        // Create new content with truncated text
        const truncatedContent: TiptapJSONContent = {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: truncatedText }]
          }]
        };

        updatedEditor.commands.setContent(truncatedContent);
      }
    },
    editorProps: {
      attributes: {
        class: 'w-full h-full p-3 outline-none focus:outline-none prose prose-sm max-w-none',
        style: `min-height: ${MIN_HEIGHT}px; max-height: ${MAX_HEIGHT}px; overflow-y: auto;`
      }
    }
  });

  // Character and word count from editor
  const characterCount = useMemo(() => {
    return editor?.getText().length || 0;
  }, [editor]);

  const wordCount = useMemo(() => {
    const text = editor?.getText() || '';
    return countWords(text);
  }, [editor]);

  // Log component mount
  useEffect(() => {
    logger.debug('TextEditor mounted', {
      cardId: card.id,
      format: card.content.format || 'legacy',
      hasContent: !!card.content.content,
      autoFocus
    });

    return (): void => {
      logger.debug('TextEditor unmounting', {
        cardId: card.id
      });
      editor?.destroy();
    };
  }, [card.id, card.content.format, card.content.content, autoFocus, editor]);

  /**
   * Prepare content for saving
   */
  const prepareContentForSave = useCallback((): TextCardContent => {
    if (!editor) {
      logger.error('Editor not initialized when saving', {
        cardId: card.id
      });
      return card.content;
    }

    // Get Tiptap JSON content
    const tiptapContent = editor.getJSON() as TiptapJSONContent;
    const text = editor.getText();

    logger.debug('Preparing content for save', {
      cardId: card.id,
      format: TextContentFormat.TIPTAP,
      characterCount: text.length,
      wordCount: countWords(text)
    });

    return {
      type: 'text',
      format: TextContentFormat.TIPTAP,
      content: tiptapContent,
      markdown: false, // Keep for backward compatibility, but format field takes precedence
      wordCount: countWords(text),
      lastEditedAt: Date.now().toString()
    };
  }, [editor, card.id, card.content]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
    if (!editor) return;

    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl) {
      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          const content = prepareContentForSave();
          onSave(content);
          break;
        case 'enter':
          e.preventDefault();
          const saveContent = prepareContentForSave();
          onSave(saveContent);
          break;
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [editor, prepareContentForSave, onSave, onCancel]);

  /**
   * Validate content
   */
  const validateContent = useCallback((): boolean | string => {
    if (!editor) {
      return 'Editor not initialized';
    }

    const text = editor.getText();

    if (!text || text.trim().length === 0) {
      logger.warn('Validation failed: empty content', {
        cardId: card.id
      });
      return 'Content cannot be empty';
    }

    if (text.length > MAX_CHARACTERS) {
      logger.warn('Validation failed: content too long', {
        cardId: card.id,
        contentLength: text.length,
        limit: MAX_CHARACTERS
      });
      return `Content exceeds ${MAX_CHARACTERS} character limit`;
    }

    return true;
  }, [editor, card.id]);

  /**
   * Character count color based on length
   */
  const getCharCountColor = useCallback((count: number): string => {
    if (count >= MAX_CHARACTERS) return 'text-red-500';
    if (count >= WARNING_THRESHOLD) return 'text-orange-500';
    return 'text-gray-500';
  }, []);

  // Don't render until editor is initialized
  if (!editor) {
    return (
      <div className={`relative w-full h-full flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-sm">Loading editor...</span>
      </div>
    );
  }

  return (
    <BaseEditor<TextCardContent>
      initialValue={card.content}
      onSave={onSave}
      onCancel={onCancel}
      autoFocus={false}
      className={className}
      showControls={false}
      validate={validateContent}
      saveOnBlur={true}
    >
      {({ handleCancel, validationError }: BaseEditorChildProps<TextCardContent>) => (
        <div
          className="relative w-full h-full flex flex-col"
          onKeyDown={handleKeyDown}
        >
          {/* Tiptap Editor */}
          <EditorContent
            editor={editor}
            className="w-full flex-1 overflow-auto"
          />

          {/* Character count */}
          <div className="flex items-center justify-between px-3 py-1 border-t border-gray-200">
            <span
              data-testid="character-count"
              className={`text-xs ${getCharCountColor(characterCount)}`}
              aria-live="polite"
              aria-atomic="true"
            >
              {characterCount} / {MAX_CHARACTERS}
            </span>
            {wordCount > 0 && (
              <span className="text-xs text-gray-500">
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
            )}
          </div>

          {/* Validation error */}
          {validationError && (
            <div className="absolute -bottom-6 left-0 text-xs text-red-500">
              {validationError}
            </div>
          )}

          {/* Save/Cancel controls */}
          <div className="flex justify-end gap-2 px-3 py-2 border-t border-gray-200">
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const content = prepareContentForSave();
                onSave(content);
              }}
              disabled={!!validationError || characterCount > MAX_CHARACTERS}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </BaseEditor>
  );
};

TextEditor.displayName = 'TextEditor';

export default TextEditor;