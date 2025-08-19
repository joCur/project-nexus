'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent } from '@/components/ui';
import { OnboardingStepProps } from '@/types/onboarding';

/**
 * Simulated card component for the tutorial
 */
interface TutorialCardProps {
  id: string;
  title: string;
  content: string;
  x: number;
  y: number;
  isHighlighted?: boolean;
  isSelected?: boolean;
  onMove?: (id: string, x: number, y: number) => void;
  onClick?: (id: string) => void;
}

const TutorialCard: React.FC<TutorialCardProps> = ({
  id,
  title,
  content,
  x,
  y,
  isHighlighted = false,
  isSelected = false,
  onMove,
  onClick,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onMove) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - x,
      y: e.clientY - y,
    });
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !onMove) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    onMove(id, newX, newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  return (
    <div
      ref={cardRef}
      className={cn(
        'absolute w-64 cursor-move transition-all duration-200',
        'transform-gpu will-change-transform',
        isHighlighted && 'ring-4 ring-primary-300 ring-opacity-75',
        isSelected && 'ring-2 ring-primary-500',
        isDragging && 'scale-105 shadow-xl z-10'
      )}
      style={{
        left: x,
        top: y,
        transform: isDragging ? 'rotate(2deg)' : 'rotate(0deg)',
      }}
      onMouseDown={handleMouseDown}
      onClick={() => onClick?.(id)}
    >
      <Card className={cn(
        'shadow-md hover:shadow-lg transition-shadow duration-200',
        isHighlighted && 'bg-primary-50 border-primary-300',
        isDragging && 'cursor-grabbing'
      )}>
        <CardContent className="p-4">
          <h3 className="font-semibold text-text-primary mb-2 text-sm">
            {title}
          </h3>
          <p className="text-text-secondary text-xs leading-relaxed">
            {content}
          </p>
          
          {/* Drag indicator */}
          <div className="absolute top-2 right-2 text-neutral-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Tutorial tooltip component
 */
interface TutorialTooltipProps {
  title: string;
  content: string;
  position: { x: number; y: number };
  onNext?: () => void;
  onSkip?: () => void;
  step: number;
  totalSteps: number;
}

const TutorialTooltip: React.FC<TutorialTooltipProps> = ({
  title,
  content,
  position,
  onNext,
  onSkip,
  step,
  totalSteps,
}) => {
  return (
    <div
      className="absolute z-20 bg-white rounded-lg shadow-xl border border-border-default p-4 max-w-xs animate-fade-in"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-text-primary text-sm">
          {title}
        </h4>
        <span className="text-xs text-text-tertiary bg-neutral-100 px-2 py-1 rounded">
          {step}/{totalSteps}
        </span>
      </div>
      
      <p className="text-text-secondary text-sm mb-4 leading-relaxed">
        {content}
      </p>
      
      <div className="flex items-center justify-between">
        {onSkip && (
          <Button variant="ghost" size="small" onClick={onSkip}>
            Skip
          </Button>
        )}
        
        {onNext && (
          <Button variant="primary" size="small" onClick={onNext}>
            Next
          </Button>
        )}
      </div>
      
      {/* Arrow pointer */}
      <div className="absolute -bottom-2 left-4 w-4 h-4 bg-white border-r border-b border-border-default transform rotate-45" />
    </div>
  );
};

/**
 * Canvas Introduction step component
 */
export const CanvasIntroStep: React.FC<OnboardingStepProps> = ({
  onNext,
  progress,
  updateProgress,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [cards, setCards] = useState([
    {
      id: 'card-1',
      title: 'My First Idea',
      content: 'This is your first knowledge card. You can drag it around the canvas to organize your thoughts spatially.',
      x: 200,
      y: 150,
    },
  ]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardContent, setNewCardContent] = useState('');
  const [hasCreatedCard, setHasCreatedCard] = useState(false);
  const [hasMovedCard, setHasMovedCard] = useState(false);

  // Tutorial steps configuration
  const tutorialSteps = [
    {
      title: 'Welcome to the Canvas',
      content: 'This is your infinite workspace where ideas come to life. Think of it as a digital whiteboard with superpowers.',
      position: { x: 50, y: 50 },
    },
    {
      title: 'Your First Card',
      content: 'Cards are the building blocks of your knowledge. Try dragging this card around to see how spatial organization works.',
      position: { x: 480, y: 120 },
    },
    {
      title: 'Create New Cards',
      content: 'Click anywhere on the empty canvas to create a new card. Let\'s add your second idea!',
      position: { x: 50, y: 300 },
    },
    {
      title: 'Perfect!',
      content: 'You\'re getting the hang of it. In the next step, we\'ll show you how AI can automatically discover connections between your ideas.',
      position: { x: 300, y: 400 },
    },
  ];

  const currentTutorial = tutorialSteps[tutorialStep];

  const handleCardMove = (id: string, x: number, y: number) => {
    setCards(prev => prev.map(card => 
      card.id === id ? { ...card, x, y } : card
    ));
    
    if (!hasMovedCard) {
      setHasMovedCard(true);
      // Auto-advance tutorial after first move
      if (tutorialStep === 1) {
        setTimeout(() => setTutorialStep(2), 1000);
      }
    }
  };

  const handleCardClick = (id: string) => {
    setSelectedCard(id);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || tutorialStep < 2) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Don't create card if clicking on existing card
    const clickedCard = cards.find(card => 
      x >= card.x && x <= card.x + 256 &&
      y >= card.y && y <= card.y + 120
    );
    
    if (!clickedCard && tutorialStep === 2) {
      setShowCreateDialog(true);
    }
  };

  const handleCreateCard = () => {
    if (!newCardTitle.trim()) return;
    
    const newCard = {
      id: `card-${Date.now()}`,
      title: newCardTitle.trim(),
      content: newCardContent.trim() || 'Add your thoughts here...',
      x: 400,
      y: 250,
    };
    
    setCards(prev => [...prev, newCard]);
    setNewCardTitle('');
    setNewCardContent('');
    setShowCreateDialog(false);
    setHasCreatedCard(true);
    
    // Auto-advance tutorial
    setTimeout(() => setTutorialStep(3), 1000);
  };

  const handleTutorialNext = () => {
    if (tutorialStep < tutorialSteps.length - 1) {
      setTutorialStep(prev => prev + 1);
    } else {
      // Mark canvas tutorial as completed
      updateProgress({
        hasSeenFeatures: new Set([...progress.hasSeenFeatures, 'canvas-basics']),
      });
      onNext();
    }
  };

  const handleTutorialSkip = () => {
    updateProgress({
      hasSeenFeatures: new Set([...progress.hasSeenFeatures, 'canvas-basics']),
    });
    onNext();
  };

  // Auto-start tutorial
  useEffect(() => {
    const timer = setTimeout(() => {
      setTutorialStep(0);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-full flex flex-col bg-canvas-base">
      {/* Header */}
      <div className="bg-white border-b border-border-default px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Your Infinite Canvas
          </h2>
          <p className="text-text-secondary">
            Discover the power of spatial thinking. Organize your ideas freely on an unlimited workspace.
          </p>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={canvasRef}
          className="w-full h-full relative cursor-crosshair bg-gradient-to-br from-canvas-base to-neutral-50"
          onClick={handleCanvasClick}
          style={{
            backgroundImage: `
              radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.05) 1px, transparent 0)
            `,
            backgroundSize: '20px 20px',
          }}
        >
          {/* Cards */}
          {cards.map((card) => (
            <TutorialCard
              key={card.id}
              {...card}
              isHighlighted={tutorialStep === 1 && card.id === 'card-1'}
              isSelected={selectedCard === card.id}
              onMove={handleCardMove}
              onClick={handleCardClick}
            />
          ))}

          {/* Tutorial tooltip */}
          {currentTutorial && (
            <TutorialTooltip
              title={currentTutorial.title}
              content={currentTutorial.content}
              position={currentTutorial.position}
              onNext={tutorialStep < tutorialSteps.length - 1 ? handleTutorialNext : onNext}
              onSkip={handleTutorialSkip}
              step={tutorialStep + 1}
              totalSteps={tutorialSteps.length}
            />
          )}

          {/* Create card hint */}
          {tutorialStep === 2 && !hasCreatedCard && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white bg-opacity-90 rounded-lg p-6 max-w-md text-center shadow-lg animate-bounce-gentle">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-text-primary mb-2">Click anywhere to create</h3>
                <p className="text-text-secondary text-sm">
                  Tap the canvas to add your second idea card
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create card dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 animate-slide-up">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Create New Card
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  placeholder="Enter your idea..."
                  className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Content (optional)
                </label>
                <textarea
                  value={newCardContent}
                  onChange={(e) => setNewCardContent(e.target.value)}
                  placeholder="Add details or description..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border-default rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateCard}
                disabled={!newCardTitle.trim()}
              >
                Create Card
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress indicators */}
      <div className="bg-white border-t border-border-default px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={cn(
              'flex items-center space-x-2',
              hasMovedCard && 'text-success-600'
            )}>
              <div className={cn(
                'w-2 h-2 rounded-full',
                hasMovedCard ? 'bg-success-500' : 'bg-neutral-300'
              )} />
              <span className="text-sm">Card moved</span>
            </div>
            
            <div className={cn(
              'flex items-center space-x-2',
              hasCreatedCard && 'text-success-600'
            )}>
              <div className={cn(
                'w-2 h-2 rounded-full',
                hasCreatedCard ? 'bg-success-500' : 'bg-neutral-300'
              )} />
              <span className="text-sm">Card created</span>
            </div>
          </div>
          
          <div className="text-sm text-text-tertiary">
            Step 2 of 6: Canvas Basics
          </div>
        </div>
      </div>
    </div>
  );
};