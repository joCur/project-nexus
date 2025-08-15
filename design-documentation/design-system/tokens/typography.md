---
title: Project Nexus Typography System
description: Comprehensive typography specifications with responsive scaling and accessibility
last-updated: 2025-08-15
version: 1.0.0
related-files:
  - ../style-guide.md
  - ../../accessibility/guidelines.md
status: approved
---

# Typography System

## Overview
The Project Nexus typography system prioritizes readability for knowledge work, supporting sustained reading sessions while maintaining clear information hierarchy across all platforms.

## Typography Philosophy

### Cognitive Readability
Typography choices optimize for extended knowledge work sessions, minimizing eye strain while maximizing information retention.

### Hierarchical Clarity
Clear type scale creates intuitive information hierarchy, guiding users through complex knowledge structures.

### Cross-Platform Consistency
Unified type system across web and mobile platforms while respecting platform-specific reading conventions.

## Font Stack

### Primary Typeface - Inter

**Font Family**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
```

**Characteristics**
- Optimized for screen readability at small sizes
- Excellent character spacing and legibility
- Professional appearance suitable for knowledge work
- Wide language support including international characters
- Variable font support for precise weight control

**Fallback Strategy**
- **macOS/iOS**: `-apple-system` (San Francisco)
- **Windows**: `Segoe UI`
- **Android**: `Roboto`
- **Generic**: `sans-serif`

### Monospace Typeface - JetBrains Mono

**Font Family**
```css
font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Inconsolata', monospace;
```

**Characteristics**
- Designed for code readability and extended viewing
- Clear character distinction (0, O, l, I, 1)
- Ligature support for programming contexts
- Consistent character width for alignment

**Usage**
- Code blocks within cards
- Technical references and IDs
- Data visualization labels
- Mathematical expressions

## Font Weights

### Weight Scale
- **Light (300)**: Subtle text, secondary information, large display sizes
- **Regular (400)**: Body text, standard UI elements, default weight
- **Medium (500)**: Card titles, emphasis text, navigation items
- **Semibold (600)**: Section headers, important actions, prominent labels  
- **Bold (700)**: Page titles, primary headings, brand elements

### Weight Usage Guidelines
```css
/* Hierarchy through weight variation */
.heading-primary { font-weight: 700; }    /* Bold for maximum emphasis */
.heading-secondary { font-weight: 600; }  /* Semibold for sections */
.body-emphasis { font-weight: 500; }      /* Medium for subtle emphasis */
.body-text { font-weight: 400; }          /* Regular for readability */
.body-light { font-weight: 300; }        /* Light for minimal emphasis */
```

## Type Scale

### Desktop/Web Typography (Base Scale)

**H1 - Page Titles**
- **Size**: `2.25rem` (36px)
- **Line Height**: `2.75rem` (44px) 
- **Weight**: `700` (Bold)
- **Letter Spacing**: `-0.025em`
- **Usage**: Main page titles, major section headers
- **Accessibility**: High contrast, minimum 18pt for AAA compliance

**H2 - Section Headers**  
- **Size**: `1.875rem` (30px)
- **Line Height**: `2.25rem` (36px)
- **Weight**: `600` (Semibold)
- **Letter Spacing**: `-0.02em`
- **Usage**: Canvas sections, major feature areas

**H3 - Subsection Headers**
- **Size**: `1.5rem` (24px)
- **Line Height**: `2rem` (32px)
- **Weight**: `600` (Semibold) 
- **Letter Spacing**: `-0.015em`
- **Usage**: Card groups, settings sections

**H4 - Card Titles**
- **Size**: `1.25rem` (20px)
- **Line Height**: `1.75rem` (28px)
- **Weight**: `500` (Medium)
- **Letter Spacing**: `-0.01em`
- **Usage**: Individual card titles, modal headers

**H5 - Minor Headers**
- **Size**: `1.125rem` (18px)
- **Line Height**: `1.5rem` (24px)
- **Weight**: `500` (Medium)
- **Letter Spacing**: `-0.005em`
- **Usage**: Form sections, card metadata headers

**Body Large - Primary Reading**
- **Size**: `1.125rem` (18px)
- **Line Height**: `1.75rem` (28px)
- **Weight**: `400` (Regular)
- **Usage**: Card content, important descriptions, reading-heavy interfaces

**Body - Standard UI**
- **Size**: `1rem` (16px)  
- **Line Height**: `1.5rem` (24px)
- **Weight**: `400` (Regular)
- **Usage**: Standard interface text, form labels, menu items

**Body Small - Secondary**
- **Size**: `0.875rem` (14px)
- **Line Height**: `1.25rem` (20px)  
- **Weight**: `400` (Regular)
- **Usage**: Metadata, timestamps, helper text

**Caption - Minimal**
- **Size**: `0.75rem` (12px)
- **Line Height**: `1rem` (16px)
- **Weight**: `400` (Regular)
- **Usage**: Fine print, micro-information, tooltips

**Label - Form Labels**
- **Size**: `0.875rem` (14px)
- **Line Height**: `1.25rem` (20px)
- **Weight**: `500` (Medium)
- **Letter Spacing**: `0.05em`
- **Text Transform**: `uppercase`
- **Usage**: Form field labels, category headers

**Code - Technical Text**
- **Size**: `0.875rem` (14px)
- **Line Height**: `1.25rem` (20px)
- **Font Family**: JetBrains Mono
- **Weight**: `400` (Regular)
- **Usage**: Code blocks, technical references, IDs

## Responsive Typography

### Mobile Typography (320px - 767px)

**Scaling Factor**: `0.875x` base sizes
**Line Height Adjustment**: `+0.125rem` for improved readability

```css
/* Mobile-specific adjustments */
@media (max-width: 767px) {
  .type-h1 { 
    font-size: 1.97rem; /* 31.5px */
    line-height: 2.5rem; /* 40px */
  }
  .type-h2 { 
    font-size: 1.64rem; /* 26.25px */
    line-height: 2.125rem; /* 34px */
  }
  .type-body-large {
    font-size: 1rem; /* 16px */
    line-height: 1.625rem; /* 26px */
  }
}
```

### Tablet Typography (768px - 1023px)

**Scaling Factor**: `0.95x` base sizes
**Line Height**: Maintained for optimal reading

### Desktop Typography (1024px+)

**Scaling Factor**: `1x` (reference scale)
**Optimized for**: Extended reading sessions, detailed interfaces

### Wide Screen Typography (1440px+)

**Scaling Factor**: `1.1x` base sizes
**Usage**: Large displays, presentation modes, detailed canvases

## Typography for Specific Use Cases

### Card Content Typography

**Card Title**
- **Typography**: H4 (20px/28px, Medium)
- **Max Lines**: 2 lines with ellipsis overflow
- **Color**: Primary text (`#111827`)

