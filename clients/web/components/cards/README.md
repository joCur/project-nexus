# Card Inline Editing System

This module provides a comprehensive inline editing system for canvas cards, implementing the requirements from Linear ticket NEX-193.

## Overview

The inline editing system allows users to edit card content directly on the canvas with immediate visual feedback (<100ms requirement). It supports all major card types with appropriate editors for each content type.

## Components

### Core Components

#### `CardEditOverlay`
Main overlay manager that determines which editor to show based on card type.

**Features:**
- Type-aware editor selection
- Edit mode entry/exit animations
- Focus trap during editing
- Escape/click outside to exit
- Integration with cardStore for immediate updates

#### `InlineTextEditor`
ContentEditable implementation for text cards.

**Features:**
- Immediate visual feedback (<100ms)
- Markdown toggle support
- Word count tracking
- Auto-resize based on content
- Enter/Shift+Enter handling for line breaks
- Updates TextCardContent.lastEditedAt on changes

#### `InlineCodeEditor`
Code editing with syntax highlighting and language selection.

**Features:**
- Syntax highlighting for common languages
- Language selector dropdown (20+ languages)
- Line number display
- Tab key handling for proper indentation
- Updates CodeCardContent.lineCount and language
- Filename input with auto-language detection

#### `InlineLinkEditor`
URL editing with validation and preview.

**Features:**
- URL validation with auto-protocol addition
- Title and description editing
- Link metadata preview
- Domain extraction
- Real-time URL validation feedback
- Accessibility status indication

### Integration Components

#### `CardEditingManager`
Manages editing state and overlays for the canvas.

**Features:**
- Coordinates between Konva canvas and HTML overlays
- Handles canvas coordinate transformations
- Manages editing state across the application
- Proper positioning accounting for zoom and pan

## Usage

### Basic Integration

The editing system is automatically integrated when `enableCardEditing={true}` is set on the `InfiniteCanvas` component:

```tsx
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';

export function CanvasView() {
  return (
    <InfiniteCanvas
      enableCardEditing={true} // Enable inline editing
      showGrid={true}
    />
  );
}
```

### Double-Click to Edit

Users can double-click any card to enter edit mode:

1. **Text Cards**: Opens rich text editor with markdown toggle
2. **Code Cards**: Opens code editor with syntax highlighting
3. **Link Cards**: Opens URL editor with validation and preview
4. **Image Cards**: Shows placeholder (not yet implemented)

### Keyboard Navigation

- **Escape**: Cancel editing and revert changes
- **Ctrl/Cmd + Enter**: Complete editing and save changes
- **Tab**: Navigate between form controls
- **Tab (in code editor)**: Insert indentation
- **Shift + Tab (in code editor)**: Remove indentation

### Immediate Feedback

All changes show immediate visual feedback (<100ms requirement):

- Text changes update word count instantly
- Code changes update line count instantly
- URL changes show validation status instantly
- All content updates are reflected in the cardStore immediately

## Architecture

### State Management

The editing system integrates with the existing card architecture:

```
CardRenderer (Konva)
    ↓ double-click
CardEditingManager
    ↓ manages
CardEditOverlay
    ↓ shows appropriate
InlineEditor (Text/Code/Link)
    ↓ updates
cardStore.updateCard()
```

### Coordinate Transformation

The system handles canvas transformations properly:

1. **World Coordinates**: Card positions in canvas space
2. **Screen Coordinates**: Pixel positions accounting for zoom/pan
3. **Overlay Positioning**: HTML overlays positioned over Konva elements

### Performance Optimizations

- **Immediate Local Updates**: Changes update local state first
- **Debounced Persistence**: Backend updates are optimized
- **Memory Management**: Proper cleanup of event listeners
- **Animation Performance**: CSS transforms for smooth animations

## Testing

### Running Tests

```bash
npm test components/cards
```

### Test Coverage

- ✅ Component rendering
- ✅ User interactions (typing, clicking, keyboard shortcuts)
- ✅ Content validation (URL validation, word counting)
- ✅ State management integration
- ✅ Accessibility features

### Manual Testing Checklist

- [ ] Double-click text card opens text editor
- [ ] Double-click code card opens code editor
- [ ] Double-click link card opens link editor
- [ ] Escape cancels editing
- [ ] Ctrl+Enter completes editing
- [ ] Click outside completes editing
- [ ] Changes show immediately (<100ms)
- [ ] Word count updates in real-time
- [ ] Line count updates in real-time
- [ ] URL validation shows immediately
- [ ] Markdown toggle works
- [ ] Language selector works
- [ ] Tab indentation works in code editor

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Accessibility

- **ARIA Labels**: All editors have proper ARIA labeling
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Proper focus trapping during editing
- **Screen Reader Support**: Content changes are announced
- **High Contrast Mode**: Supports high contrast preferences
- **Reduced Motion**: Respects reduced motion preferences

## Future Enhancements

### Planned Features (Future Iterations)

1. **Image Editor**: Inline image editing with cropping/filters
2. **Rich Text Formatting**: Advanced markdown editor with toolbar
3. **Collaborative Editing**: Real-time collaborative editing
4. **Syntax Highlighting**: Enhanced syntax highlighting with themes
5. **Auto-completion**: Code completion and suggestions
6. **Version History**: Undo/redo for individual cards

### Performance Improvements

1. **Virtual Scrolling**: For large code files
2. **Lazy Loading**: Code editor syntax highlighting
3. **Web Workers**: Background processing for large documents
4. **Caching**: Smart caching of parsed content

## Troubleshooting

### Common Issues

**Editor not opening on double-click:**
- Check that `enableCardEditing={true}` is set
- Verify card is not locked (`card.isLocked === false`)
- Check browser console for JavaScript errors

**Overlay positioning issues:**
- Ensure canvas container element is properly passed
- Check for CSS transforms affecting positioning
- Verify viewport calculations are correct

**Performance issues:**
- Check for memory leaks in event listeners
- Monitor React DevTools for unnecessary re-renders
- Verify animations respect reduced motion preferences

### Debug Mode

Enable debug logging by setting:

```javascript
window.__DEBUG_CARD_EDITING = true;
```

This will log editing state changes and coordinate transformations to the console.

## Contributing

When contributing to the inline editing system:

1. **Follow TypeScript**: Maintain strict typing
2. **Test Coverage**: Add tests for new features
3. **Accessibility**: Ensure WCAG AA compliance
4. **Performance**: Maintain <100ms feedback requirement
5. **Documentation**: Update this README for new features

## Related Documentation

- [Card Types Documentation](../types/card.types.ts)
- [Canvas Architecture](../canvas/README.md)
- [Design System](../../ui/README.md)
- [Testing Guide](../../../__tests__/README.md)