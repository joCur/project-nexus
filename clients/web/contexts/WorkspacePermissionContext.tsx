'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useContextPermissions } from '@/hooks/use-permissions';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { setPermissionContext, clearPermissionContext } from '@/lib/utils/permissions';

/**
 * Workspace Permission Context
 * 
 * Provides automatic workspace-aware permission context management.
 * This context provider automatically updates the global permission context
 * when the workspace changes, enabling legacy permission utilities to work
 * seamlessly with the new backend permission system.
 */

interface WorkspacePermissionContextValue {
  currentWorkspaceId?: string;
  permissionsByWorkspace: { [workspaceId: string]: string[] };
  permissions: string[];
  loading: boolean;
  error?: Error;
  refetch: () => Promise<void>;
}

const WorkspacePermissionContext = createContext<WorkspacePermissionContextValue | null>(null);

interface WorkspacePermissionProviderProps {
  children: ReactNode;
}

/**
 * WorkspacePermissionProvider
 * 
 * This provider automatically manages the global permission context based on:
 * 1. Current workspace from WorkspaceStore
 * 2. User permissions fetched from backend via GraphQL
 * 3. Workspace switching events
 * 
 * Benefits:
 * - Automatic permission context updates on workspace changes
 * - Legacy permission utilities work without modification
 * - Centralized permission management for the entire workspace
 * - Efficient permission fetching with Apollo Client caching
 */
export const WorkspacePermissionProvider: React.FC<WorkspacePermissionProviderProps> = ({ 
  children 
}) => {
  const { user } = useAuth();
  const { context } = useWorkspaceStore();
  const { 
    permissionsByWorkspace, 
    loading, 
    error, 
    refetch 
  } = useContextPermissions({
    enabled: !!user?.sub,
    errorPolicy: 'secure-by-default',
  });

  // Get current workspace permissions
  const currentWorkspacePermissions = React.useMemo(() => {
    if (!context.currentWorkspaceId || !permissionsByWorkspace) {
      return [];
    }
    return permissionsByWorkspace[context.currentWorkspaceId] || [];
  }, [context.currentWorkspaceId, permissionsByWorkspace]);

  // Update global permission context when workspace or permissions change
  useEffect(() => {
    if (!user?.sub) {
      clearPermissionContext();
      return;
    }

    // Set the global permission context for legacy utilities
    setPermissionContext({
      workspaceId: context.currentWorkspaceId,
      permissions: currentWorkspacePermissions,
      permissionsByWorkspace,
    });

    // Cleanup function
    return () => {
      // Don't clear context on unmount as other components might still need it
      // Context will be cleared when user logs out or component tree is destroyed
    };
  }, [
    user?.sub,
    context.currentWorkspaceId,
    currentWorkspacePermissions,
    permissionsByWorkspace,
  ]);

  // Clear permission context when user logs out
  useEffect(() => {
    if (!user) {
      clearPermissionContext();
    }
  }, [user]);

  const contextValue: WorkspacePermissionContextValue = {
    currentWorkspaceId: context.currentWorkspaceId,
    permissionsByWorkspace,
    permissions: currentWorkspacePermissions,
    loading,
    error,
    refetch,
  };

  return (
    <WorkspacePermissionContext.Provider value={contextValue}>
      {children}
    </WorkspacePermissionContext.Provider>
  );
};

/**
 * Hook to access workspace permission context
 * 
 * Provides access to the current workspace permission state and utilities.
 * This hook should be used by components that need direct access to
 * permission context information.
 */
export const useWorkspacePermissionContext = (): WorkspacePermissionContextValue => {
  const context = useContext(WorkspacePermissionContext);
  
  if (context === null) {
    throw new Error(
      'useWorkspacePermissionContext must be used within a WorkspacePermissionProvider. ' +
      'Make sure to wrap your workspace components with <WorkspacePermissionProvider>.'
    );
  }
  
  return context;
};

/**
 * Safe version of useWorkspacePermissionContext that returns null when provider is not available
 * Use this in components that may or may not be within a WorkspacePermissionProvider
 */
export const useWorkspacePermissionContextSafe = (): WorkspacePermissionContextValue | null => {
  return useContext(WorkspacePermissionContext);
};

/**
 * Hook for workspace-specific permission checking
 * 
 * Provides convenient permission checking utilities that automatically
 * use the current workspace context. This is a higher-level alternative
 * to the raw permission checking functions.
 */
export const useWorkspacePermissions = () => {
  const { user, checkPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const { currentWorkspaceId, permissions, loading, error } = useWorkspacePermissionContext();

  return {
    // Current workspace context
    workspaceId: currentWorkspaceId,
    permissions,
    loading,
    error,
    
    // Permission checking utilities (workspace-scoped)
    hasPermission: (permission: string) => checkPermission(permission, currentWorkspaceId),
    hasAnyPermission: (requiredPermissions: string[]) => 
      hasAnyPermission(requiredPermissions, currentWorkspaceId),
    hasAllPermissions: (requiredPermissions: string[]) => 
      hasAllPermissions(requiredPermissions, currentWorkspaceId),
    
    // User information
    user,
    isAuthenticated: !!user,
    
    // Utility methods
    isPermissionLoading: loading,
    hasPermissionError: !!error,
  };
};

/**
 * Higher-order component for automatic workspace permission context
 * 
 * Wraps a component with WorkspacePermissionProvider. Useful for
 * providing permission context to specific component trees without
 * modifying the entire app structure.
 */
export function withWorkspacePermissions<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  const ComponentWithPermissions = (props: P) => {
    return (
      <WorkspacePermissionProvider>
        <WrappedComponent {...props} />
      </WorkspacePermissionProvider>
    );
  };

  ComponentWithPermissions.displayName = 
    `withWorkspacePermissions(${WrappedComponent.displayName || WrappedComponent.name})`;

  return ComponentWithPermissions;
}