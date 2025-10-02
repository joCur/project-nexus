import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageEditor } from '../ImageEditor';

// Mock the BaseEditor component
jest.mock('../BaseEditor', () => ({
  BaseEditor: jest.fn(({ children, onSave, onCancel, initialValue, showControls = true }) => {
    // Call children as a render prop function if it's a function
    const content = typeof children === 'function'
      ? children({
          value: initialValue,
          setValue: jest.fn(),
          handleSave: onSave,
          handleCancel: onCancel,
          validationError: null,
          focusRef: { current: null },
          hasChanges: false
        })
      : children;

    return (
      <div data-testid="inline-editor">
        <div>{content}</div>
        {showControls && (
          <>
            <button onClick={() => onSave(initialValue)}>Save</button>
            <button onClick={() => onCancel()}>Cancel</button>
          </>
        )}
      </div>
    );
  })
}));

// Type definitions for Image mock
interface MockImageElement {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}

// Create a properly typed Image constructor mock
declare global {
  interface Window {
    Image: {
      new (width?: number, height?: number): HTMLImageElement;
    };
  }
}

describe('ImageEditor', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    onSave: mockOnSave,
    onCancel: mockOnCancel,
  };

  const initialData = {
    url: 'https://example.com/image.jpg',
    alt: 'Test image',
    caption: 'Test caption',
    size: 'medium' as const,
    alignment: 'center' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Image loading - cast through unknown to avoid type conflicts
    (global as unknown as { Image: jest.Mock }).Image = jest.fn().mockImplementation(
      (): MockImageElement => ({
        onload: null,
        onerror: null,
        src: '',
      })
    );
  });

  describe('Rendering', () => {
    it('should render with InlineEditor wrapper', () => {
      render(<ImageEditor {...defaultProps} />);
      expect(screen.getByTestId('inline-editor')).toBeInTheDocument();
      expect(screen.getByText('Edit Image')).toBeInTheDocument();
    });

    it('should render all input fields', () => {
      render(<ImageEditor {...defaultProps} />);

      expect(screen.getByLabelText(/Image URL/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Alt Text/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Caption/i)).toBeInTheDocument();
    });

    it('should populate fields with initial data', () => {
      render(<ImageEditor {...defaultProps} initialData={initialData} />);

      expect(screen.getByDisplayValue(initialData.url)).toBeInTheDocument();
      expect(screen.getByDisplayValue(initialData.alt)).toBeInTheDocument();
      expect(screen.getByDisplayValue(initialData.caption)).toBeInTheDocument();
    });
  });

  describe('URL Validation', () => {
    it('should show error for invalid URL', async () => {
      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);
      await userEvent.type(urlInput, 'not-a-url');
      fireEvent.blur(urlInput);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid URL/i)).toBeInTheDocument();
      });
    });

    it('should show error for non-image URL', async () => {
      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);
      await userEvent.type(urlInput, 'https://example.com/document.pdf');
      fireEvent.blur(urlInput);

      await waitFor(() => {
        expect(screen.getByText(/URL must point to an image/i)).toBeInTheDocument();
      });
    });

    it('should accept valid image URLs', async () => {
      render(<ImageEditor {...defaultProps} />);

      const validUrls = [
        'https://example.com/image.jpg',
        'https://example.com/image.jpeg',
        'https://example.com/image.png',
        'https://example.com/image.gif',
        'https://example.com/image.svg',
        'https://example.com/image.webp',
      ];

      for (const url of validUrls) {
        const urlInput = screen.getByLabelText(/Image URL/i);
        await userEvent.clear(urlInput);
        await userEvent.type(urlInput, url);
        fireEvent.blur(urlInput);

        await waitFor(() => {
          expect(screen.queryByText(/Please enter a valid URL/i)).not.toBeInTheDocument();
          expect(screen.queryByText(/URL must point to an image/i)).not.toBeInTheDocument();
        });
      }
    });

    it('should clear error when valid URL is entered', async () => {
      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);

      // Enter invalid URL
      await userEvent.type(urlInput, 'invalid-url');
      fireEvent.blur(urlInput);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid URL/i)).toBeInTheDocument();
      });

      // Clear and enter valid URL
      await userEvent.clear(urlInput);
      await userEvent.type(urlInput, 'https://example.com/image.jpg');
      fireEvent.blur(urlInput);

      await waitFor(() => {
        expect(screen.queryByText(/Please enter a valid URL/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Image Preview', () => {
    it('should show loading state while image loads', async () => {
      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);
      await userEvent.type(urlInput, 'https://example.com/image.jpg');

      await waitFor(() => {
        expect(screen.getByText(/Loading preview/i)).toBeInTheDocument();
      });
    });

    it('should show image preview on successful load', async () => {
      const mockImage: MockImageElement = {
        onload: null,
        onerror: null,
        src: '',
      };

      (global as unknown as { Image: jest.Mock }).Image = jest.fn().mockImplementation(() => mockImage);

      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);
      await userEvent.type(urlInput, 'https://example.com/image.jpg');

      // Simulate image load success
      act(() => {
        mockImage.onload?.();
      });

      await waitFor(() => {
        expect(screen.queryByText(/Loading preview/i)).not.toBeInTheDocument();
        const preview = screen.getByAltText(/Preview/i);
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveAttribute('src', 'https://example.com/image.jpg');
      });
    });

    it('should show error message for broken image', async () => {
      const mockImage: MockImageElement = {
        onload: null,
        onerror: null,
        src: '',
      };

      (global as unknown as { Image: jest.Mock }).Image = jest.fn().mockImplementation(() => mockImage);

      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);
      await userEvent.type(urlInput, 'https://example.com/broken.jpg');

      // Simulate image load error
      act(() => {
        mockImage.onerror?.();
      });

      await waitFor(() => {
        expect(screen.queryByText(/Loading preview/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Failed to load image/i)).toBeInTheDocument();
      });
    });

    it('should update preview when URL changes', async () => {
      const mockImage: MockImageElement = {
        onload: null,
        onerror: null,
        src: '',
      };

      (global as unknown as { Image: jest.Mock }).Image = jest.fn().mockImplementation(() => mockImage);

      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);

      // First image
      await userEvent.type(urlInput, 'https://example.com/image1.jpg');
      act(() => {
        mockImage.onload?.();
      });

      await waitFor(() => {
        const preview = screen.getByAltText(/Preview/i);
        expect(preview).toHaveAttribute('src', 'https://example.com/image1.jpg');
      });

      // Change to second image
      await userEvent.clear(urlInput);
      await userEvent.type(urlInput, 'https://example.com/image2.jpg');
      act(() => {
        mockImage.onload?.();
      });

      await waitFor(() => {
        const preview = screen.getByAltText(/Preview/i);
        expect(preview).toHaveAttribute('src', 'https://example.com/image2.jpg');
      });
    });
  });

  describe('Alt Text Field', () => {
    it('should require alt text for accessibility', async () => {
      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);
      await userEvent.type(urlInput, 'https://example.com/image.jpg');

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Alt text is required/i)).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should allow saving with alt text provided', async () => {
      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);
      const altInput = screen.getByLabelText(/Alt Text/i);

      await userEvent.type(urlInput, 'https://example.com/image.jpg');
      await userEvent.type(altInput, 'Description of image');

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          url: 'https://example.com/image.jpg',
          alt: 'Description of image',
          caption: '',
        });
      });
    });
  });

  describe('Caption Field', () => {
    it('should accept optional caption', async () => {
      render(<ImageEditor {...defaultProps} />);

      const captionInput = screen.getByLabelText(/Caption/i);
      await userEvent.type(captionInput, 'This is a test caption');

      expect(captionInput).toHaveValue('This is a test caption');
    });

    it('should save with caption', async () => {
      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);
      const altInput = screen.getByLabelText(/Alt Text/i);
      const captionInput = screen.getByLabelText(/Caption/i);

      await userEvent.type(urlInput, 'https://example.com/image.jpg');
      await userEvent.type(altInput, 'Test alt');
      await userEvent.type(captionInput, 'Test caption');

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          url: 'https://example.com/image.jpg',
          alt: 'Test alt',
          caption: 'Test caption',
        });
      });
    });
  });

  describe('Form Submission', () => {
    it('should validate required fields on save', async () => {
      render(<ImageEditor {...defaultProps} />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Image URL is required/i)).toBeInTheDocument();
        expect(screen.getByText(/Alt text is required/i)).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should not save with invalid URL', async () => {
      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);
      const altInput = screen.getByLabelText(/Alt Text/i);

      await userEvent.type(urlInput, 'invalid-url');
      await userEvent.type(altInput, 'Test alt');

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid URL/i)).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should save with all valid data', async () => {
      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);
      const altInput = screen.getByLabelText(/Alt Text/i);
      const captionInput = screen.getByLabelText(/Caption/i);

      await userEvent.type(urlInput, 'https://example.com/image.jpg');
      await userEvent.type(altInput, 'Test image description');
      await userEvent.type(captionInput, 'Test caption text');

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          url: 'https://example.com/image.jpg',
          alt: 'Test image description',
          caption: 'Test caption text',
        });
      });
    });

    it('should handle cancel action', () => {
      render(<ImageEditor {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Integration with InlineEditor', () => {
    it('should pass correct props to InlineEditor', () => {
      // Access the mocked BaseEditor from the module mock
      const { BaseEditor } = jest.requireMock('../BaseEditor');

      render(<ImageEditor {...defaultProps} />);

      expect(BaseEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          initialValue: expect.objectContaining({
            url: '',
            alt: '',
            caption: '',
          }),
          onSave: expect.any(Function),
          onCancel: mockOnCancel,
          showControls: false,
          children: expect.any(Function),
        }),
        expect.anything()
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ImageEditor {...defaultProps} />);

      expect(screen.getByLabelText(/Image URL/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/Alt Text/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/Caption/i)).toHaveAttribute('aria-required', 'false');
    });

    it('should announce errors to screen readers', async () => {
      render(<ImageEditor {...defaultProps} />);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        const urlError = screen.getByText(/Image URL is required/i);
        const altError = screen.getByText(/Alt text is required/i);

        expect(urlError).toHaveAttribute('role', 'alert');
        expect(altError).toHaveAttribute('role', 'alert');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long URLs', async () => {
      render(<ImageEditor {...defaultProps} />);

      const longUrl = `https://example.com/${'a'.repeat(500)}.jpg`;
      const urlInput = screen.getByLabelText(/Image URL/i);

      await userEvent.type(urlInput, longUrl);

      expect(urlInput).toHaveValue(longUrl);
    });

    it('should handle special characters in alt text', async () => {
      render(<ImageEditor {...defaultProps} />);

      const specialAlt = 'Test & "special" <characters> \'here\'';
      const altInput = screen.getByLabelText(/Alt Text/i);

      await userEvent.type(altInput, specialAlt);

      expect(altInput).toHaveValue(specialAlt);
    });

    it('should handle rapid URL changes', async () => {
      const mockImage: MockImageElement = {
        onload: null,
        onerror: null,
        src: '',
      };

      (global as unknown as { Image: jest.Mock }).Image = jest.fn().mockImplementation(() => mockImage);

      render(<ImageEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/Image URL/i);

      // Rapidly change URLs
      await userEvent.type(urlInput, 'https://example.com/1.jpg');
      await userEvent.clear(urlInput);
      await userEvent.type(urlInput, 'https://example.com/2.jpg');
      await userEvent.clear(urlInput);
      await userEvent.type(urlInput, 'https://example.com/3.jpg');

      // Only the last URL should trigger preview
      act(() => {
        mockImage.onload?.();
      });

      await waitFor(() => {
        const preview = screen.getByAltText(/Preview/i);
        expect(preview).toHaveAttribute('src', 'https://example.com/3.jpg');
      });
    });
  });
});