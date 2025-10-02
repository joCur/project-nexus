/**
 * TextEditor Component
 *
 * ContentEditable-based text editor for inline editing of text cards.
 * Built on BaseEditor component with text-specific features:
 * - Markdown formatting support (bold, italic, links)
 * - Real-time character count with 10,000 character limit
 * - Auto-resize based on content with min/max constraints
 * - Plain text paste handling
 *
 * Required Context Providers:
 * - None (self-contained component)
 *
 * @remarks This component has no external context dependencies and can be used standalone.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  KeyboardEvent,
  ClipboardEvent
} from 'react';
import {
  BaseEditor,
  type BaseEditorChildProps
} from './BaseEditor';
import type { TextCard, TextCardContent } from '@/types/card.types';
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
 * Utility to convert HTML to markdown
 */
const htmlToMarkdown = (html: string): string => {
  // Simple conversion for basic formatting
  return html
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<a href="(.*?)".*?>(.*?)<\/a>/g, '[$2]($1)')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/p><p>/g, '\n\n')
    .replace(/<\/?p>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};

/**
 * Utility to convert markdown to HTML for display
 */
const markdownToHtml = (markdown: string): string => {
  if (!markdown) return '';

  // Convert markdown syntax to HTML
  return markdown
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, '<br>')
    .replace(/  /g, '&nbsp;&nbsp;');
};

/**
 * Count words in text
 */
const countWords = (text: string): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

