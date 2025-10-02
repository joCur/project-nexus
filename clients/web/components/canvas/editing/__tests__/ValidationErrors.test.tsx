/**
 * ValidationErrors Component Tests
 *
 * Tests for displaying validation errors with:
 * - Multiple error messages
 * - Field-specific errors
 * - Error severity levels
 * - Accessibility features
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ValidationErrors, ValidationSeverity } from '../ValidationErrors';

describe('ValidationErrors Component', () => {
  describe('Basic Rendering', () => {
    it('should render single error message', () => {
      const errors = [{ field: 'content', message: 'Content is required' }];
      render(<ValidationErrors errors={errors} />);

      expect(screen.getByText(/content is required/i)).toBeInTheDocument();
    });

    it('should render multiple error messages', () => {
      const errors = [
        { field: 'content', message: 'Content is required' },
        { field: 'title', message: 'Title is too long' }
      ];
      render(<ValidationErrors errors={errors} />);

      expect(screen.getByText(/content is required/i)).toBeInTheDocument();
      expect(screen.getByText(/title is too long/i)).toBeInTheDocument();
    });

    it('should not render when errors array is empty', () => {
      const { container } = render(<ValidationErrors errors={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render when errors is undefined', () => {
      const { container } = render(<ValidationErrors errors={undefined} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Error Severity Levels', () => {
    it('should display error severity level', () => {
      const errors = [
        { field: 'content', message: 'Critical error', severity: ValidationSeverity.ERROR }
      ];
      render(<ValidationErrors errors={errors} />);

      const errorElement = screen.getByText(/critical error/i).closest('div');
      expect(errorElement).toHaveClass('text-red-500');
    });

    it('should display warning severity with appropriate styling', () => {
      const errors = [
        { field: 'content', message: 'Warning message', severity: ValidationSeverity.WARNING }
      ];
      render(<ValidationErrors errors={errors} />);

      const warningElement = screen.getByText(/warning message/i).closest('div');
      expect(warningElement).toHaveClass('text-orange-500');
    });

    it('should display info severity with appropriate styling', () => {
      const errors = [
        { field: 'content', message: 'Info message', severity: ValidationSeverity.INFO }
      ];
      render(<ValidationErrors errors={errors} />);

      const infoElement = screen.getByText(/info message/i).closest('div');
      expect(infoElement).toHaveClass('text-blue-500');
    });

    it('should default to error severity when not specified', () => {
      const errors = [
        { field: 'content', message: 'Default severity' }
      ];
      render(<ValidationErrors errors={errors} />);

      const errorElement = screen.getByText(/default severity/i).closest('div');
      expect(errorElement).toHaveClass('text-red-500');
    });
  });

  describe('Field-Specific Errors', () => {
    it('should display field name with error', () => {
      const errors = [
        { field: 'email', message: 'Invalid email format' }
      ];
      render(<ValidationErrors errors={errors} showFieldNames={true} />);

      expect(screen.getByText(/email:/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });

    it('should not display field names when showFieldNames is false', () => {
      const errors = [
        { field: 'email', message: 'Invalid email format' }
      ];
      render(<ValidationErrors errors={errors} showFieldNames={false} />);

      expect(screen.queryByText(/email:/i)).not.toBeInTheDocument();
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });

    it('should group errors by field', () => {
      const errors = [
        { field: 'password', message: 'Too short' },
        { field: 'password', message: 'Must contain number' },
        { field: 'email', message: 'Invalid format' }
      ];
      render(<ValidationErrors errors={errors} groupByField={true} />);

      // Should show field name once with multiple errors
      const passwordErrors = screen.getAllByText(/password/i);
      expect(passwordErrors).toHaveLength(1);
      expect(screen.getByText(/too short/i)).toBeInTheDocument();
      expect(screen.getByText(/must contain number/i)).toBeInTheDocument();
    });
  });

  describe('Dismissible Errors', () => {
    it('should show dismiss button when dismissible is true', () => {
      const errors = [
        { field: 'content', message: 'Error message' }
      ];
      const onDismiss = jest.fn();
      render(<ValidationErrors errors={errors} dismissible={true} onDismiss={onDismiss} />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it('should call onDismiss when dismiss button clicked', () => {
      const errors = [
        { field: 'content', message: 'Error message' }
      ];
      const onDismiss = jest.fn();
      render(<ValidationErrors errors={errors} dismissible={true} onDismiss={onDismiss} />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalledWith('content');
    });

    it('should not show dismiss button when dismissible is false', () => {
      const errors = [
        { field: 'content', message: 'Error message' }
      ];
      render(<ValidationErrors errors={errors} dismissible={false} />);

      expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
    });
  });

  describe('Icons and Visual Indicators', () => {
    it('should display error icon for error severity', () => {
      const errors = [
        { field: 'content', message: 'Error', severity: ValidationSeverity.ERROR }
      ];
      render(<ValidationErrors errors={errors} />);

      expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    });

    it('should display warning icon for warning severity', () => {
      const errors = [
        { field: 'content', message: 'Warning', severity: ValidationSeverity.WARNING }
      ];
      render(<ValidationErrors errors={errors} />);

      expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
    });

    it('should display info icon for info severity', () => {
      const errors = [
        { field: 'content', message: 'Info', severity: ValidationSeverity.INFO }
      ];
      render(<ValidationErrors errors={errors} />);

      expect(screen.getByTestId('info-icon')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role alert for error messages', () => {
      const errors = [
        { field: 'content', message: 'Error message' }
      ];
      render(<ValidationErrors errors={errors} />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('should have aria-live assertive for errors', () => {
      const errors = [
        { field: 'content', message: 'Error message', severity: ValidationSeverity.ERROR }
      ];
      render(<ValidationErrors errors={errors} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('should have aria-live polite for warnings', () => {
      const errors = [
        { field: 'content', message: 'Warning message', severity: ValidationSeverity.WARNING }
      ];
      render(<ValidationErrors errors={errors} />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('should have descriptive aria-label', () => {
      const errors = [
        { field: 'content', message: 'Error message' }
      ];
      render(<ValidationErrors errors={errors} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-label', 'Validation errors');
    });

    it('should associate errors with fields via aria-describedby', () => {
      const errors = [
        { field: 'email', message: 'Invalid email', id: 'email-error' }
      ];
      render(<ValidationErrors errors={errors} />);

      const errorElement = screen.getByText(/invalid email/i);
      expect(errorElement).toHaveAttribute('id', 'email-error');
    });
  });

  describe('Animation and Transitions', () => {
    it('should animate error appearance', () => {
      const errors = [
        { field: 'content', message: 'Error message' }
      ];
      const { container } = render(<ValidationErrors errors={errors} animate={true} />);

      const errorList = container.querySelector('.validation-errors');
      expect(errorList).toHaveClass('animate-slide-down');
    });

    it('should not animate when animate is false', () => {
      const errors = [
        { field: 'content', message: 'Error message' }
      ];
      const { container } = render(<ValidationErrors errors={errors} animate={false} />);

      const errorList = container.querySelector('.validation-errors');
      expect(errorList).not.toHaveClass('animate-slide-down');
    });

    it('should respect prefers-reduced-motion', () => {
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

      const errors = [
        { field: 'content', message: 'Error message' }
      ];
      const { container } = render(<ValidationErrors errors={errors} animate={true} />);

      const errorList = container.querySelector('.validation-errors');
      expect(errorList).not.toHaveClass('animate-slide-down');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const errors = [
        { field: 'content', message: 'Error message' }
      ];
      const { container } = render(
        <ValidationErrors errors={errors} className="custom-class" />
      );

      const errorContainer = container.querySelector('.custom-class');
      expect(errorContainer).toBeInTheDocument();
    });

    it('should apply custom error item className', () => {
      const errors = [
        { field: 'content', message: 'Error message' }
      ];
      render(<ValidationErrors errors={errors} errorItemClassName="custom-error-item" />);

      const errorItem = screen.getByText(/error message/i).closest('.custom-error-item');
      expect(errorItem).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors without field property', () => {
      const errors = [
        { message: 'General error' }
      ];
      render(<ValidationErrors errors={errors} />);

      expect(screen.getByText(/general error/i)).toBeInTheDocument();
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(500);
      const errors = [
        { field: 'content', message: longMessage }
      ];
      render(<ValidationErrors errors={errors} />);

      expect(screen.getByText(new RegExp(longMessage))).toBeInTheDocument();
    });

    it('should handle special characters in error messages', () => {
      const alertMock = jest.spyOn(window, 'alert').mockImplementation();
      const errors = [
        { field: 'content', message: 'Error <script>alert("xss")</script>' }
      ];
      render(<ValidationErrors errors={errors} />);

      // Should escape HTML
      expect(screen.queryByText(/script/i)).toBeInTheDocument();
      // But should not execute scripts
      expect(alertMock).not.toHaveBeenCalled();

      alertMock.mockRestore();
    });

    it('should handle duplicate error messages', () => {
      const errors = [
        { field: 'content', message: 'Duplicate error' },
        { field: 'content', message: 'Duplicate error' }
      ];
      render(<ValidationErrors errors={errors} />);

      const errorMessages = screen.getAllByText(/duplicate error/i);
      expect(errorMessages).toHaveLength(2);
    });

    it('should handle empty error messages', () => {
      const errors = [
        { field: 'content', message: '' }
      ];
      const { container } = render(<ValidationErrors errors={errors} />);

      // Should not render empty errors
      expect(container.querySelector('.validation-error-item')).not.toBeInTheDocument();
    });
  });

  describe('Internationalization', () => {
    it('should support custom error templates', () => {
      const errors = [
        { field: 'content', message: 'Required field', code: 'REQUIRED' }
      ];
      const errorTemplate = (code: string) => {
        if (code === 'REQUIRED') return 'Este campo es obligatorio';
        return '';
      };
      render(<ValidationErrors errors={errors} errorTemplate={errorTemplate} />);

      expect(screen.getByText(/este campo es obligatorio/i)).toBeInTheDocument();
    });
  });
});
