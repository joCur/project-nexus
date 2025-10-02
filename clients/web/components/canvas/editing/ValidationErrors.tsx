/**
 * ValidationErrors Component
 *
 * Displays validation errors with:
 * - Multiple error messages
 * - Field-specific errors
 * - Error severity levels (error, warning, info)
 * - Accessibility features
 * - Dismissible errors
 * - Animated appearance
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Validation severity enum - categorizes validation messages by importance
 * Following architecture guide Section 4: Enum Type Standardization
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export interface ValidationError {
  /** Field name */
  field?: string;
  /** Error message */
  message: string;
  /** Error severity level */
  severity?: ValidationSeverity;
  /** Error code for internationalization */
  code?: string;
  /** Unique ID for accessibility */
  id?: string;
}

export interface ValidationErrorsProps {
  /** Array of validation errors */
  errors?: ValidationError[];
  /** Show field names with errors */
  showFieldNames?: boolean;
  /** Group errors by field */
  groupByField?: boolean;
  /** Allow dismissing individual errors */
  dismissible?: boolean;
  /** Callback when error is dismissed */
  onDismiss?: (field: string) => void;
  /** Animate error appearance */
  animate?: boolean;
  /** Custom className */
  className?: string;
  /** Custom error item className */
  errorItemClassName?: string;
  /** Custom error template function */
  errorTemplate?: (code: string) => string;
}

/**
 * Get icon for severity level
 */
const getSeverityIcon = (severity: ValidationSeverity): JSX.Element => {
  switch (severity) {
    case ValidationSeverity.ERROR:
      return (
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          data-testid="error-icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case ValidationSeverity.WARNING:
      return (
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          data-testid="warning-icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case ValidationSeverity.INFO:
      return (
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          data-testid="info-icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
};

/**
 * Get CSS classes for severity level (background and border)
 */
const getSeverityClasses = (severity: ValidationSeverity): string => {
  switch (severity) {
    case ValidationSeverity.ERROR:
      return 'bg-red-50 border-red-200';
    case ValidationSeverity.WARNING:
      return 'bg-orange-50 border-orange-200';
    case ValidationSeverity.INFO:
      return 'bg-blue-50 border-blue-200';
  }
};

/**
 * Get text color class for severity level
 */
const getSeverityTextColor = (severity: ValidationSeverity): string => {
  switch (severity) {
    case ValidationSeverity.ERROR:
      return 'text-red-500';
    case ValidationSeverity.WARNING:
      return 'text-orange-500';
    case ValidationSeverity.INFO:
      return 'text-blue-500';
  }
};

/**
 * Get ARIA live region setting for severity
 */
const getAriaLive = (severity: ValidationSeverity): 'assertive' | 'polite' => {
  return severity === ValidationSeverity.ERROR ? 'assertive' : 'polite';
};

/**
 * ValidationErrors component - displays validation error messages
 */
export const ValidationErrors: React.FC<ValidationErrorsProps> = ({
  errors = [],
  showFieldNames = false,
  groupByField = false,
  dismissible = false,
  onDismiss,
  animate = true,
  className = '',
  errorItemClassName = '',
  errorTemplate
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

  // Filter out empty messages
  const validErrors = errors.filter(error => error.message && error.message.trim() !== '');

  // Don't render if no errors
  if (!validErrors || validErrors.length === 0) {
    return null;
  }

  // Group errors by field if requested
  const groupedErrors = groupByField
    ? validErrors.reduce((acc, error) => {
        const field = error.field || 'general';
        if (!acc[field]) {
          acc[field] = [];
        }
        acc[field].push(error);
        return acc;
      }, {} as Record<string, ValidationError[]>)
    : null;

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reducedMotion ? 0.01 : 0.2,
        staggerChildren: reducedMotion ? 0 : 0.05
      }
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: { duration: reducedMotion ? 0.01 : 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -10 }
  };

  const renderError = (error: ValidationError, index: number): JSX.Element => {
    const severity = error.severity || ValidationSeverity.ERROR;
    const message = errorTemplate && error.code
      ? errorTemplate(error.code)
      : error.message;

    const errorContent = (
      <motion.div
        key={error.id || `${error.field}-${index}`}
        variants={animate && !reducedMotion ? itemVariants : undefined}
        className={`flex items-start gap-2 p-2 rounded border ${getSeverityClasses(severity)} ${errorItemClassName}`}
        role={severity === ValidationSeverity.ERROR ? 'alert' : 'status'}
        aria-live={getAriaLive(severity)}
        aria-atomic="true"
        aria-label="Validation errors"
      >
        {getSeverityIcon(severity)}
        <div className={`flex-1 text-sm ${getSeverityTextColor(severity)}`}>
          {showFieldNames && error.field && (
            <span className="font-semibold mr-1">{error.field}:</span>
          )}
          <span id={error.id}>{message}</span>
        </div>
        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(error.field || 'general')}
            className="flex-shrink-0 p-1 hover:bg-black hover:bg-opacity-10 rounded"
            aria-label={`Dismiss ${error.field || 'this'} error`}
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
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </motion.div>
    );

    return errorContent;
  };

  const content = groupedErrors ? (
    Object.entries(groupedErrors).map(([field, fieldErrors]) => (
      <div key={field} className="space-y-1">
        <div className="text-sm font-semibold text-gray-700" aria-hidden="true">
          {field}
        </div>
        {fieldErrors.map((error, index) => renderError(error, index))}
      </div>
    ))
  ) : (
    validErrors.map((error, index) => renderError(error, index))
  );

  const Container = animate && !reducedMotion ? motion.div : 'div';
  const containerProps = {
    className: `validation-errors space-y-2 ${animate && !reducedMotion ? 'animate-slide-down' : ''} ${className}`,
    ...(animate && !reducedMotion ? {
      variants: containerVariants,
      initial: 'hidden' as const,
      animate: 'visible' as const,
      exit: 'exit' as const
    } : {})
  };

  return (
    <AnimatePresence mode="wait">
      <Container {...containerProps}>
        {content}
      </Container>
    </AnimatePresence>
  );
};

export default ValidationErrors;
