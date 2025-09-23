/**
 * Integration tests for InfiniteCanvas card creation workflow
 *
 * This test suite covers:
 * - Complete card creation workflows from keyboard shortcuts to modal
 * - Integration between useCardCreation, useCanvasEvents, and UI components
 * - Right-click context menu to card creation flow
 * - Modal-based card creation with form validation
 * - Position calculation and coordinate transformations
 * - Error handling in the complete workflow
 * - Accessibility of the full card creation experience
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { InfiniteCanvas } from '../InfiniteCanvas';
import {
  setupKonvaMocks,
  createMockCardStore,
  createMockCanvasStore,
  mockMatchMedia,
  mockResizeObserver,
  mockGetBoundingClientRect,
} from '../../../__tests__/utils';
import { createCardId } from '@/types/card.types';

// Setup all mocks
beforeAll(() => {
  setupKonvaMocks();
  mockMatchMedia();
  mockResizeObserver();
  mockGetBoundingClientRect();
});

// Mock the stores
const mockCardStore = createMockCardStore();
const mockCanvasStore = createMockCanvasStore();

jest.mock('@/stores/cardStore', () => ({
  useCardStore: () => mockCardStore,
}));

jest.mock('@/stores/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore,
}));

// Mock dynamic imports
jest.mock('next/dynamic', () => (importFunc: any) => {
  return React.forwardRef((props: any, ref: any) => {
    const MockComponent = ({ children, ...otherProps }: any) =>
      React.createElement('div', { ...otherProps, ref }, children);
    return <MockComponent {...props} />;
  });
});

// Mock useCanvasSize hook
jest.mock('@/hooks/useCanvasSize', () => ({
  useCanvasSize: () => ({ width: 1024, height: 768 }),
}));

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

describe('InfiniteCanvas - Card Creation Integration', () => {
  let container: HTMLElement;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset stores to default state
    mockCanvasStore.viewport = {
      position: { x: 0, y: 0 },
      zoom: 1,
      bounds: { x: 0, y: 0, width: 1024, height: 768 },
    };
    mockCanvasStore.config = {
      zoom: { min: 0.1, max: 10, step: 0.1 },
      grid: { enabled: true, size: 20, color: '#e5e7eb', opacity: 0.3 },
      performance: { enableCulling: true, enableVirtualization: true, maxVisibleCards: 1000 },
    };

    mockCardStore.createCard.mockImplementation((params) => {
      const idString = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return createCardId(idString);
    });
  });

  const renderInfiniteCanvas = (props = {}) => {
    const result = render(<InfiniteCanvas {...props} />);
    container = result.container.firstChild as HTMLElement;
    return result;
  };

  describe('Keyboard Shortcut Integration', () => {
    it('should create text card with T key when canvas is focused', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      // Focus the canvas
      const canvas = screen.getByRole('application');
      await user.click(canvas);

      // Press T key
      await user.keyboard('t');

      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'text',
            position: {
              x: 512, // (1024 / 2)
              y: 384, // (768 / 2)
              z: expect.any(Number),
            },
            content: expect.objectContaining({
              type: 'text',
            }),
          })
        );
      });
    });

    it('should create image card with I key', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('i');

      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'image',
            position: expect.any(Object),
            content: expect.objectContaining({
              type: 'image',
            }),
          })
        );
      });
    });

    it('should create link card with L key', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('l');

      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'link',
            position: expect.any(Object),
            content: expect.objectContaining({
              type: 'link',
            }),
          })
        );
      });
    });

    it('should create code card with C key', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('c');

      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'code',
            position: expect.any(Object),
            content: expect.objectContaining({
              type: 'code',
            }),
          })
        );
      });
    });

    it('should open modal with Shift+N', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('{Shift>}n{/Shift}');

      // Should open the CreateCardModal
      await waitFor(() => {
        expect(screen.getByText('Create New Card')).toBeInTheDocument();
      });
    });

    it('should create text card with N key', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('n');

      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'text',
            position: expect.any(Object),
          })
        );
      });
    });
  });

  describe('Right-Click Context Menu Integration', () => {
    it('should show context menu on right-click', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');

      // Right-click on canvas
      await user.pointer({
        keys: '[MouseRight]',
        target: canvas,
        coords: { x: 300, y: 400 },
      });

      // Should show the context menu
      await waitFor(() => {
        expect(screen.getByText('Create New Card')).toBeInTheDocument();
        expect(screen.getByText('Text Card')).toBeInTheDocument();
        expect(screen.getByText('Image Card')).toBeInTheDocument();
        expect(screen.getByText('Link Card')).toBeInTheDocument();
        expect(screen.getByText('Code Card')).toBeInTheDocument();
      });
    });

    it('should create card from context menu selection', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');

      // Right-click to open context menu
      await user.pointer({
        keys: '[MouseRight]',
        target: canvas,
        coords: { x: 300, y: 400 },
      });

      // Click on Image Card in context menu
      await waitFor(() => {
        expect(screen.getByText('Image Card')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Image Card'));

      // Should create image card at click position
      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'image',
            position: {
              x: 300, // Click position
              y: 400,
              z: expect.any(Number),
            },
          })
        );
      });
    });

    it('should open modal from context menu "More Options"', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');

      // Right-click to open context menu
      await user.pointer({
        keys: '[MouseRight]',
        target: canvas,
        coords: { x: 200, y: 300 },
      });

      // Click on More Options
      await waitFor(() => {
        expect(screen.getByText('More Options...')).toBeInTheDocument();
      });

      await user.click(screen.getByText('More Options...'));

      // Should open the modal
      await waitFor(() => {
        expect(screen.getByText('Create New Card')).toBeInTheDocument();
        expect(screen.getByLabelText(/Content/)).toBeInTheDocument();
      });
    });

    it('should close context menu on outside click', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');

      // Right-click to open context menu
      await user.pointer({
        keys: '[MouseRight]',
        target: canvas,
        coords: { x: 300, y: 400 },
      });

      await waitFor(() => {
        expect(screen.getByText('Create New Card')).toBeInTheDocument();
      });

      // Click outside the context menu
      await user.click(canvas);

      // Context menu should be closed
      await waitFor(() => {
        expect(screen.queryByText('Create New Card')).not.toBeInTheDocument();
      });
    });
  });

  describe('Modal Card Creation Workflow', () => {
    it('should create card through modal with form data', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      // Open modal via Shift+N
      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('{Shift>}n{/Shift}');

      // Fill in form data
      await waitFor(() => {
        expect(screen.getByLabelText(/Content/)).toBeInTheDocument();
      });

      const titleField = screen.getByLabelText(/Title/);
      const contentField = screen.getByLabelText(/Content/);

      await user.type(titleField, 'Test Card Title');
      await user.type(contentField, 'This is test content');

      // Submit form
      const createButton = screen.getByText('Create Card');
      await user.click(createButton);

      // Should create card with form data
      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'text',
            content: expect.objectContaining({
              content: 'This is test content',
            }),
            metadata: expect.objectContaining({
              title: 'Test Card Title',
            }),
          })
        );
      });

      // Modal should close after creation
      await waitFor(() => {
        expect(screen.queryByText('Create New Card')).not.toBeInTheDocument();
      });
    });

    it('should switch card types in modal and update form fields', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      // Open modal
      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('{Shift>}n{/Shift}');

      // Initially should show text fields
      await waitFor(() => {
        expect(screen.getByLabelText(/Content/)).toBeInTheDocument();
      });

      // Switch to image type
      const imageCardButton = screen.getByText('image Card');
      await user.click(imageCardButton);

      // Should show image-specific fields
      await waitFor(() => {
        expect(screen.getByLabelText(/Image URL/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Alt Text/)).toBeInTheDocument();
      });

      // Fill in image data
      await user.type(screen.getByLabelText(/Image URL/), 'https://example.com/image.jpg');
      await user.type(screen.getByLabelText(/Alt Text/), 'Test image');

      // Submit
      await user.click(screen.getByText('Create Card'));

      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'image',
            content: expect.objectContaining({
              url: 'https://example.com/image.jpg',
              alt: 'Test image',
            }),
          })
        );
      });
    });

    it('should validate form data and show errors', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      // Open modal
      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('{Shift>}n{/Shift}');

      // Try to submit without content
      await waitFor(() => {
        expect(screen.getByText('Create Card')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Card'));

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Content is required')).toBeInTheDocument();
      });

      // Card should not be created
      expect(mockCardStore.createCard).not.toHaveBeenCalled();
    });

    it('should close modal on cancel', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      // Open modal
      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('{Shift>}n{/Shift}');

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancel'));

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Create New Card')).not.toBeInTheDocument();
      });
    });
  });

  describe('Position Calculations and Viewport Integration', () => {
    it('should create cards at correct positions with viewport offset', async () => {
      const user = userEvent.setup();

      // Set viewport with offset
      mockCanvasStore.viewport.position = { x: -100, y: -50 };

      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('t');

      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            position: {
              x: 612, // (-(-100) + 1024/2) / 1
              y: 434, // (-(-50) + 768/2) / 1
              z: expect.any(Number),
            },
          })
        );
      });
    });

    it('should create cards at correct positions with zoom', async () => {
      const user = userEvent.setup();

      // Set viewport with zoom
      mockCanvasStore.viewport.zoom = 2;

      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('i');

      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            position: {
              x: 256, // (1024 / 2) / 2
              y: 192, // (768 / 2) / 2
              z: expect.any(Number),
            },
          })
        );
      });
    });

    it('should convert screen coordinates to canvas coordinates for context menu', async () => {
      const user = userEvent.setup();

      // Set viewport with both offset and zoom
      mockCanvasStore.viewport.position = { x: -200, y: -100 };
      mockCanvasStore.viewport.zoom = 1.5;

      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');

      // Right-click at specific screen position
      await user.pointer({
        keys: '[MouseRight]',
        target: canvas,
        coords: { x: 450, y: 600 },
      });

      // Click on a card type
      await waitFor(() => {
        expect(screen.getByText('Text Card')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Text Card'));

      // Should create card at converted canvas coordinates
      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            position: {
              x: 433.3333333333333, // (450 - (-200)) / 1.5
              y: 466.6666666666667, // (600 - (-100)) / 1.5
              z: expect.any(Number),
            },
          })
        );
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle card creation errors gracefully', async () => {
      const user = userEvent.setup();

      // Mock card creation to fail
      mockCardStore.createCard.mockImplementation(() => {
        throw new Error('Creation failed');
      });

      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('t');

      // Should not crash the application
      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalled();
      });

      // Canvas should still be functional
      expect(canvas).toBeInTheDocument();
    });

    it('should show error in modal when creation fails', async () => {
      const user = userEvent.setup();

      // Mock card creation to fail
      mockCardStore.createCard.mockImplementation(() => {
        throw new Error('Network error');
      });

      renderInfiniteCanvas();

      // Open modal and fill form
      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('{Shift>}n{/Shift}');

      await waitFor(() => {
        expect(screen.getByLabelText(/Content/)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Content/), 'Test content');
      await user.click(screen.getByText('Create Card'));

      // Should show error in modal
      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Modal should stay open
      expect(screen.getByText('Create New Card')).toBeInTheDocument();
    });

    it('should recover from errors and allow retry', async () => {
      const user = userEvent.setup();

      // Mock card creation to fail first, then succeed
      mockCardStore.createCard
        .mockImplementationOnce(() => {
          throw new Error('First attempt failed');
        })
        .mockReturnValueOnce(createCardId('success-card-id'));

      renderInfiniteCanvas();

      // First attempt - should fail
      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('t');

      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledTimes(1);
      });

      // Second attempt - should succeed
      await user.keyboard('t');

      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Accessibility Integration', () => {
    it('should have proper ARIA labels and descriptions', () => {
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      expect(canvas).toHaveAttribute('aria-label', 'Interactive infinite canvas workspace');
      expect(canvas).toHaveAttribute(
        'aria-description',
        'Use arrow keys to pan, plus and minus keys to zoom, space to reset view. Right-click to create cards.'
      );
    });

    it('should support custom accessibility labels', () => {
      renderInfiniteCanvas({
        ariaLabel: 'Custom canvas label',
        ariaDescription: 'Custom canvas description',
      });

      const canvas = screen.getByRole('application');
      expect(canvas).toHaveAttribute('aria-label', 'Custom canvas label');
      expect(canvas).toHaveAttribute('aria-description', 'Custom canvas description');
    });

    it('should handle keyboard navigation without interfering with card creation', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      await user.click(canvas);

      // Arrow key navigation should work
      await user.keyboard('{ArrowUp}');
      expect(mockCanvasStore.setPosition).toHaveBeenCalledWith({
        x: 0,
        y: 20, // panSpeed
      });

      // Card creation shortcuts should still work
      await user.keyboard('t');
      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalled();
      });
    });

    it('should not interfere with form input when modal is open', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      // Open modal
      const canvas = screen.getByRole('application');
      await user.click(canvas);
      await user.keyboard('{Shift>}n{/Shift}');

      // Focus on input field
      await waitFor(() => {
        expect(screen.getByLabelText(/Content/)).toBeInTheDocument();
      });

      const contentField = screen.getByLabelText(/Content/);
      await user.click(contentField);

      // Typing 't' should input text, not create card
      await user.keyboard('t');

      expect(contentField).toHaveValue('t');
      expect(mockCardStore.createCard).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid keyboard shortcuts gracefully', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');
      await user.click(canvas);

      // Rapid key presses
      await user.keyboard('ttiillcc');

      // Should handle all key presses
      await waitFor(() => {
        expect(mockCardStore.createCard).toHaveBeenCalledTimes(8);
      });
    });

    it('should handle simultaneous context menu and keyboard shortcuts', async () => {
      const user = userEvent.setup();
      renderInfiniteCanvas();

      const canvas = screen.getByRole('application');

      // Open context menu
      await user.pointer({
        keys: '[MouseRight]',
        target: canvas,
        coords: { x: 300, y: 400 },
      });

      // Try keyboard shortcut while menu is open
      await user.keyboard('t');

      // Should prioritize context menu state
      await waitFor(() => {
        expect(screen.getByText('Create New Card')).toBeInTheDocument();
      });

      // Keyboard shortcut should not create card
      expect(mockCardStore.createCard).not.toHaveBeenCalled();
    });

    it('should clean up event listeners properly', () => {
      const { unmount } = renderInfiniteCanvas();

      // Should not throw when unmounting
      expect(() => unmount()).not.toThrow();
    });
  });
});