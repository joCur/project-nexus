import { GraphQLContext, HealthCheckResponse } from '@/types';
import { createContextLogger } from '@/utils/logger';
import { database } from '@/database/connection';

/**
 * GraphQL resolvers for health check operations
 */

const logger = createContextLogger({ service: 'HealthResolvers' });

export const healthResolvers = {
  Query: {
    /**
     * Comprehensive health check
     */
    health: async (_: any, __: any, context: GraphQLContext): Promise<HealthCheckResponse> => {
      const startTime = Date.now();
      const timestamp = new Date().toISOString();

      try {
        // Check database health
        const dbHealth = await database.healthCheck();

        // Check Redis health
        const redisHealth = await context.dataSources.cacheService.healthCheck();

        // Check Auth0 health
        const auth0Health = await context.dataSources.auth0Service.healthCheck();

        // Calculate overall status
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

        // Determine overall health status
        let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        
        const hasErrors = Object.values(services).some(service => service.status === 'ERROR');
        const hasWarnings = Object.values(services).some(service => (service as any).status === 'WARN');

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

        logger.info('Health check completed', {
          status: overallStatus,
          duration: Date.now() - startTime,
          services: Object.entries(services).map(([name, service]) => ({
            name,
            status: service.status,
            responseTime: service.responseTime,
          })),
        });

        return response;

      } catch (error) {
        logger.error('Health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        });

        // Return unhealthy status if health check itself fails
        return {
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
      }
    },

    /**
     * Readiness probe - checks if service is ready to accept traffic
     */
    healthReady: async (_: any, __: any, context: GraphQLContext): Promise<boolean> => {
      try {
        // Check critical dependencies
        const dbHealth = await database.healthCheck();
        const redisHealth = await context.dataSources.cacheService.healthCheck();

        // Service is ready if database is OK and Redis is OK
        const isReady = dbHealth.status === 'OK' && redisHealth.status === 'OK';

        logger.debug('Readiness check', {
          ready: isReady,
          database: dbHealth.status,
          redis: redisHealth.status,
        });

        return isReady;

      } catch (error) {
        logger.error('Readiness check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },

    /**
     * Liveness probe - checks if service is alive
     */
    healthLive: async (): Promise<boolean> => {
      // Simple liveness check - if we can respond, we're alive
      return true;
    },

    /**
     * Get API version
     */
    version: (): string => {
      return process.env.npm_package_version || '1.0.0';
    },

    /**
     * Get service uptime in seconds
     */
    uptime: (): number => {
      return Math.floor(process.uptime());
    },
  },
};