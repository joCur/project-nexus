/**
 * Authentication configuration constants
 * Centralized configuration for Auth0 and API endpoints
 */

/**
 * Auth0 configuration
 */
export const AUTH0_CONFIG = {
  // Auth0 custom claim URLs - environment configurable
  CLAIM_URLS: {
    ROLES: process.env.NEXT_PUBLIC_AUTH0_ROLES_CLAIM || 'https://api.nexus-app.de/roles',
    PERMISSIONS: process.env.NEXT_PUBLIC_AUTH0_PERMISSIONS_CLAIM || 'https://api.nexus-app.de/permissions', // Deprecated
    USER_ID: process.env.NEXT_PUBLIC_AUTH0_USER_ID_CLAIM || 'https://api.nexus-app.de/user_id',
  },
  
  // Auth0 API endpoints
  ENDPOINTS: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    TOKEN: '/api/auth/token',
    CALLBACK: '/api/auth/callback',
  },
} as const;

/**
 * API configuration
 */
export const API_CONFIG = {
  // GraphQL endpoint
  GRAPHQL_ENDPOINT: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
  
  // REST API endpoints
  ENDPOINTS: {
    ONBOARDING_STATUS: '/api/user/onboarding/status',
    ONBOARDING_COMPLETE: '/api/user/onboarding/complete',
    USER_PROFILE: '/api/user/profile',
    HEALTH: '/api/health',
  },
  
  // Request timeouts
  TIMEOUTS: {
    DEFAULT: 10000, // 10 seconds
    ONBOARDING: 15000, // 15 seconds for onboarding operations
    AUTH: 5000, // 5 seconds for auth operations
  },
} as const;

/**
 * Environment-specific configuration
 */
export const ENV_CONFIG = {
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_TEST: process.env.NODE_ENV === 'test',
  
  // Feature flags
  ENABLE_DEBUG_ERRORS: process.env.DEBUG_ERRORS === 'true',
  ENABLE_PERMISSION_WARNINGS: process.env.NODE_ENV !== 'test',
  
  // Base URLs
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001',
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
} as const;

/**
 * Get Auth0 claim URL by type
 */
export function getAuth0ClaimUrl(claimType: keyof typeof AUTH0_CONFIG.CLAIM_URLS): string {
  return AUTH0_CONFIG.CLAIM_URLS[claimType];
}

/**
 * Get API endpoint with optional base URL
 */
export function getApiEndpoint(endpoint: keyof typeof API_CONFIG.ENDPOINTS, includeBase = false): string {
  const path = API_CONFIG.ENDPOINTS[endpoint];
  return includeBase ? `${ENV_CONFIG.BASE_URL}${path}` : path;
}

/**
 * Get Auth0 endpoint
 */
export function getAuth0Endpoint(endpoint: keyof typeof AUTH0_CONFIG.ENDPOINTS): string {
  return AUTH0_CONFIG.ENDPOINTS[endpoint];
}

/**
 * Configuration validation
 */
export function validateConfiguration(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required environment variables
  if (!process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT && ENV_CONFIG.IS_PRODUCTION) {
    errors.push('NEXT_PUBLIC_GRAPHQL_ENDPOINT is required in production');
  }
  
  if (!process.env.NEXT_PUBLIC_BASE_URL && ENV_CONFIG.IS_PRODUCTION) {
    errors.push('NEXT_PUBLIC_BASE_URL is required in production');
  }
  
  // Validate URLs
  try {
    new URL(API_CONFIG.GRAPHQL_ENDPOINT);
  } catch {
    errors.push('Invalid GraphQL endpoint URL');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}