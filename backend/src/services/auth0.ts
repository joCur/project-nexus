import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { auth0Config } from '@/config/environment';
import { 
  Auth0User, 
  Auth0TokenPayload, 
  User, 
  CacheKeys,
  SessionConfig 
} from '@/types/auth';
import {
  AuthenticationError,
  InvalidTokenError,
  TokenExpiredError,
  EmailNotVerifiedError,
  Auth0ServiceError,
  ErrorFactory as _ErrorFactory,
} from '@/utils/errors';
import { securityLogger, performanceLogger, createContextLogger } from '@/utils/logger';
import { CacheService } from './cache';
import { UserService } from './user';

/**
 * Auth0 Integration Service
 * Handles JWT validation, user synchronization, and Auth0 Management API operations
 * Based on technical architecture specifications
 * 
 * Migration Guide (NEX-184):
 * - Auth0 now handles ONLY authentication (identity verification) and high-level roles
 * - Permissions are NO LONGER synchronized from Auth0 JWT tokens
 * - Use WorkspaceAuthorizationService for all permission checks instead
 * - Legacy getUserPermissions() and checkPermission() methods removed
 * 
 * @see WorkspaceAuthorizationService for permission management
 * @see NEX-179 for overall migration strategy
 */
export class Auth0Service {
  private readonly jwksClient: jwksClient.JwksClient;
  private readonly logger = createContextLogger({ service: 'Auth0Service' });
  private signingKeyCache = new Map<string, string>();

