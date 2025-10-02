/**
 * BaseEditor Component
 *
 * A generic base component that provides common inline editing functionality
 * with render props pattern for specialized editors (TextEditor, CodeEditor, LinkEditor, ImageEditor).
 * This is the foundation that all Phase 2 editors build upon.
 *
 * Required Context Providers:
 * - None (self-contained component)
 *
 * @remarks This component has no external context dependencies and can be used standalone.
 */

import React, { useState, useCallback, useEffect, ReactNode } from 'react';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger({ component: 'BaseEditor' });

/**
 * Props passed to the children render function
 */
export interface BaseEditorChildProps<T> {
  /** Current value */
  value: T;
  /** Set the value */
  setValue: (value: T) => void;
  /** Handle save */
  handleSave: () => void;
  /** Handle cancel */
  handleCancel: () => void;
  /** Validation error message */
  validationError: string | null;
  /** Whether there are unsaved changes */
  hasChanges: boolean;
}

/**
 * Props for the BaseEditor
 */
export interface BaseEditorProps<T> {
  /** Initial value */
  initialValue: T;
  /** Save callback */
  onSave: (value: T) => void | Promise<void>;
  /** Cancel callback */
  onCancel: () => void;
  /** Validation function */
  validate?: (value: T) => boolean | string;
  /** Auto-focus */
  autoFocus?: boolean;
  /** Save on blur */
  saveOnBlur?: boolean;
  /** Show built-in controls */
  showControls?: boolean;
  /** Additional className */
  className?: string;
  /** Children render prop */
  children: (props: BaseEditorChildProps<T>) => ReactNode;
}

/**
 * BaseEditor implementation
 */
export function BaseEditor<T>({
  initialValue,
  onSave,
  onCancel,
  validate,
  autoFocus = true,
  saveOnBlur = false,
  showControls = true,
  className = '',
  children
}: BaseEditorProps<T>) {
  const [value, setValue] = useState<T>(initialValue);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    setHasChanges(JSON.stringify(value) !== JSON.stringify(initialValue));
  }, [value, initialValue]);

  // Handle save
  const handleSave = useCallback(async (): Promise<void> => {
    // Validate if validator provided
    if (validate) {
      const result = validate(value);
      if (typeof result === 'string') {
        setValidationError(result);
        return;
      }
      if (result === false) {
        setValidationError('Validation failed');
        return;
      }
    }

    setValidationError(null);

    try {
      await onSave(value);
    } catch (error) {
      logger.error('Save failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { hasChanges }
      });
      setValidationError('Save failed');
    }
  }, [value, validate, onSave]);

  // Handle cancel
  const handleCancel = useCallback((): void => {
    if (hasChanges) {
      const confirmCancel = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmCancel) return;
    }

    setValue(initialValue);
    setValidationError(null);
    onCancel();
  }, [hasChanges, initialValue, onCancel]);

  // Handle blur if saveOnBlur is enabled
  const handleBlur = useCallback((): void => {
    if (saveOnBlur && hasChanges) {
      handleSave();
    }
  }, [saveOnBlur, hasChanges, handleSave]);

  // Props for children
  const childProps: BaseEditorChildProps<T> = {
    value,
    setValue,
    handleSave,
    handleCancel,
    validationError,
    hasChanges
  };

  return (
    <div
      className={`base-editor ${className}`}
      onBlur={handleBlur}
    >
      {children(childProps)}

      {showControls && (
        <div className="base-editor-controls flex gap-2 mt-2">
          <button
            onClick={handleSave}
            disabled={!hasChanges || !!validationError}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      )}

      {validationError && (
        <div className="text-red-500 text-sm mt-1">
          {validationError}
        </div>
      )}
    </div>
  );
}

export default BaseEditor;