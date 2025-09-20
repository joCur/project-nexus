import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root directory .env file
// This ensures we use the single source of truth for configuration
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Environment configuration schema with validation
 * Ensures all required environment variables are present and properly typed
 */
const environmentSchema = z.object({
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DOCKER_ENV: z.string().optional().transform(val => val === 'true'),
  BACKEND_PORT: z.string().transform(Number).default(3000),
  API_VERSION: z.string().default('v1'),
  
  // Database Configuration
  POSTGRES_DB: z.string().min(1, 'POSTGRES_DB is required'),
  POSTGRES_USER: z.string().min(1, 'POSTGRES_USER is required'),
  POSTGRES_PASSWORD: z.string().min(1, 'POSTGRES_PASSWORD is required'),
  POSTGRES_PORT: z.string().transform(Number).default(5432),
  DB_POOL_MIN: z.string().transform(Number).default(2),
  DB_POOL_MAX: z.string().transform(Number).default(10),
  DB_TIMEOUT: z.string().transform(Number).default(30000),
  
  // Redis Configuration
  REDIS_PORT: z.string().transform(Number).default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.string().transform(Number).default(0),
  
  // Auth0 Configuration
  AUTH0_DOMAIN: z.string().min(1, 'AUTH0_DOMAIN is required'),
  AUTH0_CLIENT_ID: z.string().min(1, 'AUTH0_CLIENT_ID is required'),
  AUTH0_CLIENT_SECRET: z.string().min(1, 'AUTH0_CLIENT_SECRET is required'),
  AUTH0_AUDIENCE: z.string().default('https://api.nexus-app.de'),
  AUTH0_MANAGEMENT_CLIENT_ID: z.string().optional(),
  AUTH0_MANAGEMENT_CLIENT_SECRET: z.string().optional(),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  
  // Security Configuration
  CORS_ORIGIN: z.string().default('http://localhost:3001,http://localhost:3000'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default(15),
  RATE_LIMIT_MAX: z.string().transform(Number).default(100),
  BCRYPT_ROUNDS: z.string().transform(Number).default(12),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('text-embedding-ada-002'),
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
});

type Environment = z.infer<typeof environmentSchema>;

/**
 * Validates and exports environment configuration
 * Throws error if required environment variables are missing or invalid
 */
function validateEnvironment(): Environment {
  try {
    return environmentSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
}

// Export validated environment configuration
export const config = validateEnvironment();

/**
 * Database configuration object for Knex.js
 */
export const databaseConfig = {
  client: 'postgresql',
  connection: {
    host: config.NODE_ENV === 'production' || config.DOCKER_ENV ? 'postgres' : 'localhost',
    port: config.POSTGRES_PORT,
    database: config.POSTGRES_DB,
    user: config.POSTGRES_USER,
    password: config.POSTGRES_PASSWORD,
  },
  pool: {
    min: config.DB_POOL_MIN,
    max: config.DB_POOL_MAX,
  },
  acquireConnectionTimeout: config.DB_TIMEOUT,
  migrations: {
    directory: './src/database/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/database/seeds',
  },
};

/**
 * Redis configuration object
 */
const redisHost = config.NODE_ENV === 'production' || config.DOCKER_ENV ? 'redis' : 'localhost';
export const redisConfig = {
  host: redisHost,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
  url: config.REDIS_PASSWORD 
    ? `redis://:${config.REDIS_PASSWORD}@${redisHost}:${config.REDIS_PORT}/${config.REDIS_DB}`
    : `redis://${redisHost}:${config.REDIS_PORT}/${config.REDIS_DB}`,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

/**
 * Auth0 configuration object
 */
export const auth0Config = {
  domain: config.AUTH0_DOMAIN,
  clientId: config.AUTH0_CLIENT_ID,
  clientSecret: config.AUTH0_CLIENT_SECRET,
  audience: config.AUTH0_AUDIENCE,
  managementClientId: config.AUTH0_MANAGEMENT_CLIENT_ID,
  managementClientSecret: config.AUTH0_MANAGEMENT_CLIENT_SECRET,
  
  // JWT settings
  jwksUri: `https://${config.AUTH0_DOMAIN}/.well-known/jwks.json`,
  issuer: `https://${config.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'] as const,
  
  // Session settings
  session: {
    absoluteDuration: 4 * 60 * 60 * 1000, // 4 hours in milliseconds
    inactivityDuration: 30 * 60 * 1000,   // 30 minutes in milliseconds
  },
};

/**
 * CORS configuration
 */
export const corsConfig = {
  origin: config.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
  ],
};

/**
 * Rate limiting configuration
 */
export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW * 60 * 1000, // Convert minutes to milliseconds
  max: config.RATE_LIMIT_MAX,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  
  // Different limits for different endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes for auth endpoints
    message: 'Too many authentication attempts, please try again later.',
  },
  
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 minutes for API
    message: 'API rate limit exceeded, please try again later.',
  },
  
  ai: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 AI requests per hour
    message: 'AI processing rate limit exceeded, please try again later.',
  },
};

/**
 * Logging configuration
 */
export const loggingConfig = {
  level: config.LOG_LEVEL,
  format: config.LOG_FORMAT,
  
  // File logging configuration
  files: {
    error: 'logs/error.log',
    combined: 'logs/combined.log',
    access: 'logs/access.log',
  },
  
  // Console logging for development
  console: config.NODE_ENV === 'development',
};

/**
 * Health check configuration
 */
export const healthCheckConfig = {
  path: '/health',
  readinessPath: '/health/ready',
  livenessPath: '/health/live',
  
  // Check intervals in milliseconds
  intervals: {
    database: 30000, // 30 seconds
    redis: 15000,    // 15 seconds
    auth0: 60000,    // 1 minute
  },
  
  // Timeout for health checks
  timeout: 5000, // 5 seconds
};

// Export individual configs for easier imports
export {
  config as env,
  databaseConfig as db,
  redisConfig as redis,
  auth0Config as auth0,
  corsConfig as cors,
  rateLimitConfig as rateLimit,
  loggingConfig as logging,
  healthCheckConfig as healthCheck,
};
