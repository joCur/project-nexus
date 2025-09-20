'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent } from '@/components/ui';
import { OnboardingStepProps, UserPersona } from '@/types/onboarding';
import { useAuth } from '@/hooks/use-auth';

/**
 * Achievement badge component
 */
interface AchievementBadgeProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  isUnlocked: boolean;
  delay?: number;
}

const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  title,
  description,
  icon,
  isUnlocked,
  delay = 0,
}) => {
  const [visible, setVisible] = useState(!isUnlocked);

  useEffect(() => {
    if (isUnlocked) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [isUnlocked, delay]);

  if (!visible) return null;

  return (
    <div className={cn(
      'flex items-center space-x-3 p-4 rounded-lg border transition-all duration-500',
      isUnlocked 
        ? 'bg-success-50 border-success-200 animate-slide-up' 
        : 'bg-neutral-50 border-neutral-200 opacity-50'
    )}>
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center',
        isUnlocked ? 'bg-success-100 text-success-600' : 'bg-neutral-100 text-neutral-400'
      )}>
        {icon}
      </div>
      
      <div className="flex-1">
        <h4 className={cn(
          'font-semibold text-sm',
          isUnlocked ? 'text-success-700' : 'text-neutral-500'
        )}>
          {title}
        </h4>
        <p className={cn(
          'text-xs',
          isUnlocked ? 'text-success-600' : 'text-neutral-400'
        )}>
          {description}
        </p>
      </div>
      
      {isUnlocked && (
        <div className="text-success-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
};

/**
 * Next steps card component
 */
interface NextStepCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionText: string;
  onAction: () => void;
  isRecommended?: boolean;
  comingSoon?: boolean;
}

const NextStepCard: React.FC<NextStepCardProps> = ({
  title,
  description,
  icon,
  actionText,
  onAction,
  isRecommended = false,
  comingSoon = false,
}) => {
  return (
    <Card className={cn(
      'cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1',
      isRecommended && 'ring-2 ring-primary-500 bg-primary-50 border-primary-300',
      comingSoon && 'border-dashed border-warning-300 bg-warning-50 opacity-75'
    )}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className={cn(
            'w-12 h-12 rounded-lg flex items-center justify-center',
            isRecommended ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-600',
            comingSoon && 'bg-warning-100 text-warning-600'
          )}>
            {icon}
          </div>
          
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <h3 className={cn(
                'font-semibold',
                isRecommended ? 'text-primary-700' : 'text-text-primary',
                comingSoon && 'text-warning-700'
              )}>
                {title}
                {isRecommended && (
                  <span className="ml-2 text-xs bg-primary-200 text-primary-700 px-2 py-1 rounded">
                    Recommended
                  </span>
                )}
                {comingSoon && (
                  <span className="ml-2 text-xs bg-warning-200 text-warning-700 px-2 py-1 rounded">
                    Coming Soon
                  </span>
                )}
              </h3>
            </div>
            
            <p className="text-text-secondary text-sm mb-4 leading-relaxed">
              {description}
            </p>
            
            <Button
              variant={comingSoon ? 'outline' : isRecommended ? 'primary' : 'outline'}
              size="small"
              onClick={onAction}
              disabled={comingSoon}
              className={comingSoon ? 'border-warning-300 text-warning-600 bg-warning-50' : ''}
            >
              {actionText}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Completion step component
 */
export const CompletionStep: React.FC<OnboardingStepProps> = ({
  progress,
  updateProgress,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [showCelebration, setShowCelebration] = useState(true);
  const [achievementsUnlocked, setAchievementsUnlocked] = useState(false);

  const userPersona = progress.userPersona || 'general';
  const completedFeatures = progress.hasSeenFeatures;
  const selectedFeatures = progress.userChoices.interestedFeatures;

  // Calculate completion stats
  const totalDuration = progress.completedAt 
    ? (new Date(progress.completedAt).getTime() - new Date(progress.startedAt).getTime()) / 1000 / 60
    : 0;

  // Achievements based on onboarding progress
  const achievements = [
    {
      id: 'first-steps',
      title: 'First Steps',
      description: 'Completed the welcome and setup process',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      unlocked: true,
    },
    {
      id: 'canvas-explorer',
      title: 'Canvas Explorer',
      description: 'Learned spatial organization on the infinite canvas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
      unlocked: completedFeatures.has('canvas-basics'),
    },
    {
      id: 'ai-master',
      title: 'AI Master',
      description: 'Experienced the magic of AI-powered connections',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      unlocked: completedFeatures.has('ai-connections'),
    },
    {
      id: 'organizer',
      title: 'Knowledge Organizer', 
      description: 'Mastered spatial thinking and knowledge clustering',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      unlocked: completedFeatures.has('spatial-organization'),
    },
  ];

  // Persona-specific next steps
  const getPersonaNextSteps = (persona: UserPersona) => {
    const baseSteps = [
      {
        id: 'create-workspace',
        title: 'Create Your First Workspace',
        description: 'Start building your knowledge graph with a fresh workspace tailored to your needs.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
        actionText: 'Start Creating',
        action: () => router.push('/workspace'),
        isRecommended: true,
      },
    ];

    const personaSteps = {
      student: [
        {
          id: 'study-template',
          title: 'Try Study Templates',
          description: 'Use pre-built templates for course notes, research projects, and exam preparation.',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          ),
          actionText: 'Coming Soon',
          action: () => {},
          comingSoon: true,
        },
      ],
      researcher: [
        {
          id: 'import-research',
          title: 'Import Research Data',
          description: 'Connect your reference manager or import papers to start building your research graph.',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          ),
          actionText: 'Coming Soon',
          action: () => {},
          comingSoon: true,
        },
      ],
      creative: [
        {
          id: 'mood-board',
          title: 'Create a Mood Board',
          description: 'Start with a visual inspiration board to collect ideas, references, and creative concepts.',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          actionText: 'Coming Soon',
          action: () => {},
          comingSoon: true,
        },
      ],
      business: [
        {
          id: 'strategy-map',
          title: 'Build a Strategy Map',
          description: 'Map out your business strategy, goals, and initiatives in a visual framework.',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a7 7 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          actionText: 'Coming Soon',
          action: () => {},
          comingSoon: true,
        },
      ],
      general: [
        {
          id: 'personal-kb',
          title: 'Personal Knowledge Base',
          description: 'Create a central hub for your interests, goals, and personal learning journey.',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
          actionText: 'Coming Soon',
          action: () => {},
          comingSoon: true,
        },
      ],
    };

    return [...baseSteps, ...(personaSteps[persona] || personaSteps.general)];
  };

  const nextSteps = getPersonaNextSteps(userPersona);

  // Unlock achievements with delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setAchievementsUnlocked(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Auto-hide celebration after viewing
  useEffect(() => {
    if (showCelebration) {
      const timer = setTimeout(() => {
        setShowCelebration(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [showCelebration]);

  const handleStartWorkspace = () => {
    // Mark onboarding as completely finished
    updateProgress({
      completedAt: new Date().toISOString(),
    });
    
    // Save completion to localStorage
    localStorage.setItem('nexus-onboarding-completed', JSON.stringify({
      completedAt: new Date().toISOString(),
      persona: userPersona,
      selectedFeatures,
      achievements: achievements.filter(a => a.unlocked).map(a => a.id),
    }));
    
    router.push('/workspace');
  };

  const personaLabels = {
    student: 'Student',
    researcher: 'Researcher',
    creative: 'Creative', 
    business: 'Business Professional',
    general: 'Explorer',
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-success-50 to-primary-50">
      {/* Celebration Header */}
      <div className="text-center py-12 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Celebration animation */}
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-success-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-gentle">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            {/* Confetti effect */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'absolute w-2 h-2 rounded-full animate-bounce',
                    i % 4 === 0 && 'bg-primary-400',
                    i % 4 === 1 && 'bg-secondary-400',
                    i % 4 === 2 && 'bg-success-400',
                    i % 4 === 3 && 'bg-warning-400'
                  )}
                  style={{
                    left: `${20 + (i * 5)}%`,
                    top: `${10 + (i % 3) * 20}%`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${2 + (i % 3) * 0.5}s`,
                  }}
                />
              ))}
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            🎉 Congratulations, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
          
          <p className="text-xl text-text-secondary mb-2">
            You&rsquo;ve successfully completed your Project Nexus onboarding
          </p>
          
          <p className="text-text-tertiary">
            Ready to transform your ideas into interconnected knowledge
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-6 pb-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Summary stats */}
          <div className="bg-white rounded-xl border border-border-default p-6">
            <h2 className="text-xl font-bold text-text-primary mb-6 text-center">
              Your Onboarding Journey
            </h2>
            
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-primary-600 mb-1">
                  {Math.round(totalDuration)} min
                </div>
                <div className="text-text-secondary text-sm">
                  Time invested in learning
                </div>
              </div>
              
              <div>
                <div className="text-2xl font-bold text-success-600 mb-1">
                  {completedFeatures.size}
                </div>
                <div className="text-text-secondary text-sm">
                  Features explored
                </div>
              </div>
              
              <div>
                <div className="text-2xl font-bold text-secondary-600 mb-1">
                  {personaLabels[userPersona]}
                </div>
                <div className="text-text-secondary text-sm">
                  Your selected profile
                </div>
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-white rounded-xl border border-border-default p-6">
            <h2 className="text-xl font-bold text-text-primary mb-6">
              Achievements Unlocked
            </h2>
            
            <div className="space-y-3">
              {achievements.map((achievement, index) => (
                <AchievementBadge
                  key={achievement.id}
                  {...achievement}
                  isUnlocked={achievementsUnlocked && achievement.unlocked}
                  delay={index * 300}
                />
              ))}
            </div>
          </div>

          {/* Next steps */}
          <div className="bg-white rounded-xl border border-border-default p-6">
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Ready for Your Next Adventure?
            </h2>
            <p className="text-text-secondary mb-6">
              Here are some great ways to start building your knowledge graph:
            </p>
            
            <div className="grid lg:grid-cols-2 gap-4">
              {nextSteps.map((step) => (
                <NextStepCard key={step.id} {...step} onAction={step.action} />
              ))}
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center">
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-3">
                Your Knowledge Journey Starts Now
              </h3>
              <p className="mb-6 opacity-90">
                Transform your scattered thoughts into an interconnected web of knowledge. 
                Every idea you add makes the connections stronger and your insights deeper.
              </p>
              
              <Button
                variant="secondary"
                size="large"
                onClick={handleStartWorkspace}
                className="bg-white text-primary-600 hover:bg-neutral-50"
                rightIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                }
              >
                Enter Your Workspace
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};