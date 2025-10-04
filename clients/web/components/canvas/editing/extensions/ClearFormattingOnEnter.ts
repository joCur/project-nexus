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
      'Enter': () => {
        const { editor } = this;

        return editor.commands.first(({ commands, chain }) => [
          () => commands.newlineInCode(),
          () => commands.createParagraphNear(),
          () => commands.liftEmptyBlock(),
          () => {
            // Split block and clear stored marks in a chain
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
