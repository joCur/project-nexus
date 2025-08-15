---
title: Knowledge Card Component Specifications
description: Complete card component system for knowledge organization with AI connection capabilities
last-updated: 2025-08-15
version: 1.0.0
related-files:
  - ../style-guide.md
  - ../tokens/colors.md
  - ../../features/infinite-canvas/README.md
status: approved
---

# Knowledge Card Components

## Overview
Knowledge cards are the fundamental content units in Project Nexus, designed to hold various types of information while supporting AI-powered connections and spatial organization on the infinite canvas.

## Design Philosophy
- **Content First**: Card design prioritizes readability and content hierarchy
- **Connection Ready**: Visual design supports AI connection visualization
- **Flexible Sizing**: Cards adapt to content while maintaining readability
- **Interaction Clarity**: Clear affordances for manipulation and connection

## Card Architecture

### Base Card Structure
```
Knowledge Card Component
├── Card Container
│   ├── Visual State Indicators (Border, Shadow, Background)
│   ├── Interaction Affordances (Resize, Drag, Select)
│   └── Connection Points (Visual anchors for AI connections)
├── Card Header
│   ├── Content Type Icon
│   ├── AI Confidence Badge (Optional)
│   ├── Connection Indicator
│   └── Action Menu (Hover/Context dependent)
├── Card Content Area
│   ├── Title Section (H4 Typography)
│   ├── Main Content (Scrollable if needed)
│   ├── Media Content (Images, embeds, code)
│   └── Content Actions (Edit, Format, etc.)
├── Card Footer
│   ├── Metadata (Creation date, modification date)
│   ├── Tags (Horizontal scroll if overflow)
│   ├── Connection Count
│   └── Source Information (Optional)
└── Interactive Elements
    ├── Resize Handle (Bottom-right corner)
    ├── Connection Points (Edge midpoints)
    ├── Selection Indicator
    └── Context Menu Trigger
```

## Card Visual Specifications

### Default Card Appearance
```css
.knowledge-card {
  /* Container Properties */
  min-width: 200px;
  max-width: 600px;
  min-height: 120px;
  max-height: 400px;
  
  /* Default size for new cards */
  width: 300px;
  height: 200px;
  
  /* Visual Styling */
  background-color: var(--color-white);
  border: 1px solid var(--color-neutral-300);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  
  /* Layout */
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  
  /* Interaction */
  cursor: grab;
  transition: all 200ms ease-out;
}

.knowledge-card:hover {
  border-color: var(--color-primary-light);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.knowledge-card.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.knowledge-card.connected {
  animation: connection-pulse 1.5s ease-in-out;
}

@keyframes connection-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
```

### Card States

#### Default State
- **Border**: 1px solid Neutral-300 (`#D1D5DB`)
- **Background**: White (`#FFFFFF`)
- **Shadow**: Subtle elevation
- **Cursor**: Grab cursor indicating draggable

#### Hover State
- **Border**: Primary-light (`#DBEAFE`) 
- **Shadow**: Enhanced elevation
- **Transform**: Subtle lift effect (-2px translateY)
- **Cursor**: Maintains grab cursor

#### Selected State
- **Border**: Primary color (`#2563EB`)
- **Outer Ring**: 2px Primary-light ring
- **Background**: Maintains white
- **Additional Controls**: Resize handles and connection points visible

#### Connected State (Active Connection Creation)
- **Animation**: Gentle pulse animation
- **Border**: Enhanced primary color
- **Duration**: 1.5 seconds
- **Purpose**: Visual feedback during AI connection discovery

#### AI Processing State
- **Shimmer Effect**: Subtle shimmer animation across card surface
- **Duration**: During AI analysis (typically 2-3 seconds)
- **Color**: Secondary purple tint
- **Purpose**: Indicate AI is analyzing card content

```css
.knowledge-card.ai-processing::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(124, 58, 237, 0.1),
    transparent
  );
  animation: shimmer 2s ease-in-out infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}
```

## Card Content Types

### Text Cards
**Purpose**: Notes, ideas, structured text content
**Icon**: Document icon in Neutral-500

**Content Layout**:
```css
.card-text {
  padding: 16px;
}

.card-text .title {
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.75rem;
  color: var(--color-neutral-900);
  margin-bottom: 8px;
}

.card-text .content {
  font-size: 1rem;
  line-height: 1.5rem;
  color: var(--color-neutral-700);
  overflow-y: auto;
  flex-grow: 1;
}

/* Markdown support in text cards */
.card-text .content h1,
.card-text .content h2,
.card-text .content h3 {
  margin: 16px 0 8px 0;
  font-weight: 600;
}

.card-text .content p {
  margin-bottom: 12px;
}

.card-text .content ul,
.card-text .content ol {
  margin-left: 20px;
  margin-bottom: 12px;
}
```

