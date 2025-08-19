/**
 * UI Store Type Definitions
 * 
 * Types and interfaces for UI state management including sidebars, modals, and tools.
 */

import type { EntityId, Timestamp } from './common.types';
import type { CardType } from './card.types';

/**
 * Available tools on the canvas
 */
export type CanvasTool = 'select' | 'pan' | 'create-card' | 'create-connection' | 'erase';

/**
 * Sidebar panel types
 */
export type SidebarPanel = 'properties' | 'layers' | 'search' | 'ai-insights' | 'history';

/**
 * Modal types
 */
export type ModalType = 'card-editor' | 'settings' | 'export' | 'share' | 'help';

/**
 * Notification types
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Theme options
 */
export type Theme = 'light' | 'dark' | 'auto';

/**
 * Search filter settings
 */
export interface SearchFilters {
  types: CardType[];
  tags: string[];
  dateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
}

/**
 * Search state
 */
export interface SearchState {
  query: string;
  isActive: boolean;
  results: {
    cards: EntityId[];
    connections: EntityId[];
  };
  filters: SearchFilters;
}

/**
 * Active modal state
 */
export interface ModalState {
  type: ModalType | null;
  data: Record<string, any>;
  isOpen: boolean;
}

/**
 * Sidebar state
 */
export interface SidebarState {
  isOpen: boolean;
  activePanel: SidebarPanel | null;
  width: number;
  position: 'left' | 'right';
}

/**
 * Toolbar state
 */
export interface ToolbarState {
  activeTool: CanvasTool;
  isVisible: boolean;
  position: 'top' | 'bottom' | 'floating';
}

/**
 * Notification item
 */
export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: Timestamp;
  autoClose?: boolean;
}

/**
 * Loading state
 */
export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

/**
 * UI store state interface
 */
export interface UIState {
  sidebar: SidebarState;
  toolbar: ToolbarState;
  modal: ModalState;
  search: SearchState;
  theme: Theme;
  notifications: Notification[];
  loading: LoadingState;
}

/**
 * UI store actions interface
 */
export interface UIActions {
  // Sidebar management
  toggleSidebar: () => void;
  setSidebarPanel: (panel: SidebarPanel | null) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarPosition: (position: 'left' | 'right') => void;
  
  // Toolbar management
  setActiveTool: (tool: CanvasTool) => void;
  toggleToolbar: () => void;
  setToolbarPosition: (position: 'top' | 'bottom' | 'floating') => void;
  
  // Modal management
  openModal: (type: ModalType, data?: Record<string, any>) => void;
  closeModal: () => void;
  updateModalData: (data: Record<string, any>) => void;
  
  // Search management
  setSearchQuery: (query: string) => void;
  performSearch: (query: string) => void;
  updateSearchFilters: (filters: Partial<SearchFilters>) => void;
  clearSearch: () => void;
  
  // Theme management
  setTheme: (theme: Theme) => void;
  
  // Notification management
  addNotification: (type: NotificationType, message: string, autoClose?: boolean) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Loading state
  setLoading: (isLoading: boolean, message?: string, progress?: number) => void;
  
  // Utility
  reset: () => void;
}

/**
 * Combined UI store type
 */
export interface UIStore extends UIState, UIActions {}