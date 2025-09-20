'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent } from '@/components/ui';
import { OnboardingStepProps } from '@/types/onboarding';

/**
 * Organizational cluster component
 */
interface ClusterProps {
  id: string;
  title: string;
  color: string;
  cards: Array<{
    id: string;
    title: string;
    content: string;
  }>;
  x: number;
  y: number;
  isHighlighted?: boolean;
  onCardDrop?: (cardId: string, clusterId: string) => void;
}

const Cluster: React.FC<ClusterProps> = ({
  title,
  color,
  cards,
  x,
  y,
  isHighlighted = false,
  onCardDrop,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId && onCardDrop) {
      onCardDrop(cardId, title);
    }
  };

  return (
    <div
      className={cn(
        'absolute rounded-xl border-2 border-dashed transition-all duration-300 p-4',
        `border-${color}-300 bg-${color}-50`,
        isHighlighted && `ring-4 ring-${color}-300 ring-opacity-50`,
        isDragOver && `bg-${color}-100 border-${color}-400`
      )}
      style={{
        left: x,
        top: y,
        width: 280,
        minHeight: 160,
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center space-x-2 mb-3">
        <div className={`w-3 h-3 rounded-full bg-${color}-500`} />
        <h3 className="font-semibold text-text-primary text-sm">
          {title}
        </h3>
        <span className="text-xs text-text-tertiary bg-white px-2 py-1 rounded">
          {cards.length}
        </span>
      </div>
      
      <div className="space-y-2">
        {cards.map((card) => (
          <div
            key={card.id}
            className="bg-white rounded-lg p-3 shadow-sm border border-neutral-200"
          >
            <h4 className="font-medium text-text-primary text-xs mb-1">
              {card.title}
            </h4>
            <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">
              {card.content}
            </p>
          </div>
        ))}
        
        {cards.length === 0 && (
          <div className="text-center py-4 text-text-tertiary">
            <div className="text-2xl mb-2">📋</div>
            <p className="text-xs">Drop cards here</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Draggable knowledge card
 */
interface KnowledgeCardProps {
  id: string;
  title: string;
  content: string;
  x: number;
  y: number;
  isPlaced?: boolean;
  onDragStart?: (id: string) => void;
}

const KnowledgeCard: React.FC<KnowledgeCardProps> = ({
  id,
  title,
  content,
  x,
  y,
  isPlaced = false,
  onDragStart,
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
    if (onDragStart) {
      onDragStart(id);
    }
  };

  if (isPlaced) return null;

  return (
    <div
      className="absolute w-64 cursor-move"
      style={{ left: x, top: y }}
      draggable
      onDragStart={handleDragStart}
    >
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200 border-l-4 border-l-primary-500">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-text-primary text-sm flex-1">
              {title}
            </h3>
            <div className="text-neutral-400 ml-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </div>
          </div>
          <p className="text-text-secondary text-xs leading-relaxed">
            {content}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Knowledge Organization step component
 */
export const KnowledgeOrganizationStep: React.FC<OnboardingStepProps> = ({
  onNext,
  progress,
  updateProgress,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [placedCards, setPlacedCards] = useState<Record<string, string>>({});
  const [, setDraggedCard] = useState<string | null>(null);

  // Initial cards to organize
  const cards = [
    {
      id: 'card-1',
      title: 'Project Planning',
      content: 'Breaking down complex projects into manageable tasks and timelines.',
      x: 100,
      y: 100,
    },
    {
      id: 'card-2',
      title: 'Team Communication',
      content: 'Establishing clear channels and protocols for team collaboration.',
      x: 400,
      y: 150,
    },
    {
      id: 'card-3',
      title: 'Budget Analysis',
      content: 'Tracking expenses and revenue to maintain financial health.',
      x: 700,
      y: 120,
    },
    {
      id: 'card-4',
      title: 'Market Research',
      content: 'Understanding customer needs and competitive landscape.',
      x: 150,
      y: 300,
    },
    {
      id: 'card-5',
      title: 'Product Development',
      content: 'Iterative design and testing of new features and products.',
      x: 450,
      y: 350,
    },
    {
      id: 'card-6',
      title: 'Quality Assurance',
      content: 'Ensuring deliverables meet standards before release.',
      x: 750,
      y: 320,
    },
  ];

  // Organization clusters
  const clusters = [
    {
      id: 'planning',
      title: 'Strategic Planning',
      color: 'blue',
      x: 100,
      y: 450,
      expectedCards: ['card-1', 'card-4'],
    },
    {
      id: 'execution',
      title: 'Execution & Delivery',
      color: 'green',
      x: 420,
      y: 450,
      expectedCards: ['card-5', 'card-6'],
    },
    {
      id: 'operations',
      title: 'Operations & Support',
      color: 'purple',
      x: 740,
      y: 450,
      expectedCards: ['card-2', 'card-3'],
    },
  ];

  // Tutorial steps
  const tutorialSteps = [
    {
      title: 'Spatial Organization',
      description: 'On Project Nexus, location matters. Group related concepts together to create visual meaning.',
      highlightCluster: null,
    },
    {
      title: 'Strategic Planning Cluster',
      description: 'Drag planning-related cards here. This creates a visual hierarchy of your knowledge.',
      highlightCluster: 'planning',
    },
    {
      title: 'Perfect Organization!',
      description: 'You\'ve created meaningful clusters. This spatial approach helps you see patterns and relationships.',
      highlightCluster: null,
    },
  ];

  const currentTutorial = tutorialSteps[currentStep];

  const handleCardDrop = (cardId: string, clusterId: string) => {
    setPlacedCards(prev => ({ ...prev, [cardId]: clusterId }));
    
    // Check if this completes a cluster
    const cluster = clusters.find(c => c.title === clusterId);
    if (cluster) {
      const clusterCards = Object.entries(placedCards).filter(([, cId]) => cId === clusterId);
      
      // Auto-advance when first cluster is properly filled
      if (currentStep === 1 && clusterId === 'Strategic Planning' && clusterCards.length === 1) {
        setTimeout(() => setCurrentStep(2), 1000);
      }
    }
  };

  // Check completion
  const totalPlaced = Object.keys(placedCards).length;
  const isComplete = totalPlaced >= 4; // At least 4 cards placed

  useEffect(() => {
    if (isComplete && currentStep < 2) {
      setCurrentStep(2);
      updateProgress({
        hasSeenFeatures: new Set([...progress.hasSeenFeatures, 'spatial-organization']),
      });
    }
  }, [isComplete, currentStep, progress.hasSeenFeatures, updateProgress]);

  const handleContinue = () => {
    updateProgress({
      hasSeenFeatures: new Set([...progress.hasSeenFeatures, 'spatial-organization']),
    });
    onNext();
  };

  return (
    <div className="h-full flex flex-col bg-canvas-base">
      {/* Header */}
      <div className="bg-white border-b border-border-default px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Knowledge Organization
          </h2>
          <p className="text-text-secondary">
            Learn how spatial thinking transforms scattered information into organized knowledge.
          </p>
        </div>
      </div>

      {/* Tutorial guidance */}
      <div className="bg-info-50 border-b border-info-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-start space-x-4">
          <div className="w-8 h-8 bg-info-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {currentStep + 1}
            </span>
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-info-700 mb-1">
              {currentTutorial.title}
            </h3>
            <p className="text-info-600 text-sm leading-relaxed">
              {currentTutorial.description}
            </p>
          </div>

          {currentStep === 0 && (
            <Button
              variant="outline"
              size="small"
              onClick={() => setCurrentStep(1)}
            >
              Got it
            </Button>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className="w-full h-full relative"
          style={{
            backgroundImage: `
              radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.05) 1px, transparent 0)
            `,
            backgroundSize: '20px 20px',
          }}
        >
          {/* Organization clusters */}
          {clusters.map((cluster) => {
            const clusterCards = cards.filter(card => 
              placedCards[card.id] === cluster.title
            );
            
            return (
              <Cluster
                key={cluster.id}
                {...cluster}
                cards={clusterCards}
                isHighlighted={currentTutorial.highlightCluster === cluster.id}
                onCardDrop={handleCardDrop}
              />
            );
          })}

          {/* Draggable cards */}
          {cards.map((card) => (
            <KnowledgeCard
              key={card.id}
              {...card}
              isPlaced={placedCards[card.id] !== undefined}
              onDragStart={setDraggedCard}
            />
          ))}

          {/* Instructions overlay */}
          {currentStep === 1 && totalPlaced === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white bg-opacity-95 rounded-lg p-6 max-w-md text-center shadow-lg animate-bounce-gentle">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                </div>
                <h3 className="font-semibold text-text-primary mb-2">
                  Drag to Organize
                </h3>
                <p className="text-text-secondary text-sm">
                  Drag the cards into the Strategic Planning cluster to see how spatial organization works
                </p>
              </div>
            </div>
          )}

          {/* Completion celebration */}
          {isComplete && currentStep === 2 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 animate-fade-in">
              <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
                <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-text-primary mb-3">
                  Excellent Organization!
                </h3>
                
                <p className="text-text-secondary mb-6 leading-relaxed">
                  You&rsquo;ve successfully organized your knowledge cards into meaningful clusters. 
                  This spatial approach helps your brain naturally recognize patterns and relationships 
                  between concepts.
                </p>
                
                <div className="bg-neutral-50 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-text-primary text-sm mb-2">
                    Key Benefits:
                  </h4>
                  <ul className="text-text-secondary text-sm space-y-1 text-left">
                    <li>• Visual hierarchy makes complex topics manageable</li>
                    <li>• Spatial memory enhances information retention</li>
                    <li>• Pattern recognition happens naturally</li>
                    <li>• Related concepts stay visually connected</li>
                  </ul>
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
                  Explore Advanced Features
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="bg-white border-t border-border-default px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="text-sm text-text-tertiary">
              Cards organized: {totalPlaced}/{cards.length}
            </div>
            
            <div className="flex items-center space-x-2">
              {clusters.map((cluster) => {
                const clusterCards = Object.entries(placedCards).filter(([, cId]) => cId === cluster.title);
                return (
                  <div key={cluster.id} className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full bg-${cluster.color}-500`} />
                    <span className="text-xs text-text-tertiary">
                      {clusterCards.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="text-sm text-text-tertiary">
            Step 4 of 6: Knowledge Organization
          </div>
        </div>
      </div>
    </div>
  );
};