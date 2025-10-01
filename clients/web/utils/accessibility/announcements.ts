/**
 * Screen Reader Announcements Utility
 *
 * Provides accessibility features for screen reader announcements
 * using ARIA live regions following WCAG 2.1 guidelines.
 *
 * @see Related documentation: "Accessibility Guidelines" in Notion
 */

/**
 * Announcement priority enum
 * Following architecture guide Section 4: Enum Type Standardization
 * - POLITE: Wait for user to finish current activity
 * - ASSERTIVE: Interrupt and announce immediately
 */
export enum AnnouncementPriority {
  POLITE = 'polite',
  ASSERTIVE = 'assertive'
}

/**
 * Announcement options
 */
export interface AnnouncementOptions {
  /** Priority level for the announcement */
  priority?: AnnouncementPriority;
  /** Whether the entire region should be announced (default: true) */
  atomic?: boolean;
  /** Timeout in milliseconds before clearing the announcement (default: 1000) */
  clearAfter?: number;
}

/**
 * Creates a live region element for screen reader announcements
 * if one doesn't already exist.
 *
 * @param priority - The ARIA live priority level
 * @returns The live region element
 */
function getLiveRegion(priority: AnnouncementPriority = AnnouncementPriority.POLITE): HTMLElement {
  const id = `sr-live-region-${priority}`;
  let region = document.getElementById(id);

  if (!region) {
    region = document.createElement('div');
    region.id = id;
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';

    // Screen reader only styles
    region.style.position = 'absolute';
    region.style.left = '-10000px';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';

    document.body.appendChild(region);
  }

  return region;
}

/**
 * Announces a message to screen readers using ARIA live regions.
 *
 * @param message - The message to announce
 * @param options - Announcement options
 *
 * @example
 * ```typescript
 * // Polite announcement
 * announce('Edit mode entered');
 *
 * // Assertive announcement
 * announce('Error: Failed to save', { priority: 'assertive' });
 *
 * // Custom clear timeout
 * announce('Saving...', { clearAfter: 3000 });
 * ```
 */
export function announce(
  message: string,
  options: AnnouncementOptions = {}
): void {
  const {
    priority = AnnouncementPriority.POLITE,
    atomic = true,
    clearAfter = 1000
  } = options;

  const region = getLiveRegion(priority);

  if (atomic) {
    region.setAttribute('aria-atomic', 'true');
  } else {
    region.setAttribute('aria-atomic', 'false');
  }

  // Set the message
  region.textContent = message;

  // Clear the message after timeout to allow for new announcements
  if (clearAfter > 0) {
    setTimeout(() => {
      if (region.textContent === message) {
        region.textContent = '';
      }
    }, clearAfter);
  }
}

/**
 * Announces that edit mode has been entered for a specific card type.
 *
 * @param cardType - The type of card being edited
 *
 * @example
 * ```typescript
 * announceEditModeEntered('text');
 * // Announces: "Edit mode entered for text card"
 * ```
 */
export function announceEditModeEntered(cardType: string): void {
  announce(`Edit mode entered for ${cardType} card`, {
    priority: AnnouncementPriority.POLITE,
    clearAfter: 2000
  });
}

/**
 * Announces that edit mode has been exited.
 *
 * @example
 * ```typescript
 * announceEditModeExited();
 * // Announces: "Edit mode closed"
 * ```
 */
export function announceEditModeExited(): void {
  announce('Edit mode closed', {
    priority: AnnouncementPriority.POLITE,
    clearAfter: 2000
  });
}

/**
 * Announces save status changes.
 *
 * @param status - The save status
 *
 * @example
 * ```typescript
 * announceSaveStatus('saving');
 * // Announces: "Saving changes"
 *
 * announceSaveStatus('success');
 * // Announces: "Changes saved successfully"
 * ```
 */
export function announceSaveStatus(
  status: 'saving' | 'success' | 'error'
): void {
  const messages = {
    saving: 'Saving changes',
    success: 'Changes saved successfully',
    error: 'Failed to save changes'
  };

  announce(messages[status], {
    priority: status === 'error' ? AnnouncementPriority.ASSERTIVE : AnnouncementPriority.POLITE,
    clearAfter: status === 'success' ? 2000 : 3000
  });
}

/**
 * Announces validation errors.
 *
 * @param error - The validation error message
 *
 * @example
 * ```typescript
 * announceValidationError('URL is required');
 * // Announces: "Validation error: URL is required"
 * ```
 */
export function announceValidationError(error: string): void {
  announce(`Validation error: ${error}`, {
    priority: AnnouncementPriority.ASSERTIVE,
    clearAfter: 3000
  });
}

/**
 * Announces character count warnings.
 *
 * @param current - Current character count
 * @param max - Maximum character count
 *
 * @example
 * ```typescript
 * announceCharacterCount(9500, 10000);
 * // Announces: "Character count: 9500 of 10000. Approaching limit."
 * ```
 */
export function announceCharacterCount(current: number, max: number): void {
  const percentage = (current / max) * 100;

  if (percentage >= 90) {
    announce(
      `Character count: ${current} of ${max}. Approaching limit.`,
      {
        priority: AnnouncementPriority.POLITE,
        clearAfter: 2000
      }
    );
  }
}

/**
 * Cleans up live region elements (useful for testing or unmounting).
 */
export function cleanupLiveRegions(): void {
  const politeRegion = document.getElementById('sr-live-region-polite');
  const assertiveRegion = document.getElementById('sr-live-region-assertive');

  if (politeRegion) {
    politeRegion.remove();
  }
  if (assertiveRegion) {
    assertiveRegion.remove();
  }
}

/**
 * React hook for screen reader announcements
 *
 * @returns Announcement function
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const announce = useAnnounce();
 *
 *   const handleSave = () => {
 *     announce('Saving...');
 *   };
 *
 *   return <button onClick={handleSave}>Save</button>;
 * }
 * ```
 */
export function useAnnounce(): typeof announce {
  return announce;
}
