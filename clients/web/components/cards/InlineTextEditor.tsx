/**
 * InlineTextEditor - ContentEditable implementation for text card editing
 *
 * Features:
 * - Immediate visual feedback (<100ms requirement)
 * - Markdown toggle support
 * - Word count tracking
 * - Auto-resize based on content
 * - Enter/Shift+Enter handling for line breaks
 * - Updates TextCardContent.lastEditedAt on changes
 */

'use client';

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  KeyboardEvent,
  FormEvent
} from 'react';
import { cn } from '@/lib/utils';
import type { TextCardContent } from '@/types/card.types';

interface InlineTextEditorProps {
  /** Current text content */
  content: TextCardContent;
  /** Card dimensions for sizing */
  dimensions: { width: number; height: number };
  /** Style configuration */
  style: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    borderWidth: number;
    borderRadius: number;
  };
  /** Auto-focus when editor mounts */
  autoFocus?: boolean;
  /** Called when content changes (immediate feedback) */
  onChange: (content: TextCardContent) => void;
  /** Called when editing is complete */
  onComplete: (content: TextCardContent) => void;
  /** Called when editing is cancelled */
  onCancel: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Calculates word count from text content
 */
const calculateWordCount = (text: string): number => {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
};

/**
 * InlineTextEditor component with <100ms feedback requirement
 */
export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  content,
  dimensions,
  style,
  autoFocus = true,
  onChange,
  onComplete,
  onCancel,
  className,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [localContent, setLocalContent] = useState(content.content);
  const [isMarkdown, setIsMarkdown] = useState(content.markdown);

  // Calculate responsive font size based on card dimensions
  const fontSize = useMemo(() => {
    const baseSize = 14;
    const scaleFactor = Math.min(dimensions.width / 300, dimensions.height / 200);
    return Math.max(12, Math.min(18, baseSize * scaleFactor));
  }, [dimensions.width, dimensions.height]);

  // Calculate padding based on card size
  const padding = useMemo(() => {
    return Math.max(12, Math.min(20, dimensions.width * 0.04));
  }, [dimensions.width]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();

      // Place cursor at end of content
      const range = document.createRange();
      const selection = window.getSelection();
      if (selection && editorRef.current.childNodes.length > 0) {
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [autoFocus]);

  // Handle content changes with immediate feedback (<100ms requirement)
  const handleInput = useCallback((e: FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.textContent || '';
    setLocalContent(newText);

    // Immediate local state update for <100ms feedback
    const wordCount = calculateWordCount(newText);
    const updatedContent: TextCardContent = {
      ...content,
      content: newText,
      wordCount,
      lastEditedAt: new Date().toISOString(),
    };

    // Call onChange for immediate visual feedback
    onChange(updatedContent);
  }, [content, onChange]);

  // Handle markdown toggle
  const handleMarkdownToggle = useCallback(() => {
    const newMarkdown = !isMarkdown;
    setIsMarkdown(newMarkdown);

    const updatedContent: TextCardContent = {
      ...content,
      content: localContent,
      markdown: newMarkdown,
      wordCount: calculateWordCount(localContent),
      lastEditedAt: new Date().toISOString(),
    };

    onChange(updatedContent);
  }, [isMarkdown, content, localContent, onChange]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    // Complete editing on Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    // Complete editing on Ctrl/Cmd + Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const finalContent: TextCardContent = {
        ...content,
        content: localContent,
        markdown: isMarkdown,
        wordCount: calculateWordCount(localContent),
        lastEditedAt: new Date().toISOString(),
      };
      onComplete(finalContent);
      return;
    }

    // Handle Enter vs Shift+Enter for line breaks
    if (e.key === 'Enter' && !e.shiftKey) {
      // Allow regular Enter for line breaks in text editor
      // This is different from other editors where Enter might complete editing
    }
  }, [content, localContent, isMarkdown, onComplete, onCancel]);

  // Handle blur (click outside)
  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    // Check if the blur is due to clicking the markdown toggle
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('[data-markdown-toggle]')) {
      return; // Don't complete editing, user is just toggling markdown
    }

    // Complete editing with current content
    const finalContent: TextCardContent = {
      ...content,
      content: localContent,
      markdown: isMarkdown,
      wordCount: calculateWordCount(localContent),
      lastEditedAt: new Date().toISOString(),
    };
    onComplete(finalContent);
  }, [content, localContent, isMarkdown, onComplete]);

  // Calculate dynamic height based on content
  const minHeight = Math.max(60, dimensions.height * 0.4);
  const maxHeight = dimensions.height - 40; // Leave space for controls

  return (
    <div
      className={cn(
        'absolute inset-0 bg-card-background border-2 border-primary-500',
        'shadow-lg rounded-lg overflow-hidden z-50',
        className
      )}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: style.backgroundColor,
        borderRadius: `${style.borderRadius}px`,
      }}
    >
      {/* Editing Controls */}
      <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-medium">
            Text Editor
          </span>
          <span className="text-xs text-gray-500">
            {calculateWordCount(localContent)} words
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Markdown toggle */}
          <button
            data-markdown-toggle
            type="button"
            onClick={handleMarkdownToggle}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              isMarkdown
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
            )}
            title="Toggle Markdown support"
          >
            MD
          </button>

          {/* Keyboard shortcuts hint */}
          <span className="text-xs text-gray-400">
            Ctrl+Enter to save, Esc to cancel
          </span>
        </div>
      </div>

      {/* Content Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          'w-full h-full resize-none border-none outline-none',
          'focus:ring-0 overflow-auto scrollbar-thin scrollbar-thumb-gray-300',
          isMarkdown ? 'font-mono' : 'font-sans'
        )}
        style={{
          fontSize: `${fontSize}px`,
          padding: `${padding}px`,
          color: style.textColor,
          lineHeight: 1.5,
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        dangerouslySetInnerHTML={{ __html: localContent }}
        role="textbox"
        aria-label="Edit card text content"
        aria-multiline="true"
      />

      {/* Status indicator */}
      {content.lastEditedAt && (
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-gray-800 bg-opacity-75 rounded text-xs text-white">
          Last edited: {new Date(content.lastEditedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};