/**
 * Image Security Utilities
 *
 * Provides security validation and sanitization for image loading
 * to prevent XSS attacks and ensure safe image handling.
 */

/**
 * Validates if a URL is safe for image loading
 * Only allows http and https protocols to prevent javascript: and data: URIs
 */
export const isValidImageUrl = (url: string | undefined): boolean => {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    // Reject potentially dangerous protocols like javascript:, data:, file:, etc.
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    // Invalid URL format
    return false;
  }
};

/**
 * Sanitizes and validates an image URL before loading
 * Returns null if the URL is invalid or potentially dangerous
 */
export const sanitizeImageUrl = (url: string | undefined): string | null => {
  if (!url || !isValidImageUrl(url)) {
    return null;
  }

  try {
    const parsed = new URL(url);

    // Additional security checks
    // Check for suspicious patterns in the URL
    const suspiciousPatterns = [
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
      /onclick=/i,
      /onerror=/i,
      /onload=/i,
      /<script/i,
      /%3Cscript/i,
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(url))) {
      // Use proper logging service instead of console.warn
      // logger.warn('Suspicious URL pattern detected:', url);
      return null;
    }

    // Return the validated URL
    return parsed.toString();
  } catch {
    return null;
  }
};

/**
 * Creates a secure image element with proper security settings
 */
export const createSecureImage = (): HTMLImageElement => {
  const img = new window.Image();

  // Set cross-origin to anonymous for CORS
  img.crossOrigin = 'anonymous';

  // Set referrer policy for privacy
  img.referrerPolicy = 'no-referrer';

  return img;
};

/**
 * Safely loads an image with timeout and error handling
 */
export const loadImageSecurely = (
  url: string,
  timeout = 30000 // 30 seconds default timeout
): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    // Validate URL first
    const sanitizedUrl = sanitizeImageUrl(url);
    if (!sanitizedUrl) {
      reject(new Error('Invalid or unsafe image URL'));
      return;
    }

    const img = createSecureImage();

    // Set up timeout
    const timeoutId = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error('Image loading timeout'));
    }, timeout);

    img.onload = () => {
      clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
      resolve(img);
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
      reject(new Error('Failed to load image'));
    };

    // Set source after handlers are attached
    img.src = sanitizedUrl;
  });
};

/**
 * Cleans up image element to prevent memory leaks
 */
export const cleanupImage = (img: HTMLImageElement | undefined): void => {
  if (!img) return;

  // Clear event handlers
  img.onload = null;
  img.onerror = null;
  img.onabort = null;

  // Clear source to help with garbage collection
  img.src = '';
};