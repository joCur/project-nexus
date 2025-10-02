# Fix Card Rerendering on Zoom/Pan

## Objective and Scope

Fix the bug where cards (especially image cards) unnecessarily rerender and briefly disappear during zoom and pan operations. The root cause is that viewport changes trigger GraphQL query variable recalculation, causing the entire card list to be recreated even though the cards themselves haven't changed.

## Technical Approach and Reasoning

The core issue is in `CardLayer.tsx` where `currentViewportBounds` recalculates on every zoom/pan event, triggering a cascade of re-renders:

1. `currentViewportBounds` useMemo depends on `zoom`, `position.x`, `position.y` (line 104)
2. This creates new `queryVariables` (line 107)
3. GraphQL refetches with new bounds
4. `visibleCards` array is recreated (line 197)
5. `sortedCards` array is recreated (line 345)
6. All `cardRenderers` are recreated (line 394)
7. Image cards lose their loaded state and flash

**Solution Strategy:**

1. **Debounce viewport bounds calculation** - Only update query bounds after zoom/pan settles
2. **Stabilize card identity** - Use stable keys and React.memo with proper comparison
3. **Preserve image state** - Keep loaded images in cache during rerenders

The key insight is that we don't need to query new cards on every single zoom/pan frame - we can keep rendering the current set with padding, and only fetch new cards once the viewport settles.

## Implementation Phases

### Phase 1: Add viewport bounds debouncing ✅ COMPLETED
- [x] Task 1.1: Create debounced viewport bounds state
  - Import `useRef` and create a debounce timer ref in CardLayer
  - Add a `debouncedViewportBounds` state separate from `currentViewportBounds`
  - Set debounce delay to 150ms for smooth UX (not too fast, not too slow)
- [x] Task 1.2: Implement debounce logic for viewport changes
  - In the `currentViewportBounds` useMemo, calculate bounds immediately for rendering
  - Add a `useEffect` that watches `currentViewportBounds` changes
  - Clear existing timer and set new timer to update `debouncedViewportBounds` after 150ms
  - Cleanup timer on unmount
- [x] Task 1.3: Update GraphQL query to use debounced bounds
  - Change `queryVariables` useMemo to depend on `debouncedViewportBounds` instead of `currentViewportBounds`
  - Keep `viewportPadding` generous (current value) to ensure cards don't disappear during debounce
  - This breaks the zoom/pan → query → rerender cycle

**Implementation Summary:**
- Added `useState` and `useEffect` imports to CardLayer.tsx
- Created `debouncedViewportBounds` state initialized to `currentViewportBounds`
- Added `timerRef` using `useRef<NodeJS.Timeout | null>(null)` to track debounce timer
- Implemented `useEffect` that debounces viewport changes with 150ms delay
- Updated `queryVariables` useMemo to use `debouncedViewportBounds` instead of `currentViewportBounds`
- Timer cleanup on unmount properly implemented
- All tests passing (37/37 tests across 3 test files)
- TDD process followed: RED → GREEN → REFACTOR → VERIFY

### Phase 2: Stabilize card renderer memoization
- [ ] Task 2.1: Fix cardRenderers useMemo dependencies
  - Remove `handleCardDragEnd` from cardRenderers useMemo dependencies (line 437)
  - The function is already stable (useCallback with updateCard dependency)
  - This prevents unnecessary recreations when callback reference changes
- [ ] Task 2.2: Improve card comparison logic in memoization
  - Current logic at line 399 only checks if card IDs match in order
  - Add deep comparison of card position, dimensions, and content when IDs match
  - Only recreate renderers if actual card data changed, not just array reference
- [ ] Task 2.3: Add React.memo to CardRenderer with custom comparison
  - CardRenderer is already memoized at line 53 but uses default shallow comparison
  - Add custom `arePropsEqual` function that compares card.id, position, dimensions, and content
  - Ignore `isSelected`, `isHovered`, `isDragged` changes to prevent rerenders from interaction state
  - Actually, keep those state changes reactive - only stabilize against viewport changes

### Phase 3: Preserve image state during rerenders
- [ ] Task 3.1: Enhance ImageCache with persistent storage
  - Current `ImageCache.getImage()` at line 53 of ImageCardRenderer already caches
  - Verify cache persists across component unmount/remount cycles
  - If not, move cache to a module-level WeakMap or global Map with cleanup
- [ ] Task 3.2: Add loading state preservation
  - When image is already loaded, skip the loading state entirely
  - Check ImageCache before setting `imageLoaded` to false
  - Set `imageLoaded` to true immediately if image is in cache
- [ ] Task 3.3: Optimize image loading effect dependencies
  - Current effect at line 37 runs on every `content.url` or `content.thumbnail` change
  - Add early return if URL hasn't changed (compare with useRef)
  - Prevent redundant image loads during rerenders

### Phase 4: Testing and validation
- [ ] Task 4.1: Write test for debounced viewport bounds
  - Test that rapid zoom/pan events don't trigger multiple GraphQL queries
  - Verify query only fires after 150ms of no viewport changes
  - Test that cards remain visible during debounce period
- [ ] Task 4.2: Write test for card renderer stability
  - Mock zoom/pan events and verify CardRenderer doesn't remount
  - Check that image state is preserved across viewport changes
  - Verify drag interactions still work correctly
- [ ] Task 4.3: Manual testing for visual regression
  - Test zoom in/out rapidly - images should not flash
  - Test pan around canvas - cards should remain stable
  - Test with large numbers of cards (50+) to verify performance
  - Test drag operations still work smoothly

## Dependencies and Prerequisites

- Existing GraphQL query infrastructure (GET_CARDS_IN_BOUNDS)
- React hooks (useRef, useState, useEffect, useMemo, useCallback)
- Konva canvas rendering system
- ImageCache implementation in cardConfig

## Challenges and Considerations

**Challenge 1: Debounce timing**
- Too short (< 100ms): Still causes frequent queries
- Too long (> 300ms): Cards might disappear at viewport edges during fast pan
- Solution: 150ms debounce + generous viewport padding

**Challenge 2: Cards disappearing at edges**
- During debounce, new cards at viewport edges won't be fetched
- Solution: Keep viewport padding at current generous value (extra pixels around viewport)
- Alternative: Implement predictive loading based on pan direction

**Challenge 3: Stale card data**
- Debouncing means cards might be stale for 150ms after viewport change
- Solution: This is acceptable - cards don't change that frequently
- Apollo's `cache-and-network` policy already provides eventual consistency

**Challenge 4: Memory leaks from image cache**
- Aggressive caching could cause memory issues with many images
- Solution: ImageCache already has cleanup logic, verify it's being called
- Consider LRU cache with max size limit (e.g., 100 images)

**Challenge 5: Breaking existing tests**
- CardLayer tests may expect immediate query execution
- Solution: Update tests to use fake timers or increase wait times
- Document the 150ms debounce behavior in test setup

**Edge Cases:**
- User zooms, pans, then immediately drags a card: Drag should work immediately
- User switches canvases during debounce: Clear pending timers
- Rapid viewport changes then stop: Only one query should fire after 150ms
- Image load failures: Should not retry on every rerender
