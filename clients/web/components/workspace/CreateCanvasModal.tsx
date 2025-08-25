'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCreateCanvas, useSetDefaultCanvas } from '@/hooks/use-canvas';
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter, Button, Input } from '@/components/ui';
import type { EntityId } from '@/types/common.types';
import type { CreateCanvasParams } from '@/types/workspace.types';

interface CreateCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: EntityId;
}

interface FormData {
  name: string;
  description: string;
  isDefault: boolean;
}

interface FormErrors {
  name?: string;
  description?: string;
  general?: string;
}

/**
 * Modal component for creating new canvases
 * 
 * Features:
 * - Form validation with real-time feedback
 * - Error handling and loading states
 * - Integration with workspace store
 * - Automatic navigation to new canvas
 * - Accessible form with proper labels
 * 
 * Validation:
 * - Canvas name is required (1-100 characters)
 * - Description is optional (max 500 characters)
 * - Default canvas option
 * 
 * Accessibility:
 * - Proper form labels and descriptions
 * - Error announcements for screen readers
 * - Focus management on modal open/close
 * - Keyboard navigation support
 */
export const CreateCanvasModal: React.FC<CreateCanvasModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
}) => {
  const router = useRouter();
  const { setCurrentCanvas } = useWorkspaceStore();
  const { mutate: createCanvas, loading: isCreating } = useCreateCanvas();
  const { mutate: setDefaultCanvas } = useSetDefaultCanvas();
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    isDefault: false,
  });
  
  const [errors, setErrors] = useState<FormErrors>({});

  // Validation function
  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Canvas name is required';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Canvas name must be 100 characters or less';
    }

    // Description validation
    if (formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    return newErrors;
  };

  // Handle input changes
  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle field blur (validation on blur)
  const handleFieldBlur = (field: keyof FormData) => {
    const fieldErrors: FormErrors = {};
    
    if (field === 'name') {
      if (!formData.name.trim()) {
        fieldErrors.name = 'Canvas name is required';
      } else if (formData.name.trim().length > 100) {
        fieldErrors.name = 'Canvas name must be 100 characters or less';
      }
    }
    
    if (field === 'description') {
      if (formData.description.length > 500) {
        fieldErrors.description = 'Description must be 500 characters or less';
      }
    }
    
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...fieldErrors }));
    }
  };

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Clear previous errors
    setErrors({});
    
    // Validate form
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    try {
      const createParams: CreateCanvasParams = {
        workspaceId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        priority: 'normal',
        tags: [],
        settings: {
          isDefault: formData.isDefault,
          position: { x: 0, y: 0, z: 0 },
          zoom: 1.0,
          grid: {
            enabled: true,
            size: 20,
            color: '#e5e7eb',
            opacity: 0.3,
          },
          background: {
            type: 'COLOR',
            color: '#ffffff',
            opacity: 1.0,
          },
        },
      };

      // Use GraphQL hook to create canvas
      const newCanvasId = await createCanvas(createParams);
      
      if (newCanvasId) {
        // Set as default if requested
        if (formData.isDefault) {
          await setDefaultCanvas(workspaceId, newCanvasId);
        }
        
        // Update the current canvas context
        setCurrentCanvas(newCanvasId, formData.name.trim());
        
        // Navigate to the new canvas
        router.push(`/workspace/${workspaceId}/canvas/${newCanvasId}` as any);
        
        // Close modal and reset form
        onClose();
        setFormData({ name: '', description: '', isDefault: false });
      } else {
        setErrors({ general: 'Failed to create canvas. Please try again.' });
      }
    } catch (error) {
      console.error('Error creating canvas:', error);
      setErrors({ 
        general: error instanceof Error ? error.message : 'An unexpected error occurred' 
      });
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (!isCreating) {
      onClose();
      setFormData({ name: '', description: '', isDefault: false });
      setErrors({});
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="medium" initialFocus={nameInputRef}>
      <form onSubmit={handleSubmit}>
        <ModalHeader>
          <ModalTitle>Create New Canvas</ModalTitle>
        </ModalHeader>
        
        <ModalContent>
          <div className="space-y-6">
            {/* General Error */}
            {errors.general && (
              <div 
                className="p-3 bg-red-50 border border-red-200 rounded-md"
                role="alert"
                aria-live="polite"
              >
                <div className="text-sm text-red-800">
                  {errors.general}
                </div>
              </div>
            )}
            
            {/* Canvas Name */}
            <div>
              <label htmlFor="canvas-name" className="block text-sm font-medium text-gray-700 mb-2">
                Canvas Name <span className="text-red-500" aria-label="required">*</span>
              </label>
              <Input
                ref={nameInputRef}
                id="canvas-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                onBlur={() => handleFieldBlur('name')}
                placeholder="Enter canvas name..."
                state={errors.name ? 'error' : 'default'}
                disabled={isCreating}
                aria-describedby={errors.name ? 'canvas-name-error' : 'canvas-name-description'}
                autoFocus
              />
              <div id="canvas-name-description" className="mt-1 text-sm text-gray-500">
                Give your canvas a descriptive name (up to 100 characters)
              </div>
              {errors.name && (
                <div id="canvas-name-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.name}
                </div>
              )}
            </div>
            
            {/* Canvas Description */}
            <div>
              <label htmlFor="canvas-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                id="canvas-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                onBlur={() => handleFieldBlur('description')}
                placeholder="Describe what this canvas will be used for..."
                rows={3}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                  errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                } ${isCreating ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                disabled={isCreating}
                aria-describedby={errors.description ? 'canvas-description-error' : 'canvas-description-help'}
              />
              <div id="canvas-description-help" className="mt-1 text-sm text-gray-500">
                Optional description to help identify the canvas purpose (up to 500 characters)
              </div>
              {errors.description && (
                <div id="canvas-description-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.description}
                </div>
              )}
            </div>
            
            {/* Default Canvas Option */}
            <div className="flex items-center">
              <input
                id="canvas-default"
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => handleInputChange('isDefault', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                disabled={isCreating}
              />
              <label htmlFor="canvas-default" className="ml-2 block text-sm text-gray-700">
                Set as default canvas for this workspace
              </label>
            </div>
          </div>
        </ModalContent>
        
        <ModalFooter>
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isCreating || !formData.name.trim()}
              aria-describedby={isCreating ? 'creating-canvas-status' : undefined}
            >
              {isCreating ? 'Creating...' : 'Create Canvas'}
            </Button>
          </div>
          {isCreating && (
            <div id="creating-canvas-status" className="sr-only" aria-live="polite">
              Creating canvas, please wait...
            </div>
          )}
        </ModalFooter>
      </form>
    </Modal>
  );
};