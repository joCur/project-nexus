'use client';

import React from 'react';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvas } from '@/hooks/use-canvas';

interface Breadcrumb {
  name: string;
  href: string;
  current: boolean;
}

/**
 * Breadcrumb navigation component for workspace views
 * 
 * Navigation path: Dashboard → Workspace → Canvas
 * 
 * Features:
 * - Dynamic breadcrumb generation based on current context
 * - Proper link handling with Next.js Link component
 * - Current page indication (no link for current page)
 * - Accessible navigation with proper ARIA labels
 * - Responsive design with proper spacing
 * 
 * Accessibility:
 * - Uses semantic nav element
 * - Proper ARIA labels and current page indication
 * - Screen reader friendly separators
 * - Focus management with visible focus indicators
 */
export const WorkspaceBreadcrumbs: React.FC = () => {
  const context = useWorkspaceStore((state) => state.context);

  const workspaceId = context.currentWorkspaceId;
  const workspaceName = context.workspaceName || `Workspace ${workspaceId}`;
  const canvasId = context.currentCanvasId;

  // Get current canvas data from Apollo
  const { canvas: currentCanvas } = useCanvas(canvasId);
  const canvasName = currentCanvas?.name || 'Canvas';

  // Don't render if no workspace context
  if (!workspaceId) {
    return null;
  }

  const breadcrumbs: Breadcrumb[] = [
    {
      name: 'Dashboard',
      href: '/',
      current: false,
    },
    {
      name: workspaceName,
      href: `/workspace/${workspaceId}`,
      current: !canvasId, // Current if we're on workspace root
    },
  ];

  // Add canvas breadcrumb if we're viewing a specific canvas
  if (canvasId) {
    breadcrumbs.push({
      name: canvasName,
      href: `/workspace/${workspaceId}/canvas/${canvasId}`,
      current: true,
    });
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm">
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={breadcrumb.name} className="flex items-center">
            {index > 0 && (
              <svg
                className="flex-shrink-0 mx-2 h-4 w-4 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            
            {breadcrumb.current ? (
              <span
                className="font-medium text-gray-900"
                aria-current="page"
              >
                {breadcrumb.name}
              </span>
            ) : (
              <Link
                href={breadcrumb.href as any}
                className="text-gray-500 hover:text-gray-700 focus:text-gray-700 focus:outline-none focus:underline transition-colors"
                aria-label={`Navigate to ${breadcrumb.name}`}
              >
                {breadcrumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};