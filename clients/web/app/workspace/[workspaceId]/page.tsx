'use client';

import { useParams, useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvases, useCreateCanvas } from '@/hooks/use-canvas';
import { useEffect, useState } from 'react';
import type { EntityId } from '@/types/common.types';

/**
 * Workspace redirect page - redirects to default canvas
 * Route: /workspace/[workspaceId]
 */
export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as EntityId;
  
  const { setCurrentWorkspace } = useWorkspaceStore();
  const context = useWorkspaceStore((state) => state.context);
  
  // Use GraphQL hooks to fetch canvases
  const { canvases, loading: canvasesLoading, error: canvasesError } = useCanvases(workspaceId);
  const { mutate: createCanvas, loading: creatingCanvas } = useCreateCanvas();
  
  const [hasTriedCreateDefault, setHasTriedCreateDefault] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      // Set current workspace if different
      if (context.currentWorkspaceId !== workspaceId) {
        setCurrentWorkspace(workspaceId, `Workspace ${workspaceId}`);
      }
    }
  }, [workspaceId, context.currentWorkspaceId, setCurrentWorkspace]);

  useEffect(() => {
    // Handle canvas loading and default creation
    if (!canvasesLoading && workspaceId && !canvasesError) {
      if (canvases.length > 0) {
        // Find default canvas or use first canvas
        const defaultCanvas = canvases.find(canvas => canvas.settings.isDefault);
        const targetCanvas = defaultCanvas || canvases[0];
        
        router.replace(`/workspace/${workspaceId}/canvas/${targetCanvas.id}` as any);
      } else if (!hasTriedCreateDefault && !creatingCanvas) {
        // No canvases exist - create a default one
        console.log('No canvases found, creating default canvas for workspace:', workspaceId);
        setHasTriedCreateDefault(true);
        
        createCanvas({
          workspaceId,
          name: 'Main Canvas',
          description: 'Default workspace canvas',
          priority: 'normal',
          tags: [],
          settings: {
            isDefault: true,
            position: { x: 0, y: 0, z: 0 },
            zoom: 1.0,
            grid: {
              enabled: true,
              size: 20,
              color: '#e5e7eb',
              opacity: 0.3,
            },
            background: {
              type: 'COLOR',
              color: '#ffffff',
              opacity: 1.0,
            },
          },
        }).then((newCanvasId) => {
          if (newCanvasId) {
            console.log('Default canvas created successfully:', newCanvasId);
            router.replace(`/workspace/${workspaceId}/canvas/${newCanvasId}` as any);
          } else {
            console.error('Failed to create default canvas');
          }
        });
      }
    }
  }, [canvases, canvasesLoading, canvasesError, workspaceId, hasTriedCreateDefault, creatingCanvas, createCanvas, router]);

  // Show loading state while determining redirect
  const getLoadingMessage = () => {
    if (canvasesLoading) return 'Loading canvases...';
    if (creatingCanvas) return 'Creating default canvas...';
    if (canvasesError) return 'Error loading workspace';
    return 'Setting up workspace...';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{getLoadingMessage()}</p>
        {canvasesError && (
          <p className="text-red-600 text-sm mt-2">
            Failed to load workspace. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}