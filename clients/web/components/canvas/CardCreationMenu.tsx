'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { CardType } from '@/types/card.types';
import type { Position } from '@/types/common.types';

/**
 * Card creation menu item configuration
 */
interface CardCreationMenuOption {
  type: CardType;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
}

/**
 * Menu item type union
 */
type MenuItemType = CardCreationMenuOption | {
  type: 'separator';
  separator: boolean;
} | {
  type: 'more';
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
};

/**
 * Props for the CardCreationMenu component
 */
export interface CardCreationMenuProps {
  /** Position where the menu should appear */
  position: Position;
  /** Callback when menu should be closed */
  onClose: () => void;
  /** Callback when a card type is selected for quick creation */
  onCreateCard: (type: CardType) => void;
  /** Callback when advanced modal should be opened */
  onMoreOptions: () => void;
  /** Disabled card types */
  disabledTypes?: CardType[];
  /** Custom class name */
  className?: string;
}

/**
 * Card creation menu options
 */
const CARD_CREATION_OPTIONS: CardCreationMenuOption[] = [
  {
    type: 'text',
    label: 'Text Card',
    description: 'Rich text with markdown support',
    shortcut: 'T',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    type: 'image',
    label: 'Image Card',
    description: 'Visual content with captions',
    shortcut: 'I',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    type: 'link',
    label: 'Link Card',
    description: 'Web links with previews',
    shortcut: 'L',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    type: 'code',
    label: 'Code Card',
    description: 'Syntax-highlighted code',
    shortcut: 'C',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
];

/**
 * Context menu for card creation with quick actions and keyboard navigation
 *
 * Features:
 * - Quick card type selection for immediate creation
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Smart positioning to stay within viewport
 * - Accessible with ARIA labels and descriptions
 * - Visual icons and descriptions for each card type
 * - Optional keyboard shortcuts display
 * - "More Options" action to open advanced modal
 * - Loading states and disabled options support
 */
export const CardCreationMenu: React.FC<CardCreationMenuProps> = ({
  position,
  onClose,
  onCreateCard,
  onMoreOptions,
  disabledTypes = [],
  className = '',
}) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState(position);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter out disabled options
  const availableOptions = CARD_CREATION_OPTIONS.filter(
    option => !disabledTypes.includes(option.type)
  );

  // All menu items including separator and more options
  const allMenuItems: MenuItemType[] = [
    ...availableOptions,
    { type: 'separator' as const, separator: true },
    {
      type: 'more' as const,
      label: 'More Options...',
      description: 'Open advanced card creation modal',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
      ),
      onClick: onMoreOptions,
    },
  ];

  // Get focusable items (exclude separator)
  const focusableItems = allMenuItems.filter(item => !('separator' in item));

  /**
   * Handle menu item click
   */
  const handleItemClick = (item: MenuItemType) => {
    if ('separator' in item) return;

    if (item.type === 'more') {
      onMoreOptions();
    } else {
      onCreateCard(item.type as CardType);
    }
  };

  /**
   * Position menu within viewport
   */
  useEffect(() => {
    if (!menuRef.current) return;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // Adjust horizontal position
    if (x + menuRect.width > viewportWidth) {
      x = viewportWidth - menuRect.width - 8; // 8px margin
    }
    if (x < 8) {
      x = 8;
    }

    // Adjust vertical position
    if (y + menuRect.height > viewportHeight) {
      y = viewportHeight - menuRect.height - 8; // 8px margin
    }
    if (y < 8) {
      y = 8;
    }

    setMenuPosition({ x, y });
  }, [position]);

  /**
   * Close menu on outside click
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  /**
   * Handle keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev => {
            const nextIndex = prev + 1;
            return nextIndex >= focusableItems.length ? 0 : nextIndex;
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev => {
            const prevIndex = prev - 1;
            return prevIndex < 0 ? focusableItems.length - 1 : prevIndex;
          });
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < focusableItems.length) {
            const item = focusableItems[focusedIndex];
            handleItemClick(item);
          }
          break;
        // Handle keyboard shortcuts
        case 't':
        case 'T':
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            onCreateCard('text');
          }
          break;
        case 'i':
        case 'I':
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            onCreateCard('image');
          }
          break;
        case 'l':
        case 'L':
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            onCreateCard('link');
          }
          break;
        case 'c':
        case 'C':
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            onCreateCard('code');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, focusableItems, onClose, onCreateCard, handleItemClick]);

  /**
   * Focus menu when it opens
   */
  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.focus();
    }
  }, []);

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 min-w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 focus:outline-none',
        className
      )}
      style={{ left: menuPosition.x, top: menuPosition.y }}
      role="menu"
      aria-label="Create new card"
      tabIndex={-1}
    >
      {/* Menu header */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="font-medium text-sm text-gray-900">Create New Card</div>
        <div className="text-xs text-gray-500">Choose a card type to add to canvas</div>
      </div>

      {/* Menu items */}
      {allMenuItems.map((item) => {
        // Handle separator
        if ('separator' in item) {
          return <div key="separator" className="my-1 border-t border-gray-100" />;
        }

        const focusableIndex = focusableItems.findIndex(focusableItem => focusableItem === item);
        const isFocused = focusedIndex === focusableIndex;
        const isDisabled = item.type !== 'more' && disabledTypes.includes(item.type as CardType);

        return (
          <button
            key={item.type}
            onClick={() => handleItemClick(item)}
            disabled={isDisabled}
            className={cn(
              'w-full px-3 py-2 text-left text-sm transition-colors flex items-center space-x-3',
              'focus:outline-none',
              isDisabled
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-50 focus:bg-gray-50',
              isFocused && !isDisabled && 'bg-gray-50'
            )}
            role="menuitem"
            aria-describedby={`${item.type}-description`}
          >
            {/* Icon */}
            <div className="flex-shrink-0 text-gray-600">
              {item.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="font-medium">{item.label}</div>
                {'shortcut' in item && item.shortcut && (
                  <kbd className="ml-2 px-2 py-1 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono text-xs">
                    {item.shortcut}
                  </kbd>
                )}
              </div>
              {item.description && (
                <div
                  id={`${item.type}-description`}
                  className="text-xs text-gray-500 mt-1"
                >
                  {item.description}
                </div>
              )}
            </div>
          </button>
        );
      })}

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          Use arrow keys to navigate, Enter to select, Esc to close
        </div>
      </div>
    </div>
  );
};

export default CardCreationMenu;