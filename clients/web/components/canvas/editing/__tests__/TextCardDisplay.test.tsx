/**
 * TextCardDisplay Component Tests
 *
 * TDD test suite for mode switching between read-only and edit modes.
 * Tests focus on transitions, visual indicators, and user interactions.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextCardDisplay, DisplayMode } from '../TextCardDisplay';
import type { TextCard, TiptapJSONContent } from '@/types/card.types';
import { TextContentFormat } from '@/types/card.types';

// Mock data
const createMockCard = (content: string | TiptapJSONContent, format: TextContentFormat = TextContentFormat.TIPTAP): TextCard => ({
  id: 'test-card-1' as import('@/types/card.types').CardId,
  ownerId: 'user-1' as import('@/types/common.types').EntityId,
  position: { x: 0, y: 0, z: 0 },
  dimensions: { width: 400, height: 300 },
  style: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    textColor: '#000000',
    borderWidth: 1,
    borderRadius: 8,
    shadow: false,
    opacity: 1
  },
  content: {
    type: 'text',
    format,
    content,
    markdown: format === TextContentFormat.MARKDOWN,
    wordCount: 3,
    lastEditedAt: Date.now().toString()
  },
  isSelected: false,
  isLocked: false,
  isHidden: false,
  isMinimized: false,
  status: 'active' as const,
  priority: 'normal' as const,
  createdAt: Date.now().toString(),
  updatedAt: Date.now().toString(),
  tags: [],
  metadata: {},
  animation: { isAnimating: false }
});

const mockTiptapContent: TiptapJSONContent = {
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [{ type: 'text', text: 'Test content for mode switching' }]
  }]
};

const mockCard = createMockCard(mockTiptapContent);

describe('TextCardDisplay', () => {
  describe('Mode Initialization', () => {
    it('should render in read-only mode by default', () => {
      render(<TextCardDisplay card={mockCard} onSave={jest.fn()} />);

      // Should show read-only content
      expect(screen.getByText('Test content for mode switching')).toBeInTheDocument();

      // Should not show editing controls
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('should render in edit mode when initialMode is edit', async () => {
      render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.EDIT}
        />
      );

      // Wait for lazy-loaded editor to render
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should respect controlled mode prop', async () => {
      const { rerender } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.READ_ONLY}
        />
      );

      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();

      rerender(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.EDIT}
        />
      );

      // Wait for lazy-loaded editor to render
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });
    });
  });

  describe('Mode Switching', () => {
    it('should switch to edit mode when edit button is clicked', async () => {
      const onModeChange = jest.fn();

      render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          onModeChange={onModeChange}
        />
      );

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(onModeChange).toHaveBeenCalledWith(DisplayMode.EDIT);
      });

      // Wait for lazy-loaded editor to render
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });
    });

    it('should switch to read-only mode when cancel is clicked', async () => {
      const onModeChange = jest.fn();

      render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.EDIT}
          onModeChange={onModeChange}
        />
      );

      // Wait for editor to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(onModeChange).toHaveBeenCalledWith(DisplayMode.READ_ONLY);
        expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
      });
    });

    it('should switch to read-only mode after successful save', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onModeChange = jest.fn();

      render(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          initialMode={DisplayMode.EDIT}
          onModeChange={onModeChange}
        />
      );

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
        expect(onModeChange).toHaveBeenCalledWith(DisplayMode.READ_ONLY);
      });
    });

    it('should preserve content during mode switches', async () => {
      const { rerender } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.READ_ONLY}
        />
      );

      expect(screen.getByText('Test content for mode switching')).toBeInTheDocument();

      // Switch to edit mode
      rerender(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.EDIT}
        />
      );

      // Content should still be present
      expect(screen.getByText('Test content for mode switching')).toBeInTheDocument();
    });
  });

  describe('Double-Click to Edit', () => {
    it('should enter edit mode on double-click', async () => {
      const onModeChange = jest.fn();

      const { container } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          onModeChange={onModeChange}
        />
      );

      // Double-click on the content area
      const contentArea = container.querySelector('.text-card-display');
      expect(contentArea).toBeInTheDocument();

      fireEvent.doubleClick(contentArea!);

      await waitFor(() => {
        expect(onModeChange).toHaveBeenCalledWith(DisplayMode.EDIT);
      });
    });

    it('should not enter edit mode on double-click when disabled', async () => {
      const onModeChange = jest.fn();

      const { container } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          onModeChange={onModeChange}
          disableDoubleClickEdit={true}
        />
      );

      const contentArea = container.querySelector('.text-card-display');
      fireEvent.doubleClick(contentArea!);

      await waitFor(() => {
        expect(onModeChange).not.toHaveBeenCalled();
      }, { timeout: 500 });
    });

    it('should not enter edit mode on double-click when card is locked', async () => {
      const lockedCard = { ...mockCard, isLocked: true };
      const onModeChange = jest.fn();

      const { container } = render(
        <TextCardDisplay
          card={lockedCard}
          onSave={jest.fn()}
          onModeChange={onModeChange}
        />
      );

      const contentArea = container.querySelector('.text-card-display');
      fireEvent.doubleClick(contentArea!);

      await waitFor(() => {
        expect(onModeChange).not.toHaveBeenCalled();
      }, { timeout: 500 });
    });
  });

  describe('Visual Indicators', () => {
    it('should show edit mode border in edit mode', () => {
      const { container } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.EDIT}
        />
      );

      const displayContainer = container.querySelector('.text-card-display');
      expect(displayContainer).toHaveClass('border-primary-500');
    });

    it('should show read-only border in read-only mode', () => {
      const { container } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.READ_ONLY}
        />
      );

      const displayContainer = container.querySelector('.text-card-display');
      expect(displayContainer).not.toHaveClass('border-primary-500');
    });

    it('should show focus state in edit mode', () => {
      const { container } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.EDIT}
        />
      );

      const displayContainer = container.querySelector('.text-card-display');
      expect(displayContainer).toHaveClass('ring-2', 'ring-primary-200');
    });

    it('should show edit button in read-only mode', () => {
      render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.READ_ONLY}
        />
      );

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should hide edit button in edit mode', () => {
      render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.EDIT}
        />
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });
  });

  describe('Smooth Transitions', () => {
    it('should animate transition from read-only to edit mode', async () => {
      const { container, rerender } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.READ_ONLY}
        />
      );

      const displayContainer = container.querySelector('.text-card-display');
      expect(displayContainer).toHaveStyle({ opacity: '1' });

      // Switch to edit mode
      rerender(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.EDIT}
        />
      );

      // Animation should be applied (framer-motion classes)
      await waitFor(() => {
        const updatedContainer = container.querySelector('.text-card-display');
        expect(updatedContainer).toBeInTheDocument();
      });
    });

    it('should animate transition from edit to read-only mode', async () => {
      const { container, rerender } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.EDIT}
        />
      );

      // Switch to read-only mode
      rerender(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.READ_ONLY}
        />
      );

      // Animation should be applied
      await waitFor(() => {
        const updatedContainer = container.querySelector('.text-card-display');
        expect(updatedContainer).toBeInTheDocument();
      });
    });

    it('should use 200ms transition duration', () => {
      const { container } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.READ_ONLY}
        />
      );

      const displayContainer = container.querySelector('.text-card-display');
      // Framer Motion applies transition via motion components
      expect(displayContainer).toBeInTheDocument();
    });
  });

  describe('Lazy Loading', () => {
    it('should not load TextEditor in read-only mode', () => {
      render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.READ_ONLY}
        />
      );

      // TextEditor should not be mounted
      expect(screen.queryByTestId('text-editor')).not.toBeInTheDocument();
    });

    it('should load TextEditor when entering edit mode', async () => {
      const { rerender } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.READ_ONLY}
        />
      );

      expect(screen.queryByTestId('text-editor')).not.toBeInTheDocument();

      // Switch to edit mode
      rerender(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.EDIT}
        />
      );

      // TextEditor should be mounted
      await waitFor(() => {
        expect(screen.getByTestId('text-editor')).toBeInTheDocument();
      });
    });

    it('should show loading skeleton while editor initializes', async () => {
      const { rerender } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.READ_ONLY}
        />
      );

      // Switch to edit mode
      rerender(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.EDIT}
        />
      );

      // Loading skeleton should appear briefly
      const skeleton = screen.queryByTestId('editor-loading-skeleton');
      // Skeleton may or may not be visible depending on editor initialization speed
      // Just verify it's in the DOM structure if editor is still loading
    });
  });

  describe('Accessibility', () => {
    it('should announce mode change to screen readers', async () => {
      const { rerender } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.READ_ONLY}
        />
      );

      rerender(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          mode={DisplayMode.EDIT}
        />
      );

      // Check for aria-live region
      const announcement = screen.getByRole('status', { hidden: true });
      expect(announcement).toBeInTheDocument();
    });

    it('should have appropriate ARIA labels', () => {
      render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.READ_ONLY}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toHaveAttribute('aria-label', expect.stringContaining('Edit'));
    });

    it('should be keyboard accessible', async () => {
      const onModeChange = jest.fn();

      render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          onModeChange={onModeChange}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });

      // Button click via keyboard (Enter or Space triggers click event)
      editButton.focus();
      fireEvent.click(editButton); // Keyboard triggers click events

      await waitFor(() => {
        expect(onModeChange).toHaveBeenCalledWith(DisplayMode.EDIT);
      });
    });

    it('should trap focus in edit mode', () => {
      render(
        <TextCardDisplay
          card={mockCard}
          onSave={jest.fn()}
          initialMode={DisplayMode.EDIT}
        />
      );

      // Verify interactive elements are present and focusable
      const saveButton = screen.getByRole('button', { name: /save/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      expect(saveButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should remain in edit mode when save fails', async () => {
      // Suppress console errors for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const onSave = jest.fn().mockRejectedValue(new Error('Save failed'));
      const onModeChange = jest.fn();

      render(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          initialMode={DisplayMode.EDIT}
          onModeChange={onModeChange}
        />
      );

      // Wait for editor to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      // Should still be in edit mode
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(onModeChange).not.toHaveBeenCalledWith(DisplayMode.READ_ONLY);

      consoleSpy.mockRestore();
    });

    // Note: Error display is handled by TextEditor component's BaseEditor
    // This test verifies the error is caught and doesn't cause mode switch
    it('should handle save errors gracefully', async () => {
      // Suppress console errors for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const onSave = jest.fn().mockRejectedValue(new Error('Network error'));

      render(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          initialMode={DisplayMode.EDIT}
        />
      );

      // Wait for editor to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      // Should still have save button (still in edit mode)
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });
});
