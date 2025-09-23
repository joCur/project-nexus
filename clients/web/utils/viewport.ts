/**
 * Viewport utilities with SSR safety
 *
 * Provides safe access to browser viewport dimensions with
 * server-side rendering guards and fallback values.
 */

/**
 * Default viewport dimensions used as fallbacks
 */
export const DEFAULT_VIEWPORT = {
  width: 1920,
  height: 1080,
} as const;

/**
 * Safely gets viewport width with SSR guard
 */
export const getViewportWidth = (): number => {
  if (typeof window === 'undefined') {
    return DEFAULT_VIEWPORT.width;
  }
  return window.innerWidth || DEFAULT_VIEWPORT.width;
};

/**
 * Safely gets viewport height with SSR guard
 */
export const getViewportHeight = (): number => {
  if (typeof window === 'undefined') {
    return DEFAULT_VIEWPORT.height;
  }
  return window.innerHeight || DEFAULT_VIEWPORT.height;
};

/**
 * Gets both viewport dimensions
 */
export const getViewportDimensions = (): { width: number; height: number } => {
  return {
    width: getViewportWidth(),
    height: getViewportHeight(),
  };
};

/**
 * React hook for viewport dimensions with resize handling
 */
import { useState, useEffect } from 'react';

export const useViewportDimensions = () => {
  const [dimensions, setDimensions] = useState(() => getViewportDimensions());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setDimensions(getViewportDimensions());
    };

    // Set initial dimensions on client
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return dimensions;
};

/**
 * Checks if code is running on server (SSR)
 */
export const isSSR = (): boolean => {
  return typeof window === 'undefined';
};

/**
 * Checks if code is running on client
 */
export const isClient = (): boolean => {
  return typeof window !== 'undefined';
};