/**
 * SlashCommandMenu Component
 *
 * Notion-like slash command menu for the Tiptap text editor.
 * Appears when the user types "/" and provides a filterable list of commands
 * to insert different block types (headings, lists, blockquote, code blocks, etc.).
 *
 * Features:
 * - Keyboard navigation with arrow keys
 * - Mouse interaction (click, hover)
 * - Search/filter by query string
 * - Executes commands to insert blocks
 * - Design system compliant styling
 * - Full accessibility support (ARIA, screen readers)
 *
 * @requires @tiptap/react - Tiptap React integration
 * @requires tippy.js - Popover positioning (handled by SlashCommands extension)
 *
 * Related Documentation: "Tiptap Text Editor Implementation" in Notion
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from 'react';
import type { Editor, Range } from '@tiptap/core';
import { cn } from '@/lib/utils';
import { createContextLogger } from '@/utils/logger';

// Create logger at module level with component context
const logger = createContextLogger({ component: 'SlashCommandMenu' });

/**
 * Slash command item definition
 */
export interface SlashCommandItem {
  /** Display title */
  title: string;
  /** Description text */
  description: string;
  /** Icon element */
  icon: React.ReactNode;
  /** Command execution function */
  command: (props: { editor: Editor; range: Range }) => void;
  /** Alternative search terms */
  aliases?: string[];
}

/**
 * Props for SlashCommandMenu component
 */
export interface SlashCommandMenuProps {
  /** Tiptap editor instance */
  editor: Editor;
  /** Current search query */
  query: string;
  /** Text range to replace when command is executed */
  range: Range;
  /** Available command items */
  items: SlashCommandItem[];
  /** Callback when a command is selected */
  command: (item: SlashCommandItem) => void;
  /** Optional callback when menu should close */
  onClose?: () => void;
}

/**
 * Exposed methods for parent components (used by SlashCommands extension)
 */
export interface SlashCommandMenuRef {
  /** Handle keyboard events */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * Filter items based on query
 * Matches against title, description, and aliases (case-insensitive, partial match)
 */
const filterItems = (items: SlashCommandItem[], query: string): SlashCommandItem[] => {
  if (!query || query.trim().length === 0) {
    return items;
  }

  const lowerQuery = query.toLowerCase().trim();

  return items.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(lowerQuery);
    const descriptionMatch = item.description.toLowerCase().includes(lowerQuery);
    const aliasMatch = item.aliases?.some((alias) => alias.toLowerCase().includes(lowerQuery));

    return titleMatch || descriptionMatch || aliasMatch;
  });
};

/**
 * SlashCommandMenu Component
 *
 * Renders a dropdown menu with command items for inserting blocks.
 * Supports keyboard navigation, mouse interaction, and search filtering.
 */
