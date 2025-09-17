'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { WorkspacePermissionProvider } from '../../../contexts/WorkspacePermissionContext';
import { useParams } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useEffect, useState } from 'react';
import { useContextPermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/hooks/use-auth';
import type { EntityId } from '@/types/common.types';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

/**
 * Component that handles workspace access validation
 */
function WorkspaceAccessValidator({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const workspaceId = params.workspaceId as EntityId;
  const { user } = useAuth();
  const { setCurrentWorkspace } = useWorkspaceStore();
  const context = useWorkspaceStore((state) => state.context);
  const [hasCheckedAccess, setHasCheckedAccess] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const {
    permissionsByWorkspace,
    loading: permissionsLoading,
    error: permissionsError,
    refetch
  } = useContextPermissions({
    enabled: !!user?.sub,
    errorPolicy: 'secure-by-default',
  });

  useEffect(() => {
    if (workspaceId && context.currentWorkspaceId !== workspaceId) {
      // Set current workspace context immediately when layout loads
      setCurrentWorkspace(workspaceId, `Workspace ${workspaceId}`);
    }
  }, [workspaceId, context.currentWorkspaceId, setCurrentWorkspace]);

  // Check workspace access once permissions are loaded
  useEffect(() => {
    if (!permissionsLoading && permissionsByWorkspace && workspaceId && !hasCheckedAccess) {
      const workspacePermissions = permissionsByWorkspace[workspaceId];
      const hasWorkspaceRead = workspacePermissions && workspacePermissions.includes('workspace:read');
      const totalWorkspaces = Object.keys(permissionsByWorkspace).length;

      // If user has access to the requested workspace, allow access
      if (hasWorkspaceRead) {
        setHasCheckedAccess(true);
        return;
      }

      // Special handling for potential onboarding scenario
      // If no workspaces are found and we haven't retried yet, try refetching
      if (totalWorkspaces === 0 && retryCount < 2) {
        setRetryCount(prev => prev + 1);
        refetch();
        return;
      }

      // If user has no workspaces at all after retries, redirect to workspace page
      if (totalWorkspaces === 0) {
        window.location.href = '/workspace';
        return;
      }

      // If user has other workspaces but not access to this specific one
      if (totalWorkspaces > 0 && !hasWorkspaceRead) {
        // Redirect to first available workspace
        const availableWorkspaces = Object.keys(permissionsByWorkspace);
        window.location.href = `/workspace/${availableWorkspaces[0]}`;
        return;
      }

      // Default: allow access (this handles edge cases)
      setHasCheckedAccess(true);
    }
  }, [permissionsLoading, permissionsByWorkspace, workspaceId, hasCheckedAccess, retryCount, refetch]);

  // Show loading while checking permissions
  if (permissionsLoading || !hasCheckedAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas-base">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-text-secondary">Checking workspace access...</p>
        </div>
      </div>
    );
  }

  // Show error if permissions failed to load
  if (permissionsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas-base">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-error-500 text-2xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Workspace Access Error
          </h2>
          <p className="text-sm text-text-secondary mb-4">
            Unable to verify workspace access. Please try refreshing the page.
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

  return <>{children}</>;
}

/**
 * Layout for workspace routes
 *
 * Provides authentication and workspace permission context.
 * Uses the backend permission format (resource:action) for workspace access.
 */
export default function WorkspaceLayoutComponent({ children }: WorkspaceLayoutProps) {
  return (
    <WorkspacePermissionProvider>
      <ProtectedRoute>
        <WorkspaceAccessValidator>
          <WorkspaceLayout>
            {children}
          </WorkspaceLayout>
        </WorkspaceAccessValidator>
      </ProtectedRoute>
    </WorkspacePermissionProvider>
  );
}