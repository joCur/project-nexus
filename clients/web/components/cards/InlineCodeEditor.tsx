/**
 * InlineCodeEditor - Code editing with syntax highlighting and language selection
 *
 * Features:
 * - Syntax highlighting for common languages
 * - Language selector dropdown
 * - Line number display
 * - Tab key handling for proper indentation
 * - Updates CodeCardContent.lineCount and language
 * - Immediate visual feedback (<100ms requirement)
 */

'use client';

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  KeyboardEvent,
  ChangeEvent
} from 'react';
import { cn } from '@/lib/utils';
import type { CodeCardContent } from '@/types/card.types';

interface InlineCodeEditorProps {
  /** Current code content */
  content: CodeCardContent;
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
  onChange: (content: CodeCardContent) => void;
  /** Called when editing is complete */
  onComplete: (content: CodeCardContent) => void;
  /** Called when editing is cancelled */
  onCancel: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Supported programming languages with extensions
 */
const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', extensions: ['.js', '.mjs'] },
  { value: 'typescript', label: 'TypeScript', extensions: ['.ts', '.tsx'] },
  { value: 'python', label: 'Python', extensions: ['.py', '.pyw'] },
  { value: 'html', label: 'HTML', extensions: ['.html', '.htm'] },
  { value: 'css', label: 'CSS', extensions: ['.css'] },
  { value: 'scss', label: 'SCSS', extensions: ['.scss'] },
  { value: 'json', label: 'JSON', extensions: ['.json'] },
  { value: 'xml', label: 'XML', extensions: ['.xml'] },
  { value: 'sql', label: 'SQL', extensions: ['.sql'] },
  { value: 'bash', label: 'Bash', extensions: ['.sh', '.bash'] },
  { value: 'dockerfile', label: 'Dockerfile', extensions: ['Dockerfile'] },
  { value: 'yaml', label: 'YAML', extensions: ['.yml', '.yaml'] },
  { value: 'markdown', label: 'Markdown', extensions: ['.md', '.markdown'] },
  { value: 'go', label: 'Go', extensions: ['.go'] },
  { value: 'rust', label: 'Rust', extensions: ['.rs'] },
  { value: 'java', label: 'Java', extensions: ['.java'] },
  { value: 'php', label: 'PHP', extensions: ['.php'] },
  { value: 'ruby', label: 'Ruby', extensions: ['.rb'] },
  { value: 'c', label: 'C', extensions: ['.c', '.h'] },
  { value: 'cpp', label: 'C++', extensions: ['.cpp', '.hpp', '.cxx'] },
  { value: 'csharp', label: 'C#', extensions: ['.cs'] },
  { value: 'text', label: 'Plain Text', extensions: ['.txt'] },
] as const;

/**
 * Calculate line count from code content
 */
const calculateLineCount = (code: string): number => {
  if (!code) return 1;
  return code.split('\n').length;
};

/**
 * Get language from filename extension
 */
const getLanguageFromFilename = (filename: string): string => {
  const ext = filename.toLowerCase();
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang.extensions.some(extension => ext.endsWith(extension))) {
      return lang.value;
    }
  }
  return 'text';
};

/**
 * InlineCodeEditor component
 */
