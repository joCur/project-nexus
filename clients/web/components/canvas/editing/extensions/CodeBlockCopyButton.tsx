/**
 * CodeBlockCopyButton Extension
 *
 * Adds a copy-to-clipboard button to code blocks in the Tiptap editor.
 * This extension uses Tiptap's NodeView to render a React component with the code block content
 * and a copy button that copies the code to the clipboard.
 *
 * Features:
 * - Copy button positioned in top-right of code block
 * - Visual feedback ("Copied!") after copying
 * - Clipboard API integration
 * - Design system compliant styling
 */

import React, { useState, useCallback } from 'react';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { createContextLogger } from '@/utils/logger';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';

// Create logger at module level
const logger = createContextLogger({ component: 'CodeBlockCopyButton' });

/**
 * Code Block Component with Copy Button
 */
const CodeBlockWithCopy: React.FC<NodeViewProps> = ({ node }) => {
  const [copied, setCopied] = useState(false);

  /**
   * Handle copy to clipboard
   */
  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      // Get code text from node
      const codeText = node.textContent;

      // Copy to clipboard
      await navigator.clipboard.writeText(codeText);

      logger.debug('Code copied to clipboard', {
        length: codeText.length,
        language: node.attrs.language
      });

      // Show "Copied!" feedback
      setCopied(true);

      // Reset after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      logger.error('Failed to copy code to clipboard', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [node]);

  return (
    <NodeViewWrapper className="relative code-block-wrapper">
      <pre className="tiptap-code-block">
        <button
          onClick={handleCopy}
          className="code-block-copy-button absolute top-2 right-2 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded transition-colors duration-150"
          aria-label="Copy code"
          type="button"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <code className={node.attrs.language ? `language-${node.attrs.language}` : ''}>
          <NodeViewContent />
        </code>
      </pre>
    </NodeViewWrapper>
  );
};

/**
 * Code Block Extension with Copy Button
 *
 * Extends CodeBlockLowlight to add a copy button using React NodeView
 */
export const CodeBlockWithCopyButton = CodeBlockLowlight.extend({
  name: 'codeBlockWithCopy',

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockWithCopy);
  },
});

export default CodeBlockWithCopyButton;
