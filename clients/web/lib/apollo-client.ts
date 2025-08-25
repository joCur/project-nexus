/**
 * Apollo GraphQL Client Configuration
 * 
 * Provides GraphQL client setup with authentication integration
 * and proper error handling for Project Nexus backend API
 */

import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

/**
 * HTTP Link to backend GraphQL endpoint
 */
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
  credentials: 'include', // Include cookies for authentication
});

/**
 * Authentication link that adds Auth0 token to requests
 */
const authLink = setContext(async (_, { headers }) => {
  try {
    // Get the access token from Auth0
    console.log('Apollo authLink: Fetching access token...');
    const response = await fetch('/api/auth/token', {
      method: 'GET',
      credentials: 'include',
    });

    let token = null;
    if (response.ok) {
      const data = await response.json();
      token = data.accessToken;
      console.log('Apollo authLink: Access token retrieved successfully');
    } else if (response.status === 401) {
      // User is not authenticated - redirect to login
      console.warn('Apollo authLink: User not authenticated, redirecting to login');
      window.location.href = '/api/auth/login';
      return { headers };
    } else {
      console.warn('Apollo authLink: Failed to get auth token:', response.status, response.statusText);
    }

    const requestHeaders = {
      ...headers,
      ...(token && { authorization: `Bearer ${token}` }),
    };
    
    console.log('Apollo authLink: Request headers:', {
      hasAuthorization: !!requestHeaders.authorization,
      headerKeys: Object.keys(requestHeaders)
    });

    return { headers: requestHeaders };
  } catch (error) {
    console.warn('Apollo authLink: Failed to get auth token for GraphQL request:', error);
    return { headers };
  }
});

/**
 * Error link for handling GraphQL and network errors
 */
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      
      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Redirect to login or refresh token
        window.location.href = '/api/auth/login';
      }
    });
  }

  if (networkError) {
    console.error(`Apollo Client Network error:`, networkError);
    console.error('Network error details:', {
      message: networkError.message,
      name: networkError.name,
      stack: networkError.stack,
      statusCode: (networkError as any).statusCode,
      result: (networkError as any).result
    });
    
    // Handle specific network errors
    if ('statusCode' in networkError && networkError.statusCode === 401) {
      // Unauthorized - redirect to login
      window.location.href = '/api/auth/login';
    }
  }
});

/**
 * Apollo Client instance with cache, links, and error handling
 */
export const apolloClient = new ApolloClient({
  link: from([
    errorLink,
    authLink,
    httpLink,
  ]),
  cache: new InMemoryCache({
    typePolicies: {
      // Canvas-specific caching policies
      Canvas: {
        fields: {
          // Cache canvases by ID for efficient updates
          id: {
            merge: false, // Don't merge, replace entirely
          },
        },
      },
      Workspace: {
        fields: {
          canvases: {
            // Merge strategy for canvas lists
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all', // Return partial data on error
      fetchPolicy: 'cache-and-network', // Always check network for updates
    },
    query: {
      errorPolicy: 'all',
      fetchPolicy: 'cache-first',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
  connectToDevTools: process.env.NODE_ENV === 'development',
});

/**
 * Type-safe Apollo Client instance
 */
export type ApolloClientType = typeof apolloClient;

export default apolloClient;