import { handleAuth, handleLogin, handleCallback } from '@auth0/nextjs-auth0';
import type { AfterCallbackAppRoute } from '@auth0/nextjs-auth0';
import { GRAPHQL_ENDPOINT } from '@/lib/auth0-config';
import { createContextLogger } from '@/utils/logger';

// Create logger for Auth0 route
const logger = createContextLogger({ module: 'auth0-route' });

/**
 * Auth0 User Claims interface
 * Represents the user object received from Auth0 after authentication
 */
interface Auth0UserClaims {
  sub: string; // Auth0 user ID
  email?: string;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;
  email_verified?: boolean;
  [key: string]: unknown; // Allow additional custom claims
}

/**
 * Extended user with access token
 */
interface Auth0User extends Auth0UserClaims {
  accessToken?: string;
}

/**
 * User synchronization with backend GraphQL API
 * This function is called after successful Auth0 authentication
 * to ensure the user exists in our database
 */
async function syncUserToDatabase(user: Auth0User): Promise<void> {
  try {
    logger.info('Syncing user to database', {
      sub: user.sub,
      email: user.email,
      name: user.name
    });

    // GraphQL mutation to sync user from Auth0
    const mutation = `
      mutation SyncUserFromAuth0($auth0Token: String!) {
        syncUserFromAuth0(auth0Token: $auth0Token) {
          user {
            id
            email
            displayName
            auth0UserId
            createdAt
            updatedAt
          }
        }
      }
    `;

    // Use a dummy token for now - the backend will extract user info from Auth0 token
    // In production, this should be the actual Auth0 access token
    const auth0Token = user.accessToken || 'dummy-token';

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // For development, we'll skip token validation in sync
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          auth0Token: auth0Token,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to sync user to database', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        userSub: user.sub,
      });

      // Don't throw error here to avoid blocking authentication
      // User sync can be retried later
      return;
    }

    const result = await response.json();

    if (result.errors) {
      logger.error('GraphQL errors during user sync', {
        errors: result.errors,
        userSub: user.sub
      });
      return;
    }

    logger.info('User synchronized successfully', {
      userId: result.data?.syncUserFromAuth0?.user?.id,
      email: result.data?.syncUserFromAuth0?.user?.email,
    });

  } catch (error) {
    logger.error('Error syncing user to database', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      userSub: user.sub
    });

    // Don't throw error to avoid blocking authentication flow
    // User sync can be retried later via hooks or background jobs
  }
}


/**
 * Auth0 route handlers for Next.js App Router
 * 
 * This handles all Auth0 authentication routes:
 * - GET /api/auth/login - Initiate login
 * - GET /api/auth/logout - Initiate logout  
 * - GET /api/auth/callback - Handle Auth0 callback
 * - GET /api/auth/me - Get current user profile
 */
export const GET = handleAuth({
  login: handleLogin({
    authorizationParams: {
      prompt: 'login', // Force fresh login every time
      max_age: 0,      // Don't use cached authentication
      audience: process.env.AUTH0_AUDIENCE || 'https://api.nexus-app.de',
      scope: 'openid profile email read:cards write:cards read:workspaces write:workspaces'
    }
  }),
  callback: handleCallback({
    afterCallback: (async (req, session) => {
      // Sync user to backend database after successful authentication
      if (session.user) {
        await syncUserToDatabase(session.user as Auth0User);
      }
      return session;
    }) as AfterCallbackAppRoute
  })
});

/**
 * Handle POST requests for programmatic authentication operations
 */
export const POST = handleAuth();