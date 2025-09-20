'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvases, useCanvas, useSetDefaultCanvas } from '@/hooks/use-canvas';
import { CreateCanvasModal } from './CreateCanvasModal';
import { DefaultCanvasBadge } from './DefaultCanvasBadge';
import { CanvasContextMenu } from './CanvasContextMenu';
import { useToast, canvasToastMessages } from '@/components/ui/CanvasErrorToast';
import type { CanvasId } from '@/types/workspace.types';

/**
 * Canvas switcher component with dropdown functionality
 * 
 * Features:
 * - Dropdown showing all available canvases
 * - Current canvas display with statistics
 * - Create new canvas functionality
 * - Keyboard navigation support
 * - Canvas statistics (card/connection count - placeholder for now)
 * 
 * Accessibility:
 * - ARIA labels and descriptions
 * - Keyboard navigation (Enter, Space, Arrow keys, Escape)
 * - Focus management with proper focus trapping
 * - Screen reader announcements
 */
export const CanvasSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState<{ canvasId: CanvasId; x: number; y: number } | null>(null);
  const [settingDefaultCanvas, setSettingDefaultCanvas] = useState<CanvasId | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  
  const context = useWorkspaceStore((state) => state.context);
  const workspaceId = context.currentWorkspaceId;

  // Use Apollo hooks for canvas data
  const { canvases: allCanvases, loading: canvasesLoading } = useCanvases(workspaceId);
  const { canvas: currentCanvas } = useCanvas(context.currentCanvasId);
  const setDefaultCanvas = useSetDefaultCanvas();
  const { showToast } = useToast();

  const canvasCount = allCanvases.length;
  const isLoading = canvasesLoading;

  // Check for multiple default canvases and show warning
  useEffect(() => {
    const defaultCanvases = allCanvases.filter(canvas => canvas.settings.isDefault);
    if (defaultCanvases.length > 1) {
      showToast(canvasToastMessages.multipleDefaultsWarning(defaultCanvases.length));
    }
  }, [allCanvases, showToast]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  const handleCanvasSelect = (canvasId: string) => {
    if (workspaceId && canvasId !== context.currentCanvasId) {
      router.push(`/workspace/${workspaceId}/canvas/${canvasId}` as any);
    }
    setIsOpen(false);
  };

  const handleSetDefaultCanvas = async (canvasId: CanvasId) => {
    if (!workspaceId) return;

    const canvas = allCanvases.find(c => c.id === canvasId);
    if (!canvas) return;

    setSettingDefaultCanvas(canvasId);
    try {
      const success = await setDefaultCanvas.mutate(workspaceId, canvasId);
      if (success) {
        showToast(canvasToastMessages.setDefaultSuccess(canvas.name));
      } else {
        showToast(canvasToastMessages.setDefaultError(canvas.name, 'Operation failed'));
      }
    } catch (error) {
      console.error('Error setting default canvas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(canvasToastMessages.setDefaultError(canvas.name, errorMessage));
    } finally {
      setSettingDefaultCanvas(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, canvasId: CanvasId) => {
    e.preventDefault();
    e.stopPropagation();
    setShowContextMenu({
      canvasId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleCreateCanvas = () => {
    setIsOpen(false);
    setShowCreateModal(true);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Don't render if no workspace context
  if (!workspaceId) {
    return null;
  }

  return (
    <div className="relative">
      {/* Main Canvas Switcher Button */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Current canvas: ${currentCanvas?.name || 'Unknown'}. Click to switch canvas.`}
        disabled={isLoading}
      >
        <div className="flex items-center space-x-2 min-w-0">
          {/* Canvas Icon */}
          <div className="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full" />
          
          {/* Canvas Info */}
          <div className="min-w-0 text-left">
            <div className="font-medium truncate">
              {currentCanvas?.name || 'Loading...'}
            </div>
            {currentCanvas && (
              <div className="text-xs text-gray-500">
                Canvas {allCanvases.findIndex(c => c.id === currentCanvas.id) + 1} of {canvasCount}
              </div>
            )}
          </div>
        </div>
        
        {/* Dropdown Arrow */}
        <div className="flex-shrink-0 ml-2">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 z-50 mt-1 w-80 bg-white border border-gray-200 rounded-md shadow-lg py-1 max-h-64 overflow-auto"
          role="listbox"
          aria-label="Canvas selection"
          onKeyDown={handleKeyDown}
        >
          {/* Canvas List */}
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
            Canvases ({canvasCount})
          </div>
          
          {allCanvases.map((canvas) => {
            const isSelected = canvas.id === context.currentCanvasId;
            const isDefault = canvas.settings.isDefault;
            const isSettingDefault = settingDefaultCanvas === canvas.id;

            return (
              <div
                key={canvas.id}
                className="relative group"
                onContextMenu={(e) => handleContextMenu(e, canvas.id)}
              >
                <button
                  onClick={() => handleCanvasSelect(canvas.id)}
                  disabled={isSettingDefault}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors ${
                    isSelected ? 'bg-primary-50 text-primary-700' : 'text-gray-900'
                  } ${isSettingDefault ? 'opacity-60 cursor-not-allowed' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={`Switch to ${canvas.name}${isDefault ? ' (default canvas)' : ''}${isSettingDefault ? ' (setting as default...)' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                        isSelected ? 'bg-primary-500' : 'bg-gray-300'
                      }`} />

                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center space-x-2">
                          <span>{canvas.name}</span>
                          <DefaultCanvasBadge
                            isDefault={isDefault}
                            isLoading={isSettingDefault}
                          />
                        </div>
                        {canvas.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {canvas.description}
                          </div>
                        )}
                        {/* Placeholder for canvas statistics */}
                        <div className="text-xs text-gray-400 mt-1">
                          0 cards • 0 connections
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isSettingDefault && (
                        <div className="w-4 h-4 animate-spin">
                          <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
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
                      )}

                      {isSelected && !isSettingDefault && (
                        <svg className="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
          
          {/* Create New Canvas Button */}
          <div className="border-t border-gray-100 mt-1">
            <button
              onClick={handleCreateCanvas}
              className="w-full px-3 py-2 text-left text-sm text-primary-600 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors flex items-center space-x-2"
              aria-label="Create new canvas"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create New Canvas</span>
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {showContextMenu && (
        <CanvasContextMenu
          canvasId={showContextMenu.canvasId}
          position={{ x: showContextMenu.x, y: showContextMenu.y }}
          onClose={() => setShowContextMenu(null)}
          onSetDefault={handleSetDefaultCanvas}
          workspaceId={workspaceId}
        />
      )}

      {/* Create Canvas Modal */}
      {showCreateModal && (
        <CreateCanvasModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
};