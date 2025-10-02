/**
 * EditorOverlay Component
 *
 * Renders inline editors as portal overlays outside the Konva canvas.
 * This is necessary because Konva can only render Konva elements,
 * not HTML/DOM elements. The editors are positioned absolutely
 * over the canvas using portal rendering.
 *
 * Architecture:
 * - CardRenderer triggers edit state via double-click
 * - useCardStore tracks which card is being edited
 * - EditorOverlay listens to store and renders appropriate editor
 * - Editor appears as DOM overlay positioned over the card
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@apollo/client';
import { useCardStore } from '@/stores/cardStore';
import { useCardOperations } from '@/hooks/useCardOperations';
import { useWorkspacePermissionContextSafe } from '@/contexts/WorkspacePermissionContext';
import type { Card, CardContent, TextCard, CodeCard, LinkCard, ImageCard } from '@/types/card.types';
import { GET_CARDS_IN_BOUNDS, type CardResponse } from '@/lib/graphql/cardOperations';
import {
  TextEditor,
  CodeEditor,
  LinkEditor,
  ImageEditor} from './index';
import { isTextCard, isCodeCard, isLinkCard, isImageCard } from '@/types/card.types';
import { createContextLogger } from '@/utils/logger';
import {
  overlayVariants,
  editTransitionConfig,
  editorContentVariants} from '@/utils/canvas/editAnimations';
import { SaveStatusIndicator, SaveStatus } from './SaveStatusIndicator';
import {
  announceEditModeEntered,
  announceEditModeExited,
  announceSaveStatus
} from '@/utils/accessibility/announcements';

const logger = createContextLogger({ component: 'EditorOverlay' });

interface EditorOverlayProps {
  /** Workspace ID for server operations */
  workspaceId?: string;
  /** Whether to enable server persistence */
  enableServerPersistence?: boolean;
}

/**
 * EditorOverlay component - renders inline editors as DOM overlays
 */
