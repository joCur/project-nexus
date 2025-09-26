/**
 * EditModeManager Component
 *
 * Manages inline editing state for cards on the canvas, including:
 * - Edit mode state management (isEditing, editingCardId, editMode type)
 * - Transition animations for smooth editing experience
 * - Focus trap functionality to keep keyboard focus within editor
 * - Integration with CardRenderer for double-click handling
 * - Keyboard shortcut management (Escape to cancel, etc.)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card, CardId } from '@/types/card.types';

/**
 * Edit mode types based on card type
 */
export type EditMode = 'text' | 'code' | 'link' | 'image-caption' | 'metadata';

/**
 * Edit mode state interface
 */
export interface EditModeState {
  /** Whether currently in edit mode */
  isEditing: boolean;
  /** ID of the card being edited */
  editingCardId: CardId | null;
  /** Type of edit mode based on card type */
  editMode: EditMode | null;
  /** Original content before editing (for cancel/restore) */
  originalContent?: unknown;
  /** Whether changes have been made */
  isDirty: boolean;
}

/**
 * Props for EditModeManager component
 */
export interface EditModeManagerProps {
  /** Current card being potentially edited */
  card?: Card;
  /** Children to render (usually the card content) */
  children: React.ReactNode;
  /** Callback when entering edit mode */
  onEditStart?: (cardId: CardId, mode: EditMode) => void;
  /** Callback when exiting edit mode with save */
  onEditEnd?: (cardId: CardId, content: unknown) => void;
  /** Callback when canceling edit mode */
  onEditCancel?: (cardId: CardId) => void;
  /** Whether editing is allowed for this card */
  canEdit?: boolean;
  /** Custom editor component to use */
  editorComponent?: React.ComponentType<EditModeEditorProps>;
  /** Additional class names */
  className?: string;
}

/**
 * Props passed to editor components
 */
export interface EditModeEditorProps {
  /** Card being edited */
  card: Card;
  /** Original content */
  originalContent: unknown;
  /** Callback to save changes */
  onSave: (content: unknown) => void;
  /** Callback to cancel editing */
  onCancel: () => void;
  /** Whether the editor should auto-focus */
  autoFocus?: boolean;
}

/**
 * Default transition animations for edit mode
 */
const editModeTransition = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

const transitionConfig = {
  duration: 0.15,
  ease: 'easeInOut' as const
};

/**
 * Focus trap hook to keep focus within the editor
 */
const useFocusTrap = (
  containerRef: React.RefObject<HTMLDivElement>,
  isActive: boolean
) => {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'input, textarea, button, select, a[href], [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus first element
    firstElement.focus();

    const handleTabKey = (e: KeyboardEvent) => {
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

    container.addEventListener('keydown', handleTabKey);
    return () => container.removeEventListener('keydown', handleTabKey);
  }, [containerRef, isActive]);
};

/**
 * EditModeManager component implementation
 */
