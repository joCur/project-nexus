import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@auth0/nextjs-auth0';

/**
 * Save onboarding progress
 * POST /api/user/onboarding
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { step, completedAt, tutorialProgress } = body;

    // Validate required fields
    if (typeof step !== 'number' || !completedAt) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // For development, we'll create a dummy access token
    // In production, this should use: const { accessToken } = await getAccessToken();
    let accessToken: string | undefined;
    try {
      const tokenResult = await getAccessToken();
      accessToken = tokenResult.accessToken;
    } catch (error) {
      console.warn('Failed to get access token, using development mode:', error);
      // For development, we'll proceed without token and let backend handle auth differently
    }

    // Call backend GraphQL API
    const graphqlQuery = `
      mutation UpdateOnboardingStep($currentStep: Int!, $tutorialProgress: JSON) {
        updateOnboardingStep(currentStep: $currentStep, tutorialProgress: $tutorialProgress) {
          id
          currentStep
          tutorialProgress
          completed
        }
      }
    `;

    const graphqlVariables = {
      currentStep: step,
      tutorialProgress: tutorialProgress || {}, // Send as object, not string
    };

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
        variables: graphqlVariables,
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

    console.log('Onboarding progress saved:', {
      userId: session.user.sub,
      step,
      completedAt,
      tutorialProgress,
      result: result.data.updateOnboardingStep,
    });

    return NextResponse.json({
      success: true,
      message: 'Onboarding progress saved',
      step,
      progress: result.data.updateOnboardingStep,
    });

  } catch (error) {
    console.error('Error saving onboarding progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}