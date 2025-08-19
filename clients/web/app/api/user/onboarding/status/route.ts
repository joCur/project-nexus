import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@auth0/nextjs-auth0';

/**
 * Get user's onboarding status from backend
 * GET /api/user/onboarding/status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // For development, we'll handle access token gracefully
    let accessToken: string | undefined;
    try {
      const tokenResult = await getAccessToken();
      accessToken = tokenResult.accessToken;
    } catch (error) {
      console.warn('Failed to get access token, using development mode:', error);
    }

    // Call backend GraphQL API to get onboarding status
    const graphqlQuery = `
      query GetMyOnboardingStatus {
        myOnboardingStatus {
          isComplete
          profile {
            id
            fullName
            displayName
          }
          onboarding {
            id
            completed
            completedAt
            currentStep
            tutorialProgress
          }
          defaultWorkspace {
            id
            name
            privacy
          }
        }
      }
    `;

    const backendResponse = await fetch(`${process.env.API_BASE_URL || 'http://backend:3000'}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        // Add user context for development
        'X-User-Sub': session.user.sub,
        'X-User-Email': session.user.email || '',
      },
      body: JSON.stringify({
        query: graphqlQuery,
      }),
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend API error: ${backendResponse.status}`);
    }

    const result = await backendResponse.json();

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error('GraphQL query failed');
    }

    const status = result.data.myOnboardingStatus;

    return NextResponse.json({
      isComplete: status.isComplete,
      currentStep: status.onboarding?.currentStep || 1,
      hasProfile: !!status.profile,
      hasWorkspace: !!status.defaultWorkspace,
      profile: status.profile,
      onboarding: status.onboarding,
      workspace: status.defaultWorkspace,
    });

  } catch (error) {
    console.error('Error getting onboarding status:', error);
    
    // Return safe defaults if we can't reach the backend
    return NextResponse.json({
      isComplete: false,
      currentStep: 1,
      hasProfile: false,
      hasWorkspace: false,
    });
  }
}