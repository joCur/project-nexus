---
title: Project Nexus Design System - Complete Style Guide
description: Comprehensive design system specifications for the intelligent knowledge workspace
last-updated: 2025-08-15
version: 1.0.0
status: approved
---

# Project Nexus Design System

## Overview
The Project Nexus design system embodies bold simplicity with intelligent connections, creating a frictionless knowledge workspace that prioritizes user cognition and task efficiency over decorative elements.

## Table of Contents
1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography System](#typography-system)
4. [Spacing & Layout System](#spacing--layout-system)
5. [Component Specifications](#component-specifications)
6. [Motion & Animation System](#motion--animation-system)
7. [Platform Adaptations](#platform-adaptations)

## Design Philosophy

### Core Principles

**Bold Simplicity with Intelligent Guidance**
- Every interface element serves user goals
- AI connections are visually prominent but never overwhelming
- Information hierarchy guides attention naturally

**Cognitive Load Optimization**
- Strategic whitespace creates breathing room for complex information
- Progressive disclosure reveals advanced features gradually
- Visual density balanced for sustained knowledge work

**Cross-Platform Harmony**
- Unified visual language across web and mobile
- Platform-specific adaptations respect user expectations
- Seamless context switching between devices

**Accessibility-Driven Design**
- WCAG 2.1 AA compliance as minimum standard
- Color-independent information communication
- Keyboard-first interaction patterns

## Color System

### Primary Colors

**Nexus Blue** - Core brand and primary actions
- `Primary`: `#2563EB` - Main CTAs, brand elements, selected states
- `Primary Dark`: `#1D4ED8` - Hover states, emphasis, active connections
- `Primary Light`: `#DBEAFE` - Subtle backgrounds, highlights, hover areas

**Connection Violet** - AI-suggested connections and intelligence features
- `Secondary`: `#7C3AED` - AI connections, smart suggestions, automation
- `Secondary Light`: `#EDE9FE` - AI processing states, suggestion backgrounds
- `Secondary Pale`: `#F3F4F6` - Subtle AI interaction zones

### Accent Colors

**Success Green** - Confirmations and positive actions
- `Success`: `#059669` - Successful connections, saved states, confirmations
- `Success Light`: `#D1FAE5` - Success message backgrounds, positive highlights

**Warning Amber** - Cautions and attention-required states
- `Warning`: `#D97706` - Sync conflicts, unsaved changes, caution states
- `Warning Light`: `#FEF3C7` - Warning message backgrounds, attention areas

**Error Red** - Errors and destructive actions
- `Error`: `#DC2626` - Error states, destructive actions, failed connections
- `Error Light`: `#FEE2E2` - Error message backgrounds, danger zones

**Info Blue** - Informational messages and neutral actions
- `Info`: `#0891B2` - Information messages, neutral actions, system status
- `Info Light`: `#CFFAFE` - Info message backgrounds, neutral highlights

### AI Connection Gradients

**Connection Strength Gradient**
- `Gradient Start`: `#8B5CF6` - Strong AI connections
- `Gradient Mid`: `#A78BFA` - Medium connections
- `Gradient End`: `#C4B5FD` - Weak connections

### Neutral Palette

**Text Hierarchy**
- `Neutral-900`: `#111827` - Primary text, high contrast elements
- `Neutral-700`: `#374151` - Secondary text, medium emphasis
- `Neutral-500`: `#6B7280` - Tertiary text, metadata, placeholders
- `Neutral-400`: `#9CA3AF` - Disabled text, subtle elements
- `Neutral-300`: `#D1D5DB` - Borders, dividers, inactive elements

**Background Layers**
- `Neutral-50`: `#F9FAFB` - Page backgrounds, canvas base
- `Neutral-100`: `#F3F4F6` - Card backgrounds, elevated surfaces
- `Neutral-200`: `#E5E7EB` - Input backgrounds, subtle separations

### Accessibility Notes
- All color combinations meet WCAG AA standards (4.5:1 normal text, 3:1 large text)
- AI connections maintain 7:1 contrast ratio for enhanced visibility
- Color-blind friendly palette verified with deuteranopia and protanopia simulation
- Semantic colors never used as sole information indicators

## Typography System

### Font Stack

**Primary Typeface**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
```

**Monospace Typeface**
```css
font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Inconsolata', monospace;
```

### Font Weights
- **Light**: 300 - Subtle text, secondary information
- **Regular**: 400 - Body text, standard UI elements
- **Medium**: 500 - Card titles, emphasis text
- **Semibold**: 600 - Section headers, important actions
- **Bold**: 700 - Page titles, primary headings

### Type Scale

**H1 - Page Titles**
- Size: `2.25rem/2.75rem` (36px/44px)
- Weight: `700` (Bold)
- Letter Spacing: `-0.025em`
- Usage: Main page titles, major section headers

**H2 - Section Headers**
- Size: `1.875rem/2.25rem` (30px/36px)
- Weight: `600` (Semibold)
- Letter Spacing: `-0.02em`
- Usage: Canvas sections, major feature areas

**H3 - Subsection Headers**
- Size: `1.5rem/2rem` (24px/32px)
- Weight: `600` (Semibold)
- Letter Spacing: `-0.015em`
- Usage: Card groups, settings sections

**H4 - Card Titles**
- Size: `1.25rem/1.75rem` (20px/28px)
- Weight: `500` (Medium)
- Letter Spacing: `-0.01em`
- Usage: Individual card titles, modal headers

**H5 - Minor Headers**
- Size: `1.125rem/1.5rem` (18px/24px)
- Weight: `500` (Medium)
- Letter Spacing: `-0.005em`
- Usage: Form sections, card metadata headers

**Body Large - Primary Reading Text**
- Size: `1.125rem/1.75rem` (18px/28px)
- Weight: `400` (Regular)
- Usage: Card content, important descriptions

**Body - Standard UI Text**
- Size: `1rem/1.5rem` (16px/24px)
- Weight: `400` (Regular)
- Usage: Standard interface text, form labels, menu items

**Body Small - Secondary Information**
- Size: `0.875rem/1.25rem` (14px/20px)
- Weight: `400` (Regular)
- Usage: Metadata, timestamps, helper text

**Caption - Minimal Information**
- Size: `0.75rem/1rem` (12px/16px)
- Weight: `400` (Regular)
- Usage: Fine print, micro-information, tooltips

**Label - Form Labels**
- Size: `0.875rem/1.25rem` (14px/20px)
- Weight: `500` (Medium)
- Letter Spacing: `0.05em`
- Text Transform: `uppercase`
- Usage: Form field labels, category headers

**Code - Technical Text**
- Size: `0.875rem/1.25rem` (14px/20px)
- Font Family: Monospace
- Usage: Code blocks, technical references, IDs

### Responsive Typography

**Mobile Scaling Factor**: 0.875x base sizes
**Tablet Scaling Factor**: 0.95x base sizes
**Desktop Scaling Factor**: 1x base sizes (reference)
**Wide Screen Scaling Factor**: 1.1x base sizes

## Spacing & Layout System

### Base Unit
**Primary Unit**: `8px` - Foundation for all spacing calculations
**Secondary Unit**: `4px` - Micro-spacing for tight layouts

### Spacing Scale

**Micro Spacing**
- `xs`: `4px` - Element padding, icon spacing, tight layouts
- `sm`: `8px` - Small margins, internal card padding

**Standard Spacing**
- `md`: `16px` - Default margins, standard element separation
- `lg`: `24px` - Medium section separation, card margins

**Major Spacing**
- `xl`: `32px` - Large section separation, major layout gaps
- `2xl`: `48px` - Page margins, major component separation
- `3xl`: `64px` - Hero sections, dramatic spacing

### Grid System

**Column Structure**
- **Mobile**: 4 columns (320px-767px)
- **Tablet**: 8 columns (768px-1023px)
- **Desktop**: 12 columns (1024px-1439px)
- **Wide**: 16 columns (1440px+)

**Gutters**
- **Mobile**: `16px`
- **Tablet**: `20px`
- **Desktop**: `24px`
- **Wide**: `28px`

**Container Max Widths**
- **Mobile**: `100%` with 16px margins
- **Tablet**: `744px`
- **Desktop**: `1200px`
- **Wide**: `1400px`

### Breakpoints
```css
/* Mobile First Approach */
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Wide */ }
@media (min-width: 1920px) { /* Ultra Wide */ }
```

## Component Specifications

### Button Component

**Primary Button**
- **Height**: `44px` (mobile), `40px` (desktop)
- **Padding**: `12px 24px`
- **Border Radius**: `8px`
- **Typography**: Body text, Medium weight
- **Background**: Primary color with hover/active states
- **Transition**: `150ms ease-out`

**States**:
- **Default**: `#2563EB` background, white text
- **Hover**: `#1D4ED8` background, white text
- **Active**: `#1E40AF` background, white text
- **Focus**: `#2563EB` with `0 0 0 3px rgba(37, 99, 235, 0.1)` focus ring
- **Disabled**: `#9CA3AF` background, `#6B7280` text

### Card Component

**Knowledge Card**
- **Min Height**: `120px`
- **Max Height**: `400px` (scrollable content)
- **Width**: Flexible (200px-600px based on content)
- **Padding**: `16px`
- **Border Radius**: `12px`
- **Background**: `#FFFFFF`
- **Border**: `1px solid #E5E7EB`
- **Shadow**: `0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)`

**Card States**:
- **Default**: Standard appearance
- **Hover**: Lift effect with `0 10px 25px rgba(0, 0, 0, 0.1)` shadow
- **Selected**: `#2563EB` border, `#DBEAFE` background tint
- **Connected**: Animated pulse on connection creation
- **AI Processing**: Subtle shimmer animation

### Connection Visualization

**Connection Lines**
- **Thickness**: `2px` for confirmed, `1px` dashed for suggested
- **Color**: Gradient based on connection strength
- **Animation**: Subtle flow animation for active connections
- **Interaction**: Hover to highlight connected cards

## Motion & Animation System

### Timing Functions
```css
/* Ease Out - Entrances, expansions */
--ease-out: cubic-bezier(0.0, 0, 0.2, 1);

/* Ease In Out - Transitions, movements */
--ease-in-out: cubic-bezier(0.4, 0, 0.6, 1);

/* Spring - Interactive feedback */
--spring: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Duration Scale
- **Micro**: `100ms` - Hover effects, state changes
- **Short**: `200ms` - Button interactions, small transitions
- **Medium**: `400ms` - Card animations, modal appearances
- **Long**: `600ms` - Page transitions, complex animations

### Animation Principles

**Performance Targets**
- 60fps minimum for all animations
- Hardware acceleration using `transform` and `opacity`
- Respect `prefers-reduced-motion` user preferences

**Interaction Feedback**
- Immediate visual response (<16ms)
- Completion confirmation within 400ms
- Loading states for operations >2 seconds

## Platform Adaptations

### Web Platform Specifics
- **Hover States**: Full hover interaction support
- **Keyboard Navigation**: Complete tab order and shortcuts
- **Cursor Feedback**: Context-appropriate cursor changes
- **Scrolling**: Custom scrollbars for visual consistency

### Mobile Platform Specifics
- **Touch Targets**: Minimum 44x44px for all interactive elements
- **Swipe Gestures**: Card swipe-to-delete, pull-to-refresh
- **Haptic Feedback**: Subtle vibrations for key interactions
- **Safe Areas**: Respect device safe areas and notches

### iOS Adaptations
- **Status Bar**: Translucent background with content awareness
- **Navigation**: iOS-style back swipe support
- **Accessibility**: VoiceOver optimization and Dynamic Type support

### Android Adaptations
- **System UI**: Material Design elevation principles
- **Navigation**: Android back button behavior
- **Accessibility**: TalkBack optimization and system font scaling

## Implementation Notes

### Developer Handoff Guidelines
- All measurements provided in rem with px equivalents
- Component specifications include complete state definitions
- Animation timing uses CSS custom properties for consistency
- Responsive breakpoints defined using consistent units

### Performance Considerations
- SVG icons for scalability and performance
- Lazy loading for card content and images
- Virtualization for large canvas views with 1000+ cards
- Optimized animation using `transform` properties

### Quality Assurance Checklist
- [ ] Color contrast ratios verified for all combinations
- [ ] Typography scale maintains hierarchy across breakpoints
- [ ] Component states defined and visually distinct
- [ ] Animation performance tested on low-end devices
- [ ] Accessibility features verified with screen readers

## Related Documentation
- [Color System Details](./tokens/colors.md)
- [Typography Specifications](./tokens/typography.md)  
- [Component Library](./components/README.md)
- [Accessibility Guidelines](../accessibility/guidelines.md)

## Last Updated
**Change Log**:
- 2025-08-15: Initial comprehensive design system specification
- Version 1.0.0: Foundation design system established

---

This design system serves as the foundation for all Project Nexus interface development, ensuring consistent, accessible, and delightful user experiences across all platforms and features.