/**
 * useUnsavedChanges Hook Tests
 *
 * Tests for detecting and tracking unsaved changes in editors
 */

import { renderHook, act } from '@testing-library/react';
import { useUnsavedChanges } from '../useUnsavedChanges';

describe('useUnsavedChanges Hook', () => {
  describe('Change Detection', () => {
    it('should detect changes when current value differs from initial', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: 'initial', currentValue: 'modified' })
      );

      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should return false when values are identical', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: 'same', currentValue: 'same' })
      );

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should handle object comparisons', () => {
      const initial = { text: 'hello', count: 5 };
      const modified = { text: 'hello', count: 10 };

      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: initial, currentValue: modified })
      );

      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should detect no changes for identical objects', () => {
      const value = { text: 'hello', count: 5 };

      const { result } = renderHook(() =>
        useUnsavedChanges({
          initialValue: value,
          currentValue: { ...value }
        })
      );

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should handle array comparisons', () => {
      const initial = ['a', 'b', 'c'];
      const modified = ['a', 'b', 'd'];

      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: initial, currentValue: modified })
      );

      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should handle nested object changes', () => {
      const initial = { user: { name: 'John', age: 30 } };
      const modified = { user: { name: 'John', age: 31 } };

      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: initial, currentValue: modified })
      );

      expect(result.current.hasUnsavedChanges).toBe(true);
    });
  });

  describe('Custom Comparison', () => {
    it('should use custom comparator when provided', () => {
      const customComparator = (a: string, b: string): boolean => {
        return a.toLowerCase() === b.toLowerCase();
      };

      const { result } = renderHook(() =>
        useUnsavedChanges({
          initialValue: 'Hello',
          currentValue: 'HELLO',
          comparator: customComparator
        })
      );

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should detect changes with custom comparator', () => {
      const customComparator = (a: number, b: number): boolean => {
        return Math.abs(a - b) < 0.01; // Fuzzy comparison
      };

      const { result } = renderHook(() =>
        useUnsavedChanges({
          initialValue: 1.0,
          currentValue: 1.5,
          comparator: customComparator
        })
      );

      expect(result.current.hasUnsavedChanges).toBe(true);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset unsaved changes flag', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: 'initial', currentValue: 'modified' })
      );

      expect(result.current.hasUnsavedChanges).toBe(true);

      act(() => {
        result.current.resetChanges();
      });

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should update initial value on reset', () => {
      const { result, rerender } = renderHook(
        ({ current }) => useUnsavedChanges({ initialValue: 'initial', currentValue: current }),
        { initialProps: { current: 'modified' } }
      );

      expect(result.current.hasUnsavedChanges).toBe(true);

      act(() => {
        result.current.resetChanges();
      });

      // After reset, current value becomes new initial
      rerender({ current: 'modified' });
      expect(result.current.hasUnsavedChanges).toBe(false);
    });
  });

  describe('Change Tracking', () => {
    it('should track number of changes', () => {
      const { result, rerender } = renderHook(
        ({ current }) => useUnsavedChanges({ initialValue: 'initial', currentValue: current }),
        { initialProps: { current: 'initial' } }
      );

      expect(result.current.changeCount).toBe(0);

      rerender({ current: 'change1' });
      expect(result.current.changeCount).toBe(1);

      rerender({ current: 'change2' });
      expect(result.current.changeCount).toBe(2);
    });

    it('should not increment count when changing back to initial', () => {
      const { result, rerender } = renderHook(
        ({ current }) => useUnsavedChanges({ initialValue: 'initial', currentValue: current }),
        { initialProps: { current: 'initial' } }
      );

      rerender({ current: 'modified' });
      expect(result.current.changeCount).toBe(1);

      rerender({ current: 'initial' });
      expect(result.current.changeCount).toBe(1);
    });

    it('should provide last changed timestamp', () => {
      const { result, rerender } = renderHook(
        ({ current }) => useUnsavedChanges({ initialValue: 'initial', currentValue: current }),
        { initialProps: { current: 'initial' } }
      );

      expect(result.current.lastChangedAt).toBeNull();

      rerender({ current: 'modified' });
      expect(result.current.lastChangedAt).toBeInstanceOf(Date);
    });
  });

  describe('Callback Triggers', () => {
    it('should call onChange when changes are detected', () => {
      const onChange = jest.fn();
      const { rerender } = renderHook(
        ({ current }) =>
          useUnsavedChanges({
            initialValue: 'initial',
            currentValue: current,
            onChange
          }),
        { initialProps: { current: 'initial' } }
      );

      rerender({ current: 'modified' });

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should call onChange when changes are cleared', () => {
      const onChange = jest.fn();
      const { result } = renderHook(
        ({ current }) =>
          useUnsavedChanges({
            initialValue: 'initial',
            currentValue: current,
            onChange
          }),
        { initialProps: { current: 'modified' } }
      );

      onChange.mockClear();

      act(() => {
        result.current.resetChanges();
      });

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should not call onChange unnecessarily', () => {
      const onChange = jest.fn();
      const { rerender } = renderHook(
        ({ current }) =>
          useUnsavedChanges({
            initialValue: 'initial',
            currentValue: current,
            onChange
          }),
        { initialProps: { current: 'modified' } }
      );

      onChange.mockClear();

      // Same modified value - shouldn't trigger onChange
      rerender({ current: 'modified' });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Warning Prompts', () => {
    it('should generate warning message when there are unsaved changes', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: 'initial', currentValue: 'modified' })
      );

      expect(result.current.getWarningMessage()).toBe(
        'You have unsaved changes. Are you sure you want to leave?'
      );
    });

    it('should return null when there are no unsaved changes', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: 'same', currentValue: 'same' })
      );

      expect(result.current.getWarningMessage()).toBeNull();
    });

    it('should use custom warning message when provided', () => {
      const customMessage = 'Custom warning message';
      const { result } = renderHook(() =>
        useUnsavedChanges({
          initialValue: 'initial',
          currentValue: 'modified',
          warningMessage: customMessage
        })
      );

      expect(result.current.getWarningMessage()).toBe(customMessage);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: null, currentValue: 'value' })
      );

      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should handle undefined values', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: undefined, currentValue: 'value' })
      );

      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should handle empty strings', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: '', currentValue: '' })
      );

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should handle whitespace-only changes', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({ initialValue: 'text', currentValue: 'text ' })
      );

      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should handle rapid value updates', () => {
      const { result, rerender } = renderHook(
        ({ current }) => useUnsavedChanges({ initialValue: 'initial', currentValue: current }),
        { initialProps: { current: 'initial' } }
      );

      // Rapid updates
      for (let i = 0; i < 100; i++) {
        rerender({ current: `value${i}` });
      }

      expect(result.current.hasUnsavedChanges).toBe(true);
      expect(result.current.changeCount).toBe(100);
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const renderSpy = jest.fn();
      const { rerender } = renderHook(
        ({ current }) => {
          renderSpy();
          return useUnsavedChanges({ initialValue: 'initial', currentValue: current });
        },
        { initialProps: { current: 'initial' } }
      );

      const initialRenderCount = renderSpy.mock.calls.length;

      // Same value - should not cause re-render
      rerender({ current: 'initial' });

      expect(renderSpy.mock.calls.length).toBe(initialRenderCount + 1); // Only the rerender call
    });

    it('should handle large objects efficiently', () => {
      const largeObject = {
        data: Array(1000).fill(0).map((_, i) => ({ id: i, value: `item${i}` }))
      };

      const { result } = renderHook(() =>
        useUnsavedChanges({
          initialValue: largeObject,
          currentValue: largeObject
        })
      );

      expect(result.current.hasUnsavedChanges).toBe(false);
    });
  });
});
