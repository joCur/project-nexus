'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { cn } from '@/lib/utils';
import CardTypeSelector from './CardTypeSelector';
import type { CardType, CreateCardParams } from '@/types/card.types';
import type { CanvasPosition } from '@/types/canvas.types';

/**
 * Form data for card creation
 */
interface CardCreationFormData {
  type: CardType;
  title?: string;
  content?: string;
  url?: string;
  language?: string;
  alt?: string;
  caption?: string;
  filename?: string;
}

/**
 * Props for the CreateCardModal component
 */
export interface CreateCardModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should be closed */
  onClose: () => void;
  /** Callback when card should be created */
  onCreateCard: (params: CreateCardParams) => Promise<void>;
  /** Initial card type selection */
  initialType?: CardType;
  /** Position where card will be created */
  position?: CanvasPosition;
  /** Whether creation is in progress */
  isCreating?: boolean;
  /** Creation error if any */
  error?: string | null;
  /** Callback to clear error */
  onClearError?: () => void;
}

/**
 * Get default form data for card type
 */
const getDefaultFormData = (type: CardType): CardCreationFormData => ({
  type,
  title: '',
  content: '',
  url: '',
  language: 'javascript',
  alt: '',
  caption: '',
  filename: '',
});

/**
 * Get placeholders for card type
 */
const getPlaceholders = (type: CardType) => {
  switch (type) {
    case 'text':
      return {
        title: 'Card title (optional)',
        content: 'Type your text here...',
      };
    case 'image':
      return {
        url: 'https://example.com/image.jpg',
        alt: 'Image description',
        caption: 'Image caption (optional)',
      };
    case 'link':
      return {
        url: 'https://example.com',
        title: 'Link title (optional)',
      };
    case 'code':
      return {
        content: 'console.log("Hello, world!");',
        filename: 'example.js (optional)',
      };
    default:
      return {};
  }
};

/**
 * Advanced card creation modal with full form inputs and customization options
 *
 * Features:
 * - Full CardTypeSelector integration with visual picker
 * - Type-specific form fields and validation
 * - Position override options
 * - Real-time preview of content
 * - Form validation with helpful error messages
 * - Keyboard shortcuts and accessibility
 * - Loading states and error handling
 * - Responsive design for different screen sizes
 */
