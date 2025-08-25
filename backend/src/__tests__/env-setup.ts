// Critical environment variables must be set before any module imports
// This file runs before Jest imports any modules

process.env.NODE_ENV = 'test';

// Database configuration (required by environment validation)
process.env.POSTGRES_DB = 'nexus_test';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASSWORD = 'test_password';
process.env.POSTGRES_PORT = '5432';

// Auth0 configuration (required by environment validation)
process.env.AUTH0_DOMAIN = 'test.auth0.com';
process.env.AUTH0_CLIENT_ID = 'test_client_id';
process.env.AUTH0_CLIENT_SECRET = 'test_client_secret_for_testing_purposes';
process.env.AUTH0_AUDIENCE = 'https://test-api.nexus-app.de';

// Security configuration (required by environment validation)
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.SESSION_SECRET = 'test-session-secret-key-for-testing-purposes-only';

// Redis configuration
process.env.REDIS_DB = '1';
process.env.REDIS_PORT = '6379';

// Logging configuration
process.env.LOG_LEVEL = 'error'; // Minimize test output