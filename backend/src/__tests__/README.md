# Backend Authentication Test Suite

This comprehensive test suite validates the security, functionality, and performance of the Project Nexus backend authentication system. The tests cover Auth0 integration, JWT validation, session management, GraphQL resolvers, and security scenarios.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Categories](#test-categories)
- [Test Coverage](#test-coverage)
- [Security Testing](#security-testing)
- [Performance Testing](#performance-testing)
- [Contributing](#contributing)

## Overview

The test suite is designed to ensure the authentication system is:
- **Secure**: Protected against common security vulnerabilities
- **Reliable**: Functions correctly under various conditions
- **Performant**: Meets response time and throughput requirements
- **Maintainable**: Easy to understand and modify

### Technology Stack

- **Testing Framework**: Jest
- **HTTP Testing**: Supertest
- **Mocking**: Jest mocks with custom mock factories
- **Coverage**: Istanbul (built into Jest)
- **TypeScript**: Full TypeScript support

## Test Structure

```
src/__tests__/
├── setup.ts                 # Global test configuration
├── utils/                   # Test utilities and helpers
│   ├── test-helpers.ts      # Mock factories and utilities
│   ├── mock-auth0.ts        # Auth0 service mocking
│   └── test-fixtures.ts     # Test data fixtures
├── unit/                    # Unit tests
│   ├── services/
│   │   ├── auth0.test.ts    # Auth0Service tests
│   │   ├── user.test.ts     # UserService tests
│   │   └── cache.test.ts    # CacheService tests
│   └── middleware/
│       └── auth.test.ts     # Authentication middleware tests
├── integration/             # Integration tests
│   ├── graphql-auth.test.ts # GraphQL resolver integration
│   └── auth-flow.test.ts    # End-to-end authentication flows
└── security/                # Security-focused tests
    └── security.test.ts     # Security vulnerability tests
```

## Running Tests

### Prerequisites

1. Node.js 18+ and npm 9+
2. Environment variables configured (see `.env.test`)
3. Dependencies installed: `npm install`

### Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test categories
npm test -- --testPathPattern=unit       # Unit tests only
npm test -- --testPathPattern=integration # Integration tests only
npm test -- --testPathPattern=security    # Security tests only

# Run specific test files
npm test -- auth0.test.ts               # Auth0Service tests
npm test -- --testNamePattern="JWT"     # Tests with "JWT" in name
```

### Environment Setup

Create a `.env.test` file in the backend root directory:

```env
NODE_ENV=test
POSTGRES_DB=nexus_test
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
AUTH0_DOMAIN=test.auth0.com
AUTH0_AUDIENCE=https://test-api.nexus-app.de
JWT_SECRET=test-jwt-secret-key-for-testing-purposes-only-must-be-32-chars
# ... (see .env.test for complete configuration)
```

## Test Categories

### Unit Tests

**Purpose**: Test individual components in isolation

#### Auth0Service (`unit/services/auth0.test.ts`)
- JWT token validation
- User synchronization from Auth0
- Session creation and management
- Permission caching
- Health check functionality
- Error handling scenarios

#### UserService (`unit/services/user.test.ts`)
- User CRUD operations
- Database interactions
- Input validation
- Data mapping
- Pagination and search

#### CacheService (`unit/services/cache.test.ts`)
- Redis operations (get, set, delete)
- TTL and expiration handling
- Bulk operations
- Error resilience
- Performance under load

#### Authentication Middleware (`unit/middleware/auth.test.ts`)
- JWT extraction and validation
- Request context setup
- Permission and role checking
- Error handling
- GraphQL directive implementations

### Integration Tests

**Purpose**: Test component interactions and complete workflows

#### GraphQL Authentication (`integration/graphql-auth.test.ts`)
- Authentication resolvers
- Protected query/mutation execution
- Permission-based access control
- Session management through GraphQL
- Error handling in GraphQL context

#### Authentication Flow (`integration/auth-flow.test.ts`)
- Complete login/logout workflows
- Session management across requests
- Protected resource access
- Error scenarios and edge cases
- Performance under concurrent load

### Security Tests

**Purpose**: Validate security measures and prevent vulnerabilities

#### Security Testing (`security/security.test.ts`)
- JWT security (tampering, algorithm confusion)
- Injection attack prevention (SQL, XSS)
- Rate limiting enforcement
- Session security
- Input validation and sanitization
- Privilege escalation prevention
- Timing attack mitigation
- Information disclosure prevention

## Test Coverage

The test suite aims for comprehensive coverage:

### Coverage Targets
- **Overall**: >90%
- **Critical paths**: 100% (authentication, authorization)
- **Services**: >95%
- **Middleware**: >95%
- **Resolvers**: >90%

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

### Coverage Areas

- ✅ **Auth0Service**: JWT validation, user sync, session management
- ✅ **UserService**: CRUD operations, validation, error handling
- ✅ **CacheService**: Redis operations, error resilience
- ✅ **Authentication Middleware**: Token processing, context setup
- ✅ **GraphQL Resolvers**: All authentication-related resolvers
- ✅ **Error Scenarios**: Invalid tokens, expired sessions, network failures
- ✅ **Security Scenarios**: Attack prevention, input validation

## Security Testing

### Vulnerability Categories Tested

1. **Authentication Bypass**
   - Token tampering
   - Algorithm confusion attacks
   - Signature verification bypass

2. **Injection Attacks**
   - SQL injection in parameters
   - XSS in user input
   - Command injection

3. **Session Security**
   - Session fixation
   - Session hijacking
   - Concurrent session handling

4. **Rate Limiting**
   - Brute force protection
   - DDoS prevention
   - Per-IP rate limiting

5. **Information Disclosure**
   - Error message sanitization
   - Stack trace prevention
   - Sensitive data exposure

6. **Privilege Escalation**
   - Horizontal privilege escalation
   - Vertical privilege escalation
   - Permission boundary validation

### Security Test Examples

```typescript
// JWT tampering test
it('should reject tampered JWT tokens', async () => {
  const validToken = JWT_FIXTURES.VALID_TOKEN;
  const [header, payload, signature] = validToken.split('.');
  
  // Modify payload to escalate privileges
  const tamperedPayload = Buffer.from(JSON.stringify({
    sub: 'auth0|admin_hacker',
    roles: ['super_admin']
  })).toString('base64url');

  const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
  // Test should verify token is rejected
});

// Rate limiting test
it('should enforce rate limits', async () => {
  // Make multiple requests up to limit
  // Verify subsequent requests are blocked
});
```

## Performance Testing

### Performance Criteria

- **Token Validation**: <50ms average response time
- **User Sync**: <100ms average response time
- **Session Operations**: <25ms average response time
- **Concurrent Requests**: Handle 100+ concurrent authentications
- **Memory Usage**: Stable under sustained load

### Performance Test Examples

```typescript
// Concurrent authentication test
it('should handle high-frequency authentication', async () => {
  const requests = Array(100).fill(null).map(() => 
    authenticateUser(validToken)
  );
  
  const startTime = Date.now();
  const results = await Promise.all(requests);
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(5000); // 5 seconds
  expect(results.every(r => r.success)).toBe(true);
});
```

## Test Utilities

### Mock Factories

```typescript
// Generate test JWT tokens
const validToken = generateMockJWT({
  sub: 'auth0|test_user',
  email: 'test@example.com',
  roles: ['user']
});

// Create mock users
const testUser = createMockUser({
  email: 'test@example.com',
  permissions: ['card:read', 'workspace:read']
});

// Create mock services
const mockAuth0Service = createMockAuth0Service();
```

### Test Fixtures

Predefined test data for consistent testing:

```typescript
// JWT tokens for different scenarios
JWT_FIXTURES.VALID_TOKEN
JWT_FIXTURES.EXPIRED_TOKEN
JWT_FIXTURES.MALFORMED_TOKEN
JWT_FIXTURES.ADMIN_TOKEN

// User data
USER_FIXTURES.STANDARD_USER
USER_FIXTURES.ADMIN_USER
USER_FIXTURES.WORKSPACE_OWNER

// Session data
SESSION_FIXTURES.ACTIVE_SESSION
SESSION_FIXTURES.EXPIRED_SESSION
```

## Best Practices

### Writing Tests

1. **Descriptive Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Follow AAA pattern
3. **Isolation**: Each test should be independent
4. **Mock External Dependencies**: Don't call real Auth0 APIs
5. **Test Edge Cases**: Include error scenarios and boundary conditions

### Test Organization

1. **Group Related Tests**: Use `describe` blocks logically
2. **Setup and Teardown**: Use `beforeEach`/`afterEach` for cleanup
3. **Shared Utilities**: Extract common test logic
4. **Documentation**: Comment complex test scenarios

### Error Testing

```typescript
// Test specific error types
await expect(auth0Service.validateToken(invalidToken))
  .rejects.toThrow(InvalidTokenError);

// Test error handling
const result = await service.operation();
expect(result.success).toBe(false);
expect(result.error).toBeDefined();
```

## Debugging Tests

### Common Issues

1. **Mock Not Working**: Ensure mocks are set up before imports
2. **Async Issues**: Always await async operations
3. **Test Isolation**: Clear mocks between tests
4. **Environment**: Check test environment variables

### Debug Commands

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test with debugging
npm test -- --testNamePattern="specific test" --verbose

# Debug with Node.js debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Contributing

### Adding New Tests

1. **Follow Structure**: Place tests in appropriate directories
2. **Use Utilities**: Leverage existing mock factories and fixtures
3. **Update Documentation**: Add test descriptions to this README
4. **Coverage**: Ensure new code is covered by tests

### Test Conventions

```typescript
describe('ComponentName', () => {
  let mockDependency: jest.Mocked<Dependency>;

  beforeEach(() => {
    mockDependency = createMockDependency();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      mockDependency.method.mockResolvedValue(expectedResult);

      // Act
      const result = await component.methodName(input);

      // Assert
      expect(result).toEqual(expectedOutput);
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });

    it('should handle error case', async () => {
      // Test error scenarios
    });
  });
});
```

## Troubleshooting

### Common Test Failures

1. **Auth0 Mock Issues**: Check mock setup in test helpers
2. **Database Errors**: Verify test database configuration
3. **Redis Errors**: Ensure Redis is mocked properly
4. **JWT Validation**: Check test JWT generation

### Performance Issues

1. **Slow Tests**: Check for unmocked external calls
2. **Memory Leaks**: Ensure proper cleanup in afterEach
3. **Timeout Issues**: Increase Jest timeout for integration tests

## Security Considerations

### Test Data Security

- Never use real production tokens in tests
- Use test-specific Auth0 domain and audience
- Sanitize any logged test data
- Keep test environment variables separate

### Mock Security

- Ensure mocks don't accidentally expose real credentials
- Validate that security tests actually test security measures
- Review security test scenarios regularly

---

For questions or issues with the test suite, please refer to the project documentation or contact the development team.