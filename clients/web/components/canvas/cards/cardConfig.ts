/**
 * Configuration constants for card rendering
 */

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
  },
  lineHeight: 1.5,
  fontFamily: 'Arial',

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
    errorText: '#991b1b',
    loadingBackground: '#f3f4f6',
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
  },
} as const;

// Image cache for performance optimization
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

    // Create new loading promise
    const loadingPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        this.cache.set(src, img);
        this.loadingPromises.delete(src);
        resolve(img);
      };

      img.onerror = () => {
        this.loadingPromises.delete(src);
        reject(new Error(`Failed to load image: ${src}`));
      };

      img.src = src;
    });

    this.loadingPromises.set(src, loadingPromise);
    return loadingPromise;
  }

  static clear() {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  static remove(src: string) {
    this.cache.delete(src);
    this.loadingPromises.delete(src);
  }
}