# NEX-109 Card CRUD Operations - Remaining Implementation Plan

## Summary of Current Status

### ✅ **COMPLETED** (Sub-tickets Done)
- **NEX-192**: Visual Card Rendering on Canvas - All card renderers implemented
- **NEX-193**: Inline Editing Components - Complete inline editing system with all editors, **including SaveStatusIndicator**
- **NEX-200**: Card Creation UI - Full card creation UI and interactions

### 🔄 **FUTURE WORK** (Separate from this plan)
- **Tiptap Text Editor**: Will replace ContentEditable-based TextEditor with Tiptap v3 (see `.claude/plans/tiptap-text-editor-implementation.md`)

### 📋 **TODO** (Sub-tickets Remaining - Priority Order)
1. **NEX-194**: Auto-Save System (Status: Todo, Priority: Urgent) - **Partially complete via NEX-193, needs debounced auto-save**
2. **NEX-195**: Undo/Redo System (Status: Backlog, Priority: High)
3. **NEX-196**: Delete Confirmation with Archive (Status: Backlog, Priority: High)
4. **NEX-197**: Batch Operations UI (Status: Backlog, Priority: Medium)
5. **NEX-198**: Template System (Status: Backlog, Priority: Low) - **Deprioritized**
6. **NEX-199**: Optimistic Updates Enhancement (Status: Backlog, Priority: Low) - **Deprioritized**

---

## Objective and Scope

Complete the remaining CRUD operations for NEX-109, focusing on MVP functionality:
1. **Auto-save system** - Add debounced auto-save (5s) to existing save infrastructure
2. **Undo/redo system** - 50-operation history with localStorage persistence
3. **Delete confirmation** - Archive-first pattern with undo support
4. **Batch operations** - Multi-select operations for productivity

**Out of Scope**: Templates (NEX-198) and advanced optimistic updates (NEX-199) are low priority and deprioritized.

---

## Technical Approach and Reasoning

**Architecture Pattern**: Continue using established patterns:
- Zustand for UI state management (cardStore)
- GraphQL mutations via `useCardOperations` hook
- Component-based architecture with clear separation of concerns
- Test-driven development with comprehensive test coverage

**Key Design Decisions**:
- **Auto-save**: Extend existing SaveStatusIndicator with 5-second debounce
- **Undo/redo**: localStorage for persistence, circular buffer for 50 operations
- **Delete**: Archive-first pattern for safer data handling
- **Batch**: Reuse existing multi-select infrastructure from cardStore
- **Tiptap compatibility**: Design auto-save to work with future Tiptap integration

---

## Implementation Phases

### Phase 1: Auto-Save System (NEX-194)

**Priority: URGENT** - Critical for data persistence and UX

**Note**: SaveStatusIndicator already exists from NEX-193. This phase adds auto-save timer to existing infrastructure.

- [ ] **Task 1.1: Create useAutoSave hook**
  - Create `clients/web/hooks/useAutoSave.ts`
  - Implement 5-second debounce using lodash-es debounce
  - Track dirty state for cards being edited
  - Integrate with existing `useCardOperations.updateCard()` for persistence
  - Add retry logic with exponential backoff (1s, 2s, 4s, max 5 retries)
  - Handle version conflicts from optimistic locking
  - **Design for Tiptap**: Accept generic content update callback to work with future Tiptap editor

- [ ] **Task 1.2: Integrate with existing SaveStatusIndicator**
  - **DO NOT create new SaveStatusIndicator** - it already exists from NEX-193
  - Update `SaveStatusIndicator.tsx` to accept auto-save timer state
  - Add countdown/timer display showing seconds until next auto-save
  - Show "Auto-saving..." when debounce triggers
  - Keep existing manual save, error retry, and unsaved changes features

- [ ] **Task 1.3: Integration with editing system**
  - Update `EditorOverlay.tsx` to use `useAutoSave` hook
  - Hook into content changes from TextEditor, CodeEditor, LinkEditor, ImageEditor
  - Track unsaved changes state across all editor types
  - Cancel auto-save timer on manual save (Ctrl/Cmd+S)
  - Cancel auto-save timer on edit mode exit
  - **Prepare for Tiptap**: Structure integration to easily swap TextEditor for Tiptap later

- [ ] **Task 1.4: Write comprehensive tests**
  - Test debounce behavior (5-second delay)
  - Test retry logic with mock failures
  - Test conflict resolution scenarios
  - Test save state transitions
  - Test timer cancellation on manual save
  - Test timer cancellation on edit exit
  - Test interaction with existing SaveStatusIndicator

