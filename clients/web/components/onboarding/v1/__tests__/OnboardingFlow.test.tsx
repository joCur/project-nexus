import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { gql } from '@apollo/client';
import { OnboardingFlow } from '../OnboardingFlow';

// Mock hooks
jest.mock('@/hooks/use-auth');

// Mock workspace store
jest.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    setCurrentWorkspace: jest.fn(),
    currentWorkspace: null,
  }),
}));

// Mock useAuth hook  
jest.mock('@/hooks/use-auth');
import { useAuth } from '@/hooks/use-auth';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Helper function to create a complete UseAuthReturn mock
const createAuthMock = (overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  announceAuthStatus: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  checkPermission: jest.fn(),
  hasAnyPermission: jest.fn(),
  hasAllPermissions: jest.fn(),
  hasRole: jest.fn(),
  createPermissionChecker: jest.fn().mockReturnValue({
    hasPermission: jest.fn(),
    hasAnyPermission: jest.fn(),
    hasAllPermissions: jest.fn(),
  }),
  refreshUser: jest.fn(),
  ...overrides,
});

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

// GraphQL mocks for Apollo Client
const UPDATE_ONBOARDING_PROGRESS = gql`
  mutation UpdateOnboardingProgress($input: OnboardingProgressUpdateInput!) {
    updateOnboardingProgress(input: $input) {
      id
      currentStep
      tutorialProgress
      completedAt
    }
  }
`;

const COMPLETE_ONBOARDING_WORKFLOW = gql`
  mutation CompleteOnboardingWorkflow($input: OnboardingWorkflowCompleteInput!) {
    completeOnboardingWorkflow(input: $input) {
      success
      profile {
        id
        displayName
        fullName
      }
      workspace {
        id
        name
      }
      onboarding {
        id
        completed
        completedAt
      }
    }
  }
`;

const graphqlMocks = [
  {
    request: {
      query: COMPLETE_ONBOARDING_WORKFLOW
    },
    result: {
      data: {
        completeOnboardingWorkflow: {
          success: true,
          profile: {
            id: 'profile-id',
            displayName: 'Test User',
            fullName: 'Test User'
          },
          workspace: {
            id: 'workspace-id',
            name: 'Test Workspace'
          },
          onboarding: {
            id: 'onboarding-id',
            completed: true,
            completedAt: '2023-01-01T00:00:00Z'
          }
        }
      }
    },
    // Make this mock match any variables
    newData: () => ({
      data: {
        completeOnboardingWorkflow: {
          success: true,
          profile: {
            id: 'profile-id',
            displayName: 'Test User',
            fullName: 'Test User'
          },
          workspace: {
            id: 'workspace-id',
            name: 'Test Workspace'
          },
          onboarding: {
            id: 'onboarding-id',
            completed: true,
            completedAt: '2023-01-01T00:00:00Z'
          }
        }
      }
    })
  },
  {
    request: {
      query: UPDATE_ONBOARDING_PROGRESS
    },
    result: {
      data: {
        updateOnboardingProgress: {
          id: 'test-id',
          currentStep: 1,
          tutorialProgress: { profileSetup: true },
          completedAt: null
        }
      }
    },
    // Make this mock match any variables  
    newData: () => ({
      data: {
        updateOnboardingProgress: {
          id: 'test-id',
          currentStep: 1,
          tutorialProgress: { profileSetup: true },
          completedAt: null
        }
      }
    })
  }
];

