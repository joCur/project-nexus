'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface UserProfile {
  fullName: string;
  displayName: string;
  timezone: string;
  role?: 'student' | 'researcher' | 'creative' | 'business' | 'other';
  preferences: {
    workspaceName: string;
    privacy: 'private' | 'team' | 'public';
    notifications: boolean;
  };
}

interface ProfileSetupStepProps {
  userProfile: Partial<UserProfile>;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onNext: () => void;
}

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student', description: 'Learning and academic research' },
  { value: 'researcher', label: 'Researcher', description: 'Professional research and analysis' },
  { value: 'creative', label: 'Creative', description: 'Design, writing, and creative work' },
  { value: 'business', label: 'Business', description: 'Strategy, planning, and business analysis' },
  { value: 'other', label: 'Other', description: 'General knowledge management' },
];

export const ProfileSetupStep: React.FC<ProfileSetupStepProps> = ({
  userProfile,
  onUpdateProfile,
  onNext,
}) => {
  const [formData, setFormData] = useState({
    fullName: userProfile.fullName || '',
    displayName: userProfile.displayName || '',
    timezone: userProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    role: userProfile.role || '',
    workspaceName: userProfile.preferences?.workspaceName || '',
    privacy: userProfile.preferences?.privacy || 'private',
    notifications: userProfile.preferences?.notifications ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-generate display name and workspace name
  useEffect(() => {
    if (formData.fullName && !userProfile.displayName) {
      const firstName = formData.fullName.split(' ')[0];
      setFormData(prev => ({
        ...prev,
        displayName: firstName,
        workspaceName: `${firstName}'s Workspace`,
      }));
    }
  }, [formData.fullName, userProfile.displayName]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!formData.workspaceName.trim()) {
      newErrors.workspaceName = 'Workspace name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Update profile with form data
    onUpdateProfile({
      fullName: formData.fullName,
      displayName: formData.displayName,
      timezone: formData.timezone,
      role: formData.role as UserProfile['role'],
      preferences: {
        workspaceName: formData.workspaceName,
        privacy: formData.privacy as 'private' | 'team' | 'public',
        notifications: formData.notifications,
      },
    });

    onNext();
  };

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Let's Set Up Your Profile
        </h2>
        <p className="text-text-secondary">
          Tell us a bit about yourself to personalize your workspace experience.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-text-primary mb-2">
            Full Name *
          </label>
          <input
            type="text"
            id="fullName"
            value={formData.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            className={cn(
              'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              errors.fullName ? 'border-error-500' : 'border-border-default'
            )}
            placeholder="Enter your full name"
          />
          {errors.fullName && (
            <p className="text-error-500 text-sm mt-1">{errors.fullName}</p>
          )}
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-text-primary mb-2">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            value={formData.displayName}
            onChange={(e) => updateField('displayName', e.target.value)}
            className="w-full px-4 py-3 border border-border-default rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="How you'd like to be called"
          />
          <p className="text-text-tertiary text-sm mt-1">
            This is how you'll appear in the workspace
          </p>
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-3">
            What best describes your role? (Optional)
          </label>
          <div className="grid grid-cols-1 gap-2">
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex items-center p-3 border rounded-lg cursor-pointer transition-colors',
                  formData.role === option.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-border-default hover:bg-neutral-50'
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={formData.role === option.value}
                  onChange={(e) => updateField('role', e.target.value)}
                  className="sr-only"
                />
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center',
                  formData.role === option.value
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-neutral-300'
                )}>
                  {formData.role === option.value && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-text-primary">{option.label}</div>
                  <div className="text-sm text-text-secondary">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Workspace Name */}
        <div>
          <label htmlFor="workspaceName" className="block text-sm font-medium text-text-primary mb-2">
            Workspace Name *
          </label>
          <input
            type="text"
            id="workspaceName"
            value={formData.workspaceName}
            onChange={(e) => updateField('workspaceName', e.target.value)}
            className={cn(
              'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              errors.workspaceName ? 'border-error-500' : 'border-border-default'
            )}
            placeholder="My Knowledge Workspace"
          />
          {errors.workspaceName && (
            <p className="text-error-500 text-sm mt-1">{errors.workspaceName}</p>
          )}
        </div>

        {/* Privacy Setting */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Workspace Privacy
          </label>
          <select
            value={formData.privacy}
            onChange={(e) => updateField('privacy', e.target.value)}
            className="w-full px-4 py-3 border border-border-default rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="private">Private - Only you can access</option>
            <option value="team">Team - Share with specific people (Coming Soon)</option>
            <option value="public">Public - Anyone can view (Coming Soon)</option>
          </select>
        </div>

        {/* Notifications */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="notifications"
            checked={formData.notifications}
            onChange={(e) => updateField('notifications', e.target.checked)}
            className="w-4 h-4 text-primary-600 border-border-default rounded focus:ring-primary-500"
          />
          <label htmlFor="notifications" className="ml-3 text-sm text-text-primary">
            Send me updates about new features and tips
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button
            type="submit"
            variant="primary"
            size="large"
            className="w-full"
          >
            Continue to Workspace Setup
          </Button>
        </div>
      </form>
    </div>
  );
};