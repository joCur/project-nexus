/**
 * CardEditOverlay - Main overlay manager for card inline editing
 *
 * Features:
 * - Determines which editor to show based on card.content.type
 * - Edit mode entry/exit animations
 * - Focus trap during editing
 * - Toolbar for formatting options
 * - Handles double-click to enter, Escape/click outside to exit
 * - Integrates with cardStore.updateCard() for immediate updates
 */

'use client';

import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
  useMemo
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import './card-editing.css';
import type {
  Card,
  CardContent,
  TextCard,
  ImageCard,
  LinkCard,
  CodeCard,
  UpdateCardParams
} from '@/types/card.types';
import {
  isTextCard,
  isImageCard,
  isLinkCard,
  isCodeCard
} from '@/types/card.types';
import { useCardStore } from '@/stores/cardStore';
import { InlineTextEditor } from './InlineTextEditor';
import { InlineCodeEditor } from './InlineCodeEditor';
import { InlineLinkEditor } from './InlineLinkEditor';

interface CardEditOverlayProps {
  /** Card being edited */
  card: Card;
  /** Whether editing is active */
  isEditing: boolean;
  /** Container element for portal positioning */
  containerElement?: HTMLElement;
  /** Called when editing starts */
  onEditStart?: (card: Card) => void;
  /** Called when editing completes */
  onEditComplete?: (card: Card) => void;
  /** Called when editing is cancelled */
  onEditCancel?: (card: Card) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * CardEditOverlay component
 */
export const CardEditOverlay: React.FC<CardEditOverlayProps> = ({
  card,
  isEditing,
  containerElement,
  onEditStart,
  onEditComplete,
  onEditCancel,
  className,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mountedInPortal, setMountedInPortal] = useState(false);
  const updateCard = useCardStore(state => state.updateCard);

  // Calculate overlay position relative to container
  const overlayStyle = useMemo(() => {
    if (!containerElement) {
      return {
        position: 'fixed' as const,
        left: card.position.x,
        top: card.position.y,
        zIndex: 1000,
      };
    }

    // Calculate position relative to container
    const containerRect = containerElement.getBoundingClientRect();
    return {
      position: 'absolute' as const,
      left: card.position.x,
      top: card.position.y,
      zIndex: 1000,
    };
  }, [card.position.x, card.position.y, containerElement]);

  // Handle edit mode entry animation
  useEffect(() => {
    if (isEditing && !isAnimating) {
      setIsAnimating(true);
      setMountedInPortal(true);

      // Trigger entrance animation
      requestAnimationFrame(() => {
        if (overlayRef.current) {
          overlayRef.current.classList.add('edit-overlay-enter-active');
        }
      });

      // Complete animation
      const timer = setTimeout(() => {
        setIsAnimating(false);
        if (overlayRef.current) {
          overlayRef.current.classList.remove('edit-overlay-enter-active');
          overlayRef.current.classList.add('edit-overlay-enter-done');
        }
        onEditStart?.(card);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isEditing, isAnimating, card, onEditStart]);

  // Handle edit mode exit
  const handleEditExit = useCallback((completed: boolean, updatedCard?: Card) => {
    if (!isEditing) return;

    setIsAnimating(true);

    if (overlayRef.current) {
      overlayRef.current.classList.remove('edit-overlay-enter-done');
      overlayRef.current.classList.add('edit-overlay-exit-active');
    }

    // Complete exit animation
    const timer = setTimeout(() => {
      setMountedInPortal(false);
      setIsAnimating(false);

      if (completed && updatedCard) {
        onEditComplete?.(updatedCard);
      } else {
        onEditCancel?.(card);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isEditing, card, onEditComplete, onEditCancel]);

  // Handle content changes with immediate feedback (<100ms requirement)
  const handleContentChange = useCallback((newContent: CardContent) => {
    const updates: UpdateCardParams = {
      id: card.id,
      updates: {
        content: newContent,
        updatedAt: new Date().toISOString(),
      },
    };

    // Immediate local update for <100ms feedback
    updateCard(updates);
  }, [card.id, updateCard]);

  // Handle edit completion
  const handleEditComplete = useCallback((newContent: CardContent) => {
    // Create updated card with proper typing
    const updatedCard = {
      ...card,
      content: newContent,
      updatedAt: new Date().toISOString(),
    } as Card;

    // Final update to store
    const updates: UpdateCardParams = {
      id: card.id,
      updates: {
        content: newContent,
        updatedAt: updatedCard.updatedAt,
      },
    };
    updateCard(updates);

    handleEditExit(true, updatedCard);
  }, [card, updateCard, handleEditExit]);

  // Handle edit cancellation
  const handleEditCancel = useCallback(() => {
    handleEditExit(false);
  }, [handleEditExit]);

  // Handle escape key globally
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        handleEditCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isEditing, handleEditCancel]);

  // Handle click outside to exit editing
  useEffect(() => {
    if (!isEditing || !overlayRef.current) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;

      // Don't close if clicking within the overlay
      if (overlayRef.current?.contains(target)) {
        return;
      }

      // Don't close if clicking on a portal element (dropdown, tooltip, etc.)
      if (target.closest('[role="tooltip"]') || target.closest('[role="dialog"]')) {
        return;
      }

      handleEditCancel();
    };

    // Use capture to intercept clicks before they bubble
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => document.removeEventListener('mousedown', handleClickOutside, { capture: true });
  }, [isEditing, handleEditCancel]);

  // Render appropriate editor based on card type
  const renderEditor = useCallback(() => {
    const dimensions = card.dimensions;
    const style = {
      backgroundColor: card.style.backgroundColor,
      borderColor: card.style.borderColor,
      textColor: card.style.textColor,
      borderWidth: card.style.borderWidth,
      borderRadius: card.style.borderRadius,
    };

    const baseProps = {
      dimensions,
      style,
      onChange: handleContentChange,
      onComplete: handleEditComplete,
      onCancel: handleEditCancel,
    };

    if (isTextCard(card)) {
      return (
        <InlineTextEditor
          {...baseProps}
          content={card.content}
        />
      );
    }

    if (isCodeCard(card)) {
      return (
        <InlineCodeEditor
          {...baseProps}
          content={card.content}
        />
      );
    }

    if (isLinkCard(card)) {
      return (
        <InlineLinkEditor
          {...baseProps}
          content={card.content}
        />
      );
    }

    if (isImageCard(card)) {
      // TODO: Implement image editor in future iteration
      // For now, show a placeholder message
      return (
        <div
          className="absolute inset-0 bg-card-background border-2 border-primary-500 shadow-lg rounded-lg flex items-center justify-center z-50"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            backgroundColor: style.backgroundColor,
            borderRadius: `${style.borderRadius}px`,
          }}
        >
          <div className="text-center p-4">
            <p className="text-gray-600 mb-2">Image editing not yet implemented</p>
            <p className="text-sm text-gray-500">Press Escape to close</p>
          </div>
        </div>
      );
    }

    // Fallback for unknown card types
    return (
      <div
        className="absolute inset-0 bg-card-background border-2 border-red-500 shadow-lg rounded-lg flex items-center justify-center z-50"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: `${style.borderRadius}px`,
        }}
      >
        <div className="text-center p-4">
          <p className="text-red-600 mb-2">Unknown card type</p>
          <p className="text-sm text-gray-500">Press Escape to close</p>
        </div>
      </div>
    );
  }, [card, handleContentChange, handleEditComplete, handleEditCancel]);

  // Don't render if not editing or not yet mounted
  if (!isEditing || !mountedInPortal) {
    return null;
  }

  const overlayContent = (
    <div
      ref={overlayRef}
      className={cn(
        'edit-overlay',
        'transition-all duration-200 ease-out',
        'edit-overlay-enter', // Initial state
        className
      )}
      style={overlayStyle}
      role="dialog"
      aria-label={`Edit ${card.content.type} card`}
      aria-modal="true"
    >
      {renderEditor()}
    </div>
  );

  // Render in portal if container is specified, otherwise render normally
  if (containerElement) {
    return createPortal(overlayContent, containerElement);
  }

  return createPortal(overlayContent, document.body);
};


export default CardEditOverlay;