  constructor(
    private readonly cacheService: CacheService,
    private readonly userService: UserService
  ) {
    // Initialize JWKS client for Auth0 public key retrieval
    this.jwksClient = jwksClient({
      jwksUri: auth0Config.jwksUri,
      requestHeaders: {},
      timeout: 30000,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  /**
   * Validates Auth0 JWT token and returns decoded payload
   * Implements comprehensive security validation as per specifications
   */
  async validateAuth0Token(token: string): Promise<Auth0User | null> {
    const startTime = Date.now();

    try {
      // Decode token header to get key ID
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string' || !decoded.header?.kid) {
        securityLogger.authFailure('Invalid token structure', { token: token.substring(0, 20) + '...' });
        return null;
      }

      // Get signing key from Auth0 JWKS endpoint
      const signingKey = await this.getSigningKey(decoded.header.kid);
      if (!signingKey) {
        securityLogger.authFailure('Failed to retrieve signing key', { kid: decoded.header.kid });
        return null;
      }

      // Verify JWT with Auth0 public key
      const payload = jwt.verify(token, signingKey, {
        audience: auth0Config.audience,
        issuer: auth0Config.issuer,
        algorithms: auth0Config.algorithms as any,
        clockTolerance: 60, // Allow 60 seconds clock skew
      }) as unknown as Auth0TokenPayload;

      // Email verification is handled by Auth0 during authentication
      // If we receive a valid JWT token, Auth0 has already enforced its verification requirements

      // Map to Auth0User interface with clean field names
      const auth0User: Auth0User = {
        sub: payload.sub as string,
        username: payload.username as string,
        name: payload.name as string,
        picture: payload.picture as string,
        updated_at: payload.updated_at as string,
        iss: payload.iss,
        aud: payload.aud,
        iat: payload.iat,
        exp: payload.exp,
        scope: payload.scope,
        
        // Map custom claims to clean field names, with fallbacks to standard fields
        email: payload['https://api.nexus-app.de/email'] as string || payload.email as string,
        roles: payload['https://api.nexus-app.de/roles'] as string[] | undefined,
        userId: payload['https://api.nexus-app.de/user_id'] as string | undefined,
      };

      // Migration Logging: Check for legacy Auth0 permission fields (NEX-184)
      const legacyPermissions = payload['https://api.nexus-app.de/permissions'] as string[] | undefined;
      if (legacyPermissions && legacyPermissions.length > 0) {
        this.logger.warn('Legacy Auth0 permissions detected in JWT token - these are now ignored', {
          auth0UserId: auth0User.sub,
          legacyPermissions,
          migrationNote: 'Permissions now managed by workspace authorization system (NEX-179)',
        });
      }

      const duration = Date.now() - startTime;
      performanceLogger.externalService('Auth0', 'token_validation', duration, true, {
        auth0UserId: auth0User.sub,
      });

      securityLogger.authSuccess(
        auth0User.userId || 'unknown',
        auth0User.sub,
        { 
          email: auth0User.email,
          roles: auth0User.roles,
          tokenExp: new Date(auth0User.exp * 1000).toISOString(),
        }
      );

      return auth0User;

    } catch (error) {
      const duration = Date.now() - startTime;
      performanceLogger.externalService('Auth0', 'token_validation', duration, false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof jwt.JsonWebTokenError) {
        if (error.name === 'TokenExpiredError') {
          securityLogger.authFailure('Token expired', { error: error.message });
          throw new TokenExpiredError();
        }
        securityLogger.authFailure('Invalid token', { error: error.message });
        throw new InvalidTokenError(error.message);
      }

      if (error instanceof EmailNotVerifiedError) {
        throw error;
      }

      this.logger.error('Auth0 token validation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new AuthenticationError('Token validation failed');
    }
  }

  /**
   * Synchronizes user data from Auth0 to local database
   * Implements user sync strategy from technical specifications
   */
  async syncUserFromAuth0(auth0User: Auth0User): Promise<User> {
    const startTime = Date.now();

    try {
      // Debug logging to see what Auth0 user data we're receiving
      this.logger.debug('Auth0 user data received', {
        auth0UserId: auth0User.sub,
        email: auth0User.email,
        username: auth0User.username,
        name: auth0User.name,
        picture: auth0User.picture,
        hasEmail: !!auth0User.email,
        roles: auth0User.roles,
      });

      // Check if user exists in local database
      let user = await this.userService.findByAuth0Id(auth0User.sub);

      // Create a valid fallback email by replacing invalid characters
      const sanitizedAuth0Id = auth0User.sub.replace(/[^a-zA-Z0-9]/g, '-');
      const fallbackEmail = `${sanitizedAuth0Id}@nexus.local`;
      
      const userData = {
        email: auth0User.email || fallbackEmail,
        auth0UserId: auth0User.sub,
        emailVerified: true, // Since we're getting email from custom claims, assume verified
        displayName: auth0User.name || auth0User.username || 'User',
        avatarUrl: auth0User.picture,
        roles: auth0User.roles || [],
        lastLogin: new Date(),
      };

      this.logger.debug('UserData constructed for sync', {
        auth0UserId: userData.auth0UserId,
        email: userData.email,
        hasEmail: !!userData.email,
        emailVerified: userData.emailVerified,
        displayName: userData.displayName,
      });

      if (user) {
        // Update existing user
        user = await this.userService.update(user.id, {
          ...userData,
          lastLogin: new Date(),
        });

        this.logger.info('User synchronized from Auth0', {
          userId: user.id,
          auth0UserId: auth0User.sub,
          action: 'update',
        });
      } else {
        // Create new user
        user = await this.userService.create(userData);

        this.logger.info('New user created from Auth0', {
          userId: user.id,
          auth0UserId: auth0User.sub,
          email: auth0User.email,
          action: 'create',
        });
      }

      // Cache Auth0 user data for performance (handle cache errors gracefully)
      try {

        // Cache Auth0 user data
        await this.cacheService.set(
          CacheKeys.AUTH0_USER(auth0User.sub),
          auth0User,
          30 * 60 * 1000 // 30 minutes cache
        );
      } catch (cacheError) {
        // Log cache error but don't fail the entire operation
        this.logger.error('Failed to cache user data', {
          userId: user.id,
          auth0UserId: auth0User.sub,
          error: cacheError instanceof Error ? cacheError.message : 'Unknown cache error',
        });
      }

      const duration = Date.now() - startTime;
      performanceLogger.dbQuery('user_sync', duration, {
        auth0UserId: auth0User.sub,
        userId: user.id,
      });

      return user;

    } catch (error) {
      const duration = Date.now() - startTime;
      performanceLogger.dbQuery('user_sync', duration, {
        auth0UserId: auth0User.sub,
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });

      this.logger.error('Failed to sync user from Auth0', {
        auth0UserId: auth0User.sub,
        email: auth0User.email,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Auth0ServiceError('user_sync', 'Failed to synchronize user data');
    }
  }

  /**
   * Creates a session for authenticated user
   * Implements session management strategy from specifications
   */
  async createSession(user: User, auth0User: Auth0User): Promise<string> {
    const sessionId = `session_${user.id}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + SessionConfig.ABSOLUTE_DURATION);

    const sessionData = {
      userId: user.id,
      auth0UserId: auth0User.sub,
      email: user.email,
      roles: user.roles,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt,
    };

    try {
      // Store session in Redis with absolute expiration
      await this.cacheService.set(
        CacheKeys.USER_SESSION(user.id),
        sessionData,
        SessionConfig.ABSOLUTE_DURATION
      );
    } catch (error) {
      // Log error but don't throw - session creation should still return a sessionId
      this.logger.error('Failed to store session in cache', {
        userId: user.id,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    securityLogger.sessionEvent('created', user.id, {
      sessionId,
      expiresAt: expiresAt.toISOString(),
      auth0UserId: auth0User.sub,
    });

    return sessionId;
  }

  /**
   * Validates and refreshes user session
   */
  async validateSession(userId: string): Promise<boolean> {
    try {
      const sessionData = await this.cacheService.get(CacheKeys.USER_SESSION(userId));
      if (!sessionData) {
        return false;
      }

      const session = JSON.parse(sessionData) as any;
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      const lastActivity = new Date(session.lastActivity);

      // Check absolute expiration
      if (now >= expiresAt) {
        await this.destroySession(userId);
        securityLogger.sessionEvent('expired', userId, { reason: 'absolute_timeout' });
        return false;
      }

      // Check inactivity timeout
      const inactivityLimit = new Date(lastActivity.getTime() + SessionConfig.INACTIVITY_DURATION);
      if (now >= inactivityLimit) {
        await this.destroySession(userId);
        securityLogger.sessionEvent('expired', userId, { reason: 'inactivity_timeout' });
        return false;
      }

      // Update last activity
      session.lastActivity = now;
      await this.cacheService.set(
        CacheKeys.USER_SESSION(userId),
        session,
        SessionConfig.ABSOLUTE_DURATION
      );

      return true;

    } catch (error) {
      this.logger.error('Session validation failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Destroys user session
   */
  async destroySession(userId: string): Promise<void> {
    try {
      await this.cacheService.del(CacheKeys.USER_SESSION(userId));
      securityLogger.sessionEvent('destroyed', userId);
    } catch (error) {
      // Log error but don't throw - session destruction should always succeed
      this.logger.error('Failed to destroy session in cache', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Still log the session event even if cache operations fail
      securityLogger.sessionEvent('destroyed', userId);
    }
  }


  /**
   * Gets signing key from Auth0 JWKS endpoint with caching
   */
  private async getSigningKey(kid: string): Promise<string | null> {
    try {
      // Check memory cache first
      if (this.signingKeyCache.has(kid)) {
        return this.signingKeyCache.get(kid)!;
      }

      // Check Redis cache
      const cacheKey = `${CacheKeys.JWKS()}_${kid}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        const key = JSON.parse(cached) as string;
        this.signingKeyCache.set(kid, key);
        return key;
      }

      // Fetch from Auth0 JWKS endpoint
      const key = await this.jwksClient.getSigningKey(kid);
      const signingKey = key.getPublicKey();

      // Cache in both memory and Redis
      this.signingKeyCache.set(kid, signingKey);
      await this.cacheService.set(
        cacheKey,
        signingKey,
        60 * 60 * 1000 // 1 hour cache
      );

      return signingKey;

    } catch (error) {
      this.logger.error('Failed to get signing key', {
        kid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Health check for Auth0 connectivity
   */
  async healthCheck(): Promise<{ status: 'OK' | 'ERROR'; error?: string; responseTime: number }> {
    const startTime = Date.now();

    try {
      // Test JWKS endpoint availability
      const response = await fetch(auth0Config.jwksUri, {
        method: 'GET',
        // timeout: 5000, // Not supported in standard fetch
      });

      if (!response.ok) {
        throw new Error(`JWKS endpoint returned ${response.status}`);
      }

      const responseTime = Date.now() - startTime;
      return { status: 'OK', responseTime };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
      };
    }
  }
}