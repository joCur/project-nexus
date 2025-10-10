/**
 * Tests for useAutosave hook
 *
 * TDD RED Phase: Tests for autosave functionality with debouncing,
 * retry logic, and save status management
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutosave, SaveStatus } from '../useAutosave';
import type { TiptapJSONContent } from '@/types/card.types';

// Mock logger
jest.mock('@/utils/logger', () => ({
  createContextLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('useAutosave', () => {
  // Mock Tiptap content
  const mockContent: TiptapJSONContent = {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: 'Test content' }]
    }]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Debouncing behavior', () => {
    test('should debounce save calls with 1 second delay (default)', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave }),
        { initialProps: { content: mockContent } }
      );

      // Initial status should be idle
      expect(result.current.saveStatus).toBe(SaveStatus.IDLE);

      // Change content multiple times within debounce window
      const updatedContent1: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated 1' }]
        }]
      };

      const updatedContent2: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated 2' }]
        }]
      };

      // Rerender with new content
      rerender({ content: updatedContent1 });

      // Wait 500ms (within debounce window)
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Save should not be called yet
      expect(onSave).not.toHaveBeenCalled();

      // Rerender with another update
      rerender({ content: updatedContent2 });

      // Wait another 500ms (still within debounce window from last change)
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Save should still not be called
      expect(onSave).not.toHaveBeenCalled();

      // Wait 1000ms (debounce delay)
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // Now save should be called once with the latest content
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith(updatedContent2);
      });
    });

    test('should support custom debounce delay', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const customDelay = 2000;

      const { rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, debounceMs: customDelay }),
        { initialProps: { content: mockContent } }
      );

      const updatedContent: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated' }]
        }]
      };

      rerender({ content: updatedContent });

      // Wait custom delay - 100ms (should not trigger)
      act(() => {
        jest.advanceTimersByTime(customDelay - 100);
      });

      expect(onSave).not.toHaveBeenCalled();

      // Wait remaining time
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
    });

    test('should cancel pending save on unmount', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);

      const { rerender, unmount } = renderHook(
        ({ content }) => useAutosave(content, { onSave }),
        { initialProps: { content: mockContent } }
      );

      const updatedContent: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated' }]
        }]
      };

      rerender({ content: updatedContent });

      // Wait 500ms (within debounce window)
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Unmount before debounce completes
      unmount();

      // Wait past debounce delay
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Save should not be called
      expect(onSave).not.toHaveBeenCalled();
    });

    test('should reset debounce timer on each content change', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);

      const { rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave }),
        { initialProps: { content: mockContent } }
      );

      const updates = [
        { type: 'paragraph', content: [{ type: 'text', text: 'Update 1' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Update 2' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Update 3' }] },
      ];

      // Make updates every 800ms (each resets the 1000ms timer)
      for (let i = 0; i < updates.length; i++) {
        const updatedContent: TiptapJSONContent = {
          ...mockContent,
          content: [updates[i]]
        };

        rerender({ content: updatedContent });

        act(() => {
          jest.advanceTimersByTime(800);
        });

        // No save should have been called yet
        expect(onSave).not.toHaveBeenCalled();
      }

      // Wait final debounce delay
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // Should save only once with the last update
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith({
          ...mockContent,
          content: [updates[updates.length - 1]]
        });
      });
    });
  });

  describe('Save status management', () => {
    test('should transition from idle → saving → success', async () => {
      // Create a promise we can control
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });

      const onSave = jest.fn().mockReturnValue(savePromise);

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave }),
        { initialProps: { content: mockContent } }
      );

      expect(result.current.saveStatus).toBe(SaveStatus.IDLE);

      const updatedContent: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated' }]
        }]
      };

      rerender({ content: updatedContent });

      // Fast-forward past debounce
      await act(async () => {
        jest.advanceTimersByTime(1000);
        // Give microtasks a chance to run
        await Promise.resolve();
      });

      // Should be saving
      expect(result.current.saveStatus).toBe(SaveStatus.SAVING);

      // Resolve the save
      await act(async () => {
        resolveSave!();
        await Promise.resolve();
      });

      // Should be success
      expect(result.current.saveStatus).toBe(SaveStatus.SUCCESS);
    });

    test('should transition from idle → saving → error on save failure', async () => {
      // Create a promise we can control
      let rejectSave: (error: Error) => void;
      const savePromise = new Promise<void>((resolve, reject) => {
        rejectSave = reject;
      });

      const onSave = jest.fn().mockReturnValue(savePromise);

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, maxRetries: 0 }), // No retries for faster test
        { initialProps: { content: mockContent } }
      );

      expect(result.current.saveStatus).toBe(SaveStatus.IDLE);

      const updatedContent: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated' }]
        }]
      };

      rerender({ content: updatedContent });

      // Fast-forward past debounce
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      // Should be saving
      expect(result.current.saveStatus).toBe(SaveStatus.SAVING);

      // Reject the save
      await act(async () => {
        rejectSave!(new Error('Save failed'));
        await Promise.resolve();
      });

      // Should be error
      expect(result.current.saveStatus).toBe(SaveStatus.ERROR);
    });

    test('should auto-hide success status after 2 seconds', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave }),
        { initialProps: { content: mockContent } }
      );

      const updatedContent: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated' }]
        }]
      };

      rerender({ content: updatedContent });

      // Complete save
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.saveStatus).toBe(SaveStatus.SUCCESS);
      });

      // Wait 2 seconds
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Should return to idle
      expect(result.current.saveStatus).toBe(SaveStatus.IDLE);
    });
  });

  describe('Retry logic', () => {
    test('should retry on network errors with exponential backoff', async () => {
      const networkError = new Error('Network request failed');
      const onSave = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(undefined);

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, maxRetries: 3 }),
        { initialProps: { content: mockContent } }
      );

      const updatedContent: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated' }]
        }]
      };

      rerender({ content: updatedContent });

      // Initial save attempt
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(onSave).toHaveBeenCalledTimes(1);

      // First retry (1 second backoff)
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(onSave).toHaveBeenCalledTimes(2);

      // Second retry (2 second backoff - exponential)
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(onSave).toHaveBeenCalledTimes(3);

      // Should succeed and transition to success
      await waitFor(() => {
        expect(result.current.saveStatus).toBe(SaveStatus.SUCCESS);
      });
    });

    test('should stop retrying on validation errors', async () => {
      const validationError = {
        message: 'Content exceeds maximum character limit',
        extensions: { code: 'VALIDATION_ERROR' }
      };
      const onSave = jest.fn().mockRejectedValue(validationError);

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, maxRetries: 3 }),
        { initialProps: { content: mockContent } }
      );

      const updatedContent: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated' }]
        }]
      };

      rerender({ content: updatedContent });

      // Initial save attempt
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(onSave).toHaveBeenCalledTimes(1);

      // Wait for retry backoff period
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Should not retry on validation error
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(result.current.saveStatus).toBe(SaveStatus.ERROR);
    });

    test('should stop retrying after max attempts', async () => {
      const networkError = new Error('Network request failed');
      const onSave = jest.fn().mockRejectedValue(networkError);

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, maxRetries: 3 }),
        { initialProps: { content: mockContent } }
      );

      const updatedContent: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated' }]
        }]
      };

      rerender({ content: updatedContent });

      // Initial attempt + 3 retries = 4 total attempts
      const totalAttempts = 4;

      // Initial save
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // Retry 1 (1s backoff)
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // Retry 2 (2s backoff)
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Retry 3 (4s backoff)
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });

      expect(onSave).toHaveBeenCalledTimes(totalAttempts);

      // Should be in error state
      expect(result.current.saveStatus).toBe(SaveStatus.ERROR);

      // Wait more time - no additional retries
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      expect(onSave).toHaveBeenCalledTimes(totalAttempts);
    });

    test('should allow manual retry after error', async () => {
      const networkError = new Error('Network request failed');
      const onSave = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(undefined);

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave, maxRetries: 0 }),
        { initialProps: { content: mockContent } }
      );

      const updatedContent: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated' }]
        }]
      };

      rerender({ content: updatedContent });

      // Initial save attempt (fails, no retries)
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.saveStatus).toBe(SaveStatus.ERROR);
      });

      expect(onSave).toHaveBeenCalledTimes(1);

      // Manual retry
      await act(async () => {
        result.current.retryFailed();
      });

      await waitFor(() => {
        expect(result.current.saveStatus).toBe(SaveStatus.SUCCESS);
      });

      expect(onSave).toHaveBeenCalledTimes(2);
    });
  });

  describe('Manual save trigger', () => {
    test('should allow manual save trigger', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(
        ({ content }) => useAutosave(content, { onSave }),
        { initialProps: { content: mockContent } }
      );

      expect(result.current.saveStatus).toBe(SaveStatus.IDLE);

      // Trigger manual save
      await act(async () => {
        result.current.triggerSave();
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith(mockContent);
        expect(result.current.saveStatus).toBe(SaveStatus.SUCCESS);
      });
    });

    test('should cancel pending debounced save when manually triggered', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);

      const { result, rerender } = renderHook(
        ({ content }) => useAutosave(content, { onSave }),
        { initialProps: { content: mockContent } }
      );

      const updatedContent: TiptapJSONContent = {
        ...mockContent,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated' }]
        }]
      };

      rerender({ content: updatedContent });

      // Wait 500ms (within debounce window)
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Trigger manual save
      await act(async () => {
        result.current.triggerSave();
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });

      // Wait past original debounce delay
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should still only have been called once
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('SaveStatus enum', () => {
    test('should use lowercase string values', () => {
      expect(SaveStatus.IDLE).toBe('idle');
      expect(SaveStatus.SAVING).toBe('saving');
      expect(SaveStatus.SUCCESS).toBe('success');
      expect(SaveStatus.ERROR).toBe('error');
    });
  });
});