**Card Body Text**
- **Typography**: Body Large (18px/28px, Regular) for readability
- **Max Height**: 300px with scroll for overflow
- **Color**: Secondary text (`#374151`)

**Card Metadata**
- **Typography**: Caption (12px/16px, Regular)
- **Color**: Tertiary text (`#6B7280`)
- **Style**: Uppercase for categories, normal for timestamps

### Search Interface Typography

**Search Query Input**
- **Typography**: Body (16px/24px, Regular)
- **Placeholder**: Body Small (14px/20px, Regular)
- **Color**: Primary text with tertiary placeholder

**Search Results**
- **Result Title**: H5 (18px/24px, Medium)
- **Result Snippet**: Body Small (14px/20px, Regular)
- **Relevance Score**: Caption (12px/16px, Regular)

### AI Connection Labels

**Connection Strength Indicators**
- **Typography**: Caption (12px/16px, Medium)
- **Color**: Secondary purple (`#7C3AED`)
- **Background**: Secondary light (`#EDE9FE`)
- **Padding**: 4px 8px
- **Border Radius**: 4px

## Accessibility Specifications

### WCAG 2.1 Compliance

**Text Size Requirements**
- **Minimum**: 16px (1rem) for body text
- **Large Text**: 18px+ (1.125rem+) for enhanced readability
- **Headers**: 24px+ minimum for clear hierarchy

