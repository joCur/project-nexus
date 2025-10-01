/**
 * Edit Mode Animation Variants
 *
 * Framer Motion animation configurations for inline editing experience.
 * These animations provide smooth, professional transitions that enhance
 * the user experience without being intrusive.
 *
 * Design Principles:
 * - Subtle animations (0.15-0.2s duration)
 * - Smooth easing functions
 * - Clear visual feedback
 * - Non-blocking interactions
 */

import type { Transition } from 'framer-motion';

/**
 * Standard transition configuration for all edit animations
 */
export const editTransitionConfig: Transition = {
  duration: 0.15,
  ease: 'easeInOut'
};

/**
 * Overlay fade-in/fade-out animation
 * Creates smooth entrance and exit for the edit overlay
 */
export const overlayVariants = {
  initial: {
    opacity: 0,
    scale: 0.95
  },
  animate: {
    opacity: 1,
    scale: 1
  },
  exit: {
    opacity: 0,
    scale: 0.95
  }
} as const;

/**
 * Card highlight pulse animation
 * Subtle indication that a card is in edit mode
 */
export const cardHighlightVariants = {
  initial: {
    boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)'
  },
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(59, 130, 246, 0)',
      '0 0 0 4px rgba(59, 130, 246, 0.3)',
      '0 0 0 0 rgba(59, 130, 246, 0)'
    ]
  }
} as const;

/**
 * Success checkmark animation
 * Triumphant feedback for successful save
 */
export const successVariants = {
  initial: {
    scale: 0,
    opacity: 0
  },
  animate: {
    scale: [0, 1.2, 1],
    opacity: [0, 1, 1],
    transition: {
      duration: 0.3,
      times: [0, 0.6, 1],
      ease: 'easeOut'
    }
  }
} as const;

/**
 * Error shake animation
 * Clear indication of save failure
 */
export const errorShakeVariants = {
  initial: {
    x: 0
  },
  animate: {
    x: [-10, 10, -10, 10, 0],
    transition: {
      duration: 0.4,
      times: [0, 0.25, 0.5, 0.75, 1]
    }
  }
} as const;

/**
 * Loading spinner rotation animation
 * Continuous spin for loading indicator
 */
export const loadingSpinnerVariants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear'
    }
  }
} as const;

/**
 * Pulse animation for status indicators
 * Gentle pulsing for "in progress" states
 */
export const pulseVariants = {
  animate: {
    opacity: [1, 0.5, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
} as const;

/**
 * Backdrop fade animation
 * Smooth backdrop appearance/disappearance
 */
export const backdropVariants = {
  initial: {
    opacity: 0
  },
  animate: {
    opacity: 1
  },
  exit: {
    opacity: 0
  }
} as const;

/**
 * Editor content slide-in animation
 * Smooth entrance for editor panel
 */
export const editorContentVariants = {
  initial: {
    y: 20,
    opacity: 0
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      delay: 0.05,
      duration: 0.2,
      ease: 'easeOut'
    }
  },
  exit: {
    y: 20,
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: 'easeIn'
    }
  }
} as const;

/**
 * Stagger animation for multiple elements
 * Creates cascading entrance effect
 */
export const staggerContainerVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05
    }
  }
} as const;

/**
 * Individual item for stagger animation
 */
export const staggerItemVariants = {
  initial: {
    opacity: 0,
    y: 10
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2
    }
  }
} as const;

/**
 * Helper function to create custom transition configs
 */
export function createTransition(
  duration: number = 0.15,
  ease: any = 'easeInOut',
  delay: number = 0
): Transition {
  return {
    duration,
    ease,
    ...(delay > 0 && { delay })
  };
}

/**
 * Helper function to create scale-based animations
 */
export function createScaleAnimation(
  fromScale: number = 0.95,
  toScale: number = 1,
  duration: number = 0.15
) {
  return {
    initial: { scale: fromScale, opacity: 0 },
    animate: { scale: toScale, opacity: 1 },
    exit: { scale: fromScale, opacity: 0 },
    transition: createTransition(duration)
  };
}

/**
 * Helper function to create fade animations
 */
export function createFadeAnimation(
  duration: number = 0.15,
  delay: number = 0
) {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: createTransition(duration, 'easeInOut', delay)
  };
}

/**
 * Animation presets for common use cases
 */
export const animationPresets = {
  /** Quick fade for subtle elements */
  quickFade: createFadeAnimation(0.1),
  /** Standard fade for normal elements */
  fade: createFadeAnimation(0.15),
  /** Delayed fade for cascading effects */
  delayedFade: createFadeAnimation(0.15, 0.05),
  /** Scale with fade for emphasis */
  scaleIn: createScaleAnimation(0.95, 1, 0.15),
  /** Large scale for dramatic effect */
  scaleInLarge: createScaleAnimation(0.8, 1, 0.2),
} as const;

/**
 * Type exports for animation variants
 */
export type OverlayVariants = typeof overlayVariants;
export type CardHighlightVariants = typeof cardHighlightVariants;
export type SuccessVariants = typeof successVariants;
export type ErrorShakeVariants = typeof errorShakeVariants;
export type LoadingSpinnerVariants = typeof loadingSpinnerVariants;
export type PulseVariants = typeof pulseVariants;
export type BackdropVariants = typeof backdropVariants;
export type EditorContentVariants = typeof editorContentVariants;
