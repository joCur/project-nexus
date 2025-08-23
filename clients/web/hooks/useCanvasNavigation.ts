/**
 * Canvas Navigation Hook
 * 
 * Advanced navigation hook with momentum-based scrolling, smooth animations,
 * and gesture handling for the infinite canvas system.
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import {
  interpolatePosition,
  interpolateZoom,
} from '@/utils/canvas-calculations';
import type {
  CanvasPosition,
  ZoomLevel,
} from '@/types/canvas.types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface NavigationConfig {
  enableMomentum: boolean;
  momentumFriction: number;
  animationDuration: number;
  velocityThreshold: number;
  maxVelocity: number;
  enableInertia: boolean;
  enableSmoothing: boolean;
}

interface GestureState {
  isActive: boolean;
  startPosition: CanvasPosition;
  currentPosition: CanvasPosition;
  velocity: CanvasPosition;
  lastTimestamp: number;
  gestureType: 'pan' | 'zoom' | 'pinch' | null;
}

interface AnimationState {
  isAnimating: boolean;
  startTime: number;
  duration: number;
  startPosition: CanvasPosition;
  targetPosition: CanvasPosition;
  startZoom: ZoomLevel;
  targetZoom: ZoomLevel;
  animationId: number | null;
}

interface MomentumState {
  velocity: CanvasPosition;
  isDecelerating: boolean;
  lastUpdateTime: number;
  animationId: number | null;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: NavigationConfig = {
  enableMomentum: true,
  momentumFriction: 0.95,
  animationDuration: 300,
  velocityThreshold: 50,
  maxVelocity: 2000,
  enableInertia: true,
  enableSmoothing: true,
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export const useCanvasNavigation = (config: Partial<NavigationConfig> = {}) => {
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const { viewport, setPosition, setZoom } = useCanvasStore();
  
  // Refs for tracking state
  const gestureState = useRef<GestureState>({
    isActive: false,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    lastTimestamp: 0,
    gestureType: null,
  });
  
  const animationState = useRef<AnimationState>({
    isAnimating: false,
    startTime: 0,
    duration: 0,
    startPosition: { x: 0, y: 0 },
    targetPosition: { x: 0, y: 0 },
    startZoom: 1,
    targetZoom: 1,
    animationId: null,
  });
  
  const momentumState = useRef<MomentumState>({
    velocity: { x: 0, y: 0 },
    isDecelerating: false,
    lastUpdateTime: 0,
    animationId: null,
  });

  // ============================================================================
  // ANIMATION UTILITIES
  // ============================================================================

  const cancelCurrentAnimation = useCallback(() => {
    if (animationState.current.animationId) {
      cancelAnimationFrame(animationState.current.animationId);
      animationState.current.animationId = null;
      animationState.current.isAnimating = false;
    }
  }, []);

  const cancelMomentum = useCallback(() => {
    if (momentumState.current.animationId) {
      cancelAnimationFrame(momentumState.current.animationId);
      momentumState.current.animationId = null;
      momentumState.current.isDecelerating = false;
      momentumState.current.velocity = { x: 0, y: 0 };
    }
  }, []);

  // ============================================================================
  // SMOOTH ANIMATIONS
  // ============================================================================

  const animateToPosition = useCallback((
    targetPosition: CanvasPosition,
    duration: number = mergedConfig.animationDuration
  ) => {
    cancelCurrentAnimation();
    cancelMomentum();

    const startPosition = viewport.position;
    const startTime = Date.now();

    animationState.current = {
      isAnimating: true,
      startTime,
      duration,
      startPosition,
      targetPosition,
      startZoom: viewport.zoom,
      targetZoom: viewport.zoom,
      animationId: null,
    };

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress >= 1) {
        setPosition(targetPosition);
        animationState.current.isAnimating = false;
        animationState.current.animationId = null;
        return;
      }

      const currentPosition = interpolatePosition(startPosition, targetPosition, progress);
      setPosition(currentPosition);

      animationState.current.animationId = requestAnimationFrame(animate);
    };

    animationState.current.animationId = requestAnimationFrame(animate);
  }, [viewport.position, viewport.zoom, setPosition, mergedConfig.animationDuration, cancelCurrentAnimation, cancelMomentum]);

  const animateToZoom = useCallback((
    targetZoom: ZoomLevel,
    targetPosition?: CanvasPosition,
    duration: number = mergedConfig.animationDuration
  ) => {
    cancelCurrentAnimation();
    cancelMomentum();

    const startZoom = viewport.zoom;
    const startPosition = viewport.position;
    const finalTargetPosition = targetPosition || startPosition;
    const startTime = Date.now();

    animationState.current = {
      isAnimating: true,
      startTime,
      duration,
      startPosition,
      targetPosition: finalTargetPosition,
      startZoom,
      targetZoom,
      animationId: null,
    };

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress >= 1) {
        setZoom(targetZoom);
        setPosition(finalTargetPosition);
        animationState.current.isAnimating = false;
        animationState.current.animationId = null;
        return;
      }

      const currentZoom = interpolateZoom(startZoom, targetZoom, progress);
      const currentPosition = interpolatePosition(startPosition, finalTargetPosition, progress);
      
      setZoom(currentZoom);
      setPosition(currentPosition);

      animationState.current.animationId = requestAnimationFrame(animate);
    };

    animationState.current.animationId = requestAnimationFrame(animate);
  }, [viewport.zoom, viewport.position, setZoom, setPosition, mergedConfig.animationDuration, cancelCurrentAnimation, cancelMomentum]);

  // ============================================================================
  // MOMENTUM SCROLLING
  // ============================================================================

  const startMomentumDeceleration = useCallback(() => {
    if (!mergedConfig.enableMomentum || !mergedConfig.enableInertia) return;

    const velocity = momentumState.current.velocity;
    const velocityMagnitude = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    if (velocityMagnitude < mergedConfig.velocityThreshold) {
      momentumState.current.velocity = { x: 0, y: 0 };
      return;
    }

    momentumState.current.isDecelerating = true;
    momentumState.current.lastUpdateTime = Date.now();

    const decelerate = () => {
      const now = Date.now();
      const deltaTime = (now - momentumState.current.lastUpdateTime) / 1000; // Convert to seconds
      momentumState.current.lastUpdateTime = now;

      // Apply friction
      momentumState.current.velocity.x *= mergedConfig.momentumFriction;
      momentumState.current.velocity.y *= mergedConfig.momentumFriction;

      // Update position based on velocity
      const currentPosition = viewport.position;
      const deltaPosition: CanvasPosition = {
        x: currentPosition.x - momentumState.current.velocity.x * deltaTime,
        y: currentPosition.y - momentumState.current.velocity.y * deltaTime,
      };

      setPosition(deltaPosition);

      // Check if velocity is below threshold
      const currentVelocityMagnitude = Math.sqrt(
        momentumState.current.velocity.x * momentumState.current.velocity.x +
        momentumState.current.velocity.y * momentumState.current.velocity.y
      );

      if (currentVelocityMagnitude < mergedConfig.velocityThreshold) {
        momentumState.current.isDecelerating = false;
        momentumState.current.velocity = { x: 0, y: 0 };
        momentumState.current.animationId = null;
        return;
      }

      momentumState.current.animationId = requestAnimationFrame(decelerate);
    };

    momentumState.current.animationId = requestAnimationFrame(decelerate);
  }, [viewport.position, setPosition, mergedConfig]);

  // ============================================================================
  // GESTURE HANDLING
  // ============================================================================

  const startNavigation = useCallback((position: CanvasPosition, gestureType: GestureState['gestureType'] = 'pan') => {
    cancelCurrentAnimation();
    cancelMomentum();

    const now = Date.now();
    gestureState.current = {
      isActive: true,
      startPosition: position,
      currentPosition: position,
      velocity: { x: 0, y: 0 },
      lastTimestamp: now,
      gestureType,
    };
  }, [cancelCurrentAnimation, cancelMomentum]);

  const updateNavigation = useCallback((position: CanvasPosition) => {
    if (!gestureState.current.isActive) return;

    const now = Date.now();
    const deltaTime = (now - gestureState.current.lastTimestamp) / 1000; // Convert to seconds
    
    if (deltaTime > 0) {
      // Calculate velocity for momentum
      const deltaX = position.x - gestureState.current.currentPosition.x;
      const deltaY = position.y - gestureState.current.currentPosition.y;
      
      const velocityX = deltaX / deltaTime;
      const velocityY = deltaY / deltaTime;
      
      // Apply velocity smoothing
      if (mergedConfig.enableSmoothing) {
        const smoothingFactor = 0.3;
        gestureState.current.velocity.x = gestureState.current.velocity.x * (1 - smoothingFactor) + velocityX * smoothingFactor;
        gestureState.current.velocity.y = gestureState.current.velocity.y * (1 - smoothingFactor) + velocityY * smoothingFactor;
      } else {
        gestureState.current.velocity = { x: velocityX, y: velocityY };
      }
      
      // Clamp velocity to max
      const velocityMagnitude = Math.sqrt(
        gestureState.current.velocity.x * gestureState.current.velocity.x +
        gestureState.current.velocity.y * gestureState.current.velocity.y
      );
      
      if (velocityMagnitude > mergedConfig.maxVelocity) {
        const scale = mergedConfig.maxVelocity / velocityMagnitude;
        gestureState.current.velocity.x *= scale;
        gestureState.current.velocity.y *= scale;
      }
    }

    gestureState.current.currentPosition = position;
    gestureState.current.lastTimestamp = now;

    // Update viewport position immediately for responsive feel
    if (gestureState.current.gestureType === 'pan') {
      const deltaX = position.x - gestureState.current.startPosition.x;
      const deltaY = position.y - gestureState.current.startPosition.y;
      
      const newPosition: CanvasPosition = {
        x: viewport.position.x - deltaX,
        y: viewport.position.y - deltaY,
      };
      
      setPosition(newPosition);
      gestureState.current.startPosition = position;
    }
  }, [viewport.position, setPosition, mergedConfig]);

  const endNavigation = useCallback(() => {
    if (!gestureState.current.isActive) return;

    // Store velocity for momentum
    momentumState.current.velocity = { ...gestureState.current.velocity };
    
    gestureState.current.isActive = false;
    gestureState.current.gestureType = null;

    // Start momentum deceleration if enabled
    if (mergedConfig.enableMomentum) {
      startMomentumDeceleration();
    }
  }, [mergedConfig.enableMomentum, startMomentumDeceleration]);

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  const panTo = useCallback((
    targetPosition: CanvasPosition,
    animated: boolean = true,
    duration?: number
  ) => {
    if (animated) {
      animateToPosition(targetPosition, duration);
    } else {
      setPosition(targetPosition);
    }
  }, [animateToPosition, setPosition]);

  const zoomTo = useCallback((
    targetZoom: ZoomLevel,
    focusPoint?: CanvasPosition,
    animated: boolean = true,
    duration?: number
  ) => {
    if (animated) {
      animateToZoom(targetZoom, focusPoint, duration);
    } else {
      setZoom(targetZoom);
      if (focusPoint) {
        setPosition(focusPoint);
      }
    }
  }, [animateToZoom, setZoom, setPosition]);

  const resetView = useCallback((animated: boolean = true) => {
    const defaultPosition: CanvasPosition = { x: 0, y: 0 };
    const defaultZoom: ZoomLevel = 1;
    
    if (animated) {
      animateToZoom(defaultZoom, defaultPosition);
    } else {
      setZoom(defaultZoom);
      setPosition(defaultPosition);
    }
  }, [animateToZoom, setZoom, setPosition]);

  const stopAllAnimations = useCallback(() => {
    cancelCurrentAnimation();
    cancelMomentum();
  }, [cancelCurrentAnimation, cancelMomentum]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      stopAllAnimations();
    };
  }, [stopAllAnimations]);

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    // Navigation controls
    panTo,
    zoomTo,
    resetView,
    
    // Gesture handling
    startNavigation,
    updateNavigation,
    endNavigation,
    
    // Animation controls
    stopAllAnimations,
    
    // State getters
    isAnimating: animationState.current.isAnimating,
    isGestureActive: gestureState.current.isActive,
    isMomentumActive: momentumState.current.isDecelerating,
    currentVelocity: momentumState.current.velocity,
    
    // Configuration
    config: mergedConfig,
  };
};