export const InlineCodeEditor: React.FC<InlineCodeEditorProps> = ({
  content,
  dimensions,
  style,
  autoFocus = true,
  onChange,
  onComplete,
  onCancel,
  className,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localCode, setLocalCode] = useState(content.content);
  const [selectedLanguage, setSelectedLanguage] = useState(content.language);
  const [filename, setFilename] = useState(content.filename || '');

  // Calculate responsive font size
  const fontSize = useMemo(() => {
    const baseSize = 12; // Smaller base for code
    const scaleFactor = Math.min(dimensions.width / 400, dimensions.height / 300);
    return Math.max(10, Math.min(16, baseSize * scaleFactor));
  }, [dimensions.width, dimensions.height]);

  // Calculate padding
  const padding = useMemo(() => {
    return Math.max(8, Math.min(16, dimensions.width * 0.03));
  }, [dimensions.width]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(localCode.length, localCode.length);
    }
  }, [autoFocus, localCode.length]);

  // Update language when filename changes
  useEffect(() => {
    if (filename) {
      const detectedLanguage = getLanguageFromFilename(filename);
      if (detectedLanguage !== selectedLanguage) {
        setSelectedLanguage(detectedLanguage);
      }
    }
  }, [filename, selectedLanguage]);

  // Handle code changes with immediate feedback
  const handleCodeChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setLocalCode(newCode);

    // Immediate feedback (<100ms requirement)
    const lineCount = calculateLineCount(newCode);
    const updatedContent: CodeCardContent = {
      ...content,
      content: newCode,
      lineCount,
      filename: filename || undefined,
    };

    onChange(updatedContent);
  }, [content, filename, onChange]);

  // Handle language selection
  const handleLanguageChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setSelectedLanguage(newLanguage);

    const updatedContent: CodeCardContent = {
      ...content,
      content: localCode,
      language: newLanguage,
      lineCount: calculateLineCount(localCode),
      filename: filename || undefined,
    };

    onChange(updatedContent);
  }, [content, localCode, filename, onChange]);

  // Handle filename change
  const handleFilenameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newFilename = e.target.value;
    setFilename(newFilename);

    const updatedContent: CodeCardContent = {
      ...content,
      content: localCode,
      language: selectedLanguage,
      lineCount: calculateLineCount(localCode),
      filename: newFilename || undefined,
    };

    onChange(updatedContent);
  }, [content, localCode, selectedLanguage, onChange]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Complete editing on Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    // Complete editing on Ctrl/Cmd + Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const finalContent: CodeCardContent = {
        ...content,
        content: localCode,
        language: selectedLanguage,
        lineCount: calculateLineCount(localCode),
        filename: filename || undefined,
      };
      onComplete(finalContent);
      return;
    }

    // Handle Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        // Shift+Tab: Remove indentation
        const lines = localCode.split('\n');
        const startLine = localCode.substring(0, start).split('\n').length - 1;
        const endLine = localCode.substring(0, end).split('\n').length - 1;

        for (let i = startLine; i <= endLine; i++) {
          if (lines[i].startsWith('  ')) {
            lines[i] = lines[i].substring(2);
          } else if (lines[i].startsWith('\t')) {
            lines[i] = lines[i].substring(1);
          }
        }

        const newCode = lines.join('\n');
        setLocalCode(newCode);

        // Update cursor position
        setTimeout(() => {
          const newStart = Math.max(0, start - 2);
          textarea.setSelectionRange(newStart, newStart);
        }, 0);
      } else {
        // Tab: Add indentation
        const beforeCursor = localCode.substring(0, start);
        const afterCursor = localCode.substring(end);
        const newCode = beforeCursor + '  ' + afterCursor; // 2 spaces

        setLocalCode(newCode);

        // Update cursor position
        setTimeout(() => {
          textarea.setSelectionRange(start + 2, start + 2);
        }, 0);
      }
    }
  }, [content, localCode, selectedLanguage, filename, onComplete, onCancel]);

  // Handle blur
  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Check if blur is due to interacting with controls
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('[data-code-controls]')) {
      return; // Don't complete editing
    }

    const finalContent: CodeCardContent = {
      ...content,
      content: localCode,
      language: selectedLanguage,
      lineCount: calculateLineCount(localCode),
      filename: filename || undefined,
    };
    onComplete(finalContent);
  }, [content, localCode, selectedLanguage, filename, onComplete]);

  // Calculate editor height
  const headerHeight = 80; // Space for controls
  const editorHeight = dimensions.height - headerHeight;

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
      {/* Header Controls */}
      <div data-code-controls className="p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-600 font-medium">Code Editor</span>
          <span className="text-xs text-gray-500">
            {calculateLineCount(localCode)} lines
          </span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          {/* Language selector */}
          <label htmlFor="language-selector" className="sr-only">
            Programming language
          </label>
          <select
            id="language-selector"
            value={selectedLanguage}
            onChange={handleLanguageChange}
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
            aria-label="Programming language"
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          {/* Filename input */}
          <input
            type="text"
            value={filename}
            onChange={handleFilenameChange}
            placeholder="filename.ext"
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
          />
        </div>

        <div className="text-xs text-gray-400">
          Tab for indent, Shift+Tab to outdent, Ctrl+Enter to save, Esc to cancel
        </div>
      </div>

      {/* Code Editor */}
      <div className="relative" style={{ height: editorHeight }}>
        {/* Line numbers */}
        <div
          className="absolute left-0 top-0 w-12 bg-gray-100 border-r border-gray-200 text-right pr-2 font-mono text-gray-500 select-none overflow-hidden"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1.4,
            height: '100%',
          }}
        >
          {Array.from({ length: Math.max(calculateLineCount(localCode), 20) }, (_, i) => (
            <div key={i + 1} className="leading-relaxed">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code textarea */}
        <textarea
          ref={textareaRef}
          value={localCode}
          onChange={handleCodeChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={cn(
            'absolute left-12 top-0 w-full h-full resize-none border-none outline-none',
            'focus:ring-0 font-mono bg-transparent',
            'scrollbar-thin scrollbar-thumb-gray-300'
          )}
          style={{
            fontSize: `${fontSize}px`,
            padding: `${padding}px`,
            paddingLeft: `${padding + 8}px`, // Extra space after line numbers
            color: style.textColor,
            lineHeight: 1.4,
            width: `calc(100% - 48px)`, // Account for line numbers
          }}
          spellCheck={false}
          autoComplete="off"
          role="textbox"
          aria-label="Edit code content"
          aria-multiline="true"
        />
      </div>

      {/* Execution indicator */}
      {content.hasExecuted && (
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-green-600 bg-opacity-75 rounded text-xs text-white">
          ✓ Executed
        </div>
      )}
    </div>
  );
};