/**
 * SlashCommands Tiptap Extension
 *
 * Provides Notion-like slash command functionality for the Tiptap editor.
 * Triggers a dropdown menu when the user types "/" to insert different block types.
 *
 * Features:
 * - Triggers on "/" character
 * - Provides suggestion plugin with command items
 * - Integrates with SlashCommandMenu component via tippy.js
 * - Supports filtering by query string
 *
 * @requires @tiptap/suggestion - Core suggestion functionality
 * @requires tippy.js - Tooltip/popover positioning
 *
 * Related Documentation: "Tiptap Text Editor Implementation" in Notion
 */

import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import type { Editor, Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { SlashCommandMenu, type SlashCommandMenuRef } from '../SlashCommandMenu';
import { createContextLogger } from '@/utils/logger';

// Create logger at module level
const logger = createContextLogger({ component: 'SlashCommands' });

/**
 * Slash command item definition
 */
export interface SlashCommandItem {
  /** Display title */
  title: string;
  /** Description text */
  description: string;
  /** Icon element */
  icon: React.ReactNode;
  /** Command execution function */
  command: (props: { editor: Editor; range: Range }) => void;
  /** Alternative search terms */
  aliases?: string[];
}

/**
 * Get all available slash command items
 */
export const getSlashCommandItems = (): SlashCommandItem[] => {
  return [
    // Text Blocks
    {
      title: 'Paragraph',
      description: 'Regular text paragraph',
      icon: '¶',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
      aliases: ['text', 'p'],
    },
    {
      title: 'Heading 1',
      description: 'Large heading',
      icon: 'H1',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
      },
      aliases: ['h1', 'title'],
    },
    {
      title: 'Heading 2',
      description: 'Medium heading',
      icon: 'H2',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
      },
      aliases: ['h2', 'subtitle'],
    },
    {
      title: 'Heading 3',
      description: 'Small heading',
      icon: 'H3',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
      },
      aliases: ['h3'],
    },

    // Lists
    {
      title: 'Bullet List',
      description: 'Unordered list with bullets',
      icon: '•',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
      aliases: ['ul', 'unordered'],
    },
    {
      title: 'Numbered List',
      description: 'Ordered list with numbers',
      icon: '1.',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
      aliases: ['ol', 'ordered'],
    },
    {
      title: 'Task List',
      description: 'Checklist with checkboxes',
      icon: '☑',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
      aliases: ['todo', 'checklist', 'checkbox'],
    },

    // Block Elements
    {
      title: 'Blockquote',
      description: 'Quote or citation',
      icon: '"',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setBlockquote().run();
      },
      aliases: ['quote', 'citation'],
    },
    {
      title: 'Code Block',
      description: 'Code snippet with syntax highlighting',
      icon: '</>',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setCodeBlock().run();
      },
      aliases: ['code', 'pre', 'codeblock'],
    },
    {
      title: 'Horizontal Rule',
      description: 'Divider line',
      icon: '—',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
      aliases: ['hr', 'divider', 'separator', 'line'],
    },
  ];
};

/**
 * SlashCommands Extension
 *
 * Adds slash command functionality to the Tiptap editor.
 * Integrates with @tiptap/suggestion to provide a command palette.
 */
export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
          props.command({ editor, range });
          logger.debug('Slash command executed', {
            command: props.title,
            range,
          });
        },
      } as Partial<SuggestionOptions<SlashCommandItem>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,

        items: ({ query }: { query: string }): SlashCommandItem[] => {
          const items = getSlashCommandItems();

          if (!query) {
            return items;
          }

          // Filter items by query (case-insensitive, matches title, description, or aliases)
          const lowerQuery = query.toLowerCase();

          return items.filter((item) => {
            const titleMatch = item.title.toLowerCase().includes(lowerQuery);
            const descriptionMatch = item.description.toLowerCase().includes(lowerQuery);
            const aliasMatch = item.aliases?.some((alias) => alias.toLowerCase().includes(lowerQuery));

            return titleMatch || descriptionMatch || aliasMatch;
          });
        },

        render: () => {
          let component: ReactRenderer<SlashCommandMenuRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props) => {
              logger.debug('Slash command menu started', {
                query: props.query,
                itemCount: props.items.length,
              });

              component = new ReactRenderer(SlashCommandMenu, {
                props: {
                  ...props,
                  command: (item: SlashCommandItem) => {
                    props.command(item);
                  },
                  onClose: () => {
                    if (popup) {
                      popup[0]?.hide();
                    }
                  },
                },
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                maxWidth: 'none',
                theme: 'slash-command',
              });
            },

            onUpdate(props) {
              if (component) {
                component.updateProps({
                  ...props,
                  command: (item: SlashCommandItem) => {
                    props.command(item);
                  },
                  onClose: () => {
                    if (popup) {
                      popup[0]?.hide();
                    }
                  },
                });
              }

              if (!props.clientRect || !popup) {
                return;
              }

              popup[0]?.setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                if (popup) {
                  popup[0]?.hide();
                }
                return true;
              }

              // Pass keyboard events to component
              if (component?.ref) {
                return component.ref.onKeyDown?.(props.event) ?? false;
              }

              return false;
            },

            onExit() {
              logger.debug('Slash command menu closed');

              if (popup) {
                popup[0]?.destroy();
                popup = null;
              }

              if (component) {
                component.destroy();
                component = null;
              }
            },
          };
        },
      }),
    ];
  },
});

export default SlashCommands;
