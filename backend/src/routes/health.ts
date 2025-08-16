import { Router, Request, Response } from 'express';
import { database } from '@/database/connection';
import { CacheService } from '@/services/cache';
import { Auth0Service } from '@/services/auth0';
import { HealthCheckResponse } from '@/types';
import { asyncHandler } from '@/middleware/error';
import { createContextLogger } from '@/utils/logger';

/**
 * Health check routes for monitoring and load balancer probes
 * Implements comprehensive service health monitoring
 */

const logger = createContextLogger({ service: 'HealthRoutes' });

export function createHealthRoutes(
  cacheService: CacheService,
  auth0Service: Auth0Service
): Router {
  const router = Router();

  /**
   * Basic liveness probe - checks if the service is alive
   * Used by Kubernetes liveness probes
   */
  router.get('/live', asyncHandler(async (req: Request, res: Response) => {
    // Simple check - if we can respond, we're alive
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
    });
  }));

  /**
   * Readiness probe - checks if the service is ready to accept traffic
   * Used by Kubernetes readiness probes and load balancers
   */
  router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    
    try {
      // Check critical dependencies
      const [dbHealth, redisHealth] = await Promise.all([
        database.healthCheck(),
        cacheService.healthCheck(),
      ]);

      // Service is ready if critical services are OK
      const isReady = dbHealth.status === 'OK' && redisHealth.status === 'OK';

      const status = isReady ? 'ready' : 'not_ready';
      const statusCode = isReady ? 200 : 503;

      const response = {
        status,
        timestamp,
        services: {
          database: {
            status: dbHealth.status,
            responseTime: dbHealth.responseTime,
            error: dbHealth.error,
          },
          redis: {
            status: redisHealth.status,
            responseTime: redisHealth.responseTime,
            error: redisHealth.error,
          },
        },
      };

      logger.info('Readiness check completed', {
        status,
        services: response.services,
      });

      res.status(statusCode).json(response);

    } catch (error) {
      logger.error('Readiness check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(503).json({
        status: 'not_ready',
        timestamp,
        error: 'Health check failed',
        services: {
          database: { status: 'ERROR', error: 'Check failed' },
          redis: { status: 'ERROR', error: 'Check failed' },
        },
      });
    }
  }));

  /**
   * Comprehensive health check - detailed status of all services
   * Used for detailed monitoring and troubleshooting
   */
  router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Check all services in parallel
      const [dbHealth, redisHealth, auth0Health] = await Promise.all([
        database.healthCheck(),
        cacheService.healthCheck(),
        auth0Service.healthCheck(),
      ]);

      // Get additional system information
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Determine overall health status
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      const services = {
        database: {
          status: dbHealth.status,
          timestamp,
          responseTime: dbHealth.responseTime,
          error: dbHealth.error,
        },
        redis: {
          status: redisHealth.status,
          timestamp,
          responseTime: redisHealth.responseTime,
          error: redisHealth.error,
        },
        auth0: {
          status: auth0Health.status,
          timestamp,
          responseTime: auth0Health.responseTime,
          error: auth0Health.error,
        },
      };

      // Calculate overall status
      const serviceStatuses = Object.values(services).map(s => s.status);
      const hasErrors = serviceStatuses.includes('ERROR');
      const hasWarnings = serviceStatuses.includes('WARN' as any);

      if (hasErrors) {
        overallStatus = 'unhealthy';
      } else if (hasWarnings) {
        overallStatus = 'degraded';
      }

      const response: HealthCheckResponse = {
        status: overallStatus,
        timestamp,
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor(process.uptime()),
        services,
        environment: process.env.NODE_ENV || 'development',
      };

      // Add detailed system information in development
      if (process.env.NODE_ENV === 'development') {
        (response as any).system = {
          memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          },
          database: database.getPoolStatus(),
        };
      }

      const statusCode = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'degraded' ? 200 : 503;

      logger.info('Health check completed', {
        status: overallStatus,
        duration: Date.now() - startTime,
        services: Object.entries(services).map(([name, service]) => ({
          name,
          status: service.status,
          responseTime: service.responseTime,
        })),
      });

      res.status(statusCode).json(response);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      // Return unhealthy status if health check itself fails
      const errorResponse: HealthCheckResponse = {
        status: 'unhealthy',
        timestamp,
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor(process.uptime()),
        services: {
          database: {
            status: 'ERROR',
            timestamp,
            error: 'Health check failed',
          },
          redis: {
            status: 'ERROR',
            timestamp,
            error: 'Health check failed',
          },
          auth0: {
            status: 'ERROR',
            timestamp,
            error: 'Health check failed',
          },
        },
        environment: process.env.NODE_ENV || 'development',
      };

      res.status(503).json(errorResponse);
    }
  }));

  /**
   * Service-specific health checks
   */
  
  // Database health check
  router.get('/database', asyncHandler(async (req: Request, res: Response) => {
    const health = await database.healthCheck();
    const statusCode = health.status === 'OK' ? 200 : 503;
    
    res.status(statusCode).json({
      service: 'database',
      ...health,
      timestamp: new Date().toISOString(),
      poolStatus: database.getPoolStatus(),
    });
  }));

  // Redis health check
  router.get('/redis', asyncHandler(async (req: Request, res: Response) => {
    const health = await cacheService.healthCheck();
    const statusCode = health.status === 'OK' ? 200 : 503;
    
    const stats = await cacheService.getStats();
    
    res.status(statusCode).json({
      service: 'redis',
      ...health,
      timestamp: new Date().toISOString(),
      stats,
    });
  }));

  // Auth0 health check
  router.get('/auth0', asyncHandler(async (req: Request, res: Response) => {
    const health = await auth0Service.healthCheck();
    const statusCode = health.status === 'OK' ? 200 : 503;
    
    res.status(statusCode).json({
      service: 'auth0',
      ...health,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * System information endpoint (development only)
   */
  router.get('/system', asyncHandler(async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not available in production' });
    }

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    res.json({
      timestamp: new Date().toISOString(),
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: Math.floor(process.uptime()),
        pid: process.pid,
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      cpu: cpuUsage,
      database: database.getPoolStatus(),
    });
  }));

  return router;
}