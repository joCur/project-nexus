/**
 * Common Type Definitions
 * 
 * Shared types and interfaces used across multiple stores in the infinite canvas system.
 */

/**
 * 2D coordinate position
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 2D dimensions
 */
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Rectangle bounds
 */
export interface Bounds extends Position, Dimensions {}

/**
 * Color value (hex string)
 */
export type Color = string;

/**
 * Unique identifier for canvas entities
 */
export type EntityId = string;

/**
 * Store selector utility type
 */
export type StoreSelector<T, R> = (state: T) => R;

/**
 * Store subscription callback type
 */
export type StoreSubscriber<T> = (state: T, previousState: T) => void;

/**
 * Timestamp string (ISO 8601)
 */
export type Timestamp = string;

/**
 * Generic metadata record
 */
export type Metadata = Record<string, any>;