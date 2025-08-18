import jwt from 'jsonwebtoken';
import { Auth0TokenPayload } from '@/types/auth';
import { TEST_JWT_SECRET, createMockAuth0User } from './test-helpers';

/**
 * Mock Auth0 service for testing
 * Provides controlled responses for Auth0 API calls
 */

// Mock JWKS responses
export const mockJwksResponses = {
  valid: {
    keys: [
      {
        kty: 'RSA',
        kid: 'test-key-id',
        use: 'sig',
        n: 'mock-modulus',
        e: 'AQAB',
      },
    ],
  },
  empty: {
    keys: [],
  },
  invalid: {
    error: 'invalid_request',
    error_description: 'Invalid JWKS request',
  },
};

// Mock Auth0 Management API responses
export const mockAuth0ManagementResponses = {
  user: {
    user_id: 'auth0|test_user_123',
    email: 'test@example.com',
    email_verified: true,
    name: 'Test User',
    nickname: 'testuser',
    picture: 'https://example.com/avatar.jpg',
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
    login_count: 5,
    app_metadata: {
      roles: ['user'],
      permissions: ['card:read', 'workspace:read'],
    },
    user_metadata: {},
  },
  userNotFound: {
    statusCode: 404,
    error: 'Not Found',
    message: 'The user does not exist.',
  },
  rateLimited: {
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded',
  },
};

/**
 * Mock JWT validation scenarios
 */
export class MockAuth0TokenValidator {
  private scenario: 'valid' | 'expired' | 'invalid' | 'malformed' | 'unverified_email' | 'network_error';

  constructor(scenario: 'valid' | 'expired' | 'invalid' | 'malformed' | 'unverified_email' | 'network_error' = 'valid') {
    this.scenario = scenario;
  }

  setScenario(scenario: typeof this.scenario) {
    this.scenario = scenario;
  }

  async validateToken(token: string) {
    switch (this.scenario) {
      case 'valid':
        return this.createValidTokenResponse(token);
      
      case 'expired':
        throw new jwt.TokenExpiredError('jwt expired', new Date());
      
      case 'invalid':
        throw new jwt.JsonWebTokenError('invalid token');
      
      case 'malformed':
        throw new jwt.JsonWebTokenError('jwt malformed');
      
      case 'unverified_email':
        return this.createUnverifiedEmailResponse(token);
      
      case 'network_error':
        throw new Error('Network error');
      
      default:
        throw new Error('Unknown scenario');
    }
  }

  private createValidTokenResponse(token: string) {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        throw new Error('Invalid token structure');
      }

      const payload = decoded.payload as Auth0TokenPayload;
      return createMockAuth0User({
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        iat: payload.iat,
        exp: payload.exp,
      });
    } catch (error) {
      // If token decode fails, return default valid user
      return createMockAuth0User();
    }
  }

  private createUnverifiedEmailResponse(token: string) {
    const validUser = this.createValidTokenResponse(token);
    return {
      ...validUser,
      email_verified: false,
    };
  }
}

/**
 * Mock JWKS client for testing
 */
export class MockJwksClient {
  private scenario: 'valid' | 'key_not_found' | 'network_error' | 'invalid_response';

  constructor(scenario: 'valid' | 'key_not_found' | 'network_error' | 'invalid_response' = 'valid') {
    this.scenario = scenario;
  }

  setScenario(scenario: typeof this.scenario) {
    this.scenario = scenario;
  }

  async getSigningKey(kid: string) {
    switch (this.scenario) {
      case 'valid':
        return {
          kid: 'test-key-id',
          getPublicKey: () => TEST_JWT_SECRET,
          rsaPublicKey: TEST_JWT_SECRET,
        };
      
      case 'key_not_found':
        throw new Error(`Unable to find a signing key that matches '${kid}'`);
      
      case 'network_error':
        throw new Error('Network error');
      
      case 'invalid_response':
        throw new Error('Invalid JWKS response');
      
      default:
        throw new Error('Unknown scenario');
    }
  }
}

/**
 * Mock Auth0 Management API client
 */
export class MockAuth0ManagementClient {
  private scenario: 'valid' | 'user_not_found' | 'rate_limited' | 'network_error';

  constructor(scenario: 'valid' | 'user_not_found' | 'rate_limited' | 'network_error' = 'valid') {
    this.scenario = scenario;
  }

