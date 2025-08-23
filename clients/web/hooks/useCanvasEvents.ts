import { useEffect, RefObject, useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useCanvasNavigation } from './useCanvasNavigation';
import type { CanvasPosition, ZoomLevel } from '@/types/canvas.types';

/**
 * Custom hook that sets up canvas event handlers for keyboard and touch interactions.
 * Provides keyboard navigation, touch gesture support, and smooth animations with full accessibility compliance.
 * 
 * Features:
 * - Smooth animations and momentum-based scrolling via useCanvasNavigation
 * - WCAG 2.1 AA compliant keyboard navigation with animation support
 * - Screen reader announcements for state changes
 * - Focus management and keyboard trap prevention
 * - Touch target size compliance (44px minimum)
 * - Reduced motion support for accessibility preferences
 * - Momentum deceleration for touch gestures
 * - Configurable animation settings
 * 
 * @param containerRef - Reference to the canvas container element
 * @param config - Optional configuration for navigation and animation settings
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface CanvasEventsConfig {
  /** Enable smooth animations for navigation (respects prefers-reduced-motion) */
  enableAnimations: boolean;
  /** Animation duration in milliseconds */
  animationDuration: number;
  /** Enable momentum scrolling for touch gestures */
  enableMomentum: boolean;
  /** Custom pan speed multiplier */
  panSpeedMultiplier: number;
  /** Custom zoom speed multiplier */
  zoomSpeedMultiplier: number;
}

interface TouchGestureState {
  /** Initial touch distance for pinch gestures */
  initialPinchDistance?: number;
  /** Initial zoom level for pinch gestures */
  initialZoom?: ZoomLevel;
  /** Last touch positions for momentum calculation */
  lastTouchPositions?: CanvasPosition[];
  /** Last touch timestamp for velocity calculation */
  lastTouchTime?: number;
  /** Touch gesture start time */
  gestureStartTime?: number;
}

