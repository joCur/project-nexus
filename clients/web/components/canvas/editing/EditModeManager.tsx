/**
 * EditModeManager Component
 *
 * Manages inline editing state for cards on the canvas, including:
 * - Edit mode state management (isEditing, editingCardId, editMode type)
 * - Transition animations for smooth editing experience
 * - Focus trap functionality to keep keyboard focus within editor
 * - Integration with CardRenderer for double-click handling
 * - Keyboard shortcut management (Escape to cancel, etc.)
 * - Server persistence with optimistic updates via useCardOperations
 * - Debounced auto-save infrastructure
 * - Comprehensive keyboard navigation between fields
 * - Cross-platform keyboard shortcut support
 * - Field validation and error handling
 *
 * Required Context Providers:
 * - Apollo Client (via ApolloProvider) - For GraphQL mutations in useCardOperations
 * - CardStore (via useCardStore) - For managing card editing state
 *
 * @requires ApolloProvider For GraphQL operations via useCardOperations hook
 * @requires CardStore For setEditingCard and clearEditingCard operations
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCardStore } from '@/stores/cardStore';
import { useCardOperations } from '@/hooks/useCardOperations';
import type { Card, CardId, CardContent } from '@/types/card.types';
import { debounce, type DebouncedFunc } from 'lodash';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger({ component: 'EditModeManager' });

/**
 * Singleton class for managing keyboard navigation and field focus
 */
class EditModeManagerSingleton {
  private static instance: EditModeManagerSingleton;
  private editFields: Map<string, HTMLElement[]> = new Map();
  private currentFieldIndex: Map<string, number> = new Map();
  private fieldValidators: Map<string, Map<number, (value: string) => boolean>> = new Map();
  private keyboardShortcuts: Map<string, boolean> = new Map();
  private focusTraps: Map<string, boolean> = new Map();
  private editingCards: Set<string> = new Set();
  private saveCallbacks: Array<(cardId: string) => void> = [];
  private cancelCallbacks: Array<(cardId: string) => void> = [];
  private globalKeyHandler: ((event: KeyboardEvent) => void) | null = null;

  private constructor() {}

  static getInstance(): EditModeManagerSingleton {
    if (!EditModeManagerSingleton.instance) {
      EditModeManagerSingleton.instance = new EditModeManagerSingleton();
    }
    return EditModeManagerSingleton.instance;
  }

  // Edit state management
  startEdit(cardId: string): void {
    this.editingCards.add(cardId);
  }

  endEdit(cardId: string): void {
    this.editingCards.delete(cardId);
    this.unregisterEditFields(cardId);
    this.currentFieldIndex.delete(cardId);
    this.focusTraps.delete(cardId);
  }

  isEditing(cardId?: string): boolean {
    if (cardId) {
      return this.editingCards.has(cardId);
    }
    return this.editingCards.size > 0;
  }

  // Field registration
  registerEditField(cardId: string, field: HTMLElement, index: number): void {
    if (!this.editFields.has(cardId)) {
      this.editFields.set(cardId, []);
    }
    const fields = this.editFields.get(cardId)!;
    fields[index] = field;
  }

  unregisterEditFields(cardId: string): void {
    this.editFields.delete(cardId);
    const validators = this.fieldValidators.get(cardId);
    if (validators) {
      validators.clear();
    }
  }

  // Focus navigation
  focusNextField(cardId: string): void {
    const fields = this.editFields.get(cardId);
    if (!fields || fields.length === 0) return;

    const currentIndex = this.currentFieldIndex.get(cardId) ?? 0;
    const nextIndex = (currentIndex + 1) % fields.length;

    this.currentFieldIndex.set(cardId, nextIndex);
    fields[nextIndex]?.focus();
  }

  focusPreviousField(cardId: string): void {
    const fields = this.editFields.get(cardId);
    if (!fields || fields.length === 0) return;

    const currentIndex = this.currentFieldIndex.get(cardId) ?? 0;
    const prevIndex = currentIndex === 0 ? fields.length - 1 : currentIndex - 1;

    this.currentFieldIndex.set(cardId, prevIndex);
    fields[prevIndex]?.focus();
  }

  focusField(cardId: string, index: number): void {
    const fields = this.editFields.get(cardId);
    if (!fields || !fields[index]) return;

    this.currentFieldIndex.set(cardId, index);
    fields[index].focus();
  }

  focusFirstField(cardId: string): void {
    this.focusField(cardId, 0);
  }

