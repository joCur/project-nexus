/**
 * Card Inline Editing Components
 *
 * This module exports all components related to inline card editing.
 *
 * Components:
 * - InlineTextEditor: ContentEditable text editing with markdown support
 * - InlineCodeEditor: Code editing with syntax highlighting and language selection
 * - InlineLinkEditor: URL editing with validation and preview
 * - CardEditOverlay: Main overlay manager for all card types
 *
 * Usage:
 * ```tsx
 * import { CardEditOverlay, InlineTextEditor } from '@/components/cards';
 * ```
 */

export { InlineTextEditor } from './InlineTextEditor';
export { InlineCodeEditor } from './InlineCodeEditor';
export { InlineLinkEditor } from './InlineLinkEditor';
export { CardEditOverlay } from './CardEditOverlay';

// CSS import for animations
import './card-editing.css';

// Types (re-exported for convenience)
export type {
  TextCardContent,
  CodeCardContent,
  LinkCardContent,
  ImageCardContent,
  CardContent,
} from '@/types/card.types';