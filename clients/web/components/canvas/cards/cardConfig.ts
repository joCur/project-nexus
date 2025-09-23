/**
 * Configuration constants for card rendering
 */

import { loadImageSecurely, cleanupImage } from './imageSecurityUtils';

export const CARD_CONFIG = {
  // Padding and spacing
  padding: 16,
  borderRadius: 8,
  borderWidth: 2,
  shadowBlur: 10,
  shadowOffset: 4,

  // Typography
  fontSize: {
    base: 14,
    title: 16,
    heading: 20,
    min: 12,
    max: 18,
    code: 11,
    caption: 11,
    indicator: 10,
    scaleFactor: 20, // Divisor for width-based font size calculation
  },
  lineHeight: 1.5,
  codeLineHeight: 1.4,
  fontFamily: 'Arial',
  codeFontFamily: 'Consolas, Monaco, monospace',

  // Opacity values
  opacity: {
    selection: 0.1,
    hover: 0.05,
    dragIndicator: 0.8,
    altIndicator: 0.8,
  },

  // Colors
  colors: {
    background: '#ffffff',
    selectedBorder: '#3b82f6',
    hoverBorder: '#93c5fd',
    border: '#e5e7eb',
    shadow: 'rgba(0, 0, 0, 0.1)',
    text: '#1f2937',
    secondaryText: '#6b7280',
    errorBackground: '#fee2e2',
    errorBorder: '#fecaca',
    errorText: '#991b1b',
    loadingBackground: '#f3f4f6',
    loadingBorder: '#e5e7eb',
    codeBackground: '#1f2937',
    codeBorder: '#374151',
    codeText: '#e5e7eb',
    successColor: '#10b981',
    warningColor: '#ef4444',
    infoColor: '#059669',
  },

  // Image handling
  image: {
    maxWidth: 300,
    maxHeight: 300,
    placeholderOpacity: 0.3,
    loadTimeout: 10000, // 10 seconds
  },

  // Link card
  link: {
    faviconSize: 20,
    faviconOffset: 8,
  },

  // Animation
  transition: {
    duration: 0.2,
  },

  // Performance
  viewport: {
    cullingPadding: 100, // pixels outside viewport to still render
    extraPadding: 500, // Extra pixels around viewport to render for CardLayer
  },

  // Code card specific
  code: {
    padding: 12,
    headerHeight: 28,
    footerHeight: 24,
    lineNumberWidth: 32,
  },

  // Text rendering
  text: {
    characterWidthEstimate: 0.6, // Rough character width as fraction of font size
  },
} as const;

// Image cache for performance optimization with security
export class ImageCache {
  private static cache = new Map<string, HTMLImageElement>();
  private static loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  static async getImage(src: string): Promise<HTMLImageElement> {
    // Return cached image if available
    if (this.cache.has(src)) {
      return this.cache.get(src)!;
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    // Create new loading promise with security validation
    const loadingPromise = loadImageSecurely(src, CARD_CONFIG.image.loadTimeout)
      .then((img) => {
        this.cache.set(src, img);
        this.loadingPromises.delete(src);
        return img;
      })
      .catch((error) => {
        this.loadingPromises.delete(src);
        throw error;
      });

    this.loadingPromises.set(src, loadingPromise);
    return loadingPromise;
  }

  static clear() {
    // Clean up all cached images properly
    this.cache.forEach((img) => cleanupImage(img));
    this.cache.clear();
    this.loadingPromises.clear();
  }

  static remove(src: string) {
    const img = this.cache.get(src);
    if (img) {
      cleanupImage(img);
    }
    this.cache.delete(src);
    this.loadingPromises.delete(src);
  }
}