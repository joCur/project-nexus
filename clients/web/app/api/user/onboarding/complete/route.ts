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
    const { completedAt, userChoices, persona, tutorialProgress } = body;

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
    // Using completeOnboardingWorkflow to ensure workspace is created
    const graphqlQuery = `
      mutation CompleteOnboardingWorkflow($input: OnboardingWorkflowCompleteInput!) {
        completeOnboardingWorkflow(input: $input) {
          success
          profile {
            id
            fullName
            displayName
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
          }
        }
      }
    `;

    // Map persona to UserProfileRole enum
    const roleMap: { [key: string]: string } = {
      'student': 'STUDENT',
      'academic': 'RESEARCHER',
      'researcher': 'RESEARCHER',
      'writer': 'CREATIVE',
      'creator': 'CREATIVE',
      'designer': 'CREATIVE',
      'professional': 'BUSINESS',
      'explorer': 'OTHER',
      'general': 'OTHER',
    };

    const graphqlVariables = {
      input: {
        userProfile: {
          fullName: userChoices?.fullName || session.user.name || 'New User',
          displayName: userChoices?.displayName || session.user.nickname || session.user.name || 'New User',
          role: roleMap[persona?.toLowerCase()] || 'OTHER',
          preferences: {
            workspaceName: userChoices?.workspaceName || 'My Workspace',
            privacy: 'PRIVATE',
            notifications: true,
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

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        onboarding: workflowResult.onboarding,
        profile: workflowResult.profile,
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