/**
 * Tiptap JSON Content Validation Tests
 * Following TDD approach (RED → GREEN → REFACTOR → VERIFY)
 *
 * These tests validate comprehensive content validation for Tiptap JSON:
 * 1. Character/word limits enforcement
 * 2. Nesting depth validation
 * 3. Node count limits (DoS prevention)
 * 4. Dangerous URL protocol sanitization
 * 5. XSS prevention
 */

import { CardValidator } from '@/validators/CardValidators';
import { TiptapJSONContent } from '@/types/CardTypes';

describe('Tiptap JSON Content Validation (TDD - RED Phase)', () => {
  describe('Character Limit Validation', () => {
    test('should reject content exceeding 100,000 character limit', () => {
      const largeContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'a'.repeat(100001), // 100,001 characters
              },
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(largeContent)).toThrow(
        /content exceeds maximum character limit/i
      );
    });

    test('should accept content at exactly 100,000 character limit', () => {
      const largeContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'a'.repeat(100000), // Exactly 100,000 characters
              },
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(largeContent)).not.toThrow();
    });

    test('should count characters across multiple text nodes', () => {
      const multiNodeContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'a'.repeat(50000) },
              { type: 'text', text: 'b'.repeat(50001) }, // Total: 100,001
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(multiNodeContent)).toThrow(
        /content exceeds maximum character limit/i
      );
    });

    test('should count characters in nested structures', () => {
      const nestedContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'a'.repeat(60000) }],
              },
            ],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'b'.repeat(40001) }], // Total: 100,001
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(nestedContent)).toThrow(
        /content exceeds maximum character limit/i
      );
    });
  });

  describe('Nesting Depth Validation', () => {
    test('should reject content exceeding 20 levels of nesting', () => {
      // Create deeply nested content (21 levels)
      let deeplyNested: TiptapJSONContent = {
        type: 'paragraph',
        content: [{ type: 'text', text: 'bottom level' }],
      };

      for (let i = 0; i < 20; i++) {
        deeplyNested = {
          type: 'blockquote',
          content: [deeplyNested],
        };
      }

      const content: TiptapJSONContent = {
        type: 'doc',
        content: [deeplyNested], // 21 levels total (doc -> 20x blockquote -> paragraph)
      };

      expect(() => CardValidator.validateTiptapJSON(content)).toThrow(
        /nesting depth exceeds maximum/i
      );
    });

    test('should accept content at exactly 20 levels of nesting', () => {
      // Create content with exactly 20 levels
      let nested: TiptapJSONContent = {
        type: 'paragraph',
        content: [{ type: 'text', text: 'bottom level' }],
      };

      for (let i = 0; i < 18; i++) {
        nested = {
          type: 'blockquote',
          content: [nested],
        };
      }

      const content: TiptapJSONContent = {
        type: 'doc',
        content: [nested], // Exactly 20 levels (doc -> 18x blockquote -> paragraph)
      };

      expect(() => CardValidator.validateTiptapJSON(content)).not.toThrow();
    });

    test('should validate nesting depth with complex structures', () => {
      // Mix lists and blockquotes to create deep nesting
      const deepList: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [
                          {
                            type: 'bulletList',
                            content: [
                              {
                                type: 'listItem',
                                content: [
                                  {
                                    type: 'paragraph',
                                    content: [{ type: 'text', text: 'deep' }],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      // This should be within limits (7 levels)
      expect(() => CardValidator.validateTiptapJSON(deepList)).not.toThrow();
    });
  });

  describe('Node Count Limit Validation (DoS Prevention)', () => {
    test('should reject content exceeding 10,000 node limit', () => {
      // Create content with 10,001 text nodes
      const manyNodes: TiptapJSONContent = {
        type: 'doc',
        content: Array(10001)
          .fill(null)
          .map(() => ({
            type: 'paragraph',
            content: [{ type: 'text', text: 'x' }],
          })),
      };

      expect(() => CardValidator.validateTiptapJSON(manyNodes)).toThrow(
        /node count exceeds maximum/i
      );
    });

    test('should accept content at exactly 10,000 node limit', () => {
      // Create content with exactly 10,000 nodes (including doc and paragraphs)
      const manyNodes: TiptapJSONContent = {
        type: 'doc',
        content: Array(4999) // 4999 paragraphs + 4999 text nodes + 1 doc + 1 final paragraph = 10,000
          .fill(null)
          .map(() => ({
            type: 'paragraph',
            content: [{ type: 'text', text: 'x' }],
          })),
      };

      expect(() => CardValidator.validateTiptapJSON(manyNodes)).not.toThrow();
    });

    test('should count all nodes including nested structures', () => {
      // Create nested list structure with many nodes
      const nestedList: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: Array(3334) // Will exceed 10,000 nodes with nesting
              .fill(null)
              .map(() => ({
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'item' }],
                  },
                ],
              })),
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(nestedList)).toThrow(
        /node count exceeds maximum/i
      );
    });
  });

  describe('Dangerous URL Protocol Validation', () => {
    test('should reject javascript: protocol in links', () => {
      const maliciousContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Click here',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'javascript:alert("XSS")' },
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(maliciousContent)).toThrow(
        /dangerous protocol detected/i
      );
    });

    test('should reject data:text/html protocol in links', () => {
      const maliciousContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Click here',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'data:text/html,<script>alert("XSS")</script>' },
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(maliciousContent)).toThrow(
        /dangerous protocol detected/i
      );
    });

    test('should reject vbscript: protocol in links', () => {
      const maliciousContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Click here',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'vbscript:msgbox("XSS")' },
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(maliciousContent)).toThrow(
        /dangerous protocol detected/i
      );
    });

    test('should reject file: protocol in links', () => {
      const maliciousContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Local file',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'file:///etc/passwd' },
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(maliciousContent)).toThrow(
        /dangerous protocol detected/i
      );
    });

    test('should accept http: and https: protocols', () => {
      const safeContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Safe link',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'https://example.com' },
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(safeContent)).not.toThrow();
    });

    test('should accept mailto: protocol', () => {
      const safeContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Email link',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'mailto:test@example.com' },
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(safeContent)).not.toThrow();
    });

    test('should handle protocol detection case-insensitively', () => {
      const maliciousContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Tricky',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'JaVaScRiPt:alert("XSS")' },
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(maliciousContent)).toThrow(
        /dangerous protocol detected/i
      );
    });
  });

  describe('Error Context and Messages', () => {
    test('should provide specific error message for character limit violation', () => {
      const largeContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'a'.repeat(100001) }],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(largeContent)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/100,000/),
        })
      );
    });

    test('should provide specific error message for nesting depth violation', () => {
      let deeplyNested: TiptapJSONContent = {
        type: 'paragraph',
        content: [{ type: 'text', text: 'deep' }],
      };

      for (let i = 0; i < 20; i++) {
        deeplyNested = { type: 'blockquote', content: [deeplyNested] };
      }

      const content: TiptapJSONContent = {
        type: 'doc',
        content: [deeplyNested],
      };

      expect(() => CardValidator.validateTiptapJSON(content)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/20/),
        })
      );
    });

    test('should provide specific error message for node count violation', () => {
      const manyNodes: TiptapJSONContent = {
        type: 'doc',
        content: Array(10001)
          .fill(null)
          .map(() => ({
            type: 'paragraph',
            content: [{ type: 'text', text: 'x' }],
          })),
      };

      expect(() => CardValidator.validateTiptapJSON(manyNodes)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/10,000/),
        })
      );
    });

    test('should provide specific protocol name in dangerous URL error', () => {
      const maliciousContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Bad link',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'javascript:alert(1)' },
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => CardValidator.validateTiptapJSON(maliciousContent)).toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/javascript:/i),
        })
      );
    });
  });

  describe('Sanitization Integration', () => {
    test('should sanitize and remove dangerous protocols during sanitization', () => {
      const maliciousContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Link',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'javascript:alert("XSS")' },
                  },
                ],
              },
            ],
          },
        ],
      };

      // Sanitization should remove the dangerous href attribute
      const sanitized = CardValidator.sanitizeTiptapJSON(maliciousContent);

      // The link mark should either be removed or have no href attribute
      const textNode = sanitized.content?.[0].content?.[0];
      expect(textNode?.marks).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            attrs: expect.objectContaining({
              href: expect.stringContaining('javascript:'),
            }),
          }),
        ])
      );
    });

    test('should preserve safe URLs during sanitization', () => {
      const safeContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Safe link',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'https://example.com' },
                  },
                ],
              },
            ],
          },
        ],
      };

      const sanitized = CardValidator.sanitizeTiptapJSON(safeContent);

      const textNode = sanitized.content?.[0].content?.[0];
      expect(textNode?.marks?.[0]?.attrs?.href).toBe('https://example.com');
    });
  });

  describe('Combined Validation Edge Cases', () => {
    test('should validate all rules on complex real-world content', () => {
      const complexContent: TiptapJSONContent = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Some text with a ',
              },
              {
                type: 'text',
                text: 'safe link',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'https://example.com' },
                  },
                ],
              },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'List item 1' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'List item 2' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [
              {
                type: 'text',
                text: 'const x = 10;',
              },
            ],
          },
        ],
      };

      // Should pass all validations
      expect(() => CardValidator.validateTiptapJSON(complexContent)).not.toThrow();
    });
  });
});
