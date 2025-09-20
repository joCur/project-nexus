---
title: Button Component Specifications
description: Complete button component system with variants, states, and implementation guidelines
last-updated: 2025-08-15
version: 1.0.0
related-files:
  - ../style-guide.md
  - ../tokens/colors.md
  - ../../accessibility/guidelines.md
status: approved
---

# Button Components

## Overview
Buttons are the primary action triggers throughout Project Nexus, designed to provide clear visual hierarchy, immediate feedback, and accessible interaction patterns for all users.

## Design Philosophy
- **Clear Hierarchy**: Visual weight indicates action importance
- **Immediate Feedback**: Hover and pressed states provide instant response
- **Accessible by Default**: All buttons meet WCAG 2.1 AA requirements
- **Context Awareness**: Button appearance adapts to surrounding content

## Button Variants

### Primary Button
**Purpose**: Most important actions, call-to-action elements
**Usage**: Save changes, submit forms, primary navigation actions

**Visual Specifications**:
- **Background**: Primary color (`#2563EB`)
- **Text Color**: White (`#FFFFFF`)
- **Border**: None
- **Border Radius**: `8px`
- **Font Weight**: Medium (500)
- **Shadow**: `0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)`

**States**:
```css
/* Primary Button States */
.button-primary {
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: 8px;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: all 150ms ease-out;
}

.button-primary:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}

.button-primary:active {
  background-color: var(--color-primary-dark);
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.button-primary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.button-primary:disabled {
  background-color: var(--color-neutral-300);
  color: var(--color-neutral-500);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
```

### Secondary Button
**Purpose**: Supporting actions, alternative choices
**Usage**: Cancel operations, secondary navigation, less critical actions

**Visual Specifications**:
- **Background**: White (`#FFFFFF`)
- **Text Color**: Primary color (`#2563EB`)
- **Border**: `1px solid` Primary color (`#2563EB`)
- **Border Radius**: `8px`
- **Font Weight**: Medium (500)

**States**:
```css
/* Secondary Button States */
.button-secondary {
  background-color: var(--color-white);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  font-weight: 500;
  transition: all 150ms ease-out;
}

.button-secondary:hover {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary-dark);
  color: var(--color-primary-dark);
}

.button-secondary:active {
  background-color: var(--color-primary-light);
  transform: translateY(1px);
}

.button-secondary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.button-secondary:disabled {
  background-color: var(--color-neutral-50);
  color: var(--color-neutral-400);
  border-color: var(--color-neutral-300);
  cursor: not-allowed;
}
```

### Tertiary Button
**Purpose**: Subtle actions, inline actions, menu items
**Usage**: Edit links, show more/less, optional actions

**Visual Specifications**:
- **Background**: Transparent
- **Text Color**: Neutral 700 (`#374151`)
- **Border**: None
- **Border Radius**: `6px`
- **Font Weight**: Medium (500)

**States**:
```css
/* Tertiary Button States */
.button-tertiary {
  background-color: transparent;
  color: var(--color-neutral-700);
  border: none;
  border-radius: 6px;
  font-weight: 500;
  transition: all 150ms ease-out;
}

.button-tertiary:hover {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-900);
}

.button-tertiary:active {
  background-color: var(--color-neutral-200);
}

.button-tertiary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.button-tertiary:disabled {
  color: var(--color-neutral-400);
  cursor: not-allowed;
}
```

### Ghost Button
**Purpose**: Minimal visual weight, overlay actions
**Usage**: Close buttons, toolbar actions, floating actions

**Visual Specifications**:
- **Background**: Transparent
- **Text Color**: Neutral 500 (`#6B7280`)
- **Border**: `1px solid` Neutral 300 (`#D1D5DB`)
- **Border Radius**: `6px`
- **Font Weight**: Regular (400)

