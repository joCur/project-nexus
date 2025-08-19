'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface StepContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const StepContainer: React.FC<StepContainerProps> = ({
  children,
  className,
}) => {
  return (
    <div className={cn('max-w-2xl mx-auto px-6 py-12', className)}>
      <div className="bg-white rounded-xl border border-border-default shadow-sm p-8">
        {children}
      </div>
    </div>
  );
};