**Line Height Standards**
- **Minimum**: 1.5x font size for body text
- **Optimal**: 1.6x font size for extended reading
- **Headings**: 1.2x minimum, 1.4x optimal

**Letter Spacing**
- **Body Text**: Default (0em) for optimal readability
- **Headings**: Slight negative spacing for tighter appearance
- **Labels**: Positive spacing (0.05em) for clarity

### Responsive Text Scaling

**System Font Scaling Support**
```css
/* Respect user's font size preferences */
html {
  font-size: 16px; /* Base size */
}

@media (prefers-reduced-motion: no-preference) {
  html {
    font-size: calc(14px + 0.25vw); /* Fluid scaling */
  }
}

/* Large text mode support */
@media (min-resolution: 2dppx) {
  .type-small {
    font-size: 0.9375rem; /* 15px instead of 14px */
  }
}
```

### Screen Reader Optimization

**Semantic Markup**
```html
<!-- Proper heading hierarchy -->
<h1>Canvas Workspace</h1>
  <h2>Recent Cards</h2>
    <h3>AI Connections</h3>
      <h4>Connection Details</h4>

<!-- Text emphasis -->
<strong>Important information</strong>
<em>Emphasized text</em>
```

## Implementation Guidelines

### CSS Typography Classes

```css
/* Base typography system */
.type-h1 {
  font-size: 2.25rem;
  line-height: 2.75rem;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.type-body {
  font-size: 1rem;
  line-height: 1.5rem;
  font-weight: 400;
}

.type-body-large {
  font-size: 1.125rem;
  line-height: 1.75rem;
  font-weight: 400;
}

.type-caption {
  font-size: 0.75rem;
  line-height: 1rem;
  font-weight: 400;
  color: var(--color-text-tertiary);
}

/* Utility classes */
.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

### Performance Considerations

**Font Loading Strategy**
```css
/* Critical font loading */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

/* Preload critical fonts */
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
```

**Font Subsetting**
- Include only necessary character sets
- Optimize for target languages and regions
- Reduce file size for faster loading

## Markdown Typography

### Markdown Rendering Specifications

**Headers in Markdown**
- `# H1` → Type H2 (30px) - Page-level headers
- `## H2` → Type H3 (24px) - Section headers  
- `### H3` → Type H4 (20px) - Subsection headers
- `#### H4` → Type H5 (18px) - Minor headers

**Body Content**
- **Paragraphs**: Body Large (18px) for readability
- **Lists**: Body (16px) with 8px spacing between items
- **Links**: Primary color with underline decoration
- **Emphasis**: `*italic*` and `**bold**` maintain text color

**Code Formatting**
- **Inline Code**: Monospace, 14px, background `#F3F4F6`, padding 2px 4px
- **Code Blocks**: Monospace, 14px, background `#F9FAFB`, padding 16px
- **Syntax Highlighting**: Subtle color coding without overwhelming text

## Quality Assurance

### Typography Testing Checklist
- [ ] All text meets WCAG 2.1 AA contrast requirements
- [ ] Font loading performance optimized for all platforms
- [ ] Responsive scaling verified across breakpoints
- [ ] Screen reader compatibility tested
- [ ] Line length optimal for reading (45-75 characters)
- [ ] Consistent vertical rhythm maintained

### Browser Testing
- [ ] Font fallbacks work correctly on all platforms
- [ ] Variable font features function properly
- [ ] Mobile text scaling respects system preferences
- [ ] Print styles maintain readability

## Related Documentation
- [Color System](./colors.md) - Text color specifications
- [Style Guide](../style-guide.md) - Overall design system
- [Accessibility Guidelines](../../accessibility/guidelines.md) - Typography accessibility standards

## Last Updated
**Change Log**:
- 2025-08-15: Initial typography system specification
- Version 1.0.0: Complete type scale with accessibility compliance verified