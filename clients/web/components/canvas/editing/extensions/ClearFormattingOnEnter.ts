/**
 * ClearFormattingOnEnter Extension
 *
 * Notion-like behavior: clears all formatting marks (bold, italic, underline, etc.)
 * when pressing Enter to create a new paragraph.
 *
 * This ensures that formatting doesn't carry over to new lines unless explicitly applied.
 */

import { Extension } from '@tiptap/core';

export const ClearFormattingOnEnter = Extension.create({
  name: 'clearFormattingOnEnter',

  addKeyboardShortcuts() {
    return {
      // Handle Enter key
      'Enter': ({ editor }) => {
        // First, let the default Enter behavior create a new paragraph
        const defaultBehavior = this.editor.commands.first(({ commands }) => [
          () => commands.newlineInCode(),
          () => commands.createParagraphNear(),
          () => commands.liftEmptyBlock(),
          () => commands.splitBlock(),
        ]);

        if (defaultBehavior) {
          // After creating the new paragraph, clear all marks
          // Use setTimeout to ensure the new paragraph is created first
          setTimeout(() => {
            editor.chain().unsetAllMarks().run();
          }, 0);
        }

        return defaultBehavior;
      },
    };
  },
});

export default ClearFormattingOnEnter;
