/**
 * TextCardDisplay Component
 *
 * Unified component for displaying text cards with mode switching support.
 * Handles both read-only display and edit modes with smooth transitions:
 * - Read-only mode: Lightweight ReadOnlyEditor with clickable links and task checkboxes
 * - Edit mode: Full TextEditor with formatting tools and editing capabilities
 * - Smooth 200ms transitions between modes
 * - Double-click to edit functionality
 * - Visual indicators for edit mode (border, focus ring)
 * - Lazy loading of TextEditor (only loads when entering edit mode)
 *
 * Required Context Providers:
 * - None (self-contained component)
 *
 * @remarks This component optimizes bundle size by lazy loading the editor.
 */

import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReadOnlyEditor } from './ReadOnlyEditor';
import type { TextCard, TextCardContent, TiptapJSONContent } from '@/types/card.types';
import { isTextCardTiptap } from '@/types/card.types';
import { createContextLogger } from '@/utils/logger';

// Lazy load TextEditor for performance (only loads when entering edit mode)
const TextEditor = lazy(() => import('./TextEditor'));

// Create logger at module level with component context
const logger = createContextLogger({ component: 'TextCardDisplay' });

/**
 * Display modes for the text card
 */
export enum DisplayMode {
  READ_ONLY = 'read_only',
  EDIT = 'edit'
}

/**
 * Props for TextCardDisplay component
 */
export interface TextCardDisplayProps {
  /** Text card to display */
  card: TextCard;
  /** Callback when content is saved */
  onSave: (content: TextCardContent) => void | Promise<void>;
  /** Initial display mode (default: READ_ONLY) */
  initialMode?: DisplayMode;
  /** Controlled mode (overrides internal state) */
  mode?: DisplayMode;
  /** Callback when mode changes */
  onModeChange?: (mode: DisplayMode) => void;
  /** Whether to disable double-click to edit (default: false) */
  disableDoubleClickEdit?: boolean;
  /** Whether to hide the edit button in read-only mode (default: false) */
  hideEditButton?: boolean;
  /** Rounded corner style: 'all' (default), 'none', 'bottom-only' */
  roundedCorners?: 'all' | 'none' | 'bottom-only';
  /** Additional class names */
  className?: string;
}

/**
 * Loading skeleton for editor initialization
 */
const EditorLoadingSkeleton: React.FC = () => (
  <div
    data-testid="editor-loading-skeleton"
    className="w-full h-full flex items-center justify-center p-4"
  >
    <div className="animate-pulse space-y-3 w-full">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  </div>
);

/**
 * TextCardDisplay implementation
 */
