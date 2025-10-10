/**
 * Tests for SaveStatusIndicator component
 *
 * TDD RED Phase: Tests for visual save status indicator with
 * different states and auto-hide behavior
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveStatusIndicator } from '../SaveStatusIndicator';
import { SaveStatus } from '@/hooks/useAutosave';

describe('SaveStatusIndicator', () => {
  describe('Visual states', () => {
    test('should not render anything in idle state', () => {
      const { container } = render(
        <SaveStatusIndicator status={SaveStatus.IDLE} />
      );

      // Should render nothing
      expect(container.firstChild).toBeNull();
    });

    test('should render saving indicator with spinner', () => {
      render(<SaveStatusIndicator status={SaveStatus.SAVING} />);

      // Should show "Saving..." text
      expect(screen.getByText(/saving/i)).toBeInTheDocument();

      // Should have loading spinner (aria-label or role)
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByLabelText(/saving/i)).toBeInTheDocument();
    });

    test('should render success indicator with checkmark', () => {
      render(<SaveStatusIndicator status={SaveStatus.SUCCESS} />);

      // Should show "Saved" text
      expect(screen.getByText(/saved/i)).toBeInTheDocument();

      // Should have checkmark icon (can be an SVG or icon component)
      const successIndicator = screen.getByRole('status');
      expect(successIndicator).toBeInTheDocument();

      // Visual check for success styling (green color)
      expect(successIndicator).toHaveClass('text-green-600');
    });

    test('should render error indicator with message', () => {
      render(<SaveStatusIndicator status={SaveStatus.ERROR} />);

      // Should show error message
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument();

      // Should have error styling
      const errorIndicator = screen.getByRole('alert');
      expect(errorIndicator).toBeInTheDocument();
      expect(errorIndicator).toHaveClass('text-red-600');
    });

    test('should render retry button on error', () => {
      const onRetry = jest.fn();

      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          onRetry={onRetry}
        />
      );

      // Should have retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    test('should not render retry button when onRetry not provided', () => {
      render(<SaveStatusIndicator status={SaveStatus.ERROR} />);

      // Should show error but no retry button
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });
  });

  describe('Auto-hide behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('should auto-hide success status after 2 seconds', async () => {
      render(
        <SaveStatusIndicator status={SaveStatus.SUCCESS} />
      );

      // Should be visible initially
      expect(screen.getByText(/saved/i)).toBeInTheDocument();

      // Wait 2 seconds
      jest.advanceTimersByTime(2000);

      // Should fade out or hide
      await waitFor(() => {
        expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
      });
    });

    test('should not auto-hide error status', () => {
      render(<SaveStatusIndicator status={SaveStatus.ERROR} />);

      // Should be visible
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument();

      // Wait 5 seconds
      jest.advanceTimersByTime(5000);

      // Should still be visible
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
    });

    test('should not auto-hide saving status', () => {
      render(<SaveStatusIndicator status={SaveStatus.SAVING} />);

      // Should be visible
      expect(screen.getByText(/saving/i)).toBeInTheDocument();

      // Wait 5 seconds
      jest.advanceTimersByTime(5000);

      // Should still be visible
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });

    test('should reset auto-hide timer on status change', async () => {
      const { rerender } = render(
        <SaveStatusIndicator status={SaveStatus.SUCCESS} />
      );

      // Wait 1 second
      jest.advanceTimersByTime(1000);

      // Change to saving, then back to success
      rerender(<SaveStatusIndicator status={SaveStatus.SAVING} />);
      rerender(<SaveStatusIndicator status={SaveStatus.SUCCESS} />);

      // Wait 1 second (total would be 2s from original success, but timer should reset)
      jest.advanceTimersByTime(1000);

      // Should still be visible (timer reset)
      expect(screen.getByText(/saved/i)).toBeInTheDocument();

      // Wait another 1 second (2s from reset)
      jest.advanceTimersByTime(1000);

      // Now should be hidden
      await waitFor(() => {
        expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('User interactions', () => {
    test('should call onRetry when retry button clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const onRetry = jest.fn();

      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });

      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test('should disable retry button while retrying', async () => {
      const user = userEvent.setup({ delay: null });
      const onRetry = jest.fn();

      const { rerender } = render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });

      await user.click(retryButton);

      // Simulate status change to saving
      rerender(
        <SaveStatusIndicator
          status={SaveStatus.SAVING}
          onRetry={onRetry}
        />
      );

      // Retry button should not be visible during saving
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA roles for different states', () => {
      const { rerender } = render(
        <SaveStatusIndicator status={SaveStatus.SAVING} />
      );

      // Saving should have status role
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Success should have status role
      rerender(<SaveStatusIndicator status={SaveStatus.SUCCESS} />);
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Error should have alert role
      rerender(<SaveStatusIndicator status={SaveStatus.ERROR} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    test('should have aria-live region for status updates', () => {
      const { rerender } = render(
        <SaveStatusIndicator status={SaveStatus.SAVING} />
      );

      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute('aria-live', 'polite');

      // Error should be assertive for immediate attention
      rerender(<SaveStatusIndicator status={SaveStatus.ERROR} />);
      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveAttribute('aria-live', 'assertive');
    });

    test('should have descriptive aria-label for loading spinner', () => {
      render(<SaveStatusIndicator status={SaveStatus.SAVING} />);

      const spinner = screen.getByLabelText(/saving/i);
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Visual styling', () => {
    test('should be subtle and non-intrusive', () => {
      render(<SaveStatusIndicator status={SaveStatus.SAVING} />);

      const indicator = screen.getByRole('status');

      // Should have small text and subtle styling
      expect(indicator).toHaveClass('text-sm');
      expect(indicator).toHaveClass('text-gray-600');
    });

    test('should use design system colors', () => {
      const { rerender } = render(
        <SaveStatusIndicator status={SaveStatus.SUCCESS} />
      );

      const successIndicator = screen.getByRole('status');
      expect(successIndicator).toHaveClass('text-green-600');

      rerender(<SaveStatusIndicator status={SaveStatus.ERROR} />);
      const errorIndicator = screen.getByRole('alert');
      expect(errorIndicator).toHaveClass('text-red-600');

      rerender(<SaveStatusIndicator status={SaveStatus.SAVING} />);
      const savingIndicator = screen.getByRole('status');
      expect(savingIndicator).toHaveClass('text-gray-600');
    });

    test('should position near editor without overlapping', () => {
      render(<SaveStatusIndicator status={SaveStatus.SAVING} />);

      const indicator = screen.getByRole('status');

      // Should be inline or have minimal spacing
      expect(indicator).toHaveClass('flex');
      expect(indicator).toHaveClass('items-center');
    });
  });

  describe('Animation', () => {
    test('should animate spinner during saving state', () => {
      render(<SaveStatusIndicator status={SaveStatus.SAVING} />);

      const statusElement = screen.getByRole('status');

      // Should have spinner with animation class
      const spinner = statusElement.querySelector('svg');
      expect(spinner).not.toBeNull();
      expect(spinner).toHaveClass('animate-spin');
    });

    test('should fade in when appearing', () => {
      const { rerender } = render(
        <SaveStatusIndicator status={SaveStatus.IDLE} />
      );

      rerender(<SaveStatusIndicator status={SaveStatus.SAVING} />);

      const indicator = screen.getByRole('status');

      // Should have transition classes
      expect(indicator).toHaveClass('transition-opacity');
    });

    test('should fade out when success auto-hides', async () => {
      jest.useFakeTimers();

      render(
        <SaveStatusIndicator status={SaveStatus.SUCCESS} />
      );

      const indicator = screen.getByRole('status');

      // Should be visible
      expect(indicator).toBeInTheDocument();

      // Wait for fade-out to start (1.8s)
      jest.advanceTimersByTime(1800);

      // Should have opacity transition
      await waitFor(() => {
        expect(indicator).toHaveClass('opacity-0');
      });

      jest.useRealTimers();
    });
  });
});