  setScenario(scenario: typeof this.scenario) {
    this.scenario = scenario;
  }

  async getUser(userId: string) {
    switch (this.scenario) {
      case 'valid':
        return mockAuth0ManagementResponses.user;
      
      case 'user_not_found':
        throw new Error('The user does not exist.');
      
      case 'rate_limited':
        const error = new Error('Rate limit exceeded') as any;
        error.statusCode = 429;
        throw error;
      
      case 'network_error':
        throw new Error('Network error');
      
      default:
        throw new Error('Unknown scenario');
    }
  }

  async updateUser(userId: string, data: any) {
    if (this.scenario === 'network_error') {
      throw new Error('Network error');
    }
    
    return {
      ...mockAuth0ManagementResponses.user,
      ...data,
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Mock fetch for Auth0 JWKS endpoint
 */
export function createMockFetch(scenario: 'valid' | 'network_error' | 'invalid_json' | 'not_found' = 'valid') {
  return jest.fn().mockImplementation(async (url: string) => {
    // Add a small delay to simulate network response time
    await new Promise(resolve => setTimeout(resolve, 10));
    
    if (url.includes('/.well-known/jwks.json')) {
      switch (scenario) {
        case 'valid':
          return {
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockJwksResponses.valid),
          };
        
        case 'network_error':
          throw new Error('Network error');
        
        case 'invalid_json':
          return {
            ok: true,
            status: 200,
            json: () => Promise.reject(new Error('Invalid JSON')),
          };
        
        case 'not_found':
          return {
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Not found' }),
          };
        
        default:
          throw new Error('Unknown scenario');
      }
    }
    
    throw new Error('Unknown URL');
  });
}

/**
 * Test scenarios for Auth0 integration
 */
export const AUTH0_TEST_SCENARIOS = {
  VALID_LOGIN: {
    name: 'Valid user login',
    token: 'valid-jwt-token',
    expectedUser: createMockAuth0User(),
    shouldSucceed: true,
  },
  
  EXPIRED_TOKEN: {
    name: 'Expired JWT token',
    token: 'expired-jwt-token',
    expectedError: 'TokenExpiredError',
    shouldSucceed: false,
  },
  
  INVALID_TOKEN: {
    name: 'Invalid JWT token',
    token: 'invalid-jwt-token',
    expectedError: 'InvalidTokenError',
    shouldSucceed: false,
  },
  
  MALFORMED_TOKEN: {
    name: 'Malformed JWT token',
    token: 'malformed.jwt.token',
    expectedError: 'JsonWebTokenError',
    shouldSucceed: false,
  },
  
  UNVERIFIED_EMAIL: {
    name: 'Unverified email address',
    token: 'unverified-email-token',
    expectedError: 'EmailNotVerifiedError',
    shouldSucceed: false,
  },
  
  NETWORK_ERROR: {
    name: 'Network connectivity issues',
    token: 'network-error-token',
    expectedError: 'NetworkError',
    shouldSucceed: false,
  },
  
  RATE_LIMITED: {
    name: 'Auth0 rate limiting',
    token: 'rate-limited-token',
    expectedError: 'RateLimitError',
    shouldSucceed: false,
  },
};

/**
 * Create mock Auth0 service instance
 */
export function createMockAuth0Service(scenario: keyof typeof AUTH0_TEST_SCENARIOS = 'VALID_LOGIN') {
  const mockValidator = new MockAuth0TokenValidator(
    scenario === 'VALID_LOGIN' ? 'valid' :
    scenario === 'EXPIRED_TOKEN' ? 'expired' :
    scenario === 'INVALID_TOKEN' ? 'invalid' :
    scenario === 'MALFORMED_TOKEN' ? 'malformed' :
    scenario === 'UNVERIFIED_EMAIL' ? 'unverified_email' :
    'network_error'
  );

  return {
    validateAuth0Token: jest.fn().mockImplementation((token: string) => {
      return mockValidator.validateToken(token);
    }),
    syncUserFromAuth0: jest.fn(),
    createSession: jest.fn(),
    validateSession: jest.fn(),
    destroySession: jest.fn(),
    getUserPermissions: jest.fn(),
    checkPermission: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue({ status: 'OK', responseTime: 100 }),
  };
}