---

### Phase 2: Undo/Redo System (NEX-195)

**Priority: HIGH** - Essential for user confidence in editing

**Note**: cardStore is minimal (UI state only). Undo/redo will track operations that modify server data.

- [ ] **Task 2.1: Create history tracking system**
  - Create `clients/web/stores/historyStore.ts` as separate Zustand store
  - Implement circular buffer for 50 operations
  - Create `HistoryEntry` type with operation metadata:
    - `operation`: 'create' | 'update' | 'delete' | 'move' | 'resize' | 'batch'
    - `cardIds`: Array of affected card IDs
    - `previousState`: Snapshot of cards before operation
    - `newState`: Snapshot of cards after operation
    - `timestamp`: When operation occurred
    - `description`: Human-readable description for UI
  - Add `pushHistory()`, `undo()`, `redo()`, `canUndo()`, `canRedo()` methods
  - Persist to localStorage for cross-session support

- [ ] **Task 2.2: Integrate history tracking with card operations**
  - Update `useCardOperations.ts` to call `historyStore.pushHistory()` after:
    - `createCard()` - Store creation operation
    - `updateCard()` - Store update operation (group rapid updates)
    - `deleteCard()` - Store deletion operation
    - Batch operations (positions, styles)
  - Implement operation grouping:
    - Batch operations = single history entry
    - Rapid updates within 500ms = single history entry
  - Store snapshots efficiently (only affected cards, not entire canvas)

- [ ] **Task 2.3: Create useUndoRedo hook**
  - Create `clients/web/hooks/useUndoRedo.ts`
  - Bind keyboard shortcuts:
    - `Ctrl+Z` / `Cmd+Z` - Undo
    - `Ctrl+Y` / `Cmd+Y` - Redo (Windows)
    - `Cmd+Shift+Z` - Redo (Mac)
  - Call `historyStore.undo()`/`redo()` which applies state snapshots
  - Trigger GraphQL mutations to persist undo/redo to server
  - Handle conflicts when server state differs from history snapshot

- [ ] **Task 2.4: Create UndoRedoIndicator component**
  - Create `clients/web/components/canvas/UndoRedoIndicator.tsx`
  - Position in top-left or top-right of canvas viewport
  - Show undo/redo buttons with disabled states
  - Display operation count (e.g., "5 actions")
  - Show keyboard shortcuts in tooltips
  - Display last operation description on hover
  - Auto-hide when no operations available

- [ ] **Task 2.5: Write comprehensive tests**
  - Test circular buffer behavior (50 limit, oldest dropped)
  - Test undo/redo for all operation types
  - Test keyboard shortcuts
  - Test operation grouping (batch, rapid updates)
  - Test localStorage persistence and restoration
  - Test conflict resolution with server state
  - Test integration with card operations

---

### Phase 3: Delete Confirmation System (NEX-196)

**Priority: HIGH** - Safety feature for data protection

**Note**: Backend already supports card status field (archived/deleted states).

- [ ] **Task 3.1: Create DeleteConfirmationDialog component**
  - Create `clients/web/components/cards/DeleteConfirmationDialog.tsx`
  - Modal dialog with shadcn/ui Dialog component
  - Show different UI for single vs batch delete:
    - **Single**: Show card preview with title/content snippet
    - **Batch**: Show count + list of first 5 titles + "and X more"
  - Two delete options with clear visual distinction:
    - **Archive** (default, highlighted): "Move to Archive" - Recoverable
    - **Permanent Delete**: "Delete Permanently" - Requires secondary confirmation
  - Show undo information: "You can undo this action"
  - Reuse existing confirmation patterns from CanvasContextMenu

- [ ] **Task 3.2: Extend useCardOperations with archive methods**
  - Add GraphQL mutation for updating card status to "archived"
  - Add `archiveCard(id)` method using UPDATE_CARD mutation
  - Add `archiveCards(ids)` for batch archive using batch mutation
  - Add `restoreCard(id)` to change status from "archived" back to "active"
  - Keep existing `deleteCard()` for permanent delete
  - Update queries to filter out archived cards by default
  - Add separate query for viewing archived cards (future feature)

