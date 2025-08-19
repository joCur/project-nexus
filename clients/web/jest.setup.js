import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock Auth0 NextJS SDK
jest.mock('@auth0/nextjs-auth0/client', () => ({
  useUser: jest.fn(() => ({
    user: null,
    error: null,
    isLoading: false,
  })),
  UserProvider: ({ children }) => children,
}));

// Mock fetch globally with proper typing
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Add mock methods to fetch
global.fetch.mockClear = jest.fn();
global.fetch.mockImplementation = jest.fn();
global.fetch.mock = { calls: [], results: [] };

// Setup fetch mock helper
global.mockFetch = (response, ok = true) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 400,
      statusText: ok ? 'OK' : 'Bad Request',
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    })
  );
};

// Setup fetch mock error helper
global.mockFetchError = (error) => {
  global.fetch.mockImplementation(() => Promise.reject(error));
};

// Clear mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch.mockClear();
});

// Console suppression for tests
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Helper to restore console for specific tests
global.restoreConsole = () => {
  global.console = originalConsole;
};

// Helper to mock console for specific tests
global.mockConsole = () => {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
};

// Global test helpers
global.testHelpers = {
  // Mock Auth0 user
  mockAuthUser: (user = null, isLoading = false, error = null) => {
    const useUser = require('@auth0/nextjs-auth0/client').useUser;
    useUser.mockReturnValue({ user, isLoading, error });
  },
  
  // Mock onboarding status response
  mockOnboardingStatusResponse: (status) => {
    global.mockFetch(status);
  },
  
  // Default test user
  testUser: {
    sub: 'auth0|test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
  },
  
  // Default onboarding status
  defaultOnboardingStatus: {
    isComplete: false,
    currentStep: 1,
    hasProfile: false,
    hasWorkspace: false,
  },
  
  // Complete onboarding status
  completeOnboardingStatus: {
    isComplete: true,
    currentStep: 3,
    hasProfile: true,
    hasWorkspace: true,
    profile: {
      id: 'profile-id',
      fullName: 'Test User',
      displayName: 'Test',
    },
    onboarding: {
      id: 'onboarding-id',
      completed: true,
      completedAt: '2023-01-01T00:00:00Z',
      currentStep: 3,
      tutorialProgress: {
        profileSetup: true,
        workspaceIntro: true,
        firstCard: true,
      },
    },
    workspace: {
      id: 'workspace-id',
      name: 'Test Workspace',
      privacy: 'private',
    },
  },
};

// Declare global types for TypeScript
declare global {
  function restoreConsole(): void;
  function mockConsole(): void;
  function mockFetch(response: any, ok?: boolean): void;
  function mockFetchError(error: any): void;
  var testHelpers: {
    mockAuthUser: (user?: any, isLoading?: boolean, error?: any) => void;
    mockOnboardingStatusResponse: (status: any) => void;
    testUser: any;
    defaultOnboardingStatus: any;
    completeOnboardingStatus: any;
  };
}