  focusLastField(cardId: string): void {
    const fields = this.editFields.get(cardId);
    if (!fields || fields.length === 0) return;
    this.focusField(cardId, fields.length - 1);
  }

  setCurrentFieldIndex(cardId: string, index: number): void {
    this.currentFieldIndex.set(cardId, index);
  }

  getNextFieldFromActive(cardId: string): HTMLElement | null {
    const fields = this.editFields.get(cardId);
    if (!fields || fields.length === 0) return null;

    const activeElement = document.activeElement as HTMLElement;
    const currentIndex = fields.indexOf(activeElement);

    if (currentIndex === -1) return fields[0];

    const nextIndex = (currentIndex + 1) % fields.length;
    return fields[nextIndex];
  }

  getPreviousFieldFromActive(cardId: string): HTMLElement | null {
    const fields = this.editFields.get(cardId);
    if (!fields || fields.length === 0) return null;

    const activeElement = document.activeElement as HTMLElement;
    const currentIndex = fields.indexOf(activeElement);

    if (currentIndex === -1) return fields[fields.length - 1];

    const prevIndex = currentIndex === 0 ? fields.length - 1 : currentIndex - 1;
    return fields[prevIndex];
  }

  // Validation
  setFieldValidator(cardId: string, fieldIndex: number, validator: (value: string) => boolean): void {
    if (!this.fieldValidators.has(cardId)) {
      this.fieldValidators.set(cardId, new Map());
    }
    this.fieldValidators.get(cardId)!.set(fieldIndex, validator);
  }

  validateAllFields(cardId: string): boolean {
    const validators = this.fieldValidators.get(cardId);
    if (!validators) return true;

    const fields = this.editFields.get(cardId);
    if (!fields) return true;

    for (const [index, validator] of validators) {
      const field = fields[index];
      if (field && (field as HTMLInputElement).value !== undefined) {
        const value = (field as HTMLInputElement).value;
        if (!validator(value)) {
          return false;
        }
      }
    }
    return true;
  }

  focusFirstInvalidField(cardId: string): void {
    const validators = this.fieldValidators.get(cardId);
    if (!validators) return;

    const fields = this.editFields.get(cardId);
    if (!fields) return;

    for (const [index, validator] of validators) {
      const field = fields[index];
      if (field && (field as HTMLInputElement).value !== undefined) {
        const value = (field as HTMLInputElement).value;
        if (!validator(value)) {
          this.focusField(cardId, index);
          return;
        }
      }
    }
  }

  // Keyboard shortcuts
  setKeyboardShortcutActive(shortcut: string, active: boolean): void {
    this.keyboardShortcuts.set(shortcut, active);
  }

  isKeyboardShortcutActive(shortcut: string): boolean {
    return this.keyboardShortcuts.get(shortcut) ?? false;
  }

  clearKeyboardShortcuts(): void {
    this.keyboardShortcuts.clear();
  }

  // Platform detection
  isMacPlatform(): boolean {
    return navigator.platform.toLowerCase().includes('mac');
  }

  getModifierKey(): string {
    return this.isMacPlatform() ? '⌘' : 'Ctrl';
  }

  // Focus trap
  enableFocusTrap(cardId: string): void {
    this.focusTraps.set(cardId, true);
  }

  disableFocusTrap(cardId: string): void {
    this.focusTraps.delete(cardId);
  }

  isFocusTrapped(cardId: string): boolean {
    return this.focusTraps.get(cardId) ?? false;
  }

  shouldPreventFocus(cardId: string, target: HTMLElement): boolean {
    if (!this.isFocusTrapped(cardId)) return false;

    const fields = this.editFields.get(cardId);
    if (!fields) return false;

    return !fields.includes(target);
  }

  // Event handling
  onSave(callback: (cardId: string) => void): void {
    this.saveCallbacks.push(callback);
  }

  onCancel(callback: (cardId: string) => void): void {
    this.cancelCallbacks.push(callback);
  }

  triggerSave(cardId: string): void {
    this.saveCallbacks.forEach(cb => cb(cardId));
  }

  triggerCancel(cardId: string): void {
    this.cancelCallbacks.forEach(cb => cb(cardId));
  }

  saveChanges(cardId: string): void {
    if (this.validateAllFields(cardId)) {
      this.triggerSave(cardId);
    } else {
      this.focusFirstInvalidField(cardId);
    }
  }

  cancelEdit(cardId: string): void {
    this.triggerCancel(cardId);
  }

