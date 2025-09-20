'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, IconButton } from './Button';

/**
 * Toast notification types for canvas operations
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast notification data structure
 */
export interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number; // Auto-dismiss duration in ms, 0 for manual dismiss only
  dismissible?: boolean;
}

/**
 * Canvas-specific toast notification messages
 */
export const canvasToastMessages = {
  setDefaultSuccess: (canvasName: string) => ({
    type: 'success' as const,
    title: 'Default Canvas Updated',
    message: `"${canvasName}" is now your default canvas`,
    duration: 4000,
  }),
  setDefaultError: (canvasName: string, error?: string) => ({
    type: 'error' as const,
    title: 'Failed to Set Default Canvas',
    message: error || `Could not set "${canvasName}" as default. Please try again.`,
    duration: 6000,
  }),
  multipleDefaultsWarning: (count: number) => ({
    type: 'warning' as const,
    title: 'Multiple Default Canvases Detected',
    message: `${count} canvases are marked as default. Only one canvas should be default.`,
    duration: 8000,
    action: {
      label: 'Fix Now',
      onClick: () => {
        // This will be implemented to resolve the conflict
        console.log('Fixing multiple defaults...');
      },
    },
  }),
  canvasCreatedSuccess: (canvasName: string) => ({
    type: 'success' as const,
    title: 'Canvas Created',
    message: `"${canvasName}" has been created successfully`,
    duration: 3000,
  }),
  canvasDeletedSuccess: (canvasName: string) => ({
    type: 'success' as const,
    title: 'Canvas Deleted',
    message: `"${canvasName}" has been deleted`,
    duration: 3000,
  }),
  canvasDeleteError: (canvasName: string, error?: string) => ({
    type: 'error' as const,
    title: 'Failed to Delete Canvas',
    message: error || `Could not delete "${canvasName}". Please try again.`,
    duration: 6000,
  }),
  permissionError: () => ({
    type: 'error' as const,
    title: 'Permission Denied',
    message: 'You do not have permission to perform this action',
    duration: 5000,
  }),
  networkError: () => ({
    type: 'error' as const,
    title: 'Network Error',
    message: 'Unable to connect to server. Please check your connection.',
    duration: 6000,
    action: {
      label: 'Retry',
      onClick: () => {
        window.location.reload();
      },
    },
  }),
};

/**
 * Props for individual toast component
 */
interface ToastProps {
  notification: ToastNotification;
  onDismiss: (id: string) => void;
  isExiting?: boolean;
}

/**
 * Individual toast notification component
 */
const Toast: React.FC<ToastProps> = ({ notification, onDismiss, isExiting = false }) => {
  const { id, type, title, message, action, dismissible = true } = notification;

  // Auto-dismiss logic
  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [id, notification.duration, onDismiss]);

  const typeStyles = {
    success: {
      container: 'bg-success-50 border-success-200',
      icon: 'text-success-600',
      title: 'text-success-800',
      message: 'text-success-700',
    },
    error: {
      container: 'bg-error-50 border-error-200',
      icon: 'text-error-600',
      title: 'text-error-800',
      message: 'text-error-700',
    },
    warning: {
      container: 'bg-warning-50 border-warning-200',
      icon: 'text-warning-600',
      title: 'text-warning-800',
      message: 'text-warning-700',
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-600',
      title: 'text-blue-800',
      message: 'text-blue-700',
    },
  };

  const styles = typeStyles[type];

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div
      className={cn(
        'max-w-sm w-full border rounded-lg shadow-lg p-4 transition-all duration-300 ease-in-out',
        styles.container,
        isExiting ? 'transform translate-x-full opacity-0' : 'transform translate-x-0 opacity-100'
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="flex items-start">
        <div className={cn('flex-shrink-0', styles.icon)}>
          {getIcon()}
        </div>

        <div className="ml-3 flex-1">
          <h3 className={cn('text-sm font-medium', styles.title)}>
            {title}
          </h3>
          {message && (
            <p className={cn('mt-1 text-sm', styles.message)}>
              {message}
            </p>
          )}
          {action && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="small"
                onClick={action.onClick}
                className="text-xs"
              >
                {action.label}
              </Button>
            </div>
          )}
        </div>

        {dismissible && (
          <div className="ml-4 flex-shrink-0">
            <IconButton
              icon={
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              }
              aria-label="Dismiss notification"
              variant="ghost"
              size="small"
              onClick={() => onDismiss(id)}
              className={cn('!p-1 hover:bg-white/20', styles.icon)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Props for toast container component
 */
interface ToastContainerProps {
  notifications: ToastNotification[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxToasts?: number;
}

/**
 * Container component that manages multiple toast notifications
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({
  notifications,
  onDismiss,
  position = 'top-right',
  maxToasts = 5,
}) => {
  const [exitingToasts, setExitingToasts] = useState<Set<string>>(new Set());

  const handleDismiss = (id: string) => {
    // Start exit animation
    setExitingToasts(prev => new Set(prev.add(id)));

    // Remove after animation completes
    setTimeout(() => {
      onDismiss(id);
      setExitingToasts(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }, 300);
  };

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2',
  };

  // Limit the number of visible toasts
  const visibleNotifications = notifications.slice(0, maxToasts);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed z-50 space-y-3 pointer-events-none',
        positionClasses[position]
      )}
      aria-live="polite"
      aria-label="Notifications"
    >
      {visibleNotifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <Toast
            notification={notification}
            onDismiss={handleDismiss}
            isExiting={exitingToasts.has(notification.id)}
          />
        </div>
      ))}
    </div>
  );
};

/**
 * Hook for managing toast notifications
 */
export const useToast = () => {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const showToast = React.useCallback((notification: Omit<ToastNotification, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: ToastNotification = {
      id,
      dismissible: true,
      duration: 5000,
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);
    return id;
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = React.useCallback(() => {
    setNotifications([]);
  }, []);

  // Canvas-specific convenience methods
  const showCanvasSuccess = React.useCallback((type: keyof typeof canvasToastMessages, ...args: any[]) => {
    const messageConfig = (canvasToastMessages[type] as any)(...args);
    return showToast(messageConfig);
  }, [showToast]);

  const showCanvasError = React.useCallback((type: keyof typeof canvasToastMessages, ...args: any[]) => {
    const messageConfig = (canvasToastMessages[type] as any)(...args);
    return showToast(messageConfig);
  }, [showToast]);

  return {
    notifications,
    showToast,
    dismissToast,
    dismissAll,
    showCanvasSuccess,
    showCanvasError,
  };
};

/**
 * Toast provider component for app-wide toast management
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notifications, dismissToast } = useToast();

  return (
    <>
      {children}
      <ToastContainer
        notifications={notifications}
        onDismiss={dismissToast}
        position="top-right"
      />
    </>
  );
};