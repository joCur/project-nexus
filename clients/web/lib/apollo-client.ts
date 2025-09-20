/**
 * Apollo GraphQL Client Configuration
 * 
 * Provides GraphQL client setup with authentication integration
 * and proper error handling for Project Nexus backend API
 */

import { ApolloClient, InMemoryCache, createHttpLink, from, gql } from '@apollo/client';
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
 * Cache configuration constants
 */
const CACHE_CONFIG = {
  // Permission cache TTL - 5 minutes as specified in NEX-186 requirements
  PERMISSION_TTL_MS: 5 * 60 * 1000,

  // Canvas data cache TTL - 10 minutes for canvas lists and data
  CANVAS_TTL_MS: 10 * 60 * 1000,

  // Maximum cache size to prevent memory issues (approximately)
  MAX_CACHE_SIZE_KB: 10 * 1024, // 10MB
};

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
            // Merge strategy for canvas lists with deduplication
            merge(existing = [], incoming) {
              // Create a Map to deduplicate by canvas ID
              const canvasMap = new Map();

              // Add existing canvases first
              existing.forEach((canvas: any) => {
                if (canvas?.id) {
                  canvasMap.set(canvas.id, canvas);
                }
              });

              // Add incoming canvases, overwriting existing ones with same ID
              incoming.forEach((canvas: any) => {
                if (canvas?.id) {
                  canvasMap.set(canvas.id, canvas);
                }
              });

              return Array.from(canvasMap.values());
            },
          },
        },
      },
      // Cache policies for queries
      Query: {
        fields: {
          // Canvas data caching with TTL
          workspaceCanvases: {
            // Cache key includes workspaceId and filter for isolation
            keyArgs: ['workspaceId', 'filter'],
            merge: false, // Replace entirely for consistency
          },

          canvas: {
            // Cache individual canvas by ID
            keyArgs: ['id'],
            merge: false,
          },

          // Permission-specific caching policies for NEX-186
          getUserWorkspacePermissions: {
            // Cache key includes userId and workspaceId for workspace isolation
            keyArgs: ['userId', 'workspaceId'],
            // Replace cached data completely to avoid merge issues
            merge: false,
          },

          // Single permission check caching
          checkUserPermission: {
            // Cache key includes userId, workspaceId, and specific permission
            keyArgs: ['userId', 'workspaceId', 'permission'],
            merge: false,
          },

          // Context permissions (all workspaces) caching
          getUserPermissionsForContext: {
            // Cache key includes only userId since this covers all workspaces
            keyArgs: ['userId'],
            merge: false,
          },
        },
      },
    },
    // PossibleTypes for union/interface support if needed
    possibleTypes: {},
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all', // Return partial data on error
      fetchPolicy: 'cache-first', // Use cache first, then network
    },
    query: {
      errorPolicy: 'all',
      fetchPolicy: 'cache-first', // Use cache first, then network
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
  connectToDevTools: process.env.NODE_ENV === 'development',
});

/**
 * Cache management utilities for permission system
 */
