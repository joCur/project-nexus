/**
 * CreateCanvasModal Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { CreateCanvasModal } from '../CreateCanvasModal';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@/stores/workspaceStore');
jest.mock('@/hooks/use-canvas');
jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

// Mock UI components - simplified mocks for testing
jest.mock('@/components/ui', () => {
  const MockModal = ({ children, isOpen, initialFocus, size }: any) => {
    React.useEffect(() => {
      if (isOpen && initialFocus?.current) {
        initialFocus.current.focus();
      }
    }, [isOpen, initialFocus]);
    return isOpen ? <div data-testid="modal" data-size={size}>{children}</div> : null;
  };
    
  const MockButton = ({ children, onClick, disabled, variant, type, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      data-variant={variant}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
  
  const MockInput = React.forwardRef<HTMLInputElement, any>(({ value, onChange, onBlur, disabled, state, placeholder, id, ...props }, ref) => (
    <input
      ref={ref}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      data-state={state}
      placeholder={placeholder}
      id={id}
      {...props}
    />
  ));
  MockInput.displayName = 'MockInput';

  return {
    Modal: MockModal,
    ModalHeader: ({ children }: any) => <div data-testid="modal-header">{children}</div>,
    ModalTitle: ({ children }: any) => <h2 data-testid="modal-title">{children}</h2>,
    ModalContent: ({ children }: any) => <div data-testid="modal-content">{children}</div>,
    ModalFooter: ({ children }: any) => <div data-testid="modal-footer">{children}</div>,
    Button: MockButton,
    Input: MockInput,
  };
});

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.Mock;
const mockUseWorkspaceStore = useWorkspaceStore as jest.MockedFunction<typeof useWorkspaceStore>;

const mockCreateCanvas = jest.fn();
const mockSetDefaultCanvas = jest.fn();
const mockSetCurrentCanvas = jest.fn();

// Import and mock the canvas hooks after mocking
require('@/hooks/use-canvas');

describe('CreateCanvasModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    workspaceId: 'workspace-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    } as any);

    mockUseWorkspaceStore.mockImplementation((selector?: any) => {
      const mockStore = {
        setCurrentCanvas: mockSetCurrentCanvas,
        canvasManagement: {
          loadingStates: {
            creatingCanvas: false,
          },
        },
      };

      if (!selector) return mockStore;
      
      if (selector.toString().includes('loadingStates.creatingCanvas')) {
        return false;
      }
      
      return selector(mockStore);
    });

    // Mock canvas hooks
    const { useCreateCanvas, useSetDefaultCanvas } = require('@/hooks/use-canvas');
    
    mockCreateCanvas.mockResolvedValue('canvas-123');
    mockSetDefaultCanvas.mockResolvedValue(true);
    
    (useCreateCanvas as jest.Mock).mockReturnValue({
      mutate: mockCreateCanvas,
      loading: false,
      error: null,
      reset: jest.fn(),
    });
    
    (useSetDefaultCanvas as jest.Mock).mockReturnValue({
      mutate: mockSetDefaultCanvas,
      loading: false,
      error: null,
      reset: jest.fn(),
    });

    mockCreateCanvas.mockResolvedValue('new-canvas-id');
    mockSetDefaultCanvas.mockResolvedValue(true);
  });

  describe('Rendering', () => {
    it('renders modal when open', () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Create New Canvas');
    });

    it('does not render when closed', () => {
      render(<CreateCanvasModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      expect(screen.getByLabelText(/Canvas Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Set as default canvas/)).toBeInTheDocument();
    });

    it('has correct modal size', () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      expect(screen.getByTestId('modal')).toHaveAttribute('data-size', 'medium');
    });
  });

  describe('Form Validation', () => {
    it('requires canvas name', async () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: /Create Canvas/ });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Canvas name is required')).toBeInTheDocument();
      });
    });

    it('validates canvas name length', async () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      const longName = 'a'.repeat(101);
      
      fireEvent.change(nameInput, { target: { value: longName } });
      fireEvent.click(screen.getByRole('button', { name: /Create Canvas/ }));
      
      await waitFor(() => {
        expect(screen.getByText('Canvas name must be 100 characters or less')).toBeInTheDocument();
      });
    });

    it('validates description length', async () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      const descriptionInput = screen.getByLabelText(/Description/);
      const longDescription = 'a'.repeat(501);
      
      fireEvent.change(nameInput, { target: { value: 'Valid Name' } });
      fireEvent.change(descriptionInput, { target: { value: longDescription } });
      fireEvent.click(screen.getByRole('button', { name: /Create Canvas/ }));
      
      await waitFor(() => {
        expect(screen.getByText('Description must be 500 characters or less')).toBeInTheDocument();
      });
    });

    it('clears field errors when user starts typing', async () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      const submitButton = screen.getByRole('button', { name: /Create Canvas/ });
      
      // Trigger validation error
      fireEvent.click(submitButton);
      await waitFor(() => {
        expect(screen.getByText('Canvas name is required')).toBeInTheDocument();
      });
      
      // Start typing to clear error
      fireEvent.change(nameInput, { target: { value: 'New Name' } });
      
      expect(screen.queryByText('Canvas name is required')).not.toBeInTheDocument();
    });

    it('disables submit button when name is empty', () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: /Create Canvas/ });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when name is provided', async () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      const submitButton = screen.getByRole('button', { name: /Create Canvas/ });
      
      fireEvent.change(nameInput, { target: { value: 'Test Canvas' } });
      
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('creates canvas with valid form data', async () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      const descriptionInput = screen.getByLabelText(/Description/);
      const submitButton = screen.getByRole('button', { name: /Create Canvas/ });
      
      fireEvent.change(nameInput, { target: { value: 'Test Canvas' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockCreateCanvas).toHaveBeenCalledWith({
          workspaceId: 'workspace-1',
          name: 'Test Canvas',
          description: 'Test Description',
          priority: 'normal',
          tags: [],
          settings: expect.objectContaining({
            isDefault: false,
            position: { x: 0, y: 0, z: 0 },
            zoom: 1.0,
          }),
        });
      });
    });

    it('sets canvas as default when checkbox is checked', async () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      const defaultCheckbox = screen.getByLabelText(/Set as default canvas/);
      const submitButton = screen.getByRole('button', { name: /Create Canvas/ });
      
      fireEvent.change(nameInput, { target: { value: 'Test Canvas' } });
      fireEvent.click(defaultCheckbox);
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockCreateCanvas).toHaveBeenCalled();
        expect(mockSetDefaultCanvas).toHaveBeenCalledWith('workspace-1', 'new-canvas-id');
      });
    });

    it('navigates to new canvas after creation', async () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      const submitButton = screen.getByRole('button', { name: /Create Canvas/ });
      
      fireEvent.change(nameInput, { target: { value: 'Test Canvas' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/workspace/workspace-1/canvas/new-canvas-id');
      });
    });

    it('closes modal after successful creation', async () => {
      const onClose = jest.fn();
      render(<CreateCanvasModal {...defaultProps} onClose={onClose} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      const submitButton = screen.getByRole('button', { name: /Create Canvas/ });
      
      fireEvent.change(nameInput, { target: { value: 'Test Canvas' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('shows error when canvas creation fails', async () => {
      mockCreateCanvas.mockResolvedValueOnce(null);
      
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      const submitButton = screen.getByRole('button', { name: /Create Canvas/ });
      
      fireEvent.change(nameInput, { target: { value: 'Test Canvas' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to create canvas. Please try again.')).toBeInTheDocument();
      });
    });

    it('handles unexpected errors', async () => {
      const error = new Error('Network error');
      mockCreateCanvas.mockRejectedValueOnce(error);
      
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      const submitButton = screen.getByRole('button', { name: /Create Canvas/ });
      
      fireEvent.change(nameInput, { target: { value: 'Test Canvas' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state during creation', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        if (selector?.toString().includes('loadingStates.creatingCanvas')) {
          return true;
        }
        return {
          createCanvas: mockCreateCanvas,
          setDefaultCanvas: mockSetDefaultCanvas,
          canvasManagement: {
            loadingStates: { creatingCanvas: true },
          },
        };
      });
      
      render(<CreateCanvasModal {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /Creating.../ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Creating.../ })).toBeDisabled();
    });

    it('disables form fields during creation', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        if (selector?.toString().includes('loadingStates.creatingCanvas')) {
          return true;
        }
        return {
          createCanvas: mockCreateCanvas,
          setDefaultCanvas: mockSetDefaultCanvas,
          canvasManagement: {
            loadingStates: { creatingCanvas: true },
          },
        };
      });
      
      render(<CreateCanvasModal {...defaultProps} />);
      
      expect(screen.getByLabelText(/Canvas Name/)).toBeDisabled();
      expect(screen.getByLabelText(/Description/)).toBeDisabled();
      expect(screen.getByLabelText(/Set as default canvas/)).toBeDisabled();
    });

    it('prevents modal close during creation', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        if (selector?.toString().includes('loadingStates.creatingCanvas')) {
          return true;
        }
        return {
          createCanvas: mockCreateCanvas,
          setDefaultCanvas: mockSetDefaultCanvas,
          canvasManagement: {
            loadingStates: { creatingCanvas: true },
          },
        };
      });
      
      const onClose = jest.fn();
      render(<CreateCanvasModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Modal Behavior', () => {
    it('calls onClose when cancel button is clicked', () => {
      const onClose = jest.fn();
      render(<CreateCanvasModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
      
      expect(onClose).toHaveBeenCalled();
    });

    it('resets form when modal is closed and reopened', async () => {
      const { rerender } = render(<CreateCanvasModal {...defaultProps} />);
      
      // Fill form
      const nameInput = screen.getByLabelText(/Canvas Name/);
      fireEvent.change(nameInput, { target: { value: 'Test Canvas' } });
      
      // Close and reopen modal
      rerender(<CreateCanvasModal {...defaultProps} isOpen={false} />);
      rerender(<CreateCanvasModal {...defaultProps} isOpen={true} />);
      
      // Form should be reset
      expect(screen.getByLabelText(/Canvas Name/)).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('focuses name input when modal opens', () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      expect(nameInput).toHaveAttribute('autoFocus');
    });

    it('has proper form labels and descriptions', () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      expect(screen.getByLabelText(/Canvas Name.*required/)).toBeInTheDocument();
      expect(screen.getByText(/Give your canvas a descriptive name/)).toBeInTheDocument();
      expect(screen.getByText(/Optional description to help identify/)).toBeInTheDocument();
    });

    it('has proper error announcements', async () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /Create Canvas/ }));
      
      await waitFor(() => {
        const errorMessage = screen.getByText('Canvas name is required');
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    it('has proper ARIA relationships for form fields', () => {
      render(<CreateCanvasModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/Canvas Name/);
      expect(nameInput).toHaveAttribute('aria-describedby');
    });

    it('announces loading state to screen readers', () => {
      mockUseWorkspaceStore.mockImplementation((selector?: any) => {
        if (selector?.toString().includes('loadingStates.creatingCanvas')) {
          return true;
        }
        return {
          createCanvas: mockCreateCanvas,
          setDefaultCanvas: mockSetDefaultCanvas,
          canvasManagement: {
            loadingStates: { creatingCanvas: true },
          },
        };
      });
      
      render(<CreateCanvasModal {...defaultProps} />);
      
      expect(screen.getByText('Creating canvas, please wait...')).toHaveClass('sr-only');
      expect(screen.getByText('Creating canvas, please wait...')).toHaveAttribute('aria-live', 'polite');
    });
  });
});