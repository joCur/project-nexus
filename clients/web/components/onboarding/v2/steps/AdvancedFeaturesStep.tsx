'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { OnboardingStepProps, UserPersona } from '@/types/onboarding';

/**
 * Feature showcase card component
 */
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  benefits: string[];
  isRelevant: boolean;
  isSelected: boolean;
  onSelect: () => void;
  comingSoon?: boolean;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  benefits,
  isRelevant,
  isSelected,
  onSelect,
  comingSoon = false,
}) => {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-lg',
        'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2',
        isSelected && 'ring-2 ring-primary-500 bg-primary-50 border-primary-300',
        !isRelevant && 'opacity-60',
        comingSoon && 'border-dashed border-warning-300 bg-warning-50'
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              isSelected ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-600',
              comingSoon && 'bg-warning-100 text-warning-600'
            )}>
              {icon}
            </div>
            <div>
              <CardTitle className={cn(
                'text-base',
                isSelected ? 'text-primary-700' : 'text-text-primary',
                comingSoon && 'text-warning-700'
              )}>
                {title}
                {comingSoon && (
                  <span className="ml-2 text-xs bg-warning-200 text-warning-700 px-2 py-1 rounded">
                    Coming Soon
                  </span>
                )}
              </CardTitle>
            </div>
          </div>
          
          {isRelevant && !comingSoon && (
            <div className="text-success-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-text-secondary text-sm mb-4 leading-relaxed">
          {description}
        </p>
        
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">
            Benefits:
          </p>
          <ul className="text-xs text-text-tertiary space-y-1">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-start">
                <span className="text-primary-500 mr-2">•</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        
        {/* Hidden button for accessibility */}
        <button
          className="sr-only"
          onClick={onSelect}
          aria-label={`Select ${title} feature`}
        >
          Select {title}
        </button>
      </CardContent>
    </Card>
  );
};

/**
 * Mobile mockup component
 */
