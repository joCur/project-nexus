'use client';

import { useParams, useRouter, notFound } from 'next/navigation';
import { useWorkspaceStore, workspaceSelectors } from '@/stores/workspaceStore';
import { useEffect, useState } from 'react';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { createCanvasId } from '@/types/workspace.types';

/**
 * Canvas view page
 * Route: /workspace/[workspaceId]/canvas/[canvasId]
 */
export default function CanvasPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const canvasId = createCanvasId(params.canvasId as string);
  
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  
  const {
    setCurrentWorkspace,
    setCurrentCanvas,
    loadWorkspaceCanvases,
    switchCanvas,
    getCanvas,
    isInitialized,
  } = useWorkspaceStore();
  
  const context = useWorkspaceStore((state) => state.context);
  const isLoading = useWorkspaceStore(workspaceSelectors.isLoading);
  const { status: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus();

  // Check onboarding status and redirect if needed
  useEffect(() => {
    if (!onboardingLoading && onboardingStatus && !onboardingStatus.isComplete) {
      router.push('/onboarding');
    }
  }, [onboardingLoading, onboardingStatus, router]);

  // Set workspace context if needed
  useEffect(() => {
    if (workspaceId && context.currentWorkspaceId !== workspaceId) {
      setCurrentWorkspace(workspaceId, `Workspace ${workspaceId}`);
    }
  }, [workspaceId, context.currentWorkspaceId, setCurrentWorkspace]);

  // Load workspace canvases if not initialized
  useEffect(() => {
    if (workspaceId && !isInitialized && !isLoading) {
      loadWorkspaceCanvases(workspaceId);
    }
  }, [workspaceId, isInitialized, isLoading, loadWorkspaceCanvases]);

  // Set current canvas and validate it exists
  useEffect(() => {
    if (canvasId && isInitialized) {
      const canvas = getCanvas(canvasId);
      
      if (!canvas) {
        // Canvas doesn't exist - redirect to workspace root
        router.replace(`/workspace/${workspaceId}` as any);
        return;
      }
      
      // Set current canvas if different
      if (context.currentCanvasId !== canvasId) {
        setCurrentCanvas(canvasId, canvas.name);
        switchCanvas(canvasId);
      }
      
      setIsCanvasReady(true);
    }
  }, [canvasId, isInitialized, context.currentCanvasId, getCanvas, setCurrentCanvas, switchCanvas, router, workspaceId]);

  // Show loading while checking onboarding status
  if (onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Don't render if onboarding is not complete
  if (!onboardingStatus?.isComplete) {
    return null;
  }

  // Show loading while workspace/canvas data is loading
  if (!isInitialized || isLoading || !isCanvasReady) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading canvas...</p>
        </div>
      </div>
    );
  }

  const currentCanvas = getCanvas(canvasId);
  if (!currentCanvas) {
    notFound();
  }

  return (
    <div className="flex-1 relative bg-gray-900">
      <InfiniteCanvas
        className="w-full h-full"
        showGrid={currentCanvas.settings.grid.enabled}
        ariaLabel={`${currentCanvas.name} - Interactive knowledge workspace canvas`}
        ariaDescription="Navigate with arrow keys to pan, plus and minus keys to zoom, space to center view"
      />
      
      {/* Welcome Message - only show on first visit or empty canvas */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-sm pointer-events-none">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Welcome to {currentCanvas.name}!
        </h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Use mouse wheel to zoom</p>
          <p>• Click and drag to pan around</p>
          <p>• Arrow keys for keyboard navigation</p>
          <p>• Press Space to center view</p>
        </div>
      </div>
    </div>
  );
}