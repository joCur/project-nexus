/**
 * Central type exports for the Project Nexus backend
 */

// Auth types
export * from './auth';

// Common utility types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginationInput {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface DatabaseError extends Error {
  code: string;
  constraint?: string;
  table?: string;
  column?: string;
}

export interface ValidationError extends Error {
  field: string;
  value: unknown;
  constraint: string;
}

// Health check types
export interface HealthStatus {
  status: 'OK' | 'WARN' | 'ERROR';
  timestamp: string;
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: HealthStatus;
    redis: HealthStatus;
    auth0: HealthStatus;
    ai?: HealthStatus;
  };
  environment: string;
}

// GraphQL Context type
export interface GraphQLContext {
  user?: import('./auth').User;
  auth0Payload?: import('./auth').Auth0User;
  permissions: string[];
  isAuthenticated: boolean;
  req: import('express').Request;
  res: import('express').Response;
  dataSources: {
    userService: import('../services/user').UserService;
    auth0Service: import('../services/auth0').Auth0Service;
    cacheService: import('../services/cache').CacheService;
  };
}