export const EditModeManager: React.FC<EditModeManagerProps> = ({
  card,
  children,
  onEditStart,
  onEditEnd,
  onEditCancel,
  canEdit = true,
  editorComponent: EditorComponent,
  className = ''
}) => {
  // Edit mode state
  const [editState, setEditState] = useState<EditModeState>({
    isEditing: false,
    editingCardId: null,
    editMode: null,
    originalContent: undefined,
    isDirty: false
  });

  // Refs for focus management
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Apply focus trap when in edit mode
  useFocusTrap(editorRef, editState.isEditing);

  /**
   * Determine edit mode based on card type
   */
  const getEditModeForCard = useCallback((card: Card): EditMode => {
    switch (card.content.type) {
      case 'text':
        return 'text';
      case 'code':
        return 'code';
      case 'link':
        return 'link';
      case 'image':
        return 'image-caption';
      default:
        return 'metadata';
    }
  }, []);

  /**
   * Start editing mode
   */
  const startEditing = useCallback(() => {
    if (!card || !canEdit || card.isLocked) return;

    const editMode = getEditModeForCard(card);

    setEditState({
      isEditing: true,
      editingCardId: card.id,
      editMode,
      originalContent: card.content,
      isDirty: false
    });

    onEditStart?.(card.id, editMode);
  }, [card, canEdit, getEditModeForCard, onEditStart]);

  /**
   * Save changes and exit edit mode
   */
  const saveAndExit = useCallback((newContent: unknown) => {
    if (!editState.editingCardId) return;

    setEditState({
      isEditing: false,
      editingCardId: null,
      editMode: null,
      originalContent: undefined,
      isDirty: false
    });

    onEditEnd?.(editState.editingCardId, newContent);
  }, [editState.editingCardId, onEditEnd]);

  /**
   * Cancel editing and restore original content
   */
  const cancelEditing = useCallback(() => {
    if (!editState.editingCardId) return;

    setEditState({
      isEditing: false,
      editingCardId: null,
      editMode: null,
      originalContent: undefined,
      isDirty: false
    });

    onEditCancel?.(editState.editingCardId);
  }, [editState.editingCardId, onEditCancel]);

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    if (!editState.isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditing();
      }
      // Ctrl/Cmd + Enter to save
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        // Note: Actual save is handled by the editor component
        // This is just a placeholder for the shortcut
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editState.isEditing, cancelEditing]);

  /**
   * Handle double-click to enter edit mode
   */
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!canEdit || !card || card.isLocked) return;

    e.preventDefault();
    e.stopPropagation();
    startEditing();
  }, [canEdit, card, startEditing]);

  /**
   * Default text editor component
   */
  const DefaultTextEditor: React.FC<EditModeEditorProps> = ({
    card,
    onSave,
    onCancel,
    autoFocus = true
  }) => {
    const [value, setValue] = useState(
      card.content.type === 'text' ? card.content.content : ''
    );
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }, [autoFocus]);

    const handleSave = () => {
      onSave({ ...card.content, content: value });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };

    return (
      <div className="w-full h-full p-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-full resize-none border-0 outline-none bg-transparent"
          placeholder="Enter text..."
        />
        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    );
  };

  // Use custom editor or default based on edit mode
  const ActiveEditor = EditorComponent || DefaultTextEditor;

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onDoubleClick={handleDoubleClick}
    >
      <AnimatePresence mode="wait">
        {editState.isEditing && card && editState.editingCardId === card.id ? (
          <motion.div
            ref={editorRef}
            key="editor"
            {...editModeTransition}
            transition={transitionConfig}
            className="absolute inset-0 z-50 bg-white rounded-lg shadow-lg"
          >
            <ActiveEditor
              card={card}
              originalContent={editState.originalContent}
              onSave={saveAndExit}
              onCancel={cancelEditing}
              autoFocus
            />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={false}
            animate={{ opacity: 1 }}
            className="w-full h-full"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit mode indicator */}
      {editState.isEditing && card && editState.editingCardId === card.id && (
        <div className="absolute -top-8 left-0 text-xs text-gray-500 flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Editing
        </div>
      )}
    </div>
  );
};

EditModeManager.displayName = 'EditModeManager';

/**
 * Hook to manage edit mode state externally
 */
export const useEditMode = () => {
  const [editState, setEditState] = useState<EditModeState>({
    isEditing: false,
    editingCardId: null,
    editMode: null,
    originalContent: undefined,
    isDirty: false
  });

  const startEdit = useCallback((cardId: CardId, mode: EditMode, content?: unknown) => {
    setEditState({
      isEditing: true,
      editingCardId: cardId,
      editMode: mode,
      originalContent: content,
      isDirty: false
    });
  }, []);

  const endEdit = useCallback(() => {
    setEditState({
      isEditing: false,
      editingCardId: null,
      editMode: null,
      originalContent: undefined,
      isDirty: false
    });
  }, []);

  const setDirty = useCallback((isDirty: boolean) => {
    setEditState(prev => ({ ...prev, isDirty }));
  }, []);

  return {
    editState,
    startEdit,
    endEdit,
    setDirty,
    isEditing: editState.isEditing,
    editingCardId: editState.editingCardId,
    isDirty: editState.isDirty
  };
};

export default EditModeManager;