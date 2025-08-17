'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

// Step components
import { ProfileSetupStep } from './steps/ProfileSetupStep';
import { WorkspaceIntroStep } from './steps/WorkspaceIntroStep';
import { WelcomeStep } from './steps/WelcomeStep';

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

const TOTAL_STEPS = 3;

export const OnboardingFlow: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  
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
  }, []);

  const nextStep = useCallback(async () => {
    const currentStep = state.currentStep;
    
    // Save step completion to backend
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: currentStep,
          completedAt: new Date().toISOString(),
          tutorialProgress: state.tutorialProgress,
          userProfile: state.userProfile,
        }),
      });
    } catch (error) {
      console.error('Failed to save onboarding progress:', error);
      // Continue anyway - we'll retry on next step
    }

    if (currentStep < TOTAL_STEPS) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    } else {
      await completeOnboarding();
    }
  }, [state]);

  const completeOnboarding = useCallback(async () => {
    try {
      // Save final profile and mark onboarding complete
      await fetch('/api/user/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedAt: new Date().toISOString(),
          userProfile: state.userProfile,
          tutorialProgress: state.tutorialProgress,
        }),
      });

      // Redirect to workspace
      router.push('/workspace');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // Still redirect - user can update profile later
      router.push('/workspace');
    }
  }, [state, router]);

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
            onComplete={completeOnboarding}
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
                Let's set up your knowledge workspace
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