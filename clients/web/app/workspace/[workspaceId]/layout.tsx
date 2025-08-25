'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout for workspace routes
 * Provides authentication and workspace context
 */
export default function WorkspaceLayoutComponent({ children }: WorkspaceLayoutProps) {
  return (
    <ProtectedRoute
      requiredPermissions={['read:workspaces']}
      redirectTo="/workspace"
    >
      <WorkspaceLayout>
        {children}
      </WorkspaceLayout>
    </ProtectedRoute>
  );
}