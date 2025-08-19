import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileSetupStep } from '../ProfileSetupStep';

// Mock the UI components
jest.mock('@/components/ui', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

// Mock utility functions
jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('ProfileSetupStep', () => {
  const defaultProps = {
    userProfile: {},
    onUpdateProfile: jest.fn(),
    onProgressUpdate: jest.fn(),
    onNext: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('should render the profile setup form', () => {
      render(<ProfileSetupStep {...defaultProps} />);

      expect(screen.getByText("Let's Set Up Your Profile")).toBeInTheDocument();
      expect(screen.getByText('Tell us a bit about yourself to personalize your workspace experience.')).toBeInTheDocument();
      
      expect(screen.getByLabelText('Full Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
      expect(screen.getByText('What best describes your role? (Optional)')).toBeInTheDocument();
      expect(screen.getByLabelText('Workspace Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Workspace Privacy')).toBeInTheDocument();
      expect(screen.getByLabelText('Send me updates about new features and tips')).toBeInTheDocument();
    });

    it('should populate form fields with existing user profile data', () => {
      const userProfile = {
        fullName: 'John Doe',
        displayName: 'Johnny',
        timezone: 'America/New_York',
        role: 'creative' as const,
        preferences: {
          workspaceName: 'Creative Space',
          privacy: 'team' as const,
          notifications: false,
        },
      };

      render(<ProfileSetupStep {...defaultProps} userProfile={userProfile} />);

      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Johnny')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Creative Space')).toBeInTheDocument();
      const privacySelect = screen.getByLabelText('Workspace Privacy');
      expect(privacySelect).toHaveValue('team');
      expect(screen.getByRole('radio', { name: /Creative/ })).toBeChecked();
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('should auto-detect timezone when not provided', () => {
      // Mock Intl.DateTimeFormat
      const mockTimeZone = 'America/Los_Angeles';
      jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
        timeZone: mockTimeZone,
      } as any);

      render(<ProfileSetupStep {...defaultProps} />);

      // Timezone is stored in form state, not directly visible
      // We can verify it's used by checking the submit behavior
      const fullNameInput = screen.getByLabelText('Full Name *');
      const workspaceNameInput = screen.getByLabelText('Workspace Name *');
      const submitButton = screen.getByRole('button', { name: /Continue to Workspace Setup/ });

      fireEvent.change(fullNameInput, { target: { value: 'Test User' } });
      fireEvent.change(workspaceNameInput, { target: { value: 'Test Workspace' } });
      fireEvent.click(submitButton);

      expect(defaultProps.onUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          timezone: mockTimeZone,
        })
      );
    });
  });

  describe('Form Interactions', () => {
    it('should update full name and auto-generate display name and workspace name', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const fullNameInput = screen.getByLabelText('Full Name *');
      await user.type(fullNameInput, 'Jane Smith');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
        expect(screen.getByDisplayValue("Jane's Workspace")).toBeInTheDocument();
      });
    });

    it('should not auto-generate display name if one already exists', async () => {
      const user = userEvent.setup();
      const userProfile = {
        displayName: 'Existing Name',
      };

      render(<ProfileSetupStep {...defaultProps} userProfile={userProfile} />);

      const fullNameInput = screen.getByLabelText('Full Name *');
      await user.type(fullNameInput, 'New Full Name');

      // Display name should remain unchanged
      expect(screen.getByDisplayValue('Existing Name')).toBeInTheDocument();
    });

    it('should allow manual editing of display name', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const displayNameInput = screen.getByLabelText('Display Name');
      await user.type(displayNameInput, 'Custom Display Name');

      expect(screen.getByDisplayValue('Custom Display Name')).toBeInTheDocument();
    });

    it('should handle role selection', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const creativeRole = screen.getByRole('radio', { name: /Creative/ });
      await user.click(creativeRole);

      expect(creativeRole).toBeChecked();

      // Should be able to change selection
      const businessRole = screen.getByRole('radio', { name: /Business/ });
      await user.click(businessRole);

      expect(businessRole).toBeChecked();
      expect(creativeRole).not.toBeChecked();
    });

    it('should handle workspace privacy selection', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const privacySelect = screen.getByLabelText('Workspace Privacy');
      await user.selectOptions(privacySelect, 'team');

      expect(privacySelect).toHaveValue('team');
    });

    it('should handle notifications checkbox', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const notificationsCheckbox = screen.getByRole('checkbox');
      expect(notificationsCheckbox).toBeChecked(); // Default is true

      await user.click(notificationsCheckbox);
      expect(notificationsCheckbox).not.toBeChecked();

      await user.click(notificationsCheckbox);
      expect(notificationsCheckbox).toBeChecked();
    });
  });

  describe('Form Validation', () => {
    it('should show error when full name is empty', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Continue to Workspace Setup/ });
      await user.click(submitButton);

      expect(screen.getByText('Full name is required')).toBeInTheDocument();
      expect(defaultProps.onNext).not.toHaveBeenCalled();
    });

    it('should show error when workspace name is empty', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const fullNameInput = screen.getByLabelText('Full Name *');
      await user.type(fullNameInput, 'Test User');

      const workspaceNameInput = screen.getByLabelText('Workspace Name *');
      await user.clear(workspaceNameInput);

      const submitButton = screen.getByRole('button', { name: /Continue to Workspace Setup/ });
      await user.click(submitButton);

      expect(screen.getByText('Workspace name is required')).toBeInTheDocument();
      expect(defaultProps.onNext).not.toHaveBeenCalled();
    });

    it('should clear error when user starts typing in field with error', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Continue to Workspace Setup/ });
      await user.click(submitButton);

      expect(screen.getByText('Full name is required')).toBeInTheDocument();

      const fullNameInput = screen.getByLabelText('Full Name *');
      await user.type(fullNameInput, 'Test');

      expect(screen.queryByText('Full name is required')).not.toBeInTheDocument();
    });

    it('should show multiple validation errors', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Continue to Workspace Setup/ });
      await user.click(submitButton);

      expect(screen.getByText('Full name is required')).toBeInTheDocument();
      expect(screen.getByText('Workspace name is required')).toBeInTheDocument();
    });

    it('should validate whitespace-only input', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const fullNameInput = screen.getByLabelText('Full Name *');
      const workspaceNameInput = screen.getByLabelText('Workspace Name *');

      await user.type(fullNameInput, '   ');
      await user.type(workspaceNameInput, '   ');

      const submitButton = screen.getByRole('button', { name: /Continue to Workspace Setup/ });
      await user.click(submitButton);

      expect(screen.getByText('Full name is required')).toBeInTheDocument();
      expect(screen.getByText('Workspace name is required')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should submit valid form data', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const fullNameInput = screen.getByLabelText('Full Name *');
      const displayNameInput = screen.getByLabelText('Display Name');
      const workspaceNameInput = screen.getByLabelText('Workspace Name *');
      const creativeRole = screen.getByRole('radio', { name: /Creative/ });
      const privacySelect = screen.getByLabelText('Workspace Privacy');
      const notificationsCheckbox = screen.getByRole('checkbox');

      await user.type(fullNameInput, 'John Doe');
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Johnny');
      await user.clear(workspaceNameInput);
      await user.type(workspaceNameInput, 'My Creative Space');
      await user.click(creativeRole);
      await user.selectOptions(privacySelect, 'team');
      await user.click(notificationsCheckbox); // Uncheck it

      const submitButton = screen.getByRole('button', { name: /Continue to Workspace Setup/ });
      await user.click(submitButton);

      expect(defaultProps.onUpdateProfile).toHaveBeenCalledWith({
        fullName: 'John Doe',
        displayName: 'Johnny',
        timezone: expect.any(String),
        role: 'creative',
        preferences: {
          workspaceName: 'My Creative Space',
          privacy: 'team',
          notifications: false,
        },
      });

      expect(defaultProps.onProgressUpdate).toHaveBeenCalledWith({ profileSetup: true });
      expect(defaultProps.onNext).toHaveBeenCalled();
    });

    it('should submit form with minimal required data', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const fullNameInput = screen.getByLabelText('Full Name *');
      const workspaceNameInput = screen.getByLabelText('Workspace Name *');

      await user.type(fullNameInput, 'Minimal User');
      await user.clear(workspaceNameInput);
      await user.type(workspaceNameInput, 'Minimal Workspace');

      const submitButton = screen.getByRole('button', { name: /Continue to Workspace Setup/ });
      await user.click(submitButton);

      expect(defaultProps.onUpdateProfile).toHaveBeenCalledWith({
        fullName: 'Minimal User',
        displayName: 'Minimal',
        timezone: expect.any(String),
        role: '',
        preferences: {
          workspaceName: 'Minimal Workspace',
          privacy: 'private',
          notifications: true,
        },
      });
    });

    it('should handle form submission without onProgressUpdate callback', async () => {
      const user = userEvent.setup();
      const propsWithoutProgressUpdate = {
        ...defaultProps,
        onProgressUpdate: undefined,
      };

      render(<ProfileSetupStep {...propsWithoutProgressUpdate} />);

      const fullNameInput = screen.getByLabelText('Full Name *');
      const workspaceNameInput = screen.getByLabelText('Workspace Name *');

      await user.type(fullNameInput, 'Test User');
      await user.type(workspaceNameInput, 'Test Workspace');

      const submitButton = screen.getByRole('button', { name: /Continue to Workspace Setup/ });
      await user.click(submitButton);

      expect(defaultProps.onNext).toHaveBeenCalled();
    });

    it('should prevent form submission on Enter key in invalid state', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const fullNameInput = screen.getByLabelText('Full Name *');
      await user.type(fullNameInput, '{enter}');

      expect(screen.getByText('Full name is required')).toBeInTheDocument();
      expect(defaultProps.onNext).not.toHaveBeenCalled();
    });
  });

  describe('Role Options', () => {
    it('should render all role options', () => {
      render(<ProfileSetupStep {...defaultProps} />);

      expect(screen.getByText('Student')).toBeInTheDocument();
      expect(screen.getByText('Learning and academic research')).toBeInTheDocument();
      
      expect(screen.getByText('Researcher')).toBeInTheDocument();
      expect(screen.getByText('Professional research and analysis')).toBeInTheDocument();
      
      expect(screen.getByText('Creative')).toBeInTheDocument();
      expect(screen.getByText('Design, writing, and creative work')).toBeInTheDocument();
      
      expect(screen.getByText('Business')).toBeInTheDocument();
      expect(screen.getByText('Strategy, planning, and business analysis')).toBeInTheDocument();
      
      expect(screen.getByText('Other')).toBeInTheDocument();
      expect(screen.getByText('General knowledge management')).toBeInTheDocument();
    });

    it('should show visual feedback for selected role', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const creativeRole = screen.getByRole('radio', { name: /Creative/ });
      const creativeLabel = creativeRole.closest('label');

      expect(creativeLabel).not.toHaveClass('border-primary-500');
      expect(creativeLabel).not.toHaveClass('bg-primary-50');

      await user.click(creativeRole);

      expect(creativeLabel).toHaveClass('border-primary-500');
      expect(creativeLabel).toHaveClass('bg-primary-50');
    });
  });

  describe('Privacy Options', () => {
    it('should show coming soon indicators for team and public options', () => {
      render(<ProfileSetupStep {...defaultProps} />);

      expect(screen.getByText('Team - Share with specific people (Coming Soon)')).toBeInTheDocument();
      expect(screen.getByText('Public - Anyone can view (Coming Soon)')).toBeInTheDocument();
    });

    it('should default to private privacy setting', () => {
      render(<ProfileSetupStep {...defaultProps} />);

      const privacySelect = screen.getByLabelText('Workspace Privacy');
      expect(privacySelect).toHaveValue('private');
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<ProfileSetupStep {...defaultProps} />);

      expect(screen.getByLabelText('Full Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Workspace Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Workspace Privacy')).toBeInTheDocument();
      expect(screen.getByLabelText('Send me updates about new features and tips')).toBeInTheDocument();
    });

    it('should associate error messages with form fields', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Continue to Workspace Setup/ });
      await user.click(submitButton);

      const fullNameInput = screen.getByLabelText('Full Name *');
      const errorMessage = screen.getByText('Full name is required');

      expect(fullNameInput).toHaveClass('border-error-500');
      expect(errorMessage).toBeInTheDocument();
    });

    it('should use screen reader only content for radio buttons', () => {
      render(<ProfileSetupStep {...defaultProps} />);

      const radioInputs = screen.getAllByRole('radio');
      radioInputs.forEach(radio => {
        expect(radio).toHaveClass('sr-only');
      });
    });

    it('should have proper heading hierarchy', () => {
      render(<ProfileSetupStep {...defaultProps} />);

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent("Let's Set Up Your Profile");
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long names gracefully', async () => {
      render(<ProfileSetupStep {...defaultProps} />);

      const veryLongName = 'A'.repeat(1000);
      const fullNameInput = screen.getByLabelText('Full Name *');
      
      // Use fireEvent.change for performance with very long strings
      fireEvent.change(fullNameInput, { target: { value: veryLongName } });
      expect(fullNameInput).toHaveValue(veryLongName);
    });

    it('should handle special characters in names', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const nameWithSpecialChars = "José María O'Connor-Smith";
      const fullNameInput = screen.getByLabelText('Full Name *');
      
      await user.type(fullNameInput, nameWithSpecialChars);
      expect(fullNameInput).toHaveValue(nameWithSpecialChars);
    });

    it('should handle single word names for auto-generation', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const fullNameInput = screen.getByLabelText('Full Name *');
      const displayNameInput = screen.getByLabelText('Display Name');
      const workspaceNameInput = screen.getByLabelText('Workspace Name *');
      
      await user.type(fullNameInput, 'Madonna');

      await waitFor(() => {
        expect(fullNameInput).toHaveValue('Madonna');
        expect(displayNameInput).toHaveValue('Madonna');
        expect(workspaceNameInput).toHaveValue("Madonna's Workspace");
      });
    });

    it('should handle empty spaces in name for auto-generation', async () => {
      const user = userEvent.setup();
      render(<ProfileSetupStep {...defaultProps} />);

      const fullNameInput = screen.getByLabelText('Full Name *');
      await user.type(fullNameInput, '  John  Doe  ');

      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeInTheDocument();
        expect(screen.getByDisplayValue("John's Workspace")).toBeInTheDocument();
      });
    });
  });
});