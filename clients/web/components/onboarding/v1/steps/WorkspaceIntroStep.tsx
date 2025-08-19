'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface TutorialProgress {
  profileSetup: boolean;
  workspaceIntro: boolean;
  firstCard: boolean;
}

interface WorkspaceIntroStepProps {
  workspaceName: string;
  tutorialProgress: TutorialProgress;
  onProgressUpdate: (progress: Partial<TutorialProgress>) => void;
  onNext: () => void;
}

export const WorkspaceIntroStep: React.FC<WorkspaceIntroStepProps> = ({
  workspaceName,
  tutorialProgress,
  onProgressUpdate,
  onNext,
}) => {
  const [currentDemo, setCurrentDemo] = useState<'overview' | 'card' | 'navigation'>('overview');
  const [hasCreatedCard, setHasCreatedCard] = useState(false);
  const [cardContent, setCardContent] = useState('');

  const handleCreateCard = () => {
    if (cardContent.trim()) {
      setHasCreatedCard(true);
      onProgressUpdate({ firstCard: true });
    }
  };

  const handleContinue = () => {
    onProgressUpdate({ workspaceIntro: true });
    onNext();
  };

  const renderDemo = () => {
    switch (currentDemo) {
      case 'overview':
        return (
          <div className="text-center">
            <div className="w-full h-32 bg-canvas-base border-2 border-dashed border-neutral-300 rounded-lg flex items-center justify-center mb-4">
              <div className="text-neutral-500">
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <p className="text-sm">Your infinite canvas workspace</p>
              </div>
            </div>
            <p className="text-text-secondary mb-4">
              This is your personal workspace where you can create and organize knowledge cards on an infinite canvas.
            </p>
          </div>
        );
      
      case 'card':
        return (
          <div>
            <div className="mb-4">
              <div className="w-full h-32 bg-canvas-base border-2 border-dashed border-neutral-300 rounded-lg flex items-center justify-center relative">
                {hasCreatedCard ? (
                  <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-sm max-w-40">
                    <p className="text-sm text-text-primary line-clamp-3">{cardContent}</p>
                  </div>
                ) : (
                  <div className="text-neutral-500 text-center">
                    <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <p className="text-xs">Create your first card below</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <label htmlFor="cardContent" className="block text-sm font-medium text-text-primary mb-2">
                  Try creating your first card:
                </label>
                <textarea
                  id="cardContent"
                  value={cardContent}
                  onChange={(e) => setCardContent(e.target.value)}
                  placeholder="Enter any idea, note, or thought..."
                  className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  rows={3}
                />
              </div>
              
              <Button
                onClick={handleCreateCard}
                disabled={!cardContent.trim() || hasCreatedCard}
                variant={hasCreatedCard ? 'outline' : 'primary'}
                size="small"
                className="w-full"
              >
                {hasCreatedCard ? '✓ Card Created!' : 'Create Card'}
              </Button>
            </div>
          </div>
        );
      
      case 'navigation':
        return (
          <div className="text-center">
            <div className="w-full h-32 bg-canvas-base border-2 border-dashed border-neutral-300 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
              <div className="absolute inset-4 border border-primary-200 rounded animate-pulse"></div>
              <div className="text-primary-600">
                <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-xs">Pan, zoom, and navigate</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <p className="text-text-secondary">Drag to pan</p>
              </div>
              
              <div className="text-center">
                <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-text-secondary">Scroll to zoom</p>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Welcome to {workspaceName}
        </h2>
        <p className="text-text-secondary">
          Let's take a quick tour of your new workspace and its basic features.
        </p>
      </div>

      {/* Demo Navigation */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-neutral-100 rounded-lg p-1">
          <button
            onClick={() => setCurrentDemo('overview')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              currentDemo === 'overview'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setCurrentDemo('card')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              currentDemo === 'card'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            )}
          >
            Create Cards
          </button>
          <button
            onClick={() => setCurrentDemo('navigation')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              currentDemo === 'navigation'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            )}
          >
            Navigation
          </button>
        </div>
      </div>

      {/* Demo Content */}
      <div className="mb-8">
        {renderDemo()}
      </div>

      {/* What's Available Now */}
      <div className="bg-success-50 border border-success-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-success-700 mb-2">
          What's available in v1:
        </h3>
        <ul className="text-sm text-success-600 space-y-1">
          <li>• Create and edit text-based knowledge cards</li>
          <li>• Organize cards on infinite canvas</li>
          <li>• Basic navigation (pan, zoom)</li>
          <li>• Auto-save your work</li>
        </ul>
      </div>

      {/* Coming Soon */}
      <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-8">
        <h3 className="font-semibold text-warning-700 mb-2">
          Coming in future updates:
        </h3>
        <ul className="text-sm text-warning-600 space-y-1">
          <li>• AI-powered connection discovery</li>
          <li>• Real-time collaboration</li>
          <li>• Mobile capture app</li>
          <li>• Advanced organization tools</li>
        </ul>
      </div>

      {/* Continue Button */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleContinue}
          className="text-primary-600 text-sm hover:underline"
        >
          Skip tutorial
        </button>
        
        <Button
          onClick={handleContinue}
          variant="primary"
          size="large"
        >
          {hasCreatedCard ? 'Great! Let\'s Continue' : 'Continue to Workspace'}
        </Button>
      </div>
    </div>
  );
};