/**
 * SaveStatusIndicator Component
 *
 * Displays the current save status (saving/saved/error) with appropriate visual feedback.
 * Auto-hides success status after 2 seconds. Provides retry button on errors.
 */

import React, { useEffect, useState } from 'react';
import { SaveStatus } from '@/hooks/useAutosave';

// Re-export SaveStatus for convenience
export { SaveStatus } from '@/hooks/useAutosave';

/**
 * Props for SaveStatusIndicator component
 */
export interface SaveStatusIndicatorProps {
  /** Current save status */
  status: SaveStatus;
  /** Optional callback to retry failed save */
  onRetry?: () => void;
}

/**
 * Loading spinner icon component
 */
const SpinnerIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
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
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/**
 * Checkmark icon component
 */
const CheckmarkIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

/**
 * Error icon component
 */
const ErrorIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

/**
 * SaveStatusIndicator component
 */
export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  status,
  onRetry
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldFadeOut, setShouldFadeOut] = useState(false);

  // Auto-hide success status after 2 seconds
  useEffect(() => {
    if (status === SaveStatus.SUCCESS) {
      // Reset visibility states
      setIsVisible(true);
      setShouldFadeOut(false);

      // Start fade-out after 1.8s (200ms before hide)
      const fadeOutTimer = setTimeout(() => {
        setShouldFadeOut(true);
      }, 1800);

      // Hide completely after 2s
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
      }, 2000);

      return () => {
        clearTimeout(fadeOutTimer);
        clearTimeout(hideTimer);
      };
    } else {
      // Reset for other statuses
      setIsVisible(true);
      setShouldFadeOut(false);
    }
  }, [status]);

  // Don't render anything in idle state
  if (status === SaveStatus.IDLE) {
    return null;
  }

  // Don't render if hidden (after success auto-hide)
  if (!isVisible) {
    return null;
  }

  // Render based on status
  switch (status) {
    case SaveStatus.SAVING:
      return (
        <div
          className={`flex items-center gap-1.5 text-sm text-gray-600 transition-opacity duration-200 ${
            shouldFadeOut ? 'opacity-0' : 'opacity-100'
          }`}
          role="status"
          aria-live="polite"
          aria-label="Saving content"
        >
          <SpinnerIcon className="w-4 h-4" />
          <span>Saving...</span>
        </div>
      );

    case SaveStatus.SUCCESS:
      return (
        <div
          className={`flex items-center gap-1.5 text-sm text-green-600 transition-opacity duration-200 ${
            shouldFadeOut ? 'opacity-0' : 'opacity-100'
          }`}
          role="status"
          aria-live="polite"
        >
          <CheckmarkIcon className="w-4 h-4" />
          <span>Saved</span>
        </div>
      );

    case SaveStatus.ERROR:
      return (
        <div
          className={`flex items-center gap-2 text-sm text-red-600 transition-opacity duration-200 ${
            shouldFadeOut ? 'opacity-0' : 'opacity-100'
          }`}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-1.5">
            <ErrorIcon className="w-4 h-4" />
            <span>Failed to save</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded px-1"
              aria-label="Retry save"
            >
              Retry
            </button>
          )}
        </div>
      );

    default:
      return null;
  }
};

SaveStatusIndicator.displayName = 'SaveStatusIndicator';

export default SaveStatusIndicator;
