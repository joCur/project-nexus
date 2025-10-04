/**
 * BubbleMenu Component
 *
 * Notion-like contextual formatting menu for the Tiptap text editor.
 * Appears when text is selected and provides quick access to formatting options.
 *
 * Features:
 * - Formatting buttons: Bold, Italic, Underline, Strikethrough, Code
 * - Heading dropdown: H1, H2, H3 transformations
 * - List buttons: Bullet List, Ordered List, Task List
 * - Active state indication for applied formats
 * - Keyboard shortcut tooltips
 * - Design system compliant styling
 * - Full accessibility support with ARIA attributes
 * - Auto-positioning near selected text using Tiptap's BubbleMenu
 *
 * Related Documentation: "Tiptap Text Editor Implementation" in Notion
 */

import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { BubbleMenu as TiptapBubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { createContextLogger } from '@/utils/logger';

// Create logger at module level with component context
const logger = createContextLogger({ component: 'BubbleMenu' });

/**
 * Props for BubbleMenu component
 */
export interface BubbleMenuProps {
  /** Tiptap editor instance */
  editor: Editor;
  /** Callback to open link editor popup */
  onOpenLinkEditor?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Formatting button configuration
 */
interface FormatButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  command: () => boolean;
  isActive: () => boolean;
  shortcut: string;
  ariaLabel: string;
}

/**
 * Heading option configuration
 */
interface HeadingOption {
  id: string;
  label: string;
  level: 1 | 2 | 3 | null;
  command: () => boolean;
  shortcut: string;
}

/**
 * BubbleMenu Component
 *
 * Contextual formatting toolbar that appears when text is selected.
 * Provides quick access to text formatting options with visual feedback.
 * Uses Tiptap's BubbleMenu component for automatic positioning near selection.
 */
export const BubbleMenu: React.FC<BubbleMenuProps> = ({ editor, onOpenLinkEditor, className }) => {
  // Heading dropdown state
  const [isHeadingDropdownOpen, setIsHeadingDropdownOpen] = useState(false);
  const headingButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Force re-render when editor state changes to update active button states
  const [, forceUpdate] = useState({});

  /**
   * Subscribe to editor updates to refresh active states
   */
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      // Force component re-render to update isActive states
      forceUpdate({});
    };

    // Listen to selection and transaction updates
    editor.on('selectionUpdate', handleUpdate);
    editor.on('transaction', handleUpdate);

    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('transaction', handleUpdate);
    };
  }, [editor]);

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    if (!isHeadingDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking on the button or dropdown
      if (
        headingButtonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }

      // Close if clicking outside both
      setIsHeadingDropdownOpen(false);
    };

    // Delay adding the listener to avoid immediate triggering
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isHeadingDropdownOpen]);

  /**
   * Get keyboard shortcut display text based on platform
   */
  const getShortcutText = useCallback((shortcut: string): string => {
    const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    return shortcut.replace('Mod', isMac ? 'Cmd' : 'Ctrl');
  }, []);

  /**
   * Get current heading level or null if not a heading
   */
  const getCurrentHeadingLevel = useCallback((): 1 | 2 | 3 | null => {
    if (editor.isActive('heading', { level: 1 })) return 1;
    if (editor.isActive('heading', { level: 2 })) return 2;
    if (editor.isActive('heading', { level: 3 })) return 3;
    return null;
  }, [editor]);

  /**
   * Get heading label for display
   */
  const getCurrentHeadingLabel = useCallback((): string => {
    const level = getCurrentHeadingLevel();
    if (level === 1) return 'H1';
    if (level === 2) return 'H2';
    if (level === 3) return 'H3';
    return 'Heading';
  }, [getCurrentHeadingLevel]);

  /**
   * Toggle heading dropdown
   */
  const toggleHeadingDropdown = useCallback((e?: React.MouseEvent): void => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsHeadingDropdownOpen((prev) => {
      logger.debug('Heading dropdown toggled', { from: prev, to: !prev });
      return !prev;
    });
  }, []); // Empty dependency array - use functional setState

  /**
   * Handle heading selection
   */
  const handleHeadingSelect = useCallback((option: HeadingOption): void => {
    if (!editor || editor.isDestroyed) {
      logger.error('Editor not available for heading selection', {
        editorExists: !!editor,
        editorDestroyed: editor?.isDestroyed
      });
      return;
    }

    // Execute command
    const result = option.command();

    logger.debug('Heading selected', {
      level: option.level,
      label: option.label,
      success: result
    });

    // Close dropdown after command executes
    setTimeout(() => {
      setIsHeadingDropdownOpen(false);
    }, 0);
  }, [editor]);

  /**
   * Define heading options (memoized to ensure editor reference stays current)
   */
  const headingOptions: HeadingOption[] = useMemo(() => [
    {
      id: 'paragraph',
      label: 'Paragraph',
      level: null,
      command: () => {
        if (editor && !editor.isDestroyed) {
          return editor.chain().focus().setParagraph().run();
        }
        return false;
      },
      shortcut: 'Mod+Alt+0',
    },
    {
      id: 'h1',
      label: 'Heading 1',
      level: 1,
      command: () => {
        if (editor && !editor.isDestroyed) {
          return editor.chain().focus().setHeading({ level: 1 }).run();
        }
        return false;
      },
      shortcut: 'Mod+Alt+1',
    },
    {
      id: 'h2',
      label: 'Heading 2',
      level: 2,
      command: () => {
        if (editor && !editor.isDestroyed) {
          return editor.chain().focus().setHeading({ level: 2 }).run();
        }
        return false;
      },
      shortcut: 'Mod+Alt+2',
    },
    {
      id: 'h3',
      label: 'Heading 3',
      level: 3,
      command: () => {
        if (editor && !editor.isDestroyed) {
          return editor.chain().focus().setHeading({ level: 3 }).run();
        }
        return false;
      },
      shortcut: 'Mod+Alt+3',
    },
  ], [editor]);

  /**
   * Define formatting buttons with their configurations
   */
  const formatButtons: FormatButton[] = [
    {
      id: 'bold',
      label: 'Bold',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
      ),
      command: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
      shortcut: 'Mod+B',
      ariaLabel: 'Bold',
    },
    {
      id: 'italic',
      label: 'Italic',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4M14 20h-4M15 4L9 20" />
        </svg>
      ),
      command: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
      shortcut: 'Mod+I',
      ariaLabel: 'Italic',
    },
    {
      id: 'underline',
      label: 'Underline',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19h14M7 5v7a5 5 0 0010 0V5" />
        </svg>
      ),
      command: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive('underline'),
      shortcut: 'Mod+U',
      ariaLabel: 'Underline',
    },
    {
      id: 'strike',
      label: 'Strikethrough',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M8 5a5 5 0 017.5 6.5M8 19a5 5 0 007.5-6.5" />
        </svg>
      ),
      command: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive('strike'),
      shortcut: 'Mod+Shift+X',
      ariaLabel: 'Strikethrough',
    },
    {
      id: 'code',
      label: 'Code',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      command: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive('code'),
      shortcut: 'Mod+E',
      ariaLabel: 'Code',
    },
    {
      id: 'link',
      label: 'Link',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      command: () => {
        if (onOpenLinkEditor) {
          onOpenLinkEditor();
          return true;
        }
        return false;
      },
      isActive: () => editor.isActive('link'),
      shortcut: 'Mod+K',
      ariaLabel: 'Link',
    },
  ];

  /**
   * Define list buttons with their configurations
   */
  const listButtons: FormatButton[] = [
    {
      id: 'bulletList',
      label: 'Bullet List',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="4" cy="6" r="1" fill="currentColor" />
          <circle cx="4" cy="12" r="1" fill="currentColor" />
          <circle cx="4" cy="18" r="1" fill="currentColor" />
        </svg>
      ),
      command: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
      shortcut: 'Mod+Shift+8',
      ariaLabel: 'Bullet List',
    },
    {
      id: 'orderedList',
      label: 'Ordered List',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      ),
      command: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
      shortcut: 'Mod+Shift+7',
      ariaLabel: 'Ordered List',
    },
    {
      id: 'taskList',
      label: 'Task List',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
        </svg>
      ),
      command: () => editor.chain().focus().toggleTaskList().run(),
      isActive: () => editor.isActive('taskList'),
      shortcut: 'Mod+Shift+9',
      ariaLabel: 'Task List',
    },
  ];

  /**
   * Handle button click with logging
   */
  const handleButtonClick = useCallback((button: FormatButton): void => {
    logger.debug('Format button clicked', {
      format: button.id,
      wasActive: button.isActive(),
    });

    button.command();
  }, []);

  return (
    <TiptapBubbleMenu
      editor={editor}
      updateDelay={100}
      className={cn(
        // Base styling
        'flex items-center',
        // Design system: spacing and padding
        'gap-1 px-2 py-1.5',
        // Design system: colors
        'bg-white border border-gray-200',
        // Design system: shadows and depth
        'shadow-lg rounded-lg',
        // Animation
        'transition-opacity duration-100',
        className
      )}
    >
      <div
        role="toolbar"
        aria-label="Text formatting toolbar"
        className="flex items-center gap-1"
      >
        {/* Heading Dropdown */}
        <div className="relative">
          <button
            ref={headingButtonRef}
            type="button"
            onClick={toggleHeadingDropdown}
            aria-label="Heading"
            aria-expanded={isHeadingDropdownOpen}
            aria-haspopup="true"
            title={`Heading (${getShortcutText('Mod+Alt+1/2/3')})`}
            className={cn(
              // Base button styling
              'inline-flex items-center justify-center',
              // Size - minimum 40x40px for touch targets
              'w-auto h-8 px-2',
              // Rounded corners
              'rounded',
              // Transitions
              'transition-all duration-150',
              // Focus state
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
              // Hover state
              'hover:bg-gray-100',
              // Active state styling
              getCurrentHeadingLevel() !== null
                ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                : 'text-gray-700',
              // Disabled state
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <span className="text-sm font-medium mr-1">{getCurrentHeadingLabel()}</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Heading Dropdown Menu */}
          {isHeadingDropdownOpen && (
            <div
              ref={dropdownRef}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className={cn(
                'absolute top-full left-0 mt-1',
                'bg-white border border-gray-200',
                'shadow-lg rounded-lg',
                'py-1 w-[180px]',
                'z-50'
              )}
              role="menu"
              aria-label="Heading options"
            >
              {headingOptions.map((option) => {
                const isActive = option.level === getCurrentHeadingLevel() || (option.level === null && getCurrentHeadingLevel() === null);

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleHeadingSelect(option);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2',
                      'text-sm',
                      'transition-colors duration-150',
                      'hover:bg-gray-100',
                      'focus:outline-none focus:bg-gray-100',
                      isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option.label}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {getShortcutText(option.shortcut)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Format Buttons */}
        {formatButtons.map((button) => {
          const isActive = button.isActive();

          return (
            <button
              key={button.id}
              type="button"
              onClick={() => handleButtonClick(button)}
              aria-label={button.ariaLabel}
              aria-pressed={isActive}
              title={`${button.label} (${getShortcutText(button.shortcut)})`}
              className={cn(
                // Base button styling
                'inline-flex items-center justify-center',
                // Size - minimum 40x40px for touch targets
                'w-8 h-8',
                // Rounded corners
                'rounded',
                // Transitions
                'transition-all duration-150',
                // Focus state
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                // Hover state
                'hover:bg-gray-100',
                // Active state styling
                isActive
                  ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                  : 'text-gray-700',
                // Disabled state
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {button.icon}
            </button>
          );
        })}

        {/* Separator */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* List Buttons */}
        {listButtons.map((button) => {
          const isActive = button.isActive();

          return (
            <button
              key={button.id}
              type="button"
              onClick={() => handleButtonClick(button)}
              aria-label={button.ariaLabel}
              aria-pressed={isActive}
              title={`${button.label} (${getShortcutText(button.shortcut)})`}
              className={cn(
                // Base button styling
                'inline-flex items-center justify-center',
                // Size - minimum 40x40px for touch targets
                'w-8 h-8',
                // Rounded corners
                'rounded',
                // Transitions
                'transition-all duration-150',
                // Focus state
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                // Hover state
                'hover:bg-gray-100',
                // Active state styling
                isActive
                  ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                  : 'text-gray-700',
                // Disabled state
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {button.icon}
            </button>
          );
        })}
      </div>
    </TiptapBubbleMenu>
  );
};

BubbleMenu.displayName = 'BubbleMenu';

export default BubbleMenu;
