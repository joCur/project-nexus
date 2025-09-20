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
  const startTime = Date.now();
  
  console.log(`[${requestId}] Onboarding status request started`);
  
  try {
    // Check session with detailed logging
    console.log(`[${requestId}] Checking Auth0 session...`);
    const session = await getSession();
    
    if (!session?.user) {
      console.log(`[${requestId}] No session found, returning 401`);
      return NextResponse.json(
        { 
          error: 'Authentication required',
          code: 'NO_SESSION',
          requestId 
        },
        { status: 401 }
      );
    }

    console.log(`[${requestId}] Session found for user: ${session.user.sub}`);

    // Get access token with graceful fallback for development
    let accessToken: string | undefined;
    try {
      const tokenResult = await getAccessToken();
      accessToken = tokenResult.accessToken;
      console.log(`[${requestId}] Access token obtained successfully`);
    } catch (error) {
      console.warn(`[${requestId}] Failed to get access token, using development mode:`, error);
    }

    // Call backend GraphQL API to get onboarding status
    console.log(`[${requestId}] Calling backend GraphQL API...`);
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
    console.log(`[${requestId}] Backend URL: ${backendUrl}/graphql`);

    // Create AbortController for request timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.warn(`[${requestId}] Request timeout after 10 seconds`);
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

    console.log(`[${requestId}] Backend response status: ${backendResponse.status}`);

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => 'Unknown error');
      console.error(`[${requestId}] Backend API error:`, {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        body: errorText,
      });

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
    console.log(`[${requestId}] GraphQL response received`);

    if (result.errors) {
      console.error(`[${requestId}] GraphQL errors:`, result.errors);
      
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
      console.error(`[${requestId}] No onboarding status data in response`);
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

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Request completed successfully in ${duration}ms`, responseData);

    return NextResponse.json(responseData);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Error getting onboarding status after ${duration}ms:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId,
    });

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