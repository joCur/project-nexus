# EditModeManager Integration Guide

## Overview

The `EditModeManager` component provides inline editing capabilities for cards in the canvas. It handles edit mode state, focus trap functionality, and smooth transition animations.

## Integration with CardRenderer

### Basic Integration

To enable inline editing in the CardRenderer, update the InfiniteCanvas or parent component:

```tsx
import { CardRenderer } from '@/components/canvas/cards/CardRenderer';

// In your canvas component
<CardRenderer
  card={card}
  enableInlineEdit={true}
  onEditStart={(cardId, mode) => {
    console.log(`Started editing card ${cardId} in ${mode} mode`);
  }}
  onEditEnd={(cardId, content) => {
    // Call GraphQL mutation to update card content
    updateCardMutation({
      variables: {
        id: cardId,
        content
      }
    });
  }}
  onEditCancel={(cardId) => {
    console.log(`Cancelled editing card ${cardId}`);
  }}
/>
```

### With EditModeManager Wrapper

For more control over the editing experience:

```tsx
import { EditModeManager } from '@/components/canvas/editing';
import { CardRenderer } from '@/components/canvas/cards/CardRenderer';

// Custom editor component
const CustomTextEditor: React.FC<EditModeEditorProps> = ({
  card,
  onSave,
  onCancel,
  autoFocus
}) => {
  // Custom editor implementation
  return (
    <div className="custom-editor">
      {/* Your custom editor UI */}
    </div>
  );
};

// In your canvas component
<EditModeManager
  card={card}
  canEdit={!card.isLocked}
  editorComponent={CustomTextEditor}
  onEditEnd={(cardId, content) => {
    // Handle save
  }}
>
  <CardRenderer card={card} />
</EditModeManager>
```

## Features

### Edit Mode Types

- `text` - Plain text editing
- `code` - Code editing with syntax highlighting (future)
- `link` - URL and metadata editing
- `image-caption` - Image caption editing
- `metadata` - General metadata editing

### Keyboard Shortcuts

- **Double-click** - Enter edit mode
- **Escape** - Cancel editing
- **Ctrl/Cmd + Enter** - Save changes (in default editor)
- **Tab/Shift+Tab** - Navigate within editor (focus trap active)

### Focus Trap

The EditModeManager implements a focus trap to keep keyboard navigation within the editor when active. This ensures accessibility and prevents users from accidentally tabbing out of the edit area.

### Transition Animations

Smooth transitions are provided by Framer Motion:
- Scale and fade in when entering edit mode
- Scale and fade out when exiting
- Duration: 150ms with easeInOut timing

## State Management

### Using the useEditMode Hook

```tsx
import { useEditMode } from '@/components/canvas/editing';

function MyComponent() {
  const {
    editState,
    startEdit,
    endEdit,
    setDirty,
    isEditing,
    editingCardId,
    isDirty
  } = useEditMode();

  // Start editing
  const handleStartEdit = () => {
    startEdit(cardId, 'text', originalContent);
  };

  // Mark as dirty when changes are made
  const handleChange = () => {
    setDirty(true);
  };

  // End editing
  const handleSave = () => {
    endEdit();
  };

  return (
    <div>
      {isEditing && (
        <div>Currently editing: {editingCardId}</div>
      )}
    </div>
  );
}
```

## GraphQL Integration

When saving edits, integrate with your GraphQL mutations:

```tsx
const UPDATE_CARD_CONTENT = gql`
  mutation UpdateCardContent($id: ID!, $content: CardContentInput!) {
    updateCard(id: $id, content: $content) {
      id
      content {
        ... on TextCardContent {
          content
        }
        ... on CodeCardContent {
          content
          language
        }
      }
    }
  }
`;

const handleEditEnd = async (cardId: string, content: unknown) => {
  try {
    await updateCardContent({
      variables: {
        id: cardId,
        content
      }
    });
  } catch (error) {
    console.error('Failed to save card:', error);
    // Handle error (show toast, etc.)
  }
};
```

## Testing

The EditModeManager includes comprehensive tests. Run them with:

```bash
npm test -- --testPathPattern="EditModeManager.test"
```

## Future Enhancements

1. **Specialized Editors**
   - Rich text editor for text cards
   - Code editor with syntax highlighting
   - Link preview editor
   - Image upload and caption editor

2. **Collaborative Editing**
   - Show who's editing which card
   - Conflict resolution for simultaneous edits
   - Real-time updates via GraphQL subscriptions

3. **Undo/Redo Support**
   - Track edit history
   - Keyboard shortcuts for undo/redo
   - Visual indicators for changes

4. **Auto-save**
   - Periodic saving while editing
   - Draft state management
   - Recovery from connection loss