  // Global keyboard handler
  setGlobalKeyboardHandler(handler: (event: KeyboardEvent) => void): void {
    this.globalKeyHandler = handler;
  }

  handleGlobalKeyboardEvent(event: KeyboardEvent): void {
    if (this.globalKeyHandler) {
      this.globalKeyHandler(event);
    }
  }
}

// Export the singleton for keyboard navigation
export const EditModeManagerInstance = EditModeManagerSingleton;

/**
 * Edit mode types based on card type
 * Using TypeScript enum with lowercase values per architecture guidelines
 */
export enum EditMode {
  TEXT = 'text',
  CODE = 'code',
  LINK = 'link',
  IMAGE_CAPTION = 'image-caption',
  METADATA = 'metadata'
}

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
  /** Callback for auto-save preparation (debounced) */
  onAutoSavePrepare?: (cardId: CardId, content: unknown) => void;
  /** Whether editing is allowed for this card */
  canEdit?: boolean;
  /** Custom editor component to use */
  editorComponent?: React.ComponentType<EditModeEditorProps>;
  /** Additional class names */
  className?: string;
  /** Workspace ID for server operations */
  workspaceId?: string;
  /** Auto-save delay in milliseconds (default: 5000) */
  autoSaveDelay?: number;
  /** Whether to enable server persistence */
  enableServerPersistence?: boolean;
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
): void => {
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

    container.addEventListener('keydown', handleTabKey);
    return (): void => container.removeEventListener('keydown', handleTabKey);
  }, [containerRef, isActive]);
};

/**
 * EditModeManager component implementation
 */
