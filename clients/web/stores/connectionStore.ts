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
  ConnectionStyle,
  ConnectionInteraction,
  ConnectionState,
  ConnectionId
} from '@/types/connection.types';
import { ConnectionType, createConnectionId } from '@/types/connection.types';
import type { Position, EntityId } from '@/types/common.types';
import type { CanvasPosition } from '@/types/canvas.types';

/**
 * Generate a unique connection ID
 */
const generateConnectionId = (): ConnectionId => {
  return createConnectionId();
};

/**
 * Default connection style by type
 */
const DEFAULT_STYLES: Record<ConnectionType, ConnectionStyle> = {
  [ConnectionType.MANUAL]: {
    color: '#6b7280',
    width: 2,
    opacity: 1,
    curve: 'curved',
    showArrow: true,
    showLabel: false,
  },
  [ConnectionType.AI_SUGGESTED]: {
    color: '#8b5cf6',
    width: 2,
    dashArray: '5,5',
    opacity: 0.7,
    curve: 'curved',
    showArrow: true,
    showLabel: false,
  },
  [ConnectionType.AI_GENERATED]: {
    color: '#10b981',
    width: 2,
    opacity: 0.8,
    curve: 'curved',
    showArrow: true,
    showLabel: false,
  },
  [ConnectionType.REFERENCE]: {
    color: '#f59e0b',
    width: 1.5,
    dashArray: '3,3',
    opacity: 0.8,
    curve: 'straight',
    showArrow: true,
    showLabel: false,
  },
  [ConnectionType.DEPENDENCY]: {
    color: '#ef4444',
    width: 2,
    opacity: 1,
    curve: 'straight',
    showArrow: true,
    showLabel: true,
  },
  [ConnectionType.SIMILARITY]: {
    color: '#06b6d4',
    width: 1.5,
    opacity: 0.8,
    curve: 'curved',
    showArrow: false,
    showLabel: false,
  },
  [ConnectionType.RELATED]: {
    color: '#6b7280',
    width: 1.5,
    opacity: 0.8,
    curve: 'curved',
    showArrow: false,
    showLabel: false,
  },
};

/**
 * Default connection filters
 */
const DEFAULT_FILTERS = {
  types: new Set(Object.values(ConnectionType)),
  minConfidence: 0.0,
  showAI: true,
  showManual: true,
};

/**
 * Default interaction state
 */
const DEFAULT_INTERACTION: ConnectionInteraction = {
  isCreating: false,
  sourceCardId: undefined,
  currentPosition: undefined,
  hoveredConnectionId: undefined,
  selectedConnectionIds: new Set(),
};

/**
 * Helper function to check if cards are connected
 */
