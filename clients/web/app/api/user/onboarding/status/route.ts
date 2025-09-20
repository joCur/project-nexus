import { NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@auth0/nextjs-auth0';
import {
  classifyError,
  AuthenticationError,
  BackendError,
  Auth0TokenError,
  ErrorCode
} from '@/lib/errors/api-errors';

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
      const authError = new AuthenticationError(
        ErrorCode.NO_SESSION,
        'Authentication required',
        { requestId }
      );
      return NextResponse.json(authError.toJSON(), { status: authError.statusCode });
    }

    // Get access token - this is required for proper authentication
    let accessToken: string;
    try {
      const tokenResult = await getAccessToken();
      if (!tokenResult.accessToken) {
        throw new Error('No access token returned from Auth0');
      }
      accessToken = tokenResult.accessToken;
    } catch (error) {
      // Auth0 token errors are internal service failures, not authentication failures
      throw new Auth0TokenError(
        'Auth0 token service temporarily unavailable',
        {
          cause: error instanceof Error ? error : new Error('Auth0 token retrieval failed'),
          requestId
        }
      );
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

      if (backendResponse.status === 404) {
        const backendError = new BackendError(
          ErrorCode.USER_NOT_FOUND,
          'User not found in backend system',
          404,
          { requestId }
        );
        return NextResponse.json(backendError.toJSON(), { status: backendError.statusCode });
      }

      if (backendResponse.status >= 500) {
        const backendError = new BackendError(
          ErrorCode.BACKEND_ERROR,
          'Backend service temporarily unavailable',
          503,
          { requestId, retryAfter: 30 }
        );
        return NextResponse.json(backendError.toJSON(), { status: backendError.statusCode });
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
        const authError = new AuthenticationError(
          ErrorCode.BACKEND_AUTH_ERROR,
          'Authentication failed with backend',
          { requestId }
        );
        return NextResponse.json(authError.toJSON(), { status: authError.statusCode });
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
    // Use the error classification system to handle errors properly
    const apiError = classifyError(error, requestId);
    return NextResponse.json(apiError.toJSON(), { status: apiError.statusCode });
  }
}