export const EditModeManagerComponent: React.FC<EditModeManagerProps> = ({
  card,
  children,
  onEditStart,
  onEditEnd,
  onEditCancel,
  onAutoSavePrepare,
  canEdit = true,
  editorComponent: EditorComponent,
  className = '',
  workspaceId = 'default-workspace',
  autoSaveDelay = 5000,
  enableServerPersistence = true
}) => {
  // Store integration
  const { setEditingCard, clearEditingCard } = useCardStore();

  // Server operations hook
  const { updateCard: updateCardOnServer } = useCardOperations(workspaceId);
  // Edit mode state
  const [editState, setEditState] = useState<EditModeState>({
    isEditing: false,
    editingCardId: null,
    editMode: null,
    originalContent: undefined,
    isDirty: false
  });

  // Additional state for server persistence
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Refs for focus management
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Apply focus trap when in edit mode
  useFocusTrap(editorRef, editState.isEditing);

  /**
   * Determine edit mode based on card type
   */
  const getEditModeForCard = useCallback((card: Card): EditMode => {
    switch (card.content.type) {
      case 'text':
        return EditMode.TEXT;
      case 'code':
        return EditMode.CODE;
      case 'link':
        return EditMode.LINK;
      case 'image':
        return EditMode.IMAGE_CAPTION;
      default:
        return EditMode.METADATA;
    }
  }, []);

  /**
   * Debounced auto-save preparation
   */
  const debouncedAutoSave = useCallback((): DebouncedFunc<(cardId: CardId, content: unknown) => void> => {
    const fn = debounce((cardId: CardId, content: unknown): void => {
      onAutoSavePrepare?.(cardId, content);
    }, autoSaveDelay);
    return fn;
  }, [onAutoSavePrepare, autoSaveDelay])();

  /**
   * Start editing mode
   */
  const startEditing = useCallback((): void => {
    if (!card || !canEdit || card.isLocked) return;

    const editMode = getEditModeForCard(card);

    setEditState({
      isEditing: true,
      editingCardId: card.id,
      editMode,
      originalContent: card.content,
      isDirty: false
    });

    // Update store state
    setEditingCard(card.id);

    // Clear any existing auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    onEditStart?.(card.id, editMode);
  }, [card, canEdit, getEditModeForCard, onEditStart, setEditingCard]);

  /**
   * Save changes and exit edit mode
   */
  const saveAndExit = useCallback(async (newContent: unknown): Promise<void> => {
    if (!editState.editingCardId || !card) return;

    // Clear auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    debouncedAutoSave.cancel();

    setIsSaving(true);
    setSaveError(null);

    // Optimistic update - update UI immediately
    onEditEnd?.(editState.editingCardId, newContent);

    if (enableServerPersistence) {
      try {
        // Persist to server
        const updatePayload = {
          id: editState.editingCardId,
          updates: {
            content: newContent as CardContent
          } as Partial<Card>
        };

        const success = await updateCardOnServer(updatePayload);

        if (!success) {
          throw new Error('Failed to save changes to server');
        }

        // Success - clear edit state
        setEditState({
          isEditing: false,
          editingCardId: null,
          editMode: null,
          originalContent: undefined,
          isDirty: false
        });

        clearEditingCard();
      } catch (error) {
        // Rollback on failure
        logger.error('Failed to save card', {
          cardId: editState.editingCardId,
          error: error instanceof Error ? error.message : 'Unknown error',
          context: { enableServerPersistence }
        });
        setSaveError('Failed to save changes');

        // Revert optimistic update
        onEditCancel?.(editState.editingCardId);

        // Keep editor open for retry
        return;
      } finally {
        setIsSaving(false);
      }
    } else {
      // No server persistence - just update local state
      setEditState({
        isEditing: false,
        editingCardId: null,
        editMode: null,
        originalContent: undefined,
        isDirty: false
      });

      clearEditingCard();
      setIsSaving(false);
    }
  }, [editState.editingCardId, card, onEditEnd, onEditCancel, enableServerPersistence, updateCardOnServer, clearEditingCard, debouncedAutoSave]);

  /**
   * Cancel editing and restore original content
   */
  const cancelEditing = useCallback((): void => {
    if (!editState.editingCardId) return;

    // Clear auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    debouncedAutoSave.cancel();

    setEditState({
      isEditing: false,
      editingCardId: null,
      editMode: null,
      originalContent: undefined,
      isDirty: false
    });

    clearEditingCard();
    setSaveError(null);
    setIsSaving(false);

    onEditCancel?.(editState.editingCardId);
  }, [editState.editingCardId, onEditCancel, clearEditingCard, debouncedAutoSave]);

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    if (!editState.isEditing) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
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
    return (): void => document.removeEventListener('keydown', handleKeyDown);
  }, [editState.isEditing, cancelEditing]);

  /**
   * Handle double-click to enter edit mode
   */
  const handleDoubleClick = useCallback((e: React.MouseEvent): void => {
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
    // Extract string content from card - handle both string and Tiptap JSON
    const initialValue = useMemo(() => {
      if (card.content.type === 'text') {
        if (typeof card.content.content === 'string') {
          return card.content.content;
        } else {
          // If it's Tiptap JSON, extract plain text
          return JSON.stringify(card.content.content);
        }
      }
      return '';
    }, [card.content]);

    const [value, setValue] = useState(initialValue);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }, [autoFocus]);

    // Handle value changes with auto-save trigger
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const newValue = e.target.value;
      setValue(newValue);

      // Trigger auto-save preparation
      if (editState.editingCardId) {
        debouncedAutoSave(editState.editingCardId, { ...card.content, content: newValue });
      }
    };

    const handleSave = (): void => {
      onSave({ ...card.content, content: value });
    };

    const handleKeyDown = (e: React.KeyboardEvent): void => {
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
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-full h-full resize-none border-0 outline-none bg-transparent"
          placeholder="Enter text..."
          disabled={isSaving}
        />
        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {saveError && (
          <div className="text-xs text-red-500 mt-1">
            {saveError}
          </div>
        )}
      </div>
    );
  };

  // Use custom editor or default based on edit mode
  const ActiveEditor = EditorComponent || DefaultTextEditor;

  // Cleanup on unmount
  useEffect(() => {
    return (): void => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      debouncedAutoSave.cancel();
    };
  }, [debouncedAutoSave]);

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
          {isSaving ? 'Saving...' : 'Editing'}
        </div>
      )}

      {/* Error indicator */}
      {saveError && (
        <div className="absolute -top-8 right-0 text-xs text-red-500 flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />
          {saveError}
        </div>
      )}
    </div>
  );
};

EditModeManagerComponent.displayName = 'EditModeManagerComponent';

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

  const startEdit = useCallback((cardId: CardId, mode: EditMode, content?: unknown): void => {
    setEditState({
      isEditing: true,
      editingCardId: cardId,
      editMode: mode,
      originalContent: content,
      isDirty: false
    });
  }, []);

  const endEdit = useCallback((): void => {
    setEditState({
      isEditing: false,
      editingCardId: null,
      editMode: null,
      originalContent: undefined,
      isDirty: false
    });
  }, []);

  const setDirty = useCallback((isDirty: boolean): void => {
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

// Export the component with the original name for compatibility
export { EditModeManagerComponent as EditModeManager };
export default EditModeManagerComponent;