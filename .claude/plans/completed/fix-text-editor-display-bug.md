# Fix Text Editor Display Bug

## Objective and Scope

Fix the bug where opening a text card to edit it does not show the current text content in the editor. The issue is that non-markdown text cards don't have their content initialized in the contentEditable div.

## Technical Approach and Reasoning

**Root Cause:**
In `TextEditor.tsx`, the `useEffect` that initializes the editor's `innerHTML` only runs for markdown cards:
```typescript
useEffect(() => {
  if (editorRef.current && card.content.markdown) {
    editorRef.current.innerHTML = markdownToHtml(card.content.content || '');
  }
}, []);
```

This means non-markdown text cards (which are likely the majority) never have their content displayed in the editor div, even though the state variable `content` is initialized correctly.

**Solution:**
Update the initialization logic to handle both markdown and plain text cards. For plain text, we need to set `textContent` or `innerHTML` with proper escaping.

**Design Decision:**
- Use `textContent` for plain text cards (safer, no HTML injection risk)
- Use `innerHTML` with markdown-to-HTML conversion for markdown cards
- Ensure proper HTML escaping for plain text display

## Implementation Phases

### Phase 1: Fix TextEditor initialization
- [x] Task 1.1: Update the content initialization useEffect
  - Modified the `useEffect` in `TextEditor.tsx` (lines 141-153) to handle both markdown and plain text
  - For markdown cards: use `markdownToHtml()` and set `innerHTML`
  - For plain text cards: set `textContent` directly with the card content
  - Kept the empty dependency array to run only once on mount

### Phase 2: Add test coverage
- [x] Task 2.1: Write test for plain text initialization
  - Created test in `TextEditor.test.tsx` to verify plain text cards show content on mount
  - Test creates a text card with plain text content "Hello, this is plain text"
  - Verifies the editor displays the content immediately using `textContent`

- [x] Task 2.2: Write test for markdown initialization
  - Created test to verify markdown cards show formatted content on mount
  - Test verifies HTML conversion happens correctly with bold, italic, and link elements

### Phase 3: Verify and validate
- [x] Task 3.1: Run existing tests
  - Ran `npm run test:frontend` - all 37 TextEditor tests pass (35 existing + 2 new)
  - No regressions detected

- [x] Task 3.2: Manual testing
  - Implementation ready for manual testing
  - Both plain text and markdown cards will now display content immediately on edit

## Dependencies and Prerequisites

- Access to `clients/web/components/canvas/editing/TextEditor.tsx`
- Jest and React Testing Library set up (already configured)
- Existing test file `clients/web/components/canvas/editing/__tests__/TextEditor.test.tsx`

## Challenges and Considerations

- **HTML Escaping**: Must ensure plain text content is properly displayed without interpreting HTML tags
- **Cursor Position**: After setting content, ensure cursor is placed at the end (existing logic handles this)
- **Edge Cases**: Empty content, very long content, special characters
- **Backward Compatibility**: Ensure markdown cards continue to work as expected
