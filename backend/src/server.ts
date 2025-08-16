import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginLandingPageLocalDefault, ApolloServerPluginLandingPageProductionDefault } from '@apollo/server/plugin/landingPage/default';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';

// Configuration and utilities
import { env, db, redis } from '@/config/environment';
import logger from '@/utils/logger';
import { setupProcessErrorHandlers } from '@/middleware/error';

// GraphQL
import { typeDefs } from '@/graphql/typeDefs';
import { resolvers } from '@/resolvers';

// Services
import { CacheService } from '@/services/cache';
import { UserService } from '@/services/user';
import { Auth0Service } from '@/services/auth0';

// Middleware
import { applySecurityMiddleware } from '@/middleware/security';
import { applyErrorHandlers } from '@/middleware/error';
import { 
  createAuthMiddleware, 
  createGraphQLContext 
} from '@/middleware/auth';

// Routes
import { createHealthRoutes } from '@/routes/health';

/**
 * Project Nexus Backend Server
 * Express + Apollo GraphQL server with Auth0 authentication
 */

class NexusBackendServer {
  private app: express.Application;
  private apolloServer?: ApolloServer;
  private httpServer?: ReturnType<typeof createServer>;
  private wsServer?: WebSocketServer;
  
  // Services
  private cacheService: CacheService;
  private userService: UserService;
  private auth0Service: Auth0Service;

