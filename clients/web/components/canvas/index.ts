/**
 * Canvas component exports
 * Main components for the infinite canvas system
 */

export { InfiniteCanvas } from './InfiniteCanvas';
export { CanvasStage } from './CanvasStage';
export { CanvasBackground } from './CanvasBackground';

// Editing components
export {
  EditModeManager,
  useEditMode,
  type EditMode,
  type EditModeState,
  type EditModeManagerProps,
  type EditModeEditorProps
} from './editing';