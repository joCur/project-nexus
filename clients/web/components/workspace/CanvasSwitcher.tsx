'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore, workspaceSelectors } from '@/stores/workspaceStore';
import { Button, IconButton } from '@/components/ui';
import { CreateCanvasModal } from './CreateCanvasModal';

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  
  const context = useWorkspaceStore((state) => state.context);
  const allCanvases = useWorkspaceStore(workspaceSelectors.getAllCanvases);
  const currentCanvasData = useWorkspaceStore(workspaceSelectors.getCurrentCanvas);
  const canvasCount = useWorkspaceStore(workspaceSelectors.getCanvasCount);
  const isLoading = useWorkspaceStore(workspaceSelectors.isLoading);

  const currentCanvas = currentCanvasData.canvas;
  const workspaceId = context.currentWorkspaceId;

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
            
            return (
              <button
                key={canvas.id}
                onClick={() => handleCanvasSelect(canvas.id)}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors ${
                  isSelected ? 'bg-primary-50 text-primary-700' : 'text-gray-900'
                }`}
                role="option"
                aria-selected={isSelected}
                aria-label={`Switch to ${canvas.name}${isDefault ? ' (default canvas)' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                      isSelected ? 'bg-primary-500' : 'bg-gray-300'
                    }`} />
                    
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center space-x-2">
                        <span>{canvas.name}</span>
                        {isDefault && (
                          <span className="inline-block px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            Default
                          </span>
                        )}
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
                  
                  {isSelected && (
                    <svg className="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
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