/**
 * Canvas Event System Type Definitions
 * 
 * Comprehensive event types for canvas interactions including mouse, touch,
 * keyboard, and gesture events with proper typing and event handling.
 */

import type { CanvasPosition, ScreenPosition } from './canvas.types';
import type { EntityId } from './common.types';

// ============================================================================
// BASE EVENT TYPES
// ============================================================================

/**
 * Base canvas event interface
 */
export interface BaseCanvasEvent {
  type: string;
  timestamp: number;
  canvasPosition: CanvasPosition;
  screenPosition: ScreenPosition;
  preventDefault: () => void;
  stopPropagation: () => void;
}

// ============================================================================
// MOUSE EVENT TYPES
// ============================================================================

/**
 * Canvas mouse event types
 */
export type MouseEventType = 
  | 'mousedown'
  | 'mouseup' 
  | 'mousemove'
  | 'click'
  | 'dblclick'
  | 'contextmenu'
  | 'wheel';

/**
 * Mouse button types
 */
export type MouseButton = 'left' | 'middle' | 'right';

/**
 * Canvas mouse event
 */
export interface CanvasMouseEvent extends BaseCanvasEvent {
  type: MouseEventType;
  button: MouseButton;
  buttons: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  deltaX?: number;
  deltaY?: number;
  deltaZ?: number;
}

// ============================================================================
// TOUCH EVENT TYPES
// ============================================================================

/**
 * Canvas touch event types
 */
export type TouchEventType =
  | 'touchstart'
  | 'touchmove'
  | 'touchend'
  | 'touchcancel';

/**
 * Touch point information
 */
export interface TouchPoint {
  identifier: number;
  canvasPosition: CanvasPosition;
  screenPosition: ScreenPosition;
  force: number;
  radiusX: number;
  radiusY: number;
}

/**
 * Canvas touch event
 */
export interface CanvasTouchEvent extends BaseCanvasEvent {
  type: TouchEventType;
  touches: TouchPoint[];
  changedTouches: TouchPoint[];
  targetTouches: TouchPoint[];
}

// ============================================================================
// KEYBOARD EVENT TYPES
// ============================================================================

/**
 * Canvas keyboard event types
 */
export type KeyboardEventType =
  | 'keydown'
  | 'keyup'
  | 'keypress';

/**
 * Canvas keyboard event
 */
export interface CanvasKeyboardEvent {
  type: KeyboardEventType;
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

// ============================================================================
// GESTURE EVENT TYPES
// ============================================================================

/**
 * Gesture event types
 */
export type GestureEventType =
  | 'pinchstart'
  | 'pinchmove' 
  | 'pinchend'
  | 'pan'
  | 'tap'
  | 'doubletap';

/**
 * Gesture event data
 */
export interface CanvasGestureEvent extends BaseCanvasEvent {
  type: GestureEventType;
  scale?: number;
  rotation?: number;
  velocity?: CanvasPosition;
  distance?: number;
  center?: CanvasPosition;
  deltaScale?: number;
  deltaRotation?: number;
}

// ============================================================================
// CARD INTERACTION EVENTS
// ============================================================================

/**
 * Card interaction event types
 */
export type CardEventType =
  | 'cardclick'
  | 'carddblclick'
  | 'cardmousedown'
  | 'cardmouseup'
  | 'cardhover'
  | 'cardleave'
  | 'carddragstart'
  | 'carddrag'
  | 'carddragend'
  | 'cardresize'
  | 'cardselect'
  | 'carddeselect';

/**
 * Card interaction event
 */
export interface CardEvent extends BaseCanvasEvent {
  type: CardEventType;
  cardId: EntityId;
  cardPosition: CanvasPosition;
  originalEvent?: CanvasMouseEvent | CanvasTouchEvent;
}

// ============================================================================
// CONNECTION EVENTS
// ============================================================================

/**
 * Connection event types
 */
export type ConnectionEventType =
  | 'connectionstart'
  | 'connectionmove'
  | 'connectionend'
  | 'connectioncreated'
  | 'connectiondeleted'
  | 'connectionhover'
  | 'connectionclick';

/**
 * Connection interaction event
 */
export interface ConnectionEvent extends BaseCanvasEvent {
  type: ConnectionEventType;
  connectionId?: EntityId;
  sourceCardId?: EntityId;
  targetCardId?: EntityId;
  originalEvent?: CanvasMouseEvent | CanvasTouchEvent;
}

// ============================================================================
// CANVAS VIEWPORT EVENTS
// ============================================================================

/**
 * Viewport event types
 */
export type ViewportEventType =
  | 'viewportchange'
  | 'zoomchange'
  | 'panstart'
  | 'panmove'
  | 'panend';

/**
 * Viewport event
 */
export interface ViewportEvent {
  type: ViewportEventType;
  zoom?: number;
  position?: CanvasPosition;
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

// ============================================================================
// EVENT HANDLER TYPES
// ============================================================================

/**
 * Event handler function types
 */
export type MouseEventHandler = (event: CanvasMouseEvent) => void;
export type TouchEventHandler = (event: CanvasTouchEvent) => void;
export type KeyboardEventHandler = (event: CanvasKeyboardEvent) => void;
export type GestureEventHandler = (event: CanvasGestureEvent) => void;
export type CardEventHandler = (event: CardEvent) => void;
export type ConnectionEventHandler = (event: ConnectionEvent) => void;
export type ViewportEventHandler = (event: ViewportEvent) => void;

/**
 * Event listener options
 */
export interface EventListenerOptions {
  passive?: boolean;
  once?: boolean;
  capture?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Event system interface
 */
export interface CanvasEventSystem {
  // Mouse events
  on(type: MouseEventType, handler: MouseEventHandler, options?: EventListenerOptions): void;
  
  // Touch events
  on(type: TouchEventType, handler: TouchEventHandler, options?: EventListenerOptions): void;
  
  // Keyboard events
  on(type: KeyboardEventType, handler: KeyboardEventHandler, options?: EventListenerOptions): void;
  
  // Gesture events
  on(type: GestureEventType, handler: GestureEventHandler, options?: EventListenerOptions): void;
  
  // Card events
  on(type: CardEventType, handler: CardEventHandler, options?: EventListenerOptions): void;
  
  // Connection events
  on(type: ConnectionEventType, handler: ConnectionEventHandler, options?: EventListenerOptions): void;
  
  // Viewport events
  on(type: ViewportEventType, handler: ViewportEventHandler, options?: EventListenerOptions): void;
  
  // Remove listeners
  off(type: string, handler: (...args: any[]) => void): void;
  
  // Emit events
  emit(event: BaseCanvasEvent): void;
}