import { NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@auth0/nextjs-auth0';

/**
 * Get user's onboarding status from backend
 * GET /api/user/onboarding/status
 * 
 * Enhanced with:
 * - Proper error handling that preserves known state
 * - Detailed logging for debugging race conditions
 * - Better response codes and error messages
 * - Request timeout handling
 */
export async function GET() {
  const requestId = Math.random().toString(36).substring(2, 9);

  try {
    // Check session
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'NO_SESSION',
          requestId
        },
        { status: 401 }
      );
    }

    // Get access token with graceful fallback for development
    let accessToken: string | undefined;
    try {
      const tokenResult = await getAccessToken();
      accessToken = tokenResult.accessToken;
    } catch (error) {
      // Fallback to development mode if token retrieval fails
      // Failed to get access token, using development mode
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

    const backendUrl = process.env.API_BASE_URL || 'http://backend:3000';

    // Create AbortController for request timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000); // 10 second timeout

    let backendResponse: Response;
    try {
      backendResponse = await fetch(`${backendUrl}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
          // Add user context for development
          'X-User-Sub': session.user.sub,
          'X-User-Email': session.user.email,
          'X-Request-ID': requestId,
        },
        body: JSON.stringify({
          query: graphqlQuery,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => 'Unknown error');

      // Return specific error codes instead of defaulting to incomplete
      if (backendResponse.status === 404) {
        return NextResponse.json(
          { 
            error: 'User not found in backend system',
            code: 'USER_NOT_FOUND',
            requestId 
          },
          { status: 404 }
        );
      }

      if (backendResponse.status >= 500) {
        return NextResponse.json(
          { 
            error: 'Backend service temporarily unavailable',
            code: 'BACKEND_ERROR',
            requestId,
            retryAfter: 30 // suggest retry after 30 seconds
          },
          { status: 503 }
        );
      }

      throw new Error(`Backend API error: ${backendResponse.status} - ${errorText}`);
    }

    const result = await backendResponse.json();

    if (result.errors) {
      
      // Check for specific GraphQL error types
      const hasAuthError = result.errors.some((error: { extensions?: { code?: string }; message?: string }) => 
        error.extensions?.code === 'UNAUTHENTICATED' ||
        error.message?.includes('Authentication')
      );

      if (hasAuthError) {
        return NextResponse.json(
          { 
            error: 'Authentication failed with backend',
            code: 'BACKEND_AUTH_ERROR',
            requestId 
          },
          { status: 401 }
        );
      }

      throw new Error(`GraphQL query failed: ${result.errors[0]?.message || 'Unknown GraphQL error'}`);
    }

    const status = result.data?.myOnboardingStatus;
    if (!status) {
      throw new Error('Invalid response format: missing onboarding status data');
    }

    const responseData = {
      isComplete: status.isComplete,
      currentStep: status.onboarding?.currentStep || 1,
      hasProfile: !!status.profile,
      hasWorkspace: !!status.defaultWorkspace,
      profile: status.profile,
      onboarding: status.onboarding,
      workspace: status.defaultWorkspace,
    };

    return NextResponse.json(responseData);

  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      // Timeout errors
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { 
            error: 'Request timeout - backend service is slow to respond',
            code: 'REQUEST_TIMEOUT',
            requestId,
            retryAfter: 10
          },
          { status: 408 }
        );
      }

      // Network errors (connection refused, etc.)
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { 
            error: 'Cannot connect to backend service',
            code: 'BACKEND_UNREACHABLE',
            requestId,
            retryAfter: 30
          },
          { status: 503 }
        );
      }
    }
    
    // For any other unexpected errors, return 500 but don't default to "incomplete" status
    // The client hook will preserve existing cached status on 500 errors
    return NextResponse.json(
      { 
        error: 'Internal server error occurred while fetching onboarding status',
        code: 'INTERNAL_ERROR',
        requestId,
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}