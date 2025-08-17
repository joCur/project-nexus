# Testing Guide for Project Nexus Onboarding Feature

This document provides comprehensive testing instructions for the v1 simple onboarding feature implementation. The test suite covers backend services, frontend components, API integration, and end-to-end user journeys.

## Table of Contents

- [Overview](#overview)
- [Test Architecture](#test-architecture)
- [Setup Instructions](#setup-instructions)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Testing Scenarios](#testing-scenarios)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)

## Overview

The onboarding feature test suite validates:

- **Backend Services**: Unit and integration tests for services, resolvers, and API endpoints
- **Frontend Components**: Component tests for UI interactions and state management
- **API Integration**: Tests for frontend-backend communication
- **End-to-End Flows**: Complete user journey testing
- **Authentication**: Auth0 integration and development mode authentication
- **Database**: Schema validation and enum handling

## Test Architecture

### Backend Testing

```
backend/src/__tests__/
├── integration/           # Integration tests
│   ├── onboarding-resolvers.test.ts
│   ├── onboarding-workflow.test.ts
│   └── onboarding-api.test.ts
├── unit/                  # Unit tests
│   ├── services/
│   │   ├── onboarding.test.ts
│   │   ├── userProfile.test.ts
│   │   └── workspace.test.ts
│   └── middleware/
│       └── auth.test.ts
├── security/              # Security tests
│   └── security.test.ts
├── setup.ts              # Test configuration
└── utils/                # Test utilities
    ├── test-helpers.ts
    ├── test-fixtures.ts
    └── mock-auth0.ts
```

### Frontend Testing

```
clients/web/
├── components/onboarding/v1/__tests__/
│   ├── OnboardingFlow.test.tsx
│   └── steps/__tests__/
│       └── ProfileSetupStep.test.tsx
├── hooks/__tests__/
│   ├── use-onboarding-status.test.ts
│   └── use-auth.test.ts
├── jest.config.js        # Jest configuration
├── jest.setup.js         # Test setup
└── __mocks__/           # Mock files
    └── fileMock.js
```

## Setup Instructions

### Prerequisites

1. **Docker Environment**: Ensure Docker and Docker Compose are installed
2. **Node.js**: Version 18+ required
3. **Environment Variables**: Configure test environment variables

### Backend Setup

1. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure Test Environment**:
   ```bash
   # Create .env.test file in project root
   NODE_ENV=test
   POSTGRES_DB=nexus_test
   REDIS_DB=1
   AUTH0_DOMAIN=test.auth0.com
   AUTH0_AUDIENCE=https://test-api.nexus-app.de
   JWT_SECRET=test-jwt-secret-key-for-testing-purposes-only
   ```

3. **Setup Test Database**:
   ```bash
   # Start test database
   docker-compose -f docker-compose.yml -f docker-compose.test.yml up -d postgres redis
   
   # Run migrations
   npm run db:migrate:test
   ```

### Frontend Setup

1. **Install Dependencies**:
   ```bash
   cd clients/web
   npm install
   ```

2. **Install Additional Test Dependencies**:
   ```bash
   npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom
   ```

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security

# Run with coverage
npm run test:coverage

# Run specific test files
npm test -- onboarding.test.ts
npm test -- --testPathPattern=integration

# Watch mode for development
npm run test:watch
```

### Frontend Tests

```bash
cd clients/web

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test files
npm test -- ProfileSetupStep.test.tsx
npm test -- --testPathPattern=hooks

# Watch mode for development
npm run test:watch
```

### Docker Environment Tests

```bash
# Run tests in Docker environment
docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm backend npm test
docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm web npm test
```

## Test Coverage

### Coverage Requirements

- **Unit Tests**: Minimum 90% line coverage
- **Integration Tests**: All API endpoints and GraphQL resolvers
- **Component Tests**: All user interactions and edge cases
- **E2E Tests**: Critical user journeys

### Coverage Reports

```bash
# Backend coverage
cd backend && npm run test:coverage
open coverage/lcov-report/index.html

# Frontend coverage
cd clients/web && npm run test:coverage
open coverage/lcov-report/index.html
```

### Current Coverage Targets

| Component | Target | Current |
|-----------|--------|---------|
| OnboardingService | 95% | ✅ |
| UserProfileService | 95% | ✅ |
| WorkspaceService | 95% | ✅ |
| GraphQL Resolvers | 90% | ✅ |
| Frontend Components | 85% | ✅ |
| Frontend Hooks | 90% | ✅ |

## Testing Scenarios

### 1. Complete Onboarding Flow

**Scenario**: User completes entire onboarding process successfully

**Steps**:
1. User lands on onboarding page
2. Completes profile setup with valid data
3. Progresses through workspace introduction
4. Completes onboarding and redirects to workspace

**Validation**:
- Profile data saved to database
- Workspace created with correct settings
- Onboarding marked as complete
- Proper redirect to workspace

### 2. Error Handling

**Scenario**: Test various error conditions

**Test Cases**:
- Network errors during API calls
- Invalid form data submission
- Authentication failures
- Database connection issues
- Concurrent user actions

### 3. Authentication Integration

**Scenario**: Auth0 integration and development mode

**Test Cases**:
- Valid Auth0 token authentication
- Expired token handling
- Development mode authentication
- Permission checking
- Role validation

### 4. Enum Case Conversion

**Scenario**: Test uppercase/lowercase enum handling

**Test Cases**:
- Frontend sends uppercase enums (CREATIVE, PRIVATE)
- Backend stores lowercase enums (creative, private)
- Proper conversion in both directions
- GraphQL schema compatibility

### 5. Server-Side State Management

**Scenario**: Cross-device consistency

**Test Cases**:
- Onboarding state persists across sessions
- No localStorage dependency
- Proper state synchronization
- Resume onboarding from different device

### 6. Form Validation

**Scenario**: Client and server-side validation

**Test Cases**:
- Required field validation
- Format validation (email, names)
- Length limits
- Special character handling
- Whitespace trimming

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Reset test database
docker-compose down -v
docker-compose -f docker-compose.test.yml up -d postgres
npm run db:migrate:test
```

#### 2. Auth0 Mock Issues

```bash
# Clear Jest cache
npx jest --clearCache

# Restart test with fresh mocks
npm test -- --no-cache
```

#### 3. Frontend Test Timeouts

```bash
# Increase timeout in jest.config.js
testTimeout: 30000

# Check for async/await issues
# Ensure all async operations are properly awaited
```

#### 4. Docker Permission Issues

```bash
# Fix Docker permissions
sudo chown -R $USER:$USER ./data
docker-compose down && docker-compose up -d
```

### Debug Test Failures

#### Backend Tests

```bash
# Enable debug logging
DEBUG=test npm test

# Run single test with verbose output
npm test -- --verbose onboarding.test.ts

# Use debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

#### Frontend Tests

```bash
# Debug React Testing Library queries
import { screen } from '@testing-library/react';
screen.debug(); // Prints current DOM

# Enable verbose logging
npm test -- --verbose --no-coverage
```

### Performance Issues

```bash
# Run tests in parallel
npm test -- --maxWorkers=4

# Run only changed files
npm test -- --changedSince=main

# Skip expensive tests during development
npm test -- --testPathIgnorePatterns=integration
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Onboarding Feature

on:
  pull_request:
    paths:
      - 'backend/src/services/onboarding*'
      - 'backend/src/resolvers/onboarding*'
      - 'clients/web/components/onboarding/**'
      - 'clients/web/hooks/use-onboarding*'

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: nexus_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: cd backend && npm ci

      - name: Run tests
        run: cd backend && npm run test:coverage
        env:
          NODE_ENV: test
          POSTGRES_URL: postgres://postgres:test@localhost:5432/nexus_test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: backend/coverage/lcov.info

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: clients/web/package-lock.json

      - name: Install dependencies
        run: cd clients/web && npm ci

      - name: Run tests
        run: cd clients/web && npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: clients/web/coverage/lcov.info
```

### Pre-commit Hooks

```bash
# Install husky for git hooks
npm install --save-dev husky

# Add pre-commit test hook
npx husky add .husky/pre-commit "npm run test:changed"
```

### Test Data Management

#### Fixtures

```typescript
// backend/src/__tests__/utils/test-fixtures.ts
export const createTestOnboardingData = () => ({
  profile: {
    fullName: 'Test User',
    displayName: 'Test',
    timezone: 'UTC',
    role: 'creative',
    preferences: {
      workspaceName: 'Test Workspace',
      privacy: 'private',
      notifications: true,
    },
  },
  // ... more test data
});
```

#### Database Seeding

```bash
# Seed test database
npm run db:seed:test

# Reset test data
npm run db:reset:test
```

## Best Practices

### Test Organization

1. **Arrange-Act-Assert Pattern**: Structure tests clearly
2. **Descriptive Names**: Use clear, descriptive test names
3. **Single Responsibility**: Each test should test one thing
4. **Independent Tests**: Tests should not depend on each other
5. **Cleanup**: Proper cleanup after each test

### Mocking Strategy

1. **Mock External Dependencies**: Auth0, databases, APIs
2. **Avoid Over-mocking**: Mock at boundaries, not internals
3. **Reset Mocks**: Clear mocks between tests
4. **Realistic Mocks**: Mocks should behave like real implementations

### Performance

1. **Parallel Execution**: Run tests in parallel when possible
2. **Test Isolation**: Use beforeEach/afterEach for setup/cleanup
3. **Resource Management**: Close connections and clean up resources
4. **Selective Testing**: Run only relevant tests during development

### Maintenance

1. **Regular Updates**: Keep test dependencies up to date
2. **Coverage Monitoring**: Monitor and maintain coverage levels
3. **Documentation**: Keep test documentation current
4. **Refactoring**: Refactor tests when code changes

---

## Summary

This comprehensive test suite ensures the onboarding feature works correctly across all layers of the application. The tests validate both the technical implementation and user experience, providing confidence in the feature's reliability and maintainability.

For additional support or questions about testing, refer to the project's main documentation or contact the development team.