export const TextCardDisplay: React.FC<TextCardDisplayProps> = ({
  card,
  onSave,
  initialMode = DisplayMode.READ_ONLY,
  mode: controlledMode,
  onModeChange,
  disableDoubleClickEdit = false,
  hideEditButton = false,
  roundedCorners = 'all',
  className = ''
}) => {
  // Internal mode state (used when not controlled)
  const [internalMode, setInternalMode] = useState<DisplayMode>(initialMode);

  // Determine effective mode (controlled vs uncontrolled)
  const isControlled = controlledMode !== undefined;
  const currentMode = isControlled ? controlledMode : internalMode;

  // Track if editor has been loaded (initialize true if starting in edit mode)
  const [editorLoaded, setEditorLoaded] = useState(
    initialMode === DisplayMode.EDIT || controlledMode === DisplayMode.EDIT
  );

  // Normalize content for read-only display
  const normalizedContent: TiptapJSONContent = isTextCardTiptap(card.content)
    ? card.content.content
    : {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: card.content.content ? [{ type: 'text', text: String(card.content.content) }] : []
        }]
      };

  /**
   * Handle mode change
   */
  const handleModeChange = useCallback((newMode: DisplayMode) => {
    logger.debug('Mode changing', {
      from: currentMode,
      to: newMode,
      cardId: card.id,
      isControlled
    });

    // Update internal state if not controlled
    if (!isControlled) {
      setInternalMode(newMode);
    }

    // Notify parent
    onModeChange?.(newMode);

    // Mark editor as loaded when entering edit mode
    if (newMode === DisplayMode.EDIT) {
      setEditorLoaded(true);
    }
  }, [currentMode, card.id, isControlled, onModeChange]);

  /**
   * Handle entering edit mode
   */
  const handleEnterEditMode = useCallback(() => {
    if (card.isLocked) {
      logger.warn('Cannot edit locked card', { cardId: card.id });
      return;
    }

    handleModeChange(DisplayMode.EDIT);
  }, [card.isLocked, card.id, handleModeChange]);

  /**
   * Handle double-click to edit
   */
  const handleDoubleClick = useCallback(() => {
    if (disableDoubleClickEdit || card.isLocked || currentMode === DisplayMode.EDIT) {
      return;
    }

    logger.debug('Double-click edit triggered', { cardId: card.id });
    handleEnterEditMode();
  }, [disableDoubleClickEdit, card.isLocked, card.id, currentMode, handleEnterEditMode]);

  /**
   * Handle save and switch to read-only mode
   */
  const handleSave = useCallback(async (content: TextCardContent) => {
    logger.debug('Saving content', {
      cardId: card.id,
      format: content.format
    });

    try {
      await onSave(content);
      handleModeChange(DisplayMode.READ_ONLY);
    } catch (error) {
      logger.error('Save failed', {
        cardId: card.id,
        error: error instanceof Error ? error.message : String(error)
      });
      // Remain in edit mode on error
      // Don't re-throw - error is handled by BaseEditor in TextEditor
    }
  }, [card.id, onSave, handleModeChange]);

  /**
   * Handle cancel and switch to read-only mode
   */
  const handleCancel = useCallback(() => {
    logger.debug('Edit cancelled', { cardId: card.id });
    handleModeChange(DisplayMode.READ_ONLY);
  }, [card.id, handleModeChange]);

  /**
   * Handle task checkbox updates in read-only mode
   */
  const handleReadOnlyUpdate = useCallback((updatedContent: TiptapJSONContent) => {
    logger.debug('Read-only content updated (task checkbox)', {
      cardId: card.id
    });

    // Create updated card content
    const updatedCardContent: TextCardContent = {
      ...card.content,
      content: updatedContent
    };

    // Save immediately
    onSave(updatedCardContent);
  }, [card.id, card.content, onSave]);

  // Log component mount and mode changes
  useEffect(() => {
    logger.debug('TextCardDisplay mounted', {
      cardId: card.id,
      initialMode: currentMode,
      isControlled
    });
  }, [card.id, currentMode, isControlled]);

  // Load editor when mode changes to edit (for controlled mode)
  useEffect(() => {
    if (currentMode === DisplayMode.EDIT) {
      setEditorLoaded(true);
    }
  }, [currentMode]);

  // Border style based on mode
  const borderClass = currentMode === DisplayMode.EDIT
    ? 'border-2 border-primary-500 ring-2 ring-primary-200'
    : 'border border-gray-200';

  // Rounded corners class based on prop
  const roundedClass = roundedCorners === 'all'
    ? 'rounded-lg'
    : roundedCorners === 'bottom-only'
    ? 'rounded-b-lg'
    : '';

  // Animation variants for mode transitions
  const containerVariants = {
    readOnly: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.2 }
    },
    edit: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.2 }
    }
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Accessibility: Announce mode changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {currentMode === DisplayMode.EDIT ? 'Edit mode active' : 'Read-only mode active'}
      </div>

      {/* Main display container with mode transitions */}
      <motion.div
        className={`text-card-display w-full h-full ${roundedClass} ${borderClass} transition-all duration-200 bg-white overflow-hidden`}
        variants={containerVariants}
        initial="readOnly"
        animate={currentMode === DisplayMode.EDIT ? 'edit' : 'readOnly'}
        onDoubleClick={handleDoubleClick}
      >
        <AnimatePresence mode="wait">
          {currentMode === DisplayMode.READ_ONLY ? (
            <motion.div
              key="read-only"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              <ReadOnlyEditor
                content={normalizedContent}
                onUpdate={handleReadOnlyUpdate}
                className="w-full h-full"
              />

              {/* Edit button (floating) */}
              {!card.isLocked && !hideEditButton && (
                <button
                  onClick={handleEnterEditMode}
                  aria-label="Edit content"
                  className="absolute top-2 right-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  Edit
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
              data-testid="text-editor"
            >
              {/* Lazy load TextEditor with loading skeleton */}
              <Suspense fallback={<EditorLoadingSkeleton />}>
                {editorLoaded && (
                  <TextEditor
                    card={card}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    autoFocus={true}
                    className="w-full h-full"
                  />
                )}
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

TextCardDisplay.displayName = 'TextCardDisplay';

export default TextCardDisplay;
