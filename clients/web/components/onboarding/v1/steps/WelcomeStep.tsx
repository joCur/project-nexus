'use client';

import React from 'react';
import { Button } from '@/components/ui';

interface UserProfile {
  fullName?: string;
  displayName?: string;
  role?: 'student' | 'researcher' | 'creative' | 'business' | 'other';
  preferences?: {
    workspaceName?: string;
    privacy?: string;
  };
}

interface WelcomeStepProps {
  userProfile: Partial<UserProfile>;
  onComplete: () => void;
}

const ROLE_MESSAGES = {
  student: {
    title: "Perfect for Learning!",
    message: "Your workspace is ready to help you organize course materials, research notes, and study resources.",
    tips: [
      "Create cards for each subject or course",
      "Link related concepts as you learn",
      "Use the canvas to map out complex topics"
    ]
  },
  researcher: {
    title: "Ready for Research!",
    message: "Your workspace is optimized for organizing research materials, tracking insights, and building knowledge connections.",
    tips: [
      "Create cards for papers, data, and findings",
      "Organize by research themes or projects",
      "Use spatial layout to visualize relationships"
    ]
  },
  creative: {
    title: "Unleash Your Creativity!",
    message: "Your workspace is ready to capture inspiration, organize ideas, and develop creative projects.",
    tips: [
      "Capture inspiration and references",
      "Organize ideas by project or theme",
      "Use the visual canvas for mood boards"
    ]
  },
  business: {
    title: "Strategic Thinking Space!",
    message: "Your workspace is configured for strategic planning, analysis, and business knowledge management.",
    tips: [
      "Map out strategies and initiatives",
      "Organize market research and insights",
      "Track competitor and industry analysis"
    ]
  },
  other: {
    title: "Your Knowledge Hub!",
    message: "Your workspace is ready to help you organize and connect any type of knowledge or information.",
    tips: [
      "Start with your most important topics",
      "Group related information together",
      "Explore different organizational patterns"
    ]
  }
};

export const WelcomeStep: React.FC<WelcomeStepProps> = ({
  userProfile,
  onComplete,
}) => {
  const role = userProfile.role || 'other';
  const roleInfo = ROLE_MESSAGES[role];
  const displayName = userProfile.displayName || userProfile.fullName?.split(' ')[0] || 'there';
  const workspaceName = userProfile.preferences?.workspaceName || 'Your Workspace';

  return (
    <div className="text-center">
      {/* Success Animation */}
      <div className="mb-8">
        <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Welcome, {displayName}! 🎉
        </h2>
        
        <h3 className="text-lg font-semibold text-primary-600 mb-3">
          {roleInfo.title}
        </h3>
        
        <p className="text-text-secondary mb-6">
          {roleInfo.message}
        </p>
      </div>

      {/* Workspace Ready */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-primary-700 mb-3">
          "{workspaceName}" is ready!
        </h3>
        
        <div className="grid gap-3 text-left">
          {roleInfo.tips.map((tip, index) => (
            <div key={index} className="flex items-start">
              <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-white text-xs font-bold">{index + 1}</span>
              </div>
              <p className="text-primary-700 text-sm">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Current Capabilities */}
      <div className="bg-white border border-border-default rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-text-primary mb-3">
          What you can do right now:
        </h3>
        
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center text-success-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Create knowledge cards
          </div>
          
          <div className="flex items-center text-success-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Organize on infinite canvas
          </div>
          
          <div className="flex items-center text-success-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Auto-save your work
          </div>
          
          <div className="flex items-center text-success-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Search your content
          </div>
        </div>
      </div>

      {/* Roadmap Preview */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-8">
        <h3 className="font-semibold text-neutral-700 mb-3">
          Coming in future updates:
        </h3>
        
        <div className="grid sm:grid-cols-2 gap-3 text-sm text-neutral-600">
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-neutral-400 rounded mr-2"></div>
            AI-powered connections
          </div>
          
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-neutral-400 rounded mr-2"></div>
            Real-time collaboration
          </div>
          
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-neutral-400 rounded mr-2"></div>
            Mobile capture app
          </div>
          
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-neutral-400 rounded mr-2"></div>
            Export & integration
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="space-y-4">
        <Button
          onClick={onComplete}
          variant="primary"
          size="large"
          className="w-full text-lg py-4"
        >
          Enter Your Workspace →
        </Button>
        
        <p className="text-text-tertiary text-sm">
          You can always update your preferences in settings later.
        </p>
      </div>
    </div>
  );
};