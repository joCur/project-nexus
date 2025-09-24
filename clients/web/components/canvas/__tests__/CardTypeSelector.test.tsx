/**
 * Tests for CardTypeSelector component
 *
 * This test suite covers:
 * - Rendering of card types with correct icons and descriptions
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Card type selection and callbacks
 * - Accessibility (ARIA labels, screen reader support)
 * - Disabled state handling
 * - Keyboard shortcut display
 * - Grid and list layout variants
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import CardTypeSelector from '../CardTypeSelector';
import type { CardType } from '@/types/card.types';
import {
  mockMatchMedia,
  expectAriaAttributes,
  checkKeyboardAccessibility,
  simulateKeyboardNavigation,
} from '../../../__tests__/utils';

// Setup mocks
beforeAll(() => {
  mockMatchMedia();
});

describe('CardTypeSelector', () => {
  const mockOnTypeSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    onTypeSelect: mockOnTypeSelect,
  };

  describe('Basic Rendering', () => {
    it('should render all card type options', () => {
      render(<CardTypeSelector {...defaultProps} />);

      // Check that all card types are rendered
      expect(screen.getByText('Text Card')).toBeInTheDocument();
      expect(screen.getByText('Image Card')).toBeInTheDocument();
      expect(screen.getByText('Link Card')).toBeInTheDocument();
      expect(screen.getByText('Code Card')).toBeInTheDocument();
    });

    it('should render with correct ARIA attributes', () => {
      render(<CardTypeSelector {...defaultProps} />);

      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toHaveAttribute('aria-label', 'Select card type');

      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons).toHaveLength(4);

      radioButtons.forEach((button, index) => {
        expectAriaAttributes(button, {
          'aria-checked': 'false',
          'aria-disabled': 'false',
        });
      });
    });

    it('should render descriptions by default', () => {
      render(<CardTypeSelector {...defaultProps} />);

      expect(screen.getByText('Rich text content with markdown support')).toBeInTheDocument();
      expect(screen.getByText('Visual content with captions and metadata')).toBeInTheDocument();
      expect(screen.getByText('Web links with preview and metadata')).toBeInTheDocument();
      expect(screen.getByText('Syntax-highlighted code snippets')).toBeInTheDocument();
    });

    it('should hide descriptions when showDescriptions is false', () => {
      render(<CardTypeSelector {...defaultProps} showDescriptions={false} />);

      expect(screen.queryByText('Rich text content with markdown support')).not.toBeInTheDocument();
      expect(screen.queryByText('Visual content with captions and metadata')).not.toBeInTheDocument();
    });

    it('should show keyboard shortcuts when showShortcuts is true', () => {
      render(<CardTypeSelector {...defaultProps} showShortcuts={true} />);

      expect(screen.getByText('T')).toBeInTheDocument();
      expect(screen.getByText('I')).toBeInTheDocument();
      expect(screen.getByText('L')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
    });

    it('should hide keyboard shortcuts by default', () => {
      render(<CardTypeSelector {...defaultProps} />);

      // Should not find shortcut elements (using more specific selectors)
      expect(screen.queryByRole('generic', { name: /T/ })).not.toBeInTheDocument();
    });
  });

  describe('Layout Variants', () => {
    it('should render in grid layout by default', () => {
      render(<CardTypeSelector {...defaultProps} />);

      const container = screen.getByRole('radiogroup');
      expect(container).toHaveClass('grid', 'grid-cols-2', 'gap-3');
    });

    it('should render in list layout when variant is list', () => {
      render(<CardTypeSelector {...defaultProps} variant="list" />);

      const container = screen.getByRole('radiogroup');
      expect(container).toHaveClass('flex', 'flex-col', 'space-y-2');
    });
  });

  describe('Size Variants', () => {
    it('should apply small size classes when size is sm', () => {
      render(<CardTypeSelector {...defaultProps} size="sm" />);

      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        expect(button).toHaveClass('p-2');
      });
    });

    it('should apply medium size classes by default', () => {
      render(<CardTypeSelector {...defaultProps} />);

      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        expect(button).toHaveClass('p-3');
      });
    });

    it('should apply large size classes when size is lg', () => {
      render(<CardTypeSelector {...defaultProps} size="lg" />);

      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        expect(button).toHaveClass('p-4');
      });
    });
  });

  describe('Selection State', () => {
    it('should mark selected type as checked', () => {
      render(<CardTypeSelector {...defaultProps} selectedType="text" />);

      const textCardButton = screen.getByRole('radio', { name: /Text Card/ });
      expect(textCardButton).toHaveAttribute('aria-checked', 'true');

      const otherButtons = screen.getAllByRole('radio').filter(button => button !== textCardButton);
      otherButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-checked', 'false');
      });
    });

    it('should show selection indicator for selected type', () => {
      render(<CardTypeSelector {...defaultProps} selectedType="image" />);

      // Check for visual selection indicator (checkmark icon)
      const imageButton = screen.getByRole('radio', { name: /Image Card/ });
      expect(imageButton).toHaveClass('ring-2', 'ring-offset-2', 'ring-current');
    });

    it('should apply correct color styling to selected type', () => {
      render(<CardTypeSelector {...defaultProps} selectedType="link" />);

      const linkButton = screen.getByRole('radio', { name: /Link Card/ });
      expect(linkButton).toHaveClass('text-purple-600', 'bg-purple-50', 'border-purple-200');
    });
  });

  describe('User Interactions', () => {
    it('should call onTypeSelect when card type is clicked', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} />);

      const textCardButton = screen.getByRole('radio', { name: /Text Card/ });
      await user.click(textCardButton);

      expect(mockOnTypeSelect).toHaveBeenCalledWith('text');
    });

    it('should call onTypeSelect when Enter key is pressed', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} />);

      const imageCardButton = screen.getByRole('radio', { name: /Image Card/ });
      imageCardButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnTypeSelect).toHaveBeenCalledWith('image');
    });

    it('should call onTypeSelect when Space key is pressed', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} />);

      const linkCardButton = screen.getByRole('radio', { name: /Link Card/ });
      linkCardButton.focus();
      await user.keyboard(' ');

      expect(mockOnTypeSelect).toHaveBeenCalledWith('link');
    });

    it('should prevent default behavior for Enter and Space keys', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} />);

      const codeCardButton = screen.getByRole('radio', { name: /Code Card/ });
      codeCardButton.focus();

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });

      const preventDefaultSpy = jest.spyOn(enterEvent, 'preventDefault');
      const preventDefaultSpySpc = jest.spyOn(spaceEvent, 'preventDefault');

      fireEvent(codeCardButton, enterEvent);
      fireEvent(codeCardButton, spaceEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(preventDefaultSpySpc).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should disable specified card types', () => {
      render(<CardTypeSelector {...defaultProps} disabledTypes={['text', 'image']} />);

      const textCardButton = screen.getByRole('radio', { name: /Text Card/ });
      const imageCardButton = screen.getByRole('radio', { name: /Image Card/ });
      const linkCardButton = screen.getByRole('radio', { name: /Link Card/ });
      const codeCardButton = screen.getByRole('radio', { name: /Code Card/ });

      expect(textCardButton).toBeDisabled();
      expect(textCardButton).toHaveAttribute('aria-disabled', 'true');

      expect(imageCardButton).toBeDisabled();
      expect(imageCardButton).toHaveAttribute('aria-disabled', 'true');

      expect(linkCardButton).not.toBeDisabled();
      expect(linkCardButton).toHaveAttribute('aria-disabled', 'false');

      expect(codeCardButton).not.toBeDisabled();
      expect(codeCardButton).toHaveAttribute('aria-disabled', 'false');
    });

    it('should apply disabled styling to disabled types', () => {
      render(<CardTypeSelector {...defaultProps} disabledTypes={['code']} />);

      const codeCardButton = screen.getByRole('radio', { name: /Code Card/ });
      expect(codeCardButton).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('should not call onTypeSelect when disabled type is clicked', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} disabledTypes={['text']} />);

      const textCardButton = screen.getByRole('radio', { name: /Text Card/ });
      await user.click(textCardButton);

      expect(mockOnTypeSelect).not.toHaveBeenCalled();
    });

    it('should not call onTypeSelect when disabled type receives keyboard input', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} disabledTypes={['link']} />);

      const linkCardButton = screen.getByRole('radio', { name: /Link Card/ });
      linkCardButton.focus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');

      expect(mockOnTypeSelect).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation between card types', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} />);

      const buttons = screen.getAllByRole('radio');

      // Focus first button
      await user.tab();
      expect(buttons[0]).toHaveFocus();

      // Tab to next button
      await user.tab();
      expect(buttons[1]).toHaveFocus();

      // Tab to next button
      await user.tab();
      expect(buttons[2]).toHaveFocus();

      // Tab to last button
      await user.tab();
      expect(buttons[3]).toHaveFocus();
    });

    it('should maintain focus visibility with proper outline styles', () => {
      render(<CardTypeSelector {...defaultProps} />);

      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2', 'focus:ring-blue-500');
      });
    });

    it('should skip disabled buttons during tab navigation', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} disabledTypes={['image', 'link']} />);

      const buttons = screen.getAllByRole('radio');
      const enabledButtons = buttons.filter(button => !button.hasAttribute('disabled'));

      await user.tab();
      expect(enabledButtons[0]).toHaveFocus();

      await user.tab();
      expect(enabledButtons[1]).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should have proper role structure', () => {
      render(<CardTypeSelector {...defaultProps} />);

      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();

      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons).toHaveLength(4);
    });

    it('should associate descriptions with buttons using aria-describedby', () => {
      render(<CardTypeSelector {...defaultProps} />);

      const textButton = screen.getByRole('radio', { name: /Text Card/ });
      expect(textButton).toHaveAttribute('aria-describedby', 'text-description');

      const imageButton = screen.getByRole('radio', { name: /Image Card/ });
      expect(imageButton).toHaveAttribute('aria-describedby', 'image-description');
    });

    it('should have unique IDs for description elements', () => {
      render(<CardTypeSelector {...defaultProps} />);

      expect(document.getElementById('text-description')).toBeInTheDocument();
      expect(document.getElementById('image-description')).toBeInTheDocument();
      expect(document.getElementById('link-description')).toBeInTheDocument();
      expect(document.getElementById('code-description')).toBeInTheDocument();
    });

    it('should announce state changes to screen readers', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<CardTypeSelector {...defaultProps} />);

      // Initial state
      const textButton = screen.getByRole('radio', { name: /Text Card/ });
      expect(textButton).toHaveAttribute('aria-checked', 'false');

      // Update selection
      rerender(<CardTypeSelector {...defaultProps} selectedType="text" />);
      expect(textButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should handle icon accessibility correctly', () => {
      render(<CardTypeSelector {...defaultProps} />);

      // Icons should be marked as decorative (aria-hidden)
      const icons = document.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons).toHaveLength(4);
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(<CardTypeSelector {...defaultProps} className="custom-class" />);

      const container = screen.getByRole('radiogroup');
      expect(container).toHaveClass('custom-class');
    });

    it('should maintain default classes with custom className', () => {
      render(<CardTypeSelector {...defaultProps} className="custom-class" />);

      const container = screen.getByRole('radiogroup');
      expect(container).toHaveClass('grid', 'grid-cols-2', 'gap-3', 'custom-class');
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily when props do not change', () => {
      const { rerender } = render(<CardTypeSelector {...defaultProps} />);

      // Spy on console to detect unnecessary re-renders
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Re-render with same props
      rerender(<CardTypeSelector {...defaultProps} />);

      // Component should not log re-render warnings
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle rapid successive clicks gracefully', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} />);

      const textButton = screen.getByRole('radio', { name: /Text Card/ });

      // Click rapidly multiple times
      await user.click(textButton);
      await user.click(textButton);
      await user.click(textButton);

      // Should only call handler for each click
      expect(mockOnTypeSelect).toHaveBeenCalledTimes(3);
      expect(mockOnTypeSelect).toHaveBeenCalledWith('text');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty disabledTypes array', () => {
      render(<CardTypeSelector {...defaultProps} disabledTypes={[]} />);

      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should handle null/undefined selectedType', () => {
      render(<CardTypeSelector {...defaultProps} selectedType={undefined} />);

      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-checked', 'false');
      });
    });

    it('should handle invalid selectedType gracefully', () => {
      render(<CardTypeSelector {...defaultProps} selectedType={'invalid' as CardType} />);

      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-checked', 'false');
      });
    });

    it('should handle keyboard events on non-focusable elements gracefully', () => {
      render(<CardTypeSelector {...defaultProps} />);

      const container = screen.getByRole('radiogroup');

      // Should not throw when keyboard events are triggered on container
      expect(() => {
        fireEvent.keyDown(container, { key: 'Enter' });
        fireEvent.keyDown(container, { key: ' ' });
      }).not.toThrow();

      // Should not trigger selection
      expect(mockOnTypeSelect).not.toHaveBeenCalled();
    });
  });
});