/**
 * Debounce hook
 */
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
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
  // Content state
  const [content, setContent] = useState<string>(card.content.content || '');
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const hasInitializedRef = useRef<boolean>(false);

  // Debounced content for character count
  const debouncedContent = useDebounce(content, 300);
  const characterCount = debouncedContent.length;
  const wordCount = useMemo(() => countWords(debouncedContent), [debouncedContent]);

  // Log component mount
  useEffect(() => {
    logger.debug('TextEditor mounted', {
      cardId: card.id,
      hasMarkdown: card.content.markdown,
      contentLength: card.content.content?.length || 0,
      autoFocus
    });

    return (): void => {
      logger.debug('TextEditor unmounting', {
        cardId: card.id
      });
    };
  }, [card.id, card.content.markdown, card.content.content, autoFocus]);

  // Initialize content display only once on mount
  useEffect(() => {
    if (editorRef.current && !hasInitializedRef.current) {
      if (card.content.markdown) {
        // For markdown cards, convert markdown to HTML and set innerHTML
        editorRef.current.innerHTML = markdownToHtml(card.content.content || '');
        logger.debug('Initialized markdown content', {
          cardId: card.id,
          contentLength: card.content.content?.length || 0
        });
      } else {
        // For plain text cards, use textContent (safer, no HTML injection)
        editorRef.current.textContent = card.content.content || '';
        logger.debug('Initialized plain text content', {
          cardId: card.id,
          contentLength: card.content.content?.length || 0
        });
      }
      hasInitializedRef.current = true;
    }
  }, [card.id, card.content.markdown, card.content.content]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();

      // Place cursor at end
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [autoFocus]);

  // Auto-resize based on content
  useEffect(() => {
    if (!editorRef.current) return;

    const adjustHeight = () => {
      const editor = editorRef.current;
      if (!editor) return;

      // Reset height to auto to get natural height
      editor.style.height = 'auto';

      // Set height based on scrollHeight, respecting min/max
      const newHeight = Math.min(Math.max(editor.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
      editor.style.height = `${newHeight}px`;

      // Show scrollbar if content exceeds max height
      if (editor.scrollHeight > MAX_HEIGHT) {
        editor.style.overflowY = 'auto';
      } else {
        editor.style.overflowY = 'hidden';
      }
    };

    adjustHeight();
  }, [content]);

  /**
   * Handle content changes
   */
  const handleInput = useCallback((): void => {
    if (!editorRef.current) return;

    // Convert to plain text for character counting
    const plainText = editorRef.current.textContent || '';

    logger.debug('Content changed', {
      cardId: card.id,
      newLength: plainText.length,
      wordCount: countWords(plainText)
    });

    // Enforce character limit
    if (plainText.length > MAX_CHARACTERS) {
      logger.warn('Character limit exceeded', {
        currentLength: plainText.length,
        limit: MAX_CHARACTERS,
        cardId: card.id
      });

      // Truncate content
      const truncated = plainText.slice(0, MAX_CHARACTERS);
      editorRef.current.textContent = truncated;

      // Place cursor at end
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    setContent(plainText);
  }, [card.id]);

  /**
   * Handle paste events - convert to plain text
   */
  const handlePaste = useCallback((e: ClipboardEvent<HTMLDivElement>): void => {
    e.preventDefault();

    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    logger.debug('Paste event', {
      cardId: card.id,
      pasteLength: text.length,
      hasNewlines: text.includes('\n')
    });

    // Get current content length
    const currentLength = editorRef.current?.textContent?.length || 0;

    // Calculate how much we can paste
    const availableSpace = MAX_CHARACTERS - currentLength;
    const textToPaste = text.slice(0, availableSpace);

    // Convert newlines to <br> tags for display
    const htmlText = textToPaste.replace(/\n/g, '<br>');

    // Insert at cursor position
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const fragment = document.createRange().createContextualFragment(htmlText);
    range.insertNode(fragment);

    // Move cursor to end of inserted content
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    handleInput();
  }, [card.id, handleInput]);

  /**
   * Prepare content for saving
   */
  const prepareContentForSave = useCallback((): TextCardContent => {
    const plainText = editorRef.current?.textContent || '';
    const html = editorRef.current?.innerHTML || '';

    // Convert HTML to markdown if needed
    const markdownContent = card.content.markdown ? htmlToMarkdown(html) : plainText;

    return {
      type: 'text',
      content: markdownContent,
      markdown: card.content.markdown,
      wordCount: countWords(plainText),
      lastEditedAt: Date.now().toString()
    };
  }, [card.content.markdown]);

  /**
   * Apply formatting to selected text
   */
  const applyFormat = useCallback((formatType: 'bold' | 'italic'): void => {
    if (!editorRef.current) return;

    logger.debug('Applying format', {
      cardId: card.id,
      formatType
    });

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    // If no text is selected, select all text
    if (!selectedText && editorRef.current.textContent) {
      range.selectNodeContents(editorRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const finalSelectedText = range.toString();
    if (!finalSelectedText) return;

    // Create formatted element
    let formattedElement: HTMLElement;
    if (formatType === 'bold') {
      formattedElement = document.createElement('strong');
    } else if (formatType === 'italic') {
      formattedElement = document.createElement('em');
    } else {
      return;
    }

    formattedElement.textContent = finalSelectedText;

    // Replace selection with formatted element
    range.deleteContents();
    range.insertNode(formattedElement);

    // Update selection to be after the inserted element
    range.setStartAfter(formattedElement);
    range.setEndAfter(formattedElement);
    selection.removeAllRanges();
    selection.addRange(range);

    handleInput();
  }, [card.id, handleInput]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          applyFormat('bold');
          break;
        case 'i':
          e.preventDefault();
          applyFormat('italic');
          break;
        case 'k':
          e.preventDefault();
          const selection = window.getSelection();
          if (selection && selection.toString()) {
            setSelectedText(selection.toString());
            setIsLinkDialogOpen(true);
          }
          break;
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
  }, [applyFormat, prepareContentForSave, onSave, onCancel]);

  /**
   * Insert link with URL
   */
  const insertLink = useCallback((url: string): void => {
    if (!url) return;

    logger.debug('Inserting link', {
      cardId: card.id,
      url,
      selectedTextLength: selectedText.length
    });

    // Restore selection and create link
    const selection = window.getSelection();
    if (selection && selectedText) {
      // Create link element
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = selectedText;

      // Insert link at current position
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(link);

      // Clear selection
      selection.removeAllRanges();
    }

    setIsLinkDialogOpen(false);
    setSelectedText('');
    handleInput();
  }, [card.id, selectedText, handleInput]);

  /**
   * Validate content
   */
  const validateContent = useCallback((value: TextCardContent): boolean | string => {
    const content = value.content || '';
    if (!content || content.trim().length === 0) {
      logger.warn('Validation failed: empty content', {
        cardId: card.id
      });
      return 'Content cannot be empty';
    }
    if (content.length > MAX_CHARACTERS) {
      logger.warn('Validation failed: content too long', {
        cardId: card.id,
        contentLength: content.length,
        limit: MAX_CHARACTERS
      });
      return `Content exceeds ${MAX_CHARACTERS} character limit`;
    }
    return true;
  }, [card.id]);

  /**
   * Character count color based on length
   */
  const getCharCountColor = useCallback((count: number): string => {
    if (count >= MAX_CHARACTERS) return 'text-red-500';
    if (count >= WARNING_THRESHOLD) return 'text-orange-500';
    return 'text-gray-500';
  }, []);

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
        <div className="relative w-full h-full flex flex-col">
          {/* Editor */}
          <div
            ref={editorRef}
            role="textbox"
            contentEditable
            aria-label="Text editor"
            aria-multiline="true"
            aria-placeholder={placeholder}
            className="w-full flex-1 p-3 outline-none resize-none overflow-auto"
            style={{
              minHeight: MIN_HEIGHT,
              maxHeight: MAX_HEIGHT,
              height: `${MIN_HEIGHT}px`
            }}
            onInput={handleInput}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            data-placeholder={placeholder}
            suppressContentEditableWarning
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

          {/* Link dialog */}
          {isLinkDialogOpen && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50">
              <div className="mb-2 text-sm font-medium">Add Link</div>
              <input
                ref={linkInputRef}
                type="url"
                placeholder="Enter URL"
                className="w-full px-2 py-1 border border-gray-300 rounded"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    insertLink(e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    setIsLinkDialogOpen(false);
                    setSelectedText('');
                  }
                }}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    setIsLinkDialogOpen(false);
                    setSelectedText('');
                  }}
                  className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    insertLink(linkInputRef.current?.value || '');
                  }}
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add
                </button>
              </div>
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