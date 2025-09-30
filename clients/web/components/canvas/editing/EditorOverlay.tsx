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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@apollo/client';
import { useCardStore } from '@/stores/cardStore';
import { useCardOperations } from '@/hooks/useCardOperations';
import { useWorkspacePermissionContextSafe } from '@/contexts/WorkspacePermissionContext';
import type { Card, CardContent, TextCard, CodeCard, LinkCard, ImageCard } from '@/types/card.types';
import { GET_CARDS_IN_BOUNDS } from '@/lib/graphql/cardOperations';
import {
  TextEditor,
  CodeEditor,
  LinkEditor,
  ImageEditor} from './index';
import { isTextCard, isCodeCard, isLinkCard, isImageCard } from '@/types/card.types';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger({ component: 'EditorOverlay' });

/**
 * Default transition animations for edit overlay
 */
const overlayTransition = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

const transitionConfig = {
  duration: 0.15,
  ease: 'easeInOut' as const
};

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [originalContent, setOriginalContent] = useState<unknown>(null);

  // Get the card being edited from GraphQL data
  const editingCard = useMemo((): Card | null => {
    if (!editingCardId || !cardsData?.cardsInBounds) return null;
    const backendCard = cardsData.cardsInBounds.find((c: any) => c.id === editingCardId);
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
            alt: backendCard.title || '',
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
  useEffect(() => {
    if (editingCard && !originalContent) {
      setOriginalContent(editingCard.content);
    } else if (!editingCard) {
      setOriginalContent(null);
      setSaveError(null);
      setIsSaving(false);
    }
  }, [editingCard, originalContent]);

  /**
   * Save changes and exit edit mode
   */
  const handleSave = useCallback(async (newContent: unknown): Promise<void> => {
    if (!editingCard || !editingCardId) return;

    setIsSaving(true);
    setSaveError(null);

    if (enableServerPersistence) {
      try {
        // Persist to server
        const updatePayload = {
          id: editingCardId,
          updates: {
            content: newContent as CardContent
          } as Partial<Card>
        };

        const success = await updateCardOnServer(updatePayload);

        if (!success) {
          throw new Error('Failed to save changes to server');
        }

        // Success - clear edit state
        clearEditingCard();
      } catch (error) {
        // Rollback on failure
        logger.error('Failed to save card', {
          cardId: editingCardId,
          error: error instanceof Error ? error.message : 'Unknown error',
          context: { enableServerPersistence }
        });
        setSaveError('Failed to save changes');
        setIsSaving(false);
        // Keep editor open for retry
        return;
      }
    } else {
      // No server persistence - just update local state
      clearEditingCard();
    }

    setIsSaving(false);
  }, [editingCard, editingCardId, enableServerPersistence, updateCardOnServer, clearEditingCard]);

  /**
   * Cancel editing and restore original content
   */
  const handleCancel = useCallback((): void => {
    clearEditingCard();
    setSaveError(null);
    setIsSaving(false);
    setOriginalContent(null);
  }, [clearEditingCard]);

  /**
   * Determine which editor component to render based on card type
   */
  const renderEditor = useCallback(() => {
    if (!editingCard) return null;

    console.log('[EditorOverlay] Rendering editor for card type:', editingCard.content.type, editingCard);

    if (isTextCard(editingCard)) {
      console.log('[EditorOverlay] Rendering TextEditor');
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
      console.log('[EditorOverlay] Rendering CodeEditor');
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
      console.log('[EditorOverlay] Rendering LinkEditor');
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
      console.log('[EditorOverlay] Rendering ImageEditor');
      const imageCard = editingCard as ImageCard;
      return (
        <ImageEditor
          initialData={{
            url: imageCard.content.url,
            alt: imageCard.content.alt || '',
            caption: imageCard.content.caption || '',
            size: 'medium',
            alignment: 'center'
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

    console.log('[EditorOverlay] Falling back to TextEditor for unknown type');

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
      <motion.div
        key={`editor-${editingCardId}`}
        {...overlayTransition}
        transition={transitionConfig}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={(e) => {
          // Close on backdrop click
          if (e.target === e.currentTarget) {
            handleCancel();
          }
        }}
      >
        <div className="relative w-full max-w-2xl flex flex-col">
          {/* Status bar - above the editor */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white rounded-t-lg">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              {isSaving ? 'Saving...' : 'Editing'}
            </div>
            {saveError && (
              <div className="flex items-center gap-2 text-xs text-red-300">
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />
                {saveError}
              </div>
            )}
          </div>

          {/* Editor content */}
          <motion.div
            className="relative bg-white rounded-b-lg shadow-xl overflow-hidden max-h-[calc(80vh-2rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto max-h-[calc(80vh-2rem)]">
              {renderEditor()}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // Render overlay in portal
  return createPortal(overlay, document.body);
};

export default EditorOverlay;
