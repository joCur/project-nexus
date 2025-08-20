'use client';

import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Input size variants based on design tokens
 */
export type InputSize = 'small' | 'medium' | 'large';

/**
 * Input state variants for styling
 */
export type InputState = 'default' | 'error' | 'success' | 'warning';

/**
 * Input component props extending native input attributes
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  state?: InputState;
  label?: string;
  description?: string;
  errorMessage?: string;
  successMessage?: string;
  warningMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
  hideLabel?: boolean; // For when label is provided but should be visually hidden
}

/**
 * Loading spinner for input fields
 */
const InputSpinner = () => (
  <svg
    className="w-4 h-4 animate-spin text-text-tertiary"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="img"
    aria-label="Loading"
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
      d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/**
 * Accessible input component that follows Project Nexus design system
 * 
 * Features:
 * - Full WCAG 2.1 AA compliance
 * - Proper labeling and description support
 * - Error, success, and warning states with appropriate ARIA attributes
 * - Loading states
 * - Icon support (left and right)
 * - Multiple size variants
 * - Proper focus management
 * - Screen reader support
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'medium',
      state = 'default',
      label,
      description,
      errorMessage,
      successMessage,
      warningMessage,
      leftIcon,
      rightIcon,
      isLoading = false,
      fullWidth = false,
      hideLabel = false,
      disabled,
      className,
      id: providedId,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const id = useId();
    const inputId = providedId || id;
    const descriptionId = `${inputId}-description`;
    const messageId = `${inputId}-message`;

    // Determine the current state based on props
    const currentState = errorMessage ? 'error' : 
                        successMessage ? 'success' : 
                        warningMessage ? 'warning' : 
                        state;

    const currentMessage = errorMessage || successMessage || warningMessage;

    // Base input styling
    const baseInputClasses = [
      'block w-full border transition-all duration-150',
      'bg-card-background text-text-primary placeholder-text-tertiary',
      'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-0',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-50',
      'motion-safe:transition-all motion-reduce:transition-none',
    ].join(' ');

    // Size-specific classes based on design tokens
    const sizeClasses = {
      small: 'h-8 px-3 text-sm rounded-md', // 32px height
      medium: 'h-10 px-4 text-base rounded-lg', // 40px height
      large: 'h-12 px-5 text-lg rounded-lg', // 48px height
    };

    // State-specific styling with proper contrast ratios
    const stateClasses = {
      default: 'border-border-default focus:border-border-focus',
      error: 'border-error-500 focus:border-error-500 focus:ring-error-500',
      success: 'border-success-500 focus:border-success-500 focus:ring-success-500',
      warning: 'border-warning-500 focus:border-warning-500 focus:ring-warning-500',
    };

    // Container styling for icons
    const hasLeftIcon = leftIcon || isLoading;
    const hasRightIcon = rightIcon;

    const iconPadding = {
      small: hasLeftIcon ? 'pl-9' : hasRightIcon ? 'pr-9' : '',
      medium: hasLeftIcon ? 'pl-10' : hasRightIcon ? 'pr-10' : '',
      large: hasLeftIcon ? 'pl-12' : hasRightIcon ? 'pr-12' : '',
    };

    // Build aria-describedby
    const describedByIds = [
      description ? descriptionId : '',
      currentMessage ? messageId : '',
      ariaDescribedBy || '',
    ].filter(Boolean).join(' ') || undefined;

    const containerWidth = fullWidth ? 'w-full' : '';

    return (
      <div className={cn('relative', containerWidth)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium text-text-primary mb-2',
              hideLabel && 'sr-only'
            )}
          >
            {label}
            {props.required && (
              <span className="text-error-500 ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        {/* Description */}
        {description && (
          <p
            id={descriptionId}
            className="text-sm text-text-secondary mb-2"
          >
            {description}
          </p>
        )}

        {/* Input container */}
        <div className="relative">
          {/* Left icon */}
          {hasLeftIcon && (
            <div 
              className={cn(
                'absolute left-0 top-0 h-full flex items-center justify-center',
                size === 'small' ? 'w-8' : size === 'medium' ? 'w-10' : 'w-12'
              )}
              aria-hidden="true"
            >
              {isLoading ? <InputSpinner /> : leftIcon}
            </div>
          )}

          {/* Input field */}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled || isLoading}
            className={cn(
              baseInputClasses,
              sizeClasses[size],
              stateClasses[currentState],
              iconPadding[size],
              className
            )}
            aria-invalid={currentState === 'error'}
            aria-describedby={describedByIds}
            {...props}
          />

          {/* Right icon */}
          {hasRightIcon && (
            <div 
              className={cn(
                'absolute right-0 top-0 h-full flex items-center justify-center',
                size === 'small' ? 'w-8' : size === 'medium' ? 'w-10' : 'w-12'
              )}
              aria-hidden="true"
            >
              {rightIcon}
            </div>
          )}
        </div>

        {/* Message (error, success, warning) */}
        {currentMessage && (
          <p
            id={messageId}
            className={cn(
              'mt-2 text-sm',
              currentState === 'error' && 'text-error-600',
              currentState === 'success' && 'text-success-600',
              currentState === 'warning' && 'text-warning-600'
            )}
            role={currentState === 'error' ? 'alert' : undefined}
            aria-live={currentState === 'error' ? 'assertive' : 'polite'}
          >
            {currentMessage}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * Textarea component with similar accessibility features
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  errorMessage?: string;
  successMessage?: string;
  warningMessage?: string;
  isLoading?: boolean;
  fullWidth?: boolean;
  hideLabel?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      description,
      errorMessage,
      successMessage,
      warningMessage,
      isLoading = false,
      fullWidth = false,
      hideLabel = false,
      resize = 'vertical',
      disabled,
      className,
      id: providedId,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const id = useId();
    const textareaId = providedId || id;
    const descriptionId = `${textareaId}-description`;
    const messageId = `${textareaId}-message`;

    const currentMessage = errorMessage || successMessage || warningMessage;
    const currentState = errorMessage ? 'error' : 
                        successMessage ? 'success' : 
                        warningMessage ? 'warning' : 
                        'default';

    const baseTextareaClasses = [
      'block w-full border transition-all duration-150',
      'bg-card-background text-text-primary placeholder-text-tertiary',
      'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-0',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-50',
      'motion-safe:transition-all motion-reduce:transition-none',
      'px-4 py-3 text-base rounded-lg min-h-[80px]',
    ].join(' ');

    const stateClasses = {
      default: 'border-border-default focus:border-border-focus',
      error: 'border-error-500 focus:border-error-500 focus:ring-error-500',
      success: 'border-success-500 focus:border-success-500 focus:ring-success-500',
      warning: 'border-warning-500 focus:border-warning-500 focus:ring-warning-500',
    };

    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize',
    };

    const describedByIds = [
      description ? descriptionId : '',
      currentMessage ? messageId : '',
      ariaDescribedBy || '',
    ].filter(Boolean).join(' ') || undefined;

    const containerWidth = fullWidth ? 'w-full' : '';

    return (
      <div className={cn('relative', containerWidth)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              'block text-sm font-medium text-text-primary mb-2',
              hideLabel && 'sr-only'
            )}
          >
            {label}
            {props.required && (
              <span className="text-error-500 ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        {/* Description */}
        {description && (
          <p
            id={descriptionId}
            className="text-sm text-text-secondary mb-2"
          >
            {description}
          </p>
        )}

        {/* Textarea */}
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled || isLoading}
          className={cn(
            baseTextareaClasses,
            stateClasses[currentState],
            resizeClasses[resize],
            className
          )}
          aria-invalid={currentState === 'error'}
          aria-describedby={describedByIds}
          {...props}
        />

        {/* Message */}
        {currentMessage && (
          <p
            id={messageId}
            className={cn(
              'mt-2 text-sm',
              currentState === 'error' && 'text-error-600',
              currentState === 'success' && 'text-success-600',
              currentState === 'warning' && 'text-warning-600'
            )}
            role={currentState === 'error' ? 'alert' : undefined}
            aria-live={currentState === 'error' ? 'assertive' : 'polite'}
          >
            {currentMessage}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Input;