export const permissionCacheUtils = {
  /**
   * Get cache size estimation (approximate)
   */
  getCacheSize(): number {
    try {
      const cacheData = apolloClient.cache.extract();
      return JSON.stringify(cacheData).length;
    } catch (error) {
      console.warn('Failed to calculate cache size:', error);
      return 0;
    }
  },

  /**
   * Check if cache size exceeds maximum allowed
   */
  isCacheSizeExceeded(): boolean {
    const currentSize = this.getCacheSize();
    const maxSizeBytes = CACHE_CONFIG.MAX_CACHE_SIZE_KB * 1024;
    return currentSize > maxSizeBytes;
  },

  /**
   * Clear expired permission cache entries
   */
  clearExpiredPermissionCache(): void {
    try {
      const now = Date.now();
      const cache = apolloClient.cache;
      
      // Extract current cache data
      const cacheData = cache.extract();
      
      // Find and evict expired permission entries
      Object.keys(cacheData).forEach(key => {
        if (key.startsWith('ROOT_QUERY.getUserWorkspacePermissions') ||
            key.startsWith('ROOT_QUERY.checkUserPermission') ||
            key.startsWith('ROOT_QUERY.getUserPermissionsForContext')) {
          
          const entry = cacheData[key];
          if (entry && typeof entry === 'object' && 
              '__cacheTimestamp' in entry &&
              (now - (entry.__cacheTimestamp as number)) > CACHE_CONFIG.PERMISSION_TTL_MS) {
            // Entry is expired, evict it
            const fieldName = key.split('.')[1];
            const args = this.parseArgsFromCacheKey(key);
            
            cache.evict({
              id: 'ROOT_QUERY',
              fieldName,
              args,
            });
          }
        }
      });
      
      // Run garbage collection to clean up evicted entries
      cache.gc();
      
      console.log('Expired permission cache entries cleared');
    } catch (error) {
      console.warn('Failed to clear expired permission cache:', error);
    }
  },

  /**
   * Parse arguments from Apollo cache key
   */
  parseArgsFromCacheKey(cacheKey: string): Record<string, any> {
    try {
      // Apollo cache keys format: ROOT_QUERY.fieldName({"arg1":"value1","arg2":"value2"})
      const argsMatch = cacheKey.match(/\({.*}\)/);
      if (argsMatch) {
        return JSON.parse(argsMatch[0].slice(1, -1));
      }
      return {};
    } catch {
      return {};
    }
  },

  /**
   * Warm permission cache for multiple workspaces
   */
  async warmPermissionCache(userId: string, workspaceIds: string[]): Promise<void> {
    if (!userId || !workspaceIds.length) return;

    const warmingPromises = workspaceIds.map(workspaceId =>
      apolloClient.query({
        query: gql`
          query GetUserWorkspacePermissions($userId: ID!, $workspaceId: ID!) {
            getUserWorkspacePermissions(userId: $userId, workspaceId: $workspaceId)
          }
        `,
        variables: { userId, workspaceId },
        fetchPolicy: 'cache-first',
        errorPolicy: 'ignore', // Don't fail the entire warming process
      }).catch(error => {
        console.warn('Failed to warm cache for workspace:', { workspaceId, error });
      })
    );

    try {
      await Promise.allSettled(warmingPromises);
      console.log(`Permission cache warmed for ${workspaceIds.length} workspaces`);
    } catch (error) {
      console.warn('Permission cache warming failed:', error);
    }
  },

  /**
   * Invalidate all permission cache for a user
   */
  invalidateUserPermissions(userId: string): void {
    try {
      const cache = apolloClient.cache;
      
      // Evict all permission-related queries for this user
      cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'getUserWorkspacePermissions',
        args: { userId },
      });
      
      cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'checkUserPermission',
        args: { userId },
      });
      
      cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'getUserPermissionsForContext',
        args: { userId },
      });
      
      cache.gc();
      console.log(`All permission cache invalidated for user: ${userId}`);
    } catch (error) {
      console.warn('Failed to invalidate user permissions:', error);
    }
  },

  /**
   * Invalidate workspace-specific permission cache
   */
  invalidateWorkspacePermissions(userId: string, workspaceId: string): void {
    try {
      const cache = apolloClient.cache;
      
      // Evict workspace-specific permission queries
      cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'getUserWorkspacePermissions',
        args: { userId, workspaceId },
      });
      
      // Also evict context permissions as they include this workspace
      cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'getUserPermissionsForContext',
        args: { userId },
      });
      
      cache.gc();
      console.log(`Workspace permission cache invalidated for user: ${userId}, workspace: ${workspaceId}`);
    } catch (error) {
      console.warn('Failed to invalidate workspace permissions:', error);
    }
  },

  /**
   * Perform cache maintenance (clear expired entries, check size limits)
   */
  performMaintenance(): void {
    try {
      // Clear expired entries
      this.clearExpiredPermissionCache();
      
      // Check cache size and warn if exceeded
      if (this.isCacheSizeExceeded()) {
        console.warn('Permission cache size exceeded limit, consider clearing cache');
        // Could implement automatic cache clearing here if needed
      }
      
      console.log('Permission cache maintenance completed');
    } catch (error) {
      console.warn('Permission cache maintenance failed:', error);
    }
  },
};

/**
 * Start periodic cache maintenance
 * Runs every 5 minutes to clean up expired entries
 */
if (typeof window !== 'undefined') {
  // Only run in browser environment
  setInterval(() => {
    permissionCacheUtils.performMaintenance();
  }, CACHE_CONFIG.PERMISSION_TTL_MS); // Run maintenance at TTL interval
}

/**
 * Type-safe Apollo Client instance
 */
export type ApolloClientType = typeof apolloClient;

export default apolloClient;