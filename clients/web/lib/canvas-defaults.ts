/**
 * Canvas Default Configuration
 *
 * Centralized configuration for canvas default values used across
 * transformation functions, store initialization, and component defaults.
 *
 * This ensures consistency between backend transformations and frontend
 * store states, eliminating hardcoded values throughout the system.
 */

import type { CanvasConfig, CanvasPosition } from '@/types/canvas.types';
import type { CanvasSettings } from '@/types/workspace.types';

/**
 * Default canvas settings for transforming backend responses
 * These are applied when creating Canvas objects from backend data
 */
export const DEFAULT_CANVAS_SETTINGS: Omit<CanvasSettings, 'isDefault'> = {
  position: { x: 0, y: 0, z: 0 },
  zoom: 1.0,
  grid: {
    enabled: true,
    size: 20,
    color: '#e5e7eb',
    opacity: 0.3,
  },
  background: {
    type: 'COLOR' as const,
    color: '#ffffff',
    opacity: 1.0,
  },
};

/**
 * Default canvas configuration for the canvas store
 * Used for viewport, interaction, and rendering configuration
 */
export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  grid: DEFAULT_CANVAS_SETTINGS.grid,
  zoom: {
    min: 0.25,
    max: 4.0,
    step: 0.1,
  },
  performance: {
    enableCulling: true,
    enableVirtualization: true,
    maxVisibleCards: 1000,
  },
};

/**
 * Default viewport position
 */
export const DEFAULT_VIEWPORT_POSITION: CanvasPosition = DEFAULT_CANVAS_SETTINGS.position;

/**
 * Default zoom level
 */
export const DEFAULT_ZOOM_LEVEL = DEFAULT_CANVAS_SETTINGS.zoom;

/**
 * Create default canvas settings with optional overrides
 * Useful for creating new canvases with custom defaults
 */
export const createDefaultCanvasSettings = (
  overrides: Partial<Omit<CanvasSettings, 'isDefault'>> = {}
): Omit<CanvasSettings, 'isDefault'> => {
  return {
    ...DEFAULT_CANVAS_SETTINGS,
    ...overrides,
    grid: {
      ...DEFAULT_CANVAS_SETTINGS.grid,
      ...overrides.grid,
    },
    background: {
      ...DEFAULT_CANVAS_SETTINGS.background,
      ...overrides.background,
    },
  };
};