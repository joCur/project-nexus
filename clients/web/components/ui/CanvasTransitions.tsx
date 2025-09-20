/**
 * Canvas Transitions and UX Components (NEX-177)
 * 
 * React components for smooth transitions and UX improvements including:
 * - Canvas switching transitions
 * - Loading states with animations
 * - Feedback components
 * - Progress indicators
 * - Notification system
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/solid';

// Canvas switching transition overlay
interface CanvasSwitchOverlayProps {
  isVisible: boolean;
  fromCanvas?: string;
  toCanvas?: string;
  progress?: number;
}

export const CanvasSwitchOverlay: React.FC<CanvasSwitchOverlayProps> = ({
  isVisible,
  fromCanvas,
  toCanvas,
  progress = 0,
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="canvas-transition-overlay"
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ 
            opacity: 1, 
            backdropFilter: 'blur(8px)',
            transition: { duration: 0.2, ease: 'easeOut' }
          }}
          exit={{ 
            opacity: 0, 
            backdropFilter: 'blur(0px)',
            transition: { duration: 0.3, ease: 'easeIn' }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.8))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <motion.div
            className="canvas-switch-indicator"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'center',
            }}
          >
            <motion.div
              className="canvas-switch-spinner"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #3b82f6',
                borderRadius: '50%',
              }}
            />
            
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
              }}
            >
              {fromCanvas && toCanvas ? (
                <>
                  Switching from <strong>{fromCanvas}</strong> to <strong>{toCanvas}</strong>
                </>
              ) : (
                'Switching canvas...'
              )}
            </motion.div>

            {progress > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                style={{
                  height: '3px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '2px',
                  width: '120px',
                  maxWidth: '100%',
                }}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Enhanced loading skeleton component
interface LoadingSkeletonProps {
  variant?: 'canvas' | 'card' | 'list' | 'text';
  lines?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'text',
  lines = 3,
  className = '',
}) => {
  const skeletonVariants = {
    canvas: (
      <div className={`canvas-loading-skeleton ${className}`} style={{ height: '400px', borderRadius: '8px' }}>
        <div className="p-6 space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    ),
    card: (
      <div className={`canvas-loading-skeleton ${className}`} style={{ height: '120px', borderRadius: '6px' }}>
        <div className="p-4 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          <div className="h-2 bg-gray-200 rounded w-1/2"></div>
          <div className="h-2 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    ),
    list: (
      <div className={`space-y-3 ${className}`}>
        {[...Array(lines)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full canvas-loading-skeleton"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-3/4 canvas-loading-skeleton"></div>
              <div className="h-2 bg-gray-200 rounded w-1/2 canvas-loading-skeleton"></div>
            </div>
          </div>
        ))}
      </div>
    ),
    text: (
      <div className={`space-y-2 ${className}`}>
        {[...Array(lines)].map((_, i) => (
          <div
            key={i}
            className="h-4 bg-gray-200 rounded canvas-loading-skeleton"
            style={{ width: `${Math.random() * 40 + 60}%` }}
          ></div>
        ))}
      </div>
    ),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {skeletonVariants[variant]}
    </motion.div>
  );
};

// Animated progress indicator
interface ProgressIndicatorProps {
  progress: number;
  label?: string;
  variant?: 'linear' | 'circular';
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  label,
  variant = 'linear',
  size = 'md',
}) => {
  const progressValue = useSpring(progress, { stiffness: 100, damping: 30 });
  const circumference = 2 * Math.PI * 45; // radius = 45
  const offset = useTransform(progressValue, [0, 100], [circumference, 0]);
  const widthValue = useTransform(progressValue, value => `${value}%`);

  if (variant === 'circular') {
    const sizeClasses = {
      sm: 'w-8 h-8',
      md: 'w-12 h-12',
      lg: 'w-16 h-16',
    };

    return (
      <div className={`relative ${sizeClasses[size]}`}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-blue-500"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium">{Math.round(progress)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{label}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div className="canvas-progress-bar">
        <motion.div
          className="canvas-progress-fill"
          style={{ width: widthValue }}
        />
      </div>
    </div>
  );
};

// Feedback notification system
interface NotificationProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

export const Notification: React.FC<NotificationProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onDismiss,
}) => {
  const [isExiting, setIsExiting] = useState(false);

  const icons = {
    success: CheckCircleIcon,
    error: ExclamationTriangleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon,
  };

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconColors = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  const Icon = icons[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(id), 200);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, id, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 200);
  };

  return (
    <motion.div
      className={`canvas-notification ${isExiting ? 'exiting' : ''}`}
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      layout
    >
      <div className={`p-4 rounded-lg border shadow-sm ${colors[type]}`}>
        <div className="flex items-start">
          <Icon className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${iconColors[type]}`} />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{title}</p>
            {message && <p className="mt-1 text-sm opacity-90">{message}</p>}
          </div>
          <button
            onClick={handleDismiss}
            className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Notification container
export const NotificationContainer: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { ...notification, id, onDismiss: removeNotification }]);
  }, [removeNotification]);

  // Expose methods globally for easy access
  useEffect(() => {
    (window as any).showNotification = addNotification;
    return () => {
      if ((window as any).showNotification === addNotification) {
        delete (window as any).showNotification;
      }
    };
  }, [addNotification]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {notifications.map(notification => (
          <Notification key={notification.id} {...notification} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Canvas content fade transition
interface CanvasContentTransitionProps {
  children: React.ReactNode;
  isLoading?: boolean;
  isSwitching?: boolean;
}

export const CanvasContentTransition: React.FC<CanvasContentTransitionProps> = ({
  children,
  isLoading = false,
  isSwitching = false,
}) => {
  return (
    <motion.div
      className="canvas-content"
      animate={{
        opacity: isLoading || isSwitching ? 0.6 : 1,
        filter: isLoading || isSwitching ? 'blur(2px)' : 'blur(0px)',
        scale: isSwitching ? 0.98 : 1,
      }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

// Enhanced tooltip with animations
interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export const AnimatedTooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 500,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`canvas-tooltip absolute z-50 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap pointer-events-none ${positionClasses[position]}`}
            initial={{ opacity: 0, y: position === 'top' ? 4 : position === 'bottom' ? -4 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: position === 'top' ? 4 : position === 'bottom' ? -4 : 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {content}
            <div
              className={`absolute w-0 h-0 ${
                position === 'top'
                  ? 'top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800'
                  : position === 'bottom'
                  ? 'bottom-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-800'
                  : position === 'left'
                  ? 'left-full top-1/2 transform -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-800'
                  : 'right-full top-1/2 transform -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-800'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Canvas action button with enhanced feedback
interface CanvasActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const CanvasActionButton: React.FC<CanvasActionButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const baseClasses = 'canvas-action-button relative inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <motion.button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98, y: 0 }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center"
          >
            <motion.div
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            Loading...
          </motion.div>
        ) : (
          <motion.span
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
      
      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0"
        animate={{
          x: isPressed ? 0 : '-100%',
          opacity: isPressed ? 0.1 : 0,
        }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ clipPath: 'inset(0)' }}
      />
    </motion.button>
  );
};

const canvasTransitionComponents = {
  CanvasSwitchOverlay,
  LoadingSkeleton,
  ProgressIndicator,
  Notification,
  NotificationContainer,
  CanvasContentTransition,
  AnimatedTooltip,
  CanvasActionButton,
};

export default canvasTransitionComponents;