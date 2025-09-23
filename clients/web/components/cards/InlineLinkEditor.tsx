/**
 * InlineLinkEditor - URL editing with validation and preview
 *
 * Features:
 * - URL input field with validation
 * - Title and description editing
 * - Auto-protocol addition (http/https)
 * - URL validation and preview
 * - Domain extraction
 * - Link metadata display
 * - Immediate visual feedback (<100ms requirement)
 */

'use client';

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  KeyboardEvent,
  ChangeEvent
} from 'react';
import { cn } from '@/lib/utils';
import type { LinkCardContent } from '@/types/card.types';

interface InlineLinkEditorProps {
  /** Current link content */
  content: LinkCardContent;
  /** Card dimensions for sizing */
  dimensions: { width: number; height: number };
  /** Style configuration */
  style: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    borderWidth: number;
    borderRadius: number;
  };
  /** Auto-focus when editor mounts */
  autoFocus?: boolean;
  /** Called when content changes (immediate feedback) */
  onChange: (content: LinkCardContent) => void;
  /** Called when editing is complete */
  onComplete: (content: LinkCardContent) => void;
  /** Called when editing is cancelled */
  onCancel: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Validates URL format and adds protocol if missing
 */
const validateAndFormatUrl = (url: string): { isValid: boolean; formattedUrl: string; domain: string } => {
  if (!url.trim()) {
    return { isValid: false, formattedUrl: url, domain: '' };
  }

  let formattedUrl = url.trim();

  // Add protocol if missing
  if (!formattedUrl.match(/^https?:\/\//)) {
    formattedUrl = `https://${formattedUrl}`;
  }

  try {
    const urlObject = new URL(formattedUrl);
    return {
      isValid: true,
      formattedUrl,
      domain: urlObject.hostname,
    };
  } catch {
    return { isValid: false, formattedUrl, domain: '' };
  }
};

/**
 * Extract domain from URL for display
 */
const extractDomain = (url: string): string => {
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch {
    return '';
  }
};

/**
 * Fetch link metadata (placeholder for actual implementation)
 */
const fetchLinkMetadata = async (url: string): Promise<{
  title?: string;
  description?: string;
  favicon?: string;
  previewImage?: string;
}> => {
  // Link metadata fetching tracked in NEX-201
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const domain = extractDomain(url);
        resolve({
          title: `Link to ${domain}`,
          description: `Preview of content from ${domain}`,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        });
      } catch {
        resolve({});
      }
    }, 500);
  });
};

/**
 * InlineLinkEditor component
 */
