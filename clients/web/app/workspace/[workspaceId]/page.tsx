'use client';

import { useParams, useRouter } from 'next/navigation';
import { useWorkspaceStore, workspaceSelectors } from '@/stores/workspaceStore';
import { useEffect } from 'react';

/**
 * Workspace redirect page - redirects to default canvas
 * Route: /workspace/[workspaceId]
 */
export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  
  const {
    setCurrentWorkspace,
    loadWorkspaceCanvases,
    getDefaultCanvas,
    isInitialized,
  } = useWorkspaceStore();
  
  const canvasManagement = useWorkspaceStore((state) => state.canvasManagement);
  const context = useWorkspaceStore((state) => state.context);
  const isLoading = useWorkspaceStore(workspaceSelectors.isLoading);

  useEffect(() => {
    if (workspaceId) {
      // Set current workspace if different
      if (context.currentWorkspaceId !== workspaceId) {
        setCurrentWorkspace(workspaceId, `Workspace ${workspaceId}`);
      }
      
      // Load canvases if not initialized
      if (!isInitialized && !isLoading) {
        loadWorkspaceCanvases(workspaceId);
      }
    }
  }, [workspaceId, context.currentWorkspaceId, isInitialized, isLoading, setCurrentWorkspace, loadWorkspaceCanvases]);

  useEffect(() => {
    // Redirect to default canvas once canvases are loaded
    if (isInitialized && !isLoading && workspaceId) {
      const defaultCanvas = getDefaultCanvas();
      
      if (defaultCanvas) {
        router.replace(`/workspace/${workspaceId}/canvas/${defaultCanvas.id}` as any);
      } else if (canvasManagement.canvases.size > 0) {
        // If no default canvas, redirect to first available canvas
        const firstCanvas = Array.from(canvasManagement.canvases.values())[0];
        router.replace(`/workspace/${workspaceId}/canvas/${firstCanvas.id}` as any);
      } else {
        // No canvases exist - this should be handled by creating a default one
        console.warn('No canvases found for workspace', workspaceId);
        // In a real implementation, this might trigger canvas creation or show an error
      }
    }
  }, [isInitialized, isLoading, workspaceId, canvasManagement.canvases, getDefaultCanvas, router]);

  // Show loading state while determining redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading workspace...</p>
      </div>
    </div>
  );
}