**States**:
```css
/* Ghost Button States */
.button-ghost {
  background-color: transparent;
  color: var(--color-neutral-500);
  border: 1px solid var(--color-neutral-300);
  border-radius: 6px;
  font-weight: 400;
  transition: all 150ms ease-out;
}

.button-ghost:hover {
  background-color: var(--color-white);
  color: var(--color-neutral-700);
  border-color: var(--color-neutral-400);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.button-ghost:active {
  background-color: var(--color-neutral-50);
}

.button-ghost:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.button-ghost:disabled {
  color: var(--color-neutral-300);
  border-color: var(--color-neutral-200);
  cursor: not-allowed;
}
```

## Button Sizes

### Large Button (Desktop Primary Actions)
**Dimensions**: Height 48px
**Padding**: `14px 28px`
**Font Size**: `1rem` (16px)
**Line Height**: `1.5rem` (24px)
**Usage**: Primary CTAs, form submissions, major actions

### Medium Button (Standard Actions)
**Dimensions**: Height 40px
**Padding**: `10px 20px`
**Font Size**: `0.875rem` (14px)  
**Line Height**: `1.25rem` (20px)
**Usage**: Most interface buttons, toolbar actions

### Small Button (Compact Interfaces)
**Dimensions**: Height 32px
**Padding**: `6px 16px`
**Font Size**: `0.75rem` (12px)
**Line Height**: `1rem` (16px)
**Usage**: Table actions, compact forms, secondary actions

### Mobile Touch Targets
**Minimum Size**: 44x44px (iOS and Android standards)
**Padding**: Adjusted to meet minimum touch target requirements
**Spacing**: Minimum 8px between adjacent touch targets

```css
/* Responsive button sizing */
.button-large {
  height: 48px;
  padding: 14px 28px;
  font-size: 1rem;
  line-height: 1.5rem;
}

.button-medium {
  height: 40px;
  padding: 10px 20px;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.button-small {
  height: 32px;
  padding: 6px 16px;
  font-size: 0.75rem;
  line-height: 1rem;
}

/* Mobile touch target compliance */
@media (max-width: 767px) {
  .button-small {
    height: 44px;
    padding: 12px 16px;
  }
  
  .button-medium {
    height: 44px;
    padding: 12px 20px;
  }
}
```

## Specialized Button Types

### Icon Button
**Purpose**: Actions represented by icons without text
**Usage**: Close buttons, edit actions, toolbar controls

**Visual Specifications**:
- **Size**: 40x40px (desktop), 44x44px (mobile)
- **Icon Size**: 20px (desktop), 24px (mobile)
- **Background**: Transparent with hover state
- **Border Radius**: `6px`

```css
.button-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-neutral-500);
  transition: all 150ms ease-out;
}

.button-icon:hover {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-700);
}

.button-icon:active {
  background-color: var(--color-neutral-200);
}

/* Mobile touch target compliance */
@media (max-width: 767px) {
  .button-icon {
    width: 44px;
    height: 44px;
  }
}
```

### Button with Icon
**Purpose**: Text buttons enhanced with descriptive icons
**Usage**: Actions that benefit from visual reinforcement

**Layout Options**:
- **Icon Left**: Icon preceding text (most common)
- **Icon Right**: Icon following text (for directional actions)
- **Icon Only**: Text hidden on small screens

```css
.button-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.button-with-icon .icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Responsive icon hiding */
@media (max-width: 480px) {
  .button-with-icon .button-text {
    display: none;
  }
  
  .button-with-icon {
    width: 44px;
    height: 44px;
    justify-content: center;
    padding: 0;
  }
}
```

### Loading Button
**Purpose**: Indicate processing state for async operations
**Behavior**: Disabled with loading indicator

```css
.button-loading {
  position: relative;
  color: transparent;
  cursor: not-allowed;
}

.button-loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: button-spinner 0.8s linear infinite;
}

@keyframes button-spinner {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
```

## Semantic Button Variants

### Success Button
**Purpose**: Confirmation actions, positive outcomes
**Usage**: Confirm operations, approve actions, successful states

