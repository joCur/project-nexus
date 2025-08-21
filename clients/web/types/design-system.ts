/**
 * Design System TypeScript Definitions
 * Type-safe access to Project Nexus design tokens
 * 
 * This file provides TypeScript interfaces and helper functions for
 * accessing design tokens in a type-safe manner throughout the application.
 */

// Base design token interfaces
export interface ColorTokens {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

export interface SemanticColors {
  'canvas-base': string;
  'card-background': string;
  'text-primary': string;
  'text-secondary': string;
  'text-tertiary': string;
  'border-default': string;
  'border-focus': string;
  'ai-primary': string;
  'ai-light': string;
  'connection-strong': string;
  'connection-medium': string;
  'connection-weak': string;
  'ai-gradient-start': string;
  'ai-gradient-end': string;
}

export interface TypographyTokens {
  fontFamilies: {
    primary: string;
    mono: string;
  };
  fontWeights: {
    light: number;
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  fontSizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };
  lineHeights: {
    none: number;
    tight: number;
    snug: number;
    normal: number;
    relaxed: number;
    loose: number;
  };
  letterSpacing: {
    tighter: string;
    tight: string;
    normal: string;
    wide: string;
    wider: string;
    widest: string;
  };
}

export interface SpacingTokens {
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
  7: string;
  8: string;
  10: string;
  12: string;
  16: string;
  20: string;
  24: string;
  32: string;
  40: string;
  48: string;
  56: string;
  64: string;
}

export interface AnimationTokens {
  durations: {
    fast: string;
    normal: string;
    slow: string;
  };
  easings: {
    linear: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
  };
}

// Canvas-specific interfaces
export interface CanvasCardSizing {
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;
  defaultWidth: string;
  defaultHeight: string;
}

export interface CanvasConnections {
  strokeWidth: {
    thin: string;
    medium: string;
    thick: string;
  };
  dashPattern: {
    solid: string;
    dashed: string;
    dotted: string;
  };
}

export interface CanvasZoom {
  min: number;
  max: number;
  default: number;
  step: number;
}

export interface CanvasTokens {
  cardSizing: CanvasCardSizing;
  connections: CanvasConnections;
  zoom: CanvasZoom;
}

// AI-specific interfaces
export interface AIConfidence {
  high: number;
  medium: number;
  low: number;
}

export interface AIColors {
  primary: string;
  light: string;
  gradient: {
    start: string;
    end: string;
  };
}

export interface AITokens {
  confidence: AIConfidence;
  processingDuration: string;
  colors: AIColors;
}

// Component-specific interfaces
export interface ButtonTokens {
  height: {
    small: string;
    medium: string;
    large: string;
  };
  padding: {
    small: string;
    medium: string;
    large: string;
  };
  borderRadius: string;
  fontWeight: number;
}

export interface CardTokens {
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;
  defaultWidth: string;
  defaultHeight: string;
  borderRadius: string;
  padding: string;
  shadow: string;
}

export interface ComponentTokens {
  button: ButtonTokens;
  card: CardTokens;
  input: {
    height: string;
    padding: string;
    borderRadius: string;
    borderWidth: string;
    fontSize: string;
  };
  modal: {
    maxWidth: string;
    borderRadius: string;
    padding: string;
    shadow: string;
  };
}

// Accessibility interfaces
export interface AccessibilityTokens {
  focusRingWidth: string;
  focusRingOffset: string;
  focusRingColor: string;
  minTouchTarget: string;
  minContrastRatio: number;
  largeTextContrastRatio: number;
}

// Main design tokens interface
export interface DesignTokens {
  meta: {
    version: string;
    lastUpdated: string;
    description: string;
  };
  colors: {
    primary: ColorTokens;
    secondary: ColorTokens;
    success: ColorTokens;
    warning: ColorTokens;
    error: ColorTokens;
    info: ColorTokens;
    neutral: ColorTokens;
    semantic: SemanticColors;
  };
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borderRadius: {
    none: string;
    sm: string;
    default: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    full: string;
  };
  shadows: {
    none: string;
    sm: string;
    default: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    inner: string;
  };
  transitions: {
    none: string;
    all: string;
    default: string;
    fast: string;
    slow: string;
  };
  breakpoints: {
    mobile: string;
    mobileLarge: string;
    tablet: string;
    desktop: string;
    desktopLarge: string;
    wide: string;
  };
  zIndex: {
    0: string;
    10: string;
    20: string;
    30: string;
    40: string;
    50: string;
    auto: string;
  };
  animation: AnimationTokens;
  components: ComponentTokens;
  canvas: CanvasTokens;
  ai: AITokens;
  accessibility: AccessibilityTokens;
}

// Canvas animation configuration types
export interface CanvasAnimationConfig {
  duration: string;
  easing: string;
  delay?: string;
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
}

export interface CanvasCardAnimations {
  enter: CanvasAnimationConfig;
  exit: CanvasAnimationConfig;
  hover: CanvasAnimationConfig;
}

export interface CanvasConnectionAnimations {
  draw: CanvasAnimationConfig;
  flow: CanvasAnimationConfig;
  pulse: CanvasAnimationConfig;
}

export interface CanvasAIAnimations {
  pulse: CanvasAnimationConfig;
  processing: CanvasAnimationConfig;
  thinking: CanvasAnimationConfig;
}

export interface CanvasNavigationAnimations {
  zoom: CanvasAnimationConfig;
  pan: CanvasAnimationConfig;
  focus: CanvasAnimationConfig;
}

export interface CanvasAnimations {
  card: CanvasCardAnimations;
  connection: CanvasConnectionAnimations;
  ai: CanvasAIAnimations;
  navigation: CanvasNavigationAnimations;
}

// Helper type for CSS custom properties
export type CSSCustomProperty = `--${string}`;

// Helper functions for type-safe token access
export class DesignSystemHelper {
  private tokens: DesignTokens;

