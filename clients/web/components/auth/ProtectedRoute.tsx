'use client';

import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import { useAuth, ExtendedUserProfile, Permissions, Roles } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { announceToScreenReader } from '@/lib/utils';

/**
 * Props for ProtectedRoute component
 */
export interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  
  // Permission-based access control
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAllPermissions?: boolean; // If true, user must have ALL permissions (default: false - any permission)
  requireAllRoles?: boolean; // If true, user must have ALL roles (default: false - any role)
  
  // Custom authorization function
  authorize?: (user: ExtendedUserProfile) => boolean;
  
  // Redirect configuration
  redirectTo?: string;
  onUnauthorized?: () => void;
}

/**
 * Loading component for authentication state with accessibility features
 */
function AuthLoadingSpinner() {
  useEffect(() => {
    announceToScreenReader('Authentication in progress, please wait', 'polite');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas-base">
      <Card size="medium" className="text-center">
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            <div 
              className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"
              role="status"
              aria-label="Authentication in progress"
            />
            <div>
              <p className="text-base font-medium text-text-primary mb-2">
                Authenticating...
              </p>
              <p className="text-sm text-text-secondary">
                Verifying your credentials and loading your workspace
              </p>
            </div>
            <span className="sr-only">
              Authentication is in progress. Please wait while we verify your credentials and prepare your workspace.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Error component for authentication failures with accessibility features
 */
function AuthError({ error }: { error: Error }) {
  useEffect(() => {
    announceToScreenReader(`Authentication error: ${error.message}`, 'assertive');
  }, [error.message]);

  const handleRetry = () => {
    announceToScreenReader('Redirecting to login page', 'polite');
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas-base p-4">
      <Card size="medium" className="w-full max-w-md">
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <svg
                className="h-6 w-6 text-error-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                Authentication Error
              </h2>
              <div 
                className="text-sm text-text-secondary mb-4"
                role="alert"
                aria-live="assertive"
              >
                <p>{error.message}</p>
                <p className="mt-2 text-xs">
                  If this problem persists, please contact support or try refreshing the page.
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={handleRetry}
                  variant="primary"
                  size="medium"
                  aria-describedby="retry-description"
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="medium"
                  aria-describedby="refresh-description"
                >
                  Refresh Page
                </Button>
              </div>
              <div className="sr-only">
                <p id="retry-description">
                  Click to retry authentication by redirecting to the login page
                </p>
                <p id="refresh-description">
                  Click to refresh the current page and retry authentication
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Unauthorized access component with accessibility features
 */
function UnauthorizedAccess({ 
  requiredPermissions, 
  requiredRoles,
  onRetry 
}: {
  requiredPermissions?: string[];
  requiredRoles?: string[];
  onRetry?: () => void;
}) {
  useEffect(() => {
    announceToScreenReader('Access denied. You do not have sufficient permissions to view this content.', 'assertive');
  }, []);

  const handleGoToWorkspace = () => {
    announceToScreenReader('Redirecting to workspace', 'polite');
    window.location.href = '/workspace';
  };

  const handleRetry = () => {
    if (onRetry) {
      announceToScreenReader('Retrying authorization check', 'polite');
      onRetry();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas-base p-4">
      <Card size="medium" className="w-full max-w-md">
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <svg
                className="h-6 w-6 text-warning-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-9a2 2 0 00-2-2H6a2 2 0 00-2 2v9a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                Insufficient Permissions
              </h2>
              <div 
                className="text-sm text-text-secondary mb-4"
                role="alert"
                aria-live="assertive"
              >
                <p className="mb-3">
                  You don't have permission to access this resource. Please contact your administrator if you believe this is an error.
                </p>
                
                {requiredPermissions && requiredPermissions.length > 0 && (
                  <div className="mb-3">
                    <p className="font-medium text-text-primary mb-1">Required permissions:</p>
                    <ul className="list-disc list-inside text-xs space-y-1" aria-label="Required permissions list">
                      {requiredPermissions.map((permission) => (
                        <li key={permission}>
                          {permission}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {requiredRoles && requiredRoles.length > 0 && (
                  <div className="mb-3">
                    <p className="font-medium text-text-primary mb-1">Required roles:</p>
                    <ul className="list-disc list-inside text-xs space-y-1" aria-label="Required roles list">
                      {requiredRoles.map((role) => (
                        <li key={role}>
                          {role}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleGoToWorkspace}
                  variant="primary"
                  size="medium"
                  aria-describedby="workspace-description"
                >
                  Go to Workspace
                </Button>
                {onRetry && (
                  <Button
                    onClick={handleRetry}
                    variant="outline"
                    size="medium"
                    aria-describedby="retry-auth-description"
                  >
                    Retry
                  </Button>
                )}
              </div>
              
              <div className="sr-only">
                <p id="workspace-description">
                  Navigate to your main workspace where you have access
                </p>
                {onRetry && (
                  <p id="retry-auth-description">
                    Retry the authorization check in case permissions have been updated
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Internal ProtectedRoute component that handles authorization logic
 */
function ProtectedRouteInternal({
  children,
  fallback,
  requiredPermissions = [],
  requiredRoles = [],
  requireAllPermissions = false,
  requireAllRoles = false,
  authorize,
  redirectTo = '/workspace',
  onUnauthorized,
}: ProtectedRouteProps) {
  const { user, isLoading, error, checkPermission, hasRole } = useAuth();
  const router = useRouter();

  // Check authorization when user state changes
  useEffect(() => {
    if (!isLoading && user) {
      const isAuthorized = checkAuthorization(
        user,
        requiredPermissions,
        requiredRoles,
        requireAllPermissions,
        requireAllRoles,
        authorize,
        checkPermission,
        hasRole
      );

      if (!isAuthorized) {
        if (onUnauthorized) {
          onUnauthorized();
        } else if (redirectTo !== window.location.pathname) {
          router.push(redirectTo as any);
        }
      }
    }
  }, [
    user,
    isLoading,
    requiredPermissions,
    requiredRoles,
    requireAllPermissions,
    requireAllRoles,
    authorize,
    redirectTo,
    onUnauthorized,
    router,
    checkPermission,
    hasRole,
  ]);

  // Show loading state
  if (isLoading) {
    return fallback || <AuthLoadingSpinner />;
  }

  // Show error state
  if (error) {
    return <AuthError error={error} />;
  }

  // Check if user is authenticated
  if (!user) {
    return <AuthLoadingSpinner />;
  }

  // Check authorization
  const isAuthorized = checkAuthorization(
    user,
    requiredPermissions,
    requiredRoles,
    requireAllPermissions,
    requireAllRoles,
    authorize,
    checkPermission,
    hasRole
  );

  if (!isAuthorized) {
    return (
      <UnauthorizedAccess
        requiredPermissions={requiredPermissions}
        requiredRoles={requiredRoles}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Render protected content
  return <>{children}</>;
}

/**
 * Authorization checking logic
 */
function checkAuthorization(
  user: ExtendedUserProfile,
  requiredPermissions: string[],
  requiredRoles: string[],
  requireAllPermissions: boolean,
  requireAllRoles: boolean,
  authorize: ((user: ExtendedUserProfile) => boolean) | undefined,
  checkPermission: (permission: string) => boolean,
  hasRole: (role: string) => boolean
): boolean {
  // Custom authorization function takes precedence
  if (authorize) {
    return authorize(user);
  }

  // Check required permissions
  if (requiredPermissions.length > 0) {
    const permissionCheck = requireAllPermissions
      ? requiredPermissions.every(permission => checkPermission(permission))
      : requiredPermissions.some(permission => checkPermission(permission));

    if (!permissionCheck) {
      return false;
    }
  }

  // Check required roles
  if (requiredRoles.length > 0) {
    const roleCheck = requireAllRoles
      ? requiredRoles.every(role => hasRole(role))
      : requiredRoles.some(role => hasRole(role));

    if (!roleCheck) {
      return false;
    }
  }

  return true;
}

/**
 * ProtectedRoute component that wraps Auth0's withPageAuthRequired
 * 
 * This component provides:
 * - Automatic authentication requirement
 * - Permission-based access control
 * - Role-based access control
 * - Custom authorization logic
 * - Proper loading and error states
 * - Configurable redirect behavior
 * 
 * Usage:
 * ```tsx
 * <ProtectedRoute requiredPermissions={[Permissions.READ_CARDS]}>
 *   <CardsPage />
 * </ProtectedRoute>
 * ```
 */
export const ProtectedRoute = withPageAuthRequired(ProtectedRouteInternal, {
  onRedirecting: () => <AuthLoadingSpinner />,
  onError: (error) => <AuthError error={error} />,
});

/**
 * Higher-order component for protecting pages with authentication
 */
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: Omit<ProtectedRouteProps, 'children'> = {}
) {
  const AuthenticatedComponent = (props: P) => {
    return (
      <ProtectedRoute {...options}>
        <WrappedComponent {...props} />
      </ProtectedRoute>
    );
  };

  AuthenticatedComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;

  return AuthenticatedComponent;
}

/**
 * Convenience components for common protection patterns
 */

// Protect routes that require admin permissions
export function AdminRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute
      requiredRoles={[Roles.ADMIN, Roles.SUPER_ADMIN]}
      requireAllRoles={false}
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
}

// Protect routes that require premium features
export function PremiumRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute
      requiredRoles={[Roles.PREMIUM, Roles.ADMIN, Roles.SUPER_ADMIN]}
      requireAllRoles={false}
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
}

// Protect workspace-related routes
export function WorkspaceRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredPermissions'>) {
  return (
    <ProtectedRoute
      requiredPermissions={[Permissions.READ_WORKSPACES]}
      redirectTo="/workspace"
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
}