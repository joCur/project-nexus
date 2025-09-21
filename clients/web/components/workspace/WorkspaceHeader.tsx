'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvases } from '@/hooks/use-canvas';
import Image from 'next/image';
import { Button } from '@/components/ui';
import { CanvasSwitcher } from './CanvasSwitcher';

/**
 * Workspace header component
 * 
 * Features:
 * - Project branding and workspace context
 * - Canvas switcher integration
 * - User profile information
 * - Logout functionality
 * - Responsive design with proper spacing
 * 
 * Layout:
 * - Left: Project Nexus branding + Canvas switcher
 * - Right: User profile + Logout button
 * 
 * Accessibility:
 * - Proper heading hierarchy
 * - Accessible user profile display
 * - Focus management for interactive elements
 * - Screen reader friendly user information
 */
export const WorkspaceHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const context = useWorkspaceStore((state) => state.context);

  // Use Apollo hook for canvas count
  const { canvases } = useCanvases(context.currentWorkspaceId);
  const canvasCount = canvases.length;

  const workspaceName = context.workspaceName || 'Knowledge Workspace';

  return (
    <header className="flex-none bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left Section: Branding and Canvas Switcher */}
          <div className="flex items-center space-x-6">
            {/* Project Branding */}
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-semibold text-gray-900">Project Nexus</h1>
              <div className="hidden sm:block text-sm text-gray-500">
                {workspaceName}
              </div>
            </div>
            
            {/* Canvas Switcher */}
            {context.currentWorkspaceId && (
              <div className="flex items-center space-x-2">
                <CanvasSwitcher />
                {canvasCount > 0 && (
                  <div className="hidden lg:block text-xs text-gray-400">
                    {canvasCount} canvas{canvasCount !== 1 ? 'es' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Right Section: User Profile and Actions */}
          <div className="flex items-center space-x-4">
            {/* User Profile Info */}
            <div className="flex items-center space-x-3">
              {user?.picture && (
                <Image
                  src={user.picture}
                  alt={`Profile picture for ${user.name || user.email}`}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full border border-gray-200"
                />
              )}
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-gray-900">
                  {user?.name || 'User'}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.email}
                </div>
              </div>
            </div>
            
            {/* Logout Button */}
            <Button
              variant="outline"
              size="small"
              onClick={() => logout()}
              aria-label="Logout from Project Nexus"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile workspace info - shown on small screens */}
      <div className="sm:hidden px-4 py-2 bg-gray-50 border-t border-gray-100">
        <div className="text-sm text-gray-600">
          {workspaceName}
        </div>
      </div>
    </header>
  );
};