// Mock for @tiptap/extension-code-block-lowlight
/* eslint-disable @typescript-eslint/no-var-requires */
const { Node } = require('@tiptap/core');

const CodeBlockLowlight = Node.create({
  name: 'codeBlock',

  addOptions() {
    return {
      lowlight: {},
      HTMLAttributes: {},
      languageClassPrefix: 'language-',
    };
  },

  content: 'text*',

  marks: '',

  group: 'block',

  code: true,

  defining: true,

  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: element => element.getAttribute('data-language'),
        renderHTML: attributes => {
          if (!attributes.language) {
            return {};
          }

          return {
            'data-language': attributes.language,
            class: `${this.options.languageClassPrefix}${attributes.language}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'pre',
      this.options.HTMLAttributes,
      ['code', HTMLAttributes, 0],
    ];
  },

  addCommands() {
    return {
      setCodeBlock: attributes => ({ commands }) => {
        return commands.setNode(this.name, attributes);
      },
      toggleCodeBlock: attributes => ({ commands }) => {
        return commands.toggleNode(this.name, 'paragraph', attributes);
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock(),
    };
  },
});

module.exports = CodeBlockLowlight;
module.exports.default = CodeBlockLowlight;
