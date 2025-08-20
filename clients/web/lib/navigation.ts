/**
 * Navigation utilities for client-side routing
 * This wrapper allows for easier testing by abstracting browser navigation
 */

export const navigationUtils = {
  /**
   * Navigate to a URL using window.location.href
   */
  navigateToUrl: (url: string): void => {
    window.location.href = url;
  },
  
  /**
   * Get current URL
   */
  getCurrentUrl: (): string => {
    return window.location.href;
  },
};