'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvases, useCanvas, useDeleteCanvas, useDuplicateCanvas } from '@/hooks/use-canvas';
import { cn } from '@/lib/utils';
import type { CanvasId } from '@/types/workspace.types';
import type { EntityId } from '@/types/common.types';

/**
 * Props for the CanvasContextMenu component
 */
export interface CanvasContextMenuProps {
  /** ID of the canvas the menu is for */
  canvasId: CanvasId;
  /** Position where the menu should appear */
  position: { x: number; y: number };
  /** Callback when menu should be closed */
  onClose: () => void;
  /** Callback when setting canvas as default */
  onSetDefault: (canvasId: CanvasId) => Promise<void>;
  /** Current workspace ID */
  workspaceId: EntityId;
}

/**
 * Context menu for canvas operations with proper keyboard navigation and accessibility
 *
 * Features:
 * - Set canvas as default with loading states
 * - Duplicate canvas functionality
 * - Delete canvas with confirmation
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Proper focus management and accessibility
 * - Smart positioning to stay within viewport
 * - Loading states for async operations
 */
export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  canvasId,
  position,
  onClose,
  onSetDefault,
  workspaceId,
}) => {
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const menuRef = useRef<HTMLDivElement>(null);
  const currentCanvasId = useWorkspaceStore(state => state.context.currentCanvasId);

  // Use Apollo hooks for canvas data
  const { canvas } = useCanvas(canvasId);
  const { canvases: allCanvases } = useCanvases(workspaceId);
  const duplicateCanvas = useDuplicateCanvas();
  const deleteCanvas = useDeleteCanvas();

  const isCurrentCanvas = canvasId === currentCanvasId;
  const canDelete = allCanvases.length > 1; // Can't delete if it's the only canvas
  const isDefault = canvas?.settings.isDefault || false;

  // Menu items configuration
  const menuItems = [
    {
      id: 'set-default',
      label: isDefault ? 'Default Canvas' : 'Set as Default',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      disabled: isDefault || isSettingDefault,
      loading: isSettingDefault,
      onClick: handleSetDefault,
      description: isDefault ? 'This canvas is already the default' : 'Make this canvas the default when opening this workspace',
    },
    {
      id: 'duplicate',
      label: 'Duplicate Canvas',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      disabled: isDuplicating,
      loading: isDuplicating,
      onClick: handleDuplicate,
      description: 'Create a copy of this canvas with all its content',
    },
    {
      id: 'separator',
      type: 'separator',
      onClick: () => {}, // No-op for separator
    },
    {
      id: 'delete',
      label: 'Delete Canvas',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      disabled: !canDelete || isDeleting,
      loading: isDeleting,
      onClick: handleDelete,
      destructive: true,
      description: canDelete
        ? 'Permanently delete this canvas and all its content'
        : 'Cannot delete the only canvas in this workspace',
    },
  ].filter(item => item.type !== 'separator' || item.id !== 'separator' || canDelete);

  const actionableItems = menuItems.filter(item => item.type !== 'separator');

  // Handle setting canvas as default
  async function handleSetDefault() {
    if (isDefault || isSettingDefault) return;

    setIsSettingDefault(true);
    try {
      await onSetDefault(canvasId);
      onClose();
    } catch (error) {
      console.error('Failed to set default canvas:', error);
      // Toast notification will be handled by the parent component
    } finally {
      setIsSettingDefault(false);
    }
  }

  // Handle duplicating canvas
  async function handleDuplicate() {
    if (!canvas || isDuplicating) return;

    setIsDuplicating(true);
    try {
      const newCanvasId = await duplicateCanvas.mutate({
        id: canvasId,
        name: `${canvas.name} (Copy)`,
        description: canvas.description,
        includeCards: true,
        includeConnections: true,
      });

      if (newCanvasId) {
        console.log('Canvas duplicated successfully:', newCanvasId);
        onClose();
      }
    } catch (error) {
      console.error('Failed to duplicate canvas:', error);
    } finally {
      setIsDuplicating(false);
    }
  }

  // Handle deleting canvas
  async function handleDelete() {
    if (!canDelete || isDeleting) return;

    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      const success = await deleteCanvas.mutate(canvasId);
      if (success) {
        console.log('Canvas deleted successfully:', canvasId);
        onClose();
      }
    } catch (error) {
      console.error('Failed to delete canvas:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // Position menu within viewport
  const [menuPosition, setMenuPosition] = useState(position);

  useEffect(() => {
    if (!menuRef.current) return;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // Adjust horizontal position
    if (x + menuRect.width > viewportWidth) {
      x = viewportWidth - menuRect.width - 8; // 8px margin
    }
    if (x < 8) {
      x = 8;
    }

    // Adjust vertical position
    if (y + menuRect.height > viewportHeight) {
      y = viewportHeight - menuRect.height - 8; // 8px margin
    }
    if (y < 8) {
      y = 8;
    }

    setMenuPosition({ x, y });
  }, [position]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev => {
            const nextIndex = prev + 1;
            return nextIndex >= actionableItems.length ? 0 : nextIndex;
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev => {
            const prevIndex = prev - 1;
            return prevIndex < 0 ? actionableItems.length - 1 : prevIndex;
          });
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < actionableItems.length) {
            const item = actionableItems[focusedIndex];
            if (!item.disabled && item.onClick) {
              item.onClick();
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, actionableItems, onClose]);

  // Focus menu when it opens
  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.focus();
    }
  }, []);

  if (!canvas) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 focus:outline-none"
      style={{ left: menuPosition.x, top: menuPosition.y }}
      role="menu"
      aria-label={`Actions for ${canvas.name}`}
      tabIndex={-1}
    >
      {/* Canvas info header */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="font-medium text-sm text-gray-900 truncate">{canvas.name}</div>
        {canvas.description && (
          <div className="text-xs text-gray-500 truncate">{canvas.description}</div>
        )}
      </div>

      {/* Menu items */}
      {menuItems.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={item.id} className="my-1 border-t border-gray-100" />;
        }

        const actionIndex = actionableItems.findIndex(actionItem => actionItem.id === item.id);
        const isFocused = focusedIndex === actionIndex;

        return (
          <button
            key={item.id}
            onClick={item.onClick}
            disabled={item.disabled}
            className={cn(
              'w-full px-3 py-2 text-left text-sm transition-colors flex items-center space-x-3',
              'focus:outline-none',
              item.disabled
                ? 'text-gray-400 cursor-not-allowed'
                : item.destructive
                  ? 'text-error-700 hover:bg-error-50 focus:bg-error-50'
                  : 'text-gray-700 hover:bg-gray-50 focus:bg-gray-50',
              isFocused && !item.disabled && (
                item.destructive ? 'bg-error-50' : 'bg-gray-50'
              )
            )}
            role="menuitem"
            aria-describedby={`${item.id}-description`}
          >
            <div className="flex-shrink-0">
              {item.loading ? (
                <div className="w-4 h-4 animate-spin">
                  <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              ) : (
                item.icon
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-medium">{item.label}</div>
              {showDeleteConfirm && item.id === 'delete' ? (
                <div className="text-xs text-error-600 mt-1">
                  Click again to confirm deletion
                </div>
              ) : (
                <div
                  id={`${item.id}-description`}
                  className="text-xs text-gray-500 mt-1"
                >
                  {item.description}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};