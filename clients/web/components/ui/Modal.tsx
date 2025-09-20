'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn, trapFocus, createFocusRestorer } from '@/lib/utils';

/**
 * Modal size variants based on design tokens
 */
export type ModalSize = 'small' | 'medium' | 'large' | 'fullscreen';

/**
 * Modal animation variants
 */
export type ModalAnimation = 'fade' | 'slide' | 'scale';

/**
 * Modal component props
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  animation?: ModalAnimation;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  initialFocus?: React.RefObject<HTMLElement>;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/**
 * Close button component
 */
const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'absolute top-4 right-4 p-2 rounded-lg',
      'text-text-tertiary hover:text-text-primary',
      'hover:bg-neutral-100 focus:bg-neutral-100',
      'focus:outline-none focus:ring-2 focus:ring-border-focus',
      'transition-all duration-150',
      'motion-safe:transition-all motion-reduce:transition-none'
    )}
    aria-label="Close modal"
  >
    <svg
      className="w-5 h-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  </button>
);

/**
 * Accessible modal component that follows Project Nexus design system
 * 
 * Features:
 * - Full WCAG 2.1 AA compliance
 * - Focus management and keyboard navigation
 * - Proper ARIA attributes and screen reader support
 * - Portal rendering for proper z-index handling
 * - Customizable sizes and animations
 * - Escape key and overlay click handling
 * - Focus trapping within modal
 * - Focus restoration when closed
 * - Prevents body scroll when open
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'medium',
  animation = 'fade',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  children,
  className,
  overlayClassName,
  contentClassName,
  initialFocus,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const focusRestorerRef = useRef(createFocusRestorer());

  // Size-specific classes based on design tokens
  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
    fullscreen: 'max-w-none w-full h-full m-0 rounded-none',
  };

  // Animation classes
  const animationClasses = {
    fade: {
      overlay: 'transition-opacity duration-300',
      content: 'transition-opacity duration-300',
      enter: 'opacity-100',
      exit: 'opacity-0',
    },
    slide: {
      overlay: 'transition-opacity duration-300',
      content: 'transition-all duration-300 transform',
      enter: 'opacity-100 translate-y-0',
      exit: 'opacity-0 translate-y-4',
    },
    scale: {
      overlay: 'transition-opacity duration-300',
      content: 'transition-all duration-300 transform',
      enter: 'opacity-100 scale-100',
      exit: 'opacity-0 scale-95',
    },
  };

  // Handle escape key
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (closeOnOverlayClick && event.target === overlayRef.current) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  // Track if this is the initial opening to prevent refocusing on re-renders
  const hasInitializedRef = useRef(false);

  // Effects for modal behavior
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Only do initial setup once when modal opens
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      
      // Save current focus
      focusRestorerRef.current.save();

      // Focus initial element or specific element first
      const focusTarget = initialFocus?.current;
      if (focusTarget) {
        // Use setTimeout to ensure the element is rendered and focusable
        setTimeout(() => {
          if (focusTarget && isOpen) {
            focusTarget.focus();
          }
        }, 0);
      }
    }

    // Set up focus trapping
    let cleanupFocusTrap: (() => void) | undefined;
    if (modalRef.current) {
      cleanupFocusTrap = trapFocus(modalRef.current, false); // Don't auto-focus in trap
    }

    // Add escape key listener
    document.addEventListener('keydown', handleEscape);

    return () => {
      // Restore body scroll
      document.body.style.overflow = originalOverflow;
      
      // Remove escape key listener
      document.removeEventListener('keydown', handleEscape);
      
      // Cleanup focus trap
      if (cleanupFocusTrap) {
        cleanupFocusTrap();
      }
      
      // Restore focus only when modal is closing
      if (!isOpen) {
        focusRestorerRef.current.restore();
      }
    };
  }, [isOpen, handleEscape]);

  // Don't render if not open
  if (!isOpen) return null;

  const modal = (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black bg-opacity-50 backdrop-blur-sm',
        animationClasses[animation].overlay,
        isOpen ? animationClasses[animation].enter : animationClasses[animation].exit,
        overlayClassName
      )}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={cn(
          'relative w-full bg-card-background rounded-xl shadow-xl',
          'max-h-[calc(100vh-2rem)] overflow-y-auto',
          sizeClasses[size],
          animationClasses[animation].content,
          isOpen ? animationClasses[animation].enter : animationClasses[animation].exit,
          contentClassName
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy || (title ? 'modal-title' : undefined)}
        aria-describedby={ariaDescribedBy || (description ? 'modal-description' : undefined)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        {showCloseButton && <CloseButton onClick={onClose} />}

        {/* Modal content */}
        <div className={cn('p-6', showCloseButton && 'pr-12', className)}>
          {/* Title */}
          {title && (
            <ModalHeader>
              <ModalTitle id="modal-title">{title}</ModalTitle>
              {description && (
                <ModalDescription id="modal-description">
                  {description}
                </ModalDescription>
              )}
            </ModalHeader>
          )}

          {/* Main content */}
          {children}
        </div>
      </div>
    </div>
  );

  // Render modal in portal
  return createPortal(modal, document.body);
};

/**
 * Modal header component
 */
export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ 
  className, 
  children, 
  ...props 
}) => (
  <div
    className={cn('mb-6', className)}
    {...props}
  >
    {children}
  </div>
);

/**
 * Modal title component
 */
export interface ModalTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

export const ModalTitle: React.FC<ModalTitleProps> = ({ 
  level = 2, 
  className, 
  children, 
  ...props 
}) => {
  const Heading = `h${level}` as const;
  
  return (
    <Heading
      className={cn('text-xl font-semibold text-text-primary mb-2', className)}
      {...props}
    >
      {children}
    </Heading>
  );
};

/**
 * Modal description component
 */
export interface ModalDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const ModalDescription: React.FC<ModalDescriptionProps> = ({ 
  className, 
  children, 
  ...props 
}) => (
  <p
    className={cn('text-sm text-text-secondary leading-relaxed', className)}
    {...props}
  >
    {children}
  </p>
);

/**
 * Modal content component
 */
export interface ModalContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ModalContent: React.FC<ModalContentProps> = ({ 
  className, 
  children, 
  ...props 
}) => (
  <div
    className={cn('text-text-primary', className)}
    {...props}
  >
    {children}
  </div>
);

/**
 * Modal footer component
 */
export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  justify?: 'start' | 'center' | 'end' | 'between';
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ 
  justify = 'end',
  className, 
  children, 
  ...props 
}) => {
  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 mt-6 pt-6 border-t border-border-default',
        justifyClasses[justify],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * Confirmation modal component for common use cases
 */
export interface ConfirmationModalProps extends Omit<ModalProps, 'children'> {
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  isConfirming?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  onConfirm,
  onClose,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isConfirming = false,
  ...modalProps
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      {...modalProps}
      onClose={onClose}
      size="small"
    >
      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg',
            'text-text-secondary bg-transparent border border-border-default',
            'hover:bg-neutral-50 focus:bg-neutral-50',
            'focus:outline-none focus:ring-2 focus:ring-border-focus',
            'transition-all duration-150'
          )}
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isConfirming}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            'transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            variant === 'danger' ? [
              'bg-error-500 text-white',
              'hover:bg-error-600 focus:ring-error-500',
            ].join(' ') : [
              'bg-primary-500 text-white',
              'hover:bg-primary-600 focus:ring-primary-500',
            ].join(' ')
          )}
        >
          {isConfirming ? 'Confirming...' : confirmText}
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default Modal;