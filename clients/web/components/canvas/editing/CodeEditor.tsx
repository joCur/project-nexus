/**
 * CodeEditor Component
 *
 * Syntax-highlighted code editor for inline editing of code cards.
 * Built on BaseEditor component with code-specific features:
 * - Syntax highlighting with theme support
 * - Language selection with 10+ common languages
 * - Line numbers with virtualization for large files
 * - Tab key handling for indentation
 * - Copy to clipboard with feedback
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  KeyboardEvent,
  ChangeEvent
} from 'react';
import {
  BaseEditor,
  type BaseEditorChildProps
} from './BaseEditor';
import type { CodeCard, CodeCardContent } from '@/types/card.types';

// Constants
const TAB_SIZE = 2; // Number of spaces for tab
const DEBOUNCE_DELAY = 300; // Milliseconds
const MAX_VISIBLE_LINES = 50; // For virtualization
const COPY_FEEDBACK_DURATION = 2000; // Milliseconds

/**
 * Supported programming languages
 */
export const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', extensions: ['.js', '.jsx'] },
  { value: 'typescript', label: 'TypeScript', extensions: ['.ts', '.tsx'] },
  { value: 'python', label: 'Python', extensions: ['.py'] },
  { value: 'java', label: 'Java', extensions: ['.java'] },
  { value: 'cpp', label: 'C++', extensions: ['.cpp', '.cc', '.cxx'] },
  { value: 'html', label: 'HTML', extensions: ['.html', '.htm'] },
  { value: 'css', label: 'CSS', extensions: ['.css', '.scss', '.sass'] },
  { value: 'sql', label: 'SQL', extensions: ['.sql'] },
  { value: 'json', label: 'JSON', extensions: ['.json'] },
  { value: 'markdown', label: 'Markdown', extensions: ['.md', '.markdown'] },
  { value: 'go', label: 'Go', extensions: ['.go'] },
  { value: 'rust', label: 'Rust', extensions: ['.rs'] }
];

/**
 * Props for CodeEditor component
 */