### Image Cards
**Purpose**: Visual content, diagrams, inspiration, screenshots
**Icon**: Image icon in Neutral-500

**Content Layout**:
```css
.card-image {
  padding: 0;
}

.card-image .image-container {
  width: 100%;
  height: 60%;
  overflow: hidden;
  border-radius: 12px 12px 0 0;
}

.card-image .image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer; /* Click to expand */
}

.card-image .caption {
  padding: 12px 16px;
  flex-grow: 1;
}

.card-image .caption .title {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--color-neutral-900);
  margin-bottom: 4px;
}

.card-image .caption .description {
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--color-neutral-600);
}
```

### Link Cards
**Purpose**: Web links, references, external resources
**Icon**: Link icon in Neutral-500

**Content Layout**:
```css
.card-link {
  padding: 16px;
}

.card-link .link-preview {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.card-link .favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.card-link .link-info {
  flex-grow: 1;
  min-width: 0; /* Allows text truncation */
}

.card-link .link-title {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--color-primary);
  text-decoration: none;
  cursor: pointer;
  margin-bottom: 4px;
  display: block;
}

.card-link .link-title:hover {
  text-decoration: underline;
}

.card-link .link-description {
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--color-neutral-600);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-link .link-url {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
  margin-top: 8px;
  word-break: break-all;
}
```

### Code Cards
**Purpose**: Code snippets, technical notes, configurations
**Icon**: Code icon in Neutral-500

**Content Layout**:
```css
.card-code {
  padding: 0;
}

.card-code .code-header {
  padding: 12px 16px;
  background-color: var(--color-neutral-50);
  border-bottom: 1px solid var(--color-neutral-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-code .language-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-neutral-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-code .copy-button {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.card-code .copy-button:hover {
  background-color: var(--color-neutral-200);
  color: var(--color-neutral-700);
}

.card-code .code-content {
  padding: 16px;
  background-color: var(--color-neutral-900);
  color: var(--color-neutral-100);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  line-height: 1.25rem;
  overflow-x: auto;
  flex-grow: 1;
}

.card-code .code-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
```

## Card Header Components

### Content Type Indicator
**Visual Design**: 20x20px icon in top-left corner
**Color**: Neutral-500 for visual consistency
**Purpose**: Quick content type identification

```css
.card-header {
  position: absolute;
  top: 8px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 10;
  pointer-events: none;
}

.card-header .type-icon {
  width: 20px;
  height: 20px;
  color: var(--color-neutral-500);
  background-color: var(--color-white);
  border-radius: 4px;
  padding: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
```

### AI Confidence Badge
**Appearance**: When card has AI-suggested connections
**Visual**: Small badge with confidence percentage
**Color**: Secondary purple system

```css
.ai-confidence-badge {
  background-color: var(--color-secondary);
  color: var(--color-white);
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 0.625rem;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 200ms ease-out;
}

.knowledge-card:hover .ai-confidence-badge,
.knowledge-card.selected .ai-confidence-badge {
  opacity: 1;
}
```

### Action Menu Trigger
**Behavior**: Appears on hover or selection
**Content**: Three-dot menu icon
**Actions**: Edit, duplicate, delete, export, connections

```css
.card-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease-out;
}

.knowledge-card:hover .card-actions,
.knowledge-card.selected .card-actions {
  opacity: 1;
  pointer-events: auto;
}

.card-actions .menu-trigger {
  width: 24px;
  height: 24px;
  background-color: var(--color-white);
  border: 1px solid var(--color-neutral-300);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-neutral-500);
}

.card-actions .menu-trigger:hover {
  background-color: var(--color-neutral-50);
  border-color: var(--color-neutral-400);
  color: var(--color-neutral-700);
}
```

## Card Footer Components

### Metadata Display
**Content**: Creation date, modification date, word count
**Style**: Small text in Neutral-500
**Behavior**: Always visible but unobtrusive

```css
.card-footer {
  padding: 8px 16px 12px 16px;
  border-top: 1px solid var(--color-neutral-200);
  background-color: var(--color-neutral-50);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.card-footer .metadata {
  display: flex;
  gap: 12px;
  align-items: center;
}

.card-footer .metadata .separator {
  width: 2px;
  height: 2px;
  background-color: var(--color-neutral-400);
  border-radius: 50%;
}
```