export const InlineLinkEditor: React.FC<InlineLinkEditorProps> = ({
  content,
  dimensions,
  style,
  autoFocus = true,
  onChange,
  onComplete,
  onCancel,
  className,
}) => {
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState(content.url);
  const [localTitle, setLocalTitle] = useState(content.title);
  const [localDescription, setLocalDescription] = useState(content.description || '');
  const [urlValidation, setUrlValidation] = useState(validateAndFormatUrl(content.url));
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Calculate responsive font size
  const fontSize = useMemo(() => {
    const baseSize = 14;
    const scaleFactor = Math.min(dimensions.width / 350, dimensions.height / 150);
    return Math.max(12, Math.min(16, baseSize * scaleFactor));
  }, [dimensions.width, dimensions.height]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && urlInputRef.current) {
      urlInputRef.current.focus();
      urlInputRef.current.select();
    }
  }, [autoFocus]);

  // Validate URL when it changes
  useEffect(() => {
    const validation = validateAndFormatUrl(localUrl);
    setUrlValidation(validation);

    // Fetch metadata for valid URLs
    if (validation.isValid && validation.formattedUrl !== content.url) {
      setIsLoadingMetadata(true);
      fetchLinkMetadata(validation.formattedUrl)
        .then((metadata) => {
          if (metadata.title && !localTitle) {
            setLocalTitle(metadata.title);
          }
          if (metadata.description && !localDescription) {
            setLocalDescription(metadata.description);
          }

          // Update content with metadata
          const updatedContent: LinkCardContent = {
            ...content,
            url: validation.formattedUrl,
            title: metadata.title || localTitle,
            description: metadata.description || localDescription,
            domain: validation.domain,
            favicon: metadata.favicon,
            previewImage: metadata.previewImage,
            lastChecked: new Date().toISOString(),
            isAccessible: true,
          };
          onChange(updatedContent);
        })
        .catch(() => {
          // Handle metadata fetch failure
        })
        .finally(() => {
          setIsLoadingMetadata(false);
        });
    }
  }, [localUrl, content.url, content, localTitle, localDescription, onChange]);

  // Handle URL changes with immediate feedback
  const handleUrlChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setLocalUrl(newUrl);

    const validation = validateAndFormatUrl(newUrl);
    const updatedContent: LinkCardContent = {
      ...content,
      url: validation.formattedUrl,
      title: localTitle,
      description: localDescription,
      domain: validation.domain,
      isAccessible: validation.isValid,
    };

    onChange(updatedContent);
  }, [content, localTitle, localDescription, onChange]);

  // Handle title change
  const handleTitleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setLocalTitle(newTitle);

    const updatedContent: LinkCardContent = {
      ...content,
      url: urlValidation.formattedUrl,
      title: newTitle,
      description: localDescription,
      domain: urlValidation.domain,
    };

    onChange(updatedContent);
  }, [content, urlValidation.formattedUrl, urlValidation.domain, localDescription, onChange]);

  // Handle description change
  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    setLocalDescription(newDescription);

    const updatedContent: LinkCardContent = {
      ...content,
      url: urlValidation.formattedUrl,
      title: localTitle,
      description: newDescription,
      domain: urlValidation.domain,
    };

    onChange(updatedContent);
  }, [content, urlValidation.formattedUrl, urlValidation.domain, localTitle, onChange]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Complete editing on Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    // Complete editing on Ctrl/Cmd + Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const finalContent: LinkCardContent = {
        ...content,
        url: urlValidation.formattedUrl,
        title: localTitle,
        description: localDescription,
        domain: urlValidation.domain,
        isAccessible: urlValidation.isValid,
      };
      onComplete(finalContent);
      return;
    }
  }, [content, urlValidation, localTitle, localDescription, onComplete, onCancel]);

  // Handle blur
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Check if blur is due to interacting with other form elements
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('[data-link-form]')) {
      return; // Don't complete editing
    }

    const finalContent: LinkCardContent = {
      ...content,
      url: urlValidation.formattedUrl,
      title: localTitle,
      description: localDescription,
      domain: urlValidation.domain,
      isAccessible: urlValidation.isValid,
    };
    onComplete(finalContent);
  }, [content, urlValidation, localTitle, localDescription, onComplete]);

  return (
    <div
      className={cn(
        'absolute inset-0 bg-card-background border-2 border-primary-500',
        'shadow-lg rounded-lg overflow-hidden z-50',
        className
      )}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: style.backgroundColor,
        borderRadius: `${style.borderRadius}px`,
      }}
    >
      {/* Header */}
      <div className="p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600 font-medium">Link Editor</span>
          <div className="flex items-center gap-2">
            {isLoadingMetadata && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <span className="text-xs text-gray-400">
              Ctrl+Enter to save, Esc to cancel
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div data-link-form className="p-3 space-y-3" style={{ fontSize: `${fontSize}px` }}>
        {/* URL Input */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            URL
          </label>
          <div className="relative">
            <input
              ref={urlInputRef}
              type="url"
              value={localUrl}
              onChange={handleUrlChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="https://example.com"
              className={cn(
                'w-full px-3 py-2 border rounded-md text-sm',
                urlValidation.isValid
                  ? 'border-green-300 bg-green-50'
                  : localUrl && !urlValidation.isValid
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300'
              )}
            />
            {urlValidation.isValid && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-green-500">
                ✓
              </div>
            )}
          </div>
          {localUrl && !urlValidation.isValid && (
            <p className="text-xs text-red-600 mt-1">Please enter a valid URL</p>
          )}
        </div>

        {/* Title Input */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            value={localTitle}
            onChange={handleTitleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Link title"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        {/* Description Input */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={localDescription}
            onChange={handleDescriptionChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Link description (optional)"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
          />
        </div>

        {/* Link Preview */}
        {urlValidation.isValid && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <div className="flex items-start gap-3">
              {content.favicon && (
                <img
                  src={content.favicon}
                  alt="Favicon"
                  className="w-4 h-4 mt-1 flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {localTitle || urlValidation.domain}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {urlValidation.domain}
                </p>
                {localDescription && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {localDescription}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Accessibility Status */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">
            Domain: {urlValidation.domain || 'Not specified'}
          </span>
          <span className={cn(
            'px-2 py-1 rounded',
            content.isAccessible
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          )}>
            {content.isAccessible ? 'Accessible' : 'Not accessible'}
          </span>
        </div>
      </div>

      {/* Last Checked Indicator */}
      {content.lastChecked && (
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-gray-800 bg-opacity-75 rounded text-xs text-white">
          Checked: {new Date(content.lastChecked).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};