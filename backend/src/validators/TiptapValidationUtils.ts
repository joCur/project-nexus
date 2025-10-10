/**
 * Tiptap JSON Validation Utilities
 * Reusable helper functions for Tiptap content validation
 */

import { TiptapJSONContent } from '@/types/CardTypes';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger({ module: 'TiptapValidation' });
import {
  TIPTAP_MAX_NESTING_DEPTH,
  TIPTAP_MAX_CHARACTER_COUNT,
  TIPTAP_MAX_NODE_COUNT,
  ALLOWED_NODE_TYPES,
  ALLOWED_MARK_TYPES,
  DANGEROUS_PROTOCOLS,
  ALLOWED_PROTOCOLS,
} from './TiptapValidationConstants';

/**
 * Calculate nesting depth of Tiptap JSON
 * @param node - Tiptap JSON node
 * @param currentDepth - Current depth (internal use)
 * @returns Maximum nesting depth
 */
export function getTiptapNestingDepth(node: TiptapJSONContent, currentDepth = 0): number {
  if (!node.content || node.content.length === 0) {
    return currentDepth;
  }

  let maxDepth = currentDepth;
  for (const child of node.content) {
    const childDepth = getTiptapNestingDepth(child, currentDepth + 1);
    maxDepth = Math.max(maxDepth, childDepth);
  }

  return maxDepth;
}

/**
 * Count total characters in Tiptap JSON content
 * @param node - Tiptap JSON node
 * @returns Total character count
 */
export function countTiptapCharacters(node: TiptapJSONContent): number {
  let count = 0;

  // Count text in current node
  if (node.text) {
    count += node.text.length;
  }

  // Recursively count text in children
  if (node.content) {
    for (const child of node.content) {
      count += countTiptapCharacters(child);
    }
  }

  return count;
}

/**
 * Count total nodes in Tiptap JSON structure
 * @param node - Tiptap JSON node
 * @returns Total node count
 */
export function countTiptapNodes(node: TiptapJSONContent): number {
  let count = 1; // Count current node

  // Recursively count children
  if (node.content) {
    for (const child of node.content) {
      count += countTiptapNodes(child);
    }
  }

  return count;
}

/**
 * Validate Tiptap JSON structure for security and correctness
 * @param node - Tiptap JSON node to validate
 * @returns True if valid, throws error otherwise
 */
export function validateTiptapStructure(node: TiptapJSONContent): boolean {
  // Check node type is allowed
  if (!ALLOWED_NODE_TYPES.has(node.type)) {
    logger.warn('Invalid node type detected', { nodeType: node.type });
    throw new Error(`Invalid node type: ${node.type}`);
  }

  // Validate marks if present
  if (node.marks) {
    for (const mark of node.marks) {
      if (!ALLOWED_MARK_TYPES.has(mark.type)) {
        logger.warn('Invalid mark type detected', { markType: mark.type });
        throw new Error(`Invalid mark type: ${mark.type}`);
      }

      // Validate link href for XSS prevention
      if (mark.type === 'link' && mark.attrs?.href && typeof mark.attrs.href === 'string') {
        validateLinkHref(mark.attrs.href);
      }
    }
  }

  // Check nesting depth
  const depth = getTiptapNestingDepth(node);
  if (depth > TIPTAP_MAX_NESTING_DEPTH) {
    logger.warn('Nesting depth limit exceeded', {
      depth,
      maxAllowed: TIPTAP_MAX_NESTING_DEPTH
    });
    throw new Error(`JSON nesting depth exceeds maximum allowed (${TIPTAP_MAX_NESTING_DEPTH})`);
  }

  // Check total character count
  const charCount = countTiptapCharacters(node);
  if (charCount > TIPTAP_MAX_CHARACTER_COUNT) {
    logger.warn('Character limit exceeded', {
      charCount,
      maxAllowed: TIPTAP_MAX_CHARACTER_COUNT
    });
    throw new Error(`Content exceeds maximum character limit of 100,000 characters (current: ${charCount.toLocaleString('en-US')})`);
  }

  // Check total node count (DoS prevention)
  const nodeCount = countTiptapNodes(node);
  if (nodeCount > TIPTAP_MAX_NODE_COUNT) {
    logger.warn('Node count limit exceeded', {
      nodeCount,
      maxAllowed: TIPTAP_MAX_NODE_COUNT
    });
    throw new Error(`Node count exceeds maximum allowed limit of 10,000 nodes (current: ${nodeCount.toLocaleString('en-US')})`);
  }

  // Recursively validate children
  if (node.content) {
    for (const child of node.content) {
      validateTiptapStructure(child);
    }
  }

  logger.debug('Tiptap content validated successfully', {
    charCount,
    nodeCount,
    depth
  });

  return true;
}

