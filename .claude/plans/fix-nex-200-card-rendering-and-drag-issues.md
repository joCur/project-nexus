# Fix NEX-200 Card Rendering and Drag Issues

## Objective and Scope
Fix two critical bugs in the card creation and manipulation system:
1. Newly created cards don't appear until the user pans around the canvas
2. Cards reset to their original position when dragging begins

## Technical Approach and Reasoning

### Issue Analysis:
1. **Card Visibility Issue**: The `CardLayer` uses `GET_CARDS_IN_BOUNDS` query with `cache-and-network` policy, but newly created cards added to the cache by `useCardCreation` aren't triggering a re-render of the bounded query results.

2. **Drag Reset Issue**: The drag functionality in `CardRenderer` doesn't properly persist position changes to the server, and there's likely an issue with the initial drag state or position synchronization.

## Implementation Phases

### Phase 1: Fix Card Visibility After Creation
- [ ] Task 1.1: Investigate Apollo cache update mechanism
  - Review how `CREATE_CARD` mutation updates the cache in `useCardCreation.ts`
  - Check if the bounded query cache needs explicit update
  - Verify the cache keys match between CREATE_CARD and GET_CARDS_IN_BOUNDS

- [ ] Task 1.2: Fix cache synchronization
  - Update the cache write logic to also update GET_CARDS_IN_BOUNDS query cache
  - Ensure new cards are added to the bounded query results when within bounds
  - Add refetch queries option to CREATE_CARD mutation as fallback

- [ ] Task 1.3: Force CardLayer re-render after card creation
  - Add polling or refetch trigger to CardLayer when new cards are created
  - Consider using Apollo's refetchQueries or update functions
  - Test that new cards appear immediately without panning

### Phase 2: Fix Card Drag-and-Drop Position Reset
- [ ] Task 2.1: Investigate drag implementation
  - Review drag handlers in CardRenderer component
  - Check how drag state is initialized in cardStore
  - Identify why cards reset to old position on drag start

- [ ] Task 2.2: Implement proper position persistence
  - Create UPDATE_CARD_POSITION mutation if it doesn't exist
  - Add drag end handler to persist new position to server
  - Ensure optimistic updates during drag for smooth UX

- [ ] Task 2.3: Fix drag state initialization
  - Ensure drag start uses current card position, not cached/stale data
  - Fix any race conditions between drag state and position updates
  - Verify Konva's draggable prop isn't conflicting with custom handlers

### Phase 3: Testing and Validation
- [ ] Task 3.1: Create comprehensive tests
  - Write tests for card creation visibility
  - Write tests for drag-and-drop position persistence
  - Test multi-card selection and drag scenarios

- [ ] Task 3.2: Manual testing scenarios
  - Test creating cards of all types
  - Test dragging single and multiple cards
  - Test canvas pan and zoom during operations
  - Verify cross-browser compatibility

## Dependencies and Prerequisites
- Apollo Client GraphQL mutations and cache management
- React-Konva for canvas rendering
- Existing GraphQL schema for card operations
- Backend endpoints for card position updates

## Challenges and Considerations
- Apollo cache complexity with bounded queries
- Race conditions between optimistic UI updates and server responses
- Konva's built-in draggable vs custom drag implementation
- Performance impact of frequent position updates
- Multi-device synchronization during drag operations