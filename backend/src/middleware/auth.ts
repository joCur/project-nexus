import { Request, Response, NextFunction } from 'express';
import { 
  AuthenticationError, 
  AuthorizationError, 
  InvalidTokenError 
} from '@/utils/errors';
import { securityLogger } from '@/utils/logger';
import { AuthContext } from '@/types/auth';
import { Auth0Service } from '@/services/auth0';
import { UserService } from '@/services/user';
import { CacheService } from '@/services/cache';

/**
 * Authentication middleware for Express routes and GraphQL context
 * Implements Auth0 JWT validation and user session management
 */

export interface AuthenticatedRequest extends Request {
  user?: import('@/types/auth').User;
  auth0Payload?: import('@/types/auth').Auth0User;
  permissions: string[];
  isAuthenticated: boolean;
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(
  auth0Service: Auth0Service,
  userService: UserService,
  _cacheService: CacheService
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Initialize authentication context
    req.isAuthenticated = false;
    req.permissions = [];

    try {

      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided - continue with unauthenticated context
        return next();
      }

      const token = authHeader.substring(7);

      // Validate Auth0 token
      const auth0Payload = await auth0Service.validateAuth0Token(token);
      if (!auth0Payload) {
        throw new InvalidTokenError();
      }

      // Sync user from Auth0 with session consistency
      const user = await auth0Service.syncUserFromAuth0(auth0Payload);

      // For new users or users without sessions, create a session automatically
      // This ensures onboarding flows work properly without session errors
      const sessionValid = await auth0Service.validateSession(user.id);
      if (!sessionValid) {
        // Create session automatically for new users during authentication
        try {
          const sessionId = await auth0Service.createSession(user, auth0Payload);
          securityLogger.sessionEvent('created', user.id, {
            sessionId,
            auth0UserId: auth0Payload.sub,
            reason: 'auto_session_creation_during_auth',
            userAgent: req.headers['user-agent'],
            ip: req.ip,
          });
        } catch (sessionError) {
          securityLogger.authFailure(
            `Session creation failed: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`,
            {
              userId: user.id,
              auth0UserId: auth0Payload.sub,
              userAgent: req.headers['user-agent'],
              ip: req.ip,
            }
          );
          // Don't throw error, continue with authentication but log the issue
          securityLogger.authFailure(
            `Session creation failed but continuing auth: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`,
            {
              userId: user.id,
              auth0UserId: auth0Payload.sub
            }
          );
        }
      }

      // Set authenticated context
      req.user = user;
      req.auth0Payload = auth0Payload;
      // req.permissions already initialized as [] above - will be resolved dynamically in GraphQL context using WorkspaceAuthorizationService
      req.isAuthenticated = true;

      // Update last activity (non-critical operation)
      try {
        await userService.updateLastLogin(user.id);
      } catch (updateError) {
        // Log error but don't fail authentication
        securityLogger.authFailure(
          `Failed to update last login: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`,
          {
            userId: user.id,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
          }
        );
      }

      securityLogger.authSuccess(user.id, auth0Payload.sub, {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        path: req.path,
        method: req.method,
        sessionValid,
        userId: user.id, // Ensure consistent user identification
      });

      next();

    } catch (error) {
      // Log authentication failure
      securityLogger.authFailure(
        error instanceof Error ? error.message : 'Unknown error',
        {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          path: req.path,
          method: req.method,
        }
      );

      if (error instanceof AuthenticationError) {
        return next(error);
      }

      // For other errors, return generic authentication error
      next(new AuthenticationError('Authentication failed'));
    }
  };
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.isAuthenticated) {
    throw new AuthenticationError();
  }
  next();
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated) {
      throw new AuthenticationError();
    }

    // Check if user has super_admin role - allows bypassing permission checks
    const isAdmin = req.user?.roles.includes('super_admin');
    
    if (!isAdmin && !req.permissions.includes(permission)) {
      securityLogger.authorizationFailure(req.user!.id, 'permission', permission, {
        userPermissions: req.permissions,
        path: req.path,
        method: req.method,
      });

      throw new AuthorizationError(
        `Permission required: ${permission}`,
        'INSUFFICIENT_PERMISSIONS',
        permission,
        req.permissions
      );
    }

    next();
  };
}

