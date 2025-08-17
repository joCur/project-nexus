/**
 * Onboarding Types and Interfaces
 * 
 * This file defines all TypeScript interfaces and types used throughout
 * the onboarding flow, ensuring type safety and consistency.
 */

/**
 * Onboarding step identifiers
 */
export type OnboardingStepId = 
  | 'welcome'
  | 'canvas-intro'
  | 'ai-demo'
  | 'knowledge-organization'
  | 'advanced-features'
  | 'completion';

/**
 * User persona selection for personalized onboarding
 */
export type UserPersona = 
  | 'student'
  | 'researcher'
  | 'creative'
  | 'business'
  | 'general';

/**
 * Onboarding step configuration
 */
export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  component: React.ComponentType<OnboardingStepProps>;
  isOptional?: boolean;
  estimatedDuration?: number; // in seconds
  prerequisites?: OnboardingStepId[];
}

/**
 * Props passed to each onboarding step component
 */
export interface OnboardingStepProps {
  onNext: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  onComplete: () => void;
  currentStep: number;
  totalSteps: number;
  stepId: OnboardingStepId;
  isActive: boolean;
  canGoNext: boolean;
  canGoBack: boolean;
  progress: OnboardingProgress;
  updateProgress: (updates: Partial<OnboardingProgress>) => void;
}

/**
 * Onboarding progress tracking
 */
export interface OnboardingProgress {
  currentStepIndex: number;
  currentStepId: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  userPersona?: UserPersona;
  startedAt: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  timeSpentPerStep: Record<OnboardingStepId, number>; // in seconds
  userChoices: OnboardingUserChoices;
  hasSeenFeatures: Set<string>;
  canRetakeOnboarding: boolean;
}

/**
 * User choices and preferences gathered during onboarding
 */
export interface OnboardingUserChoices {
  persona?: UserPersona;
  interestedFeatures: string[];
  preferredCardStyle?: 'minimal' | 'detailed' | 'visual';
  enableAIAssistance: boolean;
  enableTutorialMode: boolean;
  notificationPreferences: {
    aiSuggestions: boolean;
    connectionUpdates: boolean;
    weeklyDigest: boolean;
  };
  workspacePreferences: {
    defaultView: 'canvas' | 'list' | 'grid';
    autoSave: boolean;
    collaborationMode: 'private' | 'team' | 'public';
  };
}

/**
 * Tutorial overlay configuration for guided experiences
 */
export interface TutorialOverlay {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlightType: 'spotlight' | 'border' | 'glow';
  allowBackgroundClick?: boolean;
  showArrow?: boolean;
  customContent?: React.ReactNode;
  onShow?: () => void;
  onHide?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

/**
 * Interactive demonstration configuration
 */
export interface InteractiveDemo {
  id: string;
  type: 'card-creation' | 'ai-connection' | 'workspace-navigation' | 'feature-showcase';
  title: string;
  description: string;
  steps: DemoStep[];
  allowUserInteraction: boolean;
  autoPlay?: boolean;
  playbackSpeed?: number; // 0.5 to 2.0
}

/**
 * Individual demo step configuration
 */
export interface DemoStep {
  id: string;
  action: 'click' | 'type' | 'drag' | 'wait' | 'highlight' | 'animate';
  target?: string; // CSS selector
  content?: string; // text to type or display
  duration?: number; // in milliseconds
  description: string;
  isInteractive?: boolean;
  waitForUser?: boolean;
  validation?: DemoStepValidation;
}

/**
 * Demo step validation for interactive elements
 */
export interface DemoStepValidation {
  type: 'element-exists' | 'text-matches' | 'custom';
  selector?: string;
  expectedText?: string;
  customValidator?: () => boolean;
  errorMessage?: string;
}

/**
 * Onboarding analytics events
 */
export interface OnboardingAnalyticsEvent {
  type: 'step_started' | 'step_completed' | 'step_skipped' | 'demo_interacted' | 'choice_made' | 'error_occurred';
  stepId: OnboardingStepId;
  timestamp: string;
  duration?: number;
  userChoice?: string;
  errorDetails?: string;
  metadata?: Record<string, any>;
}

/**
 * Onboarding completion result
 */
export interface OnboardingCompletionResult {
  success: boolean;
  completedAt: string;
  totalDuration: number; // in seconds
  stepsCompleted: OnboardingStepId[];
  stepsSkipped: OnboardingStepId[];
  userChoices: OnboardingUserChoices;
  finalPersona: UserPersona;
  redirectTo: string; // URL to redirect after completion
  showCelebration: boolean;
  earnedAchievements?: string[];
}

/**
 * Accessibility configuration for onboarding
 */
export interface OnboardingAccessibility {
  reduceMotion: boolean;
  highContrast: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigationEnabled: boolean;
  focusTrapEnabled: boolean;
  announceStepChanges: boolean;
  customAriaLabels?: Record<string, string>;
}

/**
 * Responsive design configuration
 */
export interface OnboardingResponsive {
  currentBreakpoint: 'mobile' | 'tablet' | 'desktop';
  isTouchDevice: boolean;
  orientation: 'portrait' | 'landscape';
  adaptiveLayout: boolean;
  simplifiedUI: boolean;
}

/**
 * Error handling for onboarding flow
 */
export interface OnboardingError {
  code: string;
  message: string;
  stepId?: OnboardingStepId;
  recoverable: boolean;
  suggestedAction?: 'retry' | 'skip' | 'restart' | 'contact_support';
  timestamp: string;
}

/**
 * State management for the entire onboarding flow
 */
export interface OnboardingState {
  progress: OnboardingProgress;
  accessibility: OnboardingAccessibility;
  responsive: OnboardingResponsive;
  activeOverlay?: TutorialOverlay;
  activeDemo?: InteractiveDemo;
  errors: OnboardingError[];
  isLoading: boolean;
  isPaused: boolean;
  canExit: boolean;
}

/**
 * Actions for onboarding state management
 */
export interface OnboardingActions {
  // Navigation
  goToStep: (stepId: OnboardingStepId) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipStep: () => void;
  restartOnboarding: () => void;
  exitOnboarding: () => void;
  
  // Progress management
  updateProgress: (updates: Partial<OnboardingProgress>) => void;
  recordChoice: (key: keyof OnboardingUserChoices, value: any) => void;
  markFeatureSeen: (featureId: string) => void;
  
  // Tutorial and demo control
  showOverlay: (overlay: TutorialOverlay) => void;
  hideOverlay: () => void;
  startDemo: (demo: InteractiveDemo) => void;
  stopDemo: () => void;
  pauseDemo: () => void;
  resumeDemo: () => void;
  
  // Accessibility and responsiveness
  updateAccessibility: (updates: Partial<OnboardingAccessibility>) => void;
  updateResponsive: (updates: Partial<OnboardingResponsive>) => void;
  
  // Error handling
  recordError: (error: OnboardingError) => void;
  clearErrors: () => void;
  retryStep: () => void;
  
  // Analytics
  recordAnalyticsEvent: (event: OnboardingAnalyticsEvent) => void;
}

/**
 * Complete onboarding context type
 */
export interface OnboardingContextType {
  state: OnboardingState;
  actions: OnboardingActions;
  steps: OnboardingStep[];
  currentStep: OnboardingStep | null;
}

/**
 * Hook return type for onboarding functionality
 */
export interface UseOnboardingReturn extends OnboardingContextType {
  // Computed values
  isFirstStep: boolean;
  isLastStep: boolean;
  progressPercentage: number;
  estimatedTimeRemaining: number;
  canComplete: boolean;
}