### Tag System
**Layout**: Horizontal scroll if overflow
**Visual**: Rounded rectangles with semantic colors
**Interaction**: Click to filter, hover for actions

```css
.card-tags {
  display: flex;
  gap: 6px;
  align-items: center;
  overflow-x: auto;
  padding: 2px 0;
}

.card-tags::-webkit-scrollbar {
  display: none;
}

.card-tag {
  background-color: var(--color-neutral-200);
  color: var(--color-neutral-700);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.625rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 150ms ease-out;
}

.card-tag:hover {
  background-color: var(--color-primary-light);
  color: var(--color-primary-dark);
}

.card-tag.ai-suggested {
  background-color: var(--color-secondary-light);
  color: var(--color-secondary);
  border: 1px dashed var(--color-secondary);
}
```

### Connection Indicator
**Purpose**: Show number of AI and manual connections
**Visual**: Small badge with connection count
**Interaction**: Click to view all connections

```css
.connection-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--color-neutral-500);
  cursor: pointer;
}

.connection-indicator:hover {
  color: var(--color-primary);
}

.connection-indicator .icon {
  width: 12px;
  height: 12px;
}

.connection-indicator .count {
  font-weight: 500;
}
```

## Interactive Elements

### Resize Handle
**Position**: Bottom-right corner
**Visual**: Subtle grip pattern
**Behavior**: Drag to resize card within min/max constraints

```css
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nw-resize;
  opacity: 0;
  transition: opacity 200ms ease-out;
}

.resize-handle::after {
  content: '';
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  background-image: linear-gradient(
    -45deg,
    transparent 40%,
    var(--color-neutral-400) 40%,
    var(--color-neutral-400) 60%,
    transparent 60%
  );
  background-size: 3px 3px;
}

.knowledge-card:hover .resize-handle,
.knowledge-card.selected .resize-handle {
  opacity: 1;
}
```

### Connection Points
**Purpose**: Visual anchors for AI connection lines
**Position**: Edge midpoints (top, right, bottom, left)
**Behavior**: Highlight on connection hover

```css
.connection-point {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: var(--color-secondary);
  border: 2px solid var(--color-white);
  border-radius: 50%;
  opacity: 0;
  transition: all 200ms ease-out;
  pointer-events: none;
}

.connection-point.top {
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
}

.connection-point.right {
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
}

.connection-point.bottom {
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
}

.connection-point.left {
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
}

/* Show connection points during connection interactions */
.knowledge-card.connection-mode .connection-point,
.knowledge-card:hover .connection-point {
  opacity: 1;
}

.connection-point.active {
  background-color: var(--color-primary);
  transform: scale(1.5);
}
```

## Card Accessibility

### ARIA Implementation
```html
<article 
  role="article"
  aria-labelledby="card-title-123"
  aria-describedby="card-content-123"
  class="knowledge-card"
  tabindex="0">
  
  <header class="card-header">
    <div class="type-icon" aria-label="Text card">
      <!-- Icon SVG -->
    </div>
    <div class="ai-confidence-badge" aria-label="AI confidence: 85%">
      85%
    </div>
  </header>
  
  <div class="card-content">
    <h4 id="card-title-123" class="title">Card Title</h4>
    <div id="card-content-123" class="content">
      Card content text...
    </div>
  </div>
  
  <footer class="card-footer">
    <div class="metadata">
      <span aria-label="Created January 15, 2025">Jan 15</span>
      <span aria-label="3 connections to other cards">3 connections</span>
    </div>
    <div class="card-tags" aria-label="Tags">
      <span class="card-tag" role="button" tabindex="0">research</span>
      <span class="card-tag" role="button" tabindex="0">user-feedback</span>
    </div>
  </footer>
</article>
```

### Keyboard Navigation
- **Tab**: Focus moves to card
- **Enter**: Enter card edit mode or open detailed view
- **Space**: Select/deselect card
- **Arrow Keys**: Navigate between cards on canvas
- **Delete**: Remove card (with confirmation)
- **Escape**: Exit edit mode or deselect

### Screen Reader Support
- **Card Purpose**: Announced as "article" with title and content summary
- **Content Type**: Icon announced with appropriate label
- **Connection Status**: AI connections and counts announced
- **Edit State**: Edit mode changes announced to screen readers
- **Action Results**: Card actions (move, resize, connect) announced

## Performance Optimizations

### Rendering Performance
```css
.knowledge-card {
  /* Use transform for animations to enable hardware acceleration */
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
}

/* Optimize expensive properties for animations */
.knowledge-card.animating {
  will-change: transform, box-shadow, border-color;
}

.knowledge-card:not(.animating) {
  will-change: auto;
}
```

