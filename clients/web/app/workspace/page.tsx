'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Legacy workspace page - redirects to new workspace structure
 * 
 * This page handles:
 * 1. Onboarding completion check with race condition prevention (NEX-178 fix)
 * 2. Default workspace ID determination
 * 3. Redirect to /workspace/[workspaceId] route
 * 
 * For now, we use a placeholder workspace ID until user management is implemented
 */
function WorkspaceContent() {
  const router = useRouter();
  const { 
    status: onboardingStatus, 
    isLoading: onboardingLoading, 
    isInitialLoad,
    error: onboardingError 
  } = useOnboardingStatus();
  const context = useWorkspaceStore((state) => state.context);
  const setCurrentWorkspace = useWorkspaceStore((state) => state.setCurrentWorkspace);
  const isInitialized = useWorkspaceStore((state) => state.isInitialized);

  // Check onboarding status and redirect if needed
  useEffect(() => {
    // Only redirect after we have a definitive status (not during initial load)
    // This prevents race conditions where users might be redirected incorrectly
    if (!onboardingLoading && !isInitialLoad && onboardingStatus && !onboardingStatus.isComplete) {
      console.log('Redirecting to onboarding - user has not completed onboarding');
      router.push('/onboarding');
      return;
    }

    // If onboarding is complete, redirect to workspace with default ID
    if (!onboardingLoading && !isInitialLoad && onboardingStatus?.isComplete) {
      // Sync workspace ID from onboarding status if not already in store
      let workspaceId = context.currentWorkspaceId;
      
      if (!workspaceId && onboardingStatus.workspace?.id) {
        // Update the store with the workspace info from onboarding status
        workspaceId = onboardingStatus.workspace.id;
        console.log('Syncing workspace ID from onboarding status:', workspaceId);
        setCurrentWorkspace(workspaceId, onboardingStatus.workspace.name);
      }
      
      // Use the stored workspace ID from onboarding if available
      // Otherwise fall back to default-workspace for backwards compatibility
      const defaultWorkspaceId = workspaceId || 'default-workspace';
      
      // Log for debugging workspace mismatch issues
      if (defaultWorkspaceId === 'default-workspace') {
        console.warn('Using fallback default-workspace - user may not have completed onboarding properly');
        console.log('Store state for debugging:', { 
          context, 
          isInitialized, 
          onboardingStatus,
          workspaceFromOnboarding: onboardingStatus.workspace 
        });
      }
      
      router.replace(`/workspace/${defaultWorkspaceId}` as any);
    }
  }, [onboardingLoading, isInitialLoad, onboardingStatus, router, context.currentWorkspaceId, setCurrentWorkspace, isInitialized]);

  // Show loading while checking onboarding status (only on initial load)
  if (onboardingLoading && isInitialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <div className="text-sm text-gray-600">Loading workspace...</div>
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

  // Show connection warning if we have cached data but current errors
  if (onboardingError && onboardingStatus?.isComplete) {
    console.warn('Using cached onboarding status due to connection error:', onboardingError);
    // Continue with redirect using cached data
  }

  // Default loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Setting up workspace...</p>
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