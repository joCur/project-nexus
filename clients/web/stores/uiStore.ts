/**
 * UI Store Implementation
 * 
 * Manages UI state including sidebars, modals, toolbars, search, theme,
 * notifications, and loading states for the infinite canvas system.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  UIStore,
  UIState,
  SidebarState,
  ToolbarState,
  ModalState,
  SearchState,
  Notification,
  LoadingState,
  CanvasTool,
  SidebarPanel,
  ModalType,
  NotificationType,
  Theme,
  SearchFilters,
} from '@/types/ui.types';
import type { EntityId } from '@/types/common.types';

/**
 * Generate a unique ID for notifications
 */
const generateId = (): string => {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Default sidebar state
 */
const DEFAULT_SIDEBAR: SidebarState = {
  isOpen: false,
  activePanel: null,
  width: 320,
  position: 'left',
};

/**
 * Default toolbar state
 */
const DEFAULT_TOOLBAR: ToolbarState = {
  activeTool: 'select',
  isVisible: true,
  position: 'top',
};

/**
 * Default modal state
 */
const DEFAULT_MODAL: ModalState = {
  type: null,
  data: {},
  isOpen: false,
};

/**
 * Default search state
 */
const DEFAULT_SEARCH: SearchState = {
  query: '',
  isActive: false,
  results: {
    cards: [],
    connections: [],
  },
  filters: {
    types: [],
    tags: [],
    dateRange: undefined,
  },
};

/**
 * Default loading state
 */
const DEFAULT_LOADING: LoadingState = {
  isLoading: false,
  message: undefined,
  progress: undefined,
};

/**
 * UI store implementation
 */
export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        sidebar: DEFAULT_SIDEBAR,
        toolbar: DEFAULT_TOOLBAR,
        modal: DEFAULT_MODAL,
        search: DEFAULT_SEARCH,
        theme: 'light',
        notifications: [],
        loading: DEFAULT_LOADING,

        // Sidebar management
        toggleSidebar: () => {
          set((state) => ({
            sidebar: {
              ...state.sidebar,
              isOpen: !state.sidebar.isOpen,
            },
          }));
        },

        setSidebarPanel: (panel: SidebarPanel | null) => {
          set((state) => ({
            sidebar: {
              ...state.sidebar,
              activePanel: panel,
              isOpen: panel !== null, // Auto-open sidebar when selecting a panel
            },
          }));
        },

        setSidebarWidth: (width: number) => {
          // Clamp width between reasonable min/max values
          const clampedWidth = Math.max(240, Math.min(600, width));
          
          set((state) => ({
            sidebar: {
              ...state.sidebar,
              width: clampedWidth,
            },
          }));
        },

        setSidebarPosition: (position: 'left' | 'right') => {
          set((state) => ({
            sidebar: {
              ...state.sidebar,
              position,
            },
          }));
        },

        // Toolbar management
        setActiveTool: (tool: CanvasTool) => {
          set((state) => ({
            toolbar: {
              ...state.toolbar,
              activeTool: tool,
            },
          }));
        },

        toggleToolbar: () => {
          set((state) => ({
            toolbar: {
              ...state.toolbar,
              isVisible: !state.toolbar.isVisible,
            },
          }));
        },

        setToolbarPosition: (position: 'top' | 'bottom' | 'floating') => {
          set((state) => ({
            toolbar: {
              ...state.toolbar,
              position,
            },
          }));
        },

        // Modal management
        openModal: (type: ModalType, data: Record<string, any> = {}) => {
          set({
            modal: {
              type,
              data,
              isOpen: true,
            },
          });
        },

        closeModal: () => {
          set({
            modal: DEFAULT_MODAL,
          });
        },

        updateModalData: (data: Record<string, any>) => {
          set((state) => ({
            modal: {
              ...state.modal,
              data: {
                ...state.modal.data,
                ...data,
              },
            },
          }));
        },

        // Search management
        setSearchQuery: (query: string) => {
          set((state) => ({
            search: {
              ...state.search,
              query,
              isActive: query.length > 0,
            },
          }));
        },

        performSearch: (query: string) => {
          // This is a placeholder for actual search implementation
          // In a real implementation, this would:
          // 1. Query the card store for matching cards
          // 2. Query the connection store for matching connections
          // 3. Apply filters
          // 4. Update results
          
          set((state) => ({
            search: {
              ...state.search,
              query,
              isActive: true,
              results: {
                cards: [], // Would be populated with actual search results
                connections: [], // Would be populated with actual search results
              },
            },
          }));
          
          // TODO: Implement actual search logic when integrating with card/connection stores
        },

        updateSearchFilters: (filters: Partial<SearchFilters>) => {
          set((state) => ({
            search: {
              ...state.search,
              filters: {
                ...state.search.filters,
                ...filters,
              },
            },
          }));
        },

        clearSearch: () => {
          set((state) => ({
            search: DEFAULT_SEARCH,
          }));
        },

        // Theme management
        setTheme: (theme: Theme) => {
          set({ theme });
          
          // Apply theme to document root
          if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.classList.toggle('dark', prefersDark);
          } else {
            document.documentElement.classList.toggle('dark', theme === 'dark');
          }
        },

        // Notification management
        addNotification: (type: NotificationType, message: string, autoClose: boolean = true) => {
          const id = generateId();
          const notification: Notification = {
            id,
            type,
            message,
            timestamp: new Date().toISOString(),
            autoClose,
          };
          
          set((state) => ({
            notifications: [...state.notifications, notification],
          }));
          
          // Auto-close notification after 5 seconds if enabled
          if (autoClose) {
            setTimeout(() => {
              get().removeNotification(id);
            }, 5000);
          }
          
          return id;
        },

        removeNotification: (id: string) => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        },

        clearNotifications: () => {
          set({ notifications: [] });
        },

        // Loading state
        setLoading: (isLoading: boolean, message?: string, progress?: number) => {
          set({
            loading: {
              isLoading,
              message,
              progress: progress !== undefined ? Math.max(0, Math.min(100, progress)) : undefined,
            },
          });
        },

        // Utility
        reset: () => {
          set({
            sidebar: DEFAULT_SIDEBAR,
            toolbar: DEFAULT_TOOLBAR,
            modal: DEFAULT_MODAL,
            search: DEFAULT_SEARCH,
            theme: 'light',
            notifications: [],
            loading: DEFAULT_LOADING,
          });
        },
      }),
      {
        name: 'ui-store',
        // Persist UI preferences but not temporary states
        partialize: (state) => ({
          sidebar: {
            width: state.sidebar.width,
            position: state.sidebar.position,
          },
          toolbar: {
            position: state.toolbar.position,
          },
          theme: state.theme,
        }),
      }
    ),
    {
      name: 'UIStore',
    }
  )
);

