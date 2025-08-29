'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button, IconButton } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import {
  OnboardingState,
  OnboardingStepId,
  OnboardingProgress,
  OnboardingStep,
  OnboardingStepProps,
} from '@/types/onboarding';

// Import step components (will create these next)
import { WelcomeStep } from './steps/WelcomeStep';
import { CanvasIntroStep } from './steps/CanvasIntroStep';
import { AIDemoStep } from './steps/AIDemoStep';
import { KnowledgeOrganizationStep } from './steps/KnowledgeOrganizationStep';
import { AdvancedFeaturesStep } from './steps/AdvancedFeaturesStep';
import { CompletionStep } from './steps/CompletionStep';

/**
 * Progress indicator component showing current step and overall progress
 */
interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: OnboardingStep[];
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  steps,
  onStepClick,
  className,
}) => {
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className={cn('w-full', className)}>
      {/* Progress bar */}
      <div className="relative w-full h-2 bg-neutral-200 rounded-full overflow-hidden mb-4">
        <div
          className="absolute top-0 left-0 h-full bg-primary-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercentage}%` }}
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Onboarding progress: ${Math.round(progressPercentage)}% complete`}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && index <= currentStep;

          return (
            <button
              key={step.id}
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={cn(
                'flex flex-col items-center space-y-2 p-2 rounded-lg transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-primary-500',
                isClickable && 'hover:bg-neutral-50 cursor-pointer',
                !isClickable && 'cursor-default'
              )}
              aria-label={`Step ${index + 1}: ${step.title}${isCurrent ? ' (current)' : ''}${isCompleted ? ' (completed)' : ''}`}
            >
              {/* Step circle */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200',
                  isCompleted && 'bg-success-500 text-white',
                  isCurrent && 'bg-primary-500 text-white ring-4 ring-primary-100',
                  !isCompleted && !isCurrent && 'bg-neutral-200 text-neutral-600'
                )}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              
              {/* Step title */}
              <span
                className={cn(
                  'text-xs font-medium text-center max-w-16 leading-tight',
                  isCurrent && 'text-primary-600',
                  isCompleted && 'text-success-600',
                  !isCompleted && !isCurrent && 'text-neutral-500'
                )}
              >
                {step.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Main onboarding container component that manages the entire onboarding flow
 */
export const OnboardingContainer: React.FC = () => {
  const router = useRouter();
  const { user, announceAuthStatus } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  // Define onboarding steps configuration
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      description: 'Welcome to Project Nexus and persona selection',
      component: WelcomeStep,
      estimatedDuration: 60,
    },
    {
      id: 'canvas-intro',
      title: 'Canvas',
      description: 'Introduction to the infinite canvas and card creation',
      component: CanvasIntroStep,
      estimatedDuration: 90,
    },
    {
      id: 'ai-demo',
      title: 'AI Magic',
      description: 'Experience AI-powered connection discovery',
      component: AIDemoStep,
      estimatedDuration: 120,
    },
    {
      id: 'knowledge-organization',
      title: 'Organization',
      description: 'Learn knowledge organization and spatial thinking',
      component: KnowledgeOrganizationStep,
      estimatedDuration: 90,
    },
    {
      id: 'advanced-features',
      title: 'Features',
      description: 'Preview of advanced features and collaboration',
      component: AdvancedFeaturesStep,
      estimatedDuration: 60,
    },
    {
      id: 'completion',
      title: 'Complete',
      description: 'Celebration and next steps',
      component: CompletionStep,
      estimatedDuration: 30,
    },
  ];

  // Initialize onboarding state
  const [state, setState] = useState<OnboardingState>(() => {
    const now = new Date().toISOString();
    return {
      progress: {
        currentStepIndex: 0,
        currentStepId: 'welcome',
        completedSteps: [],
        skippedSteps: [],
        startedAt: now,
        timeSpentPerStep: {} as Record<OnboardingStepId, number>,
        userChoices: {
          interestedFeatures: [],
          enableAIAssistance: true,
          enableTutorialMode: true,
          notificationPreferences: {
            aiSuggestions: true,
            connectionUpdates: true,
            weeklyDigest: false,
          },
          workspacePreferences: {
            defaultView: 'canvas',
            autoSave: true,
            collaborationMode: 'private',
          },
        },
        hasSeenFeatures: new Set(),
        canRetakeOnboarding: false,
      },
      accessibility: {
        reduceMotion: false,
        highContrast: false,
        screenReaderOptimized: false,
        keyboardNavigationEnabled: true,
        focusTrapEnabled: true,
        announceStepChanges: true,
      },
      responsive: {
        currentBreakpoint: 'desktop',
        isTouchDevice: false,
        orientation: 'landscape',
        adaptiveLayout: true,
        simplifiedUI: false,
      },
      errors: [],
      isLoading: false,
      isPaused: false,
      canExit: true,
    };
  });

  // Step timing tracking
  const stepStartTime = useRef<number>(Date.now());

  // Track accessibility preferences
  useEffect(() => {
    const updateAccessibilitySettings = () => {
      setState(prev => ({
        ...prev,
        accessibility: {
          ...prev.accessibility,
          reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          highContrast: window.matchMedia('(prefers-contrast: high)').matches,
        },
      }));
    };

    updateAccessibilitySettings();
    
    // Listen for preference changes
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    
    reduceMotionQuery.addEventListener('change', updateAccessibilitySettings);
    highContrastQuery.addEventListener('change', updateAccessibilitySettings);

    return () => {
      reduceMotionQuery.removeEventListener('change', updateAccessibilitySettings);
      highContrastQuery.removeEventListener('change', updateAccessibilitySettings);
    };
  }, []);

  // Track responsive breakpoints
  useEffect(() => {
    const updateResponsiveSettings = () => {
      const width = window.innerWidth;
      let breakpoint: 'mobile' | 'tablet' | 'desktop' = 'desktop';
      
      if (width < 768) breakpoint = 'mobile';
      else if (width < 1024) breakpoint = 'tablet';
      
      setState(prev => ({
        ...prev,
        responsive: {
          ...prev.responsive,
          currentBreakpoint: breakpoint,
          isTouchDevice: 'ontouchstart' in window,
          orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
          simplifiedUI: breakpoint === 'mobile',
        },
      }));
    };

    updateResponsiveSettings();
    window.addEventListener('resize', updateResponsiveSettings);
    window.addEventListener('orientationchange', updateResponsiveSettings);

    return () => {
      window.removeEventListener('resize', updateResponsiveSettings);
      window.removeEventListener('orientationchange', updateResponsiveSettings);
    };
  }, []);

  // Step navigation functions
  const goToStep = useCallback((stepId: OnboardingStepId) => {
    const stepIndex = steps.findIndex(step => step.id === stepId);
    if (stepIndex === -1) return;

    // Record time spent on current step
    const timeSpent = (Date.now() - stepStartTime.current) / 1000;
    const currentStepId = state.progress.currentStepId;

    setState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        currentStepIndex: stepIndex,
        currentStepId: stepId,
        timeSpentPerStep: {
          ...prev.progress.timeSpentPerStep,
          [currentStepId]: (prev.progress.timeSpentPerStep[currentStepId] || 0) + timeSpent,
        },
      },
    }));

    // Reset step timer
    stepStartTime.current = Date.now();

    // Announce step change to screen readers
    if (state.accessibility.announceStepChanges) {
      const step = steps[stepIndex];
      announceAuthStatus(`Moving to step ${stepIndex + 1}: ${step.title}`, 'polite');
    }

    // Focus management for accessibility
    if (containerRef.current) {
      const stepContent = containerRef.current.querySelector('[role="main"]');
      if (stepContent) {
        (stepContent as HTMLElement).focus();
      }
    }
  }, [steps, state.progress.currentStepId, state.accessibility.announceStepChanges, announceAuthStatus]);

  const nextStep = useCallback(() => {
    const nextIndex = state.progress.currentStepIndex + 1;
    if (nextIndex < steps.length) {
      const currentStepId = state.progress.currentStepId;
      
      setState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          completedSteps: [...prev.progress.completedSteps, currentStepId],
        },
      }));
      
      goToStep(steps[nextIndex].id);
    }
  }, [state.progress.currentStepIndex, state.progress.currentStepId, steps, goToStep]);

  const previousStep = useCallback(() => {
    const prevIndex = state.progress.currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(steps[prevIndex].id);
    }
  }, [state.progress.currentStepIndex, steps, goToStep]);

  const skipStep = useCallback(() => {
    const currentStepId = state.progress.currentStepId;
    
    setState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        skippedSteps: [...prev.progress.skippedSteps, currentStepId],
      },
    }));
    
    nextStep();
  }, [state.progress.currentStepId, nextStep]);

  const completeOnboarding = useCallback(async () => {
    const completedAt = new Date().toISOString();
    const totalDuration = (Date.now() - new Date(state.progress.startedAt).getTime()) / 1000;

    setState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        completedAt,
        completedSteps: [...prev.progress.completedSteps, state.progress.currentStepId],
      },
    }));

    try {
      // Save onboarding completion to server via API
      const response = await fetch('/api/user/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completedAt,
          totalDuration,
          userChoices: state.progress.userChoices,
          persona: state.progress.userPersona,
          finalStep: state.progress.currentStepId,
          tutorialProgress: {
            profileSetup: true,
            workspaceIntro: true,
            firstCard: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // Also save to localStorage as backup
      localStorage.setItem('nexus-onboarding-completed', JSON.stringify({
        completedAt,
        totalDuration,
        userChoices: state.progress.userChoices,
        persona: state.progress.userPersona,
      }));

      // Announce completion
      announceAuthStatus('Onboarding completed successfully! Redirecting to workspace.', 'polite');

      // Redirect to workspace after short delay
      setTimeout(() => {
        router.push('/workspace');
      }, 2000);

    } catch (error) {
      console.error('Failed to complete onboarding on server:', error);
      
      // Still save to localStorage and redirect even if server call fails
      localStorage.setItem('nexus-onboarding-completed', JSON.stringify({
        completedAt,
        totalDuration,
        userChoices: state.progress.userChoices,
        persona: state.progress.userPersona,
      }));

      announceAuthStatus('Onboarding completed! Redirecting to workspace.', 'polite');
      
      setTimeout(() => {
        router.push('/workspace');
      }, 2000);
    }
  }, [state.progress, router, announceAuthStatus]);

  const exitOnboarding = useCallback(() => {
    const confirmExit = window.confirm(
      'Are you sure you want to exit the onboarding? You can always restart it later from your workspace.'
    );
    
    if (confirmExit) {
      router.push('/workspace');
    }
  }, [router]);

  const updateProgress = useCallback((updates: Partial<OnboardingProgress>) => {
    setState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        ...updates,
      },
    }));
  }, []);

  // Current step data
  const currentStep = steps[state.progress.currentStepIndex];
  const StepComponent = currentStep?.component;

  // Computed values
  const isFirstStep = state.progress.currentStepIndex === 0;
  const isLastStep = state.progress.currentStepIndex === steps.length - 1;
  const canGoNext = true; // Can be customized per step
  const canGoBack = !isFirstStep;

  // Step props
  const stepProps: OnboardingStepProps = {
    onNext: nextStep,
    onPrevious: canGoBack ? previousStep : undefined,
    onSkip: currentStep?.isOptional ? skipStep : undefined,
    onComplete: completeOnboarding,
    currentStep: state.progress.currentStepIndex + 1,
    totalSteps: steps.length,
    stepId: currentStep?.id || 'welcome',
    isActive: true,
    canGoNext,
    canGoBack,
    progress: state.progress,
    updateProgress,
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-canvas-base flex flex-col"
      data-reduce-motion={state.accessibility.reduceMotion}
    >
      {/* Header with progress and exit button */}
      <header className="bg-white border-b border-border-default px-4 py-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-text-primary">
              Welcome to Project Nexus
            </h1>
            {user && (
              <span className="text-sm text-text-secondary">
                Hello, {user.name || 'there'}!
              </span>
            )}
          </div>
          
          {state.canExit && (
            <IconButton
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              }
              variant="ghost"
              size="medium"
              onClick={exitOnboarding}
              aria-label="Exit onboarding and go to workspace"
              className="text-neutral-500 hover:text-neutral-700"
            />
          )}
        </div>
        
        {/* Progress indicator */}
        <div className="max-w-4xl mx-auto mt-4">
          <ProgressIndicator
            currentStep={state.progress.currentStepIndex}
            totalSteps={steps.length}
            steps={steps}
            onStepClick={(stepIndex) => {
              const step = steps[stepIndex];
              if (step) goToStep(step.id);
            }}
          />
        </div>
      </header>

      {/* Main content */}
      <main 
        className="flex-1 overflow-hidden"
        role="main"
        aria-label={`Onboarding step ${state.progress.currentStepIndex + 1}: ${currentStep?.title}`}
        tabIndex={-1}
      >
        {StepComponent && (
          <div 
            className={cn(
              'h-full transition-all duration-300',
              state.accessibility.reduceMotion && 'transition-none'
            )}
          >
            <StepComponent {...stepProps} />
          </div>
        )}
      </main>

      {/* Footer with navigation (only show if not in completion step) */}
      {currentStep?.id !== 'completion' && (
        <footer className="bg-white border-t border-border-default px-4 py-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {canGoBack && (
                <Button
                  variant="outline"
                  size="medium"
                  onClick={previousStep}
                  leftIcon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  }
                >
                  Previous
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {currentStep?.isOptional && (
                <Button
                  variant="ghost"
                  size="medium"
                  onClick={skipStep}
                >
                  Skip
                </Button>
              )}
              
              <Button
                variant="primary"
                size="medium"
                onClick={isLastStep ? completeOnboarding : nextStep}
                disabled={!canGoNext}
                rightIcon={
                  !isLastStep ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  ) : undefined
                }
              >
                {isLastStep ? 'Complete Setup' : 'Continue'}
              </Button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};