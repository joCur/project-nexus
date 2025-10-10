/**
 * Tiptap JSON Validation Constants
 * Centralized constants for Tiptap content validation
 */

/**
 * Maximum nesting depth allowed in Tiptap JSON structure
 * Prevents stack overflow attacks
 */
export const TIPTAP_MAX_NESTING_DEPTH = 20;

/**
 * Maximum content size in bytes (100KB)
 * Used for JSON string size validation
 */
export const TIPTAP_MAX_CONTENT_SIZE = 100 * 1024;

/**
 * Maximum character count across all text nodes
 * Prevents excessive content storage
 */
export const TIPTAP_MAX_CHARACTER_COUNT = 100000;

/**
 * Maximum total node count in document
 * Prevents DoS attacks with deeply nested or large structures
 */
export const TIPTAP_MAX_NODE_COUNT = 10000;

/**
 * Allowed Tiptap node types based on Phase 1-4 implementation
 */
export const ALLOWED_NODE_TYPES = new Set([
  // Core structure
  'doc',
  'paragraph',
  'text',
  // Headings
  'heading',
  // Lists
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  // Block elements
  'blockquote',
  'codeBlock',
  'horizontalRule',
]);

/**
 * Allowed Tiptap mark types based on Phase 1-4 implementation
 */
export const ALLOWED_MARK_TYPES = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
]);

/**
 * Dangerous URL protocols that should be blocked for XSS prevention
 */
export const DANGEROUS_PROTOCOLS = new Set([
  'javascript:',
  'data:text/html',
  'vbscript:',
  'file:',
  'about:',
]);

/**
 * Allowed URL protocols for link sanitization
 */
export const ALLOWED_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
]);
