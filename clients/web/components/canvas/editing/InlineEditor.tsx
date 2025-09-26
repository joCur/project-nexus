/**
 * InlineEditor Component
 *
 * Base component for inline editing that provides common editing interactions,
 * focus management, and state coordination for card-specific editors.
 *
 * Features:
 * - Escape to cancel, click outside to save behavior
 * - Unsaved changes detection and warning
 * - Focus trap and keyboard event handling
 * - Consistent styling wrapper
 * - Extensible base for card type-specific editors
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useImperativeHandle
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Base props for InlineEditor components
 */
export interface InlineEditorProps<T = unknown> {
  /** Initial content value */
  initialValue: T;
  /** Callback when content should be saved */
  onSave: (value: T) => void | Promise<void>;
  /** Callback when editing is cancelled */
  onCancel: () => void;
  /** Optional callback for click outside behavior */
  onClickOutside?: (hasUnsavedChanges: boolean) => void;
  /** Whether to auto-focus the editor */
  autoFocus?: boolean;
  /** Optional styling */
  className?: string;
  /** Custom container styles */
  containerStyle?: React.CSSProperties;
  /** Whether to show save/cancel buttons */
  showControls?: boolean;
  /** Whether to warn about unsaved changes */
  warnOnUnsavedChanges?: boolean;
  /** Custom save button text */
  saveText?: string;
  /** Custom cancel button text */
  cancelText?: string;
  /** Whether the editor is in a loading state */
  isLoading?: boolean;
  /** Custom loading message */
  loadingMessage?: string;
  /** Validation function */
  validate?: (value: T) => boolean | string;
  /** Render prop or component children */
  children?: React.ReactNode | ((props: InlineEditorChildProps<T>) => React.ReactNode);
  /** Whether to save on blur/click outside */
  saveOnBlur?: boolean;
  /** Keyboard shortcuts configuration */
  shortcuts?: {
    save?: string[]; // e.g., ['ctrl+s', 'cmd+s']
    cancel?: string[]; // e.g., ['escape']
  };
}

/**
 * Props passed to children render function
 */
export interface InlineEditorChildProps<T = unknown> {
  /** Current value */
  value: T;
  /** Update value */
  setValue: (value: T) => void;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Save handler */
  handleSave: () => void | Promise<void>;
  /** Cancel handler */
  handleCancel: () => void;
  /** Validation error message */
  validationError?: string;
  /** Whether currently saving */
  isSaving: boolean;
  /** Reference to focus element */
  focusRef: React.RefObject<HTMLElement>;
}

/**
 * InlineEditor imperative handle
 */
export interface InlineEditorHandle {
  /** Force save current changes */
  save: () => void | Promise<void>;
  /** Cancel and reset to initial value */
  cancel: () => void;
  /** Check if there are unsaved changes */
  hasUnsavedChanges: () => boolean;
  /** Get current value */
  getValue: () => unknown;
  /** Set focus to editor */
  focus: () => void;
}

/**
 * Default keyboard shortcuts
 */
const DEFAULT_SHORTCUTS = {
  save: ['ctrl+s', 'cmd+s', 'ctrl+enter', 'cmd+enter'],
  cancel: ['escape']
};

/**
 * Animation variants for editor transitions
 */
const editorVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 }
};

/**
 * InlineEditor base component implementation
 */
