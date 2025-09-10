import { RateLimitError } from '@/utils/errors';
import { securityLogger } from '@/utils/logger';
import { GraphQLContext } from '@/types';

/**
 * In-memory rate limiter for GraphQL operations
 * Tracks operation counts per user within time windows
 */

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  operationName: string;
}

// Constants for rate limiting
const OWNERSHIP_TRANSFER_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const OWNERSHIP_TRANSFER_MAX_REQUESTS = 3;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export class RateLimiterService {
  private static instance: RateLimiterService;
  private readonly rateLimitMap: Map<string, RateLimitEntry> = new Map();

  private constructor() {
    // Clean up old entries every hour - using manual cleanup instead of timer
    // The cleanupOldEntries method is called during each rate limit check
  }

  public static getInstance(): RateLimiterService {
    if (!RateLimiterService.instance) {
      RateLimiterService.instance = new RateLimiterService();
    }
    return RateLimiterService.instance;
  }

  /**
   * Check rate limit for ownership transfer operations
   */
  public async checkOwnershipTransferLimit(context: GraphQLContext): Promise<void> {
    const config: RateLimitConfig = {
      windowMs: OWNERSHIP_TRANSFER_WINDOW_MS,
      maxRequests: OWNERSHIP_TRANSFER_MAX_REQUESTS,
      operationName: 'ownership_transfer'
    };

    await this.checkRateLimit(context, config);
  }

  /**
   * Generic rate limit checker
   */
  private async checkRateLimit(
    context: GraphQLContext,
    config: RateLimitConfig
  ): Promise<void> {
    if (!context.user?.id) {
      throw new RateLimitError(0, 0, 0);
    }

    const key = `${config.operationName}:${context.user.id}`;
    const now = Date.now();
    const entry = this.rateLimitMap.get(key);

    // If no entry or window expired, create new entry
    if (!entry || (now - entry.firstRequest) > config.windowMs) {
      this.rateLimitMap.set(key, {
        count: 1,
        firstRequest: now,
        lastRequest: now
      });
      return;
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      const remainingTime = config.windowMs - (now - entry.firstRequest);
      
      securityLogger.suspiciousActivity(`Rate limit exceeded for ${config.operationName}`, {
        userId: context.user.id,
        userEmail: context.user.email,
        operationName: config.operationName,
        attemptCount: entry.count,
        maxAllowed: config.maxRequests,
        windowMs: config.windowMs,
        remainingMs: remainingTime
      });

      throw new RateLimitError(
        config.maxRequests,
        config.windowMs,
        remainingTime
      );
    }

    // Increment counter
    entry.count++;
    entry.lastRequest = now;
    this.rateLimitMap.set(key, entry);

    // Periodic cleanup on 1% chance
    if (Math.random() < 0.01) {
      this.cleanupOldEntries();
    }
  }

  /**
   * Reset rate limit for a specific user and operation
   */
  public resetLimit(userId: string, operationName: string): void {
    const key = `${operationName}:${userId}`;
    this.rateLimitMap.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanupOldEntries(): void {
    const now = Date.now();
    const maxWindowMs = Math.max(
      OWNERSHIP_TRANSFER_WINDOW_MS,
      // Add other window times here as needed
    );

    for (const [key, entry] of this.rateLimitMap.entries()) {
      if ((now - entry.firstRequest) > maxWindowMs) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  /**
   * Get current rate limit status for debugging
   */
  public getRateLimitStatus(userId: string, operationName: string): RateLimitEntry | null {
    const key = `${operationName}:${userId}`;
    return this.rateLimitMap.get(key) || null;
  }
}

// Export singleton instance
export const rateLimiterService = RateLimiterService.getInstance();