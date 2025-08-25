import { config } from 'dotenv';
import path from 'path';
import { CacheService } from '@/services/cache';
import { database } from '@/database/connection';

// Load test environment variables
config({ path: path.resolve(__dirname, '../../../.env.test') });

// Mock external services to prevent real API calls during testing
jest.mock('jwks-rsa');
jest.mock('ioredis');

// Global test setup
beforeAll(async () => {
  // Additional test setup if needed
});

// Clean up after all tests
afterAll(async () => {
  // Close database connections
  if (database) {
    await database.close();
  }
  
  // Close Redis connections
  const cacheService = new CacheService();
  if (cacheService.isConnectedToRedis()) {
    await cacheService.close();
  }
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console logs during tests unless explicitly needed
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
declare global {
  function restoreConsole(): void;
  function mockConsole(): void;
}