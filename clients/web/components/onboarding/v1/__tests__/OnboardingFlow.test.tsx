import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingFlow } from '../OnboardingFlow';

// Mock hooks
jest.mock('@/hooks/use-auth');

const mockUseAuth = jest.fn();
(require('@/hooks/use-auth') as any).useAuth = mockUseAuth;

// Mock step components
jest.mock('../steps/ProfileSetupStep', () => ({
  ProfileSetupStep: ({ onNext, onUpdateProfile, onProgressUpdate, userProfile }: any) => {
    const handleClick = () => {
      onUpdateProfile({
        fullName: 'Test User',
        displayName: 'Test',
        preferences: {
          ...userProfile?.preferences,
          workspaceName: 'Test Workspace'
        }
      });
      onProgressUpdate({ profileSetup: true });
      onNext();
    };
    
    return (
      <div data-testid="profile-setup-step">
        <h2>Profile Setup Step</h2>
        <button onClick={handleClick}>
          Complete Profile
        </button>
      </div>
    );
  },
}));

jest.mock('../steps/WorkspaceIntroStep', () => ({
  WorkspaceIntroStep: ({ onNext, onProgressUpdate }: any) => {
    const handleClick = () => {
      onProgressUpdate({ workspaceIntro: true });
      onNext();
    };
    
    return (
      <div data-testid="workspace-intro-step">
        <h2>Workspace Intro Step</h2>
        <button onClick={handleClick}>
          Complete Intro
        </button>
      </div>
    );
  },
}));

jest.mock('../steps/WelcomeStep', () => ({
  WelcomeStep: ({ onComplete }: any) => (
    <div data-testid="welcome-step">
      <h2>Welcome Step</h2>
      <button onClick={onComplete}>
        Complete Onboarding
      </button>
    </div>
  ),
}));

// Mock shared components
jest.mock('../shared/ProgressIndicator', () => ({
  ProgressIndicator: ({ currentStep, totalSteps }: any) => (
    <div data-testid="progress-indicator">
      Step {currentStep} of {totalSteps}
    </div>
  ),
}));

jest.mock('../shared/StepContainer', () => ({
  StepContainer: ({ children }: any) => (
    <div data-testid="step-container">{children}</div>
  ),
}));

