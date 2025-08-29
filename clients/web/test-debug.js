const React = require('react');
const { renderHook, waitFor } = require('@testing-library/react-hooks');

// Mock modules
jest.mock('../../../hooks/use-auth', () => ({
  useAuth: jest.fn(() => ({ user: { sub: 'test' }, isLoading: false, isAuthenticated: true }))
}));

jest.mock('../../../lib/client-cache', () => ({
  ClientCache: {
    get: jest.fn(() => ({ isComplete: true, currentStep: 3 })),
    set: jest.fn()
  }
}));

const { useOnboardingStatus } = require('../../../hooks/use-onboarding-status');

global.fetch = jest.fn(() => Promise.resolve({
  ok: false,
  status: 500
}));

async function test() {
  const { result } = renderHook(() => useOnboardingStatus());
  
  console.log('Initial state:', {
    status: result.current.status,
    error: result.current.error,
    isLoading: result.current.isLoading
  });
  
  await waitFor(() => {
    console.log('After wait:', {
      status: result.current.status,
      error: result.current.error,
      isLoading: result.current.isLoading
    });
  }, { timeout: 2000 });
}

test().catch(console.error);