export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ query, items, command, onClose }, ref) => {
    // Selected item index (0-based)
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Filter items based on query
    const filteredItems = useMemo(() => filterItems(items, query), [items, query]);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [filteredItems]);

    // Scroll selected item into view when selection changes
    useEffect(() => {
      const selectedButton = document.querySelector(
        `[role="menuitem"][data-selected="true"]`
      ) as HTMLElement;

      if (selectedButton) {
        selectedButton.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
        logger.debug('Scrolled selected item into view', { selectedIndex });
      }
    }, [selectedIndex]);

    // Log component mount and query changes
    useEffect(() => {
      logger.debug('SlashCommandMenu rendered', {
        query,
        itemCount: items.length,
        filteredCount: filteredItems.length,
        selectedIndex,
      });
    }, [query, items.length, filteredItems.length, selectedIndex]);

    /**
     * Select next item (arrow down)
     */
    const selectNext = useCallback((): void => {
      setSelectedIndex((prev) => {
        const next = (prev + 1) % filteredItems.length;
        logger.debug('Selected next item', { from: prev, to: next });
        return next;
      });
    }, [filteredItems.length]);

    /**
     * Select previous item (arrow up)
     */
    const selectPrevious = useCallback((): void => {
      setSelectedIndex((prev) => {
        const next = prev === 0 ? filteredItems.length - 1 : prev - 1;
        logger.debug('Selected previous item', { from: prev, to: next });
        return next;
      });
    }, [filteredItems.length]);

    /**
     * Execute selected item command
     */
    const executeSelected = useCallback((): void => {
      const selectedItem = filteredItems[selectedIndex];

      if (!selectedItem) {
        logger.warn('No item selected to execute', { selectedIndex });
        return;
      }

      logger.debug('Executing command', {
        command: selectedItem.title,
        selectedIndex,
      });

      command(selectedItem);
    }, [filteredItems, selectedIndex, command]);

    /**
     * Execute specific item command
     */
    const executeItem = useCallback(
      (item: SlashCommandItem): void => {
        logger.debug('Executing command via click', {
          command: item.title,
        });

        command(item);
      },
      [command]
    );

    /**
     * Handle keyboard events (exposed via ref for parent component)
     */
    const handleKeyDown = useCallback(
      (event: KeyboardEvent): boolean => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          selectNext();
          return true;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          selectPrevious();
          return true;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          executeSelected();
          return true;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          if (onClose) {
            onClose();
          }
          return true;
        }

        return false;
      },
      [selectNext, selectPrevious, executeSelected, onClose]
    );

    /**
     * Handle item hover
     */
    const handleItemHover = useCallback((index: number): void => {
      setSelectedIndex(index);
    }, []);

    /**
     * Handle item click
     */
    const handleItemClick = useCallback(
      (item: SlashCommandItem): void => {
        executeItem(item);
      },
      [executeItem]
    );

    /**
     * Expose methods to parent component via ref
     */
    useImperativeHandle(ref, () => ({
      onKeyDown: handleKeyDown,
    }));

    /**
     * Focus menu on mount for keyboard accessibility
     */
    useEffect(() => {
      // Add a small delay to ensure the menu is rendered
      const timeoutId = setTimeout(() => {
        const menuElement = document.querySelector('[role="menu"]') as HTMLElement;
        if (menuElement) {
          menuElement.focus();
          logger.debug('Menu focused for keyboard navigation');
        }
      }, 0);

      return (): void => {
        clearTimeout(timeoutId);
      };
    }, []);

    // Show "No results" message if no items match
    if (filteredItems.length === 0) {
      return (
        <div
          className={cn(
            // Base styling
            'flex items-center justify-center',
            // Design system: spacing and padding
            'px-4 py-3',
            // Design system: colors
            'bg-white border border-gray-200',
            // Design system: shadows and depth
            'shadow-lg rounded-lg',
            // Typography
            'text-sm text-gray-500'
          )}
          role="menu"
          aria-label="Slash command menu"
        >
          No results found
        </div>
      );
    }

    return (
      <div
        className={cn(
          // Base styling
          'flex flex-col',
          // Design system: spacing
          'py-2',
          // Design system: colors
          'bg-white border border-gray-200',
          // Design system: shadows and depth
          'shadow-lg rounded-lg',
          // Maximum height with scroll
          'max-h-[400px] overflow-y-auto',
          // Minimum width
          'min-w-[280px]'
        )}
        role="menu"
        aria-label="Slash command menu"
        tabIndex={-1}
        onKeyDown={(e) => {
          // Handle keyboard events directly on the container as backup
          const wasHandled = handleKeyDown(e.nativeEvent);
          if (wasHandled) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {filteredItems.map((item, index) => {
          const isSelected = index === selectedIndex;

          return (
            <button
              key={`${item.title}-${index}`}
              type="button"
              role="menuitem"
              data-selected={isSelected}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => handleItemHover(index)}
              className={cn(
                // Base button styling
                'flex items-start gap-3 w-full',
                // Design system: spacing
                'px-3 py-2',
                // Design system: text alignment
                'text-left',
                // Transitions
                'transition-colors duration-150',
                // Hover state
                'hover:bg-primary-50',
                // Selected state styling
                isSelected ? 'bg-primary-100' : '',
                // Focus state
                'focus:outline-none focus:bg-primary-100'
              )}
            >
              {/* Icon */}
              <span
                className={cn(
                  // Icon styling
                  'flex items-center justify-center',
                  'w-10 h-10',
                  'rounded',
                  'bg-gray-100',
                  'text-gray-700 text-lg font-medium',
                  'flex-shrink-0'
                )}
                aria-hidden="true"
              >
                {item.icon}
              </span>

              {/* Text content */}
              <div className="flex flex-col flex-1 min-w-0">
                {/* Title */}
                <span
                  className={cn(
                    'text-sm font-medium',
                    isSelected ? 'text-primary-900' : 'text-gray-900'
                  )}
                >
                  {item.title}
                </span>

                {/* Description */}
                <span
                  className={cn(
                    'text-xs',
                    isSelected ? 'text-primary-700' : 'text-gray-600',
                    'mt-0.5'
                  )}
                >
                  {item.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);

SlashCommandMenu.displayName = 'SlashCommandMenu';

export default SlashCommandMenu;
