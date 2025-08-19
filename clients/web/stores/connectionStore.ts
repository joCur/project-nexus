/**
 * Connection Store Implementation
 * 
 * Manages connections between cards, including creation, selection, filtering,
 * and pathfinding operations for the infinite canvas system.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  ConnectionStore,
  Connection,
  ConnectionType,
  ConnectionStyle,
  ConnectionRenderState,
  ConnectionFilters,
} from '@/types/connection.types';
import type { Position, EntityId } from '@/types/common.types';

/**
 * Generate a unique ID for connections
 */
const generateId = (): EntityId => {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Default connection style by type
 */
const DEFAULT_STYLES: Record<ConnectionType, ConnectionStyle> = {
  manual: {
    color: '#6b7280',
    width: 2,
    opacity: 1,
    animated: false,
  },
  'ai-suggested': {
    color: '#8b5cf6',
    width: 2,
    dashPattern: [5, 5],
    opacity: 0.7,
    animated: true,
  },
  related: {
    color: '#3b82f6',
    width: 1.5,
    dashPattern: [3, 3],
    opacity: 0.8,
    animated: false,
  },
  sequential: {
    color: '#10b981',
    width: 2,
    opacity: 1,
    animated: false,
  },
};

/**
 * Default connection filters
 */
const DEFAULT_FILTERS: ConnectionFilters = {
  showManual: true,
  showAISuggested: true,
  showRelated: true,
  showSequential: true,
  minStrength: 0,
};

/**
 * Default render state
 */
const DEFAULT_RENDER_STATE: ConnectionRenderState = {
  hoveredId: undefined,
  isCreating: false,
  createSource: undefined,
  createTarget: undefined,
  previewConnection: undefined,
};

/**
 * Connection store implementation
 */
export const useConnectionStore = create<ConnectionStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        connections: new Map(),
        renderState: DEFAULT_RENDER_STATE,
        selectedIds: new Set(),
        filters: DEFAULT_FILTERS,

        // CRUD operations
        createConnection: (sourceId: EntityId, targetId: EntityId, type: ConnectionType) => {
          // Prevent self-connections
          if (sourceId === targetId) return '';
          
          // Check if connection already exists
          if (get().areCardsConnected(sourceId, targetId)) return '';
          
          const newConnection: Connection = {
            id: generateId(),
            sourceId,
            targetId,
            type,
            style: DEFAULT_STYLES[type],
            strength: type === 'ai-suggested' ? 0.5 : 1.0,
            isSelected: false,
            isVisible: true,
            createdAt: new Date().toISOString(),
            metadata: {},
          };
          
          set((state) => {
            const newConnections = new Map(state.connections);
            newConnections.set(newConnection.id, newConnection);
            
            return {
              connections: newConnections,
            };
          });
          
          return newConnection.id;
        },

        updateConnection: (id: EntityId, updates: Partial<Connection>) => {
          set((state) => {
            const connection = state.connections.get(id);
            if (!connection) return state;
            
            const updatedConnection = {
              ...connection,
              ...updates,
            };
            
            const newConnections = new Map(state.connections);
            newConnections.set(id, updatedConnection);
            
            return {
              connections: newConnections,
            };
          });
        },

        deleteConnection: (id: EntityId) => {
          set((state) => {
            const newConnections = new Map(state.connections);
            newConnections.delete(id);
            
            const newSelectedIds = new Set(state.selectedIds);
            newSelectedIds.delete(id);
            
            return {
              connections: newConnections,
              selectedIds: newSelectedIds,
            };
          });
        },

        deleteConnections: (ids: EntityId[]) => {
          set((state) => {
            const newConnections = new Map(state.connections);
            const newSelectedIds = new Set(state.selectedIds);
            
            ids.forEach((id) => {
              newConnections.delete(id);
              newSelectedIds.delete(id);
            });
            
            return {
              connections: newConnections,
              selectedIds: newSelectedIds,
            };
          });
        },

        // Selection management
        selectConnection: (id: EntityId, addToSelection: boolean = false) => {
          set((state) => {
            const newSelectedIds = addToSelection
              ? new Set(state.selectedIds)
              : new Set<EntityId>();
            
            newSelectedIds.add(id);
            
            // Update the connection's selected state
            const connection = state.connections.get(id);
            if (connection) {
              const newConnections = new Map(state.connections);
              newConnections.set(id, { ...connection, isSelected: true });
              
              // Deselect others if not adding to selection
              if (!addToSelection) {
                state.selectedIds.forEach((otherId) => {
                  if (otherId !== id) {
                    const otherConn = newConnections.get(otherId);
                    if (otherConn) {
                      newConnections.set(otherId, { ...otherConn, isSelected: false });
                    }
                  }
                });
              }
              
              return {
                connections: newConnections,
                selectedIds: newSelectedIds,
              };
            }
            
            return {
              selectedIds: newSelectedIds,
            };
          });
        },

        clearSelection: () => {
          set((state) => {
            const newConnections = new Map(state.connections);
            
            state.selectedIds.forEach((id) => {
              const connection = newConnections.get(id);
              if (connection) {
                newConnections.set(id, { ...connection, isSelected: false });
              }
            });
            
            return {
              connections: newConnections,
              selectedIds: new Set(),
            };
          });
        },

        // Interactive creation
        startCreatingConnection: (sourceId: EntityId) => {
          set({
            renderState: {
              ...DEFAULT_RENDER_STATE,
              isCreating: true,
              createSource: sourceId,
            },
          });
        },

        updateConnectionPreview: (targetPosition: Position) => {
          set((state) => ({
            renderState: {
              ...state.renderState,
              createTarget: targetPosition,
            },
          }));
        },

        finishCreatingConnection: (targetId: EntityId) => {
          const { createSource } = get().renderState;
          
          if (!createSource || createSource === targetId) {
            get().cancelCreatingConnection();
            return null;
          }
          
          const newId = get().createConnection(createSource, targetId, 'manual');
          
          set({
            renderState: DEFAULT_RENDER_STATE,
          });
          
          return newId || null;
        },

        cancelCreatingConnection: () => {
          set({
            renderState: DEFAULT_RENDER_STATE,
          });
        },

        // Connection queries
        getConnection: (id: EntityId) => get().connections.get(id),

        getConnections: () => Array.from(get().connections.values()),

        getConnectionsForCard: (cardId: EntityId) => {
          return Array.from(get().connections.values()).filter(
            (conn) => conn.sourceId === cardId || conn.targetId === cardId
          );
        },

        getSelectedConnections: () => {
          const { selectedIds, connections } = get();
          return Array.from(selectedIds)
            .map((id) => connections.get(id))
            .filter((conn): conn is Connection => conn !== undefined);
        },

        // Filtering and visibility
        updateFilters: (filters: Partial<ConnectionFilters>) => {
          set((state) => ({
            filters: {
              ...state.filters,
              ...filters,
            },
          }));
        },

        toggleConnectionType: (type: ConnectionType) => {
          set((state) => {
            const filterKey = `show${type.charAt(0).toUpperCase()}${type.slice(1).replace('-', '')}` as keyof ConnectionFilters;
            
            return {
              filters: {
                ...state.filters,
                [filterKey]: !state.filters[filterKey],
              },
            };
          });
        },

        // Style management
        updateConnectionStyle: (id: EntityId, style: Partial<ConnectionStyle>) => {
          const connection = get().connections.get(id);
          if (!connection) return;
          
          get().updateConnection(id, {
            style: { ...connection.style, ...style },
          });
        },

        // Utility
        areCardsConnected: (sourceId: EntityId, targetId: EntityId) => {
          return Array.from(get().connections.values()).some(
            (conn) =>
              (conn.sourceId === sourceId && conn.targetId === targetId) ||
              (conn.sourceId === targetId && conn.targetId === sourceId)
          );
        },

        findShortestPath: (sourceId: EntityId, targetId: EntityId) => {
          // Simple BFS implementation for finding shortest path
          const connections = get().connections;
          const adjacencyMap = new Map<EntityId, Set<EntityId>>();
          
          // Build adjacency map
          connections.forEach((conn) => {
            if (!adjacencyMap.has(conn.sourceId)) {
              adjacencyMap.set(conn.sourceId, new Set());
            }
            if (!adjacencyMap.has(conn.targetId)) {
              adjacencyMap.set(conn.targetId, new Set());
            }
            adjacencyMap.get(conn.sourceId)?.add(conn.targetId);
            adjacencyMap.get(conn.targetId)?.add(conn.sourceId);
          });
          
          // BFS to find shortest path
          const queue: Array<{ id: EntityId; path: EntityId[] }> = [
            { id: sourceId, path: [sourceId] },
          ];
          const visited = new Set<EntityId>([sourceId]);
          
          while (queue.length > 0) {
            const current = queue.shift();
            if (!current) continue;
            
            if (current.id === targetId) {
              return current.path;
            }
            
            const neighbors = adjacencyMap.get(current.id) || new Set();
            for (const neighbor of neighbors) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({
                  id: neighbor,
                  path: [...current.path, neighbor],
                });
              }
            }
          }
          
          return []; // No path found
        },
      }),
      {
        name: 'connection-store',
        // Only persist connections and filters
        partialize: (state) => ({
          connections: Array.from(state.connections.entries()),
          filters: state.filters,
        }),
        // Custom merge function to handle Map serialization
        merge: (persistedState: any, currentState) => ({
          ...currentState,
          connections: new Map(persistedState?.connections || []),
          filters: persistedState?.filters || DEFAULT_FILTERS,
        }),
      }
    ),
    {
      name: 'ConnectionStore',
    }
  )
);

// Selectors for common use cases
export const connectionSelectors = {
  getAllConnections: (state: ConnectionStore) => Array.from(state.connections.values()),
  getConnectionById: (id: EntityId) => (state: ConnectionStore) => state.connections.get(id),
  getVisibleConnections: (state: ConnectionStore) => {
    const { filters } = state;
    return Array.from(state.connections.values()).filter((conn) => {
      // Check type filter
      const typeFilterMap: Record<ConnectionType, keyof ConnectionFilters> = {
        manual: 'showManual',
        'ai-suggested': 'showAISuggested',
        related: 'showRelated',
        sequential: 'showSequential',
      };
      
      if (!filters[typeFilterMap[conn.type]]) return false;
      
      // Check strength filter for AI connections
      if (conn.type === 'ai-suggested' && conn.strength < filters.minStrength) {
        return false;
      }
      
      return conn.isVisible;
    });
  },
  getSelectedConnections: (state: ConnectionStore) => state.getSelectedConnections(),
  isCreatingConnection: (state: ConnectionStore) => state.renderState.isCreating,
  getConnectionsForCard: (cardId: EntityId) => (state: ConnectionStore) => 
    state.getConnectionsForCard(cardId),
};