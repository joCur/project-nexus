'use client';

import { useParams, useRouter, notFound } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useEffect, useState, useRef } from 'react';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useCanvases, useCanvas } from '@/hooks/use-canvas';
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

  const workspaceStore = useWorkspaceStore();
  const storeRef = useRef(workspaceStore);
  storeRef.current = workspaceStore;
  const context = workspaceStore.context;

  // Use Apollo hooks for canvas data
  const { canvases, loading: canvasesLoading } = useCanvases(workspaceId);
  const { canvas: currentCanvas, loading: currentCanvasLoading } = useCanvas(canvasId);
  const { status: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus();

  const isLoading = canvasesLoading || currentCanvasLoading;

  // Check onboarding status and redirect if needed
  useEffect(() => {
    if (!onboardingLoading && onboardingStatus && !onboardingStatus.isComplete) {
      router.push('/onboarding');
    }
  }, [onboardingLoading, onboardingStatus, router]);

  // Set workspace context if needed
  useEffect(() => {
    if (workspaceId && context.currentWorkspaceId !== workspaceId) {
      storeRef.current?.setCurrentWorkspace?.(workspaceId, `Workspace ${workspaceId}`);
    }
  }, [workspaceId, context.currentWorkspaceId]); // Using ref to avoid infinite re-renders

  // Canvas data is automatically loaded by Apollo hooks
  // No need to manually load canvases anymore

  // Set current canvas and validate it exists
  useEffect(() => {
    if (canvasId && !isLoading && currentCanvas) {
      // Set current canvas if different
      if (context.currentCanvasId !== canvasId) {
        storeRef.current?.setCurrentCanvas?.(canvasId, currentCanvas.name);
      }

      setIsCanvasReady(true);
    } else if (canvasId && !isLoading && !currentCanvas && canvases.length > 0) {
      // Canvas doesn't exist - redirect to workspace root
      router.replace(`/workspace/${workspaceId}`);
      return;
    }
  }, [canvasId, isLoading, currentCanvas, canvases.length, context.currentCanvasId, router, workspaceId]); // Using ref to avoid infinite re-renders

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
  if (isLoading || !isCanvasReady) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading canvas...</p>
        </div>
      </div>
    );
  }

  if (!currentCanvas) {
    notFound();
  }

  return (
    <div className="flex-1 relative bg-gray-900">
      <InfiniteCanvas
        className="w-full h-full"
        showGrid={currentCanvas.settings.grid.enabled}
        workspaceId={workspaceId}
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