// Selectors for common use cases
export const uiSelectors = {
  isSidebarOpen: (state: UIStore) => state.sidebar.isOpen,
  getActivePanel: (state: UIStore) => state.sidebar.activePanel,
  getActiveTool: (state: UIStore) => state.toolbar.activeTool,
  isModalOpen: (state: UIStore) => state.modal.isOpen,
  getModalType: (state: UIStore) => state.modal.type,
  getTheme: (state: UIStore) => state.theme,
  getNotifications: (state: UIStore) => state.notifications,
  isLoading: (state: UIStore) => state.loading.isLoading,
  getSearchQuery: (state: UIStore) => state.search.query,
  isSearchActive: (state: UIStore) => state.search.isActive,
  hasNotifications: (state: UIStore) => state.notifications.length > 0,
  getUnreadNotificationCount: (state: UIStore) => 
    state.notifications.filter((n) => n.type === 'error' || n.type === 'warning').length,
};

// Helper hooks for common UI operations
export const useNotification = () => {
  const addNotification = useUIStore((state) => state.addNotification);
  
  return {
    info: (message: string, autoClose?: boolean) => 
      addNotification('info', message, autoClose),
    success: (message: string, autoClose?: boolean) => 
      addNotification('success', message, autoClose),
    warning: (message: string, autoClose?: boolean) => 
      addNotification('warning', message, autoClose),
    error: (message: string, autoClose?: boolean) => 
      addNotification('error', message, autoClose),
  };
};

export const useLoading = () => {
  const setLoading = useUIStore((state) => state.setLoading);
  const isLoading = useUIStore((state) => state.loading.isLoading);
  
  return {
    start: (message?: string) => setLoading(true, message),
    update: (message?: string, progress?: number) => setLoading(true, message, progress),
    stop: () => setLoading(false),
    isLoading,
  };
};