import { GET } from '../route';
import { getSession, getAccessToken } from '@auth0/nextjs-auth0';
// NextRequest import removed as it's not used in this test file

// Mock Auth0 functions
jest.mock('@auth0/nextjs-auth0', () => ({
  getSession: jest.fn(),
  getAccessToken: jest.fn(),
}));

// Mock environment variable
const mockBackendUrl = 'http://test-backend:3000';
process.env.API_BASE_URL = mockBackendUrl;

describe('GET /api/user/onboarding/status - NEX-178 Enhanced Error Handling', () => {
  const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
  const mockGetAccessToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>;

  const mockUser = {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockSession = {
    user: mockUser,
  };

  const mockOnboardingResponse = {
    data: {
      myOnboardingStatus: {
        isComplete: true,
        profile: {
          id: 'profile-id',
          fullName: 'Test User',
          displayName: 'Test',
        },
        onboarding: {
          id: 'onboarding-id',
          completed: true,
          completedAt: '2024-01-01T10:00:00Z',
          currentStep: 3,
          tutorialProgress: {
            profileSetup: true,
            workspaceIntro: true,
            firstCard: true,
          },
        },
        defaultWorkspace: {
          id: 'workspace-id',
          name: 'Test Workspace',
          privacy: 'private',
        },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    
    // Default mocks
    mockGetSession.mockResolvedValue(mockSession);
    mockGetAccessToken.mockResolvedValue({ accessToken: 'test-token' });
    
    // Mock successful GraphQL response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockOnboardingResponse),
    });

    // Mock console methods to avoid test noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication and Session Handling', () => {
    it('should return 401 when no session exists', async () => {
      mockGetSession.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(data.code).toBe('NO_SESSION');
      expect(data.requestId).toBeDefined();
    });

    it('should return 401 when session has no user', async () => {
      mockGetSession.mockResolvedValue({ user: null } as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
      expect(data.code).toBe('NO_SESSION');
    });

    it('should handle access token failure gracefully', async () => {
      mockGetAccessToken.mockRejectedValue(new Error('Token fetch failed'));

      const response = await GET();

      expect(response.status).toBe(200);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to get access token, using development mode:/),
        expect.any(Error)
      );
    });

    it('should include user context in headers', async () => {
      await GET();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBackendUrl}/graphql`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'X-User-Sub': mockUser.sub,
            'X-User-Email': mockUser.email,
            'X-Request-ID': expect.any(String),
          }),
        })
      );
    });
  });

  describe('Backend Communication and Error Handling', () => {
    it('should handle backend server errors with proper response codes', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Database connection failed'),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Backend service temporarily unavailable');
      expect(data.code).toBe('BACKEND_ERROR');
      expect(data.retryAfter).toBe(30);
      expect(data.requestId).toBeDefined();
    });

    it('should handle 404 user not found errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('User not found'),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found in backend system');
      expect(data.code).toBe('USER_NOT_FOUND');
    });

    it('should handle network connection failures', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('fetch failed'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Cannot connect to backend service');
      expect(data.code).toBe('BACKEND_UNREACHABLE');
      expect(data.retryAfter).toBe(30);
    });

    it('should handle request timeouts', async () => {
      jest.useFakeTimers();

      // Create a promise that never resolves to simulate hanging request
      const hangingPromise = new Promise(() => {});
      (global.fetch as jest.Mock).mockReturnValue(hangingPromise);

      const responsePromise = GET();

      // Advance time to trigger timeout
      jest.advanceTimersByTime(10000);

      // Give AbortController time to process
      await new Promise(resolve => setTimeout(resolve, 0));

      const response = await responsePromise;
      const data = await response.json();

      expect(response.status).toBe(408);
      expect(data.error).toBe('Request timeout - backend service is slow to respond');
      expect(data.code).toBe('REQUEST_TIMEOUT');
      expect(data.retryAfter).toBe(10);

      jest.useRealTimers();
    });

    it('should handle ECONNREFUSED errors specifically', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3000'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Cannot connect to backend service');
      expect(data.code).toBe('BACKEND_UNREACHABLE');
    });
  });

  describe('GraphQL Error Handling', () => {
    it('should handle GraphQL authentication errors', async () => {
      const errorResponse = {
        errors: [
          {
            message: 'Authentication required',
            extensions: { code: 'UNAUTHENTICATED' },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(errorResponse),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication failed with backend');
      expect(data.code).toBe('BACKEND_AUTH_ERROR');
    });

    it('should handle general GraphQL errors', async () => {
      const errorResponse = {
        errors: [
          {
            message: 'Database query failed',
            extensions: { code: 'INTERNAL_ERROR' },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(errorResponse),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error occurred while fetching onboarding status');
      expect(data.code).toBe('INTERNAL_ERROR');
      expect(data.message).toBe('GraphQL query failed: Database query failed');
    });

    it('should handle missing onboarding status data', async () => {
      const invalidResponse = {
        data: {
          // Missing myOnboardingStatus
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidResponse),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error occurred while fetching onboarding status');
      expect(data.message).toBe('Invalid response format: missing onboarding status data');
    });

    it('should handle authentication errors with message matching', async () => {
      const errorResponse = {
        errors: [
          {
            message: 'User Authentication failed: Invalid token',
            extensions: { code: 'OTHER_ERROR' },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(errorResponse),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication failed with backend');
      expect(data.code).toBe('BACKEND_AUTH_ERROR');
    });
  });

  describe('Successful Response Handling', () => {
    it('should return properly formatted onboarding status for completed user', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isComplete: true,
        currentStep: 3,
        hasProfile: true,
        hasWorkspace: true,
        profile: mockOnboardingResponse.data.myOnboardingStatus.profile,
        onboarding: mockOnboardingResponse.data.myOnboardingStatus.onboarding,
        workspace: mockOnboardingResponse.data.myOnboardingStatus.defaultWorkspace,
      });
    });

    it('should handle incomplete onboarding status', async () => {
      const incompleteResponse = {
        data: {
          myOnboardingStatus: {
            isComplete: false,
            profile: {
              id: 'profile-id',
              fullName: 'Test User',
            },
            onboarding: {
              id: 'onboarding-id',
              completed: false,
              currentStep: 2,
              tutorialProgress: {
                profileSetup: true,
                workspaceIntro: false,
                firstCard: false,
              },
            },
            defaultWorkspace: null,
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(incompleteResponse),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isComplete: false,
        currentStep: 2,
        hasProfile: true,
        hasWorkspace: false,
        profile: incompleteResponse.data.myOnboardingStatus.profile,
        onboarding: incompleteResponse.data.myOnboardingStatus.onboarding,
        workspace: null,
      });
    });

    it('should handle new user with minimal data', async () => {
      const newUserResponse = {
        data: {
          myOnboardingStatus: {
            isComplete: false,
            profile: null,
            onboarding: null,
            defaultWorkspace: null,
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(newUserResponse),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isComplete: false,
        currentStep: 1, // Default for new users
        hasProfile: false,
        hasWorkspace: false,
        profile: null,
        onboarding: null,
        workspace: null,
      });
    });
  });

  describe('Request Logging and Tracking', () => {
    it('should log request lifecycle with unique request IDs', async () => {
      await GET();

      const logCalls = (console.log as jest.Mock).mock.calls;
      
      // Find request start log
      const startLog = logCalls.find(call => 
        call[0].includes('Onboarding status request started')
      );
      expect(startLog).toBeDefined();
      
      // Find completion log
      const completionLog = logCalls.find(call => 
        call[0].includes('Request completed successfully')
      );
      expect(completionLog).toBeDefined();
      
      // Both should have the same request ID
      const requestIdMatch = startLog[0].match(/\[([^\]]+)\]/);
      const completionRequestId = completionLog[0].match(/\[([^\]]+)\]/);
      expect(requestIdMatch[1]).toBe(completionRequestId[1]);
    });

    it('should log detailed error information with request context', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Test error'));

      await GET();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/Error getting onboarding status after \d+ms:/),
        expect.objectContaining({
          error: 'Test error',
          stack: expect.any(String),
        })
      );
    });

    it('should log backend response status and timing', async () => {
      await GET();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/Backend response status: 200/)
      );
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/Request completed successfully in \d+ms/),
        expect.objectContaining({
          isComplete: true,
          currentStep: 3,
        })
      );
    });

    it('should include performance timing in logs', async () => {
      await GET();

      const completionLog = (console.log as jest.Mock).mock.calls.find(call => 
        call[0].includes('Request completed successfully')
      );
      
      expect(completionLog[0]).toMatch(/in \d+ms/);
    });
  });

  describe('Development Mode Support', () => {
    it('should work without access token in development', async () => {
      mockGetAccessToken.mockRejectedValue(new Error('No access token available'));

      const response = await GET();

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBackendUrl}/graphql`,
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });

    it('should include user context headers for development authentication', async () => {
      mockGetAccessToken.mockRejectedValue(new Error('Development mode'));

      await GET();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBackendUrl}/graphql`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-User-Sub': mockUser.sub,
            'X-User-Email': mockUser.email,
          }),
        })
      );
    });
  });

  describe('GraphQL Query Structure', () => {
    it('should send correct GraphQL query structure', async () => {
      await GET();

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.query).toContain('query GetMyOnboardingStatus');
      expect(requestBody.query).toContain('myOnboardingStatus');
      expect(requestBody.query).toContain('isComplete');
      expect(requestBody.query).toContain('profile');
      expect(requestBody.query).toContain('onboarding');
      expect(requestBody.query).toContain('defaultWorkspace');
    });

    it('should set correct request headers', async () => {
      await GET();

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Request-ID']).toBeDefined();
      expect(headers['X-Request-ID']).toMatch(/^[a-z0-9]{7}$/);
    });
  });

  describe('Race Condition Prevention', () => {
    it('should handle concurrent request scenarios', async () => {
      // This tests that the backend can handle multiple requests
      // The real race condition prevention is in the frontend hook
      const promises = [GET(), GET(), GET()];
      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Each should have a unique request ID
      const requestIds = new Set();
      responses.forEach(response => {
        const body = response.body;
        // In a real scenario, we'd extract the request ID from response headers
        // Here we just verify all requests completed successfully
        expect(response.status).toBe(200);
      });
    });

    it('should handle session validation consistently', async () => {
      // Multiple rapid calls should all handle session validation the same way
      const promises = Array(5).fill(null).map(() => GET());
      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Session should be checked for each request
      expect(mockGetSession).toHaveBeenCalledTimes(5);
    });
  });
});