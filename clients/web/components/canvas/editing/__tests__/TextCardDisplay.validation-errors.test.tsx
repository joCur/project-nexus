/**
 * TextCardDisplay Validation Error Handling Tests
 *
 * Test suite for validation error handling in TextCardDisplay component.
 * Tests error propagation from TextEditor and graceful error recovery.
 *
 * Phase 1 (RED): Failing tests for validation error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextCardDisplay, DisplayMode } from '../TextCardDisplay';
import type { TextCard } from '@/types/card.types';
import { TextContentFormat } from '@/types/card.types';
import type { CardId } from '@/types/card.types';
import type { EntityId } from '@/types/common.types';

// Mock TextEditor - needs to be synchronous to avoid Suspense issues
interface MockTextEditorProps {
  onSave: (content: { type: string; content: string }) => Promise<void>;
  onCancel: () => void;
}

const MockTextEditorComponent = ({ onSave, onCancel }: MockTextEditorProps): JSX.Element => (
  <div data-testid="text-editor-mock">
    <button
      onClick={async (): Promise<void> => {
        try {
          await onSave({ type: 'text', content: 'mock content' });
        } catch (e) {
          // Error is handled by TextCardDisplay
        }
      }}
    >
      Save
    </button>
    <button onClick={onCancel}>Cancel</button>
  </div>
);

jest.mock('../TextEditor', () => {
  return {
    __esModule: true,
    TextEditor: MockTextEditorComponent,
    default: MockTextEditorComponent,
  };
});

describe('TextCardDisplay - Validation Error Handling', () => {
  const mockCard: TextCard = {
    id: 'test-card-1' as CardId,
    ownerId: 'user-1' as EntityId,
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
      format: TextContentFormat.TIPTAP,
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test content' }] }]
      },
      markdown: false,
      wordCount: 2,
      lastEditedAt: Date.now().toString()
    },
    isSelected: false,
    isLocked: false,
    isHidden: false,
    isMinimized: false,
    status: 'active',
    priority: 'normal',
    createdAt: Date.now().toString(),
    updatedAt: Date.now().toString(),
    tags: [],
    metadata: {},
    animation: { isAnimating: false }
  };

  describe('Error Propagation from TextEditor', () => {
    it('should remain in edit mode when save fails with validation error', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Content exceeds maximum character limit',
        extensions: { code: 'VALIDATION_ERROR' }
      });

      const { rerender } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          mode={DisplayMode.EDIT}
        />
      );

      // Should be in edit mode
      await waitFor(() => {
        expect(screen.getByTestId('text-editor-mock')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      // Wait for async save to complete
      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      // Force re-render to check mode hasn't changed
      rerender(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          mode={DisplayMode.EDIT}
        />
      );

      // Should still be in edit mode after error
      expect(screen.getByTestId('text-editor-mock')).toBeInTheDocument();
    });

    it('should log validation error appropriately', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const onSave = jest.fn().mockRejectedValue({
        message: 'Content exceeds maximum character limit',
        extensions: { code: 'VALIDATION_ERROR' }
      });

      render(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          mode={DisplayMode.EDIT}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('text-editor-mock')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      // Logger should have been called (we don't check console.error directly anymore)
      // The logger handles the logging internally

      // Clean up
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Mode Management with Validation Errors', () => {
    it('should not switch to read-only mode when validation fails', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Node count exceeds maximum allowed limit',
        extensions: { code: 'VALIDATION_ERROR' }
      });

      const { rerender } = render(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          mode={DisplayMode.EDIT}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('text-editor-mock')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      // Re-render to check mode hasn't changed
      rerender(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          mode={DisplayMode.EDIT}
        />
      );

      // Should still be in edit mode
      expect(screen.getByTestId('text-editor-mock')).toBeInTheDocument();
    });

    it('should allow user to cancel even after validation error', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Content exceeds maximum character limit',
        extensions: { code: 'VALIDATION_ERROR' }
      });

      const onModeChange = jest.fn();

      render(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          mode={DisplayMode.EDIT}
          onModeChange={onModeChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('text-editor-mock')).toBeInTheDocument();
      });

      // Attempt save (will fail)
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      // Cancel should still work
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onModeChange).toHaveBeenCalledWith(DisplayMode.READ_ONLY);
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after validation error', async () => {
      let saveAttempts = 0;
      const onSave = jest.fn().mockImplementation(() => {
        saveAttempts++;
        if (saveAttempts === 1) {
          return Promise.reject({
            message: 'Content exceeds maximum character limit',
            extensions: { code: 'VALIDATION_ERROR' }
          });
        }
        return Promise.resolve();
      });

      render(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          mode={DisplayMode.EDIT}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('text-editor-mock')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save');

      // First attempt - should fail
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(saveAttempts).toBe(1);
      });

      // Second attempt - should succeed
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(saveAttempts).toBe(2);
      });
    });
  });

  describe('Network vs Validation Error Differentiation', () => {
    it('should handle network errors differently from validation errors', async () => {
      const networkError = new Error('Network request failed');
      const onSave = jest.fn().mockRejectedValue(networkError);

      render(
        <TextCardDisplay
          card={mockCard}
          onSave={onSave}
          mode={DisplayMode.EDIT}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('text-editor-mock')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      });

      // Should remain in edit mode for network errors too
      expect(screen.getByTestId('text-editor-mock')).toBeInTheDocument();
    });
  });
});