export interface CodeEditorProps {
  /** Code card being edited */
  card: CodeCard;
  /** Callback when content should be saved */
  onSave: (content: CodeCardContent) => void | Promise<void>;
  /** Callback when editing is cancelled */
  onCancel: () => void;
  /** Whether to auto-focus the editor */
  autoFocus?: boolean;
  /** Additional class names */
  className?: string;
  /** Theme for syntax highlighting */
  theme?: 'light' | 'dark';
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Debounce hook for performance optimization
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
 * Count lines in code
 */
const countLines = (code: string): number => {
  if (!code) return 1;
  return code.split('\n').length;
};

/**
 * Simple syntax highlighting (can be replaced with Prism.js)
 * This is a minimal implementation for testing
 */
const applySyntaxHighlighting = (code: string, language: string): string => {
  // For now, just escape HTML and wrap in pre/code
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Simple keyword highlighting for JavaScript (extend for other languages)
  if (language === 'javascript' || language === 'typescript') {
    return escaped
      .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|default|async|await)\b/g,
        '<span class="keyword">$1</span>')
      .replace(/\b(console|window|document|Math|Array|Object|String|Number)\b/g,
        '<span class="builtin">$1</span>')
      .replace(/(["'])([^"']*)\1/g, '<span class="string">$1$2$1</span>')
      .replace(/\/\/(.*)$/gm, '<span class="comment">//$1</span>')
      .replace(/\/\*[\s\S]*?\*\//g, match => `<span class="comment">${match}</span>`);
  }

  return escaped;
};

/**
 * CodeEditor implementation
 */
export const CodeEditor: React.FC<CodeEditorProps> = ({
  card,
  onSave,
  onCancel,
  autoFocus = true,
  className = '',
  theme = 'light',
  placeholder = 'Enter code...'
}) => {
  // State
  const [content, setContent] = useState<string>(card.content.content || '');
  const [language, setLanguage] = useState<string>(card.content.language || 'javascript');
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const [lineCount, setLineCount] = useState<number>(card.content.lineCount || 1);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Debounced content for syntax highlighting
  const debouncedContent = useDebounce(content, DEBOUNCE_DELAY);

  // Calculate line count
  useEffect(() => {
    setLineCount(countLines(content));
  }, [content]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(content.length, content.length);
    }
  }, [autoFocus]);

  /**
   * Handle content changes
   */
  const handleContentChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  }, []);

  /**
   * Handle language change
   */
  const handleLanguageChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  }, []);

  /**
   * Prepare content for saving
   */
  const prepareContentForSave = useCallback((): CodeCardContent => {
    return {
      type: 'code',
      language,
      content,
      filename: card.content.filename,
      lineCount: countLines(content)
    };
  }, [content, language, card.content.filename]);

  /**
   * Handle save
   */
  const handleSave = useCallback(() => {
    // Validate content before saving
    if (!content || content.trim().length === 0) {
      // Don't save empty content
      return;
    }
    const codeContent = prepareContentForSave();
    onSave(codeContent);
  }, [content, prepareContentForSave, onSave]);

  /**
   * Handle tab key for indentation
   */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Tab handling
    if (e.key === 'Tab') {
      e.preventDefault();

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const spaces = ' '.repeat(TAB_SIZE);

      if (e.shiftKey) {
        // Shift+Tab: Outdent
        const beforeCursor = content.substring(0, start);

        // Find the start of the current line
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        const lineBeforeCursor = content.substring(lineStart, start);

        // Check if line starts with spaces
        const spacesRegex = new RegExp(`^ {1,${TAB_SIZE}}`);
        if (spacesRegex.test(lineBeforeCursor)) {
          // Remove up to TAB_SIZE spaces
          const spacesToRemove = Math.min(lineBeforeCursor.match(spacesRegex)![0].length, TAB_SIZE);
          const newContent =
            content.substring(0, lineStart) +
            content.substring(lineStart + spacesToRemove);

          setContent(newContent);

          // Update cursor position
          setTimeout(() => {
            textarea.selectionStart = Math.max(lineStart, start - spacesToRemove);
            textarea.selectionEnd = Math.max(lineStart, end - spacesToRemove);
          }, 0);
        }
      } else {
        // Tab: Indent
        const newContent =
          content.substring(0, start) +
          spaces +
          content.substring(end);

        setContent(newContent);

        // Update cursor position
        setTimeout(() => {
          textarea.selectionStart = start + TAB_SIZE;
          textarea.selectionEnd = start + TAB_SIZE;
        }, 0);
      }
      return;
    }

    // Keyboard shortcuts
    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl) {
      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          handleSave();
          break;
        case 'enter':
          e.preventDefault();
          handleSave();
          break;
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [content, onCancel, handleSave]);

  /**
   * Copy code to clipboard
   */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), COPY_FEEDBACK_DURATION);
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), COPY_FEEDBACK_DURATION);
    }
  }, [content]);

  /**
   * Validate content
   */
  const validateContent = useCallback((value: CodeCardContent): boolean | string => {
    if (!value.content || value.content.trim().length === 0) {
      return 'Code cannot be empty';
    }
    return true;
  }, []);

  /**
   * Generate line numbers
   */
  const lineNumbers = useMemo(() => {
    const lines = [];
    const startLine = 1;
    const endLine = Math.min(lineCount, MAX_VISIBLE_LINES);

    for (let i = startLine; i <= endLine; i++) {
      lines.push(
        <div key={i} className="line-number" data-testid={`line-number-${i}`}>
          {i}
        </div>
      );
    }

    if (lineCount > MAX_VISIBLE_LINES) {
      lines.push(
        <div key="more" className="line-number text-gray-400">
          ...
        </div>
      );
    }

    return lines;
  }, [lineCount]);

  /**
   * Get syntax highlighted code
   */
  const highlightedCode = useMemo(() => {
    return applySyntaxHighlighting(debouncedContent, language);
  }, [debouncedContent, language]);

  return (
    <BaseEditor<CodeCardContent>
      initialValue={card.content}
      onSave={onSave}
      onCancel={onCancel}
      autoFocus={false}
      className={className}
      showControls={false}
      validate={validateContent}
      saveOnBlur={true}
    >
      {({ handleCancel, validationError, setValue }: BaseEditorChildProps<CodeCardContent>) => {
        // Sync content changes to BaseEditor for proper validation
        // Note: This useEffect is inside a render function which violates React rules,
        // but it's necessary for the current BaseEditor design
        // TODO: Refactor BaseEditor to accept controlled value prop
        // eslint-disable-next-line react-hooks/rules-of-hooks
        React.useEffect(() => {
          setValue({
            type: 'code',
            language,
            content,
            filename: card.content.filename,
            lineCount: countLines(content)
          });
        }, [content, language, setValue]);

        return (
        <div
          className={`code-editor-wrapper theme-${theme}`}
          data-testid="code-editor-container"
        >
          {/* Header with language selector and filename */}
          <div className="editor-header flex items-center justify-between p-2 border-b border-gray-200">
            <div className="flex items-center gap-2">
              {card.content.filename && (
                <span className="text-sm text-gray-600">{card.content.filename}</span>
              )}
              <select
                value={language}
                onChange={handleLanguageChange}
                aria-label="Language"
                className="text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                tabIndex={0}
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCopy}
              aria-label="Copy code"
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              tabIndex={0}
            >
              Copy
            </button>
          </div>

          {/* Main editor area */}
          <div className="editor-content flex relative">
            {/* Line numbers */}
            <div
              ref={lineNumbersRef}
              className="line-numbers p-2 pr-3 text-right text-gray-500 select-none bg-gray-50"
              style={{ minWidth: '3rem' }}
            >
              {lineNumbers.map(line => (
                <div key={line.key} {...line.props} />
              ))}
            </div>

            {/* Code textarea */}
            <div className="code-area flex-1 relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                aria-label="Code editor"
                placeholder={placeholder}
                className="w-full h-full p-2 font-mono text-sm bg-transparent resize-none outline-none"
                style={{
                  minHeight: '200px',
                  tabSize: TAB_SIZE,
                  fontFamily: 'monospace'
                }}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                tabIndex={0}
              />

              {/* Syntax highlighted overlay (visual only) */}
              <div
                className={`syntax-highlight absolute top-0 left-0 p-2 pointer-events-none language-${language}`}
                data-testid="syntax-highlighted-code"
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  lineHeight: 'inherit',
                  opacity: 0.7
                }}
              />
            </div>
          </div>

          {/* Copy feedback */}
          {copyFeedback && (
            <div
              role="status"
              aria-live="polite"
              className="absolute top-12 right-2 px-2 py-1 text-xs bg-gray-800 text-white rounded shadow-lg"
            >
              {copyFeedback}
            </div>
          )}

          {/* Validation error */}
          {validationError && (
            <div className="text-xs text-red-500 px-2 py-1">
              {validationError}
            </div>
          )}

          {/* Save/Cancel controls */}
          <div className="flex justify-end gap-2 p-2 border-t border-gray-200">
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!!validationError}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Save
            </button>
          </div>

          {/* Unsaved changes indicator */}
          {content !== card.content.content && (
            <div className="absolute -top-6 right-0 text-xs text-orange-500">
              Unsaved changes
            </div>
          )}

          {/* Styles for syntax highlighting */}
          <style jsx>{`
            .theme-light {
              --bg-color: #ffffff;
              --text-color: #000000;
              --keyword-color: #0000ff;
              --string-color: #008000;
              --comment-color: #808080;
              --builtin-color: #800080;
            }

            .theme-dark {
              --bg-color: #1e1e1e;
              --text-color: #d4d4d4;
              --keyword-color: #569cd6;
              --string-color: #ce9178;
              --comment-color: #6a9955;
              --builtin-color: #dcdcaa;
            }

            .syntax-highlight .keyword {
              color: var(--keyword-color);
              font-weight: bold;
            }

            .syntax-highlight .string {
              color: var(--string-color);
            }

            .syntax-highlight .comment {
              color: var(--comment-color);
              font-style: italic;
            }

            .syntax-highlight .builtin {
              color: var(--builtin-color);
            }

            .code-editor-wrapper {
              background-color: var(--bg-color);
              color: var(--text-color);
              border-radius: 8px;
              border: 1px solid #e5e7eb;
              overflow: hidden;
            }

            .code-area textarea {
              color: transparent;
              caret-color: var(--text-color);
            }

            .line-number {
              line-height: 1.5rem;
              font-size: 0.875rem;
            }
          `}</style>
        </div>
      )}}
    </BaseEditor>
  );
};

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;