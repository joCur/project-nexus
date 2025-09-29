import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BaseEditor } from './BaseEditor';

interface LinkEditorProps {
  onSave: (value: LinkValue) => void;
  onCancel: () => void;
  initialValue?: LinkValue;
}

interface LinkValue {
  url: string;
  text: string;
  target: '_self' | '_blank';
}

/**
 * LinkEditor component for inline link editing
 * Provides URL input with validation, display text, target options, and link preview
 */
export const LinkEditor: React.FC<LinkEditorProps> = ({
  onSave,
  onCancel,
  initialValue = { url: '', text: '', target: '_self' }
}) => {
  const [url, setUrl] = useState(initialValue.url);
  const [displayText, setDisplayText] = useState(initialValue.text);
  const [target, setTarget] = useState(initialValue.target);
  const [urlError, setUrlError] = useState<string>('');
  const [isValidUrl, setIsValidUrl] = useState(false);
  const hasUserEditedTextRef = useRef(!!initialValue.text);
  const lastAutoFilledUrlRef = useRef<string>('');

  /**
   * Validates a URL string
   */
  const validateUrl = useCallback((urlString: string): boolean => {
    if (!urlString) return false;

    // Support protocol-relative URLs
    if (urlString.startsWith('//')) {
      try {
        new URL(`https:${urlString}`);
        return true;
      } catch {
        return false;
      }
    }

    // Support mailto links
    if (urlString.startsWith('mailto:')) {
      return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(urlString);
    }

    // Regular URL validation
    try {
      const urlObj = new URL(urlString);
      return ['http:', 'https:', 'mailto:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }, []);

  /**
   * Extract domain from URL for display
   */
  const getDomain = useCallback((urlString: string): string => {
    try {
      let processedUrl = urlString;
      if (urlString.startsWith('//')) {
        processedUrl = `https:${urlString}`;
      }
      const urlObj = new URL(processedUrl);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }, []);

  /**
   * Handle URL input changes
   */
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);

    // Clear error when typing
    if (urlError) {
      setUrlError('');
    }

    // Validate URL
    const isValid = validateUrl(newUrl);
    setIsValidUrl(isValid);
  }, [urlError, validateUrl]);

  /**
   * Handle display text changes
   */
  const handleDisplayTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayText(newValue);
    // Mark as user edited when they change the field
    hasUserEditedTextRef.current = true;
  }, []);

  /**
   * Handle display text focus - mark as edited when user focuses the field
   */
  const handleDisplayTextFocus = useCallback(() => {
    // Don't immediately mark as edited on focus, wait for actual typing
  }, []);

  /**
   * Handle target checkbox change
   */
  const handleTargetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTarget(e.target.checked ? '_blank' : '_self');
  }, []);

  /**
   * Handle save action
   */
  const handleSave = useCallback(() => {
    // Validate required fields
    if (!url) {
      setUrlError('URL is required');
      return;
    }

    // Validate URL format
    if (!validateUrl(url)) {
      setUrlError('Please enter a valid URL');
      return;
    }

    // Use URL domain as display text if empty
    const finalText = displayText || getDomain(url);

    onSave({
      url,
      text: finalText,
      target
    });
  }, [url, displayText, target, validateUrl, getDomain, onSave]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleSave, onCancel]);

  // Auto-fill display text from URL when URL becomes valid
  useEffect(() => {
    // Only auto-fill if:
    // 1. URL is valid
    // 2. User hasn't edited the text field
    // 3. We haven't already auto-filled for this exact URL
    if (isValidUrl && url && !hasUserEditedTextRef.current && lastAutoFilledUrlRef.current !== url) {
      const domain = getDomain(url);
      if (domain) {
        setDisplayText(currentText => {
          // Only auto-fill if text is empty
          if (!currentText) {
            lastAutoFilledUrlRef.current = url;
            return domain;
          }
          return currentText;
        });
      }
    }
  }, [isValidUrl, url, getDomain]);

  // Show real-time validation for invalid URLs
  useEffect(() => {
    if (url && !isValidUrl) {
      const timer = setTimeout(() => {
        setUrlError('Please enter a valid URL');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [url, isValidUrl]);

  /**
   * Get favicon URL for a domain
   */
  const getFaviconUrl = (urlString: string): string => {
    const domain = getDomain(urlString);
    if (!domain) return '';
    // Using Google's favicon service as a reliable source
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  };

  return (
    <BaseEditor<LinkValue>
      initialValue={{ url, text: displayText, target }}
      onSave={handleSave}
      onCancel={onCancel}
      showControls={false}
    >
      {() => (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
        {/* URL Input */}
        <div>
          <label
            htmlFor="link-url"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            URL
          </label>
          <input
            id="link-url"
            type="text"
            value={url}
            onChange={handleUrlChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              urlError ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="https://example.com"
            aria-invalid={!!urlError}
            aria-describedby={urlError ? 'url-error' : undefined}
          />
          {urlError && (
            <p
              id="url-error"
              className="mt-1 text-sm text-red-600"
              role="alert"
            >
              {urlError}
            </p>
          )}
        </div>

        {/* Display Text Input */}
        <div>
          <label
            htmlFor="link-text"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Display Text
          </label>
          <input
            id="link-text"
            type="text"
            value={displayText}
            onChange={handleDisplayTextChange}
            onFocus={handleDisplayTextFocus}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Link text (optional)"
          />
        </div>

        {/* Target Option */}
        <div className="flex items-center">
          <input
            id="link-target"
            type="checkbox"
            checked={target === '_blank'}
            onChange={handleTargetChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="link-target"
            className="ml-2 text-sm text-gray-700"
          >
            Open in new tab
          </label>
        </div>

        {/* Link Preview */}
        {isValidUrl && url && (
          <div
            data-testid="link-preview"
            className="p-3 bg-gray-50 rounded-md border border-gray-200"
          >
            <div className="flex items-center space-x-2">
              <img
                src={getFaviconUrl(url)}
                alt={`${getDomain(url)} favicon`}
                className="w-4 h-4"
                onError={(e) => {
                  // Hide image on error
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="text-sm text-gray-600">
                {getDomain(url)}
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-500 truncate">
              {url}
            </div>
          </div>
        )}
      </div>
      )}
    </BaseEditor>
  );
};