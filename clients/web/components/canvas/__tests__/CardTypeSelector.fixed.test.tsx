/**
 * Tests for CardTypeSelector component - Fixed version
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { CardTypeSelector } from '../CardTypeSelector';
import type { CardType } from '@/types/card.types';

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
    });
  });

  describe('Selection State', () => {
    it('should mark selected type as checked', () => {
      render(<CardTypeSelector {...defaultProps} selectedType="text" />);

      const buttons = screen.getAllByRole('radio');
      const textButton = buttons.find(btn => btn.textContent?.includes('Text Card'));

      expect(textButton).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('User Interactions', () => {
    it('should call onTypeSelect when card type is clicked', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} />);

      const textCard = screen.getByText('Text Card').closest('button');
      await user.click(textCard!);

      expect(mockOnTypeSelect).toHaveBeenCalledWith('text');
    });

    it('should call onTypeSelect when Enter key is pressed', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} />);

      const buttons = screen.getAllByRole('radio');
      const imageButton = buttons.find(btn => btn.textContent?.includes('Image Card'));

      imageButton?.focus();
      await user.keyboard('{Enter}');

      expect(mockOnTypeSelect).toHaveBeenCalledWith('image');
    });
  });

  describe('Disabled State', () => {
    it('should disable specified card types', () => {
      render(<CardTypeSelector {...defaultProps} disabledTypes={['text', 'image']} />);

      const buttons = screen.getAllByRole('radio');
      const textButton = buttons.find(btn => btn.textContent?.includes('Text Card'));
      const imageButton = buttons.find(btn => btn.textContent?.includes('Image Card'));
      const linkButton = buttons.find(btn => btn.textContent?.includes('Link Card'));

      expect(textButton).toBeDisabled();
      expect(imageButton).toBeDisabled();
      expect(linkButton).not.toBeDisabled();
    });

    it('should not call onTypeSelect when disabled type is clicked', async () => {
      const user = userEvent.setup();
      render(<CardTypeSelector {...defaultProps} disabledTypes={['text']} />);

      const textCard = screen.getByText('Text Card').closest('button');
      await user.click(textCard!);

      expect(mockOnTypeSelect).not.toHaveBeenCalled();
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

  describe('Keyboard Shortcuts', () => {
    it('should show keyboard shortcuts when enabled', () => {
      render(<CardTypeSelector {...defaultProps} showShortcuts={true} />);

      expect(screen.getByText('T')).toBeInTheDocument();
      expect(screen.getByText('I')).toBeInTheDocument();
      expect(screen.getByText('L')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should associate descriptions with buttons', () => {
      render(<CardTypeSelector {...defaultProps} />);

      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-describedby');
      });
    });

    it('should have unique description IDs', () => {
      render(<CardTypeSelector {...defaultProps} />);

      expect(document.getElementById('text-description')).toBeInTheDocument();
      expect(document.getElementById('image-description')).toBeInTheDocument();
      expect(document.getElementById('link-description')).toBeInTheDocument();
      expect(document.getElementById('code-description')).toBeInTheDocument();
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

    it('should handle invalid selectedType gracefully', () => {
      render(<CardTypeSelector {...defaultProps} selectedType={'invalid' as CardType} />);

      const buttons = screen.getAllByRole('radio');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-checked', 'false');
      });
    });
  });
});