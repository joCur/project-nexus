import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@auth0/nextjs-auth0';

/**
 * Complete onboarding and save final user profile
 * POST /api/user/onboarding/complete
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
    const { completedAt, totalDuration, userChoices, persona, finalStep, tutorialProgress } = body;

    // Validate required fields
    if (!completedAt || !userChoices || !persona) {
      return NextResponse.json(
        { error: 'Missing required onboarding completion data' },
        { status: 400 }
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

    // Call backend GraphQL API for onboarding completion
    const graphqlQuery = `
      mutation CompleteOnboarding($input: OnboardingCompleteInput!) {
        completeOnboarding(input: $input) {
          id
          completed
          completedAt
          finalStep
          tutorialProgress
        }
      }
    `;

    const graphqlVariables = {
      input: {
        tutorialProgress: tutorialProgress || {},
      },
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

    const onboardingResult = result.data.completeOnboarding;

    console.log('Onboarding completed:', {
      userId: session.user.sub,
      completedAt,
      totalDuration,
      userChoices,
      persona,
      finalStep,
      tutorialProgress,
      result: onboardingResult,
    });

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        onboarding: onboardingResult,
      },
    });

  } catch (error) {
    console.error('Error completing onboarding:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}