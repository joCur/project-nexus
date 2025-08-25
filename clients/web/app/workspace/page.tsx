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
 * 1. Onboarding completion check
 * 2. Default workspace ID determination
 * 3. Redirect to /workspace/[workspaceId] route
 * 
 * For now, we use a placeholder workspace ID until user management is implemented
 */
function WorkspaceContent() {
  const router = useRouter();
  const { status: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus();
  const context = useWorkspaceStore((state) => state.context);
  const setCurrentWorkspace = useWorkspaceStore((state) => state.setCurrentWorkspace);
  const isInitialized = useWorkspaceStore((state) => state.isInitialized);

  // Check onboarding status and redirect if needed
  useEffect(() => {
    if (!onboardingLoading && onboardingStatus && !onboardingStatus.isComplete) {
      router.push('/onboarding');
      return;
    }

    // If onboarding is complete, redirect to workspace with default ID
    if (onboardingStatus?.isComplete) {
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
  }, [onboardingLoading, onboardingStatus, router, context.currentWorkspaceId, setCurrentWorkspace, isInitialized]);

  // Show loading while checking onboarding status or redirecting
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