```css
.button-success {
  background-color: var(--color-success);
  color: var(--color-white);
}

.button-success:hover {
  background-color: var(--color-success-dark);
}
```

### Warning Button
**Purpose**: Caution actions, potentially risky operations
**Usage**: Actions requiring user attention or confirmation

```css
.button-warning {
  background-color: var(--color-warning);
  color: var(--color-white);
}

.button-warning:hover {
  background-color: var(--color-warning-dark);
}
```

### Error/Danger Button
**Purpose**: Destructive actions, error states
**Usage**: Delete operations, remove actions, error recovery

```css
.button-danger {
  background-color: var(--color-error);
  color: var(--color-white);
}

.button-danger:hover {
  background-color: var(--color-error-dark);
}
```

## Accessibility Specifications

### ARIA Implementation
```html
<!-- Standard button with proper ARIA -->
<button 
  type="button"
  aria-label="Save changes to document"
  aria-describedby="save-help-text">
  Save Changes
</button>

<!-- Icon button with accessible name -->
<button 
  type="button"
  aria-label="Close dialog"
  class="button-icon">
  <svg aria-hidden="true" focusable="false">
    <!-- Close icon SVG -->
  </svg>
</button>

<!-- Loading button with dynamic state -->
<button 
  type="submit"
  aria-label="Saving changes..."
  aria-disabled="true"
  class="button-primary button-loading">
  Save Changes
</button>

<!-- Toggle button with pressed state -->
<button 
  type="button"
  aria-label="Toggle AI connections"
  aria-pressed="true"
  class="button-secondary">
  AI Connections: On
</button>
```

### Keyboard Navigation
- **Tab**: Focus moves to button
- **Enter/Space**: Activate button action
- **Escape**: Cancel action if in modal context
- **Arrow Keys**: Navigate between button groups (radio-like behavior)

### Screen Reader Support
- **Button Purpose**: Clear, descriptive button text or aria-label
- **State Communication**: Loading, disabled, and pressed states announced
- **Context Information**: Relationship to surrounding content communicated
- **Action Results**: Results of button actions announced appropriately

### Focus Management
```css
/* High contrast focus indicators */
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Windows High Contrast Mode support */
@media (prefers-contrast: high) {
  .button {
    border: 1px solid ButtonText;
  }
  
  .button:focus {
    outline: 2px solid Highlight;
  }
}
```

## Responsive Behavior

### Breakpoint Adaptations
**Mobile (320px-767px)**:
- Minimum 44x44px touch targets
- Increased padding for easier tapping
- Stack buttons vertically when space constrained
- Consider full-width buttons for primary actions

**Tablet (768px-1023px)**:
- Balanced sizing for touch and pointer interaction
- Maintain hover states for trackpad/mouse users
- Flexible button grouping based on available space

**Desktop (1024px+)**:
- Full hover and focus state support
- Optimal sizing for mouse interaction
- Keyboard shortcuts support
- Context menu integration where appropriate

```css
/* Responsive button behavior */
@media (max-width: 767px) {
  .button-group {
    flex-direction: column;
    gap: 12px;
  }
  
  .button-group .button {
    width: 100%;
    justify-content: center;
  }
}

@media (min-width: 768px) {
  .button-group {
    flex-direction: row;
    gap: 16px;
  }
  
  .button-group .button {
    width: auto;
  }
}
```

## Button Groups and Layouts

### Horizontal Button Groups
**Usage**: Related actions, form actions, toolbar buttons

```css
.button-group-horizontal {
  display: flex;
  gap: 12px;
  align-items: center;
}

.button-group-horizontal .button {
  flex: 0 0 auto;
}

/* Connected button group (no gap) */
.button-group-connected .button:not(:first-child) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  margin-left: -1px;
}

.button-group-connected .button:not(:last-child) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
```

### Vertical Button Groups
**Usage**: Sidebar actions, menu-like button collections

```css
.button-group-vertical {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}

.button-group-vertical .button {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
}
```