export const EditorOverlay: React.FC<EditorOverlayProps> = ({
  workspaceId,
  enableServerPersistence = true
}) => {
  const {
    editingCardId,
    clearEditingCard
  } = useCardStore();

  // Get workspace context
  const workspaceContext = useWorkspacePermissionContextSafe();
  const currentWorkspaceId = workspaceId || workspaceContext?.currentWorkspaceId || 'default-workspace';

  // Query all cards to find the one being edited
  const { data: cardsData } = useQuery(GET_CARDS_IN_BOUNDS, {
    variables: {
      workspaceId: currentWorkspaceId,
      bounds: { minX: -100000, minY: -100000, maxX: 100000, maxY: 100000 } // Large bounds to get all cards
    },
    skip: !editingCardId,
    fetchPolicy: 'cache-first'
  });

  // Server operations hook
  const { updateCard: updateCardOnServer } = useCardOperations(currentWorkspaceId);

  // Local state for save/error handling
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SaveStatus.IDLE);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, setOriginalContent] = useState<CardContent | null>(null);

  // Accessibility state
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Get the card being edited from GraphQL data
  const editingCard = useMemo((): Card | null => {
    if (!editingCardId || !cardsData?.cardsInBounds) return null;
    const backendCard = cardsData.cardsInBounds.find((c: CardResponse) => c.id === editingCardId);
    if (!backendCard) return null;

    // Transform backend card to frontend Card type using same logic as CardLayer
    const baseCardProps = {
      id: backendCard.id,
      ownerId: backendCard.ownerId,
      position: {
        x: backendCard.position?.x ?? 0,
        y: backendCard.position?.y ?? 0,
        z: backendCard.position?.z ?? 0,
      },
      dimensions: backendCard.dimensions || { width: 200, height: 100 },
      style: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        textColor: '#1F2937',
        borderWidth: 1,
        borderRadius: 8,
        opacity: 1,
        shadow: true,
        ...(backendCard.style || {}),
      },
      isSelected: false,
      isLocked: false,
      isHidden: false,
      isMinimized: false,
      status: (backendCard.status?.toLowerCase() || 'active') as 'draft' | 'active' | 'archived' | 'deleted',
      priority: (backendCard.priority?.toLowerCase() || 'normal') as 'low' | 'normal' | 'high' | 'urgent',
      createdAt: backendCard.createdAt || new Date().toISOString(),
      updatedAt: backendCard.updatedAt || new Date().toISOString(),
      tags: backendCard.tags || [],
      metadata: backendCard.metadata || {},
      animation: {
        isAnimating: false,
      },
    };

    // Create discriminated union based on backend type
    const cardType = backendCard.type.toLowerCase();
    switch (cardType) {
      case 'text': {
        return {
          ...baseCardProps,
          content: {
            type: 'text' as const,
            content: String(backendCard.content || ''),
            markdown: false,
            wordCount: String(backendCard.content || '').length,
            lastEditedAt: backendCard.updatedAt || new Date().toISOString(),
          },
        } as Card;
      }

      case 'image': {
        return {
          ...baseCardProps,
          content: {
            type: 'image' as const,
            url: String(backendCard.content || ''),
            alt: String(backendCard.metadata?.alt || ''),
            caption: backendCard.title || '',
          },
        } as Card;
      }

      case 'link': {
        try {
          const urlString = String(backendCard.content || 'https://example.com');
          const url = new URL(urlString);
          return {
            ...baseCardProps,
            content: {
              type: 'link' as const,
              url: urlString,
              title: backendCard.title || url.hostname,
              description: String(backendCard.metadata?.description || ''),
              domain: url.hostname,
              favicon: String(backendCard.metadata?.favicon || ''),
              previewImage: String(backendCard.metadata?.previewImage || ''),
              lastChecked: String(backendCard.metadata?.lastChecked || ''),
              isAccessible: true,
            },
          } as Card;
        } catch {
          return {
            ...baseCardProps,
            content: {
              type: 'link' as const,
              url: String(backendCard.content || ''),
              title: backendCard.title || 'Link',
              domain: '',
              isAccessible: false,
            },
          } as Card;
        }
      }

      case 'code': {
        return {
          ...baseCardProps,
          content: {
            type: 'code' as const,
            language: String(backendCard.metadata?.language || 'text'),
            content: String(backendCard.content || ''),
            filename: String(backendCard.metadata?.filename || ''),
            lineCount: String(backendCard.content || '').split('\n').length,
            hasExecuted: false,
          },
        } as Card;
      }

      default: {
        return {
          ...baseCardProps,
          content: {
            type: 'text' as const,
            content: String(backendCard.content || ''),
            markdown: false,
            wordCount: String(backendCard.content || '').length,
            lastEditedAt: backendCard.updatedAt || new Date().toISOString(),
          },
        } as Card;
      }
    }
  }, [editingCardId, cardsData]);

  // Store original content when edit starts
  // Dependencies: editingCardId (not editingCard or originalContent) to ensure fresh state each time
  useEffect(() => {
    if (editingCard) {
      setOriginalContent(editingCard.content);
      setSaveError(null);
      setSaveStatus(SaveStatus.IDLE);
    } else if (editingCardId === null) {
      setOriginalContent(null);
      setSaveError(null);
      setSaveStatus(SaveStatus.IDLE);
    }
  }, [editingCardId, editingCard]);

  // Detect high contrast mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setHighContrastMode(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent): void => {
      setHighContrastMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent): void => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Screen reader announcements for edit mode
  useEffect(() => {
    if (editingCard) {
      // Announce edit mode entered
      announceEditModeEntered(editingCard.content.type);
    } else if (editingCardId === null && previousFocusRef.current) {
      // Announce edit mode exited
      announceEditModeExited();
    }
  }, [editingCard, editingCardId]);

  // Announce save status changes
  useEffect(() => {
    if (saveStatus === SaveStatus.SAVING) {
      announceSaveStatus('saving');
    } else if (saveStatus === SaveStatus.SUCCESS) {
      announceSaveStatus('success');
    } else if (saveStatus === SaveStatus.ERROR) {
      announceSaveStatus('error');
    }
  }, [saveStatus]);

  // Focus management - save previous focus and restore on close
  useEffect(() => {
    if (editingCard) {
      // Save currently focused element
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else if (editingCardId === null && previousFocusRef.current) {
      // Restore focus when closing
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [editingCard, editingCardId]);

  // Focus trap - keep focus within dialog
  useEffect(() => {
    if (!dialogRef.current || !editingCard) return;

    const dialog = dialogRef.current;
    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement.focus();

    const handleTabKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    dialog.addEventListener('keydown', handleTabKey);
    return () => dialog.removeEventListener('keydown', handleTabKey);
  }, [editingCard]);

  /**
   * Save changes and exit edit mode
   */
  const handleSave = useCallback(async (newContent: CardContent): Promise<void> => {
    if (!editingCard || !editingCardId) return;

    setSaveStatus(SaveStatus.SAVING);
    setSaveError(null);

    if (enableServerPersistence) {
      try {
        // Transform frontend CardContent to backend format
        const content = newContent;
        let backendContent: string = '';
        let backendMetadata: Record<string, unknown> = {};

        let backendTitle: string | undefined;

        switch (content.type) {
          case 'text':
            backendContent = content.content;
            break;
          case 'code':
            backendContent = content.content;
            backendMetadata = {
              language: content.language,
              filename: content.filename
            };
            break;
          case 'link':
            backendContent = content.url;
            backendTitle = content.title;
            backendMetadata = {
              description: content.description,
              domain: content.domain,
              favicon: content.favicon,
              previewImage: content.previewImage
            };
            break;
          case 'image':
            backendContent = content.url;
            // Backend stores caption in title field, alt in metadata
            backendTitle = content.caption;
            if (content.alt) {
              backendMetadata = { alt: content.alt };
            }
            break;
        }

        // Persist to server with backend format
        const updates: Record<string, unknown> = {
          content: backendContent
        };

        if (backendTitle) {
          updates.title = backendTitle;
        }

        if (Object.keys(backendMetadata).length > 0) {
          updates.metadata = backendMetadata;
        }

        const updatePayload = {
          id: editingCardId,
          updates
        };

        const success = await updateCardOnServer(updatePayload);

        if (!success) {
          throw new Error('Failed to save changes to server');
        }

        // Success - show success state briefly before closing
        setSaveStatus(SaveStatus.SUCCESS);
        await new Promise(resolve => setTimeout(resolve, 800)); // Show success for 800ms

        // Clear edit state
        clearEditingCard();
      } catch (error) {
        // Rollback on failure
        logger.error('Failed to save card', {
          cardId: editingCardId,
          error: error instanceof Error ? error.message : 'Unknown error',
          context: { enableServerPersistence }
        });
        setSaveError('Failed to save changes');
        setSaveStatus(SaveStatus.ERROR);
        // Keep editor open for retry
        return;
      }
    } else {
      // No server persistence - just update local state
      setSaveStatus(SaveStatus.SUCCESS);
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief success feedback
      clearEditingCard();
    }
  }, [editingCard, editingCardId, enableServerPersistence, updateCardOnServer, clearEditingCard]);

  /**
   * Cancel editing and restore original content
   */
  const handleCancel = useCallback((): void => {
    clearEditingCard();
    setSaveError(null);
    setSaveStatus(SaveStatus.IDLE);
    setOriginalContent(null);
  }, [clearEditingCard]);

  /**
   * Determine which editor component to render based on card type
   */
  const renderEditor = useCallback(() => {
    if (!editingCard) return null;

    if (isTextCard(editingCard)) {
      return (
        <TextEditor
          card={editingCard as TextCard}
          onSave={handleSave}
          onCancel={handleCancel}
          autoFocus={true}
        />
      );
    }
    if (isCodeCard(editingCard)) {
      return (
        <CodeEditor
          card={editingCard as CodeCard}
          onSave={handleSave}
          onCancel={handleCancel}
          autoFocus={true}
        />
      );
    }
    if (isLinkCard(editingCard)) {
      const linkCard = editingCard as LinkCard;
      return (
        <LinkEditor
          initialValue={{
            url: linkCard.content.url,
            text: linkCard.content.title || '',
            target: '_blank'
          }}
          onSave={(linkValue) => {
            handleSave({
              type: 'link',
              url: linkValue.url,
              title: linkValue.text,
              domain: new URL(linkValue.url).hostname,
              isAccessible: true
            });
          }}
          onCancel={handleCancel}
        />
      );
    }
    if (isImageCard(editingCard)) {
      const imageCard = editingCard as ImageCard;
      return (
        <ImageEditor
          initialData={{
            url: imageCard.content.url,
            alt: imageCard.content.alt || '',
            caption: imageCard.content.caption || ''
          }}
          onSave={(imageData) => {
            handleSave({
              type: 'image',
              url: imageData.url,
              alt: imageData.alt,
              caption: imageData.caption
            });
          }}
          onCancel={handleCancel}
        />
      );
    }

    // Default to text editor for unknown types (type assertion for fallback)
    return (
      <TextEditor
        card={editingCard as TextCard}
        onSave={handleSave}
        onCancel={handleCancel}
        autoFocus={true}
      />
    );
  }, [editingCard, handleSave, handleCancel]);

  // Don't render anything if no card is being edited
  if (!editingCard || !editingCardId) {
    return null;
  }

  const overlay = (
    <AnimatePresence mode="wait">
      {/* Backdrop */}
      <motion.div
        key={`editor-${editingCardId}`}
        initial={overlayVariants.initial}
        animate={overlayVariants.animate}
        exit={overlayVariants.exit}
        transition={reducedMotion ? { duration: 0.01 } : editTransitionConfig}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={(e) => {
          // Close on backdrop click
          if (e.target === e.currentTarget) {
            handleCancel();
          }
        }}
        role="presentation"
        aria-hidden="true"
        data-testid="editor-backdrop"
      >
        {/* Dialog */}
        <motion.div
          ref={dialogRef}
          initial={editorContentVariants.initial}
          animate={editorContentVariants.animate}
          exit={editorContentVariants.exit}
          transition={reducedMotion ? { duration: 0.01 } : undefined}
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editingCard.content.type} card`}
          aria-describedby="editor-description"
          data-focus-trap="true"
          className={`relative w-full max-w-2xl flex flex-col ${
            highContrastMode ? 'high-contrast' : ''
          } ${reducedMotion ? 'motion-reduce' : ''}`}
        >
          {/* Hidden description for screen readers */}
          <div id="editor-description" className="sr-only">
            Editing {editingCard.content.type} card. Press Escape to cancel. Press Ctrl+S or Ctrl+Enter to save.
          </div>

          {/* Save status announcement region */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="save status"
            className="sr-only"
          >
            {saveStatus === SaveStatus.SAVING && 'Saving changes'}
            {saveStatus === SaveStatus.SUCCESS && 'Changes saved successfully'}
            {saveStatus === SaveStatus.ERROR && `Failed to save changes${saveError ? ': ' + saveError : ''}`}
          </div>

          {/* Edit mode announcement region */}
          <div
            role="status"
            aria-live="polite"
            aria-label="edit mode"
            className="sr-only"
          >
            Edit mode entered for {editingCard.content.type} card
          </div>

          {/* Status bar - above the editor */}
          <div
            className={`flex items-center justify-between px-4 py-2 bg-gray-800 text-white rounded-t-lg ${
              highContrastMode ? 'high-contrast:bg-black high-contrast:text-white high-contrast:border-2 high-contrast:border-white' : ''
            }`}
            id="editor-status-bar"
          >
            <SaveStatusIndicator
              status={saveStatus}
              errorMessage={saveError || undefined}
              className="text-white"
            />
            {saveStatus === SaveStatus.IDLE && (
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"
                  aria-hidden="true"
                />
                Editing
              </div>
            )}
          </div>

          {/* Editor content */}
          <div
            className={`relative bg-white rounded-b-lg shadow-xl overflow-hidden max-h-[calc(80vh-2rem)] ${
              highContrastMode ? 'high-contrast:bg-white high-contrast:text-black high-contrast:border-2 high-contrast:border-black' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto max-h-[calc(80vh-2rem)]">
              {renderEditor()}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  // Render overlay in portal
  return createPortal(overlay, document.body);
};

export default EditorOverlay;
