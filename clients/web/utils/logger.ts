/**
 * Logger utility re-export
 * Re-exports logger from lib/logger.ts for backward compatibility with @/utils/logger imports
 */

export { default, createContextLogger, Logger, type LogLevel, type LogEntry } from '@/lib/logger';
export { error, warn, info, debug, performance } from '@/lib/logger';