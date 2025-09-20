'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import Image from 'next/image';
import { OnboardingStepProps, UserPersona } from '@/types/onboarding';
import { useAuth } from '@/hooks/use-auth';

/**
 * Persona card component for user selection
 */
interface PersonaCardProps {
  persona: UserPersona;
  title: string;
  description: string;
  icon: React.ReactNode;
  examples: string[];
  isSelected: boolean;
  onSelect: (persona: UserPersona) => void;
}

const PersonaCard: React.FC<PersonaCardProps> = ({
  persona,
  title,
  description,
  icon,
  examples,
  isSelected,
  onSelect,
}) => {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1',
        'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2',
        isSelected && 'ring-2 ring-primary-500 bg-primary-50 border-primary-300',
        !isSelected && 'hover:border-primary-200'
      )}
      onClick={() => onSelect(persona)}
    >
      <CardHeader className="text-center pb-4">
        <div className={cn(
          'w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4',
          isSelected ? 'bg-primary-500 text-white' : 'bg-primary-100 text-primary-600'
        )}>
          {icon}
        </div>
        <CardTitle className={cn(
          'text-lg',
          isSelected ? 'text-primary-700' : 'text-text-primary'
        )}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-text-secondary mb-4 leading-relaxed">
          {description}
        </p>
        <div className="text-left">
          <p className="text-sm font-medium text-text-secondary mb-2">
            Great for:
          </p>
          <ul className="text-sm text-text-tertiary space-y-1">
            {examples.map((example, index) => (
              <li key={index} className="flex items-start">
                <span className="text-primary-500 mr-2">•</span>
                {example}
              </li>
            ))}
          </ul>
        </div>
        
        {/* Hidden button for accessibility */}
        <button
          className="sr-only"
          onClick={() => onSelect(persona)}
          aria-label={`Select ${title} persona`}
        >
          Select {title}
        </button>
      </CardContent>
    </Card>
  );
};

/**
 * Welcome step component - introduces Project Nexus and allows persona selection
 */
export const WelcomeStep: React.FC<OnboardingStepProps> = ({
  onNext,
  progress,
  updateProgress,
}) => {
  const { user } = useAuth();
  const [selectedPersona, setSelectedPersona] = useState<UserPersona | undefined>(
    progress.userPersona
  );
  const [showPersonaDetails, setShowPersonaDetails] = useState(false);

  // Auto-advance to persona selection after initial viewing
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPersonaDetails(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Update progress when persona is selected
  useEffect(() => {
    if (selectedPersona) {
      updateProgress({
        userPersona: selectedPersona,
        userChoices: {
          ...progress.userChoices,
          persona: selectedPersona,
        },
      });
    }
  }, [selectedPersona, updateProgress, progress.userChoices]);

  const handlePersonaSelect = (persona: UserPersona) => {
    setSelectedPersona(persona);
  };

  const handleContinue = () => {
    if (selectedPersona) {
      onNext();
    }
  };

  // Persona configurations
  const personas: Array<{
    id: UserPersona;
    title: string;
    description: string;
    icon: React.ReactNode;
    examples: string[];
  }> = [
    {
      id: 'student',
      title: 'Student',
      description: 'Learning and academic research with interconnected knowledge building.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      examples: [
        'Course notes and study materials',
        'Research paper organization',
        'Connecting concepts across subjects',
        'Exam preparation and review'
      ],
    },
    {
      id: 'researcher',
      title: 'Researcher',
      description: 'Academic and professional research with complex knowledge networks.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      examples: [
        'Literature reviews and citations',
        'Hypothesis development',
        'Data analysis insights',
        'Publication planning'
      ],
    },
    {
      id: 'creative',
      title: 'Creative',
      description: 'Creative projects and artistic exploration with visual idea development.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
        </svg>
      ),
      examples: [
        'Design inspiration boards',
        'Project mood and themes',
        'Creative process documentation',
        'Portfolio organization'
      ],
    },
    {
      id: 'business',
      title: 'Business',
      description: 'Strategic planning and business intelligence with actionable insights.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      examples: [
        'Strategic planning sessions',
        'Market research insights',
        'Team collaboration spaces',
        'Process documentation'
      ],
    },
    {
      id: 'general',
      title: 'Explorer',
      description: 'General knowledge management and personal productivity enhancement.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      examples: [
        'Personal knowledge base',
        'Hobby and interest tracking',
        'Goal planning and review',
        'Life organization'
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Hero section */}
      <div className="bg-gradient-to-br from-primary-50 to-secondary-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-6">
              <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-4">
              Welcome to{' '}
              <span className="text-primary-600">Project Nexus</span>
            </h1>
            
            <p className="text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed">
              Transform scattered thoughts into an interconnected knowledge graph. 
              Experience the power of AI-assisted visual thinking and spatial organization.
            </p>
          </div>

          {user && (
            <div className="inline-flex items-center bg-white rounded-lg px-4 py-2 shadow-sm">
              {user.picture && (
                <Image
                  src={user.picture}
                  alt={user.name || user.email || 'User avatar'}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full mr-3"
                />
              )}
              <span className="text-text-secondary">
                Welcome back, <span className="font-medium text-text-primary">{user.name || 'there'}</span>!
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content section */}
      <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {!showPersonaDetails ? (
            // Initial welcome content
            <div className="text-center space-y-8 animate-fade-in">
              <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">AI-Powered Insights</h3>
                  <p className="text-text-secondary">
                    Discover hidden connections between your ideas with intelligent analysis
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Infinite Canvas</h3>
                  <p className="text-text-secondary">
                    Organize thoughts spatially on an unlimited canvas with intuitive interactions
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">Smart Connections</h3>
                  <p className="text-text-secondary">
                    Build meaningful relationships between concepts with visual link system
                  </p>
                </div>
              </div>
              
              <Button
                variant="primary"
                size="large"
                onClick={() => setShowPersonaDetails(true)}
                className="animate-bounce-gentle"
              >
                Let&rsquo;s Get Started
              </Button>
            </div>
          ) : (
            // Persona selection
            <div className="space-y-8 animate-slide-up">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-text-primary mb-4">
                  Tell us about yourself
                </h2>
                <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                  Choose the profile that best describes how you&rsquo;ll use Project Nexus. 
                  This helps us tailor your experience and provide relevant examples.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {personas.map((persona) => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona.id}
                    title={persona.title}
                    description={persona.description}
                    icon={persona.icon}
                    examples={persona.examples}
                    isSelected={selectedPersona === persona.id}
                    onSelect={handlePersonaSelect}
                  />
                ))}
              </div>

              {selectedPersona && (
                <div className="text-center animate-fade-in">
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 max-w-2xl mx-auto mb-6">
                    <div className="flex items-center justify-center mb-4">
                      <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-primary-700 mb-2">
                      Perfect! You&rsquo;re all set as a {personas.find(p => p.id === selectedPersona)?.title}.
                    </h3>
                    <p className="text-primary-600">
                      We&rsquo;ll customize your experience with relevant examples and features 
                      that work best for your use case.
                    </p>
                  </div>
                  
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
                    Continue to Canvas
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};