/**
 * LinkEditorPopup Component
 *
 * Modal popup for adding and editing links in the Tiptap text editor.
 * Provides URL input with validation and keyboard shortcuts.
 *
 * Features:
 * - URL input with validation (http/https/mailto protocols)
 * - Edit existing link URLs
 * - Remove links (by submitting empty URL)
 * - Keyboard shortcuts: Enter to save, Escape to cancel
 * - Design system compliant styling
 * - Full accessibility support
 *
 * Related Documentation: "Tiptap Text Editor Implementation" in Notion
 */

import React, { useState, useCallback, useEffect, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { createContextLogger } from '@/utils/logger';

// Create logger at module level with component context
const logger = createContextLogger({ component: 'LinkEditorPopup' });

/**
 * Props for LinkEditorPopup component
 */
export interface LinkEditorPopupProps {
  /** Initial URL value (for editing existing links) */
  initialUrl?: string;
  /** Callback when link is saved */
  onSave: (url: string) => void;
  /** Callback when popup is cancelled */
  onCancel: () => void;
}

/**
 * Validate URL format
 */
const isValidUrl = (url: string): boolean => {
  if (!url || url.trim().length === 0) {
    // Empty URL is valid (will remove link)
    return true;
  }

  // Check for valid protocols
  return /^https?:\/\/.+/.test(url) || /^mailto:.+/.test(url);
};

/**
 * LinkEditorPopup Component
 *
 * Modal popup for editing link URLs with validation and keyboard shortcuts.
 */
export const LinkEditorPopup: React.FC<LinkEditorPopupProps> = ({
  initialUrl = '',
  onSave,
  onCancel
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);

  // Auto-focus input on mount
  useEffect(() => {
    logger.debug('LinkEditorPopup mounted', {
      hasInitialUrl: !!initialUrl,
      initialUrl
    });
  }, [initialUrl]);

  /**
   * Handle URL input change
   */
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const newUrl = e.target.value;
    setUrl(newUrl);

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  }, [error]);

  /**
   * Handle save
   */
  const handleSave = useCallback((): void => {
    const trimmedUrl = url.trim();

    // Validate URL
    if (trimmedUrl && !isValidUrl(trimmedUrl)) {
      setError('Please enter a valid URL (http://, https://, or mailto:)');
      logger.warn('Invalid URL format', { url: trimmedUrl });
      return;
    }

    logger.debug('Link saved', {
      url: trimmedUrl,
      wasEmpty: !trimmedUrl
    });

    onSave(trimmedUrl);
  }, [url, onSave]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback((): void => {
    logger.debug('Link edit cancelled');
    onCancel();
  }, [onCancel]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  /**
   * Handle backdrop click
   */
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    // Only close if clicking the backdrop itself, not its children
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }, [handleCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-editor-title"
    >
      <div
        className={cn(
          // Base styling
          'relative',
          // Size
          'w-full max-w-md',
          // Design system: colors
          'bg-white',
          // Design system: border and shadows
          'border border-gray-200 shadow-xl rounded-lg',
          // Padding
          'p-6',
          // Animation
          'animate-fade-in'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          id="link-editor-title"
          className="text-lg font-semibold text-gray-900 mb-4"
        >
          {initialUrl ? 'Edit Link' : 'Add Link'}
        </h2>

        {/* URL Input */}
        <div className="mb-4">
          <label
            htmlFor="link-url-input"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            URL
          </label>
          <input
            id="link-url-input"
            type="url"
            value={url}
            onChange={handleUrlChange}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com"
            autoFocus
            className={cn(
              // Base input styling
              'w-full px-3 py-2 rounded-md',
              // Design system: border
              'border',
              error ? 'border-error-500' : 'border-gray-300',
              // Design system: focus state
              'focus:outline-none focus:ring-2',
              error ? 'focus:ring-error-500' : 'focus:ring-primary-500',
              'focus:border-transparent',
              // Typography
              'text-sm text-gray-900 placeholder-gray-400',
              // Transitions
              'transition-all duration-150'
            )}
            aria-invalid={!!error}
            aria-describedby={error ? 'link-url-error' : undefined}
          />

          {/* Error message */}
          {error && (
            <p
              id="link-url-error"
              className="mt-2 text-sm text-error-600"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* Help text */}
          {!error && (
            <p className="mt-2 text-xs text-gray-500">
              Enter a URL starting with http://, https://, or mailto:
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className={cn(
              // Base button styling
              'px-4 py-2 rounded-md',
              // Design system: colors
              'text-gray-700 bg-white border border-gray-300',
              // Hover state
              'hover:bg-gray-50',
              // Focus state
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
              // Typography
              'text-sm font-medium',
              // Transitions
              'transition-colors duration-150'
            )}
          >
            Cancel
          </button>

          {initialUrl && (
            <button
              type="button"
              onClick={() => {
                logger.debug('Remove link clicked');
                onSave('');
              }}
              className={cn(
                // Base button styling
                'px-4 py-2 rounded-md',
                // Design system: colors
                'text-error-700 bg-error-50 border border-error-300',
                // Hover state
                'hover:bg-error-100',
                // Focus state
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error-500',
                // Typography
                'text-sm font-medium',
                // Transitions
                'transition-colors duration-150'
              )}
            >
              Remove Link
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            className={cn(
              // Base button styling
              'px-4 py-2 rounded-md',
              // Design system: colors
              'text-white bg-primary-600 border border-transparent',
              // Hover state
              'hover:bg-primary-700',
              // Focus state
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
              // Typography
              'text-sm font-medium',
              // Transitions
              'transition-colors duration-150'
            )}
          >
            {initialUrl ? 'Update' : 'Add Link'}
          </button>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Enter</kbd> to save,{' '}
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Esc</kbd> to cancel
          </p>
        </div>
      </div>
    </div>
  );
};

LinkEditorPopup.displayName = 'LinkEditorPopup';

export default LinkEditorPopup;
