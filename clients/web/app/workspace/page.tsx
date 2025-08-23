'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/use-auth';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';

function WorkspaceContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { status: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus();
  const [showDebug, setShowDebug] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  // Check onboarding status and redirect if needed
  useEffect(() => {
    if (!onboardingLoading && onboardingStatus && !onboardingStatus.isComplete) {
      // Redirect to onboarding if not completed
      router.push('/onboarding');
    }
  }, [onboardingLoading, onboardingStatus, router]);

  // Show loading while checking onboarding status
  if (onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Don't render workspace content if onboarding is not complete
  if (!onboardingStatus?.isComplete) {
    return null; // The useEffect will handle redirection
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex-none bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-900">Project Nexus</h1>
              <div className="text-sm text-gray-500">Knowledge Workspace</div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Debug Toggle */}
              <button
                onClick={() => setShowDebug(!showDebug)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  showDebug 
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="Toggle debug information"
              >
                {showDebug ? 'Hide Debug' : 'Show Debug'}
              </button>
              
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
          debug={showDebug}
          ariaLabel="Interactive knowledge workspace canvas"
          ariaDescription="Navigate with arrow keys to pan, plus and minus keys to zoom, space to center view"
          viewportCulling={{
            enabled: true,
            bufferZone: 400,
            maxEntities: 500,
            enableLevelOfDetail: true,
          }}
          performanceOptimization={{
            enablePerformanceMonitoring: true,
            enableAdaptiveQuality: true,
            targetFPS: 60,
          }}
        />
        
        {/* Welcome Overlay for First-Time Users */}
        {showWelcome && (
          <div className={`absolute bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-sm transition-all duration-300 ${
            showDebug 
              ? 'top-4 right-4' // Move to right when debug is active
              : 'top-4 left-4'   // Default position when debug is off
          }`}>
            <button
              onClick={() => setShowWelcome(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Dismiss welcome message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <h2 className="text-lg font-semibold text-gray-900 mb-2 pr-6">
              Welcome to Your Canvas!
            </h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Use mouse wheel or pinch to zoom</p>
              <p>• Click and drag to pan around</p>
              <p>• Arrow keys for keyboard navigation</p>
              <p>• Press Space to center view</p>
              <p>• Try the debug toggle above!</p>
            </div>
          </div>
        )}
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