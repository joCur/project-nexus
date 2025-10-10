/**
 * TextEditor Validation Error Handling Tests
 *
 * Test suite for backend Tiptap validation error handling in the TextEditor component.
 * Tests error display, user feedback, and error recovery flows.
 *
 * Phase 1 (RED): Failing tests for validation error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextEditor } from '../TextEditor';
import type { TextCard } from '@/types/card.types';
import { TextContentFormat } from '@/types/card.types';
import type { CardId } from '@/types/card.types';
import type { EntityId } from '@/types/common.types';

// Mock CodeBlockWithCopyButton to avoid React NodeView rendering issues in JSDOM
jest.mock('@/components/canvas/editing/extensions/CodeBlockCopyButton', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const CodeBlockLowlight = require('@tiptap/extension-code-block-lowlight').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { common, createLowlight } = require('lowlight');

  const lowlight = createLowlight(common);

  const CodeBlockWithCopyButton = CodeBlockLowlight.extend({
    name: 'codeBlock',
    addOptions() {
      return {
        ...this.parent?.(),
        lowlight,
        HTMLAttributes: { class: 'tiptap-code-block' },
      };
    },
  });

  return { CodeBlockWithCopyButton };
});

describe('TextEditor - Validation Error Handling', () => {
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

  describe('Character Limit Validation Errors', () => {
    it('should display user-friendly error when character limit is exceeded', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Content exceeds maximum character limit of 100,000 characters (current: 150,000)',
        extensions: {
          code: 'VALIDATION_ERROR',
          field: 'content'
        }
      });

      render(
        <TextEditor
          card={mockCard}
          onSave={onSave}
          onCancel={jest.fn()}
        />
      );

      // Fill in content and attempt save
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Content too long/i)).toBeInTheDocument();
        expect(screen.getByText(/Maximum 100,000 characters allowed/i)).toBeInTheDocument();
      });
    });

    it('should not display raw backend error messages', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Content exceeds maximum character limit of 100,000 characters (current: 150,000)',
        extensions: { code: 'VALIDATION_ERROR' }
      });

      render(
        <TextEditor
          card={mockCard}
          onSave={onSave}
          onCancel={jest.fn()}
        />
      );

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Should NOT show raw backend error
        expect(screen.queryByText(/Content exceeds maximum character limit of 100,000 characters \(current: 150,000\)/i)).not.toBeInTheDocument();
        // Should show user-friendly error
        expect(screen.getByText(/Content too long/i)).toBeInTheDocument();
      });
    });
  });

  describe('Node Count Validation Errors', () => {
    it('should display error when node count limit is exceeded', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Node count exceeds maximum allowed limit of 10,000 nodes (current: 15,000)',
        extensions: {
          code: 'VALIDATION_ERROR',
          field: 'content'
        }
      });

      render(
        <TextEditor
          card={mockCard}
          onSave={onSave}
          onCancel={jest.fn()}
        />
      );

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Content too complex/i)).toBeInTheDocument();
        expect(screen.getByText(/Maximum 10,000 elements allowed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Nesting Depth Validation Errors', () => {
    it('should display error when nesting depth limit is exceeded', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'JSON nesting depth exceeds maximum allowed (20)',
        extensions: {
          code: 'VALIDATION_ERROR',
          field: 'content'
        }
      });

      render(
        <TextEditor
          card={mockCard}
          onSave={onSave}
          onCancel={jest.fn()}
        />
      );

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Content too deeply nested/i)).toBeInTheDocument();
        expect(screen.getByText(/Maximum 20 levels allowed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Link Validation Errors', () => {
    it('should display error when dangerous URL is detected', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Dangerous protocol detected in link: javascript:',
        extensions: {
          code: 'VALIDATION_ERROR',
          field: 'content'
        }
      });

      render(
        <TextEditor
          card={mockCard}
          onSave={onSave}
          onCancel={jest.fn()}
        />
      );

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid link/i)).toBeInTheDocument();
        expect(screen.getByText(/Dangerous URLs are not allowed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error State Management', () => {
    it('should clear error when content becomes valid', async () => {
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

      const { container } = render(
        <TextEditor
          card={mockCard}
          onSave={onSave}
          onCancel={jest.fn()}
        />
      );

      // First save attempt - should fail
      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByTestId('save-error')).toBeInTheDocument();
        // Check that error message text is present
        expect(screen.getByText(/Content too long/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      // Simulate user editing content (which should clear the error)
      const editor = container.querySelector('[contenteditable="true"]');
      expect(editor).toBeInTheDocument();

      // Use act to ensure state updates are processed
      await act(async () => {
        if (editor) {
          // Simulate typing in the editor
          fireEvent.input(editor, { target: { textContent: 'Updated content that is shorter' } });
        }
        // Give editor time to process the update
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Error should be cleared after content changes
      await waitFor(() => {
        expect(screen.queryByTestId('save-error')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not block editing when validation error occurs', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Content exceeds maximum character limit',
        extensions: { code: 'VALIDATION_ERROR' }
      });

      const { container } = render(
        <TextEditor
          card={mockCard}
          onSave={onSave}
          onCancel={jest.fn()}
        />
      );

      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('save-error')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Editor should still be editable
      const editor = container.querySelector('[contenteditable="true"]');
      expect(editor).toBeInTheDocument();
      expect(editor).not.toBeDisabled();
      expect(editor).toHaveAttribute('contenteditable', 'true');
    });

    it('should allow user to cancel after validation error', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Content exceeds maximum character limit',
        extensions: { code: 'VALIDATION_ERROR' }
      });
      const onCancel = jest.fn();

      render(
        <TextEditor
          card={mockCard}
          onSave={onSave}
          onCancel={onCancel}
        />
      );

      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('save-error')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Cancel should still work
      const cancelButton = screen.getByTestId('cancel-button');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Error Display Location', () => {
    it('should display error near save button for visibility', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Content exceeds maximum character limit',
        extensions: { code: 'VALIDATION_ERROR' }
      });

      render(
        <TextEditor
          card={mockCard}
          onSave={onSave}
          onCancel={jest.fn()}
        />
      );

      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        const errorElement = screen.getByTestId('save-error');
        expect(errorElement).toBeInTheDocument();

        // Error should be in the same container as save button
        const errorParent = errorElement.closest('.flex.flex-col');
        const saveButtonParent = saveButton.closest('.flex.flex-col');

        // Both should be in the same container
        expect(errorParent).toEqual(saveButtonParent);
      }, { timeout: 2000 });
    });
  });

  describe('Actionable Error Messages', () => {
    it('should provide actionable guidance for character limit error', async () => {
      const onSave = jest.fn().mockRejectedValue({
        message: 'Content exceeds maximum character limit of 100,000 characters (current: 150,000)',
        extensions: { code: 'VALIDATION_ERROR' }
      });

      render(
        <TextEditor
          card={mockCard}
          onSave={onSave}
          onCancel={jest.fn()}
        />
      );

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Should suggest action
        expect(screen.getByText(/shorten your content/i)).toBeInTheDocument();
      });
    });
  });
});
