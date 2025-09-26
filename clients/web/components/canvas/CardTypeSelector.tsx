'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { CardType } from '@/types/card.types';

/**
 * Card type option configuration
 */
interface CardTypeOption {
  type: CardType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  shortcut?: string;
}

/**
 * Props for the CardTypeSelector component
 */
export interface CardTypeSelectorProps {
  /** Currently selected card type */
  selectedType?: CardType;
  /** Callback when a card type is selected */
  onTypeSelect: (type: CardType) => void;
  /** Layout variant */
  variant?: 'grid' | 'list';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show descriptions */
  showDescriptions?: boolean;
  /** Whether to show keyboard shortcuts */
  showShortcuts?: boolean;
  /** Disabled card types */
  disabledTypes?: CardType[];
  /** Custom class name */
  className?: string;
}

/**
 * Card type options configuration
 */
const CARD_TYPE_OPTIONS: CardTypeOption[] = [
  {
    type: 'text',
    label: 'Text Card',
    description: 'Rich text content with markdown support',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    shortcut: 'T',
    icon: (
      <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    type: 'image',
    label: 'Image Card',
    description: 'Visual content with captions and metadata',
    color: 'text-green-600 bg-green-50 border-green-200',
    shortcut: 'I',
    icon: (
      <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    type: 'link',
    label: 'Link Card',
    description: 'Web links with preview and metadata',
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    shortcut: 'L',
    icon: (
      <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    type: 'code',
    label: 'Code Card',
    description: 'Syntax-highlighted code snippets',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    shortcut: 'C',
    icon: (
      <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
];

/**
 * Visual card type picker component with grid and list layouts
 *
 * Features:
 * - Multiple layout variants (grid/list)
 * - Keyboard navigation support
 * - Accessible with ARIA labels and descriptions
 * - Customizable sizing and appearance
 * - Keyboard shortcut display
 * - Disabled state support
 * - Hover and selection states
 */
export const CardTypeSelector: React.FC<CardTypeSelectorProps> = ({
  selectedType,
  onTypeSelect,
  variant = 'grid',
  size = 'md',
  showDescriptions = true,
  showShortcuts = false,
  disabledTypes = [],
  className = '',
}) => {
  const handleKeyDown = (event: React.KeyboardEvent, type: CardType) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabledTypes.includes(type)) {
        onTypeSelect(type);
      }
    }
  };

  const getVariantClasses = () => {
    if (variant === 'grid') {
      return 'grid grid-cols-2 gap-3';
    }
    return 'flex flex-col space-y-2';
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'p-2',
          icon: 'w-5 h-5',
          label: 'text-sm',
          description: 'text-xs',
          shortcut: 'text-xs',
        };
      case 'lg':
        return {
          container: 'p-4',
          icon: 'w-8 h-8',
          label: 'text-lg',
          description: 'text-sm',
          shortcut: 'text-sm',
        };
      default:
        return {
          container: 'p-3',
          icon: 'w-6 h-6',
          label: 'text-base',
          description: 'text-sm',
          shortcut: 'text-xs',
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <div
      className={cn(getVariantClasses(), className)}
      role="radiogroup"
      aria-label="Select card type"
    >
      {CARD_TYPE_OPTIONS.map((option) => {
        const isSelected = selectedType === option.type;
        const isDisabled = disabledTypes.includes(option.type);

        return (
          <button
            key={option.type}
            type="button"
            onClick={() => !isDisabled && onTypeSelect(option.type)}
            onKeyDown={(e) => handleKeyDown(e, option.type)}
            disabled={isDisabled}
            className={cn(
              'relative flex items-start space-x-3 rounded-lg border-2 transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              sizeClasses.container,
              isSelected
                ? cn(option.color, 'ring-2 ring-offset-2 ring-current')
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
              isDisabled && 'opacity-50 cursor-not-allowed hover:border-gray-200 hover:bg-transparent',
              variant === 'list' && 'flex-row'
            )}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            aria-describedby={`${option.type}-description`}
          >
            {/* Icon */}
            <div className={cn(
              'flex-shrink-0 flex items-center justify-center rounded-md',
              sizeClasses.icon,
              isSelected ? 'text-current' : 'text-gray-600'
            )}>
              {option.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className={cn(
                  'font-medium',
                  sizeClasses.label,
                  isSelected ? 'text-current' : 'text-gray-900'
                )}>
                  {option.label}
                </h3>

                {showShortcuts && option.shortcut && (
                  <kbd className={cn(
                    'ml-2 px-2 py-1 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono',
                    sizeClasses.shortcut
                  )}>
                    {option.shortcut}
                  </kbd>
                )}
              </div>

              {showDescriptions && (
                <p
                  id={`${option.type}-description`}
                  className={cn(
                    'mt-1 text-gray-500',
                    sizeClasses.description
                  )}
                >
                  {option.description}
                </p>
              )}
            </div>

            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute top-2 right-2">
                <svg
                  className="w-4 h-4 text-current"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CardTypeSelector;