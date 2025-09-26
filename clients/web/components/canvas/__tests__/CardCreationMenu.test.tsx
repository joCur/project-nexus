/**
 * Tests for CardCreationMenu component
 *
 * This test suite covers:
 * - Context menu positioning
 * - Card type creation buttons
 * - Keyboard shortcuts (T, I, L, C)
 * - "More options" button functionality
 * - Outside click closing behavior
 * - Accessibility and keyboard navigation
 * - Viewport positioning and overflow handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import CardCreationMenu from '../CardCreationMenu';
import type { CardType } from '@/types/card.types';
import type { Position } from '@/types/common.types';
import {
  mockGetBoundingClientRect,
  mockMatchMedia,
  expectAriaAttributes,
  simulateKeyboardNavigation,
} from '../../../__tests__/utils';

// Setup mocks
beforeAll(() => {
  mockMatchMedia();
  mockGetBoundingClientRect();
});

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

describe('CardCreationMenu', () => {
  const mockOnClose = jest.fn();
  const mockOnCreateCard = jest.fn();
  const mockOnMoreOptions = jest.fn();

  const defaultProps = {
    position: { x: 100, y: 200 },
    onClose: mockOnClose,
    onCreateCard: mockOnCreateCard,
    onMoreOptions: mockOnMoreOptions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render at specified position', () => {
      render(<CardCreationMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');
      expect(menu).toHaveStyle({
        left: '100px',
        top: '200px',
      });
    });

    it('should render all card type options', () => {
      render(<CardCreationMenu {...defaultProps} />);

      expect(screen.getByText('Text Card')).toBeInTheDocument();
      expect(screen.getByText('Image Card')).toBeInTheDocument();
      expect(screen.getByText('Link Card')).toBeInTheDocument();
      expect(screen.getByText('Code Card')).toBeInTheDocument();
      expect(screen.getByText('More Options...')).toBeInTheDocument();
    });

    it('should render with correct ARIA attributes', () => {
      render(<CardCreationMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');
      expectAriaAttributes(menu, {
        'aria-label': 'Create new card',
      });

      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems).toHaveLength(5); // 4 card types + More Options

      menuItems.forEach(item => {
        expect(item).toHaveAttribute('aria-describedby');
      });
    });

    it('should render descriptions and shortcuts', () => {
      render(<CardCreationMenu {...defaultProps} />);

      // Check descriptions
      expect(screen.getByText('Rich text with markdown support')).toBeInTheDocument();
      expect(screen.getByText('Visual content with captions')).toBeInTheDocument();
      expect(screen.getByText('Web links with previews')).toBeInTheDocument();
      expect(screen.getByText('Syntax-highlighted code')).toBeInTheDocument();

      // Check keyboard shortcuts
      expect(screen.getByText('T')).toBeInTheDocument();
      expect(screen.getByText('I')).toBeInTheDocument();
      expect(screen.getByText('L')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
    });

    it('should render header and footer', () => {
      render(<CardCreationMenu {...defaultProps} />);

      expect(screen.getByText('Create New Card')).toBeInTheDocument();
      expect(screen.getByText('Choose a card type to add to canvas')).toBeInTheDocument();
      expect(screen.getByText('Use arrow keys to navigate, Enter to select, Esc to close')).toBeInTheDocument();
    });

    it('should render separator between options and more button', () => {
      render(<CardCreationMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');
      const separators = menu.querySelectorAll('.border-t.border-gray-100');
      expect(separators.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Positioning', () => {
    beforeEach(() => {
      // Mock getBoundingClientRect to return realistic menu dimensions
      mockGetBoundingClientRect({
        width: 224, // min-w-56 = 224px
        height: 400,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 224,
        bottom: 400,
      });
    });

    it('should position menu within viewport when position would overflow right', () => {
      const position = { x: 900, y: 100 }; // Near right edge
      render(<CardCreationMenu {...defaultProps} position={position} />);

      const menu = screen.getByRole('menu');
      // Should be repositioned to stay within viewport
      // 1024 - 224 - 8 = 792
      expect(menu).toHaveStyle({
        left: '792px',
        top: '100px',
      });
    });

    it('should position menu within viewport when position would overflow bottom', () => {
      const position = { x: 100, y: 500 }; // Near bottom edge
      render(<CardCreationMenu {...defaultProps} position={position} />);

      const menu = screen.getByRole('menu');
      // Should be repositioned to stay within viewport
      // 768 - 400 - 8 = 360
      expect(menu).toHaveStyle({
        left: '100px',
        top: '360px',
      });
    });

    it('should handle negative positions by setting minimum margins', () => {
      const position = { x: -50, y: -20 };
      render(<CardCreationMenu {...defaultProps} position={position} />);

      const menu = screen.getByRole('menu');
      expect(menu).toHaveStyle({
        left: '8px', // Minimum margin
        top: '8px', // Minimum margin
      });
    });

    it('should handle positions that overflow both directions', () => {
      const position = { x: 1100, y: 900 }; // Overflow both right and bottom
      render(<CardCreationMenu {...defaultProps} position={position} />);

      const menu = screen.getByRole('menu');
      expect(menu).toHaveStyle({
        left: '792px', // 1024 - 224 - 8
        top: '360px', // 768 - 400 - 8
      });
    });
  });

  describe('User Interactions', () => {
    it('should call onCreateCard when card type is clicked', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      const textCardButton = screen.getByText('Text Card');
      await user.click(textCardButton);

      expect(mockOnCreateCard).toHaveBeenCalledWith('text');
    });

    it('should call onMoreOptions when more options is clicked', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      const moreOptionsButton = screen.getByText('More Options...');
      await user.click(moreOptionsButton);

      expect(mockOnMoreOptions).toHaveBeenCalled();
    });

    it('should not respond to clicks on separator', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');
      const separator = menu.querySelector('.border-t.border-gray-100');

      if (separator) {
        await user.click(separator);
      }

      expect(mockOnCreateCard).not.toHaveBeenCalled();
      expect(mockOnMoreOptions).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close menu on Escape key', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should navigate with arrow keys', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      const menuItems = screen.getAllByRole('menuitem');

      // First item should be focused initially or after first arrow down
      await user.keyboard('{ArrowDown}');

      // Check visual focus indication
      expect(menuItems[0]).toHaveClass('bg-gray-50');

      // Navigate to next item
      await user.keyboard('{ArrowDown}');
      expect(menuItems[1]).toHaveClass('bg-gray-50');

      // Navigate to previous item
      await user.keyboard('{ArrowUp}');
      expect(menuItems[0]).toHaveClass('bg-gray-50');
    });

    it('should wrap around navigation at boundaries', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      const menuItems = screen.getAllByRole('menuitem');

      // Navigate to last item by going up from first
      await user.keyboard('{ArrowUp}');
      expect(menuItems[menuItems.length - 1]).toHaveClass('bg-gray-50');

      // Navigate to first item by going down from last
      await user.keyboard('{ArrowDown}');
      expect(menuItems[0]).toHaveClass('bg-gray-50');
    });

    it('should select item with Enter key', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      // Focus first item and press Enter
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(mockOnCreateCard).toHaveBeenCalledWith('text');
    });

    it('should select item with Space key', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      // Focus second item and press Space
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');

      expect(mockOnCreateCard).toHaveBeenCalledWith('image');
    });

    it('should activate More Options with keyboard', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      // Navigate to More Options (last item)
      await user.keyboard('{ArrowUp}'); // This should go to last item due to wrapping
      await user.keyboard('{Enter}');

      expect(mockOnMoreOptions).toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should create text card on T key press', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      await user.keyboard('t');

      expect(mockOnCreateCard).toHaveBeenCalledWith('text');
    });

    it('should create image card on I key press', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      await user.keyboard('I'); // Test uppercase

      expect(mockOnCreateCard).toHaveBeenCalledWith('image');
    });

    it('should create link card on L key press', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      await user.keyboard('l');

      expect(mockOnCreateCard).toHaveBeenCalledWith('link');
    });

    it('should create code card on C key press', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      await user.keyboard('C'); // Test uppercase

      expect(mockOnCreateCard).toHaveBeenCalledWith('code');
    });

    it('should not respond to shortcuts with modifier keys', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      // Test Ctrl+T (should not trigger)
      await user.keyboard('{Control>}t{/Control}');

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should not respond to shortcuts with Alt modifier', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      // Test Alt+I (should not trigger)
      await user.keyboard('{Alt>}i{/Alt}');

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should not respond to shortcuts with Meta modifier', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      // Test Cmd+L (should not trigger)
      await user.keyboard('{Meta>}l{/Meta}');

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });
  });

  describe('Outside Click Behavior', () => {
    it('should close menu when clicking outside', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <CardCreationMenu {...defaultProps} />
          <div data-testid="outside-element">Outside</div>
        </div>
      );

      const outsideElement = screen.getByTestId('outside-element');
      await user.click(outsideElement);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close menu when clicking inside', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');
      await user.click(menu);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should not close menu when clicking on menu items', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      const textCardButton = screen.getByText('Text Card');
      await user.click(textCardButton);

      // onCreateCard should be called, but onClose should not
      expect(mockOnCreateCard).toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Disabled Types', () => {
    it('should disable specified card types', () => {
      render(<CardCreationMenu {...defaultProps} disabledTypes={['text', 'image']} />);

      const textButton = screen.getByText('Text Card').closest('button');
      const imageButton = screen.getByText('Image Card').closest('button');
      const linkButton = screen.getByText('Link Card').closest('button');

      expect(textButton).toBeDisabled();
      expect(imageButton).toBeDisabled();
      expect(linkButton).not.toBeDisabled();
    });

    it('should apply disabled styling to disabled types', () => {
      render(<CardCreationMenu {...defaultProps} disabledTypes={['code']} />);

      const codeButton = screen.getByText('Code Card').closest('button');
      expect(codeButton).toHaveClass('text-gray-400', 'cursor-not-allowed');
    });

    it('should not call onCreateCard when disabled type is clicked', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} disabledTypes={['link']} />);

      const linkButton = screen.getByText('Link Card');
      await user.click(linkButton);

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });

    it('should skip disabled items during keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} disabledTypes={['image', 'link']} />);

      const menuItems = screen.getAllByRole('menuitem');
      const enabledItems = menuItems.filter(item => !item.hasAttribute('disabled'));

      // Navigate should skip disabled items
      await user.keyboard('{ArrowDown}');
      expect(enabledItems[0]).toHaveClass('bg-gray-50');

      await user.keyboard('{ArrowDown}');
      expect(enabledItems[1]).toHaveClass('bg-gray-50'); // Should skip to next enabled item
    });

    it('should not respond to keyboard shortcuts for disabled types', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} disabledTypes={['text']} />);

      await user.keyboard('t');

      expect(mockOnCreateCard).not.toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('should focus menu when it opens', () => {
      render(<CardCreationMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');
      expect(menu).toHaveFocus();
    });

    it('should maintain focus on menu during keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');

      // Menu should maintain focus even during navigation
      expect(document.activeElement).toBe(menu);
    });

    it('should provide visual focus indicators', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      await user.keyboard('{ArrowDown}');

      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems[0]).toHaveClass('bg-gray-50');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA structure', () => {
      render(<CardCreationMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('aria-label', 'Create new card');

      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems.length).toBeGreaterThan(0);

      menuItems.forEach(item => {
        expect(item).toHaveAttribute('aria-describedby');
      });
    });

    it('should associate descriptions with menu items', () => {
      render(<CardCreationMenu {...defaultProps} />);

      const textMenuItem = screen.getByText('Text Card').closest('[role="menuitem"]');
      expect(textMenuItem).toHaveAttribute('aria-describedby', 'text-description');

      const textDescription = document.getElementById('text-description');
      expect(textDescription).toBeInTheDocument();
      expect(textDescription).toHaveTextContent('Rich text with markdown support');
    });

    it('should have proper tabindex for keyboard accessibility', () => {
      render(<CardCreationMenu {...defaultProps} />);

      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('tabindex', '-1');
    });

    it('should mark icons as decorative', () => {
      render(<CardCreationMenu {...defaultProps} />);

      const icons = screen.getByRole('menu').querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(<CardCreationMenu {...defaultProps} className="custom-menu-class" />);

      const menu = screen.getByRole('menu');
      expect(menu).toHaveClass('custom-menu-class');
    });

    it('should maintain default styling with custom className', () => {
      render(<CardCreationMenu {...defaultProps} className="custom-menu-class" />);

      const menu = screen.getByRole('menu');
      expect(menu).toHaveClass('fixed', 'z-50', 'min-w-56', 'bg-white', 'custom-menu-class');
    });
  });

  describe('Event Cleanup', () => {
    it('should clean up event listeners on unmount', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = render(<CardCreationMenu {...defaultProps} />);

      // Should have added event listeners
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      // Should have removed event listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty disabledTypes array', () => {
      render(<CardCreationMenu {...defaultProps} disabledTypes={[]} />);

      const menuItems = screen.getAllByRole('menuitem');
      const cardButtons = menuItems.slice(0, 4); // First 4 are card types

      cardButtons.forEach(button => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should handle all types disabled', () => {
      const allTypes: CardType[] = ['text', 'image', 'link', 'code'];
      render(<CardCreationMenu {...defaultProps} disabledTypes={allTypes} />);

      // Should still render More Options
      expect(screen.getByText('More Options...')).toBeInTheDocument();

      const moreButton = screen.getByText('More Options...').closest('button');
      expect(moreButton).not.toBeDisabled();
    });

    it('should handle rapid keyboard input gracefully', async () => {
      const user = userEvent.setup();
      render(<CardCreationMenu {...defaultProps} />);

      // Rapid arrow key presses
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{ArrowDown}{Enter}');

      // Should still work correctly
      expect(mockOnCreateCard).toHaveBeenCalledWith('image');
    });

    it('should handle window resize during positioning', () => {
      const { rerender } = render(<CardCreationMenu {...defaultProps} />);

      // Change window size
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      Object.defineProperty(window, 'innerHeight', { value: 600 });

      // Re-render with new position that would now overflow
      rerender(<CardCreationMenu {...defaultProps} position={{ x: 700, y: 500 }} />);

      const menu = screen.getByRole('menu');
      // Should still be positioned correctly
      expect(menu).toBeInTheDocument();
    });
  });
});