### Split Buttons
**Usage**: Primary action with dropdown of related actions

```html
<div class="button-split">
  <button class="button-primary">Save</button>
  <button class="button-primary button-split-trigger" aria-haspopup="menu" aria-expanded="false">
    <svg class="icon" aria-hidden="true"><!-- Dropdown arrow --></svg>
  </button>
</div>
```

## Implementation Guidelines

### React Implementation
```typescript
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  className,
  ...ariaProps
}) => {
  const baseClasses = 'button';
  const variantClass = `button-${variant}`;
  const sizeClass = `button-${size}`;
  const loadingClass = loading ? 'button-loading' : '';
  
  const classes = [baseClasses, variantClass, sizeClass, loadingClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...ariaProps}
    >
      {children}
    </button>
  );
};
```

### Flutter Implementation
```dart
class NexusButton extends StatelessWidget {
  const NexusButton({
    Key? key,
    required this.onPressed,
    required this.child,
    this.variant = ButtonVariant.primary,
    this.size = ButtonSize.medium,
    this.loading = false,
  }) : super(key: key);

  final VoidCallback? onPressed;
  final Widget child;
  final ButtonVariant variant;
  final ButtonSize size;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: loading ? null : onPressed,
      style: _getButtonStyle(context),
      child: loading 
        ? const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : child,
    );
  }

  ButtonStyle _getButtonStyle(BuildContext context) {
    return ElevatedButton.styleFrom(
      backgroundColor: _getBackgroundColor(),
      foregroundColor: _getTextColor(),
      padding: _getPadding(),
      minimumSize: Size(_getMinWidth(), _getHeight()),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
      ),
    );
  }
}
```

## Usage Guidelines

### Do's and Don'ts

**Do:**
- Use consistent button hierarchy throughout the interface
- Provide immediate visual feedback for user interactions
- Include loading states for async operations
- Use descriptive button text that clearly indicates action
- Ensure buttons meet accessibility requirements
- Group related buttons logically
- Use semantic colors for success, warning, and error actions

**Don't:**
- Use more than one primary button per screen section
- Make buttons too small for touch interaction
- Use color alone to convey button state or importance
- Create buttons without clear focus indicators
- Stack too many buttons vertically without clear hierarchy
- Use generic button text like "Click here" or "Button"

### Best Practices
1. **Button Hierarchy**: Use visual weight to indicate action importance
2. **Consistent Placement**: Follow platform conventions for button placement
3. **Clear Labeling**: Use action verbs that describe what will happen
4. **Appropriate Sizing**: Size buttons for their context and importance
5. **Loading States**: Always provide feedback for operations that take time
6. **Error Prevention**: Use confirmation dialogs for destructive actions

## Testing Guidelines

### Visual Testing
- [ ] All button variants render correctly across supported browsers
- [ ] Hover states work consistently on pointer devices
- [ ] Focus indicators are visible and meet contrast requirements
- [ ] Loading animations are smooth and performant
- [ ] Button text doesn't wrap inappropriately

### Interaction Testing
- [ ] Buttons respond correctly to click and tap events
- [ ] Keyboard navigation works for all button types
- [ ] Touch targets meet minimum size requirements on mobile
- [ ] Disabled states prevent interaction appropriately
- [ ] Loading states disable interaction during processing

### Accessibility Testing
- [ ] Screen readers announce button purpose and state correctly
- [ ] Keyboard navigation reaches all buttons in logical order
- [ ] High contrast mode maintains button visibility
- [ ] Button groups are navigable with arrow keys where appropriate
- [ ] ARIA attributes provide appropriate context

## Related Documentation
- [Design System Colors](../tokens/colors.md)
- [Typography System](../tokens/typography.md)
- [Form Components](./forms.md)
- [Accessibility Guidelines](../../accessibility/guidelines.md)

## Last Updated
**Change Log**:
- 2025-08-15: Initial comprehensive button component specification
- Version 1.0.0: Complete button system with all variants, states, and accessibility requirements