export const CreateCardModal: React.FC<CreateCardModalProps> = ({
  isOpen,
  onClose,
  onCreateCard,
  initialType = 'text',
  position,
  isCreating = false,
  error = null,
  onClearError,
}) => {
  const [formData, setFormData] = useState<CardCreationFormData>(
    getDefaultFormData(initialType)
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Reset form when modal opens/closes or type changes
  useEffect(() => {
    if (isOpen) {
      setFormData(getDefaultFormData(initialType));
      setValidationErrors({});
      onClearError?.();
    }
  }, [isOpen, initialType, onClearError]);

  // Update form data when type changes
  useEffect(() => {
    setFormData(prev => ({
      ...getDefaultFormData(formData.type),
      type: formData.type,
    }));
    setValidationErrors({});
  }, [formData.type]);

  /**
   * Handle form field changes
   */
  const handleFieldChange = (field: keyof CardCreationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  /**
   * Handle card type selection
   */
  const handleTypeSelect = (type: CardType) => {
    setFormData(prev => ({
      ...getDefaultFormData(type),
      type,
    }));
    setValidationErrors({});
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    switch (formData.type) {
      case 'text':
        if (!formData.content?.trim()) {
          errors.content = 'Content is required';
        }
        break;
      case 'image':
        if (!formData.url?.trim()) {
          errors.url = 'Image URL is required';
        } else {
          // Simple URL validation with regex
          const urlRegex = /^https?:\/\/.+/i;
          if (!urlRegex.test(formData.url)) {
            errors.url = 'Please enter a valid URL';
          }
        }
        if (!formData.alt?.trim()) {
          errors.alt = 'Alt text is required for accessibility';
        }
        break;
      case 'link':
        if (!formData.url?.trim()) {
          errors.url = 'URL is required';
        } else {
          // Simple URL validation with regex
          const urlRegex = /^https?:\/\/.+/i;
          if (!urlRegex.test(formData.url)) {
            errors.url = 'Please enter a valid URL';
          }
        }
        break;
      case 'code':
        if (!formData.content?.trim()) {
          errors.content = 'Code content is required';
        }
        break;
    }


    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isCreating || isSubmitting) {
      return;
    }

    // Always run validation and wait for state update
    const isValid = validateForm();
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);

    // Create card content based on type
    let content: any;
    switch (formData.type) {
      case 'text':
        content = {
          type: 'text',
          content: formData.content || '',
          markdown: false,
          wordCount: (formData.content || '').split(/\s+/).filter(word => word.length > 0).length,
          lastEditedAt: new Date().toISOString(),
        };
        break;
      case 'image':
        content = {
          type: 'image',
          url: formData.url || '',
          alt: formData.alt || '',
          caption: formData.caption || undefined,
        };
        break;
      case 'link':
        const url = new URL(formData.url || '');
        content = {
          type: 'link',
          url: formData.url || '',
          title: formData.title || url.hostname,
          domain: url.hostname,
          isAccessible: true,
        };
        break;
      case 'code':
        content = {
          type: 'code',
          language: formData.language || 'javascript',
          content: formData.content || '',
          lineCount: (formData.content || '').split('\n').length,
        };
        break;
    }

    const params: CreateCardParams = {
      type: formData.type,
      position: position || { x: 0, y: 0, z: Date.now() },
      content,
      dimensions: {
        width: formData.type === 'text' ? 250 : formData.type === 'image' ? 300 : 250,
        height: formData.type === 'text' ? 150 : formData.type === 'image' ? 200 : 150,
      },
      ...(formData.type === 'text' && formData.title && {
        metadata: {
          title: formData.title,
        },
      }),
      ...(formData.type === 'code' && formData.filename && {
        metadata: {
          filename: formData.filename,
        },
      }),
    };

    try {
      await onCreateCard(params);
      onClose();
    } catch (error) {
      // Error handling is done by parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Render type-specific form fields
   */
  const renderFormFields = () => {
    const placeholders = getPlaceholders(formData.type);

    switch (formData.type) {
      case 'text':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title (Optional)
              </label>
              <input
                type="text"
                id="title"
                value={formData.title || ''}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder={placeholders.title}
                disabled={isCreating || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                Content *
              </label>
              <textarea
                id="content"
                rows={6}
                value={formData.content || ''}
                onChange={(e) => handleFieldChange('content', e.target.value)}
                placeholder={placeholders.content}
                disabled={isCreating || isSubmitting}
                className={cn(
                  'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500',
                  validationErrors.content ? 'border-red-500' : 'border-gray-300'
                )}
              />
              {validationErrors.content && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.content}</p>
              )}
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                Image URL *
              </label>
              <input
                type="url"
                id="url"
                value={formData.url || ''}
                onChange={(e) => handleFieldChange('url', e.target.value)}
                placeholder={placeholders.url}
                disabled={isCreating || isSubmitting}
                className={cn(
                  'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500',
                  validationErrors.url ? 'border-red-500' : 'border-gray-300'
                )}
              />
              {validationErrors.url && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.url}</p>
              )}
            </div>
            <div>
              <label htmlFor="alt" className="block text-sm font-medium text-gray-700 mb-2">
                Alt Text * <span className="text-gray-500">(for accessibility)</span>
              </label>
              <input
                type="text"
                id="alt"
                value={formData.alt || ''}
                onChange={(e) => handleFieldChange('alt', e.target.value)}
                placeholder={placeholders.alt}
                disabled={isCreating || isSubmitting}
                className={cn(
                  'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500',
                  validationErrors.alt ? 'border-red-500' : 'border-gray-300'
                )}
              />
              {validationErrors.alt && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.alt}</p>
              )}
            </div>
            <div>
              <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-2">
                Caption (Optional)
              </label>
              <input
                type="text"
                id="caption"
                value={formData.caption || ''}
                onChange={(e) => handleFieldChange('caption', e.target.value)}
                placeholder={placeholders.caption}
                disabled={isCreating || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        );

      case 'link':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                URL *
              </label>
              <input
                type="url"
                id="url"
                value={formData.url || ''}
                onChange={(e) => handleFieldChange('url', e.target.value)}
                placeholder={placeholders.url}
                disabled={isCreating || isSubmitting}
                className={cn(
                  'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500',
                  validationErrors.url ? 'border-red-500' : 'border-gray-300'
                )}
              />
              {validationErrors.url && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.url}</p>
              )}
            </div>
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title (Optional)
              </label>
              <input
                type="text"
                id="title"
                value={formData.title || ''}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder={placeholders.title}
                disabled={isCreating || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-gray-500 text-sm mt-1">
                If not provided, the domain name will be used
              </p>
            </div>
          </div>
        );

      case 'code':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                id="language"
                value={formData.language || 'javascript'}
                onChange={(e) => handleFieldChange('language', e.target.value)}
                disabled={isCreating || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="sql">SQL</option>
                <option value="bash">Bash</option>
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
                <option value="markdown">Markdown</option>
                <option value="text">Plain Text</option>
              </select>
            </div>
            <div>
              <label htmlFor="filename" className="block text-sm font-medium text-gray-700 mb-2">
                Filename (Optional)
              </label>
              <input
                type="text"
                id="filename"
                value={formData.filename || ''}
                onChange={(e) => handleFieldChange('filename', e.target.value)}
                placeholder={placeholders.filename}
                disabled={isCreating || isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                Code *
              </label>
              <textarea
                id="content"
                rows={8}
                value={formData.content || ''}
                onChange={(e) => handleFieldChange('content', e.target.value)}
                placeholder={placeholders.content}
                disabled={isCreating || isSubmitting}
                className={cn(
                  'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm',
                  validationErrors.content ? 'border-red-500' : 'border-gray-300'
                )}
              />
              {validationErrors.content && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.content}</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  Create New Card
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Card Type Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Card Type
                    </label>
<CardTypeSelector
                      selectedType={formData.type}
                      onTypeSelect={handleTypeSelect}
                      variant="grid"
                      size="sm"
                      showDescriptions={false}
                      showShortcuts={false}
                    />
                  </div>

                  {/* Type-specific form fields */}
                  {renderFormFields()}

                  {/* Error message */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Error</h3>
                          <div className="mt-2 text-sm text-red-700">{error}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isCreating || isSubmitting}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating || isSubmitting}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
                    >
                      {(isCreating || isSubmitting) && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      )}
                      Create Card
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreateCardModal;