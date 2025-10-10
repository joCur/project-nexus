/**
 * useAutosave Hook
 *
 * Provides autosave functionality with debouncing, retry logic, and save status management.
 * Follows architecture guidelines for enum standardization and error handling.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { TiptapJSONContent } from '@/types/card.types';
import { createContextLogger } from '@/utils/logger';
import { retryWithBackoff, defaultShouldRetry } from '@/utils/retryWithBackoff';

const logger = createContextLogger({ hook: 'useAutosave' });

/**
 * Save status enum with lowercase values per architecture guidelines
 * CRITICAL: Use enum constants in code, NOT string literals
 */
export enum SaveStatus {
  IDLE = 'idle',
  SAVING = 'saving',
  SUCCESS = 'success',
  ERROR = 'error'
}

/**
 * Options for useAutosave hook
 */
export interface UseAutosaveOptions {
  /** Callback to save content */
  onSave: (content: TiptapJSONContent) => Promise<void>;
  /** Debounce delay in milliseconds (default: 1000ms) */
  debounceMs?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
}

/**
 * Return value from useAutosave hook
 */
export interface UseAutosaveReturn {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last error that occurred during save (null if no error) */
  saveError: unknown | null;
  /** Manually trigger save (cancels pending debounced save) */
  triggerSave: () => void;
  /** Retry failed save */
  retryFailed: () => void;
}

/**
 * useAutosave hook
 *
 * Provides debounced autosave functionality with retry logic and status management.
 *
 * @param content - Current content to save
 * @param options - Autosave options
 * @returns Save status and control functions
 */
export function useAutosave(
  content: TiptapJSONContent,
  options: UseAutosaveOptions
): UseAutosaveReturn {
  const { onSave, debounceMs = 1000, maxRetries = 3 } = options;

  // Save status state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(SaveStatus.IDLE);
  const [saveError, setSaveError] = useState<unknown | null>(null);

  // Refs for managing timers and state
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<TiptapJSONContent>(content);
  const isUnmountedRef = useRef<boolean>(false);

  /**
   * Perform save operation with retry logic using retryWithBackoff utility
   */
  const performSave = useCallback(async (contentToSave: TiptapJSONContent): Promise<void> => {
    if (isUnmountedRef.current) {
      logger.debug('Save cancelled - component unmounted');
      return;
    }

    try {
      setSaveStatus(SaveStatus.SAVING);
      setSaveError(null); // Clear any previous error

      logger.debug('Saving content', {
        contentType: contentToSave.type
      });

      // Use retry utility with exponential backoff
      await retryWithBackoff(
        () => onSave(contentToSave),
        {
          maxRetries,
          initialDelay: 1000,
          maxDelay: 10000,
          shouldRetry: defaultShouldRetry,
          onRetry: (attempt, error) => {
            logger.info('Retrying save', {
              attempt,
              maxRetries,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      );

      if (isUnmountedRef.current) return;

      logger.info('Content saved successfully');

      // Set success status
      setSaveStatus(SaveStatus.SUCCESS);
      setSaveError(null); // Clear any previous error

      // Auto-hide success status after 2 seconds
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }

      successTimerRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          setSaveStatus(SaveStatus.IDLE);
        }
      }, 2000);

    } catch (error) {
      if (isUnmountedRef.current) return;

      logger.error('Save failed after retries', {
        error: error instanceof Error ? error.message : String(error),
        maxRetries
      });

      setSaveStatus(SaveStatus.ERROR);
      setSaveError(error); // Store the error for display
    }
  }, [onSave, maxRetries]);

  /**
   * Trigger save manually (cancels pending debounced save)
   */
  const triggerSave = useCallback(() => {
    // Cancel any pending debounced save
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    logger.debug('Manual save triggered');

    performSave(lastContentRef.current);
  }, [performSave]);

  /**
   * Retry failed save
   */
  const retryFailed = useCallback(() => {
    if (saveStatus !== SaveStatus.ERROR) {
      logger.warn('Retry called but not in error state', { saveStatus });
      return;
    }

    logger.info('Manual retry triggered');

    performSave(lastContentRef.current);
  }, [saveStatus, performSave]);

  /**
   * Debounce content changes and trigger autosave
   */
  useEffect(() => {
    // Store current content
    lastContentRef.current = content;

    // Cancel existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set up new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      logger.debug('Debounce timer expired - triggering save');
      performSave(content);
    }, debounceMs);

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, debounceMs, performSave]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;

      // Clear all timers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }

      logger.debug('useAutosave cleanup - all timers cleared');
    };
  }, []);

  return {
    saveStatus,
    saveError,
    triggerSave,
    retryFailed
  };
}