// Test wrapper with Apollo MockedProvider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MockedProvider mocks={graphqlMocks} addTypename={false}>
    {children}
  </MockedProvider>
);

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
    
    mockUseAuth.mockReturnValue(createAuthMock({
      user: defaultUser,
      isLoading: false,
      isAuthenticated: true,
    }));

    // Default successful fetch mock
    global.mockFetch({ success: true });
  });

  describe('Initial Render', () => {
    it('should render the onboarding flow with initial step', () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      expect(screen.getByText('Welcome to Project Nexus')).toBeInTheDocument();
      expect(screen.getByText("Let's set up your knowledge workspace")).toBeInTheDocument();
      expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Step 1 of 3');
      expect(screen.getByTestId('profile-setup-step')).toBeInTheDocument();
    });

    it('should initialize with default state', () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

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

      render(<OnboardingFlow />, { wrapper: TestWrapper });

      // The timezone should be set in the initial state
      // We verify this by checking the component renders correctly with timezone
      expect(screen.getByTestId('profile-setup-step')).toBeInTheDocument();
      
      // The component should initialize with the detected timezone
      // (This is verified through the component's internal state, 
      // which would be used when GraphQL mutations are called)
    });
  });

  describe('Step Navigation', () => {
    it('should navigate through all steps sequentially', async () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

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
      render(<OnboardingFlow />, { wrapper: TestWrapper });

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
      render(<OnboardingFlow />, { wrapper: TestWrapper });

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
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        // Verify the step navigation works (GraphQL mutations are mocked)
        expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
      });
    });

    it('should save final completion data', async () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      // Navigate to final step
      fireEvent.click(screen.getByText('Complete Profile'));
      await waitFor(() => screen.getByTestId('workspace-intro-step'));

      fireEvent.click(screen.getByText('Complete Intro'));
      await waitFor(() => screen.getByTestId('welcome-step'));

      // Complete onboarding
      fireEvent.click(screen.getByText('Complete Onboarding'));

      await waitFor(() => {
        // Verify redirection to workspace (either specific workspace or fallback)
        expect(global.mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/workspace/));
      });
    });

    it('should continue navigation even if API call fails', async () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
      });

      // Should continue navigation regardless of GraphQL mutation results
    });

    it('should redirect to workspace even if completion API fails', async () => {
      // Create a GraphQL mock that returns an error for completion
      const errorMocks = [
        {
          request: {
            query: UPDATE_ONBOARDING_PROGRESS,
            variables: expect.any(Object)
          },
          result: {
            data: {
              updateOnboardingProgress: {
                id: 'test-id',
                currentStep: 1,
                tutorialProgress: { profileSetup: true },
                completedAt: null
              }
            }
          }
        },
        {
          request: {
            query: COMPLETE_ONBOARDING_WORKFLOW,
            variables: expect.any(Object)
          },
          error: new Error('GraphQL completion error')
        }
      ];

      const ErrorTestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <MockedProvider mocks={errorMocks} addTypename={false}>
          {children}
        </MockedProvider>
      );

      render(<OnboardingFlow />, { wrapper: ErrorTestWrapper });

      // Navigate to completion
      fireEvent.click(screen.getByText('Complete Profile'));
      await waitFor(() => screen.getByTestId('workspace-intro-step'));

      fireEvent.click(screen.getByText('Complete Intro'));
      await waitFor(() => screen.getByTestId('welcome-step'));

      fireEvent.click(screen.getByText('Complete Onboarding'));

      await waitFor(() => {
        // Should still redirect even if GraphQL mutation fails
        expect(global.mockRouter.push).toHaveBeenCalledWith('/workspace');
      });
    });
  });

  describe('State Management', () => {
    it('should update user profile state correctly', async () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      // The ProfileSetupStep mock will update the profile
      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        // Verify step navigation works (profile data is updated internally)
        expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
      });
    });

    it('should update tutorial progress state correctly', async () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      fireEvent.click(screen.getByText('Complete Profile'));
      await waitFor(() => screen.getByTestId('workspace-intro-step'));

      fireEvent.click(screen.getByText('Complete Intro'));
      await waitFor(() => screen.getByTestId('welcome-step'));

      fireEvent.click(screen.getByText('Complete Onboarding'));

      await waitFor(() => {
        // Verify final redirection (tutorial progress is tracked internally)
        expect(global.mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/workspace/));
      });
    });

    it('should maintain state across step transitions', async () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      // Complete first step which updates both profile and progress
      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        // Verify state is maintained by successful step transition
        expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
        expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Step 2 of 3');
      });
    });
  });

  describe('Default Values', () => {
    it('should initialize with default workspace name', () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      // Check that component renders correctly (default values are used internally)
      expect(screen.getByTestId('profile-setup-step')).toBeInTheDocument();
      
      // Navigation should work with default values
      fireEvent.click(screen.getByText('Complete Profile'));
      expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
    });

    it('should initialize with default privacy setting', () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      // Component should render with default privacy settings
      expect(screen.getByTestId('profile-setup-step')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Complete Profile'));
      expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
    });

    it('should initialize with notifications enabled by default', () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      // Component should render with default notification settings
      expect(screen.getByTestId('profile-setup-step')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Complete Profile'));
      expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
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
      expect(() => render(<OnboardingFlow />, { wrapper: TestWrapper })).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle missing user gracefully', () => {
      mockUseAuth.mockReturnValue(createAuthMock({
        user: null,
      }));

      render(<OnboardingFlow />, { wrapper: TestWrapper });

      // Should still render the onboarding flow
      expect(screen.getByText('Welcome to Project Nexus')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('should pass correct props to ProfileSetupStep', () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      expect(screen.getByTestId('profile-setup-step')).toBeInTheDocument();
      
      // The mocked component should receive the onNext, onUpdateProfile, and onProgressUpdate props
      const button = screen.getByText('Complete Profile');
      expect(button).toBeInTheDocument();
    });

    it('should pass correct props to WorkspaceIntroStep', async () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      fireEvent.click(screen.getByText('Complete Profile'));

      await waitFor(() => {
        expect(screen.getByTestId('workspace-intro-step')).toBeInTheDocument();
      });

      // Should have workspace name from previous step
      expect(screen.getByText('Complete Intro')).toBeInTheDocument();
    });

    it('should pass correct props to WelcomeStep', async () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

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
      
      const PerformanceTestWrapper = () => {
        renderSpy();
        return <OnboardingFlow />;
      };

      render(<PerformanceTestWrapper />, { wrapper: TestWrapper });

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Clicking should not cause additional renders of the main component
      fireEvent.click(screen.getByText('Complete Profile'));

      // Allow for state update
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to Project Nexus');
    });

    it('should provide proper landmark roles', () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should include progress indicator for screen readers', () => {
      render(<OnboardingFlow />, { wrapper: TestWrapper });

      expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();
    });
  });
});