/**
 * Screen Reader Announcements Tests
 *
 * Test suite for the accessibility announcements utility.
 * Verifies ARIA live region creation and management.
 */

import {
  announce,
  announceEditModeEntered,
  announceEditModeExited,
  announceSaveStatus,
  announceValidationError,
  announceCharacterCount,
  cleanupLiveRegions,
  AnnouncementPriority
} from '../announcements';

describe('Screen Reader Announcements', () => {
  beforeEach(() => {
    // Clean up any existing live regions
    cleanupLiveRegions();
  });

  afterEach(() => {
    // Clean up after each test
    cleanupLiveRegions();
  });

  describe('announce', () => {
    it('should create a polite live region if it does not exist', () => {
      announce('Test message');

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('role', 'status');
      expect(region).toHaveAttribute('aria-live', AnnouncementPriority.POLITE);
      expect(region).toHaveAttribute('aria-atomic', 'true');
    });

    it('should create an assertive live region when priority is assertive', () => {
      announce('Urgent message', { priority: AnnouncementPriority.ASSERTIVE });

      const region = document.getElementById('sr-live-region-assertive');
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('aria-live', AnnouncementPriority.ASSERTIVE);
    });

    it('should set the message content in the live region', () => {
      const message = 'Test announcement';
      announce(message);

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveTextContent(message);
    });

    it('should apply screen reader only styles', () => {
      announce('Test message');

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveClass('sr-only');
      expect(region).toHaveStyle({ position: 'absolute' });
      expect(region).toHaveStyle({ left: '-10000px' });
    });

    it('should clear the message after the specified timeout', (done) => {
      announce('Test message', { clearAfter: 100 });

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveTextContent('Test message');

      setTimeout(() => {
        expect(region).toHaveTextContent('');
        done();
      }, 150);
    });

    it('should not clear the message if clearAfter is 0', (done) => {
      announce('Persistent message', { clearAfter: 0 });

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveTextContent('Persistent message');

      setTimeout(() => {
        expect(region).toHaveTextContent('Persistent message');
        done();
      }, 100);
    });

    it('should set aria-atomic based on options', () => {
      announce('Test message', { atomic: false });

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveAttribute('aria-atomic', 'false');
    });

    it('should reuse existing live region for multiple announcements', () => {
      announce('First message');
      announce('Second message');

      const regions = document.querySelectorAll('[id^="sr-live-region-polite"]');
      expect(regions).toHaveLength(1);
    });
  });

  describe('announceEditModeEntered', () => {
    it('should announce edit mode entry with card type', () => {
      announceEditModeEntered('text');

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveTextContent('Edit mode entered for text card');
    });

    it('should use polite priority', () => {
      announceEditModeEntered('code');

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveAttribute('aria-live', AnnouncementPriority.POLITE);
    });
  });

  describe('announceEditModeExited', () => {
    it('should announce edit mode exit', () => {
      announceEditModeExited();

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveTextContent('Edit mode closed');
    });
  });

  describe('announceSaveStatus', () => {
    it('should announce saving status', () => {
      announceSaveStatus('saving');

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveTextContent('Saving changes');
    });

    it('should announce success status', () => {
      announceSaveStatus('success');

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveTextContent('Changes saved successfully');
    });

    it('should announce error status with assertive priority', () => {
      announceSaveStatus('error');

      const region = document.getElementById('sr-live-region-assertive');
      expect(region).toHaveTextContent('Failed to save changes');
      expect(region).toHaveAttribute('aria-live', AnnouncementPriority.ASSERTIVE);
    });
  });

  describe('announceValidationError', () => {
    it('should announce validation error with assertive priority', () => {
      announceValidationError('URL is required');

      const region = document.getElementById('sr-live-region-assertive');
      expect(region).toHaveTextContent('Validation error: URL is required');
      expect(region).toHaveAttribute('aria-live', AnnouncementPriority.ASSERTIVE);
    });
  });

  describe('announceCharacterCount', () => {
    it('should announce when approaching character limit (90%)', () => {
      announceCharacterCount(9000, 10000);

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveTextContent(
        'Character count: 9000 of 10000. Approaching limit.'
      );
    });

    it('should not announce when below 90% threshold', () => {
      announceCharacterCount(8000, 10000);

      const region = document.getElementById('sr-live-region-polite');
      // Region may not exist if no announcement was made
      expect(region).toBeNull();
    });

    it('should announce at exactly 90%', () => {
      announceCharacterCount(9000, 10000);

      const region = document.getElementById('sr-live-region-polite');
      expect(region).toHaveTextContent('Character count: 9000 of 10000. Approaching limit.');
    });
  });

  describe('cleanupLiveRegions', () => {
    it('should remove all live regions from the DOM', () => {
      announce('Polite message', { priority: AnnouncementPriority.POLITE });
      announce('Assertive message', { priority: AnnouncementPriority.ASSERTIVE });

      expect(document.getElementById('sr-live-region-polite')).toBeInTheDocument();
      expect(document.getElementById('sr-live-region-assertive')).toBeInTheDocument();

      cleanupLiveRegions();

      expect(document.getElementById('sr-live-region-polite')).not.toBeInTheDocument();
      expect(document.getElementById('sr-live-region-assertive')).not.toBeInTheDocument();
    });

    it('should not throw error if regions do not exist', () => {
      expect(() => cleanupLiveRegions()).not.toThrow();
    });
  });
});