function InlineEditorImpl<T = unknown>(
  {
    initialValue,
    onSave,
    onCancel,
    onClickOutside,
    autoFocus = true,
    className = '',
    containerStyle,
    showControls = true,
    warnOnUnsavedChanges = true,
    saveText = 'Save',
    cancelText = 'Cancel',
    isLoading = false,
    loadingMessage = 'Saving...',
    validate,
    children,
    saveOnBlur = true,
    shortcuts = DEFAULT_SHORTCUTS
  }: InlineEditorProps<T>,
  ref: React.ForwardedRef<InlineEditorHandle>
) {
    // State management
    const [value, setValue] = useState<T>(initialValue);
    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState<string | undefined>();

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const focusRef = useRef<HTMLElement>(null);
    const clickOutsideRef = useRef<boolean>(false);

    // Check for unsaved changes
    const hasUnsavedChanges = useCallback(() => {
      return JSON.stringify(value) !== JSON.stringify(initialValue);
    }, [value, initialValue]);

    // Validate current value
    const validateValue = useCallback(() => {
      if (!validate) return true;

      const result = validate(value);
      if (typeof result === 'string') {
        setValidationError(result);
        return false;
      }

      setValidationError(undefined);
      return result;
    }, [validate, value]);

    // Validate on value change
    useEffect(() => {
      validateValue();
    }, [value, validateValue]);

    // Save handler
    const handleSave = useCallback(async () => {
      if (!validateValue()) return;
      if (!hasUnsavedChanges()) {
        onCancel();
        return;
      }

      setIsSaving(true);
      try {
        await onSave(value);
      } catch (error) {
        console.error('Failed to save:', error);
        setValidationError('Failed to save changes');
      } finally {
        setIsSaving(false);
      }
    }, [validateValue, hasUnsavedChanges, onSave, value, onCancel]);

    // Cancel handler
    const handleCancel = useCallback(() => {
      if (warnOnUnsavedChanges && hasUnsavedChanges()) {
        const confirmCancel = window.confirm(
          'You have unsaved changes. Are you sure you want to cancel?'
        );
        if (!confirmCancel) return;
      }

      setValue(initialValue);
      setValidationError(undefined);
      onCancel();
    }, [warnOnUnsavedChanges, hasUnsavedChanges, initialValue, onCancel]);

    // Imperative handle
    useImperativeHandle(ref, () => ({
      save: handleSave,
      cancel: handleCancel,
      hasUnsavedChanges,
      getValue: () => value,
      focus: () => focusRef.current?.focus()
    }), [handleSave, handleCancel, hasUnsavedChanges, value]);

    // Auto-focus on mount
    useEffect(() => {
      if (autoFocus && focusRef.current) {
        focusRef.current.focus();
      }
    }, [autoFocus]);

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey;
        const cmd = e.metaKey;
        const alt = e.altKey;
        const shift = e.shiftKey;

        // Build shortcut string
        const shortcut = [
          ctrl && 'ctrl',
          cmd && 'cmd',
          alt && 'alt',
          shift && 'shift',
          key
        ].filter(Boolean).join('+');

        // Check save shortcuts
        if (shortcuts.save?.includes(shortcut)) {
          e.preventDefault();
          handleSave();
        }

        // Check cancel shortcuts
        if (shortcuts.cancel?.includes(shortcut)) {
          e.preventDefault();
          handleCancel();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts, handleSave, handleCancel]);

    // Click outside detection
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (!containerRef.current?.contains(e.target as Node)) {
          clickOutsideRef.current = true;

          if (onClickOutside) {
            onClickOutside(hasUnsavedChanges());
          } else if (saveOnBlur) {
            if (hasUnsavedChanges()) {
              handleSave();
            } else {
              onCancel();
            }
          }
        }
      };

      // Delay to avoid immediate trigger
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [onClickOutside, saveOnBlur, hasUnsavedChanges, handleSave, onCancel]);

    // Prevent unload with unsaved changes
    useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (warnOnUnsavedChanges && hasUnsavedChanges()) {
          e.preventDefault();
          e.returnValue = '';
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [warnOnUnsavedChanges, hasUnsavedChanges]);

    // Render children with props
    const renderChildren = () => {
      if (typeof children === 'function') {
        return children({
          value,
          setValue,
          hasUnsavedChanges: hasUnsavedChanges(),
          handleSave,
          handleCancel,
          validationError,
          isSaving,
          focusRef
        });
      }
      return children;
    };

    return (
      <AnimatePresence>
        <motion.div
          ref={containerRef}
          className={`inline-editor-container ${className}`}
          style={containerStyle}
          variants={editorVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.15, ease: 'easeInOut' }}
        >
          {/* Loading overlay */}
          {(isLoading || isSaving) && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-50 rounded">
              <div className="text-sm text-gray-600">
                {loadingMessage}
              </div>
            </div>
          )}

          {/* Editor content */}
          <div className="inline-editor-content">
            {renderChildren()}
          </div>

          {/* Validation error */}
          {validationError && (
            <div className="text-xs text-red-500 mt-1 px-2">
              {validationError}
            </div>
          )}

          {/* Controls */}
          {showControls && (
            <div className="inline-editor-controls flex justify-end gap-2 mt-2 px-2 pb-2">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !!validationError}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {saveText}
              </button>
            </div>
          )}

          {/* Status indicators */}
          {hasUnsavedChanges() && (
            <div className="absolute -top-6 right-0 text-xs text-orange-500 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full" />
              Unsaved changes
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
}

/**
 * Type-safe InlineEditor component with proper generic support
 */
export const InlineEditor = React.forwardRef(InlineEditorImpl) as <T = unknown>(
  props: InlineEditorProps<T> & { ref?: React.ForwardedRef<InlineEditorHandle> }
) => ReturnType<typeof InlineEditorImpl>;

/**
 * Hook for managing inline editor state
 */
export const useInlineEditor = <T = unknown>(initialValue: T) => {
  const [value, setValue] = useState<T>(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [originalValue, setOriginalValue] = useState<T>(initialValue);

  const startEdit = useCallback(() => {
    setOriginalValue(value);
    setIsEditing(true);
  }, [value]);

  const save = useCallback((newValue: T) => {
    setValue(newValue);
    setIsEditing(false);
  }, []);

  const cancel = useCallback(() => {
    setValue(originalValue);
    setIsEditing(false);
  }, [originalValue]);

  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(value) !== JSON.stringify(originalValue);
  }, [value, originalValue]);

  return {
    value,
    setValue,
    isEditing,
    startEdit,
    save,
    cancel,
    hasUnsavedChanges,
    originalValue
  };
};

/**
 * Hook for detecting unsaved changes
 */
export const useUnsavedChanges = <T = unknown>(
  currentValue: T,
  originalValue: T,
  compareFn?: (current: T, original: T) => boolean
) => {
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed = compareFn
      ? !compareFn(currentValue, originalValue)
      : JSON.stringify(currentValue) !== JSON.stringify(originalValue);

    setHasChanges(changed);
  }, [currentValue, originalValue, compareFn]);

  return hasChanges;
};

/**
 * Hook for detecting clicks outside an element
 */
export const useClickOutside = (
  ref: React.RefObject<HTMLElement>,
  handler: (event: MouseEvent) => void,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent) => {
      // Do nothing if clicking ref's element or descendent elements
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }

      handler(event);
    };

    // Add delay to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', listener);
      document.addEventListener('touchstart', listener as unknown as EventListener);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener as unknown as EventListener);
    };
  }, [ref, handler, enabled]);
};

/**
 * Hook for managing focus trap
 */
export const useFocusTrap = (
  containerRef: React.RefObject<HTMLElement>,
  isActive = false
) => {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const focusableElements = container.querySelectorAll(focusableSelectors);

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

export default InlineEditor;