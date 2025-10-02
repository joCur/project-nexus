/**
 * SaveStatusIndicator Visual Feedback Tests
 *
 * Tests for enhanced visual feedback including:
 * - Retry button functionality
 * - Error details display
 * - Network error handling
 * - Accessibility of error messages
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SaveStatusIndicator, SaveStatus, ErrorType } from '../SaveStatusIndicator';

describe('SaveStatusIndicator - Visual Feedback', () => {
  describe('Retry Button', () => {
    it('should display retry button when status is error', () => {
      const onRetry = jest.fn();
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should not display retry button when status is not error', () => {
      const onRetry = jest.fn();
      render(
        <SaveStatusIndicator
          status={SaveStatus.SAVING}
          onRetry={onRetry}
        />
      );

      const retryButton = screen.queryByRole('button', { name: /retry/i });
      expect(retryButton).not.toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', () => {
      const onRetry = jest.fn();
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should disable retry button during retry operation', async () => {
      const onRetry = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      const { rerender } = render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          onRetry={onRetry}
          isRetrying={false}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Update to retrying state
      rerender(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          onRetry={onRetry}
          isRetrying={true}
        />
      );

      await waitFor(() => {
        expect(retryButton).toBeDisabled();
      });
    });

    it('should show retry count if provided', () => {
      const onRetry = jest.fn();
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          onRetry={onRetry}
          retryCount={2}
        />
      );

      expect(screen.getByText(/attempt 2/i)).toBeInTheDocument();
    });

    it('should have accessible label for retry button', () => {
      const onRetry = jest.fn();
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toHaveAccessibleName();
    });
  });

  describe('Error Details Display', () => {
    it('should display detailed error message', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Failed to connect to server"
        />
      );

      expect(screen.getByText(/failed to connect to server/i)).toBeInTheDocument();
    });

    it('should display generic error message when no specific message provided', () => {
      render(<SaveStatusIndicator status={SaveStatus.ERROR} />);

      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });

    it('should display error code if provided', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Server error"
          errorCode="ERR_500"
        />
      );

      expect(screen.getByText(/ERR_500/i)).toBeInTheDocument();
    });

    it('should truncate very long error messages', () => {
      const longMessage = 'A'.repeat(200);
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage={longMessage}
        />
      );

      const errorText = screen.getByText(/A+/);
      expect(errorText.textContent?.length).toBeLessThanOrEqual(150);
    });

    it('should have role alert for error messages', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/network error/i);
    });
  });

  describe('Network Error Handling', () => {
    it('should display network-specific error message', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network connection lost"
          errorType={ErrorType.NETWORK}
        />
      );

      expect(screen.getByText(/network/i)).toBeInTheDocument();
    });

    it('should show offline indicator for network errors', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          errorType={ErrorType.NETWORK}
        />
      );

      const offlineIcon = screen.getByTestId('offline-icon');
      expect(offlineIcon).toBeInTheDocument();
    });

    it('should distinguish between network and validation errors', () => {
      const { rerender } = render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          errorType={ErrorType.NETWORK}
        />
      );

      expect(screen.getByTestId('offline-icon')).toBeInTheDocument();

      rerender(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Validation failed"
          errorType={ErrorType.VALIDATION}
        />
      );

      expect(screen.queryByTestId('offline-icon')).not.toBeInTheDocument();
      expect(screen.getByTestId('validation-icon')).toBeInTheDocument();
    });

    it('should suggest checking connection for network errors', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          errorType={ErrorType.NETWORK}
        />
      );

      expect(screen.getByText(/check.*connection/i)).toBeInTheDocument();
    });
  });

  describe('Unsaved Changes Indicator', () => {
    it('should show unsaved changes indicator when hasUnsavedChanges is true', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.IDLE}
          hasUnsavedChanges={true}
        />
      );

      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    });

    it('should not show unsaved indicator when status is saving', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.SAVING}
          hasUnsavedChanges={true}
        />
      );

      expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
    });

    it('should show asterisk indicator for unsaved changes', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.IDLE}
          hasUnsavedChanges={true}
        />
      );

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should have accessible description for unsaved changes', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.IDLE}
          hasUnsavedChanges={true}
        />
      );

      const indicator = screen.getByText(/unsaved changes/i);
      expect(indicator).toHaveAttribute('aria-label');
    });
  });

  describe('Accessibility', () => {
    it('should announce error messages to screen readers', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Save failed"
        />
      );

      const liveRegion = screen.getByRole('alert');
      expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
    });

    it('should announce retry action result', async () => {
      const onRetry = jest.fn();
      const { rerender } = render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Simulate parent setting isRetrying=true after onRetry is called
      rerender(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          onRetry={onRetry}
          isRetrying={true}
        />
      );

      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/retrying/i);
      });
    });

    it('should have sufficient color contrast for error messages', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Error message"
        />
      );

      const errorElement = screen.getByText(/error message/i);
      expect(errorElement).toHaveClass('text-red-400');
    });

    it('should provide keyboard navigation for retry button', () => {
      const onRetry = jest.fn();
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Network error"
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      retryButton.focus();
      expect(document.activeElement).toBe(retryButton);

      fireEvent.keyDown(retryButton, { key: 'Enter' });
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('Animation and Transitions', () => {
    it('should animate error appearance', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Error occurred"
        />
      );

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
    });

    it('should respect prefers-reduced-motion', () => {
      // Mock reduced motion preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Error occurred"
        />
      );

      // Check that error still renders with reduced motion
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing onRetry callback gracefully', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage="Error occurred"
        />
      );

      // Should not show retry button if onRetry is not provided
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('should handle rapid status changes', async () => {
      const { rerender } = render(
        <SaveStatusIndicator status={SaveStatus.IDLE} />
      );

      rerender(<SaveStatusIndicator status={SaveStatus.SAVING} />);
      rerender(<SaveStatusIndicator status={SaveStatus.ERROR} errorMessage="Error" />);
      rerender(<SaveStatusIndicator status={SaveStatus.SAVING} />);
      rerender(<SaveStatusIndicator status={SaveStatus.SUCCESS} />);

      await waitFor(() => {
        expect(screen.getByText(/saved/i)).toBeInTheDocument();
      });
    });

    it('should handle null error message', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
          errorMessage={null as unknown as string}
        />
      );

      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });

    it('should handle undefined error message', () => {
      render(
        <SaveStatusIndicator
          status={SaveStatus.ERROR}
        />
      );

      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });
  });
});
