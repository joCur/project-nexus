'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout for workspace routes
 * 
 * Provides authentication and workspace permission context.
 * Uses the backend permission format (resource:action) for workspace access.
 */
export default function WorkspaceLayoutComponent({ children }: WorkspaceLayoutProps) {
  return (
    <ProtectedRoute
      requiredPermissions={['workspace:read']}
      redirectTo="/workspace"
    >
      <WorkspaceLayout>
        {children}
      </WorkspaceLayout>
    </ProtectedRoute>
  );
}