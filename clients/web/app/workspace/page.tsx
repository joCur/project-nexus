'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/use-auth';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';

function WorkspaceContent() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { 
    status: onboardingStatus, 
    isLoading: onboardingLoading, 
    isInitialLoad,
    error: onboardingError 
  } = useOnboardingStatus();

  // Check onboarding status and redirect if needed
  useEffect(() => {
    // Only redirect after we have a definitive status (not during initial load)
    if (!onboardingLoading && !isInitialLoad && onboardingStatus && !onboardingStatus.isComplete) {
      console.log('Redirecting to onboarding - user has not completed onboarding');
      router.push('/onboarding');
    }
  }, [onboardingLoading, isInitialLoad, onboardingStatus, router]);

  // Show loading while checking onboarding status (only on initial load)
  if (authLoading || (onboardingLoading && isInitialLoad)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <div className="text-sm text-gray-600">
            {authLoading ? 'Authenticating...' : 'Loading workspace...'}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if there's a critical onboarding error and no cached status
  if (onboardingError && !onboardingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-red-600 text-2xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Unable to Load Workspace
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            We&apos;re having trouble connecting to our services. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Don't render workspace content if onboarding is not complete
  // But allow rendering if we have cached status saying it's complete (even with current errors)
  if (onboardingStatus && !onboardingStatus.isComplete) {
    return null; // The useEffect will handle redirection
  }

  // If we have no status but also no initial loading, something went wrong
  if (!onboardingStatus && !isInitialLoad && !onboardingLoading) {
    console.warn('No onboarding status available, redirecting to onboarding');
    router.push('/onboarding');
    return null;
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex-none bg-white shadow-sm border-b border-gray-200">
        {/* Connection Status Banner */}
        {onboardingError && onboardingStatus && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                <span className="text-yellow-800">
                  Connection issues detected, but workspace data is cached locally
                </span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-yellow-800 hover:text-yellow-900 text-xs underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-900">Project Nexus</h1>
              <div className="text-sm text-gray-500">Knowledge Workspace</div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="flex items-center space-x-2">
                {user?.picture && (
                  <img
                    src={user.picture}
                    alt={user.name || user.email}
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700 hidden sm:block">
                  {user?.name || user?.email}
                </span>
              </div>
              
              {/* Logout Button */}
              <button
                onClick={() => logout()}
                className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative">
        <InfiniteCanvas
          className="w-full h-full"
          showGrid={true}
          ariaLabel="Interactive knowledge workspace canvas"
          ariaDescription="Navigate with arrow keys to pan, plus and minus keys to zoom, space to center view"
        />
        
        {/* Welcome Message */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-sm pointer-events-none">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Welcome to Your Canvas!
          </h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Use mouse wheel to zoom</p>
            <p>• Click and drag to pan around</p>
            <p>• Arrow keys for keyboard navigation</p>
            <p>• Press Space to center view</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <ProtectedRoute
      requiredPermissions={['read:workspaces']}
      redirectTo="/workspace"
    >
      <WorkspaceContent />
    </ProtectedRoute>
  );
}