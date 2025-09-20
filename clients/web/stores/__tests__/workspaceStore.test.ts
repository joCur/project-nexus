/**
 * Tests for simplified workspace store (post-Apollo refactoring)
 * Tests only navigation context and UI state management.
 * Canvas data is now managed by Apollo GraphQL hooks.
 */

import { renderHook, act } from '@testing-library/react';
import { useWorkspaceStore } from '../workspaceStore';
import { createCanvasId } from '@/types/workspace.types';
import type { CanvasId } from '@/types/workspace.types';
import type { EntityId } from '@/types/common.types';

describe('Simplified Workspace Store', () => {
  const testWorkspaceId = 'test-workspace-123' as EntityId;
  const testCanvasId1 = createCanvasId('canvas-1');

  beforeEach(() => {
    act(() => {
      useWorkspaceStore.getState().clearContext();
    });
  });

  describe('Basic Functionality', () => {
    it('should initialize with default context', () => {
      const store = useWorkspaceStore.getState();

      expect(store.context.currentWorkspaceId).toBeUndefined();
      expect(store.context.currentCanvasId).toBeUndefined();
      expect(store.context.workspaceName).toBeUndefined();
      expect(store.context.canvasName).toBeUndefined();
      expect(store.isInitialized).toBe(false);
    });

    it('should set current workspace correctly', () => {
      act(() => {
        useWorkspaceStore.getState().setCurrentWorkspace(testWorkspaceId, 'Test Workspace');
      });

      const store = useWorkspaceStore.getState();
      expect(store.context.currentWorkspaceId).toBe(testWorkspaceId);
      expect(store.context.workspaceName).toBe('Test Workspace');
      expect(store.isInitialized).toBe(true);
    });

    it('should set current canvas correctly', () => {
      act(() => {
        useWorkspaceStore.getState().setCurrentCanvas(testCanvasId1, 'Test Canvas');
      });

      const store = useWorkspaceStore.getState();
      expect(store.context.currentCanvasId).toBe(testCanvasId1);
      expect(store.context.canvasName).toBe('Test Canvas');
    });

    it('should clear context correctly', () => {
      // Set some context first
      act(() => {
        useWorkspaceStore.getState().setCurrentWorkspace(testWorkspaceId, 'Test Workspace');
        useWorkspaceStore.getState().setCurrentCanvas(testCanvasId1, 'Test Canvas');
        useWorkspaceStore.getState().setError('fetch', 'Test error');
      });

      // Clear context
      act(() => {
        useWorkspaceStore.getState().clearContext();
      });

      const store = useWorkspaceStore.getState();
      expect(store.context.currentWorkspaceId).toBeUndefined();
      expect(store.context.currentCanvasId).toBeUndefined();
      expect(store.context.workspaceName).toBeUndefined();
      expect(store.context.canvasName).toBeUndefined();
      expect(store.isInitialized).toBe(false);
      expect(store.uiState.errors.fetchError).toBeUndefined();
      expect(store.uiState.errors.mutationError).toBeUndefined();
    });

    it('should manage loading states', () => {
      act(() => {
        useWorkspaceStore.getState().setCanvasLoading('fetchingCanvases', true);
      });

      let store = useWorkspaceStore.getState();
      expect(store.uiState.loadingStates.fetchingCanvases).toBe(true);

      act(() => {
        useWorkspaceStore.getState().setCanvasLoading('fetchingCanvases', false);
      });

      store = useWorkspaceStore.getState();
      expect(store.uiState.loadingStates.fetchingCanvases).toBe(false);
    });

    it('should manage error states', () => {
      act(() => {
        useWorkspaceStore.getState().setError('fetch', 'Failed to fetch data');
      });

      let store = useWorkspaceStore.getState();
      expect(store.uiState.errors.fetchError).toBe('Failed to fetch data');

      act(() => {
        useWorkspaceStore.getState().clearErrors();
      });

      store = useWorkspaceStore.getState();
      expect(store.uiState.errors.fetchError).toBeUndefined();
    });
  });

  describe('Hook Integration', () => {
    it('should work correctly with renderHook', () => {
      const { result } = renderHook(() => useWorkspaceStore());

      expect(result.current.context.currentWorkspaceId).toBeUndefined();
      expect(result.current.isInitialized).toBe(false);

      act(() => {
        result.current.setCurrentWorkspace(testWorkspaceId, 'Test Workspace');
      });

      expect(result.current.context.currentWorkspaceId).toBe(testWorkspaceId);
      expect(result.current.context.workspaceName).toBe('Test Workspace');
      expect(result.current.isInitialized).toBe(true);
    });

    it('should work with selector functions', () => {
      const { result } = renderHook(() =>
        useWorkspaceStore(state => state.context.currentWorkspaceId)
      );

      expect(result.current).toBeUndefined();

      act(() => {
        useWorkspaceStore.getState().setCurrentWorkspace(testWorkspaceId);
      });

      expect(result.current).toBe(testWorkspaceId);
    });
  });
});