'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent } from '@/components/ui';
import { OnboardingStepProps } from '@/types/onboarding';

/**
 * AI connection line component
 */
interface ConnectionLineProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  strength: 'weak' | 'medium' | 'strong';
  isAnimating?: boolean;
  label?: string;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  from,
  to,
  strength,
  isAnimating = false,
  label,
}) => {
  const strengthColors = {
    weak: 'stroke-connection-weak',
    medium: 'stroke-connection-medium', 
    strong: 'stroke-connection-strong',
  };

  const strengthWidths = {
    weak: 2,
    medium: 3,
    strong: 4,
  };

  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    >
      <defs>
        <marker
          id={`arrowhead-${strength}`}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            className={strengthColors[strength]}
            fill="currentColor"
          />
        </marker>
        
        {isAnimating && (
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        )}
      </defs>
      
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        className={cn(
          strengthColors[strength],
          isAnimating && 'animate-pulse'
        )}
        strokeWidth={strengthWidths[strength]}
        strokeDasharray={isAnimating ? "5,5" : "none"}
        markerEnd={`url(#arrowhead-${strength})`}
        filter={isAnimating ? "url(#glow)" : "none"}
        opacity={0.8}
      />
      
      {label && (
        <text
          x={midX}
          y={midY - 10}
          textAnchor="middle"
          className="fill-text-secondary text-xs font-medium"
          style={{ filter: 'drop-shadow(0px 1px 2px rgb(255 255 255))' }}
        >
          {label}
        </text>
      )}
    </svg>
  );
};

/**
 * Demo card component with AI analysis state
 */
interface DemoCardProps {
  id: string;
  title: string;
  content: string;
  x: number;
  y: number;
  isAnalyzing?: boolean;
  aiInsight?: string;
  tags?: string[];
}