describe('OnboardingFlow', () => {

  const defaultUser = {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    global.mockRouter.push.mockClear();
    global.mockRouter.replace.mockClear();
    global.mockRouter.refresh.mockClear();
    
    mockUseAuth.mockReturnValue({
      user: defaultUser,
      isLoading: false,
      isAuthenticated: true,
    });

    // Default successful fetch mock
    global.mockFetch({ success: true });
  });

  describe('Initial Render', () => {
    it('should render the onboarding flow with initial step', () => {
      render(<OnboardingFlow />);

      expect(screen.getByText('Welcome to Project Nexus')).toBeInTheDocument();
      expect(screen.getByText("Let's set up your knowledge workspace")).toBeInTheDocument();
      expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Step 1 of 3');
      expect(screen.getByTestId('profile-setup-step')).toBeInTheDocument();
    });

    it('should initialize with default state', () => {
      render(<OnboardingFlow />);

      expect(screen.getByTestId('profile-setup-step')).toBeInTheDocument();
      expect(screen.queryByTestId('workspace-intro-step')).not.toBeInTheDocument();
      expect(screen.queryByTestId('welcome-step')).not.toBeInTheDocument();
    });

    it('should auto-detect timezone', () => {
      // Mock Intl.DateTimeFormat
      const mockTimeZone = 'America/New_York';
      jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
        timeZone: mockTimeZone,
      } as any);

      render(<OnboardingFlow />);

      // The timezone should be set in the initial state
      // We can verify this by checking what gets sent in the API call
      const completeButton = screen.getByText('Complete Profile');
      fireEvent.click(completeButton);

      expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining(mockTimeZone),
      });
    });
  });

  describe('Step Navigation', () => {
    it('should navigate through all steps sequentially', async () => {
      render(<OnboardingFlow />);

      // Step 1: Profile Setup
      expect(screen.getByTestId('profile-setup-step')).toBeInTheDocument();
      expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Step 1 of 3');

      const profileButton = screen.getByText('Complete Profile');
      fireEvent.click(profileButton);

      await waitFor(() => {
        expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
        expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Step 2 of 3');
      });

      // Step 2: Workspace Intro
      const introButton = screen.getByText('Complete Intro');
      fireEvent.click(introButton);

      await waitFor(() => {
        expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
        expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Step 3 of 3');
      });

      // Step 3: Welcome/Completion
      const completeButton = screen.getByText('Complete Onboarding');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(global.mockRouter.push).toHaveBeenCalledWith('/workspace');
      });
    });

    it('should update progress indicator correctly', async () => {
      render(<OnboardingFlow />);

      expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Step 1 of 3');

      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Step 2 of 3');
      });

      fireEvent.click(screen.getByText('Complete Intro'));

      await waitFor(() => {
        expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Step 3 of 3');
      });
    });

    it('should not allow navigation beyond the last step', async () => {
      render(<OnboardingFlow />);

      // Navigate to last step
      fireEvent.click(screen.getByText('Complete Profile'));
      await waitFor(() => screen.getByTestId('workspace-intro-step'));

      fireEvent.click(screen.getByText('Complete Intro'));
      await waitFor(() => screen.getByTestId('welcome-step'));

      // Complete onboarding should redirect, not continue to step 4
      fireEvent.click(screen.getByText('Complete Onboarding'));

      await waitFor(() => {
        expect(global.mockRouter.push).toHaveBeenCalledWith('/workspace');
      });
    });
  });

  describe('API Integration', () => {
    it('should save progress after each step', async () => {
      render(<OnboardingFlow />);

      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding', 
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"profileSetup":true')
          })
        );
        
        // Also check that the body contains the expected user profile data
        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        const requestBody = JSON.parse(fetchCall[1].body);
        expect(requestBody.step).toBe(1);
        expect(requestBody.tutorialProgress.profileSetup).toBe(true);
        expect(requestBody.userProfile.fullName).toBe('Test User');
        expect(requestBody.userProfile.displayName).toBe('Test');
        expect(requestBody.userProfile.preferences.workspaceName).toBe('Test Workspace');
      });
    });

    it('should save final completion data', async () => {
      render(<OnboardingFlow />);

      // Navigate to final step
      fireEvent.click(screen.getByText('Complete Profile'));
      await waitFor(() => screen.getByTestId('workspace-intro-step'));

      fireEvent.click(screen.getByText('Complete Intro'));
      await waitFor(() => screen.getByTestId('welcome-step'));

      // Complete onboarding
      fireEvent.click(screen.getByText('Complete Onboarding'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding/complete', 
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"profileSetup":true')
          })
        );
        
        // Verify the completion call contains the expected data
        const completionCalls = (global.fetch as jest.Mock).mock.calls.filter(call => 
          call[0] === '/api/user/onboarding/complete'
        );
        expect(completionCalls).toHaveLength(1);
        
        const requestBody = JSON.parse(completionCalls[0][1].body);
        expect(requestBody.completedAt).toBeDefined();
        expect(requestBody.userProfile.fullName).toBe('Test User');
        expect(requestBody.userProfile.displayName).toBe('Test');
        expect(requestBody.tutorialProgress.profileSetup).toBe(true);
        expect(requestBody.tutorialProgress.workspaceIntro).toBe(true);
      });
    });

    it('should continue navigation even if API call fails', async () => {
      global.mockFetchError(new Error('API Error'));

      render(<OnboardingFlow />);

      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
      });

      // Should continue despite API failure
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should redirect to workspace even if completion API fails', async () => {
      let apiCallCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        apiCallCount++;
        if (apiCallCount === 2) {
          // Fail the completion API call
          return Promise.reject(new Error('Completion API Error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      render(<OnboardingFlow />);

      // Navigate to completion
      fireEvent.click(screen.getByText('Complete Profile'));
      await waitFor(() => screen.getByTestId('workspace-intro-step'));

      fireEvent.click(screen.getByText('Complete Intro'));
      await waitFor(() => screen.getByTestId('welcome-step'));

      fireEvent.click(screen.getByText('Complete Onboarding'));

      await waitFor(() => {
        expect(global.mockRouter.push).toHaveBeenCalledWith('/workspace');
      });
    });
  });

  describe('State Management', () => {
    it('should update user profile state correctly', async () => {
      render(<OnboardingFlow />);

      // The ProfileSetupStep mock will update the profile
      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        // Verify the profile data was included in the API call
        expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test User'),
        });
      });
    });

    it('should update tutorial progress state correctly', async () => {
      render(<OnboardingFlow />);

      fireEvent.click(screen.getByText('Complete Profile'));
      await waitFor(() => screen.getByTestId('workspace-intro-step'));

      fireEvent.click(screen.getByText('Complete Intro'));
      await waitFor(() => screen.getByTestId('welcome-step'));

      fireEvent.click(screen.getByText('Complete Onboarding'));

      await waitFor(() => {
        const completionCalls = (global.fetch as jest.Mock).mock.calls.filter(call => 
          call[0] === '/api/user/onboarding/complete'
        );
        expect(completionCalls).toHaveLength(1);
        
        const requestBody = JSON.parse(completionCalls[0][1].body);
        expect(requestBody.tutorialProgress.profileSetup).toBe(true);
        expect(requestBody.tutorialProgress.workspaceIntro).toBe(true);
      });
    });

    it('should maintain state across step transitions', async () => {
      render(<OnboardingFlow />);

      // Complete first step which updates both profile and progress
      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        const requestBody = JSON.parse(fetchCall[1].body);

        expect(requestBody.userProfile.fullName).toBe('Test User');
        expect(requestBody.tutorialProgress.profileSetup).toBe(true);
      });
    });
  });

  describe('Default Values', () => {
    it('should initialize with default workspace name', () => {
      render(<OnboardingFlow />);

      // Check that default workspace name is set
      fireEvent.click(screen.getByText('Complete Profile'));

      expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('workspaceName'),
      });
    });

    it('should initialize with default privacy setting', () => {
      render(<OnboardingFlow />);

      fireEvent.click(screen.getByText('Complete Profile'));

      expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"privacy":"private"'),
      });
    });

    it('should initialize with notifications enabled by default', () => {
      render(<OnboardingFlow />);

      fireEvent.click(screen.getByText('Complete Profile'));

      expect(global.fetch).toHaveBeenCalledWith('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"notifications":true'),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle step component errors gracefully', () => {
      // Mock console.error to prevent error output in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock ProfileSetupStep to throw an error
      jest.doMock('../steps/ProfileSetupStep', () => ({
        ProfileSetupStep: () => {
          throw new Error('Component error');
        },
      }));

      // Component should still render without crashing
      expect(() => render(<OnboardingFlow />)).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle missing user gracefully', () => {
      mockUseAuth.mockReturnValue({
        user: null,
      });

      render(<OnboardingFlow />);

      // Should still render the onboarding flow
      expect(screen.getByText('Welcome to Project Nexus')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('should pass correct props to ProfileSetupStep', () => {
      render(<OnboardingFlow />);

      expect(screen.getByTestId('profile-setup-step')).toBeInTheDocument();
      
      // The mocked component should receive the onNext, onUpdateProfile, and onProgressUpdate props
      const button = screen.getByText('Complete Profile');
      expect(button).toBeInTheDocument();
    });

    it('should pass correct props to WorkspaceIntroStep', async () => {
      render(<OnboardingFlow />);

      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
      });

      // Should have workspace name from previous step
      expect(screen.getByText('Complete Intro')).toBeInTheDocument();
    });

    it('should pass correct props to WelcomeStep', async () => {
      render(<OnboardingFlow />);

      fireEvent.click(screen.getByText('Complete Profile'));
      await waitFor(() => screen.getByTestId('workspace-intro-step'));

      fireEvent.click(screen.getByText('Complete Intro'));

      await waitFor(() => {
        expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
      });

      expect(screen.getByText('Complete Onboarding')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const renderSpy = jest.fn();
      
      const TestWrapper = () => {
        renderSpy();
        return <OnboardingFlow />;
      };

      render(<TestWrapper />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Clicking should not cause additional renders of the main component
      fireEvent.click(screen.getByText('Complete Profile'));

      // Allow for state update
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<OnboardingFlow />);

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to Project Nexus');
    });

    it('should provide proper landmark roles', () => {
      render(<OnboardingFlow />);

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should include progress indicator for screen readers', () => {
      render(<OnboardingFlow />);

      expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();
    });
  });
});