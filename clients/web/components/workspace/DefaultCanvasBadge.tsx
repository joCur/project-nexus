'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Props for the DefaultCanvasBadge component
 */
export interface DefaultCanvasBadgeProps {
  /** Whether this canvas is the default */
  isDefault: boolean;
  /** Whether the canvas is currently being set as default */
  isLoading?: boolean;
  /** Whether to show error state */
  hasError?: boolean;
  /** Custom error message to display */
  errorMessage?: string;
  /** Size variant of the badge */
  size?: 'small' | 'medium';
  /** Custom className for styling */
  className?: string;
}

/**
 * Badge component that shows default canvas status with loading and error states
 *
 * Features:
 * - Clear visual indicator for default canvas
 * - Loading state animation when default is being changed
 * - Error state with contextual messaging
 * - Tooltip with helpful information
 * - Accessible with proper ARIA attributes
 * - Responsive design for different container sizes
 */
export const DefaultCanvasBadge: React.FC<DefaultCanvasBadgeProps> = ({
  isDefault,
  isLoading = false,
  hasError = false,
  errorMessage,
  size = 'medium',
  className,
}) => {
  // Don't render anything if not default and not in a special state
  if (!isDefault && !isLoading && !hasError) {
    return null;
  }

  const sizeClasses = {
    small: 'px-1.5 py-0.5 text-xs',
    medium: 'px-2 py-1 text-xs',
  };

  const baseClasses = [
    'inline-flex items-center gap-1 font-medium rounded-full',
    'transition-all duration-200 ease-in-out',
    sizeClasses[size],
  ].join(' ');

  // Determine badge appearance based on state
  let badgeClasses = '';
  let content: React.ReactNode = null;
  let ariaLabel = '';

  if (hasError) {
    badgeClasses = 'bg-error-100 text-error-800 border border-error-200';
    ariaLabel = `Default canvas error: ${errorMessage || 'Failed to set as default'}`;
    content = (
      <>
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <span>Error</span>
      </>
    );
  } else if (isLoading) {
    badgeClasses = 'bg-blue-100 text-blue-800 border border-blue-200';
    ariaLabel = 'Setting as default canvas...';
    content = (
      <>
        <div className="w-3 h-3 animate-spin">
          <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <span>Setting...</span>
      </>
    );
  } else if (isDefault) {
    badgeClasses = 'bg-primary-100 text-primary-800 border border-primary-200';
    ariaLabel = 'This is the default canvas';
    content = (
      <>
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span>Default</span>
      </>
    );
  }

  const tooltipMessage = hasError
    ? (errorMessage || 'Failed to set as default canvas. Please try again.')
    : isLoading
      ? 'Setting this canvas as the default...'
      : 'This canvas will be shown when you first visit the workspace';

  return (
    <div className="relative group">
      <span
        className={cn(baseClasses, badgeClasses, className)}
        role="status"
        aria-label={ariaLabel}
        aria-live="polite"
      >
        {content}
      </span>

      {/* Tooltip */}
      <div
        className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50"
        role="tooltip"
        aria-hidden="true"
      >
        {tooltipMessage}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

/**
 * Lightweight version of the badge for use in compact spaces
 */
export interface DefaultCanvasIndicatorProps {
  isDefault: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  className?: string;
}

export const DefaultCanvasIndicator: React.FC<DefaultCanvasIndicatorProps> = ({
  isDefault,
  isLoading = false,
  hasError = false,
  className,
}) => {
  if (!isDefault && !isLoading && !hasError) {
    return null;
  }

  let iconColor = '';
  let ariaLabel = '';

  if (hasError) {
    iconColor = 'text-error-500';
    ariaLabel = 'Default canvas error';
  } else if (isLoading) {
    iconColor = 'text-blue-500';
    ariaLabel = 'Setting as default...';
  } else {
    iconColor = 'text-primary-500';
    ariaLabel = 'Default canvas';
  }

  return (
    <div className={cn('flex items-center', className)}>
      {isLoading ? (
        <div className={cn('w-4 h-4 animate-spin', iconColor)}>
          <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      ) : (
        <svg
          className={cn('w-4 h-4', iconColor)}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-label={ariaLabel}
          role="img"
        >
          {hasError ? (
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          ) : (
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          )}
        </svg>
      )}
    </div>
  );
};