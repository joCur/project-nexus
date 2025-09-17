'use client';

import { useAuth } from '@/hooks/use-auth';
import { CACHE_KEYS, CACHE_OPTIONS, localCache } from '@/lib/client-cache';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { gql, useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import React, { useCallback, useState } from 'react';

// Step components
import { ProfileSetupStep } from './steps/ProfileSetupStep';
import { WelcomeStep } from './steps/WelcomeStep';
import { WorkspaceIntroStep } from './steps/WorkspaceIntroStep';

// Shared components
import { ProgressIndicator } from './shared/ProgressIndicator';
import { StepContainer } from './shared/StepContainer';

// Types
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

interface OnboardingState {
  currentStep: number;
  userProfile: Partial<UserProfile>;
  tutorialProgress: {
    profileSetup: boolean;
    workspaceIntro: boolean;
    firstCard: boolean;
  };
}

// GraphQL mutation for updating onboarding progress
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

// GraphQL mutation for completing onboarding workflow
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

const TOTAL_STEPS = 3;

export const OnboardingFlow: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { setCurrentWorkspace } = useWorkspaceStore();
  const [updateOnboardingProgress] = useMutation(UPDATE_ONBOARDING_PROGRESS);
  const [completeOnboardingWorkflow] = useMutation(COMPLETE_ONBOARDING_WORKFLOW);
  
  const [state, setState] = useState<OnboardingState>({
    currentStep: 1,
    userProfile: {
      displayName: '',
      fullName: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      preferences: {
        workspaceName: 'My Workspace',
        privacy: 'private',
        notifications: true,
      },
    },
    tutorialProgress: {
      profileSetup: false,
      workspaceIntro: false,
      firstCard: false,
    },
  });

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setState(prev => ({
      ...prev,
      userProfile: { ...prev.userProfile, ...updates },
    }));
  }, []);

  const updateTutorialProgress = useCallback((progress: Partial<typeof state.tutorialProgress>) => {
    setState(prev => ({
      ...prev,
      tutorialProgress: { ...prev.tutorialProgress, ...progress },
    }));
  }, [state]);

  const completeOnboarding = useCallback(async (currentState: OnboardingState) => {
    try {
      // Save final profile and mark onboarding complete using GraphQL
      const { data } = await completeOnboardingWorkflow({
        variables: {
          input: {
            userProfile: {
              ...currentState.userProfile,
              // Convert role to uppercase for GraphQL enum, with fallback to 'OTHER'
              role: (currentState.userProfile.role?.trim()?.toUpperCase() || 'OTHER') as any,
              // Convert preferences privacy to uppercase for GraphQL enum
              preferences: {
                ...currentState.userProfile.preferences,
                privacy: (currentState.userProfile.preferences?.privacy?.toUpperCase() || 'PRIVATE') as any,
              },
            },
            tutorialProgress: currentState.tutorialProgress,
          },
        },
      });

      if (data?.completeOnboardingWorkflow?.success) {
        const result = data.completeOnboardingWorkflow;
        const workspace = result.workspace;
        const profile = result.profile;
        const onboarding = result.onboarding;

        if (user?.sub) {
          const cacheKey = `${CACHE_KEYS.ONBOARDING_STATUS}:${user.sub}`;

          // Clear legacy cache entries to prevent stale redirects
          localStorage.removeItem(`onboarding_status:${user.sub}`);

          localCache.set(
            cacheKey,
            {
              isComplete: true,
              currentStep: onboarding?.completed ? TOTAL_STEPS : onboarding?.currentStep || TOTAL_STEPS,
              hasProfile: Boolean(profile?.id),
              hasWorkspace: Boolean(workspace?.id),
              profile,
              onboarding,
              workspace,
            },
            CACHE_OPTIONS.ONBOARDING_STATUS,
          );
        }

        // Extract workspace ID from the response
        if (workspace?.id) {
          const workspaceId = workspace.id;
          const workspaceName = workspace.name;
          
          // Store the workspace context
          setCurrentWorkspace(workspaceId, workspaceName);
          
          // Redirect to the specific workspace
          router.push(`/workspace/${workspaceId}?from=onboarding`);
          return;
        }
      }

      // Fallback to generic workspace route if no workspace ID
      router.push('/workspace?from=onboarding');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // Still redirect - user can update profile later
      router.push('/workspace?from=onboarding');
    }
  }, [router, setCurrentWorkspace, completeOnboardingWorkflow, user?.sub]);

  const nextStep = useCallback(async () => {
    // Use functional setState to get the most current state
    setState(prev => {
      const currentStep = prev.currentStep;
      
      // Save step completion to backend (async, don't block UI)
      (async () => {
        try {
          await updateOnboardingProgress({
            variables: {
              input: {
                currentStep: currentStep,
                tutorialProgress: prev.tutorialProgress,
              },
            },
          });
        } catch (error) {
          console.error('Failed to save onboarding progress:', error);
          // Continue anyway - we'll retry on next step
        }
      })();

      if (currentStep < TOTAL_STEPS) {
        return { ...prev, currentStep: prev.currentStep + 1 };
      } else {
        // Complete onboarding asynchronously
        (async () => {
          await completeOnboarding(prev);
        })();
        return prev;
      }
    });
  }, [completeOnboarding, updateOnboardingProgress]);

  const renderCurrentStep = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <ProfileSetupStep
            userProfile={state.userProfile}
            onUpdateProfile={updateProfile}
            onProgressUpdate={updateTutorialProgress}
            onNext={nextStep}
          />
        );
      case 2:
        return (
          <WorkspaceIntroStep
            workspaceName={state.userProfile.preferences?.workspaceName || 'My Workspace'}
            onProgressUpdate={updateTutorialProgress}
            tutorialProgress={state.tutorialProgress}
            onNext={nextStep}
          />
        );
      case 3:
        return (
          <WelcomeStep
            userProfile={state.userProfile}
            onComplete={() => completeOnboarding(state)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-canvas-base">
      {/* Header with progress */}
      <header className="bg-white border-b border-border-default">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">
                Welcome to Project Nexus
              </h1>
              <p className="text-sm text-text-secondary">
                Let&apos;s set up your knowledge workspace
              </p>
            </div>
            
            <ProgressIndicator
              currentStep={state.currentStep}
              totalSteps={TOTAL_STEPS}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <StepContainer>
          {renderCurrentStep()}
        </StepContainer>
      </main>
    </div>
  );
};