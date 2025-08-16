'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Button size variants based on design tokens
 */
export type ButtonSize = 'small' | 'medium' | 'large';

/**
 * Button color variants for different states and purposes
 */
export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'outline' 
  | 'ghost' 
  | 'link';

/**
 * Button component props extending native button attributes
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

/**
 * Loading spinner component for button loading states
 */
const LoadingSpinner = ({ size = 'medium' }: { size?: ButtonSize }) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6',
  };

  return (
    <svg
      className={cn('animate-spin', sizeClasses[size])}
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
};

/**
 * Accessible button component that follows Project Nexus design system
 * 
 * Features:
 * - Full WCAG 2.1 AA compliance
 * - Proper focus management and keyboard navigation
 * - Loading states with screen reader announcements
 * - Multiple size and color variants
 * - Touch-friendly minimum target sizes (44px)
 * - Proper ARIA attributes and semantic markup
 * - Motion preferences support
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'medium',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseClasses = [
      // Base styling
      'inline-flex items-center justify-center',
      'font-medium rounded-lg transition-all duration-150',
      'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      'select-none',
      // Accessibility: ensure minimum touch target size
      'min-h-touch min-w-touch',
      // Motion preferences
      'motion-safe:transition-all motion-reduce:transition-none',
    ].join(' ');

    // Size-specific classes based on design tokens
    const sizeClasses = {
      small: 'h-8 px-4 text-sm gap-2', // 32px height
      medium: 'h-10 px-5 text-base gap-2', // 40px height  
      large: 'h-12 px-7 text-lg gap-3', // 48px height
    };

    // Variant-specific classes with proper contrast ratios
    const variantClasses = {
      primary: [
        'bg-primary-500 text-white',
        'hover:bg-primary-600 active:bg-primary-700',
        'shadow-sm hover:shadow-md',
      ].join(' '),
      secondary: [
        'bg-secondary-500 text-white',
        'hover:bg-secondary-600 active:bg-secondary-700',
        'shadow-sm hover:shadow-md',
      ].join(' '),
      success: [
        'bg-success-500 text-white',
        'hover:bg-success-600 active:bg-success-700',
        'shadow-sm hover:shadow-md',
      ].join(' '),
      warning: [
        'bg-warning-500 text-white',
        'hover:bg-warning-600 active:bg-warning-700',
        'shadow-sm hover:shadow-md',
      ].join(' '),
      error: [
        'bg-error-500 text-white',
        'hover:bg-error-600 active:bg-error-700',
        'shadow-sm hover:shadow-md',
      ].join(' '),
      outline: [
        'border-2 border-border-default text-text-primary bg-transparent',
        'hover:bg-neutral-50 hover:border-primary-500',
        'active:bg-neutral-100',
      ].join(' '),
      ghost: [
        'text-text-primary bg-transparent',
        'hover:bg-neutral-100 active:bg-neutral-200',
      ].join(' '),
      link: [
        'text-primary-500 bg-transparent p-0 h-auto min-h-0 min-w-0',
        'hover:text-primary-600 hover:underline',
        'active:text-primary-700',
        'focus:ring-1 focus:ring-offset-1',
      ].join(' '),
    };

    const fullWidthClass = fullWidth ? 'w-full' : '';

    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          baseClasses,
          sizeClasses[size],
          variantClasses[variant],
          fullWidthClass,
          className
        )}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        {...props}
      >
        {/* Loading state */}
        {isLoading && (
          <>
            <LoadingSpinner size={size} />
            <span className="sr-only">
              {loadingText || 'Loading, please wait'}
            </span>
          </>
        )}

        {/* Left icon */}
        {!isLoading && leftIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Button content */}
        <span className={isLoading ? 'opacity-70' : undefined}>
          {children}
        </span>

        {/* Right icon */}
        {!isLoading && rightIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * IconButton component for actions with just an icon
 */
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> {
  icon: React.ReactNode;
  'aria-label': string; // Required for accessibility
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, variant = 'ghost', size = 'medium', className, ...props }, ref) => {
    const sizeClasses = {
      small: 'w-8 h-8',
      medium: 'w-10 h-10', 
      large: 'w-12 h-12',
    };

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn('!p-0', sizeClasses[size], className)}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';

/**
 * Button group component for related actions
 */
export interface ButtonGroupProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'none' | 'small' | 'medium';
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  orientation = 'horizontal',
  spacing = 'small',
  className,
}) => {
  const orientationClasses = {
    horizontal: 'flex-row',
    vertical: 'flex-col',
  };

  const spacingClasses = {
    none: 'gap-0',
    small: 'gap-2',
    medium: 'gap-4',
  };

  return (
    <div
      className={cn(
        'flex',
        orientationClasses[orientation],
        spacingClasses[spacing],
        className
      )}
      role="group"
    >
      {children}
    </div>
  );
};

export default Button;