/**
 * Validate link href for dangerous protocols
 * @param href - Link href to validate
 * @throws Error if dangerous protocol detected
 */
export function validateLinkHref(href: string): void {
  const lowerHref = href.toLowerCase();

  // Check for dangerous protocols
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (lowerHref.startsWith(protocol)) {
      logger.warn('Dangerous protocol detected in link', {
        href: href.substring(0, 100), // Log only first 100 chars for security
        protocol
      });
      throw new Error(`Dangerous protocol detected in link: ${protocol}`);
    }
  }

  // Validate allowed protocols
  const hasAllowedProtocol = Array.from(ALLOWED_PROTOCOLS).some(
    protocol => lowerHref.startsWith(protocol)
  );

  if (!hasAllowedProtocol && lowerHref.includes(':')) {
    logger.warn('Invalid protocol in link', {
      href: href.substring(0, 100)
    });
    throw new Error(`Invalid protocol in link: ${href}`);
  }
}

/**
 * Sanitize Tiptap JSON content for XSS prevention
 * @param node - Tiptap JSON node to sanitize
 * @returns Sanitized Tiptap JSON node
 */
export function sanitizeTiptapJSON(node: TiptapJSONContent): TiptapJSONContent {
  const sanitized: TiptapJSONContent = { type: node.type };

  // Sanitize text content
  if (node.text !== undefined) {
    sanitized.text = node.text;
  }

  // Sanitize marks
  if (node.marks) {
    sanitized.marks = node.marks.map(mark => {
      const sanitizedMark: { type: string; attrs?: Record<string, unknown> } = { type: mark.type };

      if (mark.attrs) {
        const sanitizedAttrs: Record<string, unknown> = {};

        // Sanitize link hrefs
        if (mark.type === 'link' && mark.attrs.href && typeof mark.attrs.href === 'string') {
          const href = mark.attrs.href.toLowerCase();

          // Remove dangerous protocols
          let isAllowed = true;
          for (const protocol of DANGEROUS_PROTOCOLS) {
            if (href.startsWith(protocol)) {
              isAllowed = false;
              break;
            }
          }

          if (isAllowed) {
            sanitizedAttrs.href = mark.attrs.href;
          }
        } else {
          // Copy other attributes (excluding dangerous ones)
          for (const [key, value] of Object.entries(mark.attrs)) {
            if (!key.toLowerCase().startsWith('on')) { // Remove event handlers
              sanitizedAttrs[key] = value;
            }
          }
        }

        if (Object.keys(sanitizedAttrs).length > 0) {
          sanitizedMark.attrs = sanitizedAttrs;
        }
      }

      return sanitizedMark;
    });
  }

  // Sanitize attributes
  if (node.attrs) {
    const sanitizedAttrs: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(node.attrs)) {
      // Remove dangerous attributes
      if (!key.toLowerCase().startsWith('on') &&
          key !== 'onerror' &&
          key !== 'onclick') {
        sanitizedAttrs[key] = value;
      }
    }

    if (Object.keys(sanitizedAttrs).length > 0) {
      sanitized.attrs = sanitizedAttrs;
    }
  }

  // Recursively sanitize children
  if (node.content) {
    sanitized.content = node.content.map(child => sanitizeTiptapJSON(child));
  }

  return sanitized;
}

/**
 * Check if a URL uses a safe protocol
 * @param url - URL to check
 * @returns True if URL uses a safe protocol
 */
export function isSafeUrl(url: string): boolean {
  try {
    validateLinkHref(url);
    return true;
  } catch {
    return false;
  }
}
