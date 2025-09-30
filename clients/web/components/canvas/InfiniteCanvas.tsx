'use client';

import React, { useRef } from 'react';
import dynamic from 'next/dynamic';
import { useCanvasSize } from '@/hooks/useCanvasSize';
import { useCanvasEvents } from '@/hooks/useCanvasEvents';
import { useCanvasStore } from '@/stores/canvasStore';
import useCardCreation from '@/hooks/useCardCreation';
import CardCreationMenu from './CardCreationMenu';
import CreateCardModal from './CreateCardModal';
import type { CardType, CreateCardParams } from '@/types/card.types';
import type { EntityId } from '@/types/common.types';
import type { CreateCardMutationVariables } from '@/lib/graphql/cardOperations';

const CanvasStage = dynamic(() => import('./CanvasStage').then(mod => ({ default: mod.CanvasStage })), {
  ssr: false
});

const CanvasBackground = dynamic(() => import('./CanvasBackground').then(mod => ({ default: mod.CanvasBackground })), {
  ssr: false
});

const CardLayer = dynamic(() => import('./CardLayer').then(mod => ({ default: mod.default })), {
  ssr: false
});

const EditorOverlay = dynamic(() => import('./editing/EditorOverlay').then(mod => ({ default: mod.EditorOverlay })), {
  ssr: false
});

interface InfiniteCanvasProps {
  className?: string;
  showGrid?: boolean;
  ariaLabel?: string;
  ariaDescription?: string;
  /** Workspace ID for card operations - required for card creation */
  workspaceId: EntityId;
}

/**
 * Main infinite canvas component that provides the foundation for the visual workspace.
 * Integrates React-Konva for high-performance 2D rendering with comprehensive card creation UI.
 *
 * Core Features:
 * - Zoom range: 0.25x (25%) to 4.0x (400%) as per design specifications
 * - Pan navigation with keyboard and mouse support
 * - Responsive sizing with ResizeObserver
 * - Accessible keyboard navigation (arrow keys, +/- for zoom)
 * - WCAG AA compliant accessibility with screen reader support
 * - Card creation via right-click context menu and keyboard shortcuts
 * - Advanced card creation modal with full customization options
 *
 * Card Creation:
 * - Right-click on canvas background to show creation context menu
 * - Keyboard shortcuts: N (text), T (text), I (image), L (link), C (code)
 * - Shift+N opens advanced creation modal
 * - All card types supported with appropriate default content
 *
 * Accessibility:
 * - ARIA application role with descriptive labels
 * - Dynamic zoom and position announcements
 * - Keyboard navigation support (arrow keys, +/-, space)
 * - Screen reader compatible instructions
 * - Focus management with visible focus indicators
 */