/**
 * Middleware to require specific role
 */
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated) {
      throw new AuthenticationError();
    }

    if (!req.user?.roles.includes(role)) {
      securityLogger.authorizationFailure(req.user!.id, 'role', role, {
        userRoles: req.user?.roles,
        path: req.path,
        method: req.method,
      });

      throw new AuthorizationError(
        `Role required: ${role}`,
        'INSUFFICIENT_PERMISSIONS',
        role,
        req.user?.roles
      );
    }

    next();
  };
}

/**
 * Create GraphQL context with authentication
 */
export function createGraphQLContext(
  auth0Service: Auth0Service,
  userService: UserService,
  _cacheService: CacheService,
  userProfileService: import('@/services/userProfile').UserProfileService,
  onboardingService: import('@/services/onboarding').OnboardingService,
  workspaceService: import('@/services/workspace').WorkspaceService,
  workspaceAuthorizationService: import('@/services/workspaceAuthorization').WorkspaceAuthorizationService
) {
  return async ({ req, res }: { req: AuthenticatedRequest; res: Response }) => {
    // Get user from request (set by auth middleware)
    const user = req.user;
    const auth0Payload = req.auth0Payload;
    const permissions = req.permissions || []; // Empty initially, permissions will be resolved dynamically using WorkspaceAuthorizationService
    const isAuthenticated = req.isAuthenticated || false;

    return {
      user,
      auth0Payload,
      permissions,
      isAuthenticated,
      req,
      res,
      dataSources: {
        auth0Service,
        userService,
        cacheService: _cacheService,
        userProfileService,
        onboardingService,
        workspaceService,
        workspaceAuthorizationService,
      },
    };
  };
}

/**
 * GraphQL directive implementations for authentication
 */
export const authDirectives = {
  /**
   * @auth directive - requires authentication
   */
  auth: (next: any, source: any, args: any, context: AuthContext) => {
    if (!context.isAuthenticated) {
      throw new AuthenticationError();
    }
    return next();
  },

  /**
   * @requirePermission directive - requires specific permission
   */
  requirePermission: (next: any, source: any, args: any, context: AuthContext, info: any) => {
    if (!context.isAuthenticated) {
      throw new AuthenticationError();
    }

    const permission = info.directive.arguments.permission.value;
    
    // Check if user has super_admin role - allows bypassing permission checks
    const isAdmin = context.user?.roles.includes('super_admin');
    
    if (!isAdmin && !context.permissions.includes(permission)) {
      securityLogger.authorizationFailure(
        context.user?.id || 'unknown',
        'graphql_permission',
        permission,
        {
          userPermissions: context.permissions,
          operation: info.operation.operation,
          fieldName: info.fieldName,
        }
      );

      throw new AuthorizationError(
        `Permission required: ${permission}`,
        'INSUFFICIENT_PERMISSIONS',
        permission,
        context.permissions
      );
    }

    return next();
  },

  /**
   * @requireRole directive - requires specific role
   */
  requireRole: (next: any, source: any, args: any, context: AuthContext, info: any) => {
    if (!context.isAuthenticated) {
      throw new AuthenticationError();
    }

    const role = info.directive.arguments.role.value;
    if (!context.user?.roles.includes(role)) {
      securityLogger.authorizationFailure(
        context.user?.id || 'unknown',
        'graphql_role',
        role,
        {
          userRoles: context.user?.roles,
          operation: info.operation.operation,
          fieldName: info.fieldName,
        }
      );

      throw new AuthorizationError(
        `Role required: ${role}`,
        'INSUFFICIENT_PERMISSIONS',
        role,
        context.user?.roles
      );
    }

    return next();
  },
};