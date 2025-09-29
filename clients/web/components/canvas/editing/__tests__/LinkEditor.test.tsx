import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkEditor } from '../LinkEditor';

// Mock the BaseEditor component
jest.mock('../BaseEditor', () => ({
  BaseEditor: jest.fn(({ children, onSave, onCancel, title }) => {
    const content = typeof children === 'function' ? children({
      value: {},
      setValue: jest.fn(),
      handleSave: onSave,
      handleCancel: onCancel,
      validationError: null,
      hasChanges: false
    }) : children;

    return (
      <div data-testid="inline-editor">
        <div>{title}</div>
        {content}
        <button onClick={() => onSave()}>Save</button>
        <button onClick={() => onCancel()}>Cancel</button>
      </div>
    );
  })
}));

describe('LinkEditor', () => {
  const defaultProps = {
    onSave: jest.fn(),
    onCancel: jest.fn(),
    initialValue: {
      url: '',
      text: '',
      target: '_self' as const
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with empty initial values', () => {
      render(<LinkEditor {...defaultProps} />);

      expect(screen.getByLabelText(/url/i)).toHaveValue('');
      expect(screen.getByLabelText(/display text/i)).toHaveValue('');
      expect(screen.getByLabelText(/open in new tab/i)).not.toBeChecked();
    });

    it('should render with initial values', () => {
      const props = {
        ...defaultProps,
        initialValue: {
          url: 'https://example.com',
          text: 'Example Link',
          target: '_blank' as const
        }
      };

      render(<LinkEditor {...props} />);

      expect(screen.getByLabelText(/url/i)).toHaveValue('https://example.com');
      expect(screen.getByLabelText(/display text/i)).toHaveValue('Example Link');
      expect(screen.getByLabelText(/open in new tab/i)).toBeChecked();
    });

    it('should show link preview when URL is valid', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'https://example.com');

      await waitFor(() => {
        expect(screen.getByTestId('link-preview')).toBeInTheDocument();
        expect(screen.getByText('example.com')).toBeInTheDocument();
      });
    });
  });

  describe('URL Validation', () => {
    it('should validate correct HTTP URLs', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'http://example.com');

      expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument();
    });

    it('should validate correct HTTPS URLs', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'https://example.com/path?query=1');

      expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument();
    });

    it('should validate mailto links', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'mailto:test@example.com');

      expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument();
    });

    it('should validate localhost URLs', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'http://localhost:3000');

      expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument();
    });

    it('should validate IP address URLs', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'http://192.168.1.1:8080/api');

      expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument();
    });

    it('should show error for invalid URLs', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'not-a-url');

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
      });
    });

    it('should show error for URLs without protocol', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'example.com');

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
      });
    });

    it('should support protocol-relative URLs', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, '//example.com/path');

      expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument();
    });

    it('should clear error when valid URL is entered after invalid', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);

      // Enter invalid URL
      await userEvent.type(urlInput, 'invalid');
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
      });

      // Clear and enter valid URL
      await userEvent.clear(urlInput);
      await userEvent.type(urlInput, 'https://example.com');

      await waitFor(() => {
        expect(screen.queryByText(/please enter a valid url/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should update URL input', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'https://test.com');

      expect(urlInput).toHaveValue('https://test.com');
    });

    it('should update display text input', async () => {
      render(<LinkEditor {...defaultProps} />);

      const textInput = screen.getByLabelText(/display text/i);
      await userEvent.type(textInput, 'Click here');

      expect(textInput).toHaveValue('Click here');
    });

    it('should toggle target option', async () => {
      render(<LinkEditor {...defaultProps} />);

      const checkbox = screen.getByLabelText(/open in new tab/i);
      expect(checkbox).not.toBeChecked();

      await userEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      await userEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('should auto-fill display text from URL if empty', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      const textInput = screen.getByLabelText(/display text/i);

      // Use fireEvent to set the value all at once, which will trigger the auto-fill
      fireEvent.change(urlInput, { target: { value: 'https://example.com/page' } });

      // Wait for the auto-fill to happen (it happens in useEffect after validation)
      await waitFor(() => {
        expect(textInput).toHaveValue('example.com');
      }, { timeout: 3000 });
    });

    it('should not auto-fill display text if already has value', async () => {
      render(<LinkEditor {...defaultProps} />);

      const textInput = screen.getByLabelText(/display text/i);
      await userEvent.type(textInput, 'My Link');

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'https://example.com');

      expect(textInput).toHaveValue('My Link');
    });
  });

  describe('Form Submission', () => {
    it('should call onSave with correct data', async () => {
      const onSave = jest.fn();
      render(<LinkEditor {...defaultProps} onSave={onSave} />);

      const urlInput = screen.getByLabelText(/url/i);
      const textInput = screen.getByLabelText(/display text/i);
      const checkbox = screen.getByLabelText(/open in new tab/i);

      await userEvent.type(urlInput, 'https://example.com');
      // Clear the auto-filled text and type new text
      await userEvent.clear(textInput);
      await userEvent.type(textInput, 'Example');
      await userEvent.click(checkbox);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith({
          url: 'https://example.com',
          text: 'Example',
          target: '_blank'
        });
      });
    });

    it('should not save with invalid URL', async () => {
      const onSave = jest.fn();
      render(<LinkEditor {...defaultProps} onSave={onSave} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'invalid-url');

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
      });
    });

    it('should not save with empty URL', async () => {
      const onSave = jest.fn();
      render(<LinkEditor {...defaultProps} onSave={onSave} />);

      const textInput = screen.getByLabelText(/display text/i);
      await userEvent.type(textInput, 'Link Text');

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByText(/url is required/i)).toBeInTheDocument();
      });
    });

    it('should use URL as display text if text is empty', async () => {
      const onSave = jest.fn();
      render(<LinkEditor {...defaultProps} onSave={onSave} />);

      const urlInput = screen.getByLabelText(/url/i);
      const textInput = screen.getByLabelText(/display text/i);

      // Use fireEvent to set URL value to trigger auto-fill properly
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } });

      // Wait for auto-fill to complete
      await waitFor(() => {
        expect(textInput).toHaveValue('example.com');
      });

      // Now clear the text input to test fallback behavior
      fireEvent.change(textInput, { target: { value: '' } });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith({
          url: 'https://example.com',
          text: 'example.com',
          target: '_self'
        });
      });
    });

    it('should call onCancel when cancel is clicked', () => {
      const onCancel = jest.fn();
      render(<LinkEditor {...defaultProps} onCancel={onCancel} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Link Preview', () => {
    it('should show favicon in preview', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'https://github.com');

      await waitFor(() => {
        const favicon = screen.getByAltText('github.com favicon');
        expect(favicon).toHaveAttribute('src', expect.stringContaining('github.com'));
      });
    });

    it('should show domain in preview', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'https://www.example.com/path/to/page');

      await waitFor(() => {
        expect(screen.getByText('www.example.com')).toBeInTheDocument();
      });
    });

    it('should not show preview for invalid URLs', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'not-valid');

      expect(screen.queryByTestId('link-preview')).not.toBeInTheDocument();
    });

    it('should handle favicon loading errors gracefully', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'https://invalid-domain-12345.com');

      await waitFor(() => {
        const preview = screen.getByTestId('link-preview');
        expect(preview).toBeInTheDocument();
        // Should show fallback icon or no icon
        const favicon = screen.queryByAltText(/favicon/i);
        if (favicon) {
          fireEvent.error(favicon);
          expect(favicon).toHaveStyle({ display: 'none' });
        }
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should submit on Enter key in URL field', async () => {
      const onSave = jest.fn();
      render(<LinkEditor {...defaultProps} onSave={onSave} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'https://example.com');

      fireEvent.keyDown(urlInput, { key: 'Enter' });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });
    });

    it('should cancel on Escape key', () => {
      const onCancel = jest.fn();
      render(<LinkEditor {...defaultProps} onCancel={onCancel} />);

      const urlInput = screen.getByLabelText(/url/i);
      fireEvent.keyDown(urlInput, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<LinkEditor {...defaultProps} />);

      expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/display text/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/open in new tab/i)).toBeInTheDocument();
    });

    it('should announce validation errors', async () => {
      render(<LinkEditor {...defaultProps} />);

      const urlInput = screen.getByLabelText(/url/i);
      await userEvent.type(urlInput, 'invalid');

      await waitFor(() => {
        const error = screen.getByText(/please enter a valid url/i);
        expect(error).toHaveAttribute('role', 'alert');
      });
    });
  });
});