'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Card size variants based on design tokens
 */
export type CardSize = 'small' | 'medium' | 'large' | 'custom';

/**
 * Card variant styling options
 */
export type CardVariant = 'default' | 'outlined' | 'elevated' | 'interactive';

/**
 * Base card component props
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: CardSize;
  variant?: CardVariant;
  padding?: 'none' | 'small' | 'medium' | 'large';
  asChild?: boolean;
  children: React.ReactNode;
}

/**
 * Accessible card component that follows Project Nexus design system
 * 
 * Features:
 * - Semantic HTML structure
 * - Configurable padding and sizing based on design tokens
 * - Multiple visual variants (outlined, elevated, interactive)
 * - Proper focus management for interactive cards
 * - ARIA support for complex card content
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      size = 'medium',
      variant = 'default',
      padding = 'medium',
      className,
      children,
      ...props
    },
    ref
  ) => {
    // Base card styling with design tokens
    const baseClasses = [
      'bg-card-background border border-border-default rounded-xl',
      'transition-all duration-150',
      'motion-safe:transition-all motion-reduce:transition-none',
    ].join(' ');

    // Size-specific classes based on design tokens
    const sizeClasses = {
      small: 'min-w-[200px] max-w-[400px] min-h-[120px]',
      medium: 'min-w-[300px] max-w-[600px] min-h-[200px]',
      large: 'min-w-[400px] max-w-[800px] min-h-[300px]',
      custom: '', // Allow custom sizing through className
    };

    // Variant-specific styling
    const variantClasses = {
      default: 'shadow-sm',
      outlined: 'border-2 border-border-default shadow-none',
      elevated: 'shadow-md hover:shadow-lg',
      interactive: [
        'shadow-sm hover:shadow-md cursor-pointer',
        'hover:border-primary-200 focus-within:border-primary-500',
        'focus-within:ring-2 focus-within:ring-border-focus focus-within:ring-offset-2',
      ].join(' '),
    };

    // Padding variants
    const paddingClasses = {
      none: 'p-0',
      small: 'p-3',
      medium: 'p-4',
      large: 'p-6',
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          sizeClasses[size],
          variantClasses[variant],
          paddingClasses[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * Card header component for consistent card structure
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mb-4 last:mb-0', className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

/**
 * Card title component with proper heading semantics
 */
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ level = 3, className, children, ...props }, ref) => {
    const Heading = `h${level}` as const;
    
    const headingClasses = {
      1: 'text-3xl font-bold text-text-primary',
      2: 'text-2xl font-bold text-text-primary',
      3: 'text-xl font-semibold text-text-primary',
      4: 'text-lg font-semibold text-text-primary',
      5: 'text-base font-semibold text-text-primary',
      6: 'text-sm font-semibold text-text-primary',
    };

    return (
      <Heading
        ref={ref as any}
        className={cn(headingClasses[level], 'mb-2 last:mb-0', className)}
        {...props}
      >
        {children}
      </Heading>
    );
  }
);

CardTitle.displayName = 'CardTitle';

/**
 * Card description component
 */
export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-text-secondary leading-relaxed', className)}
      {...props}
    >
      {children}
    </p>
  )
);

CardDescription.displayName = 'CardDescription';

/**
 * Card content component for main content area
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-text-primary', className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

/**
 * Card footer component for actions and additional content
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  justify?: 'start' | 'center' | 'end' | 'between';
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ justify = 'end', className, children, ...props }, ref) => {
    const justifyClasses = {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-2 mt-4 first:mt-0',
          justifyClasses[justify],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

/**
 * Interactive card component for clickable cards
 */
export interface InteractiveCardProps extends Omit<CardProps, 'variant'> {
  onClick?: () => void;
  href?: string;
  external?: boolean;
  'aria-label'?: string;
}

export const InteractiveCard = React.forwardRef<HTMLDivElement, InteractiveCardProps>(
  (
    {
      onClick,
      href,
      external = false,
      children,
      className,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const handleClick = () => {
      if (href) {
        if (external) {
          window.open(href, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = href;
        }
      } else if (onClick) {
        onClick();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <Card
        ref={ref}
        variant="interactive"
        className={cn('focus:outline-none', className)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role={href ? 'link' : 'button'}
        aria-label={ariaLabel}
        {...props}
      >
        {children}
        {external && href && (
          <span className="sr-only">, opens in new window</span>
        )}
      </Card>
    );
  }
);

InteractiveCard.displayName = 'InteractiveCard';

/**
 * Card with loading state
 */
export interface LoadingCardProps extends Omit<CardProps, 'children'> {
  isLoading: boolean;
  children?: React.ReactNode;
  loadingText?: string;
}

export const LoadingCard = React.forwardRef<HTMLDivElement, LoadingCardProps>(
  (
    {
      isLoading,
      children,
      loadingText = 'Loading...',
      className,
      ...props
    },
    ref
  ) => {
    if (isLoading) {
      return (
        <Card
          ref={ref}
          className={cn('flex items-center justify-center min-h-[120px]', className)}
          {...props}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"
              role="status"
              aria-label="Loading"
            />
            <p className="text-sm text-text-secondary">
              {loadingText}
            </p>
            <span className="sr-only">Content is loading, please wait</span>
          </div>
        </Card>
      );
    }

    return (
      <Card ref={ref} className={className} {...props}>
        {children}
      </Card>
    );
  }
);

LoadingCard.displayName = 'LoadingCard';

export default Card;