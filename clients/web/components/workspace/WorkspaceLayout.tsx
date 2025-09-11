'use client';

import React from 'react';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceBreadcrumbs } from './WorkspaceBreadcrumbs';
import { WorkspacePermissionProvider } from '@/contexts/WorkspacePermissionContext';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

/**
 * Main layout component for workspace pages
 * 
 * Provides the overall structure for workspace views including:
 * - Workspace permission context management
 * - Header with workspace context and navigation
 * - Breadcrumb navigation
 * - Main content area
 * 
 * Features:
 * - Automatic workspace-scoped permission management
 * - Responsive design with proper spacing
 * - Accessible structure with proper heading hierarchy
 * - Consistent styling across all workspace views
 */
export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({ children }) => {
  return (
    <WorkspacePermissionProvider>
      <div className="h-screen bg-gray-900 flex flex-col">
        {/* Main Header */}
        <WorkspaceHeader />
        
        {/* Breadcrumb Navigation */}
        <div className="flex-none bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-3">
              <WorkspaceBreadcrumbs />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </WorkspacePermissionProvider>
  );
};