'use client';

import { OnboardingFlow } from '@/components/onboarding/v1/OnboardingFlow';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

/**
 * Onboarding page component - Simple v1 implementation
 * 
 * This page is protected and requires authentication via Auth0.
 * Users are taken through a streamlined 3-step process focused on
 * profile setup and realistic workspace introduction.
 */
export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingFlow />
    </ProtectedRoute>
  );
}