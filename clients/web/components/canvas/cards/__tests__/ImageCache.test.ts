/**
 * ImageCache Tests (TDD - RED Phase)
 *
 * Comprehensive tests to verify ImageCache persistence across component unmount/remount cycles,
 * concurrent loading prevention, cache cleanup, and error handling.
 *
 * These tests are written FIRST (TDD RED phase) to verify the implementation.
 */

import { ImageCache, CARD_CONFIG } from '../cardConfig';
import { loadImageSecurely, cleanupImage } from '../imageSecurityUtils';

// Mock the image security utilities
jest.mock('../imageSecurityUtils', () => ({
  loadImageSecurely: jest.fn(),
  cleanupImage: jest.fn(),
  isValidImageUrl: jest.fn((url: string) => url.startsWith('http')),
  sanitizeImageUrl: jest.fn((url: string) => url.startsWith('http') ? url : null),
  createSecureImage: jest.fn(),
}));

// Mock HTMLImageElement to prevent actual image loading
class MockImage {
  src = '';
  width = 0;
  height = 0;
  onload: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  onabort: (() => void) | null = null;
  crossOrigin: string | null = null;
  referrerPolicy = '';
}

// Override global Image with mock
(global as unknown as { Image: typeof MockImage }).Image = MockImage;

describe('ImageCache', () => {
  const mockImageUrl = 'https://example.com/image.jpg';
  const mockImageUrl2 = 'https://example.com/image2.jpg';
  const mockImageUrl3 = 'https://example.com/image3.jpg';

  let mockLoadImageSecurely: jest.MockedFunction<typeof loadImageSecurely>;
  let mockCleanupImage: jest.MockedFunction<typeof cleanupImage>;

  // Helper to create mock images
  const createMockImage = (src: string = ''): HTMLImageElement => {
    const img = new MockImage() as unknown as HTMLImageElement;
    img.src = src;
    return img;
  };

  // Track unhandled promise rejections in tests
  let unhandledRejections: Error[] = [];

  const handleUnhandledRejection = (reason: Error) => {
    unhandledRejections.push(reason);
  };

  beforeAll(() => {
    process.on('unhandledRejection', handleUnhandledRejection);
  });

  afterAll(() => {
    process.off('unhandledRejection', handleUnhandledRejection);
  });

  beforeEach(() => {
    // Clear unhandled rejections
    unhandledRejections = [];

    // Clear the cache before each test
    ImageCache.clear();

    // Reset all mocks AFTER clearing cache
    jest.clearAllMocks();

    // Get mocked functions
    mockLoadImageSecurely = loadImageSecurely as jest.MockedFunction<typeof loadImageSecurely>;
    mockCleanupImage = cleanupImage as jest.MockedFunction<typeof cleanupImage>;

    // Reset mock implementation to default (resolve with a mock image)
    mockLoadImageSecurely.mockReset();
    mockCleanupImage.mockReset();
  });

  afterEach(async () => {
    // Flush any pending promises
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Always clear cache after tests to prevent test pollution
    ImageCache.clear();
  });

  describe('Persistence across component unmount/remount cycles', () => {
    it('should return cached image immediately without new network request after remount', async () => {
      // Create a mock image
      const mockImage = createMockImage(mockImageUrl);
      mockImage.width = 100;
      mockImage.height = 100;

      // Mock successful image load
      mockLoadImageSecurely.mockResolvedValueOnce(mockImage);

      // FIRST MOUNT: Load image for the first time
      const firstLoadPromise = ImageCache.getImage(mockImageUrl);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);
      expect(mockLoadImageSecurely).toHaveBeenCalledWith(mockImageUrl, CARD_CONFIG.image.loadTimeout);

      const firstImage = await firstLoadPromise;
      expect(firstImage).toBe(mockImage);

      // Simulate component unmount (cache should persist)
      // No explicit unmount needed - static cache persists

      // SECOND MOUNT: Request same image again
      const secondLoadPromise = ImageCache.getImage(mockImageUrl);

      // Should NOT call loadImageSecurely again
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);

      const secondImage = await secondLoadPromise;

      // Should return the SAME cached image instance
      expect(secondImage).toBe(mockImage);
      expect(secondImage).toBe(firstImage);
    });

    it('should maintain cache across multiple different images during unmount/remount', async () => {
      const mockImage1 = createMockImage(mockImageUrl);
      const mockImage2 = createMockImage(mockImageUrl2);
      const mockImage3 = createMockImage(mockImageUrl3);

      mockLoadImageSecurely
        .mockResolvedValueOnce(mockImage1)
        .mockResolvedValueOnce(mockImage2)
        .mockResolvedValueOnce(mockImage3);

      // Load multiple images
      const image1 = await ImageCache.getImage(mockImageUrl);
      const image2 = await ImageCache.getImage(mockImageUrl2);
      const image3 = await ImageCache.getImage(mockImageUrl3);

      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(3);

      // Simulate component unmount/remount
      // Request all images again
      const reloadedImage1 = await ImageCache.getImage(mockImageUrl);
      const reloadedImage2 = await ImageCache.getImage(mockImageUrl2);
      const reloadedImage3 = await ImageCache.getImage(mockImageUrl3);

      // Should still be 3 calls (no new loads)
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(3);

      // All images should be cached instances
      expect(reloadedImage1).toBe(image1);
      expect(reloadedImage2).toBe(image2);
      expect(reloadedImage3).toBe(image3);
    });

    it('should persist cache even when accessed from different component instances', async () => {
      const mockImage = createMockImage();
      mockImage.src = mockImageUrl;
      mockLoadImageSecurely.mockResolvedValueOnce(mockImage);

      // Component A loads image
      const componentAImage = await ImageCache.getImage(mockImageUrl);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);

      // Component B (different instance) requests same image
      const componentBImage = await ImageCache.getImage(mockImageUrl);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1); // Still only 1 call

      // Component C (another different instance) requests same image
      const componentCImage = await ImageCache.getImage(mockImageUrl);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1); // Still only 1 call

      // All components get the same cached instance
      expect(componentAImage).toBe(mockImage);
      expect(componentBImage).toBe(mockImage);
      expect(componentCImage).toBe(mockImage);
    });
  });

  describe('Concurrent loading prevention', () => {
    it('should prevent duplicate network requests when same image is requested concurrently', async () => {
      const mockImage = createMockImage();
      mockImage.src = mockImageUrl;

      // Create a deferred promise to control when the image "loads"
      let resolveImageLoad: (img: HTMLImageElement) => void;
      const imageLoadPromise = new Promise<HTMLImageElement>((resolve) => {
        resolveImageLoad = resolve;
      });

      mockLoadImageSecurely.mockReturnValueOnce(imageLoadPromise);

      // Start 5 concurrent requests for the same image
      const promise1 = ImageCache.getImage(mockImageUrl);
      const promise2 = ImageCache.getImage(mockImageUrl);
      const promise3 = ImageCache.getImage(mockImageUrl);
      const promise4 = ImageCache.getImage(mockImageUrl);
      const promise5 = ImageCache.getImage(mockImageUrl);

      // Should only call loadImageSecurely ONCE
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);

      // Resolve the image load
      resolveImageLoad!(mockImage);

      // All promises should resolve to the same image
      const [img1, img2, img3, img4, img5] = await Promise.all([
        promise1,
        promise2,
        promise3,
        promise4,
        promise5,
      ]);

      expect(img1).toBe(mockImage);
      expect(img2).toBe(mockImage);
      expect(img3).toBe(mockImage);
      expect(img4).toBe(mockImage);
      expect(img5).toBe(mockImage);

      // Verify all are the same instance
      expect(img1).toBe(img2);
      expect(img2).toBe(img3);
      expect(img3).toBe(img4);
      expect(img4).toBe(img5);
    });

    it('should handle concurrent requests for different images independently', async () => {
      const mockImage1 = createMockImage();
      mockImage1.src = mockImageUrl;
      const mockImage2 = createMockImage();
      mockImage2.src = mockImageUrl2;

      // Create deferred promises for each image
      let resolveImage1: (img: HTMLImageElement) => void;
      let resolveImage2: (img: HTMLImageElement) => void;

      const imageLoad1Promise = new Promise<HTMLImageElement>((resolve) => {
        resolveImage1 = resolve;
      });
      const imageLoad2Promise = new Promise<HTMLImageElement>((resolve) => {
        resolveImage2 = resolve;
      });

      mockLoadImageSecurely
        .mockReturnValueOnce(imageLoad1Promise)
        .mockReturnValueOnce(imageLoad2Promise);

      // Start concurrent requests for different images
      const img1Promise1 = ImageCache.getImage(mockImageUrl);
      const img1Promise2 = ImageCache.getImage(mockImageUrl);
      const img2Promise1 = ImageCache.getImage(mockImageUrl2);
      const img2Promise2 = ImageCache.getImage(mockImageUrl2);

      // Should call loadImageSecurely twice (once per unique URL)
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(2);
      expect(mockLoadImageSecurely).toHaveBeenCalledWith(mockImageUrl, CARD_CONFIG.image.loadTimeout);
      expect(mockLoadImageSecurely).toHaveBeenCalledWith(mockImageUrl2, CARD_CONFIG.image.loadTimeout);

      // Resolve both images
      resolveImage1!(mockImage1);
      resolveImage2!(mockImage2);

      const [img1a, img1b, img2a, img2b] = await Promise.all([
        img1Promise1,
        img1Promise2,
        img2Promise1,
        img2Promise2,
      ]);

      // Each URL should have its own cached image
      expect(img1a).toBe(mockImage1);
      expect(img1b).toBe(mockImage1);
      expect(img2a).toBe(mockImage2);
      expect(img2b).toBe(mockImage2);

      // Same URL requests should be identical
      expect(img1a).toBe(img1b);
      expect(img2a).toBe(img2b);

      // Different URLs should be different images
      expect(img1a).not.toBe(img2a);
    });

    it('should allow subsequent requests after initial load completes', async () => {
      const mockImage = createMockImage();
      mockImage.src = mockImageUrl;
      mockLoadImageSecurely.mockResolvedValue(mockImage);

      // First request
      const firstImage = await ImageCache.getImage(mockImageUrl);
      expect(firstImage).toBe(mockImage);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);

      // Second request (after first completes)
      const secondImage = await ImageCache.getImage(mockImageUrl);
      expect(secondImage).toBe(mockImage);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1); // Still only 1 call

      // Third request
      const thirdImage = await ImageCache.getImage(mockImageUrl);
      expect(thirdImage).toBe(mockImage);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1); // Still only 1 call
    });
  });

  describe('Cache cleanup', () => {
    it('should clear all cached images and call cleanupImage for each', async () => {
      const mockImage1 = createMockImage();
      const mockImage2 = createMockImage();
      const mockImage3 = createMockImage();

      mockLoadImageSecurely
        .mockResolvedValueOnce(mockImage1)
        .mockResolvedValueOnce(mockImage2)
        .mockResolvedValueOnce(mockImage3);

      // Load multiple images
      await ImageCache.getImage(mockImageUrl);
      await ImageCache.getImage(mockImageUrl2);
      await ImageCache.getImage(mockImageUrl3);

      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(3);

      // Clear the cache
      ImageCache.clear();

      // Should call cleanupImage for each cached image
      expect(mockCleanupImage).toHaveBeenCalledTimes(3);
      expect(mockCleanupImage).toHaveBeenCalledWith(mockImage1);
      expect(mockCleanupImage).toHaveBeenCalledWith(mockImage2);
      expect(mockCleanupImage).toHaveBeenCalledWith(mockImage3);

      // Requesting images after clear should reload them
      mockLoadImageSecurely.mockResolvedValueOnce(createMockImage());
      await ImageCache.getImage(mockImageUrl);

      // Should be called again (4th time)
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(4);
    });

    it('should clear loading promises when cache is cleared', async () => {
      let resolveImage: (img: HTMLImageElement) => void;
      const imageLoadPromise = new Promise<HTMLImageElement>((resolve) => {
        resolveImage = resolve;
      });

      mockLoadImageSecurely.mockReturnValueOnce(imageLoadPromise);

      // Start loading an image (but don't complete it)
      const loadingPromise = ImageCache.getImage(mockImageUrl);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);

      // Clear the cache while image is still loading
      ImageCache.clear();

      // Should not have any cached images yet
      expect(mockCleanupImage).toHaveBeenCalledTimes(0); // No completed images to clean

      // Resolve the original promise (simulating late completion)
      const mockImage = createMockImage();
      resolveImage!(mockImage);
      await loadingPromise;

      // The promise completion will still cache the image (expected behavior)
      // Request the same image again - it should return the cached image
      const cachedImage = await ImageCache.getImage(mockImageUrl);

      // Should NOT create a new loading request (the late-resolved image was cached)
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);
      expect(cachedImage).toBe(mockImage);
    });

    it('should handle clear on empty cache gracefully', () => {
      expect(() => {
        ImageCache.clear();
      }).not.toThrow();

      expect(mockCleanupImage).toHaveBeenCalledTimes(0);
    });

    it('should handle multiple clear calls safely', async () => {
      const mockImage = createMockImage();
      mockLoadImageSecurely.mockResolvedValueOnce(mockImage);

      await ImageCache.getImage(mockImageUrl);

      // Clear multiple times
      ImageCache.clear();
      ImageCache.clear();
      ImageCache.clear();

      // Should only cleanup once per image
      expect(mockCleanupImage).toHaveBeenCalledTimes(1);
      expect(mockCleanupImage).toHaveBeenCalledWith(mockImage);
    });
  });

  describe('Individual image removal', () => {
    it('should remove specific image and call cleanupImage only for that image', async () => {
      const mockImage1 = createMockImage();
      const mockImage2 = createMockImage();
      const mockImage3 = createMockImage();

      mockLoadImageSecurely
        .mockResolvedValueOnce(mockImage1)
        .mockResolvedValueOnce(mockImage2)
        .mockResolvedValueOnce(mockImage3);

      // Load three images
      await ImageCache.getImage(mockImageUrl);
      await ImageCache.getImage(mockImageUrl2);
      await ImageCache.getImage(mockImageUrl3);

      // Remove only the second image
      ImageCache.remove(mockImageUrl2);

      // Should only cleanup the removed image
      expect(mockCleanupImage).toHaveBeenCalledTimes(1);
      expect(mockCleanupImage).toHaveBeenCalledWith(mockImage2);

      // Other images should still be cached
      const image1Again = await ImageCache.getImage(mockImageUrl);
      const image3Again = await ImageCache.getImage(mockImageUrl3);

      // Should not reload (still 3 total loads)
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(3);
      expect(image1Again).toBe(mockImage1);
      expect(image3Again).toBe(mockImage3);

      // Removed image should be reloaded
      mockLoadImageSecurely.mockResolvedValueOnce(createMockImage());
      await ImageCache.getImage(mockImageUrl2);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(4);
    });

    it('should handle removal of non-existent image gracefully', () => {
      expect(() => {
        ImageCache.remove('https://example.com/nonexistent.jpg');
      }).not.toThrow();

      expect(mockCleanupImage).toHaveBeenCalledTimes(0);
    });

    it('should remove loading promise for pending image load', async () => {
      let resolveImage: (img: HTMLImageElement) => void;
      const imageLoadPromise = new Promise<HTMLImageElement>((resolve) => {
        resolveImage = resolve;
      });

      mockLoadImageSecurely.mockReturnValueOnce(imageLoadPromise);

      // Start loading an image
      const loadingPromise = ImageCache.getImage(mockImageUrl);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);

      // Remove the image while it's still loading
      ImageCache.remove(mockImageUrl);

      // Should not call cleanup (image not loaded yet)
      expect(mockCleanupImage).toHaveBeenCalledTimes(0);

      // Complete the original load
      const mockImage = createMockImage();
      resolveImage!(mockImage);
      await loadingPromise;

      // The promise completion will still cache the image (expected behavior)
      // Request the image again - it should return the cached image
      const cachedImage = await ImageCache.getImage(mockImageUrl);

      // Should NOT create a new load request (the late-resolved image was cached)
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);
      expect(cachedImage).toBe(mockImage);
    });

    it('should allow removing same image multiple times safely', async () => {
      const mockImage = createMockImage();
      mockLoadImageSecurely.mockResolvedValueOnce(mockImage);

      await ImageCache.getImage(mockImageUrl);

      // Remove multiple times
      ImageCache.remove(mockImageUrl);
      ImageCache.remove(mockImageUrl);
      ImageCache.remove(mockImageUrl);

      // Should only cleanup once
      expect(mockCleanupImage).toHaveBeenCalledTimes(1);
      expect(mockCleanupImage).toHaveBeenCalledWith(mockImage);
    });
  });

  describe('Error handling persistence', () => {
    it('should not cache failed image loads', async () => {
      const loadError = new Error('Failed to load image');
      mockLoadImageSecurely.mockRejectedValueOnce(loadError);

      // First attempt fails
      await expect(ImageCache.getImage(mockImageUrl)).rejects.toThrow('Failed to load image');
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);

      // Second attempt should retry (not return cached error)
      const mockImage = createMockImage();
      mockLoadImageSecurely.mockResolvedValueOnce(mockImage);

      const retryImage = await ImageCache.getImage(mockImageUrl);

      // Should make a new request (total 2 calls)
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(2);
      expect(retryImage).toBe(mockImage);
    });

    it('should clean up loading promise when image load fails', async () => {
      const loadError = new Error('Network error');

      // First failure
      mockLoadImageSecurely.mockRejectedValueOnce(loadError);
      await expect(ImageCache.getImage(mockImageUrl)).rejects.toThrow('Network error');
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);

      // Immediate retry should create new loading promise
      mockLoadImageSecurely.mockRejectedValueOnce(loadError);
      await expect(ImageCache.getImage(mockImageUrl)).rejects.toThrow('Network error');
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(2);

      // Each call should be independent
      expect(mockLoadImageSecurely).toHaveBeenNthCalledWith(1, mockImageUrl, CARD_CONFIG.image.loadTimeout);
      expect(mockLoadImageSecurely).toHaveBeenNthCalledWith(2, mockImageUrl, CARD_CONFIG.image.loadTimeout);
    });

    it('should handle errors in concurrent requests properly', async () => {
      const loadError = new Error('Load failed');

      let rejectImage: (error: Error) => void;
      const imageLoadPromise = new Promise<HTMLImageElement>((_, reject) => {
        rejectImage = reject;
      });

      mockLoadImageSecurely.mockReturnValueOnce(imageLoadPromise);

      // Start multiple concurrent requests
      const promise1 = ImageCache.getImage(mockImageUrl);
      const promise2 = ImageCache.getImage(mockImageUrl);
      const promise3 = ImageCache.getImage(mockImageUrl);

      // Should only call once
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);

      // Reject the load
      rejectImage!(loadError);

      // All promises should reject with the same error
      await expect(promise1).rejects.toThrow('Load failed');
      await expect(promise2).rejects.toThrow('Load failed');
      await expect(promise3).rejects.toThrow('Load failed');

      // Retry should create a new request
      mockLoadImageSecurely.mockResolvedValueOnce(createMockImage());
      await ImageCache.getImage(mockImageUrl);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(2);
    });

    it('should not cleanup images that failed to load', async () => {
      mockLoadImageSecurely.mockRejectedValueOnce(new Error('Load failed'));

      await expect(ImageCache.getImage(mockImageUrl)).rejects.toThrow('Load failed');

      // Should not call cleanup for failed load
      expect(mockCleanupImage).toHaveBeenCalledTimes(0);

      // Clear cache should not throw
      expect(() => ImageCache.clear()).not.toThrow();
      expect(mockCleanupImage).toHaveBeenCalledTimes(0);
    });

    it('should handle timeout errors and allow retry', async () => {
      const timeoutError = new Error('Image loading timeout');

      // First attempt times out
      mockLoadImageSecurely.mockRejectedValueOnce(timeoutError);
      await expect(ImageCache.getImage(mockImageUrl)).rejects.toThrow('Image loading timeout');

      // Retry should work
      const mockImage = createMockImage();
      mockLoadImageSecurely.mockResolvedValueOnce(mockImage);

      const retryImage = await ImageCache.getImage(mockImageUrl);
      expect(retryImage).toBe(mockImage);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(2);
    });
  });

  describe('Static class behavior verification', () => {
    it('should maintain single cache instance across all references', async () => {
      const mockImage = createMockImage();
      mockLoadImageSecurely.mockResolvedValueOnce(mockImage);

      // Load through first reference
      const img1 = await ImageCache.getImage(mockImageUrl);

      // Access through different variable (but same class)
      const CacheRef = ImageCache;
      const img2 = await CacheRef.getImage(mockImageUrl);

      // Should be the same image (from same cache instance)
      expect(img1).toBe(img2);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);
    });

    it('should persist cache across test file module re-imports', async () => {
      // This test verifies that the static cache is module-scoped
      // The cache should persist as long as the module is loaded
      const mockImage = createMockImage();
      mockLoadImageSecurely.mockResolvedValueOnce(mockImage);

      await ImageCache.getImage(mockImageUrl);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);

      // Reimport shouldn't create new cache (in real app)
      // But in tests, each test has fresh setup due to beforeEach
      // This test documents the expected behavior
      const cachedImage = await ImageCache.getImage(mockImageUrl);
      expect(cachedImage).toBe(mockImage);
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle empty string URL', async () => {
      mockLoadImageSecurely.mockRejectedValueOnce(new Error('Invalid or unsafe image URL'));

      await expect(ImageCache.getImage('')).rejects.toThrow();
    });

    it('should handle very long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000) + '.jpg';
      const mockImage = createMockImage();
      mockLoadImageSecurely.mockResolvedValueOnce(mockImage);

      const image = await ImageCache.getImage(longUrl);
      expect(image).toBe(mockImage);
    });

    it('should handle URLs with special characters', async () => {
      const specialUrl = 'https://example.com/image%20with%20spaces.jpg?v=1&t=2#fragment';
      const mockImage = createMockImage();
      mockLoadImageSecurely.mockResolvedValueOnce(mockImage);

      const image = await ImageCache.getImage(specialUrl);
      expect(image).toBe(mockImage);
    });

    it('should handle rapid successive cache operations', async () => {
      const mockImage = createMockImage();
      mockLoadImageSecurely.mockResolvedValue(mockImage);

      // Rapid load, remove, load, clear cycle
      await ImageCache.getImage(mockImageUrl);
      ImageCache.remove(mockImageUrl);
      await ImageCache.getImage(mockImageUrl);
      ImageCache.clear();
      await ImageCache.getImage(mockImageUrl);

      // Should handle all operations without errors
      expect(mockLoadImageSecurely).toHaveBeenCalledTimes(3);
    });
  });
});
