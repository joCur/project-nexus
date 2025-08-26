import '@testing-library/jest-dom';

// Create reusable router mock
const mockRouter = {
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

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return mockRouter;
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Make router mock available globally
global.mockRouter = mockRouter;

// Mock Konva and related canvas functionality
jest.mock('konva', () => ({
  enableTrace: true,
  Layer: class MockLayer {
    listening() { return this; }
    hitGraphEnabled() { return this; }
  },
  Stage: class MockStage {
    container() { 
      return {
        setAttribute: jest.fn(),
        style: {}
      };
    }
    cache() { return this; }
    getStage() { return this; }
    setAttr() { return this; }
    children = [];
    perfectDrawEnabled() { return this; }
    listening() { return this; }
    hitGraphEnabled() { return this; }
    getPointerPosition() { return { x: 100, y: 100 }; }
  },
}));

// Mock canvas calculations utility
jest.mock('@/utils/canvas-calculations', () => ({
  getLevelOfDetail: jest.fn(() => 'medium'),
  canvasToScreen: jest.fn((pos) => pos),
  screenToCanvas: jest.fn((pos) => pos),
  distance: jest.fn(() => 0),
  angle: jest.fn(() => 0),
  containsPoint: jest.fn(() => true),
  intersectsBounds: jest.fn(() => true),
  expandBounds: jest.fn((bounds) => bounds),
  getVisibleBounds: jest.fn(() => ({ minX: 0, minY: 0, maxX: 100, maxY: 100 })),
  cullEntities: jest.fn((entities) => entities),
  shouldUseSimplifiedRendering: jest.fn(() => false),
  easeOutCubic: jest.fn((t) => t),
  interpolatePosition: jest.fn((from) => from),
  interpolateZoom: jest.fn((from) => from),
  calculateContentBounds: jest.fn(() => ({ minX: 0, minY: 0, maxX: 100, maxY: 100 })),
  fitBoundsToViewport: jest.fn(() => ({ position: { x: 0, y: 0 }, zoom: 1 })),
}));

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
  },
  writable: true,
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock localStorage and sessionStorage
const mockStorage = () => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
};

Object.defineProperty(window, 'localStorage', {
  value: mockStorage(),
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: mockStorage(),
  writable: true,
});

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
global.fetch = jest.fn();

// Initialize with default implementation
global.fetch.mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Setup fetch mock helper
global.mockFetch = (response, ok = true) => {
  global.fetch.mockImplementation(() =>
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
  window.localStorage.clear();
  window.sessionStorage.clear();
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

// Helper to reset location (for backward compatibility)
global.resetLocation = () => {
  // No-op since we're not mocking location globally anymore
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

