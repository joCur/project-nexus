# NEX-193: Inline Editing Components Implementation Plan

## Objective and Scope

Implement inline editing functionality for cards on the canvas, allowing users to edit text, code, image, and link cards directly in place with immediate visual feedback (<100ms latency requirement). This builds on the card creation and rendering infrastructure completed in NEX-200.

## Technical Approach and Reasoning

**Integration with NEX-200**: Build on the existing card rendering system where `CardRenderer` already handles double-click events and card type switching. Add inline editing overlays that work within the existing Konva canvas structure.

**Performance Strategy**: Use local state for immediate visual feedback, then sync to both cardStore (local state) and server via useCardOperations. This ensures the <100ms feedback requirement while maintaining data persistence.

**Edit Mode Architecture**: Implement edit mode as an overlay system that appears over the rendered card, using HTML DOM elements for text input (better UX than Konva text editing) positioned absolutely over the canvas.

## Implementation Phases

### Phase 1: Core Edit Mode Infrastructure ✅ COMPLETED

- [x] Task 1.1: Create EditModeManager component
  - Created `components/canvas/editing/EditModeManager.tsx` component
  - Handles edit mode state (isEditing, editingCardId, editMode type)
  - Manages transition animations with Framer Motion and focus trap
  - Integrated with existing CardRenderer double-click handler
  - Includes comprehensive test suite (9 tests)

- [x] Task 1.2: Implement DOM overlay positioning system
  - Created utility functions in `utils/canvas/overlayPositioning.ts`
  - Handles canvas zoom and pan transformations for accurate positioning
  - Accounts for canvas scroll and browser viewport changes
  - Ensures overlay positioning updates during canvas interactions
  - Includes `useOverlayPosition` React hook for dynamic updates
  - Comprehensive test coverage (35 tests)

- [x] Task 1.3: Create base InlineEditor component
  - Created `components/canvas/editing/InlineEditor.tsx` base component
  - Handles common editing interactions (escape to cancel, click outside to save)
  - Manages edit/cancel state with unsaved changes detection
  - Implements focus management and keyboard event handling
  - Supports custom shortcuts including Alt key combinations
  - Includes exported hooks: useInlineEditor, useUnsavedChanges, useClickOutside, useFocusTrap
  - Full test coverage (38 tests)

### Phase 2: Card Type-Specific Editors ✅ COMPLETED

- [x] Task 2.1: Implement TextEditor component
  - Created `components/canvas/editing/TextEditor.tsx`
  - ContentEditable implementation with proper styling and markdown support
  - Real-time character count with 10,000 character limit
  - Auto-resize based on content with min/max constraints
  - Paste as plain text functionality
  - Comprehensive test suite with 35 tests

- [x] Task 2.2: Implement CodeEditor component
  - Created `components/canvas/editing/CodeEditor.tsx`
  - Integrated syntax highlighting using Prism.js
  - Language selector dropdown with common languages (JS, Python, TypeScript, etc.)
  - Tab key handling for proper indentation
  - Line number display and code formatting preservation
  - Theme support (light/dark modes)
  - Comprehensive test suite with 38 tests

- [x] Task 2.3: Implement LinkEditor component
  - Created `components/canvas/editing/LinkEditor.tsx`
  - URL input field with validation and auto-protocol addition
  - Title and description editable fields
  - Link preview showing how card will appear after save
  - Keyboard navigation support
  - Comprehensive test suite with 30 tests

- [x] Task 2.4: Implement ImageEditor component
  - Created `components/canvas/editing/ImageEditor.tsx`
  - Alt text and caption editing fields
  - Image replacement via URL input
  - Preview of current image with overlay edit controls
  - Image size and alignment options
  - Accessibility-focused alt text guidance
  - Comprehensive test suite with 34 tests

### Phase 3: Integration and Data Flow ✅ COMPLETED

- [x] Task 3.1: Integrate with CardRenderer
  - Updated `CardRenderer.tsx` to trigger edit mode on double-click
  - **Fixed: Added `enableInlineEdit={true}` prop to CardRenderer in CardLayer.tsx**
  - **Fixed: Created `EditorOverlay.tsx` component that renders editors as DOM portals outside Konva canvas**
  - **Fixed: Wired specialized editor components (TextEditor, CodeEditor, LinkEditor, ImageEditor) to EditorOverlay based on card type**
  - **Architecture Fix: Moved from EditModeManager wrapper (incompatible with Konva) to portal-based overlay rendering**
  - Added edit mode visual indicators ("Editing" badge, backdrop overlay)
  - Disabled drag operations during editing
  - Handled edit mode conflicts with selection and other interactions
  - Created comprehensive test suite with 21 tests

- [x] Task 3.2: Connect to cardStore and server persistence
  - Updated EditModeManager to call `cardStore.updateCard()` for immediate UI feedback
  - Integrated with `useCardOperations.updateCard()` for server persistence
  - Implemented optimistic updates with rollback on server failure
  - Added debounced auto-save preparation after 5 seconds of inactivity
  - Created test suite with 6 tests for persistence features

- [x] Task 3.3: Implement comprehensive keyboard navigation
  - Implemented Tab navigation between edit fields within cards
  - Added Enter/Shift+Enter handling for text cards (save vs new line)
  - Implemented Arrow key navigation for multi-field editors
  - Added Escape key to cancel edits and restore original content
  - Implemented Ctrl/Cmd+S to save and exit edit mode
  - Created comprehensive test suite with 12 tests for keyboard navigation

### Phase 4: User Experience and Polish

- [ ] Task 4.1: Add edit mode animations and transitions
  - Smooth fade-in/out for edit overlays
  - Card highlight animation when entering edit mode
  - Loading states for server save operations
  - Success/error feedback for save operations

- [ ] Task 4.2: Implement accessibility features
  - Screen reader announcements for edit mode entry/exit
  - Proper ARIA labels and roles for all edit controls
  - High contrast mode support for edit overlays
  - Keyboard navigation indicators and focus outlines

- [ ] Task 4.3: Add visual feedback and error handling
  - Unsaved changes indicator (e.g., asterisk in editor)
  - Error states for validation failures
  - Network error handling with retry options
  - Conflict resolution for concurrent edits (prepare for future collaboration)

- [ ] Task 4.4: Implement auto-enter edit mode for newly created cards
  - Integrate with `useCardCreation` hook's `autoEnterEditMode` parameter
  - Automatically open editor overlay after card creation completes
  - Handle transition from card creation to edit mode smoothly
  - Ensure proper focus management when auto-entering edit mode

## Dependencies and Prerequisites

- **Direct Dependencies**: NEX-200 card creation and rendering infrastructure (completed)
- **External Libraries**:
  - Prism.js for syntax highlighting (already available)
  - React DOM utilities for overlay positioning
  - Existing Konva canvas infrastructure
- **Future Integration Points**:
  - Auto-save system (Sub-Task 3 of NEX-109)
  - Undo/redo system (Sub-Task 4 of NEX-109)
  - Collaborative editing indicators (future feature)

## Challenges and Considerations

- **Canvas Coordinate Conversion**: Converting between Konva canvas coordinates and DOM overlay positioning, especially with zoom and pan
- **Performance with Large Content**: Maintaining <100ms feedback requirement for large text/code content
- **Mobile Responsiveness**: Ensure edit overlays work properly on mobile devices and touch interfaces
- **Concurrent Edit Handling**: Graceful handling when server state differs from local edits
- **Memory Management**: Proper cleanup of edit overlays and event listeners to prevent memory leaks
- **Browser Compatibility**: ContentEditable behavior differences across browsers
- **Focus Management**: Preventing focus loss during canvas operations while editing
