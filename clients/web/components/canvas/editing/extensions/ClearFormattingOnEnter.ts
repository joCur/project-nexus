/**
 * ClearFormattingOnEnter Extension
 *
 * Notion-like behavior: clears all formatting marks (bold, italic, underline, etc.)
 * when pressing Enter to create a new paragraph.
 *
 * IMPORTANT: This does NOT apply to lists (bullet, ordered, task lists) where
 * formatting should be preserved when creating new list items.
 *
 * This ensures that formatting doesn't carry over to new lines unless explicitly applied,
 * except in list contexts where it's the desired behavior.
 */

import { Extension } from '@tiptap/core';

export const ClearFormattingOnEnter = Extension.create({
  name: 'clearFormattingOnEnter',

  addKeyboardShortcuts() {
    return {
      // Handle Enter key
      'Enter': () => {
        const { editor } = this;

        // Check if we're currently in a list
        const isInList = editor.isActive('bulletList') ||
                        editor.isActive('orderedList') ||
                        editor.isActive('taskList');

        // If in a list, don't intercept - let the list extensions handle it
        if (isInList) {
          return false; // Return false to pass control to list extensions
        }

        // Not in a list - clear formatting on new paragraph
        return editor.commands.first(({ commands, chain }) => [
          () => commands.newlineInCode(),
          () => commands.createParagraphNear(),
          () => commands.liftEmptyBlock(),
          () => {
            return chain()
              .splitBlock()
              .command(({ tr }) => {
                // Clear stored marks to prevent formatting carryover
                tr.setStoredMarks([]);
                return true;
              })
              .run();
          },
        ]);
      },
    };
  },
});

export default ClearFormattingOnEnter;
