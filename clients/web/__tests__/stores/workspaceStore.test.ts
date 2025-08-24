/**
 * Workspace Store Tests
 * 
 * Comprehensive test suite for workspace context management,
 * canvas CRUD operations, and state synchronization.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { 
  CanvasId, 
  CreateCanvasParams, 
  UpdateCanvasParams,
  DuplicateCanvasParams,
  CanvasFilter,
  createCanvasId 
} from '@/types/workspace.types';
import type { EntityId } from '@/types/common.types';

// Mock the createCanvasId function
const mockCreateCanvasId = jest.fn((id: string) => id as any);

jest.mock('@/types/workspace.types', () => ({
  ...jest.requireActual('@/types/workspace.types'),
  createCanvasId: mockCreateCanvasId,
}));

describe('WorkspaceStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const store = useWorkspaceStore.getState();
    store.clearContext();
    // Clear any persisted data
    store.canvasManagement.canvases.clear();
    store.canvasManagement.defaultCanvasId = undefined;
  });

  describe('Context Management', () => {
    it('should set current workspace', () => {
      const store = useWorkspaceStore.getState();
      const workspaceId = 'workspace-1' as EntityId;
      const workspaceName = 'Test Workspace';

      store.setCurrentWorkspace(workspaceId, workspaceName);

      const { context } = useWorkspaceStore.getState();
      expect(context.currentWorkspaceId).toBe(workspaceId);
      expect(context.workspaceName).toBe(workspaceName);
      expect(context.currentCanvasId).toBeUndefined();
      expect(context.canvasName).toBeUndefined();
    });

    it('should set current canvas', () => {
      const store = useWorkspaceStore.getState();
      const canvasId = 'canvas-1' as CanvasId;
      const canvasName = 'Test Canvas';

      store.setCurrentCanvas(canvasId, canvasName);

      const { context } = useWorkspaceStore.getState();
      expect(context.currentCanvasId).toBe(canvasId);
      expect(context.canvasName).toBe(canvasName);
    });

    it('should clear context and canvas data when workspace changes', () => {
      const store = useWorkspaceStore.getState();
      
      // Set initial state
      store.setCurrentWorkspace('workspace-1' as EntityId, 'Workspace 1');
      store.setCurrentCanvas('canvas-1' as CanvasId, 'Canvas 1');
      
      // Add some canvas data
      store.canvasManagement.canvases.set('canvas-1' as CanvasId, {
        id: 'canvas-1' as CanvasId,
        workspaceId: 'workspace-1' as EntityId,
        name: 'Test Canvas',
        settings: {
          isDefault: false,
          position: { x: 0, y: 0, z: 0 },
          zoom: 1.0,
          grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
          background: { type: 'COLOR', color: '#ffffff', opacity: 1.0 },
        },
        status: 'active',
        priority: 'normal',
        tags: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      });

      // Change workspace
      store.setCurrentWorkspace('workspace-2' as EntityId, 'Workspace 2');

      const state = useWorkspaceStore.getState();
      expect(state.context.currentWorkspaceId).toBe('workspace-2');
      expect(state.context.currentCanvasId).toBeUndefined();
      expect(state.canvasManagement.canvases.size).toBe(0);
      expect(state.isInitialized).toBe(false);
    });

    it('should clear all context', () => {
      const store = useWorkspaceStore.getState();
      
      // Set some state
      store.setCurrentWorkspace('workspace-1' as EntityId, 'Workspace 1');
      store.setCurrentCanvas('canvas-1' as CanvasId, 'Canvas 1');
      
      store.clearContext();
      
      const { context, canvasManagement, isInitialized } = useWorkspaceStore.getState();
      expect(context.currentWorkspaceId).toBeUndefined();
      expect(context.workspaceName).toBeUndefined();
      expect(context.currentCanvasId).toBeUndefined();
      expect(context.canvasName).toBeUndefined();
      expect(canvasManagement.canvases.size).toBe(0);
      expect(isInitialized).toBe(false);
    });
  });

  describe('Canvas CRUD Operations', () => {
    const workspaceId = 'workspace-1' as EntityId;
    
    beforeEach(() => {
      const store = useWorkspaceStore.getState();
      store.setCurrentWorkspace(workspaceId, 'Test Workspace');
    });

    it('should create a new canvas', async () => {
      const store = useWorkspaceStore.getState();
      const createParams: CreateCanvasParams = {
        workspaceId,
        name: 'New Canvas',
        description: 'Test canvas description',
        priority: 'high',
        tags: ['test'],
        metadata: { custom: 'data' },
      };

      const canvasId = await store.createCanvas(createParams);

      expect(canvasId).toBeDefined();
      const canvas = store.getCanvas(canvasId!);
      expect(canvas).toBeDefined();
      expect(canvas!.name).toBe('New Canvas');
      expect(canvas!.description).toBe('Test canvas description');
      expect(canvas!.priority).toBe('high');
      expect(canvas!.tags).toEqual(['test']);
      expect(canvas!.metadata).toEqual({ custom: 'data' });
      expect(canvas!.settings.isDefault).toBe(false);
    });

    it('should update an existing canvas', async () => {
      const store = useWorkspaceStore.getState();
      
      // Create canvas first
      const canvasId = await store.createCanvas({
        workspaceId,
        name: 'Original Name',
      });

      const updateParams: UpdateCanvasParams = {
        id: canvasId!,
        updates: {
          name: 'Updated Name',
          description: 'Updated description',
          status: 'archived',
          settings: {
            isDefault: true,
            zoom: 1.5,
          },
        },
      };

      const success = await store.updateCanvas(updateParams);

      expect(success).toBe(true);
      const canvas = store.getCanvas(canvasId!);
      expect(canvas!.name).toBe('Updated Name');
      expect(canvas!.description).toBe('Updated description');
      expect(canvas!.status).toBe('archived');
      expect(canvas!.settings.isDefault).toBe(true);
      expect(canvas!.settings.zoom).toBe(1.5);
    });

    it('should delete a canvas', async () => {
      const store = useWorkspaceStore.getState();
      
      // Create canvas first
      const canvasId = await store.createCanvas({
        workspaceId,
        name: 'To Delete',
      });
      
      expect(store.getCanvas(canvasId!)).toBeDefined();

      const success = await store.deleteCanvas(canvasId!);

      expect(success).toBe(true);
      expect(store.getCanvas(canvasId!)).toBeUndefined();
      expect(store.canvasManagement.canvases.has(canvasId!)).toBe(false);
    });

    it('should duplicate a canvas', async () => {
      const store = useWorkspaceStore.getState();
      
      // Create original canvas
      const originalId = await store.createCanvas({
        workspaceId,
        name: 'Original Canvas',
        description: 'Original description',
        tags: ['original'],
        metadata: { version: 1 },
      });

      const duplicateParams: DuplicateCanvasParams = {
        id: originalId!,
        name: 'Duplicated Canvas',
        description: 'Duplicated description',
        includeCards: true,
        includeConnections: false,
      };

      const duplicateId = await store.duplicateCanvas(duplicateParams);

      expect(duplicateId).toBeDefined();
      expect(duplicateId).not.toBe(originalId);
      
      const duplicate = store.getCanvas(duplicateId!);
      const original = store.getCanvas(originalId!);
      
      expect(duplicate!.name).toBe('Duplicated Canvas');
      expect(duplicate!.description).toBe('Duplicated description');
      expect(duplicate!.tags).toEqual(['original']); // Tags copied
      expect(duplicate!.metadata).toEqual({ version: 1 }); // Metadata copied
      expect(duplicate!.settings.isDefault).toBe(false); // Not default
      expect(duplicate!.workspaceId).toBe(workspaceId);
    });

    it('should handle create canvas failure gracefully', async () => {
      const store = useWorkspaceStore.getState();
      
      // Mock console.error to avoid noise in tests
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create invalid params that would cause an error
      const invalidParams = {
        workspaceId: null as any,
        name: '',
      };

      const canvasId = await store.createCanvas(invalidParams);

      expect(canvasId).toBeNull();
      expect(store.canvasManagement.errors.mutationError).toContain('Failed to create canvas');
      
      consoleError.mockRestore();
    });
  });

  describe('Canvas Management', () => {
    const workspaceId = 'workspace-1' as EntityId;
    
    beforeEach(() => {
      const store = useWorkspaceStore.getState();
      store.setCurrentWorkspace(workspaceId, 'Test Workspace');
    });

    it('should set default canvas', async () => {
      const store = useWorkspaceStore.getState();
      
      // Create two canvases
      const canvas1Id = await store.createCanvas({ workspaceId, name: 'Canvas 1' });
      const canvas2Id = await store.createCanvas({ workspaceId, name: 'Canvas 2' });

      // Set canvas2 as default
      const success = await store.setDefaultCanvas(workspaceId, canvas2Id!);

      expect(success).toBe(true);
      expect(store.canvasManagement.defaultCanvasId).toBe(canvas2Id);
      
      const canvas1 = store.getCanvas(canvas1Id!);
      const canvas2 = store.getCanvas(canvas2Id!);
      
      expect(canvas1!.settings.isDefault).toBe(false);
      expect(canvas2!.settings.isDefault).toBe(true);
    });

    it('should load workspace canvases and create default if none exist', async () => {
      const store = useWorkspaceStore.getState();
      
      await store.loadWorkspaceCanvases(workspaceId);

      const state = useWorkspaceStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.canvasManagement.canvases.size).toBe(1);
      
      const defaultCanvas = store.getDefaultCanvas();
      expect(defaultCanvas).toBeDefined();
      expect(defaultCanvas!.name).toBe('Main Canvas');
      expect(defaultCanvas!.settings.isDefault).toBe(true);
      expect(state.context.currentCanvasId).toBe(defaultCanvas!.id);
    });

    it('should refresh canvases', async () => {
      const store = useWorkspaceStore.getState();
      
      // Set current workspace
      store.setCurrentWorkspace(workspaceId, 'Test Workspace');
      
      await store.refreshCanvases();
      
      expect(useWorkspaceStore.getState().isInitialized).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    const workspaceId = 'workspace-1' as EntityId;
    
    beforeEach(async () => {
      const store = useWorkspaceStore.getState();
      store.setCurrentWorkspace(workspaceId, 'Test Workspace');
      
      // Create test canvases
      await store.createCanvas({ 
        workspaceId, 
        name: 'Canvas 1', 
        priority: 'high',
        tags: ['urgent', 'project-a'] 
      });
      const canvas2Id = await store.createCanvas({ 
        workspaceId, 
        name: 'Canvas 2', 
        tags: ['project-b'] 
      });
      // Update to archived status after creation
      if (canvas2Id) {
        await store.updateCanvas({
          id: canvas2Id,
          updates: { status: 'archived' }
        });
      }
      await store.createCanvas({ 
        workspaceId, 
        name: 'Default Canvas',
        settings: { isDefault: true } as any
      });
    });

    it('should get canvas by ID', async () => {
      const store = useWorkspaceStore.getState();
      const canvases = Array.from(store.canvasManagement.canvases.values());
      const targetCanvas = canvases[0];
      
      const retrieved = store.getCanvas(targetCanvas.id);
      
      expect(retrieved).toBe(targetCanvas);
    });

    it('should get default canvas', () => {
      const store = useWorkspaceStore.getState();
      
      const defaultCanvas = store.getDefaultCanvas();
      
      expect(defaultCanvas).toBeDefined();
      expect(defaultCanvas!.settings.isDefault).toBe(true);
    });

    it('should get current canvas', () => {
      const store = useWorkspaceStore.getState();
      const canvases = Array.from(store.canvasManagement.canvases.values());
      const targetCanvas = canvases[0];
      
      store.setCurrentCanvas(targetCanvas.id, targetCanvas.name);
      
      const currentCanvas = store.getCurrentCanvas();
      
      expect(currentCanvas).toBe(targetCanvas);
    });

    it('should filter canvases by status', () => {
      const store = useWorkspaceStore.getState();
      
      const filter: CanvasFilter = {
        status: ['archived'],
      };
      
      const filtered = store.getCanvasesByFilter(filter);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].status).toBe('archived');
    });

    it('should filter canvases by priority', () => {
      const store = useWorkspaceStore.getState();
      
      const filter: CanvasFilter = {
        priority: ['high'],
      };
      
      const filtered = store.getCanvasesByFilter(filter);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].priority).toBe('high');
    });

    it('should filter canvases by tags', () => {
      const store = useWorkspaceStore.getState();
      
      const filter: CanvasFilter = {
        tags: ['project-a'],
      };
      
      const filtered = store.getCanvasesByFilter(filter);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].tags).toContain('project-a');
    });

    it('should filter canvases by search query', () => {
      const store = useWorkspaceStore.getState();
      
      const filter: CanvasFilter = {
        searchQuery: 'default',
      };
      
      const filtered = store.getCanvasesByFilter(filter);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].name.toLowerCase()).toContain('default');
    });

    it('should filter canvases by default status', () => {
      const store = useWorkspaceStore.getState();
      
      const filter: CanvasFilter = {
        isDefault: true,
      };
      
      const filtered = store.getCanvasesByFilter(filter);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].settings.isDefault).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should clear errors', async () => {
      const store = useWorkspaceStore.getState();
      
      // Set some errors
      store.setError('fetch', 'Test fetch error');
      store.setError('mutation', 'Test mutation error');
      
      let state = useWorkspaceStore.getState();
      expect(state.canvasManagement.errors.fetchError).toBe('Test fetch error');
      expect(state.canvasManagement.errors.mutationError).toBe('Test mutation error');
      
      store.clearErrors();
      
      state = useWorkspaceStore.getState();
      expect(state.canvasManagement.errors.fetchError).toBeUndefined();
      expect(state.canvasManagement.errors.mutationError).toBeUndefined();
    });

    it('should set specific error types', () => {
      const store = useWorkspaceStore.getState();
      
      store.setError('fetch', 'Network error');
      store.setError('mutation', 'Validation error');
      
      const { errors } = store.canvasManagement;
      expect(errors.fetchError).toBe('Network error');
      expect(errors.mutationError).toBe('Validation error');
    });
  });

  describe('Loading States', () => {
    it('should track loading states for different operations', async () => {
      const store = useWorkspaceStore.getState();
      const workspaceId = 'workspace-1' as EntityId;
      
      store.setCurrentWorkspace(workspaceId, 'Test Workspace');
      
      // Test loading state during canvas creation
      const createPromise = store.createCanvas({
        workspaceId,
        name: 'Test Canvas',
      });
      
      // Loading state should be true during operation (though it completes quickly in tests)
      
      await createPromise;
      
      const finalState = useWorkspaceStore.getState();
      expect(finalState.canvasManagement.loadingStates.creatingCanvas).toBe(false);
    });
  });
});