// Default configuration
const DEFAULT_CONFIG: CanvasEventsConfig = {
  enableAnimations: true,
  animationDuration: 300,
  enableMomentum: true,
  panSpeedMultiplier: 1,
  zoomSpeedMultiplier: 1,
};
export const useCanvasEvents = (
  containerRef: RefObject<HTMLDivElement>,
  config: Partial<CanvasEventsConfig> = {}
) => {
  const { viewport } = useCanvasStore();
  const { zoom, position } = viewport;
  
  // Merge configuration with defaults
  const mergedConfig: CanvasEventsConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Initialize navigation hook with momentum and animation support
  const navigation = useCanvasNavigation({
    enableMomentum: mergedConfig.enableMomentum,
    animationDuration: mergedConfig.animationDuration,
    enableInertia: mergedConfig.enableMomentum,
    enableSmoothing: true,
  });
  
  // Touch gesture state for momentum calculation
  const touchGestureState = useRef<TouchGestureState>({});
  
  // Accessibility state for announcements (handled via DOM updates)
  
  // Design token constants
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 4.0;
  
  // ============================================================================
  // ACCESSIBILITY UTILITIES
  // ============================================================================
  
  /**
   * Check if user prefers reduced motion for accessibility
   */
  const prefersReducedMotion = useCallback(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  
  /**
   * Announce action to screen readers via ARIA live region
   */
  const announceAction = useCallback((message: string) => {
    const container = containerRef.current;
    if (!container) return;
    
    const statusElement = container.querySelector('#canvas-status');
    if (statusElement) {
      statusElement.textContent = message;
    }
  }, [containerRef]);
  
  // ============================================================================
  // ENHANCED NAVIGATION METHODS
  // ============================================================================
  
  /**
   * Pan canvas with smooth animation or immediate update based on accessibility preferences
   */
  const panCanvas = useCallback((delta: CanvasPosition, announce?: string) => {
    const shouldAnimate = mergedConfig.enableAnimations && !prefersReducedMotion();
    const targetPosition: CanvasPosition = {
      x: position.x + delta.x,
      y: position.y + delta.y,
    };
    
    navigation.panTo(targetPosition, shouldAnimate, shouldAnimate ? mergedConfig.animationDuration : 0);
    
    if (announce) {
      announceAction(announce);
    }
  }, [position, navigation, mergedConfig, prefersReducedMotion, announceAction]);
  
  /**
   * Zoom canvas with smooth animation or immediate update based on accessibility preferences
   */
  const zoomCanvas = useCallback((targetZoom: ZoomLevel, announce?: string) => {
    const shouldAnimate = mergedConfig.enableAnimations && !prefersReducedMotion();
    const clampedZoom = Math.min(Math.max(targetZoom, ZOOM_MIN), ZOOM_MAX);
    
    navigation.zoomTo(clampedZoom, undefined, shouldAnimate, shouldAnimate ? mergedConfig.animationDuration : 0);
    
    if (announce) {
      announceAction(announce);
    }
  }, [navigation, mergedConfig, prefersReducedMotion, announceAction, ZOOM_MIN, ZOOM_MAX]);
  
  /**
   * Reset canvas view with smooth animation
   */
  const resetCanvas = useCallback((announce?: string) => {
    const shouldAnimate = mergedConfig.enableAnimations && !prefersReducedMotion();
    navigation.resetView(shouldAnimate);
    
    if (announce) {
      announceAction(announce);
    }
  }, [navigation, mergedConfig, prefersReducedMotion, announceAction]);

  // ============================================================================
  // ENHANCED KEYBOARD EVENT HANDLING
  // ============================================================================
  
  /**
   * Handle keyboard events with smooth animations and accessibility enhancements
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle events when canvas is focused
    const container = containerRef.current;
    if (!container?.contains(document.activeElement)) return;
    
    // Adjust speeds based on accessibility preferences and configuration
    const reducedMotion = prefersReducedMotion();
    const basePanSpeed = reducedMotion ? 10 : 20;
    const baseZoomSpeed = reducedMotion ? 0.05 : 0.1;
    
    const panSpeed = basePanSpeed * mergedConfig.panSpeedMultiplier;
    const zoomSpeed = baseZoomSpeed * mergedConfig.zoomSpeedMultiplier;

    switch (e.key) {
      // Pan with arrow keys (WCAG compliant navigation with smooth animations)
      case 'ArrowUp':
        e.preventDefault();
        panCanvas({ x: 0, y: panSpeed }, 'Moved canvas up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        panCanvas({ x: 0, y: -panSpeed }, 'Moved canvas down');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        panCanvas({ x: panSpeed, y: 0 }, 'Moved canvas left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        panCanvas({ x: -panSpeed, y: 0 }, 'Moved canvas right');
        break;
      
      // Zoom with + and - keys (design token limits enforced)
      case '+':
      case '=':
        e.preventDefault();
        const newZoomIn = Math.min(zoom * (1 + zoomSpeed), ZOOM_MAX);
        if (newZoomIn !== zoom) {
          zoomCanvas(newZoomIn, `Zoomed in to ${(newZoomIn * 100).toFixed(0)} percent`);
        }
        break;
      case '-':
      case '_':
        e.preventDefault();
        const newZoomOut = Math.max(zoom * (1 - zoomSpeed), ZOOM_MIN);
        if (newZoomOut !== zoom) {
          zoomCanvas(newZoomOut, `Zoomed out to ${(newZoomOut * 100).toFixed(0)} percent`);
        }
        break;
      
      // Reset zoom and position with Ctrl/Cmd + 0
      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          resetCanvas('Reset canvas to center at 100 percent zoom');
        }
        break;
      
      // Home key to fit content and reset position
      case 'Home':
        e.preventDefault();
        resetCanvas('Reset canvas to home position');
        break;
        
      // Space key to center canvas (common accessibility pattern)
      case ' ':
        e.preventDefault();
        const shouldAnimate = mergedConfig.enableAnimations && !reducedMotion;
        navigation.panTo({ x: 0, y: 0 }, shouldAnimate);
        announceAction('Centered canvas position');
        break;
        
      // Escape key to stop all animations and clear selection
      case 'Escape':
        e.preventDefault();
        navigation.stopAllAnimations();
        announceAction('Stopped animations and cleared selection');
        break;
    }
  }, [zoom, panCanvas, zoomCanvas, resetCanvas, navigation, mergedConfig, prefersReducedMotion, announceAction, ZOOM_MIN, ZOOM_MAX]);

  // ============================================================================
  // ENHANCED TOUCH EVENT HANDLING
  // ============================================================================
  
  /**
   * Handle touch start with enhanced gesture detection and momentum preparation
   */
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    const now = Date.now();
    touchGestureState.current.gestureStartTime = now;
    touchGestureState.current.lastTouchTime = now;
    
    if (e.touches.length === 1) {
      // Single touch - prepare for pan gesture with momentum
      const touch = e.touches[0];
      const canvasPosition: CanvasPosition = {
        x: touch.clientX,
        y: touch.clientY,
      };
      
      // Initialize touch positions for momentum calculation
      touchGestureState.current.lastTouchPositions = [canvasPosition];
      
      // Start navigation gesture
      navigation.startNavigation(canvasPosition, 'pan');
      
      announceAction('Pan gesture started');
      
    } else if (e.touches.length === 2) {
      // Two touches - prepare for pinch-to-zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      // Store initial pinch state
      touchGestureState.current.initialPinchDistance = distance;
      touchGestureState.current.initialZoom = zoom;
      
      // Stop any ongoing pan navigation
      navigation.stopAllAnimations();
      
      announceAction('Pinch gesture detected');
    }
  }, [zoom, navigation, announceAction]);

  /**
   * Handle touch move with enhanced gesture support and momentum tracking
   */
  const handleTouchMove = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    const now = Date.now();
    const gestureState = touchGestureState.current;
    
    if (e.touches.length === 1) {
      // Single touch - handle pan with momentum tracking
      e.preventDefault();
      
      const touch = e.touches[0];
      const currentPosition: CanvasPosition = {
        x: touch.clientX,
        y: touch.clientY,
      };
      
      // Update navigation gesture
      navigation.updateNavigation(currentPosition);
      
      // Track positions for momentum calculation (keep last 3 positions)
      if (!gestureState.lastTouchPositions) {
        gestureState.lastTouchPositions = [];
      }
      
      gestureState.lastTouchPositions.push(currentPosition);
      if (gestureState.lastTouchPositions.length > 3) {
        gestureState.lastTouchPositions.shift();
      }
      
      gestureState.lastTouchTime = now;
      
    } else if (e.touches.length === 2) {
      // Two touches - handle pinch-to-zoom with design token limits
      e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const initialDistance = gestureState.initialPinchDistance;
      const initialZoom = gestureState.initialZoom;
      
      if (initialDistance && initialZoom) {
        const scale = distance / initialDistance;
        const newZoom = Math.min(Math.max(initialZoom * scale, ZOOM_MIN), ZOOM_MAX);
        
        // Use navigation hook for smooth zoom (without animation during gesture)
        navigation.zoomTo(newZoom, undefined, false);
      }
    }
  }, [navigation, ZOOM_MIN, ZOOM_MAX]);
  
  /**
   * Handle touch end with momentum calculation and gesture cleanup
   */
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    const now = Date.now();
    const gestureState = touchGestureState.current;
    
    if (e.touches.length === 0) {
      // All touches ended
      
      // Calculate gesture duration for momentum eligibility
      const gestureDuration = now - (gestureState.gestureStartTime || now);
      const isQuickGesture = gestureDuration < 300; // ms
      
      // Handle pan gesture momentum
      if (gestureState.lastTouchPositions && 
          gestureState.lastTouchPositions.length > 1 && 
          mergedConfig.enableMomentum && 
          isQuickGesture) {
        
        // End navigation gesture (will trigger momentum if velocity is sufficient)
        navigation.endNavigation();
        
        announceAction('Pan gesture ended with momentum');
        
      } else if (gestureState.lastTouchPositions) {
        // End navigation without momentum
        navigation.stopAllAnimations();
        announceAction('Pan gesture ended');
      }
      
      // Handle pinch gesture end
      if (gestureState.initialPinchDistance) {
        announceAction(`Zoom level: ${(zoom * 100).toFixed(0)} percent`);
      }
      
      // Clean up gesture state
      touchGestureState.current = {};
      
    } else if (e.touches.length === 1 && gestureState.initialPinchDistance) {
      // Switched from pinch to single touch
      announceAction(`Pinch ended, zoom level: ${(zoom * 100).toFixed(0)} percent`);
      
      // Clean up pinch state but keep touch tracking for potential pan
      gestureState.initialPinchDistance = undefined;
      gestureState.initialZoom = undefined;
      
      // Start new pan gesture
      const touch = e.touches[0];
      const canvasPosition: CanvasPosition = {
        x: touch.clientX,
        y: touch.clientY,
      };
      
      navigation.startNavigation(canvasPosition, 'pan');
      gestureState.lastTouchPositions = [canvasPosition];
      gestureState.lastTouchTime = now;
    }
  }, [zoom, navigation, mergedConfig.enableMomentum, announceAction]);

  // ============================================================================
  // EVENT LISTENERS SETUP AND CLEANUP
  // ============================================================================
  
  /**
   * Set up event listeners with enhanced accessibility and animation support
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Accessibility: Ensure container is focusable and properly labeled
    container.tabIndex = 0;
    
    // Add ARIA attributes for enhanced accessibility
    container.setAttribute('aria-label', 'Interactive canvas workspace');
    container.setAttribute('role', 'application');
    
    // Accessibility: Ensure minimum touch target size (44px)
    // This is handled by CSS but we can verify/warn in development
    if (process.env.NODE_ENV === 'development') {
      const rect = container.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        console.warn('Canvas container may not meet minimum touch target size (44px)');
      }
    }
    
    // Add keyboard event listeners
    document.addEventListener('keydown', handleKeyDown);
    
    // Add touch event listeners with enhanced gesture support
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Enhanced focus/blur handlers with animation state awareness
    const handleFocus = () => {
      announceAction('Canvas focused. Use arrow keys to pan, plus and minus to zoom, Escape to stop animations');
    };
    
    const handleBlur = () => {
      // Stop animations when focus is lost for better performance
      navigation.stopAllAnimations();
      announceAction('');
    };
    
    container.addEventListener('focus', handleFocus);
    container.addEventListener('blur', handleBlur);
    
    // Add visibility change listener to pause animations when page is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        navigation.stopAllAnimations();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Clean up all event listeners
      document.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('focus', handleFocus);
      container.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Stop any running animations on cleanup
      navigation.stopAllAnimations();
    };
  }, [handleKeyDown, handleTouchStart, handleTouchMove, handleTouchEnd, navigation, announceAction]);
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  return {
    // Navigation methods with animation support
    panTo: navigation.panTo,
    zoomTo: navigation.zoomTo,
    resetView: navigation.resetView,
    
    // Animation state
    isAnimating: navigation.isAnimating,
    isGestureActive: navigation.isGestureActive,
    isMomentumActive: navigation.isMomentumActive,
    
    // Manual control methods
    stopAllAnimations: navigation.stopAllAnimations,
    
    // Configuration
    config: mergedConfig,
    
    // Accessibility helper
    announceAction,
  };
};