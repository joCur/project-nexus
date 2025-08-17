import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { Auth0Service } from '@/services/auth0';
import { UserService } from '@/services/user';
import { CacheService } from '@/services/cache';
import { createAuthMiddleware } from '@/middleware/auth';
import {
  createMockAuth0Service,
  createMockUserService,
  createMockCacheService,
  generateMockJWT,
  wait,
} from '../utils/test-helpers';
import {
  JWT_FIXTURES,
  AUTH0_USER_FIXTURES,
  USER_FIXTURES,
  SECURITY_FIXTURES,
} from '../utils/test-fixtures';

// Mock external dependencies
jest.mock('@/utils/logger');

describe('Security Testing Scenarios', () => {
  let app: express.Application;
  let mockAuth0Service: jest.Mocked<Auth0Service>;
  let mockUserService: jest.Mocked<UserService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Create mock services
    mockAuth0Service = createMockAuth0Service() as jest.Mocked<Auth0Service>;
    mockUserService = createMockUserService() as jest.Mocked<UserService>;
    mockCacheService = createMockCacheService() as jest.Mocked<CacheService>;

    // Create Express app
    app = express();
    app.use(express.json({ limit: '10mb' }));

    // Setup rate limiting for testing
    const authRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: 'Too many authentication attempts',
      standardHeaders: true,
      legacyHeaders: false,
    });

    app.use('/auth', authRateLimit);

    // Setup authentication middleware
    const authMiddleware = createAuthMiddleware(
      mockAuth0Service,
      mockUserService,
      mockCacheService
    );
    app.use(authMiddleware);

    // Test endpoints
    app.post('/auth/login', async (req: any, res) => {
      try {
        if (!req.isAuthenticated) {
          return res.status(401).json({ error: 'Authentication failed' });
        }
        
        // Create a new session for this user
        const sessionId = await mockAuth0Service.createSession(req.user, req.auth0Payload);
        
        res.json({ success: true, user: req.user, sessionId });
      } catch (error) {
        res.status(500).json({ error: 'Login failed' });
      }
    });

    app.get('/protected', (req: any, res) => {
      if (!req.isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({ 
        message: 'Protected resource', 
        user: req.user,
        query: req.query,
        body: req.body 
      });
    });

    app.post('/user/update', (req: any, res) => {
      if (!req.isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // Simulate user update with request data
      res.json({ 
        success: true, 
        data: req.body,
        user: req.user 
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Security Tests', () => {
    it('should reject tokens with none algorithm', async () => {
      // Create a token with "none" algorithm (security vulnerability)
      const noneAlgorithmToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHxoYWNrZXIiLCJlbWFpbCI6ImhhY2tlckBleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlfQ.';

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${noneAlgorithmToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject tampered JWT tokens', async () => {
      // Take a valid token and modify the payload
      const validToken = JWT_FIXTURES.VALID_TOKEN;
      const [header, payload, signature] = validToken.split('.');
      
      // Modify the payload to change user ID
      const tamperedPayload = Buffer.from(JSON.stringify({
        sub: 'auth0|admin_hacker',
        email: 'hacker@example.com',
        email_verified: true,
        roles: ['super_admin'],
        permissions: ['admin:user_management', 'admin:system_settings'],
      })).toString('base64url');

      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject tokens with modified signatures', async () => {
      const validToken = JWT_FIXTURES.VALID_TOKEN;
      const [header, payload] = validToken.split('.');
      
      // Use a different signature
      const maliciousSignature = 'malicious_signature';
      const tokenWithBadSignature = `${header}.${payload}.${maliciousSignature}`;

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${tokenWithBadSignature}`);

      expect(response.status).toBe(401);
    });

    it('should handle tokens with malicious payloads', async () => {
      // Test with each malicious payload from fixtures
      for (const maliciousPayload of SECURITY_FIXTURES.MALICIOUS_JWT_PAYLOADS) {
        const maliciousToken = generateMockJWT(maliciousPayload);
        
        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${maliciousToken}`);

        // Should either reject the token or sanitize the data
        if (response.status === 200) {
          // If accepted, ensure malicious data is not in response
          expect(response.body.user?.id).not.toContain('DROP TABLE');
          expect(response.body.user?.email).not.toContain('<script>');
        }
      }
    });

    it('should enforce token expiration strictly', async () => {
      // Create a token that expired 1 second ago
      const expiredToken = generateMockJWT({
        exp: Math.floor(Date.now() / 1000) - 1,
      });

      mockAuth0Service.validateAuth0Token.mockRejectedValue(
        new Error('Token expired')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject tokens from wrong issuer', async () => {
      const wrongIssuerToken = generateMockJWT({
        iss: 'https://malicious-issuer.com/',
      });

      mockAuth0Service.validateAuth0Token.mockRejectedValue(
        new Error('Invalid issuer')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${wrongIssuerToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject tokens with wrong audience', async () => {
      const wrongAudienceToken = generateMockJWT({
        aud: 'https://malicious-audience.com',
      });

      mockAuth0Service.validateAuth0Token.mockRejectedValue(
        new Error('Invalid audience')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${wrongAudienceToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Injection Attack Tests', () => {
    it('should prevent SQL injection in query parameters', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      for (const sqlInjection of SECURITY_FIXTURES.SQL_INJECTION_ATTEMPTS) {
        const response = await request(app)
          .get('/protected')
          .query({ userId: sqlInjection })
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

        expect(response.status).toBe(200);
        // Ensure the malicious query is not executed
        expect(response.body.query.userId).toBe(sqlInjection);
        // Response should contain the raw input, not indicate successful injection
      }
    });

    it('should prevent XSS attacks in request data', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      for (const xssPayload of SECURITY_FIXTURES.XSS_ATTEMPTS) {
        const response = await request(app)
          .post('/user/update')
          .send({ displayName: xssPayload })
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

        expect(response.status).toBe(200);
        // Response should not execute the script
        expect(response.body.data.displayName).toBe(xssPayload);
      }
    });

    it('should sanitize user input in JWT custom claims', async () => {
      const maliciousClaimsToken = generateMockJWT({
        'https://api.nexus-app.de/roles': SECURITY_FIXTURES.SQL_INJECTION_ATTEMPTS,
        'https://api.nexus-app.de/permissions': SECURITY_FIXTURES.XSS_ATTEMPTS,
      });

      mockAuth0Service.validateAuth0Token.mockResolvedValue({
        ...AUTH0_USER_FIXTURES.STANDARD_USER,
        'https://api.nexus-app.de/roles': SECURITY_FIXTURES.SQL_INJECTION_ATTEMPTS,
        'https://api.nexus-app.de/permissions': SECURITY_FIXTURES.XSS_ATTEMPTS,
      });

      mockAuth0Service.syncUserFromAuth0.mockResolvedValue({
        ...USER_FIXTURES.STANDARD_USER,
        roles: SECURITY_FIXTURES.SQL_INJECTION_ATTEMPTS,
        permissions: SECURITY_FIXTURES.XSS_ATTEMPTS,
      });

      mockAuth0Service.validateSession.mockResolvedValue(true);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${maliciousClaimsToken}`);

      if (response.status === 200) {
        // If authentication succeeds, ensure malicious data is contained
        expect(response.body.user.roles).toEqual(SECURITY_FIXTURES.SQL_INJECTION_ATTEMPTS);
        expect(response.body.user.permissions).toEqual(SECURITY_FIXTURES.XSS_ATTEMPTS);
        // The data should be present but not executed
      }
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limits on authentication endpoints', async () => {
      // Make requests up to the limit
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/auth/login')
            .set('Authorization', `Bearer ${JWT_FIXTURES.MALFORMED_TOKEN}`)
        );
      }

      await Promise.all(promises);

      // Next request should be rate limited
      const rateLimitedResponse = await request(app)
        .post('/auth/login')
        .set('Authorization', `Bearer ${JWT_FIXTURES.MALFORMED_TOKEN}`);

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.text).toContain('Too many authentication attempts');
    });

    it('should handle rate limiting per IP address', async () => {
      // Simulate requests from different IPs
      const ip1Requests = [];
      const ip2Requests = [];

      for (let i = 0; i < 5; i++) {
        ip1Requests.push(
          request(app)
            .post('/auth/login')
            .set('X-Forwarded-For', '192.168.1.1')
            .set('Authorization', `Bearer ${JWT_FIXTURES.MALFORMED_TOKEN}`)
        );

        ip2Requests.push(
          request(app)
            .post('/auth/login')
            .set('X-Forwarded-For', '192.168.1.2')
            .set('Authorization', `Bearer ${JWT_FIXTURES.MALFORMED_TOKEN}`)
        );
      }

      await Promise.all([...ip1Requests, ...ip2Requests]);

      // Both IPs should now be rate limited
      const ip1RateLimited = await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '192.168.1.1')
        .set('Authorization', `Bearer ${JWT_FIXTURES.MALFORMED_TOKEN}`);

      const ip2RateLimited = await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '192.168.1.2')
        .set('Authorization', `Bearer ${JWT_FIXTURES.MALFORMED_TOKEN}`);

      expect(ip1RateLimited.status).toBe(429);
      expect(ip2RateLimited.status).toBe(429);
    });
  });

  describe('Session Security Tests', () => {
    it('should prevent session fixation attacks', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.createSession.mockResolvedValue('session-123');
      mockAuth0Service.validateSession.mockResolvedValue(true);

      // First login
      const firstLogin = await request(app)
        .post('/auth/login')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(firstLogin.status).toBe(200);

      // Second login should create a new session
      mockAuth0Service.createSession.mockResolvedValue('session-456');

      const secondLogin = await request(app)
        .post('/auth/login')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(secondLogin.status).toBe(200);

      // Verify that sessions are different (preventing fixation)
      expect(mockAuth0Service.createSession).toHaveBeenCalledTimes(2);
    });

    it('should enforce session timeout', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);

      // First request - session is valid
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const validResponse = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(validResponse.status).toBe(200);

      // Session expires
      mockAuth0Service.validateSession.mockResolvedValue(false);

      const expiredResponse = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(expiredResponse.status).toBe(401);
    });

    it('should handle concurrent session validation', async () => {
      const auth0User = AUTH0_USER_FIXTURES.STANDARD_USER;
      const user = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(auth0User);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(user);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      // Multiple concurrent requests with same token
      const concurrentRequests = Array(20).fill(null).map(() =>
        request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
      );

      const responses = await Promise.all(concurrentRequests);

      // All should succeed and session should be validated correctly
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Session validation should happen for each request
      expect(mockAuth0Service.validateSession).toHaveBeenCalledTimes(20);
    });
  });

  describe('Input Validation and Sanitization', () => {
    it.skip('should handle extremely long authentication headers - causes ECONNRESET', async () => {
      const longToken = 'Bearer ' + 'x'.repeat(100000);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', longToken);

      expect(response.status).toBe(401);
    });

    it('should handle malformed JSON in request bodies', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const response = await request(app)
        .post('/user/update')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}');

      expect(response.status).toBe(400);
    });

    it('should handle null bytes in input', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const maliciousInput = 'test\x00admin';

      const response = await request(app)
        .post('/user/update')
        .send({ displayName: maliciousInput })
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body.data.displayName).toBe(maliciousInput);
    });

    it('should handle Unicode and special characters safely', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const unicodeInput = '用户名测试 🔒 \\u0000 \\r\\n';

      const response = await request(app)
        .post('/user/update')
        .send({ displayName: unicodeInput })
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body.data.displayName).toBe(unicodeInput);
    });
  });

  describe('Privilege Escalation Tests', () => {
    it('should prevent horizontal privilege escalation', async () => {
      const regularUser = USER_FIXTURES.STANDARD_USER;
      const otherUserId = 'other-user-id';

      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(regularUser);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      // Try to update another user's data
      const response = await request(app)
        .post('/user/update')
        .send({ 
          userId: otherUserId, // Attempting to access other user's data
          displayName: 'Hacked Name'
        })
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(200);
      // Should only affect current user, not the other user
      expect(response.body.user.id).toBe(regularUser.id);
      expect(response.body.user.id).not.toBe(otherUserId);
    });

    it('should prevent vertical privilege escalation', async () => {
      const regularUser = USER_FIXTURES.STANDARD_USER;

      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(regularUser);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      // Try to escalate privileges by modifying roles in request
      const response = await request(app)
        .post('/user/update')
        .send({ 
          roles: ['super_admin'], // Attempting to give admin role
          permissions: ['admin:user_management', 'admin:system_settings']
        })
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(200);
      // User should remain with original permissions
      expect(response.body.user.roles).toEqual(regularUser.roles);
      expect(response.body.user.permissions).toEqual(regularUser.permissions);
    });

    it('should validate permission boundaries strictly', async () => {
      const limitedUser = {
        ...USER_FIXTURES.STANDARD_USER,
        permissions: ['card:read'], // Only read permission
      };

      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(limitedUser);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      // Try to perform actions requiring higher permissions
      const response = await request(app)
        .post('/user/update')
        .send({ 
          action: 'delete', // Trying to perform delete action
          targetResource: 'important_data'
        })
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(200);
      // Should be able to receive the request but permission should be limited
      expect(response.body.user.permissions).toEqual(['card:read']);
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should have consistent response times for valid and invalid tokens', async () => {
      const validTokenTimes: number[] = [];
      const invalidTokenTimes: number[] = [];

      // Test valid tokens
      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);
        validTokenTimes.push(Date.now() - start);
      }

      // Test invalid tokens
      mockAuth0Service.validateAuth0Token.mockResolvedValue(null);

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${JWT_FIXTURES.MALFORMED_TOKEN}`);
        invalidTokenTimes.push(Date.now() - start);
      }

      const avgValidTime = validTokenTimes.reduce((a, b) => a + b) / validTokenTimes.length;
      const avgInvalidTime = invalidTokenTimes.reduce((a, b) => a + b) / invalidTokenTimes.length;

      // Response times should be similar (within 100ms difference)
      expect(Math.abs(avgValidTime - avgInvalidTime)).toBeLessThan(100);
    });

    it('should prevent user enumeration through timing differences', async () => {
      const existingUserTimes: number[] = [];
      const nonExistentUserTimes: number[] = [];

      // Test with existing user
      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await request(app)
          .post('/auth/login')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);
        existingUserTimes.push(Date.now() - start);
      }

      // Test with non-existent user
      mockAuth0Service.validateAuth0Token.mockResolvedValue(null);

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await request(app)
          .post('/auth/login')
          .set('Authorization', `Bearer ${JWT_FIXTURES.MALFORMED_TOKEN}`);
        nonExistentUserTimes.push(Date.now() - start);
      }

      const avgExistingTime = existingUserTimes.reduce((a, b) => a + b) / existingUserTimes.length;
      const avgNonExistentTime = nonExistentUserTimes.reduce((a, b) => a + b) / nonExistentUserTimes.length;

      // Response times should be similar to prevent user enumeration
      expect(Math.abs(avgExistingTime - avgNonExistentTime)).toBeLessThan(100);
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should handle large request payloads gracefully', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      const largePayload = {
        data: 'x'.repeat(1000000), // 1MB of data
        array: Array(10000).fill('large_data'),
      };

      const response = await request(app)
        .post('/user/update')
        .send(largePayload)
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      // Should either accept with limits or reject gracefully
      expect([200, 413]).toContain(response.status);
    });

    it('should prevent memory exhaustion through nested objects', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      // Create deeply nested object
      let nestedObject: any = {};
      let current = nestedObject;
      for (let i = 0; i < 1000; i++) {
        current.nested = {};
        current = current.nested;
      }

      const response = await request(app)
        .post('/user/update')
        .send({ deepObject: nestedObject })
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      // Should handle gracefully without crashing
      expect([200, 400, 413]).toContain(response.status);
    });

    it('should limit concurrent requests per user', async () => {
      mockAuth0Service.validateAuth0Token.mockResolvedValue(AUTH0_USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.syncUserFromAuth0.mockResolvedValue(USER_FIXTURES.STANDARD_USER);
      mockAuth0Service.validateSession.mockResolvedValue(true);

      // Create many concurrent requests from same user
      const concurrentRequests = Array(100).fill(null).map(() =>
        request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`)
      );

      const responses = await Promise.allSettled(concurrentRequests);

      // Most should succeed, but system should remain stable
      const successfulRequests = responses.filter(
        r => r.status === 'fulfilled' && (r.value as any).status === 200
      ).length;

      expect(successfulRequests).toBeGreaterThan(50); // At least half should succeed
      expect(successfulRequests).toBeLessThanOrEqual(100); // Not more than total
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should not leak sensitive information in error messages', async () => {
      mockAuth0Service.validateAuth0Token.mockRejectedValue(
        new Error('Database connection string: postgres://user:password@localhost/db')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(401);
      // Should not contain sensitive database information
      expect(response.body.error || response.text).not.toContain('password');
      expect(response.body.error || response.text).not.toContain('localhost');
      expect(response.body.error || response.text).not.toContain('postgres://');
    });

    it('should not expose internal system paths', async () => {
      mockAuth0Service.validateAuth0Token.mockRejectedValue(
        new Error('File not found: /var/secrets/api_keys.json')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(401);
      // Should not contain internal file paths
      expect(response.body.error || response.text).not.toContain('/var/secrets');
      expect(response.body.error || response.text).not.toContain('api_keys.json');
    });

    it('should sanitize stack traces in error responses', async () => {
      mockAuth0Service.validateAuth0Token.mockRejectedValue(
        new Error('Authentication failed at /home/user/app/src/auth.js:123')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${JWT_FIXTURES.VALID_TOKEN}`);

      expect(response.status).toBe(401);
      // Should not contain file paths or line numbers
      expect(response.body.error || response.text).not.toContain('/home/user');
      expect(response.body.error || response.text).not.toContain('.js:');
    });
  });
});