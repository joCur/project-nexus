'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  className,
}) => {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {/* Step indicators */}
      <div className="flex items-center space-x-1">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          
          return (
            <div
              key={stepNumber}
              className={cn(
                'w-8 h-2 rounded-full transition-colors duration-200',
                {
                  'bg-primary-500': isCompleted || isCurrent,
                  'bg-neutral-200': !isCompleted && !isCurrent,
                }
              )}
            />
          );
        })}
      </div>
      
      {/* Step counter */}
      <span className="text-sm text-text-tertiary ml-3">
        {currentStep} of {totalSteps}
      </span>
    </div>
  );
};