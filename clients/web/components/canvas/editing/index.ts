/**
 * Canvas Editing Module Exports
 *
 * Central export point for all editing-related components and utilities
 */

export {
  EditModeManager,
  useEditMode,
  type EditMode,
  type EditModeState,
  type EditModeManagerProps,
  type EditModeEditorProps
} from './EditModeManager';

export {
  InlineEditor,
  useInlineEditor,
  useUnsavedChanges,
  useClickOutside,
  useFocusTrap,
  type InlineEditorProps,
  type InlineEditorChildProps,
  type InlineEditorHandle
} from './InlineEditor';

// Future exports for specialized editors
// export { TextEditor } from './TextEditor';
// export { CodeEditor } from './CodeEditor';
// export { LinkEditor } from './LinkEditor';
// export { ImageCaptionEditor } from './ImageCaptionEditor';
