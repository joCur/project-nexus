/**
 * useUnsavedChanges Hook
 *
 * Detects and tracks unsaved changes in editors by comparing
 * current value against initial value.
 *
 * Features:
 * - Deep object/array comparison
 * - Custom comparison functions
 * - Change tracking and timestamps
 * - Reset functionality
 * - Callback notifications
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseUnsavedChangesOptions<T> {
  /** Initial value to compare against */
  initialValue: T;
  /** Current value */
  currentValue: T;
  /** Custom comparator function (returns true if values are equal) */
  comparator?: (a: T, b: T) => boolean;
  /** Callback when change state changes */
  onChange?: (hasChanges: boolean) => void;
  /** Custom warning message */
  warningMessage?: string;
}

export interface UseUnsavedChangesReturn {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Number of times the value has changed */
  changeCount: number;
  /** Timestamp of last change */
  lastChangedAt: Date | null;
  /** Reset the unsaved changes state */
  resetChanges: () => void;
  /** Get warning message if there are unsaved changes */
  getWarningMessage: () => string | null;
}

/**
 * Default deep equality comparator using JSON serialization
 */
function defaultComparator<T>(a: T, b: T): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    // Fallback to strict equality for non-serializable values
    return a === b;
  }
}

/**
 * Hook to detect and track unsaved changes
 */
export function useUnsavedChanges<T>({
  initialValue,
  currentValue,
  comparator = defaultComparator,
  onChange,
  warningMessage = 'You have unsaved changes. Are you sure you want to leave?'
}: UseUnsavedChangesOptions<T>): UseUnsavedChangesReturn {
  // Track the baseline value (can be updated via reset)
  const [baselineValue, setBaselineValue] = useState<T>(initialValue);

  // Track change metadata
  const [changeCount, setChangeCount] = useState<number>(0);
  const [lastChangedAt, setLastChangedAt] = useState<Date | null>(null);

  // Previous hasChanges state to detect transitions
  const previousHasChangesRef = useRef<boolean>(false);
  const previousValueRef = useRef<T>(currentValue);
  const isInitialRender = useRef(true);

  // Calculate if there are unsaved changes
  const hasUnsavedChanges = !comparator(currentValue, baselineValue);

  // Track changes and update metadata
  useEffect(() => {
    // Skip on initial render
    if (isInitialRender.current) {
      isInitialRender.current = false;
      previousValueRef.current = currentValue;
      return;
    }

    const hasChanges = !comparator(currentValue, baselineValue);
    const valueChanged = !comparator(currentValue, previousValueRef.current);

    // Increment count whenever value actually changes (even if still different from baseline)
    if (valueChanged) {
      setChangeCount(prev => prev + 1);
      if (hasChanges) {
        setLastChangedAt(new Date());
      }
    }

    // Call onChange callback if state changed
    if (hasChanges !== previousHasChangesRef.current && onChange) {
      onChange(hasChanges);
    }

    previousHasChangesRef.current = hasChanges;
    previousValueRef.current = currentValue;
  }, [currentValue, baselineValue, comparator, onChange]);

  /**
   * Reset changes by updating baseline to current value
   */
  const resetChanges = useCallback((): void => {
    setBaselineValue(currentValue);
    setLastChangedAt(null);

    // Notify onChange that changes have been reset
    if (previousHasChangesRef.current && onChange) {
      onChange(false);
    }

    previousHasChangesRef.current = false;
  }, [currentValue, onChange]);

  /**
   * Get warning message if there are unsaved changes
   */
  const getWarningMessage = useCallback((): string | null => {
    return hasUnsavedChanges ? warningMessage : null;
  }, [hasUnsavedChanges, warningMessage]);

  return {
    hasUnsavedChanges,
    changeCount,
    lastChangedAt,
    resetChanges,
    getWarningMessage
  };
}

export default useUnsavedChanges;