  constructor() {
    this.app = express();
    
    // Initialize services
    this.cacheService = new CacheService();
    this.userService = new UserService();
    this.auth0Service = new Auth0Service(this.cacheService, this.userService);
    
    // Setup process error handlers
    setupProcessErrorHandlers();
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Project Nexus Backend Server...', {
        environment: env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
      });

      // Connect to services
      await this.connectServices();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup GraphQL
      await this.setupGraphQL();
      
      // Setup error handling
      this.setupErrorHandling();

      logger.info('Server initialization completed successfully');

    } catch (error) {
      logger.error('Failed to initialize server', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Connect to external services
   */
  private async connectServices(): Promise<void> {
    logger.info('Connecting to external services...');

    try {
      // Connect to Redis
      await this.cacheService.connect();
      logger.info('Redis connection established');

      // Test database connection
      const dbHealth = await this.cacheService.healthCheck();
      if (dbHealth.status === 'ERROR') {
        throw new Error(`Database connection failed: ${dbHealth.error}`);
      }
      logger.info('Database connection verified');

      // Test Auth0 connectivity
      const auth0Health = await this.auth0Service.healthCheck();
      if (auth0Health.status === 'ERROR') {
        logger.warn(`Auth0 connectivity issue: ${auth0Health.error}`);
      } else {
        logger.info('Auth0 connectivity verified');
      }

    } catch (error) {
      logger.error('Service connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    logger.info('Setting up middleware...');

    // Trust proxy for correct IP detection
    this.app.set('trust proxy', 1);

    // Apply security middleware
    applySecurityMiddleware(this.app);

    // JSON parsing with size limits
    this.app.use(express.json({ 
      limit: '10mb',
      strict: true,
    }));

    // URL encoded form parsing
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));

    // Authentication middleware
    const authMiddleware = createAuthMiddleware(
      this.auth0Service,
      this.userService,
      this.cacheService
    );
    this.app.use(authMiddleware);

    logger.info('Middleware setup completed');
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    logger.info('Setting up routes...');

    // Health check routes
    const healthRoutes = createHealthRoutes(this.cacheService, this.auth0Service);
    this.app.use('/health', healthRoutes);

    // API version endpoint
    this.app.get('/version', (req, res) => {
      res.json({
        version: process.env.npm_package_version || '1.0.0',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Project Nexus Backend API',
        version: process.env.npm_package_version || '1.0.0',
        environment: env.NODE_ENV,
        graphql: '/graphql',
        health: '/health',
        documentation: env.NODE_ENV === 'development' ? '/graphql' : undefined,
      });
    });

    logger.info('Routes setup completed');
  }

  /**
   * Setup GraphQL server
   */
  private async setupGraphQL(): Promise<void> {
    logger.info('Setting up GraphQL server...');

    try {
      // Create executable schema
      const schema = makeExecutableSchema({
        typeDefs,
        resolvers,
      });

      // Create Apollo Server
      this.apolloServer = new ApolloServer({
        schema,
        introspection: env.NODE_ENV === 'development',
        formatError: (formattedError, error) => {
          logger.error('GraphQL Error', {
            message: formattedError.message,
            locations: formattedError.locations,
            path: formattedError.path,
          });

          return {
            message: formattedError.message,
            code: (formattedError.extensions?.code as string) || 'INTERNAL_ERROR',
            locations: formattedError.locations,
            path: formattedError.path,
            ...(env.NODE_ENV === 'development' && {
              extensions: formattedError.extensions,
            }),
          };
        },
        plugins: [
          // Add landing page plugin based on environment
          env.NODE_ENV === 'development'
            ? ApolloServerPluginLandingPageLocalDefault({
                embed: true,
                includeCookies: true,
              })
            : ApolloServerPluginLandingPageProductionDefault({
                embed: true,
                graphRef: 'nexus-api@current',
                includeCookies: false,
              }),
          {
            requestDidStart() {
              return Promise.resolve({
                willSendResponse: async (requestContext: any) => {
                  // Log GraphQL operations
                  logger.info('GraphQL operation completed', {
                    operation: requestContext.request.operationName,
                    query: requestContext.request.query?.substring(0, 200),
                    variables: requestContext.request.variables,
                    errors: requestContext.errors?.length || 0,
                  });
                },
              });
            },
          },
        ],
      });

      // Start Apollo Server
      await this.apolloServer.start();

      // Apply GraphQL middleware using Apollo Server 4 syntax
      this.app.use(
        '/graphql',
        express.json(),
        expressMiddleware(this.apolloServer, {
          context: createGraphQLContext(
            this.auth0Service,
            this.userService,
            this.cacheService
          ),
        })
      );

      // Setup WebSocket server for subscriptions
      this.httpServer = createServer(this.app);
      this.wsServer = new WebSocketServer({
        server: this.httpServer,
        path: '/graphql',
      });

      // Setup GraphQL WebSocket server
      useServer({ schema }, this.wsServer);

      logger.info('GraphQL server setup completed', {
        path: '/graphql',
        introspection: env.NODE_ENV === 'development',
        playground: env.NODE_ENV === 'development',
      });

    } catch (error) {
      logger.error('GraphQL setup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    logger.info('Setting up error handling...');

    // Apply error handlers
    applyErrorHandlers(this.app);

    logger.info('Error handling setup completed');
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      const server = this.httpServer || this.app;
      
      await new Promise<void>((resolve, reject) => {
        const serverInstance = server.listen(env.BACKEND_PORT, () => {
          logger.info('Server started successfully', {
            port: env.BACKEND_PORT,
            environment: env.NODE_ENV,
            graphql: `http://localhost:${env.BACKEND_PORT}/graphql`,
            health: `http://localhost:${env.BACKEND_PORT}/health`,
            subscriptions: `ws://localhost:${env.BACKEND_PORT}/graphql`,
          });
          resolve();
        });

        serverInstance.on('error', (error) => {
          logger.error('Server startup failed', {
            error: error.message,
            port: env.BACKEND_PORT,
          });
          reject(error);
        });
      });

    } catch (error) {
      logger.error('Failed to start server', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down server...');

    try {
      // Stop Apollo Server
      if (this.apolloServer) {
        await this.apolloServer.stop();
        logger.info('GraphQL server stopped');
      }

      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
        logger.info('WebSocket server stopped');
      }

      // Close HTTP server
      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer!.close(() => {
            logger.info('HTTP server stopped');
            resolve();
          });
        });
      }

      // Close database connections
      await this.cacheService.close();
      logger.info('Database connections closed');

      logger.info('Server shutdown completed');

    } catch (error) {
      logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Start the server if this file is run directly
 */
async function main() {
  const server = new NexusBackendServer();

  try {
    await server.initialize();
    await server.start();

    // Handle graceful shutdown
    const handleShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      await server.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

  } catch (error) {
    logger.error('Server startup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Export for testing
export { NexusBackendServer };

// Start server if run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}