export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  className = '',
  showGrid = true,
  ariaLabel = 'Interactive infinite canvas workspace',
  ariaDescription = 'Use arrow keys to pan, plus and minus keys to zoom, space to reset view. Right-click to create cards.',
  workspaceId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useCanvasSize(containerRef);
  const { viewport } = useCanvasStore();
  const { zoom, position } = viewport;

  // Initialize card creation hook
  const cardCreation = useCardCreation({
    workspaceId,
    defaultType: 'text',
    autoEnterEditMode: false,
  });

  // Card creation event handlers
  const cardCreationHandlers = {
    onCreateCard: async (type: CardType, screenPosition?: { x: number; y: number }) => {
      const canvasPosition = screenPosition
        ? cardCreation.screenToCanvasPosition(screenPosition)
        : cardCreation.getDefaultPosition();

      await cardCreation.createCardAtPosition(type, canvasPosition);
    },
    onOpenCardTypeSelector: () => {
      cardCreation.openModal();
    },
    onOpenContextMenu: (position: { x: number; y: number }) => {
      cardCreation.openContextMenu(position);
    },
  };

  // Set up canvas event handlers with card creation
  useCanvasEvents(containerRef, cardCreationHandlers);

  // Handle modal card creation
  const handleModalCardCreation = async (params: CreateCardParams) => {
    try {
      // Convert CreateCardParams to the format expected by useCardCreation
      // Extract content based on card type with proper type checking
      let contentString: string | undefined;
      if (params.content) {
        switch (params.type) {
          case 'text':
            contentString = 'content' in params.content ? String(params.content.content) : undefined;
            break;
          case 'image':
            contentString = 'url' in params.content ? String(params.content.url) : undefined;
            break;
          case 'link':
            contentString = 'url' in params.content ? String(params.content.url) : undefined;
            break;
          case 'code':
            contentString = 'content' in params.content ? String(params.content.content) : undefined;
            break;
          default:
            contentString = undefined;
        }
      }

      const createCardInput: Partial<CreateCardMutationVariables['input']> = {
        title: params.type === 'text' && contentString ?
          contentString.slice(0, 50) + '...' :
          `New ${params.type} card`,
        content: contentString,
        dimensions: params.dimensions,
        style: params.style,
      };

      await cardCreation.createCard(createCardInput);
    } catch (error) {
      // Error handling is managed by the useCardCreation hook
      // Silent failure - errors are displayed via hook's state management
    }
  };
  

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-canvas-base focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 ${className}`}
      data-testid="infinite-canvas"
      role="application"
      aria-label={ariaLabel}
      aria-describedby="canvas-instructions"
      aria-roledescription="Interactive infinite canvas for visual knowledge workspace"
      tabIndex={0}
    >
      {/* Screen reader instructions */}
      <div id="canvas-instructions" className="sr-only">
        {ariaDescription}
        Current zoom level: {(zoom * 100).toFixed(0)} percent.
        Zoom range: 25% to 400%.
        Canvas dimensions: {width} by {height} pixels.
        Card creation shortcuts: N for text card, I for image, L for link, C for code.
        Shift+N for advanced creation modal.
      </div>
      
      <CanvasStage
        width={width}
        height={height}
        scale={{ x: zoom, y: zoom }}
        position={{ x: position.x, y: position.y }}
      >
        <CanvasBackground
          width={width}
          height={height}
          showGrid={showGrid}
          zoom={zoom}
          position={position}
        />
        <CardLayer
          enableViewportCulling={true}
          viewportPadding={500}
        />
        {/* Future: Connection layers will be added here */}
      </CanvasStage>

      {/* Card Creation Context Menu */}
      {cardCreation.state.isContextMenuOpen && cardCreation.state.contextMenuPosition && (
        <CardCreationMenu
          position={cardCreation.state.contextMenuPosition}
          onClose={cardCreation.closeContextMenu}
          onCreateCard={async (type) => {
            // Store the creation position before closing context menu
            const position = cardCreation.state.creationPosition;

            // Close context menu first
            cardCreation.closeContextMenu();

            if (position) {
              // Create card at the stored position
              await cardCreation.createCardAtPosition(type, position);
            } else {
              // Fallback to default position if no position stored
              await cardCreationHandlers.onCreateCard(type);
            }
          }}
          onMoreOptions={() => {
            cardCreation.closeContextMenu();
            cardCreation.openModal();
          }}
        />
      )}

      {/* Advanced Card Creation Modal */}
      <CreateCardModal
        isOpen={cardCreation.state.isModalOpen}
        onClose={cardCreation.closeModal}
        onCreateCard={handleModalCardCreation}
        initialType={cardCreation.state.selectedType || 'text'}
        position={cardCreation.state.creationPosition || undefined}
        isCreating={cardCreation.state.isCreating}
        error={cardCreation.state.error}
        onClearError={cardCreation.clearError}
      />

      {/* Inline Editor Overlay (NEX-193) */}
      <EditorOverlay
        workspaceId={workspaceId}
        enableServerPersistence={true}
      />
    </div>
  );
};

