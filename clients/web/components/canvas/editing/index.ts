/**
 * Canvas Editing Module Exports
 *
 * Central export point for all editing-related components and utilities
 */

export {
  EditModeManager,
  useEditMode,
  EditMode,
  type EditModeState,
  type EditModeManagerProps,
  type EditModeEditorProps
} from './EditModeManager';

export {
  BaseEditor,
  type BaseEditorProps,
  type BaseEditorChildProps
} from './BaseEditor';

export { EditModeManagerInstance } from './EditModeManager';

export { TextEditor, type TextEditorProps } from './TextEditor';
export { CodeEditor, type CodeEditorProps, SUPPORTED_LANGUAGES } from './CodeEditor';
export { LinkEditor } from './LinkEditor';
export { ImageEditor, type ImageData } from './ImageEditor';
export { EditorOverlay } from './EditorOverlay';