const areCardsConnected = (connections: Map<ConnectionId, Connection>, sourceCardId: EntityId, targetCardId: EntityId): boolean => {
  return Array.from(connections.values()).some(
    (conn) =>
      (conn.sourceCardId === sourceCardId && conn.targetCardId === targetCardId) ||
      (conn.sourceCardId === targetCardId && conn.targetCardId === sourceCardId)
  );
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
        suggestions: [],
        interaction: DEFAULT_INTERACTION,
        filters: DEFAULT_FILTERS,

        // CRUD operations
        createConnection: (sourceCardId: EntityId, targetCardId: EntityId, type: ConnectionType, metadata?: Record<string, any>) => {
          // Prevent self-connections
          if (sourceCardId === targetCardId) return '' as ConnectionId;
          
          // Check if connection already exists
          if (areCardsConnected(get().connections, sourceCardId, targetCardId)) return '' as ConnectionId;
          
          const now = new Date().toISOString();
          const newConnection: Connection = {
            id: generateConnectionId(),
            sourceCardId,
            targetCardId,
            type,
            confidence: type === ConnectionType.AI_SUGGESTED || type === ConnectionType.AI_GENERATED ? 0.5 : 1.0,
            style: DEFAULT_STYLES[type],
            metadata: metadata || {},
            createdAt: now,
            updatedAt: now,
            createdBy: 'user' as EntityId, // TODO: Get from auth context
            isVisible: true,
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

        updateConnection: (id: ConnectionId, updates: Partial<Connection>) => {
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

        deleteConnection: (id: ConnectionId) => {
          set((state) => {
            const newConnections = new Map(state.connections);
            newConnections.delete(id);
            
            const newSelectedIds = new Set(state.interaction.selectedConnectionIds);
            newSelectedIds.delete(id);
            
            return {
              connections: newConnections,
              interaction: {
                ...state.interaction,
                selectedConnectionIds: newSelectedIds,
              },
            };
          });
        },

        deleteConnections: (ids: ConnectionId[]) => {
          set((state) => {
            const newConnections = new Map(state.connections);
            const newSelectedIds = new Set(state.interaction.selectedConnectionIds);
            
            ids.forEach((id) => {
              newConnections.delete(id);
              newSelectedIds.delete(id);
            });
            
            return {
              connections: newConnections,
              interaction: {
                ...state.interaction,
                selectedConnectionIds: newSelectedIds,
              },
            };
          });
        },

        // Selection management
        selectConnection: (id: ConnectionId) => {
          set((state) => {
            const newSelectedIds = new Set(state.interaction.selectedConnectionIds);
            newSelectedIds.add(id);
            
            return {
              interaction: {
                ...state.interaction,
                selectedConnectionIds: newSelectedIds,
              },
            };
          });
        },

        selectMultiple: (ids: ConnectionId[]) => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              selectedConnectionIds: new Set(ids),
            },
          }));
        },
        
        clearSelection: () => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              selectedConnectionIds: new Set(),
            },
          }));
        },

        // Suggestion management
        acceptSuggestion: (suggestionId: string) => {
          // Stub implementation
          return '' as ConnectionId;
        },
        
        rejectSuggestion: (suggestionId: string) => {
          // Stub implementation
        },
        
        clearSuggestions: () => {
          set({ suggestions: [] });
        },
        
        // Interaction management
        startConnectionCreation: (sourceCardId: EntityId, position: CanvasPosition) => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              isCreating: true,
              sourceCardId,
              currentPosition: position,
            },
          }));
        },

        updateConnectionCreation: (position: CanvasPosition) => {
          set((state) => ({
            interaction: {
              ...state.interaction,
              currentPosition: position,
            },
          }));
        },

        endConnectionCreation: (targetCardId?: EntityId) => {
          const { sourceCardId } = get().interaction;
          
          if (!sourceCardId || !targetCardId || sourceCardId === targetCardId) {
            set((state) => ({
              interaction: {
                ...state.interaction,
                isCreating: false,
                sourceCardId: undefined,
                currentPosition: undefined,
              },
            }));
            return null;
          }
          
          const newId = get().createConnection(sourceCardId, targetCardId, ConnectionType.MANUAL);
          
          set((state) => ({
            interaction: {
              ...state.interaction,
              isCreating: false,
              sourceCardId: undefined,
              currentPosition: undefined,
            },
          }));
          
          return newId;
        },

        // Filtering and visibility
        setTypeFilter: (types: Set<ConnectionType>) => {
          set((state) => ({
            filters: {
              ...state.filters,
              types,
            },
          }));
        },
        
        setConfidenceFilter: (minConfidence: number) => {
          set((state) => ({
            filters: {
              ...state.filters,
              minConfidence,
            },
          }));
        },
        
        toggleConnectionVisibility: (id: ConnectionId) => {
          const connection = get().connections.get(id);
          if (connection) {
            get().updateConnection(id, { isVisible: !connection.isVisible });
          }
        },

        // Utility methods
        getConnection: (id: ConnectionId) => get().connections.get(id),

        getConnections: (cardId?: EntityId) => {
          if (cardId) {
            return Array.from(get().connections.values()).filter(
              (conn) => conn.sourceCardId === cardId || conn.targetCardId === cardId
            );
          }
          return Array.from(get().connections.values());
        },

        getConnectionsByType: (type: ConnectionType) => {
          return Array.from(get().connections.values()).filter(
            (conn) => conn.type === type
          );
        },



        findShortestPath: (sourceCardId: EntityId, targetCardId: EntityId) => {
          // Simple BFS implementation for finding shortest path
          const connections = get().connections;
          const adjacencyMap = new Map<EntityId, Set<EntityId>>();
          
          // Build adjacency map
          connections.forEach((conn) => {
            if (!adjacencyMap.has(conn.sourceCardId)) {
              adjacencyMap.set(conn.sourceCardId, new Set());
            }
            if (!adjacencyMap.has(conn.targetCardId)) {
              adjacencyMap.set(conn.targetCardId, new Set());
            }
            adjacencyMap.get(conn.sourceCardId)?.add(conn.targetCardId);
            adjacencyMap.get(conn.targetCardId)?.add(conn.sourceCardId);
          });
          
          // BFS to find shortest path
          const queue: Array<{ id: EntityId; path: EntityId[] }> = [
            { id: sourceCardId, path: [sourceCardId] },
          ];
          const visited = new Set<EntityId>([sourceCardId]);
          
          while (queue.length > 0) {
            const current = queue.shift();
            if (!current) continue;
            
            if (current.id === targetCardId) {
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
  getConnectionById: (id: ConnectionId) => (state: ConnectionStore) => state.connections.get(id),
  getVisibleConnections: (state: ConnectionStore) => {
    const { filters } = state;
    return Array.from(state.connections.values()).filter((conn) => {
      // Check type filter
      if (!filters.types.has(conn.type)) return false;
      
      // Check confidence filter for AI connections
      if ((conn.type === ConnectionType.AI_SUGGESTED || conn.type === ConnectionType.AI_GENERATED) && 
          conn.confidence < filters.minConfidence) {
        return false;
      }
      
      return conn.isVisible;
    });
  },
  getSelectedConnections: (state: ConnectionStore) => {
    const { selectedConnectionIds } = state.interaction;
    return Array.from(selectedConnectionIds)
      .map(id => state.connections.get(id))
      .filter((conn): conn is Connection => conn !== undefined);
  },
  isCreatingConnection: (state: ConnectionStore) => state.interaction.isCreating,
  getConnectionsForCard: (cardId: EntityId) => (state: ConnectionStore) => 
    state.getConnections(cardId),
};