import { UserProvider, ConfigParameters } from '@auth0/nextjs-auth0/client';

/**
 * Auth0 Configuration for Project Nexus
 * 
 * This configuration implements the security requirements:
 * - 4-hour session duration as recommended by security analyst
 * - Production cookie configuration for .nexus.app domain
 * - Secure session handling with httpOnly cookies
 * - Environment-specific base URL configuration
 */

// Validate required environment variables
const requiredEnvVars = [
  'AUTH0_SECRET',
  'AUTH0_BASE_URL', 
  'AUTH0_ISSUER_BASE_URL',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET'
] as const;

function validateEnvironment(): void {
  const missing = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required Auth0 environment variables: ${missing.join(', ')}`
    );
  }
}

// Validate environment on module load (development only)
if (process.env.NODE_ENV === 'development') {
  validateEnvironment();
}

/**
 * Auth0 session configuration
 * Implements 4-hour session duration and secure cookie settings
 */
export const auth0Config: ConfigParameters = {
  secret: process.env.AUTH0_SECRET!,
  baseURL: process.env.AUTH0_BASE_URL!,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL!,
  clientID: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  
  // API audience for backend GraphQL API access
  authorizationParams: {
    audience: process.env.AUTH0_AUDIENCE || 'https://api.nexus-app.de',
    scope: 'openid profile email read:cards write:cards read:workspaces write:workspaces'
  },
  
  // Session configuration with 4-hour duration
  session: {
    cookie: {
      // Production domain configuration for .nexus.app
      domain: process.env.NODE_ENV === 'production' ? '.nexus.app' : undefined,
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      // Increase cookie size limit for user metadata
      maxAge: 4 * 60 * 60, // 4 hours in seconds
    },
    // 4-hour absolute session duration (security requirement)
    absoluteDuration: 4 * 60 * 60, // 4 hours in seconds
    // Rolling session disabled for predictable expiration
    rolling: false,
    rollingDuration: false,
  },
  
  // Routes configuration - removed as they're handled by the route handler
  
  // Identity provider logout configuration  
  idpLogout: true,
  
  // Auth0 organization support (for enterprise features)
  organization: process.env.AUTH0_ORGANIZATION,
  
  // Custom login parameters
  loginParameters: {
    // Force re-authentication for sensitive operations
    max_age: '0',
    // UI locales based on user preference
    ui_locales: 'en-US',
  },
};

/**
 * Auth0 User Provider configuration for React context
 */
export const userProviderProps = {
  loginUrl: '/api/auth/login',
  profileUrl: '/api/auth/me',
};

/**
 * Development helper to check Auth0 configuration
 */
export function checkAuth0Config(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  try {
    validateEnvironment();
  } catch (error) {
    errors.push((error as Error).message);
  }
  
  // Check for common configuration issues
  if (process.env.AUTH0_BASE_URL?.endsWith('/')) {
    errors.push('AUTH0_BASE_URL should not end with a trailing slash');
  }
  
  if (process.env.AUTH0_ISSUER_BASE_URL?.endsWith('/')) {
    errors.push('AUTH0_ISSUER_BASE_URL should not end with a trailing slash');
  }
  
  if (!process.env.AUTH0_SECRET || process.env.AUTH0_SECRET.length < 32) {
    errors.push('AUTH0_SECRET must be at least 32 characters long');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get Auth0 domain from environment
 */
export function getAuth0Domain(): string {
  const issuerBaseURL = process.env.AUTH0_ISSUER_BASE_URL;
  if (!issuerBaseURL) {
    throw new Error('AUTH0_ISSUER_BASE_URL is not configured');
  }
  
  // Extract domain from https://your-domain.auth0.com format
  return issuerBaseURL.replace('https://', '').replace('http://', '');
}

/**
 * Auth0 audience for API access tokens
 */
export const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || 'https://api.nexus-app.de';

/**
 * GraphQL endpoint for user synchronization
 */
export const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';