/**
 * Tests for CreateCardModal component
 *
 * This test suite covers:
 * - Modal open/close behavior
 * - Form validation for different card types
 * - Content input handling
 * - Loading states during creation
 * - Error display and clearing
 * - Form submission and card creation
 * - Type-specific form fields
 * - Accessibility and keyboard navigation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import CreateCardModal from '../CreateCardModal';
import type { CreateCardParams, CardType } from '@/types/card.types';
import type { CanvasPosition } from '@/types/canvas.types';

// Mock utils
jest.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// Mock Headless UI Dialog
jest.mock('@headlessui/react', () => {
  const MockDialog = ({ children, onClose, ...props }: any) => (
    <div role="dialog" data-testid="modal" {...props}>
      {children}
    </div>
  );
  MockDialog.Panel = ({ children, ...props }: any) => (
    <div data-testid="dialog-panel" {...props}>
      {children}
    </div>
  );
  MockDialog.Title = ({ children, ...props }: any) => (
    <h3 data-testid="dialog-title" {...props}>
      {children}
    </h3>
  );

  const MockTransition = ({ children, show, ...props }: any) => (
    show ? <div data-testid="transition" {...props}>{children}</div> : null
  );
  MockTransition.Child = ({ children, ...props }: any) => (
    <div data-testid="transition-child" {...props}>
      {children}
    </div>
  );

  return {
    Dialog: MockDialog,
    Transition: MockTransition,
  };
});

// Mock CardTypeSelector
jest.mock("../CardTypeSelector", () => ({
  __esModule: true,
  default: ({ onTypeSelect, selectedType }: any) => (
    <div data-testid="card-type-selector">
      {['text', 'image', 'link', 'code'].map(type => (
        <button
          key={type}
          data-testid={`type-${type}`}
          onClick={() => onTypeSelect(type)}
          aria-pressed={selectedType === type}
        >
          {type} Card
        </button>
      ))}
    </div>
  ),
}));

describe('CreateCardModal', () => {
  const mockOnClose = jest.fn();
  const mockOnCreateCard = jest.fn();
  const mockOnClearError = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onCreateCard: mockOnCreateCard,
  };

  const position: CanvasPosition = { x: 100, y: 200, z: 123 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnCreateCard.mockResolvedValue(undefined);
  });

  describe('Basic Rendering', () => {
    it('should render when open', () => {
      render(<CreateCardModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Create New Card')).toBeInTheDocument();
      expect(screen.getByTestId('card-type-selector')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<CreateCardModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render with initial type selected', () => {
      render(<CreateCardModal {...defaultProps} initialType="image" />);

      const imageTypeButton = screen.getByTestId('type-image');
      expect(imageTypeButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should render form fields for text cards by default', () => {
      render(<CreateCardModal {...defaultProps} />);

      expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Content/)).toBeInTheDocument();
    });
  });

  describe('Card Type Selection', () => {
    it('should change form fields when card type changes', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      // Initially shows text fields
      expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Content/)).toBeInTheDocument();

      // Switch to image type
      await user.click(screen.getByTestId('type-image'));

      // Should show image-specific fields
      expect(screen.getByLabelText(/Image URL/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Alt Text/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Caption/)).toBeInTheDocument();
    });

    it('should show link-specific fields for link cards', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      await user.click(screen.getByTestId('type-link'));

      expect(screen.getByLabelText(/URL/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    });

    it('should show code-specific fields for code cards', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      await user.click(screen.getByTestId('type-code'));

      expect(screen.getByLabelText(/Language/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Filename/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Code/)).toBeInTheDocument();
    });

    it('should reset form data when type changes', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      // Fill in text content
      const contentField = screen.getByLabelText(/Content/) as HTMLTextAreaElement;
      await user.type(contentField, 'Some text content');

      // Switch to image type
      await user.click(screen.getByTestId('type-image'));

      // Switch back to text
      await user.click(screen.getByTestId('type-text'));

      // Content should be reset
      const newContentField = screen.getByLabelText(/Content/) as HTMLTextAreaElement;
      expect(newContentField.value).toBe('');
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields for text cards', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      // Try to submit without content
      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      expect(screen.getByText('Content is required')).toBeInTheDocument();
      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should validate required fields for image cards', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      await user.click(screen.getByTestId('type-image'));

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      expect(screen.getByText('Image URL is required')).toBeInTheDocument();
      expect(screen.getByText('Alt text is required for accessibility')).toBeInTheDocument();
      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should validate URL format for image cards', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      await user.click(screen.getByTestId('type-image'));

      // Enter invalid URL
      const urlField = screen.getByLabelText(/Image URL/);
      await user.type(urlField, 'invalid-url');

      const altField = screen.getByLabelText(/Alt Text/);
      await user.type(altField, 'Some alt text');

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      // Validation should prevent form submission
      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should validate URL format for link cards', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      await user.click(screen.getByTestId('type-link'));

      const urlField = screen.getByLabelText(/URL/);
      await user.type(urlField, 'invalid-url');

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      // Validation should prevent form submission
      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should validate required fields for code cards', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      await user.click(screen.getByTestId('type-code'));

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      expect(screen.getByText('Code content is required')).toBeInTheDocument();
      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should clear validation errors when fields are fixed', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      // Submit to trigger validation errors
      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      expect(screen.getByText('Content is required')).toBeInTheDocument();

      // Fix the error
      const contentField = screen.getByLabelText(/Content/);
      await user.type(contentField, 'Some content');

      // Error should be cleared
      expect(screen.queryByText('Content is required')).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should create text card with valid data', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} position={position} />);

      // Fill in text card data
      const titleField = screen.getByLabelText(/Title/);
      const contentField = screen.getByLabelText(/Content/);

      await user.type(titleField, 'Test Title');
      await user.type(contentField, 'Test content');

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateCard).toHaveBeenCalledWith({
          type: 'text',
          position,
          content: {
            type: 'text',
            content: 'Test content',
            markdown: false,
            wordCount: 2,
            lastEditedAt: expect.any(String),
          },
          dimensions: expect.any(Object),
          metadata: {
            title: 'Test Title',
          },
        });
      });
    });

    it('should create image card with valid data', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} position={position} />);

      await user.click(screen.getByTestId('type-image'));

      const urlField = screen.getByLabelText(/Image URL/);
      const altField = screen.getByLabelText(/Alt Text/);
      const captionField = screen.getByLabelText(/Caption/);

      await user.type(urlField, 'https://example.com/image.jpg');
      await user.type(altField, 'Test image');
      await user.type(captionField, 'Test caption');

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateCard).toHaveBeenCalledWith({
          type: 'image',
          position,
          content: {
            type: 'image',
            url: 'https://example.com/image.jpg',
            alt: 'Test image',
            caption: 'Test caption',
          },
          dimensions: expect.any(Object),
        });
      });
    });

    it('should create link card with valid data', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} position={position} />);

      await user.click(screen.getByTestId('type-link'));

      const urlField = screen.getByLabelText(/URL/);
      const titleField = screen.getByLabelText(/Title/);

      await user.type(urlField, 'https://example.com');
      await user.type(titleField, 'Example Site');

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateCard).toHaveBeenCalledWith({
          type: 'link',
          position,
          content: {
            type: 'link',
            url: 'https://example.com',
            title: 'Example Site',
            domain: 'example.com',
            isAccessible: true,
          },
          dimensions: expect.any(Object),
        });
      });
    });

    it('should create code card with valid data', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} position={position} />);

      await user.click(screen.getByTestId('type-code'));

      const languageField = screen.getByLabelText(/Language/);
      const contentField = screen.getByLabelText(/Code/);
      const filenameField = screen.getByLabelText(/Filename/);

      await user.selectOptions(languageField, 'typescript');
      await user.type(contentField, 'const x: number = 42;');
      await user.type(filenameField, 'example.ts');

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateCard).toHaveBeenCalledWith({
          type: 'code',
          position,
          content: {
            type: 'code',
            language: 'typescript',
            content: 'const x: number = 42;',
            lineCount: 1,
          },
          dimensions: expect.any(Object),
          metadata: {
            filename: 'example.ts',
          },
        });
      });
    });

    it('should use default position when none provided', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      const contentField = screen.getByLabelText(/Content/);
      await user.type(contentField, 'Test content');

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateCard).toHaveBeenCalledWith(
          expect.objectContaining({
            position: {
              x: 0,
              y: 0,
              z: expect.any(Number),
            },
          })
        );
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during creation', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} isCreating={true} />);

      const submitButton = screen.getByText('Create Card');
      expect(submitButton).toBeDisabled();
      expect(screen.getByRole('button', { name: /Create Card/ })).toHaveClass('disabled:opacity-50');

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
    });

    it('should show loading spinner during creation', () => {
      render(<CreateCardModal {...defaultProps} isCreating={true} />);

      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should disable form fields during creation', () => {
      render(<CreateCardModal {...defaultProps} isCreating={true} />);

      const titleField = screen.getByLabelText(/Title/);
      const contentField = screen.getByLabelText(/Content/);

      expect(titleField).toBeDisabled();
      expect(contentField).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when provided', () => {
      render(<CreateCardModal {...defaultProps} error="Creation failed" />);

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Creation failed')).toBeInTheDocument();
    });

    it('should clear error when modal opens', () => {
      const { rerender } = render(
        <CreateCardModal {...defaultProps} isOpen={false} error="Some error" />
      );

      rerender(<CreateCardModal {...defaultProps} isOpen={true} error="Some error" onClearError={mockOnClearError} />);

      expect(mockOnClearError).toHaveBeenCalled();
    });

    it('should handle creation errors', async () => {
      const user = userEvent.setup();
      const createError = new Error('Network error');
      mockOnCreateCard.mockRejectedValue(createError);

      render(<CreateCardModal {...defaultProps} />);

      const contentField = screen.getByLabelText(/Content/);
      await user.type(contentField, 'Test content');

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      // Form should still be open on error
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Modal Behavior', () => {
    it('should close modal when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close modal after successful creation', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      const contentField = screen.getByLabelText(/Content/);
      await user.type(contentField, 'Test content');

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should reset form when modal opens', () => {
      const { rerender } = render(
        <CreateCardModal {...defaultProps} isOpen={false} />
      );

      rerender(<CreateCardModal {...defaultProps} isOpen={true} initialType="image" />);

      // Should show image form fields
      expect(screen.getByLabelText(/Image URL/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper modal role and attributes', () => {
      render(<CreateCardModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('should have proper form labels', () => {
      render(<CreateCardModal {...defaultProps} />);

      const titleField = screen.getByLabelText(/Title/);
      const contentField = screen.getByLabelText(/Content/);

      expect(titleField).toHaveAttribute('id');
      expect(contentField).toHaveAttribute('id');
    });

    it('should associate validation errors with form fields', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      const contentField = screen.getByLabelText(/Content/);
      const errorMessage = screen.getByText('Content is required');

      // Error should be associated with the field
      expect(contentField).toHaveClass('border-red-500');
      expect(errorMessage).toHaveClass('text-red-500');
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      // Tab through form elements
      await user.tab();
      expect(screen.getByTestId('type-text')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('type-image')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('type-link')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('type-code')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/Title/)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/Content/)).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long content', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      const longContent = 'a'.repeat(10000);
      const contentField = screen.getByLabelText(/Content/) as HTMLTextAreaElement;

      // Use fireEvent.change for performance instead of user.type for very long content
      fireEvent.change(contentField, { target: { value: longContent } });

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateCard).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.objectContaining({
              content: longContent,
            }),
          })
        );
      });
    });

    it('should handle special characters in form fields', async () => {
      const user = userEvent.setup();
      render(<CreateCardModal {...defaultProps} />);

      const specialContent = '&<>"\'`{}[]()';
      const contentField = screen.getByLabelText(/Content/) as HTMLTextAreaElement;

      // Use fireEvent.change for special characters that userEvent.type can't handle
      fireEvent.change(contentField, { target: { value: specialContent } });

      const submitButton = screen.getByText('Create Card');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreateCard).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.objectContaining({
              content: specialContent,
            }),
          })
        );
      });
    });

    it('should handle rapid form submissions', async () => {
      const user = userEvent.setup();

      // Mock with a slight delay to simulate real async behavior
      mockOnCreateCard.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));

      render(<CreateCardModal {...defaultProps} />);

      const contentField = screen.getByLabelText(/Content/);
      await user.type(contentField, 'Test content');

      const submitButton = screen.getByText('Create Card');

      // Click multiple times rapidly using Promise.all to ensure they happen simultaneously
      await Promise.all([
        user.click(submitButton),
        user.click(submitButton),
        user.click(submitButton),
      ]);

      // Should only call once
      await waitFor(() => {
        expect(mockOnCreateCard).toHaveBeenCalledTimes(1);
      });
    });
  });
});