- [ ] **Task 3.3: Integrate with existing delete flows**
  - Update keyboard shortcut handler in `useCanvasEvents.ts`:
    - `Delete` key → Show DeleteConfirmationDialog
    - For batch selection → Show batch delete dialog
  - Quick delete pattern (like CanvasContextMenu "click again to confirm"):
    - First Delete press → Highlight card with "Press Delete again to archive"
    - Second Delete press → Archive immediately, show undo toast
  - Modal delete pattern:
    - Right-click → "Delete" → Show DeleteConfirmationDialog
    - Dialog → "Move to Archive" → Archive + show undo toast
    - Dialog → "Delete Permanently" → Show secondary confirmation → Permanent delete
  - Undo toast integration:
    - Show toast for 5 seconds after archive
    - Toast has "Undo" button that calls `restoreCard()`
    - Use existing toast system (shadcn/ui Sonner)

- [ ] **Task 3.4: Integrate delete with history system**
  - Archive operation creates history entry for undo/redo
  - Permanent delete does NOT create history (irreversible)
  - Undo on archive restores card to active status
  - History entry includes full card snapshot for restoration

- [ ] **Task 3.5: Write comprehensive tests**
  - Test single card delete flow (both quick and modal)
  - Test batch delete flow
  - Test archive vs permanent delete paths
  - Test restore functionality (undo toast + undo/redo)
  - Test confirmation dialog states and interactions
  - Test keyboard shortcuts
  - Test integration with history system

---

### Phase 4: Batch Operations UI (NEX-197)

**Priority: MEDIUM** - Productivity enhancement

**Note**: cardStore already has selection infrastructure. This phase adds UI and batch update capabilities.

- [ ] **Task 4.1: Create BatchOperationsToolbar component**
  - Create `clients/web/components/cards/BatchOperationsToolbar.tsx`
  - Floating toolbar at bottom-center of canvas viewport
  - Shows when `cardStore.selection.selectedIds.size > 1`
  - Action buttons (left-aligned):
    - **Delete All** → Opens DeleteConfirmationDialog with batch mode
    - **Duplicate All** → Uses existing `duplicateCards()` from useCardOperations
    - **Align** → Dropdown with align options (left, center, right, top, middle, bottom)
    - **Distribute** → Dropdown with distribute options (horizontal, vertical)
  - Right side:
    - Selection count: "X cards selected"
    - Close button (X) to clear selection
  - Styling: Semi-transparent background, subtle shadow, matches design system