### Memory Management
- **Virtualization**: Only render cards visible in viewport plus buffer
- **Content Lazy Loading**: Load full content only when card comes into focus  
- **Image Optimization**: Use appropriate image sizes and formats
- **Connection Culling**: Hide connection lines at low zoom levels

### Touch Performance
```css
/* Optimize for touch interactions */
.knowledge-card {
  touch-action: manipulation;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

/* Prevent text selection during drag operations */
.knowledge-card.dragging {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
```

## Responsive Behavior

### Mobile Adaptations (320px-767px)
```css
@media (max-width: 767px) {
  .knowledge-card {
    min-width: 280px;
    min-height: 140px;
    border-radius: 8px;
  }
  
  .knowledge-card .title {
    font-size: 1.125rem;
  }
  
  .knowledge-card .content {
    font-size: 1rem;
  }
  
  /* Larger touch targets */
  .resize-handle {
    width: 24px;
    height: 24px;
  }
  
  .connection-point {
    width: 12px;
    height: 12px;
  }
}
```

### Tablet Adaptations (768px-1023px)
```css
@media (min-width: 768px) and (max-width: 1023px) {
  .knowledge-card {
    max-width: 500px;
  }
  
  /* Balance between touch and precision */
  .card-actions {
    opacity: 0.7;
  }
}
```

## Implementation Guidelines

### React Implementation
```typescript
interface CardProps {
  id: string;
  type: 'text' | 'image' | 'link' | 'code';
  title: string;
  content: string | object;
  position: { x: number; y: number };
  size: { width: number; height: number };
  connections: Connection[];
  tags: string[];
  metadata: {
    created: Date;
    modified: Date;
    aiConfidence?: number;
  };
  selected?: boolean;
  aiProcessing?: boolean;
  onMove: (position: { x: number; y: number }) => void;
  onResize: (size: { width: number; height: number }) => void;
  onEdit: () => void;
  onConnect: (targetId: string) => void;
}

export const KnowledgeCard: React.FC<CardProps> = ({
  id,
  type,
  title,
  content,
  position,
  size,
  connections,
  tags,
  metadata,
  selected = false,
  aiProcessing = false,
  onMove,
  onResize,
  onEdit,
  onConnect
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  return (
    <article
      className={`knowledge-card card-${type} ${selected ? 'selected' : ''} ${aiProcessing ? 'ai-processing' : ''}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: size.width,
        height: size.height,
      }}
      aria-labelledby={`card-title-${id}`}
      aria-describedby={`card-content-${id}`}
      tabIndex={0}
    >
      <CardHeader type={type} aiConfidence={metadata.aiConfidence} />
      <CardContent type={type} title={title} content={content} id={id} />
      <CardFooter 
        metadata={metadata} 
        tags={tags} 
        connectionCount={connections.length} 
      />
      {selected && (
        <>
          <ResizeHandle onResize={onResize} />
          <ConnectionPoints />
        </>
      )}
    </article>
  );
};
```

## Usage Guidelines

### Do's and Don'ts

**Do:**
- Keep card titles concise and descriptive
- Use appropriate content types for different media
- Maintain consistent card sizing patterns
- Provide clear visual feedback for all interactions
- Support both keyboard and mouse interaction
- Use AI confidence indicators to help users trust suggestions

**Don't:**
- Make cards too small to read comfortably
- Overcrowd cards with too much visual information
- Hide essential controls behind multiple interaction layers
- Use color alone to convey important information
- Make drag handles too small for touch interaction
- Display too many tags without overflow handling

### Best Practices
1. **Content Hierarchy**: Use consistent typography hierarchy within cards
2. **Visual Consistency**: Maintain uniform spacing and styling across card types
3. **Performance**: Optimize animations and rendering for smooth interactions
4. **Accessibility**: Ensure all card functions are keyboard accessible
5. **Mobile Optimization**: Adapt card sizes and interactions for touch devices

## Related Documentation
- [Infinite Canvas Interface](../../features/infinite-canvas/README.md)
- [AI Connection Visualization](../../features/ai-connections/README.md)
- [Color System](../tokens/colors.md)
- [Typography System](../tokens/typography.md)
- [Accessibility Guidelines](../../accessibility/guidelines.md)

## Last Updated
**Change Log**:
- 2025-08-15: Initial comprehensive card component specification
- Version 1.0.0: Complete card system with all content types, states, and accessibility requirements