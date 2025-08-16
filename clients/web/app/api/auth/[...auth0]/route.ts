import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';
import { GRAPHQL_ENDPOINT } from '@/lib/auth0-config';

/**
 * User synchronization with backend GraphQL API
 * This function is called after successful Auth0 authentication
 * to ensure the user exists in our database
 */
async function syncUserToDatabase(user: any): Promise<void> {
  try {
    // Extract user information from Auth0 profile
    const userData = {
      auth0UserId: user.sub,
      email: user.email,
      emailVerified: user.email_verified || false,
      displayName: user.name || user.nickname,
      avatarUrl: user.picture,
      auth0UpdatedAt: user.updated_at,
    };

    // GraphQL mutation to upsert user
    const mutation = `
      mutation SyncUser($input: SyncUserInput!) {
        syncUser(input: $input) {
          id
          email
          displayName
          createdAt
          updatedAt
        }
      }
    `;

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include the access token for authorization
        'Authorization': `Bearer ${user.accessToken || ''}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: userData,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to sync user to database:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        userData,
      });
      
      // Don't throw error here to avoid blocking authentication
      // User sync can be retried later
      return;
    }

    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL errors during user sync:', result.errors);
      return;
    }

    console.log('User synchronized successfully:', {
      userId: result.data?.syncUser?.id,
      email: userData.email,
    });

  } catch (error) {
    console.error('Error syncing user to database:', error);
    
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
      max_age: '0'     // Don't use cached authentication
    }
  })
});

/**
 * Handle POST requests for programmatic authentication operations
 */
export const POST = handleAuth();