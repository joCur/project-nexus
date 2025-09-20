'use client';

import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/**
 * Error information passed to error boundary
 */
interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

/**
 * Props for the CanvasErrorBoundary component
 */
interface CanvasErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI component */
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  /** Callback when an error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show detailed error information (development mode) */
  showDetails?: boolean;
  /** Custom error message to display */
  errorMessage?: string;
  /** Whether to enable automatic retry functionality */
  enableRetry?: boolean;
  /** Maximum number of automatic retries */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * State for the CanvasErrorBoundary component
 */
interface CanvasErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
}

/**
 * Canvas-specific error types
 */
export enum CanvasErrorType {
  RENDER_ERROR = 'RENDER_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DATA_ERROR = 'DATA_ERROR',
  CANVAS_LOAD_ERROR = 'CANVAS_LOAD_ERROR',
  STATE_ERROR = 'STATE_ERROR',
}

/**
 * Canvas error with additional context
 */
export class CanvasError extends Error {
  public readonly type: CanvasErrorType;
  public readonly context?: Record<string, any>;
  public readonly canvasId?: string;
  public readonly workspaceId?: string;
  public readonly recoverable: boolean;
  public cause?: Error;

  constructor(
    type: CanvasErrorType,
    message: string,
    options: {
      cause?: Error;
      context?: Record<string, any>;
      canvasId?: string;
      workspaceId?: string;
      recoverable?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'CanvasError';
    this.type = type;
    this.context = options.context;
    this.canvasId = options.canvasId;
    this.workspaceId = options.workspaceId;
    this.recoverable = options.recoverable ?? true;

    // Set cause manually since Error constructor in current environment doesn't support options
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Default fallback UI for canvas errors
 */
const DefaultErrorFallback: React.FC<{
  error: Error;
  errorInfo: ErrorInfo;
  retry: () => void;
  showDetails?: boolean;
  errorMessage?: string;
  enableRetry?: boolean;
}> = ({ error, errorInfo, retry, showDetails = false, errorMessage, enableRetry = true }) => {
  const isCanvasError = error instanceof CanvasError;

  let canRetry = enableRetry;
  if (isCanvasError) {
    canRetry = enableRetry && (error as CanvasError).recoverable;
  }

  const getErrorTitle = () => {
    if (isCanvasError) {
      switch ((error as CanvasError).type) {
        case CanvasErrorType.PERMISSION_ERROR:
          return 'Permission Error';
        case CanvasErrorType.NETWORK_ERROR:
          return 'Network Error';
        case CanvasErrorType.DATA_ERROR:
          return 'Data Error';
        case CanvasErrorType.CANVAS_LOAD_ERROR:
          return 'Canvas Load Error';
        case CanvasErrorType.STATE_ERROR:
          return 'State Error';
        default:
          return 'Canvas Error';
      }
    }
    return 'Something went wrong';
  };

  const getErrorMessage = () => {
    if (errorMessage) return errorMessage;

    if (isCanvasError) {
      switch ((error as CanvasError).type) {
        case CanvasErrorType.PERMISSION_ERROR:
          return 'You don\'t have permission to access this canvas. Please contact your workspace administrator.';
        case CanvasErrorType.NETWORK_ERROR:
          return 'Unable to connect to the server. Please check your internet connection and try again.';
        case CanvasErrorType.DATA_ERROR:
          return 'There was a problem loading the canvas data. The canvas may be corrupted or missing.';
        case CanvasErrorType.CANVAS_LOAD_ERROR:
          return 'Failed to load the canvas. This may be due to a temporary issue.';
        case CanvasErrorType.STATE_ERROR:
          return 'The canvas state became invalid. Refreshing may help restore functionality.';
        default:
          return error.message || 'An unexpected error occurred while working with the canvas.';
      }
    }

    return error.message || 'An unexpected error occurred. Please try refreshing the page.';
  };

  const getActionButtons = () => {
    const buttons = [];

    if (canRetry) {
      buttons.push(
        <Button
          key="retry"
          onClick={retry}
          variant="primary"
          className="mr-3"
        >
          Try Again
        </Button>
      );
    }

    if (isCanvasError && (error as CanvasError).type === CanvasErrorType.PERMISSION_ERROR) {
      buttons.push(
        <Button
          key="contact"
          onClick={() => {
            // This would integrate with your contact/support system
            console.log('Contact administrator clicked');
          }}
          variant="outline"
        >
          Contact Administrator
        </Button>
      );
    } else if (isCanvasError && (error as CanvasError).type === CanvasErrorType.NETWORK_ERROR) {
      buttons.push(
        <Button
          key="refresh"
          onClick={() => window.location.reload()}
          variant="outline"
        >
          Refresh Page
        </Button>
      );
    } else {
      buttons.push(
        <Button
          key="home"
          onClick={() => {
            // Navigate to workspace home
            window.location.href = '/workspace';
          }}
          variant="outline"
        >
          Go to Workspace
        </Button>
      );
    }

    return buttons;
  };

  const getIconForErrorType = () => {
    if (isCanvasError) {
      switch ((error as CanvasError).type) {
        case CanvasErrorType.PERMISSION_ERROR:
          return (
            <svg className="w-12 h-12 text-warning-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          );
        case CanvasErrorType.NETWORK_ERROR:
          return (
            <svg className="w-12 h-12 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          );
        default:
          return (
            <svg className="w-12 h-12 text-error-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          );
      }
    }

    return (
      <svg className="w-12 h-12 text-error-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <div className="min-h-96 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          {getIconForErrorType()}
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-4">
          {getErrorTitle()}
        </h1>

        <p className="text-gray-600 mb-8 leading-relaxed">
          {getErrorMessage()}
        </p>

        <div className="flex justify-center items-center flex-wrap gap-3">
          {getActionButtons()}
        </div>

        {showDetails && (
          <details className="mt-8 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Show Error Details
            </summary>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm font-mono text-gray-700 overflow-auto">
              <div className="mb-4">
                <strong>Error:</strong> {error.message}
              </div>
              {error.stack && (
                <div className="mb-4">
                  <strong>Stack Trace:</strong>
                  <pre className="mt-2 whitespace-pre-wrap">{error.stack}</pre>
                </div>
              )}
              {isCanvasError && error.context && (
                <div className="mb-4">
                  <strong>Context:</strong>
                  <pre className="mt-2 whitespace-pre-wrap">
                    {JSON.stringify(error.context, null, 2)}
                  </pre>
                </div>
              )}
              {errorInfo.componentStack && (
                <div>
                  <strong>Component Stack:</strong>
                  <pre className="mt-2 whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

/**
 * Error boundary specifically designed for canvas-related errors
 *
 * Features:
 * - Catches and handles canvas-related errors gracefully
 * - Provides recovery options (retry, switch canvas, refresh)
 * - Clear error messages for common scenarios
 * - Fallback UI when canvas operations fail
 * - Automatic retry with exponential backoff
 * - Error reporting and logging
 * - Development mode detailed error information
 */
export class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: CanvasErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<CanvasErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;

    // Update state with error information
    this.setState({
      errorInfo,
    });

    // Call error callback if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Log error for debugging
    console.error('Canvas Error Boundary caught an error:', error, errorInfo);

    // Report error to monitoring service
    this.reportError(error, errorInfo);

    // Attempt automatic retry for recoverable errors
    this.attemptAutoRetry(error);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    // This would integrate with your error reporting service
    // e.g., Sentry, LogRocket, Bugsnag, etc.
    const errorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      canvasContext: error instanceof CanvasError ? {
        type: error.type,
        canvasId: error.canvasId,
        workspaceId: error.workspaceId,
        recoverable: error.recoverable,
        context: error.context,
      } : null,
    };

    console.log('Error report:', errorReport);
    // TODO: Send to error reporting service
  }

  private attemptAutoRetry(error: Error) {
    const { enableRetry = true, maxRetries = 3, retryDelay = 1000 } = this.props;
    const { retryCount } = this.state;

    // Only auto-retry for recoverable canvas errors
    const isRecoverable = error instanceof CanvasError && error.recoverable;

    if (!enableRetry || !isRecoverable || retryCount >= maxRetries) {
      return;
    }

    // Exponential backoff: delay * (2 ^ retryCount)
    const delay = retryDelay * Math.pow(2, retryCount);

    this.setState({ isRetrying: true });

    this.retryTimeoutId = setTimeout(() => {
      this.handleRetry();
    }, delay);
  }

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      this.setState({ isRetrying: false });
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: retryCount + 1,
      isRetrying: false,
    });
  };

  render() {
    const { hasError, error, errorInfo, isRetrying } = this.state;
    const { children, fallback, showDetails = process.env.NODE_ENV === 'development' } = this.props;

    if (hasError && error && errorInfo) {
      // Show retry loading state
      if (isRetrying) {
        return (
          <div className="min-h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 animate-spin mx-auto mb-4">
                <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
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
              </div>
              <p className="text-gray-600">Retrying...</p>
            </div>
          </div>
        );
      }

      // Show custom fallback or default error UI
      if (fallback) {
        return fallback(error, errorInfo, this.handleRetry);
      }

      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          retry={this.handleRetry}
          showDetails={showDetails}
          errorMessage={this.props.errorMessage}
          enableRetry={this.props.enableRetry}
        />
      );
    }

    return children;
  }
}

/**
 * Hook for throwing canvas errors with proper typing
 */
export const useCanvasError = () => {
  const throwCanvasError = (
    type: CanvasErrorType,
    message: string,
    options?: {
      cause?: Error;
      context?: Record<string, any>;
      canvasId?: string;
      workspaceId?: string;
      recoverable?: boolean;
    }
  ) => {
    throw new CanvasError(type, message, options);
  };

  return { throwCanvasError };
};