- [ ] **Task 4.2: Create SelectionRectangle component**
  - Create `clients/web/components/cards/SelectionRectangle.tsx`
  - Konva.Rect component for drag-to-select visual feedback
  - Semi-transparent blue fill (#3b82f610), blue border (#3b82f6)
  - Calculates bounds during drag gesture
  - Visible only during active drag-to-select
  - Does not interfere with card dragging

- [ ] **Task 4.3: Implement batch update operations in useCardOperations**
  - Add `batchUpdateCards(updates)` method:
    - Accepts array of `{ id, position?, dimensions?, style? }`
    - Uses existing `BATCH_UPDATE_CARD_POSITIONS` mutation
    - Handles partial updates (only provided fields)
  - Add `alignCards(ids, alignment)` method:
    - Calculates alignment based on selection bounds
    - Uses `batchUpdateCards()` to update positions
  - Add `distributeCards(ids, direction)` method:
    - Calculates even spacing between cards
    - Uses `batchUpdateCards()` to update positions
  - All batch operations create single history entry

- [ ] **Task 4.4: Implement drag-to-select gesture**
  - Update `useCanvasEvents.ts` to detect drag-to-select:
    - Mouse down on empty canvas → Start selection rectangle
    - Mouse move → Update rectangle bounds, show SelectionRectangle
    - Mouse up → Calculate cards within bounds, call `selectCards()`
  - Differentiate from card dragging:
    - Card drag: Mouse down on card
    - Canvas drag: Mouse down + Space key (pan)
    - Selection drag: Mouse down on empty area
  - Calculate bounds in canvas coordinates (account for zoom/pan)
  - Select all cards whose bounds intersect with selection rectangle

- [ ] **Task 4.5: Integrate BatchOperationsToolbar with InfiniteCanvas**
  - Add BatchOperationsToolbar to InfiniteCanvas.tsx
  - Position toolbar using absolute positioning over canvas
  - Show/hide based on selection count
  - Wire up toolbar actions:
    - Delete → Opens DeleteConfirmationDialog
    - Duplicate → Calls `duplicateCards()`, offsets by 20px
    - Align/Distribute → Calls respective methods
  - Update on selection changes (cardStore.selection.selectedIds)

- [ ] **Task 4.6: Write comprehensive tests**
  - Test toolbar appearance/disappearance based on selection
  - Test all toolbar actions (delete, duplicate, align, distribute)
  - Test selection rectangle rendering and bounds calculation
  - Test drag-to-select gesture detection
  - Test differentiation between drag types (card, canvas, selection)
  - Test batch operations integration with history system
  - Test keyboard shortcuts for batch operations

---

## Dependencies and Prerequisites

**Existing Infrastructure** (Already Available):
- ✅ GraphQL mutations for all CRUD operations
- ✅ `useCardOperations` hook with server sync
- ✅ Card store with selection and drag state management
- ✅ Inline editing components (NEX-193) **with SaveStatusIndicator**
- ✅ Card creation UI (NEX-200)
- ✅ Card rendering system (NEX-192)
- ✅ Backend version field for optimistic locking
- ✅ Backend status field for archive support

**External Libraries**:
- lodash-es (debounce) - Already imported
- Apollo Client - Already configured
- Zustand - Already in use
- Sonner (toast) - Already available via shadcn/ui
- shadcn/ui Dialog - Already available

**Future Integration**:
- 🔄 Tiptap v3 Text Editor (separate plan) - Auto-save designed to be compatible

---

## Challenges and Considerations

**Challenge 1: Auto-save vs Undo/Redo Interaction**
- Auto-save commits changes to server, but undo should work locally
- **Solution**: Undo/redo works on server state via GraphQL, can undo auto-saved changes

**Challenge 2: Tiptap Migration Compatibility**
- Auto-save needs to work with both current ContentEditable and future Tiptap
- **Solution**: Design `useAutoSave` with generic content callback, not tied to specific editor

**Challenge 3: Offline Support**
- Auto-save fails when offline
- **Solution**: Retry logic with exponential backoff, queue operations for when connection restored

**Challenge 4: Concurrent Edits**
- Multiple users editing same card
- **Solution**: Use version field for optimistic locking, detect conflicts, show resolution UI

**Challenge 5: History Storage Size**
- 50 operations with full card snapshots could be large
- **Solution**: Only store affected cards in snapshots, not entire canvas. Compress old entries.

**Challenge 6: Performance with Large Selections**
- Batch operations on 100+ cards
- **Solution**: Use existing `BATCH_UPDATE_CARD_POSITIONS` mutation, show progress indicator

**Edge Cases**:
- Undo after auto-save completes (should restore previous server state)
- Delete during active edit (should cancel edit first, then show confirmation)
- Batch delete with some cards in edit mode (prompt to save/discard first)
- History persistence across browser sessions (localStorage with size limits)
- Circular buffer overflow (oldest operations dropped automatically)
- Archive card that's part of history entry (history still works, shows as archived)

---

## Testing Strategy

**Each phase must include**:
- Unit tests for hooks and utilities (Jest)
- Component tests with React Testing Library
- Integration tests with mock Apollo Client
- Keyboard shortcut tests
- Error handling and edge case tests

**Target Coverage**: 90%+ for new code (maintaining existing standards from NEX-193)

**Key Test Scenarios**:
- Auto-save with network failures and retries
- Auto-save timer cancellation on manual save
- Auto-save compatibility with all editor types
- Undo/redo with complex operation sequences
- Undo/redo persistence across page reload
- History circular buffer overflow
- Delete confirmation flows (quick, modal, batch)
- Archive and restore operations
- Permanent delete with secondary confirmation
- Batch operations with partial failures
- Drag-to-select with zoom/pan active
- Align and distribute with various card layouts
- Keyboard shortcuts across all features
- Integration between auto-save, undo/redo, and delete systems

---

## Success Criteria

**Phase 1 (Auto-Save)**:
- ✅ Cards auto-save 5 seconds after last edit
- ✅ SaveStatusIndicator shows countdown timer
- ✅ Auto-save works with all card types
- ✅ Retry logic handles network failures
- ✅ Compatible with future Tiptap integration

**Phase 2 (Undo/Redo)**:
- ✅ Ctrl+Z/Cmd+Z undoes last operation
- ✅ Ctrl+Y/Cmd+Y redoes last undone operation
- ✅ History persists across page reloads
- ✅ 50 operations maximum in history
- ✅ UndoRedoIndicator shows available operations

**Phase 3 (Delete)**:
- ✅ Delete key shows confirmation dialog
- ✅ Archive is default delete action
- ✅ Permanent delete requires secondary confirmation
- ✅ Undo toast appears for 5 seconds after archive
- ✅ Batch delete shows count and affected cards

**Phase 4 (Batch Operations)**:
- ✅ Toolbar appears when 2+ cards selected
- ✅ Drag-to-select works on empty canvas
- ✅ Align and distribute work correctly
- ✅ Batch delete shows proper confirmation
- ✅ All batch operations create single history entry
