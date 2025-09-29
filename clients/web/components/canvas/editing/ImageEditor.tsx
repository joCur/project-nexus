/**
 * ImageEditor Component
 *
 * Inline image editor for editing image cards.
 * Built on BaseEditor component with image-specific features:
 * - Image URL input with validation (jpg, jpeg, png, gif, svg, webp)
 * - Required alt text for accessibility
 * - Optional caption text
 * - Image size selection (small, medium, large, full)
 * - Alignment options (left, center, right)
 * - Live image preview with loading states
 *
 * Required Context Providers:
 * - None (self-contained component)
 *
 * @remarks This component has no external context dependencies and can be used standalone.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BaseEditor } from './BaseEditor';

// Constants
const IMAGE_EXTENSIONS_REGEX = /\.(jpg|jpeg|png|gif|svg|webp)$/i;
const DEFAULT_SIZE: ImageData['size'] = 'medium';
const DEFAULT_ALIGNMENT: ImageData['alignment'] = 'center';

const SIZE_OPTIONS = [
  { value: 'small' as const, label: 'Small' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'large' as const, label: 'Large' },
  { value: 'full' as const, label: 'Full Width' },
];

const ALIGNMENT_OPTIONS = [
  { value: 'left' as const, label: 'Left' },
  { value: 'center' as const, label: 'Center' },
  { value: 'right' as const, label: 'Right' },
];

// Types
export interface ImageData {
  url: string;
  alt: string;
  caption: string;
  size: 'small' | 'medium' | 'large' | 'full';
  alignment: 'left' | 'center' | 'right';
}

interface ImageEditorProps {
  initialData?: Partial<ImageData>;
  onSave: (data: ImageData) => void;
  onCancel: () => void;
}

type PreviewState = 'idle' | 'loading' | 'success' | 'error';

// Utility functions
const isValidUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isImageUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    return IMAGE_EXTENSIONS_REGEX.test(url.pathname);
  } catch {
    return false;
  }
};

// Custom hook for image preview loading
const useImagePreview = (url: string): PreviewState => {
  const [previewState, setPreviewState] = useState<PreviewState>('idle');

  useEffect(() => {
    if (!url || !isValidUrl(url)) {
      setPreviewState('idle');
      return;
    }

    setPreviewState('loading');
    const img = new Image();

    const handleLoad = () => setPreviewState('success');
    const handleError = () => setPreviewState('error');

    img.onload = handleLoad;
    img.onerror = handleError;
    img.src = url;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return previewState;
};

// Main component
export function ImageEditor({ initialData, onSave, onCancel }: ImageEditorProps) {
  // Initialize with full ImageData structure
  const defaultData: ImageData = {
    url: '',
    alt: '',
    caption: '',
    size: DEFAULT_SIZE,
    alignment: DEFAULT_ALIGNMENT,
    ...initialData
  };

  // Form state
  const [url, setUrl] = useState(defaultData.url);
  const [alt, setAlt] = useState(defaultData.alt);
  const [caption, setCaption] = useState(defaultData.caption);
  const [size, setSize] = useState<ImageData['size']>(defaultData.size);
  const [alignment, setAlignment] = useState<ImageData['alignment']>(defaultData.alignment);

  // Error state
  const [urlError, setUrlError] = useState('');
  const [altError, setAltError] = useState('');

  // Use custom hook for image preview
  const previewState = useImagePreview(url);

  // Validate URL on blur
  const handleUrlBlur = () => {
    if (url && !isValidUrl(url)) {
      setUrlError('Please enter a valid URL');
    } else if (url && !isImageUrl(url)) {
      setUrlError('URL must point to an image (jpg, jpeg, png, gif, svg, webp)');
    } else {
      setUrlError('');
    }
  };

  // Handle form submission
  const handleSave = useCallback(() => {
    let hasErrors = false;

    // Validate required fields
    if (!url) {
      setUrlError('Image URL is required');
      hasErrors = true;
    } else if (!isValidUrl(url)) {
      setUrlError('Please enter a valid URL');
      hasErrors = true;
    } else if (!isImageUrl(url)) {
      setUrlError('URL must point to an image');
      hasErrors = true;
    }

    if (!alt) {
      setAltError('Alt text is required for accessibility');
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    onSave({
      url,
      alt,
      caption,
      size,
      alignment,
    });
  }, [url, alt, caption, size, alignment, onSave]);

  return (
    <BaseEditor<ImageData>
      initialValue={defaultData}
      onSave={handleSave}
      onCancel={onCancel}
      showControls={true}
    >
      {(() => (
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Image Settings</h2>
          <div className="space-y-4">
        {/* URL Input */}
        <div>
          <label
            htmlFor="image-url"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Image URL *
          </label>
          <input
            id="image-url"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setUrlError('');
            }}
            onBlur={handleUrlBlur}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="https://example.com/image.jpg"
            aria-required="true"
            aria-invalid={!!urlError}
            aria-describedby={urlError ? 'url-error' : undefined}
          />
          {urlError && (
            <p id="url-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {urlError}
            </p>
          )}
        </div>

        {/* Alt Text Input */}
        <div>
          <label
            htmlFor="image-alt"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Alt Text * (for accessibility)
          </label>
          <input
            id="image-alt"
            type="text"
            value={alt}
            onChange={(e) => {
              setAlt(e.target.value);
              setAltError('');
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Describe the image for screen readers"
            aria-required="true"
            aria-invalid={!!altError}
            aria-describedby={altError ? 'alt-error' : undefined}
          />
          {altError && (
            <p id="alt-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {altError}
            </p>
          )}
        </div>

        {/* Caption Input */}
        <div>
          <label
            htmlFor="image-caption"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Caption (optional)
          </label>
          <input
            id="image-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Optional caption for the image"
            aria-required="false"
          />
        </div>

        {/* Image Preview */}
        {url && isValidUrl(url) && (
          <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</p>
            {previewState === 'loading' && (
              <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                Loading preview...
              </div>
            )}
            {previewState === 'success' && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Preview"
                  className="max-w-full max-h-48 object-contain"
                />
              </div>
            )}
            {previewState === 'error' && (
              <div className="flex items-center justify-center h-32 text-red-600 dark:text-red-400">
                Failed to load image
              </div>
            )}
          </div>
        )}

        {/* Size Selection */}
        <fieldset>
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Image Size
          </legend>
          <div className="space-y-2">
            {SIZE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  name="size"
                  value={option.value}
                  checked={size === option.value}
                  onChange={(e) => setSize(e.target.value as ImageData['size'])}
                  className="mr-2"
                  aria-label={option.label}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Alignment Selection */}
        <fieldset>
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Alignment
          </legend>
          <div className="space-y-2">
            {ALIGNMENT_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  name="alignment"
                  value={option.value}
                  checked={alignment === option.value}
                  onChange={(e) => setAlignment(e.target.value as ImageData['alignment'])}
                  className="mr-2"
                  aria-label={option.label}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
          </div>
        </div>
      ))}
    </BaseEditor>
  );
}