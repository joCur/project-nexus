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
    const { completedAt, userProfile, tutorialProgress } = body;

    // Validate required fields
    if (!completedAt || !userProfile?.fullName || !userProfile?.preferences?.workspaceName) {
      return NextResponse.json(
        { error: 'Missing required profile information' },
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

    // Call backend GraphQL API for complete onboarding workflow
    const graphqlQuery = `
      mutation CompleteOnboardingWorkflow($input: OnboardingWorkflowCompleteInput!) {
        completeOnboardingWorkflow(input: $input) {
          success
          profile {
            id
            fullName
            displayName
            timezone
            role
            preferences
          }
          onboarding {
            id
            completed
            completedAt
            finalStep
            tutorialProgress
          }
          workspace {
            id
            name
            privacy
            isDefault
          }
        }
      }
    `;

    const graphqlVariables = {
      input: {
        userProfile: {
          fullName: userProfile.fullName,
          displayName: userProfile.displayName,
          timezone: userProfile.timezone,
          ...(userProfile.role && { role: userProfile.role.toUpperCase() }),
          preferences: {
            ...userProfile.preferences,
            ...(userProfile.preferences?.privacy && { 
              privacy: userProfile.preferences.privacy.toUpperCase() 
            }),
          },
        },
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

    const workflowResult = result.data.completeOnboardingWorkflow;

    console.log('Onboarding completed:', {
      userId: session.user.sub,
      completedAt,
      userProfile,
      tutorialProgress,
      result: workflowResult,
    });

    return NextResponse.json({
      success: workflowResult.success,
      message: 'Onboarding completed successfully',
      userProfile: {
        fullName: workflowResult.profile.fullName,
        displayName: workflowResult.profile.displayName,
        workspaceName: workflowResult.workspace.name,
      },
      data: {
        profile: workflowResult.profile,
        onboarding: workflowResult.onboarding,
        workspace: workflowResult.workspace,
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