  constructor(tokens: DesignTokens) {
    this.tokens = tokens;
  }

  // Color helpers
  getColor(colorName: keyof DesignTokens['colors'], shade: string): string {
    const colorGroup = this.tokens.colors[colorName];
    if (typeof colorGroup === 'object' && shade in colorGroup) {
      return (colorGroup as any)[shade];
    }
    return '';
  }

  getSemanticColor(colorName: keyof SemanticColors): string {
    return this.tokens.colors.semantic[colorName];
  }

  // Spacing helpers
  getSpacing(size: keyof SpacingTokens): string {
    return this.tokens.spacing[size];
  }

  // Typography helpers
  getFontSize(size: keyof TypographyTokens['fontSizes']): string {
    return this.tokens.typography.fontSizes[size];
  }

  getFontWeight(weight: keyof TypographyTokens['fontWeights']): number {
    return this.tokens.typography.fontWeights[weight];
  }

  // Component helpers
  getButtonHeight(size: keyof ButtonTokens['height']): string {
    return this.tokens.components.button.height[size];
  }

  getCardSize(dimension: keyof CardTokens): string {
    return this.tokens.components.card[dimension];
  }

  // Canvas helpers
  getCanvasCardSize(dimension: keyof CanvasCardSizing): string {
    return this.tokens.canvas.cardSizing[dimension];
  }

  getCanvasZoom(property: keyof CanvasZoom): number | string {
    return this.tokens.canvas.zoom[property];
  }

  getConnectionStroke(width: keyof CanvasConnections['strokeWidth']): string {
    return this.tokens.canvas.connections.strokeWidth[width];
  }

  getConnectionDash(pattern: keyof CanvasConnections['dashPattern']): string {
    return this.tokens.canvas.connections.dashPattern[pattern];
  }

  // AI helpers
  getAIConfidence(level: keyof AIConfidence): number {
    return this.tokens.ai.confidence[level];
  }

  getAIColor(color: keyof AIColors): string {
    if (color === 'gradient') {
      return `linear-gradient(135deg, ${this.tokens.ai.colors.gradient.start}, ${this.tokens.ai.colors.gradient.end})`;
    }
    return this.tokens.ai.colors[color];
  }

  getAIProcessingDuration(): string {
    return this.tokens.ai.processingDuration;
  }

  // Animation helpers
  getAnimationDuration(speed: keyof AnimationTokens['durations']): string {
    return this.tokens.animation.durations[speed];
  }

  getAnimationEasing(easing: keyof AnimationTokens['easings']): string {
    return this.tokens.animation.easings[easing];
  }

  // Accessibility helpers
  getFocusRingStyles(): { width: string; offset: string; color: string } {
    return {
      width: this.tokens.accessibility.focusRingWidth,
      offset: this.tokens.accessibility.focusRingOffset,
      color: this.tokens.accessibility.focusRingColor,
    };
  }

  getMinTouchTarget(): string {
    return this.tokens.accessibility.minTouchTarget;
  }

  // CSS custom property generators
  getCSSCustomProperty(path: string): CSSCustomProperty {
    return `--${path.replace(/\./g, '-')}` as CSSCustomProperty;
  }

  // Responsive helpers
  isBreakpoint(width: number, breakpoint: keyof DesignTokens['breakpoints']): boolean {
    const breakpointValue = parseInt(this.tokens.breakpoints[breakpoint].replace('px', ''));
    return width >= breakpointValue;
  }

  // Theme validation helpers
  validateColorContrast(foreground: string, background: string): boolean {
    // This would integrate with a color contrast calculation library
    // For now, return true as a placeholder
    return true;
  }

  // Canvas-specific generators
  generateCanvasGridCSS(): string {
    const gridSize = 'var(--canvas-grid-size, 20px)';
    const gridColor = 'var(--canvas-grid-color, rgba(0, 0, 0, 0.1))';
    const majorColor = 'var(--canvas-grid-major-color, rgba(0, 0, 0, 0.2))';
    
    return `
      background-image: 
        linear-gradient(${gridColor} 1px, transparent 1px),
        linear-gradient(90deg, ${gridColor} 1px, transparent 1px),
        linear-gradient(${majorColor} 1px, transparent 1px),
        linear-gradient(90deg, ${majorColor} 1px, transparent 1px);
      background-size: 
        ${gridSize} ${gridSize},
        ${gridSize} ${gridSize},
        calc(${gridSize} * 5) calc(${gridSize} * 5),
        calc(${gridSize} * 5) calc(${gridSize} * 5);
    `;
  }

  generateConnectionCSS(strength: 'strong' | 'medium' | 'weak', style: 'solid' | 'dashed' | 'dotted' = 'solid'): string {
    const strokeWidth = this.getConnectionStroke(strength === 'strong' ? 'thick' : strength === 'medium' ? 'medium' : 'thin');
    const dashPattern = this.getConnectionDash(style);
    const color = this.getSemanticColor(`connection-${strength}` as keyof SemanticColors);
    
    return `
      stroke-width: ${strokeWidth};
      stroke: ${color};
      stroke-dasharray: ${dashPattern};
      fill: none;
    `;
  }
}

// Default export for easy importing
export default DesignSystemHelper;