import { Knex, knex as createKnex } from 'knex';
import { databaseConfig } from '@/config/environment';
import { DatabaseError, ErrorFactory } from '@/utils/errors';
import { performanceLogger, createContextLogger } from '@/utils/logger';

/**
 * Database connection and query management
 * Implements connection pooling and performance monitoring
 */

const logger = createContextLogger({ service: 'Database' });

// Create Knex instance with connection pooling
const db = createKnex(databaseConfig);

/**
 * Database connection wrapper with performance monitoring
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: Knex;

  private constructor() {
    this.db = db;
    this.setupEventListeners();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Get the Knex instance
   */
  public getKnex(): Knex {
    return this.db;
  }

  /**
   * Execute a query with performance monitoring
   */
  public async query<T = any>(
    query: Knex.QueryBuilder | Knex.Raw,
    operation: string = 'query'
  ): Promise<T> {
    const startTime = Date.now();
    const queryString = query.toString();

    try {
      const result = await query;
      const duration = Date.now() - startTime;
      
      performanceLogger.dbQuery(queryString, duration, {
        operation,
        rowCount: Array.isArray(result) ? result.length : 1,
      });

      return result as T;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      performanceLogger.dbQuery(queryString, duration, {
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });

      // Transform database errors to application errors
      if (error && typeof error === 'object' && 'code' in error) {
        throw ErrorFactory.fromDatabaseError(error);
      }

      throw new DatabaseError(
        error instanceof Error ? error.message : 'Database query failed'
      );
    }
  }

  /**
   * Execute a transaction with rollback on error
   */
  public async transaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await this.db.transaction(callback);
      const duration = Date.now() - startTime;
      
      performanceLogger.dbQuery('transaction', duration, {
        operation: 'transaction_commit',
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      performanceLogger.dbQuery('transaction', duration, {
        operation: 'transaction_rollback',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      });

      throw error;
    }
  }

  /**
   * Check database connectivity
   */
  public async healthCheck(): Promise<{ status: 'OK' | 'ERROR'; responseTime: number; error?: string }> {
    const startTime = Date.now();

    try {
      await this.db.raw('SELECT 1');
      const responseTime = Date.now() - startTime;
      return { status: 'OK', responseTime };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'ERROR',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get connection pool status
   */
  public getPoolStatus() {
    const pool = this.db.client.pool;
    return {
      used: pool.numUsed(),
      free: pool.numFree(),
      pending: pool.numPendingAcquires(),
      min: pool.min,
      max: pool.max,
    };
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    try {
      await this.db.destroy();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Setup database event listeners for monitoring
   */
  private setupEventListeners(): void {
    // Monitor queries in development
    if (process.env.NODE_ENV === 'development') {
      this.db.on('query', (query) => {
        logger.debug('Database query', {
          sql: query.sql,
          bindings: query.bindings,
        });
      });
    }

    // Monitor query errors
    this.db.on('query-error', (error, query) => {
      logger.error('Database query error', {
        error: error.message,
        sql: query.sql,
        bindings: query.bindings,
      });
    });

    // Monitor connection events
    this.db.client.pool.on('acquireRequest', () => {
      logger.debug('Connection pool: acquire request');
    });

    this.db.client.pool.on('acquireSuccess', () => {
      logger.debug('Connection pool: acquire success');
    });

    this.db.client.pool.on('createRequest', () => {
      logger.debug('Connection pool: create request');
    });

    this.db.client.pool.on('createSuccess', () => {
      logger.debug('Connection pool: create success');
    });

    this.db.client.pool.on('destroySuccess', () => {
      logger.debug('Connection pool: destroy success');
    });
  }
}

// Export singleton instance
export const database = DatabaseConnection.getInstance();

// Export Knex instance for direct use
export const knex = database.getKnex();

// Export types
export type { Knex };