const DemoCard: React.FC<DemoCardProps> = ({
  title,
  content,
  x,
  y,
  isAnalyzing = false,
  aiInsight,
  tags = [],
}) => {
  return (
    <div
      className="absolute w-72"
      style={{ left: x, top: y, zIndex: 2 }}
    >
      <Card className={cn(
        'shadow-lg transition-all duration-300',
        isAnalyzing && 'ring-2 ring-ai-primary ring-opacity-50 bg-ai-light'
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-text-primary text-sm flex-1">
              {title}
            </h3>
            {isAnalyzing && (
              <div className="flex items-center space-x-1 text-ai-primary">
                <div className="w-2 h-2 bg-ai-primary rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-ai-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-ai-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            )}
          </div>
          
          <p className="text-text-secondary text-xs leading-relaxed mb-3">
            {content}
          </p>
          
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-block bg-neutral-100 text-neutral-700 text-xs px-2 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          {aiInsight && (
            <div className="bg-ai-light border border-ai-primary border-opacity-30 rounded-lg p-3 animate-fade-in">
              <div className="flex items-start space-x-2">
                <div className="w-4 h-4 bg-ai-primary rounded-full flex items-center justify-center mt-0.5">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-ai-primary text-xs font-medium mb-1">AI Insight</p>
                  <p className="text-text-secondary text-xs leading-relaxed">
                    {aiInsight}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * AI Demo step component
 */
export const AIDemoStep: React.FC<OnboardingStepProps> = ({
  onNext,
  progress,
  updateProgress,
}) => {
  const [demoPhase, setDemoPhase] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [acceptedConnections, setAcceptedConnections] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Demo cards data
  const cards = [
    {
      id: 'card-1',
      title: 'Machine Learning Basics',
      content: 'Supervised learning uses labeled training data to learn patterns and make predictions on new, unseen data.',
      x: 100,
      y: 150,
      tags: ['ML', 'supervised learning', 'algorithms'],
      aiInsight: 'This concept forms the foundation for understanding data-driven decision making and pattern recognition.',
    },
    {
      id: 'card-2', 
      title: 'Neural Networks',
      content: 'Artificial neural networks are computing systems inspired by biological neural networks that learn from data.',
      x: 450,
      y: 120,
      tags: ['neural networks', 'deep learning', 'AI'],
      aiInsight: 'Neural networks are a key implementation of machine learning, particularly powerful for complex pattern recognition.',
    },
    {
      id: 'card-3',
      title: 'Data Preprocessing',
      content: 'Cleaning and transforming raw data into a format suitable for machine learning algorithms.',
      x: 150,
      y: 350,
      tags: ['data science', 'preprocessing', 'cleaning'],
      aiInsight: 'Essential step that directly impacts the quality and effectiveness of machine learning models.',
    },
    {
      id: 'card-4',
      title: 'Pattern Recognition',
      content: 'The ability to identify regularities in data, fundamental to human cognition and machine intelligence.',
      x: 500,
      y: 320,
      tags: ['patterns', 'cognition', 'intelligence'],
      aiInsight: 'Core principle that connects human learning with artificial intelligence systems.',
    },
  ];

  // Connection data
  const connections = [
    {
      id: 'conn-1',
      from: { x: 372, y: 200 }, // card-1 to card-2
      to: { x: 450, y: 170 },
      strength: 'strong' as const,
      label: 'Implementation',
      reason: 'Neural networks implement machine learning principles',
    },
    {
      id: 'conn-2',
      from: { x: 250, y: 350 }, // card-3 to card-1
      to: { x: 200, y: 250 },
      strength: 'medium' as const,
      label: 'Prerequisite',
      reason: 'Clean data is required for effective ML training',
    },
    {
      id: 'conn-3',
      from: { x: 572, y: 200 }, // card-2 to card-4
      to: { x: 550, y: 320 },
      strength: 'strong' as const,
      label: 'Purpose',
      reason: 'Neural networks excel at pattern recognition tasks',
    },
  ];

  // Demo phases
  const phases = [
    {
      title: 'AI Analysis Starting',
      description: 'Our AI is reading your cards and understanding the content...',
      duration: 2000,
    },
    {
      title: 'Finding Connections', 
      description: 'Discovering relationships and patterns between your ideas...',
      duration: 3000,
    },
    {
      title: 'Connections Found',
      description: 'AI has discovered meaningful relationships! Review and accept the ones that make sense.',
      duration: 0,
    },
  ];

  const currentPhase = phases[demoPhase];

  // Auto-progress through demo phases
  useEffect(() => {
    if (demoPhase < 2) {
      const timer = setTimeout(() => {
        if (demoPhase === 0) {
          setIsAnalyzing(true);
        } else if (demoPhase === 1) {
          setShowConnections(true);
          setIsAnalyzing(false);
        }
        setDemoPhase(prev => prev + 1);
      }, currentPhase.duration);

      return () => clearTimeout(timer);
    }
  }, [demoPhase, currentPhase.duration]);

  const handleAcceptConnection = (connectionId: string) => {
    setAcceptedConnections(prev => [...prev, connectionId]);
    
    // Check if all connections accepted
    if (acceptedConnections.length + 1 === connections.length) {
      setTimeout(() => {
        updateProgress({
          hasSeenFeatures: new Set([...progress.hasSeenFeatures, 'ai-connections']),
        });
      }, 1000);
    }
  };

  const handleSkipDemo = () => {
    setAcceptedConnections(connections.map(c => c.id));
    updateProgress({
      hasSeenFeatures: new Set([...progress.hasSeenFeatures, 'ai-connections']),
    });
  };

  const canContinue = acceptedConnections.length === connections.length;

  return (
    <div className="h-full flex flex-col bg-canvas-base">
      {/* Header */}
      <div className="bg-white border-b border-border-default px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Experience AI Magic
          </h2>
          <p className="text-text-secondary">
            Watch as our AI analyzes your knowledge cards and discovers meaningful connections automatically.
          </p>
        </div>
      </div>

      {/* Demo status */}
      <div className="bg-ai-light border-b border-ai-primary border-opacity-30 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={cn(
                'w-3 h-3 rounded-full',
                isAnalyzing ? 'bg-ai-primary animate-pulse' : 'bg-success-500'
              )} />
              <span className="text-sm font-medium text-ai-primary">
                {currentPhase.title}
              </span>
            </div>
            <span className="text-sm text-text-secondary">
              {currentPhase.description}
            </span>
          </div>
          
          {demoPhase === 2 && (
            <Button variant="ghost" size="small" onClick={handleSkipDemo}>
              Accept All
            </Button>
          )}
        </div>
      </div>

      {/* Canvas with demo */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full relative"
          style={{
            backgroundImage: `
              radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.05) 1px, transparent 0)
            `,
            backgroundSize: '20px 20px',
          }}
        >
          {/* Connection lines */}
          {showConnections && connections.map((connection) => (
            <ConnectionLine
              key={connection.id}
              from={connection.from}
              to={connection.to}
              strength={connection.strength}
              isAnimating={!acceptedConnections.includes(connection.id)}
              label={acceptedConnections.includes(connection.id) ? connection.label : undefined}
            />
          ))}

          {/* Demo cards */}
          {cards.map((card, index) => (
            <DemoCard
              key={card.id}
              {...card}
              isAnalyzing={isAnalyzing && index <= demoPhase}
              aiInsight={demoPhase >= 2 ? card.aiInsight : undefined}
            />
          ))}

          {/* Connection acceptance UI */}
          {demoPhase === 2 && connections.map((connection) => {
            if (acceptedConnections.includes(connection.id)) return null;
            
            const midX = (connection.from.x + connection.to.x) / 2;
            const midY = (connection.from.y + connection.to.y) / 2;
            
            return (
              <div
                key={`accept-${connection.id}`}
                className="absolute z-10 animate-fade-in"
                style={{ left: midX - 100, top: midY + 20 }}
              >
                <div className="bg-white rounded-lg shadow-lg border border-border-default p-4 max-w-xs">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-ai-primary rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-text-primary text-sm mb-1">
                        AI found a connection
                      </h4>
                      <p className="text-text-secondary text-xs mb-3 leading-relaxed">
                        {connection.reason}
                      </p>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="primary"
                          size="small"
                          onClick={() => handleAcceptConnection(connection.id)}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => handleAcceptConnection(connection.id)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Completion celebration */}
          {canContinue && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 animate-fade-in">
              <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
                <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-text-primary mb-3">
                  Amazing! Connections Established
                </h3>
                
                <p className="text-text-secondary mb-6 leading-relaxed">
                  You&rsquo;ve just experienced how our AI can automatically discover and suggest 
                  meaningful relationships between your ideas. This helps you build a richer, 
                  more interconnected knowledge graph.
                </p>
                
                <Button
                  variant="primary"
                  size="large"
                  onClick={onNext}
                  rightIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  }
                >
                  Continue to Organization
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
              Connections accepted: {acceptedConnections.length}/{connections.length}
            </div>
            
            <div className="flex items-center space-x-4">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors duration-200',
                    acceptedConnections.includes(connection.id) 
                      ? 'bg-success-500' 
                      : 'bg-neutral-300'
                  )}
                />
              ))}
            </div>
          </div>
          
          <div className="text-sm text-text-tertiary">
            Step 3 of 6: AI Intelligence
          </div>
        </div>
      </div>
    </div>
  );
};