const MobileMockup: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState(0);
  
  const screens = [
    {
      title: 'Quick Capture',
      content: 'Capture ideas instantly while on-the-go with voice-to-text and photo integration.',
    },
    {
      title: 'Smart Sync',
      content: 'All your mobile captures automatically sync and integrate with your workspace.',
    },
    {
      title: 'Offline Access',
      content: 'Access your knowledge graph even without internet connection.',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentScreen(prev => (prev + 1) % screens.length);
    }, 2000);
    
    return () => clearInterval(timer);
  }, []);

  const currentScreenData = screens[currentScreen];

  return (
    <div className="relative">
      <div className="w-32 h-64 bg-neutral-800 rounded-2xl p-2 shadow-xl">
        <div className="w-full h-full bg-white rounded-xl overflow-hidden">
          {/* Status bar */}
          <div className="bg-neutral-900 h-6 flex items-center justify-center">
            <div className="flex items-center space-x-1">
              <div className="w-1 h-1 bg-white rounded-full" />
              <div className="w-1 h-1 bg-white rounded-full" />
              <div className="w-1 h-1 bg-white rounded-full" />
            </div>
          </div>
          
          {/* Content */}
          <div className="p-3 h-full">
            <div className="text-center animate-fade-in">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h4 className="text-xs font-semibold text-text-primary mb-1">
                {currentScreenData.title}
              </h4>
              <p className="text-xs text-text-secondary leading-tight">
                {currentScreenData.content}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Screen indicators */}
      <div className="flex justify-center space-x-1 mt-2">
        {screens.map((_, index) => (
          <div
            key={index}
            className={cn(
              'w-2 h-2 rounded-full transition-colors duration-200',
              index === currentScreen ? 'bg-primary-500' : 'bg-neutral-300'
            )}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Advanced Features step component
 */
export const AdvancedFeaturesStep: React.FC<OnboardingStepProps> = ({
  onNext,
  progress,
  updateProgress,
}) => {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [showPersonalizedView, setShowPersonalizedView] = useState(false);

  const userPersona = progress.userPersona || 'general';

  // Define features with persona relevance
  const features = [
    {
      id: 'mobile-capture',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      title: 'Mobile Capture',
      description: 'Capture ideas instantly on your mobile device with voice-to-text, photos, and quick notes.',
      benefits: [
        'Voice-to-text transcription',
        'Photo and document scanning',
        'Offline capture capability',
        'Automatic workspace sync'
      ],
      relevantFor: ['student', 'researcher', 'creative', 'business', 'general'],
      comingSoon: true,
    },
    {
      id: 'real-time-collaboration',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: 'Real-time Collaboration',
      description: 'Work together with your team in shared workspaces with live editing and commenting.',
      benefits: [
        'Live collaborative editing',
        'Comment and discussion threads',
        'Permission-based sharing',
        'Version history tracking'
      ],
      relevantFor: ['business', 'researcher', 'student'],
      comingSoon: true,
    },
    {
      id: 'ai-insights',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'Advanced AI Insights',
      description: 'Get intelligent suggestions for content expansion, trend analysis, and knowledge gaps.',
      benefits: [
        'Content suggestion engine',
        'Knowledge gap identification',
        'Trend pattern analysis',
        'Automated categorization'
      ],
      relevantFor: ['researcher', 'business', 'student', 'general'],
      comingSoon: true,
    },
    {
      id: 'export-integration',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
      title: 'Export & Integration',
      description: 'Export your knowledge graphs to various formats and integrate with popular tools.',
      benefits: [
        'PDF and image exports',
        'Notion, Obsidian sync',
        'API access for developers',
        'Backup and migration tools'
      ],
      relevantFor: ['researcher', 'business', 'creative', 'general'],
      comingSoon: true,
    },
    {
      id: 'templates-library',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      title: 'Smart Templates',
      description: 'Start quickly with pre-designed templates for common use cases and workflows.',
      benefits: [
        'Industry-specific templates',
        'Customizable frameworks',
        'Best practice patterns',
        'Community template sharing'
      ],
      relevantFor: ['business', 'student', 'creative', 'general'],
      comingSoon: true,
    },
    {
      id: 'advanced-search',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      title: 'Semantic Search',
      description: 'Find information using natural language queries and conceptual similarity.',
      benefits: [
        'Natural language queries',
        'Conceptual similarity search',
        'Cross-reference discovery',
        'Saved search filters'
      ],
      relevantFor: ['researcher', 'business', 'student', 'general'],
      comingSoon: true,
    },
  ];

  const handleFeatureSelect = (featureId: string) => {
    setSelectedFeatures(prev => 
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const handleContinue = () => {
    updateProgress({
      hasSeenFeatures: new Set([...progress.hasSeenFeatures, 'advanced-features']),
      userChoices: {
        ...progress.userChoices,
        interestedFeatures: selectedFeatures,
      },
    });
    onNext();
  };

  const handleShowPersonalized = () => {
    setShowPersonalizedView(true);
    // Auto-select relevant features
    const relevantFeatures = features
      .filter(f => f.relevantFor.includes(userPersona as UserPersona))
      .map(f => f.id);
    setSelectedFeatures(relevantFeatures);
  };

  const personaLabels = {
    student: 'Student',
    researcher: 'Researcher', 
    creative: 'Creative',
    business: 'Business',
    general: 'Explorer',
  };

  return (
    <div className="h-full flex flex-col bg-canvas-base">
      {/* Header */}
      <div className="bg-white border-b border-border-default px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Advanced Features Preview
          </h2>
          <p className="text-text-secondary">
            Discover powerful features that will supercharge your knowledge management workflow.
          </p>
        </div>
      </div>

      {/* Personalization prompt */}
      {!showPersonalizedView && (
        <div className="bg-gradient-to-r from-primary-50 to-secondary-50 border-b border-primary-200 px-6 py-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-primary-700 mb-1">
                  Personalized for {personaLabels[userPersona as UserPersona]}
                </h3>
                <p className="text-primary-600 text-sm">
                  See features most relevant to your workflow and goals
                </p>
              </div>
            </div>
            
            <Button
              variant="primary"
              onClick={handleShowPersonalized}
            >
              Show My Features
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {showPersonalizedView && (
            <div className="mb-8 text-center">
              <div className="inline-flex items-center bg-success-50 border border-success-200 rounded-lg px-4 py-2 mb-4">
                <svg className="w-5 h-5 text-success-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-success-700 font-medium">
                  Features personalized for {personaLabels[userPersona as UserPersona]}
                </span>
              </div>
              <p className="text-text-secondary">
                Select the features you're most interested in trying out first.
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {features.map((feature) => {
              const isRelevant = !showPersonalizedView || feature.relevantFor.includes(userPersona as UserPersona);
              return (
                <FeatureCard
                  key={feature.id}
                  {...feature}
                  isRelevant={isRelevant}
                  isSelected={selectedFeatures.includes(feature.id)}
                  onSelect={() => handleFeatureSelect(feature.id)}
                />
              );
            })}
          </div>

          {/* Mobile preview section */}
          <div className="bg-white rounded-xl border border-border-default p-8 mb-8">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-xl font-bold text-text-primary mb-4">
                  Coming Soon: Mobile App
                </h3>
                <p className="text-text-secondary mb-6 leading-relaxed">
                  Capture ideas anywhere, anytime. Our mobile app will let you add to your 
                  knowledge graph while on-the-go, with everything syncing seamlessly to your workspace.
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary-500 rounded-full" />
                    <span className="text-text-secondary text-sm">
                      Voice-to-text for quick idea capture
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary-500 rounded-full" />
                    <span className="text-text-secondary text-sm">
                      Photo scanning with OCR text extraction
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary-500 rounded-full" />
                    <span className="text-text-secondary text-sm">
                      Offline mode with automatic sync
                    </span>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Button variant="outline" disabled>
                    Notify Me When Available
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-center">
                <MobileMockup />
              </div>
            </div>
          </div>

          {/* Summary section */}
          {selectedFeatures.length > 0 && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 text-center">
              <h3 className="font-semibold text-primary-700 mb-2">
                Great choices! You've selected {selectedFeatures.length} features
              </h3>
              <p className="text-primary-600 text-sm mb-4">
                We'll highlight these features in your workspace and provide guided tutorials when you're ready.
              </p>
              
              <Button
                variant="primary"
                size="large"
                onClick={handleContinue}
                rightIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                }
              >
                Complete Setup
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="bg-white border-t border-border-default px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-text-tertiary">
              Features selected: {selectedFeatures.length}/{features.length}
            </div>
            
            {selectedFeatures.length > 0 && (
              <div className="flex items-center space-x-2">
                {selectedFeatures.slice(0, 3).map((featureId) => {
                  const feature = features.find(f => f.id === featureId);
                  return (
                    <div key={featureId} className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                      {feature?.title}
                    </div>
                  );
                })}
                {selectedFeatures.length > 3 && (
                  <div className="text-xs text-text-tertiary">
                    +{selectedFeatures.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="text-sm text-text-tertiary">
            Step 5 of 6: Advanced Features
          </div>
        </div>
      </div>
    </div>
  );
};