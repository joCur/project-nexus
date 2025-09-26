import { useEffect, RefObject, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import type { CardType } from '@/types/card.types';

/**
 * Card creation event handlers interface
 */
interface CardCreationHandlers {
  /** Handler for creating a card at current cursor/center position */
  onCreateCard?: (type: CardType, position?: { x: number; y: number }) => void;
  /** Handler for opening card type selector modal */
  onOpenCardTypeSelector?: () => void;
  /** Handler for opening context menu at position */
  onOpenContextMenu?: (position: { x: number; y: number }) => void;
}

/**
 * Custom hook that sets up basic canvas event handlers for keyboard and touch interactions.
 * Provides keyboard navigation, card creation shortcuts, and basic touch gesture support
 * with accessibility compliance.
 *
 * @param containerRef - Reference to the canvas container element
 * @param cardCreationHandlers - Optional handlers for card creation events
 */
export const useCanvasEvents = (
  containerRef: RefObject<HTMLDivElement>,
  cardCreationHandlers?: CardCreationHandlers
) => {
  const { viewport, setZoom, setPosition, config } = useCanvasStore();
  const { zoom, position } = viewport;

  // Handle keyboard events with accessibility and card creation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle events when canvas is focused
    const container = containerRef.current;
    if (!container?.contains(document.activeElement)) return;

    // Don't handle shortcuts if user is typing in an input
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT' ||
      (activeElement as HTMLElement).isContentEditable
    )) {
      return;
    }

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const panSpeed = prefersReducedMotion ? 10 : 20;
    const zoomSpeed = prefersReducedMotion ? 0.05 : 0.1;

    // Get center position for card creation
    const getCenterPosition = () => {
      const centerX = (-position.x + window.innerWidth / 2) / zoom;
      const centerY = (-position.y + window.innerHeight / 2) / zoom;
      return { x: centerX, y: centerY };
    };

    switch (e.key.toLowerCase()) {
      // Pan with arrow keys
      case 'arrowup':
        e.preventDefault();
        setPosition({ x: position.x, y: position.y + panSpeed });
        break;
      case 'arrowdown':
        e.preventDefault();
        setPosition({ x: position.x, y: position.y - panSpeed });
        break;
      case 'arrowleft':
        e.preventDefault();
        setPosition({ x: position.x + panSpeed, y: position.y });
        break;
      case 'arrowright':
        e.preventDefault();
        setPosition({ x: position.x - panSpeed, y: position.y });
        break;

      // Zoom with + and - keys
      case '+':
      case '=':
        e.preventDefault();
        const newZoomIn = Math.min(zoom * (1 + zoomSpeed), config.zoom.max);
        if (newZoomIn !== zoom) {
          setZoom(newZoomIn);
        }
        break;
      case '-':
      case '_':
        e.preventDefault();
        const newZoomOut = Math.max(zoom * (1 - zoomSpeed), config.zoom.min);
        if (newZoomOut !== zoom) {
          setZoom(newZoomOut);
        }
        break;

      // Reset zoom and position
      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom(1);
          setPosition({ x: 0, y: 0 });
        }
        break;

      case 'home':
        e.preventDefault();
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        break;

      case ' ':
        if (!e.shiftKey) {
          e.preventDefault();
          setPosition({ x: 0, y: 0 });
        }
        break;

      // Card creation shortcuts
      case 'n':
        if (cardCreationHandlers?.onCreateCard) {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+N: Open card type selector modal
            cardCreationHandlers.onOpenCardTypeSelector?.();
          } else {
            // N: Create text card at center
            cardCreationHandlers.onCreateCard('text', getCenterPosition());
          }
        }
        break;

      case 't':
        if (cardCreationHandlers?.onCreateCard && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          cardCreationHandlers.onCreateCard('text', getCenterPosition());
        }
        break;

      case 'i':
        if (cardCreationHandlers?.onCreateCard && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          cardCreationHandlers.onCreateCard('image', getCenterPosition());
        }
        break;

      case 'l':
        if (cardCreationHandlers?.onCreateCard && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          cardCreationHandlers.onCreateCard('link', getCenterPosition());
        }
        break;

      case 'c':
        if (cardCreationHandlers?.onCreateCard && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          cardCreationHandlers.onCreateCard('code', getCenterPosition());
        }
        break;
    }
  }, [zoom, position, setZoom, setPosition, config.zoom, containerRef, cardCreationHandlers]);

  // Handle basic touch events for mobile
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    if (e.touches.length === 2) {
      // Store initial touch positions for pinch gesture
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      (container as any)._initialPinchDistance = distance;
      (container as any)._initialZoom = zoom;
    }
  }, [zoom, containerRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (e.touches.length === 2 && container) {
      e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const initialDistance = (container as any)._initialPinchDistance;
      const initialZoom = (container as any)._initialZoom;
      
      if (initialDistance && initialZoom) {
        const scale = distance / initialDistance;
        const newZoom = Math.min(
          Math.max(initialZoom * scale, config.zoom.min), 
          config.zoom.max
        );
        setZoom(newZoom);
      }
    }
  }, [setZoom, containerRef, config.zoom]);
  
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    if (e.touches.length === 0) {
      // Clean up pinch data
      delete (container as any)._initialPinchDistance;
      delete (container as any)._initialZoom;
    }
  }, [containerRef]);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container?.contains(e.target as Node)) return;

    // Only show context menu on canvas background, not on cards
    const target = e.target as Element;
    const isCanvasBackground = target.closest('[data-testid="infinite-canvas"]') &&
      !target.closest('[data-card-id]');

    if (isCanvasBackground && cardCreationHandlers?.onOpenContextMenu) {
      e.preventDefault();

      // Get position relative to the canvas container
      const containerRect = container.getBoundingClientRect();
      const relativeX = e.clientX - containerRect.left;
      const relativeY = e.clientY - containerRect.top;

      cardCreationHandlers.onOpenContextMenu({ x: relativeX, y: relativeY });
    }
  }, [containerRef, cardCreationHandlers]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Ensure container is focusable
    container.tabIndex = 0;

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleKeyDown, handleTouchStart, handleTouchMove, handleTouchEnd, handleContextMenu, containerRef]);
};