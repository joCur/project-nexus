/**
 * SaveStatusIndicator Component
 *
 * Enhanced visual feedback component for save operations with:
 * - Loading spinner during save
 * - Success checkmark on completion
 * - Error indicator with detailed messages
 * - Retry button for failed saves
 * - Unsaved changes indicator
 * - Network error detection
 * - Accessibility features
 *
 * Uses Framer Motion for smooth animations following design system.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  loadingSpinnerVariants
} from '@/utils/canvas/editAnimations';

/**
 * Save status enum - tracks the current state of save operations
 * Following architecture guide Section 4: Enum Type Standardization
 */
export enum SaveStatus {
  IDLE = 'idle',
  SAVING = 'saving',
  SUCCESS = 'success',
  ERROR = 'error'
}

/**
 * Error type enum - categorizes different types of save errors
 * Following architecture guide Section 4: Enum Type Standardization
 */
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  SERVER = 'server',
  UNKNOWN = 'unknown'
}

export interface SaveStatusIndicatorProps {
  /** Current save status */
  status: SaveStatus;
  /** Error message to display */
  errorMessage?: string;
  /** Success message to display (optional) */
  successMessage?: string;
  /** Error type for specialized handling */
  errorType?: ErrorType;
  /** Error code for debugging */
  errorCode?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Current retry attempt number */
  retryCount?: number;
  /** Whether there are unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SaveStatusIndicator component - shows visual feedback for save operations
 */
export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  status,
  errorMessage,
  successMessage,
  errorType = ErrorType.UNKNOWN,
  errorCode,
  onRetry,
  isRetrying = false,
  retryCount = 0,
  hasUnsavedChanges = false,
  className = ''
}): JSX.Element | null => {
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent): void => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Show unsaved changes indicator when idle
  if (status === SaveStatus.IDLE && hasUnsavedChanges) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-1 text-orange-400"
          aria-label="Unsaved changes"
        >
          <span className="text-orange-500 font-bold" aria-hidden="true">*</span>
          <span>Unsaved changes</span>
        </motion.div>
      </div>
    );
  }

  // Don't render anything when idle and no changes
  if (status === SaveStatus.IDLE) {
    return null;
  }

  // Get error icon based on type
  const getErrorIcon = (): JSX.Element => {
    if (errorType === ErrorType.NETWORK) {
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          data-testid="offline-icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
          />
        </svg>
      );
    }

    if (errorType === ErrorType.VALIDATION) {
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          data-testid="validation-icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    }

    return (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    );
  };

  // Truncate error message if too long
  const displayMessage = errorMessage && errorMessage.length > 100
    ? errorMessage.substring(0, 97) + '...'
    : errorMessage;

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <AnimatePresence mode="wait">
        {/* Saving state - spinner with pulse */}
        {status === SaveStatus.SAVING && (
          <motion.div
            key="saving"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <motion.span
              variants={loadingSpinnerVariants}
              animate="animate"
              className="inline-block w-2 h-2 border border-blue-500 border-t-transparent rounded-full"
            />
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-blue-400"
            >
              Saving...
            </motion.span>
          </motion.div>
        )}

        {/* Success state - checkmark with bounce */}
        {status === SaveStatus.SUCCESS && (
          <motion.div
            key="success"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.3, times: [0, 0.6, 1], ease: 'easeOut' }}
            className="flex items-center gap-2 text-green-400"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{successMessage || 'Saved'}</span>
          </motion.div>
        )}

        {/* Error state - error icon with shake and retry button */}
        {status === SaveStatus.ERROR && (
          <motion.div
            key="error"
            initial={{ x: 0 }}
            animate={{ x: reducedMotion ? 0 : [-10, 10, -10, 10, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.4, times: [0, 0.25, 0.5, 0.75, 1] }}
            className="flex items-center gap-2"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div className="flex items-center gap-2 text-red-400">
              {getErrorIcon()}
              <div className="flex flex-col">
                <span>{displayMessage || 'Save failed'}</span>
                {errorCode && (
                  <span className="text-xs text-red-300 font-mono">{errorCode}</span>
                )}
                {errorType === ErrorType.NETWORK && (
                  <span className="text-xs text-red-300">Check your connection</span>
                )}
                {retryCount > 0 && (
                  <span className="text-xs text-red-300">Attempt {retryCount + 1}</span>
                )}
              </div>
            </div>

            {/* Retry button */}
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Retry save operation"
              >
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Retry status announcement for screen readers */}
      {isRetrying && (
        <div role="status" aria-live="polite" className="sr-only">
          Retrying save operation
        </div>
      )}
    </div>
  );
};

SaveStatusIndicator.displayName = 'SaveStatusIndicator';

export default SaveStatusIndicator;
