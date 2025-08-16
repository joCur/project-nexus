import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { corsConfig, rateLimitConfig } from '@/config/environment';
import { RateLimitError } from '@/utils/errors';
import { securityLogger, performanceLogger } from '@/utils/logger';

/**
 * Security middleware for Project Nexus backend
 * Implements CORS, rate limiting, security headers, and request monitoring
 */

/**
 * Configure CORS middleware
 */
export const corsMiddleware = cors({
  origin: corsConfig.origin,
  credentials: corsConfig.credentials,
  methods: corsConfig.methods,
  allowedHeaders: corsConfig.allowedHeaders,
  optionsSuccessStatus: 200, // For legacy browser support
});

/**
 * Configure Helmet for security headers
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  } : false, // Disable CSP in development for Apollo Studio
  crossOriginEmbedderPolicy: false, // Disable for GraphQL Playground
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * General API rate limiting
 */
export const apiRateLimit = rateLimit({
  windowMs: rateLimitConfig.api.windowMs,
  max: rateLimitConfig.api.max,
  message: {
    error: 'API_RATE_LIMIT_EXCEEDED',
    message: rateLimitConfig.api.message,
    retryAfter: rateLimitConfig.api.windowMs / 1000,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    securityLogger.suspiciousActivity('API rate limit exceeded', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method,
    });

    const error = new RateLimitError(
      rateLimitConfig.api.max,
      rateLimitConfig.api.windowMs,
      rateLimitConfig.api.windowMs
    );

    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      retryAfter: error.retryAfter,
    });
  },
});

/**
 * Authentication endpoint rate limiting (stricter)
 */
export const authRateLimit = rateLimit({
  windowMs: rateLimitConfig.auth.windowMs,
  max: rateLimitConfig.auth.max,
  message: {
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: rateLimitConfig.auth.message,
    retryAfter: rateLimitConfig.auth.windowMs / 1000,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    securityLogger.suspiciousActivity('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method,
    });

    const error = new RateLimitError(
      rateLimitConfig.auth.max,
      rateLimitConfig.auth.windowMs,
      rateLimitConfig.auth.windowMs
    );

    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      retryAfter: error.retryAfter,
    });
  },
});

/**
 * AI endpoint rate limiting
 */
export const aiRateLimit = rateLimit({
  windowMs: rateLimitConfig.ai.windowMs,
  max: rateLimitConfig.ai.max,
  message: {
    error: 'AI_RATE_LIMIT_EXCEEDED',
    message: rateLimitConfig.ai.message,
    retryAfter: rateLimitConfig.ai.windowMs / 1000,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    securityLogger.suspiciousActivity('AI rate limit exceeded', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method,
    });

    const error = new RateLimitError(
      rateLimitConfig.ai.max,
      rateLimitConfig.ai.windowMs,
      rateLimitConfig.ai.windowMs
    );

    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      retryAfter: error.retryAfter,
    });
  },
});

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Log request
  securityLogger.authSuccess('system', 'request_received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    contentLength: req.headers['content-length'],
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): Response {
    const duration = Date.now() - startTime;
    
    performanceLogger.apiRequest(
      req.method,
      req.path,
      duration,
      res.statusCode,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        contentLength: res.get('content-length'),
      }
    );

    // Log suspicious status codes
    if (res.statusCode >= 400) {
      securityLogger.suspiciousActivity('HTTP error response', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        duration,
      });
    }

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Request size limiting middleware
 */
export const requestSizeLimit = (req: Request, res: Response, next: NextFunction) => {
  // Set different limits based on content type
  const contentType = req.headers['content-type'] || '';
  let sizeLimit = 1024 * 1024; // 1MB default

  if (contentType.includes('application/json')) {
    sizeLimit = 10 * 1024 * 1024; // 10MB for JSON (GraphQL mutations)
  } else if (contentType.includes('multipart/form-data')) {
    sizeLimit = 50 * 1024 * 1024; // 50MB for file uploads
  }

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  
  if (contentLength > sizeLimit) {
    securityLogger.suspiciousActivity('Request size limit exceeded', {
      contentLength,
      sizeLimit,
      contentType,
      ip: req.ip,
      path: req.path,
    });

    return res.status(413).json({
      error: 'REQUEST_TOO_LARGE',
      message: `Request size exceeds limit of ${sizeLimit} bytes`,
      limit: sizeLimit,
      received: contentLength,
    });
  }

  next();
};

/**
 * IP-based request monitoring
 */
const ipRequestCounts = new Map<string, { count: number; firstRequest: number }>();
const SUSPICIOUS_REQUEST_THRESHOLD = 1000; // requests per hour
const MONITORING_WINDOW = 60 * 60 * 1000; // 1 hour

export const ipMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  const now = Date.now();
  
  // Get or initialize IP stats
  let stats = ipRequestCounts.get(ip);
  if (!stats || (now - stats.firstRequest) > MONITORING_WINDOW) {
    stats = { count: 0, firstRequest: now };
    ipRequestCounts.set(ip, stats);
  }
  
  stats.count++;
  
  // Check for suspicious activity
  if (stats.count > SUSPICIOUS_REQUEST_THRESHOLD) {
    securityLogger.suspiciousActivity('High request volume from IP', {
      ip,
      requestCount: stats.count,
      timeWindow: MONITORING_WINDOW,
      userAgent: req.headers['user-agent'],
    });
  }
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance
    for (const [checkIp, checkStats] of ipRequestCounts.entries()) {
      if ((now - checkStats.firstRequest) > MONITORING_WINDOW) {
        ipRequestCounts.delete(checkIp);
      }
    }
  }
  
  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server signature
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-API-Version', process.env.npm_package_version || '1.0.0');
  res.setHeader('X-Request-ID', req.headers['x-request-id'] || 'unknown');
  
  // Prevent caching of sensitive endpoints
  if (req.path.includes('/auth') || req.path.includes('/user')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

/**
 * Content validation middleware
 */
export const contentValidation = (req: Request, res: Response, next: NextFunction) => {
  // Validate JSON content type for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('application/json') && 
        !contentType.includes('multipart/form-data')) {
      return res.status(415).json({
        error: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Content-Type must be application/json or multipart/form-data',
        received: contentType,
      });
    }
  }
  
  next();
};

/**
 * Apply all security middleware in correct order
 */
export function applySecurityMiddleware(app: any) {
  // Basic security headers (first)
  app.use(helmetMiddleware);
  app.use(securityHeaders);
  
  // CORS (early)
  app.use(corsMiddleware);
  
  // Request monitoring
  app.use(ipMonitoring);
  app.use(requestLogger);
  
  // Content validation
  app.use(contentValidation);
  app.use(requestSizeLimit);
  
  // Rate limiting (last)
  app.use('/auth', authRateLimit);
  app.use('/ai', aiRateLimit);
  app.use(apiRateLimit);
}