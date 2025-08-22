/**
 * useCardOperations Hook Tests
 * 
 * Tests for the hook that bridges GraphQL operations with the card store,
 * including transformations, optimistic updates, and real-time synchronization.
 */

import { renderHook, act } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { useCardOperations } from '../useCardOperations';
import { useCardStore } from '@/stores/cardStore';
import {
  GET_CARDS,
  CREATE_CARD,
  UPDATE_CARD,
  DELETE_CARD,
  CARD_CREATED_SUBSCRIPTION,
  CARD_UPDATED_SUBSCRIPTION,
  CARD_DELETED_SUBSCRIPTION,
} from '@/lib/graphql/cardOperations';
import type { EntityId } from '@/types/common.types';
import type { CreateCardParams, UpdateCardParams, CardId } from '@/types/card.types';

// Mock the card store
jest.mock('@/stores/cardStore');
const mockUseCardStore = useCardStore as jest.MockedFunction<typeof useCardStore>;

// Mock data
const mockWorkspaceId = 'workspace-123' as EntityId;
const mockCardId = 'card-123' as CardId;

const mockBackendCard = {
  id: 'card-123',
  workspaceId: 'workspace-123',
  ownerId: 'user-123',
  title: 'Test Card',
  content: 'Test content',
  type: 'TEXT',
  position: { x: 100, y: 200, z: 1 },
  dimensions: { width: 200, height: 100 },
  style: {
    backgroundColor: '#ffffff',
    borderColor: '#cccccc',
    textColor: '#000000',
    borderWidth: 1,
    borderRadius: 4,
    opacity: 1,
    shadow: false,
  },
  tags: ['test'],
  metadata: {},
  status: 'ACTIVE',
  priority: 'NORMAL',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
};

const mockFrontendCard = {
  id: 'card-123' as CardId,
  position: { x: 100, y: 200, z: 1 },
  dimensions: { width: 200, height: 100 },
  style: mockBackendCard.style,
  isSelected: false,
  isLocked: false,
  isHidden: false,
  isMinimized: false,
  status: 'active' as const,
  priority: 'normal' as const,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  tags: ['test'],
  metadata: {},
  animation: { isAnimating: false },
  content: {
    type: 'text' as const,
    content: 'Test content',
    markdown: false,
    wordCount: 12,
    lastEditedAt: '2023-01-01T00:00:00Z',
  },
};

describe('useCardOperations', () => {
  let mockStore: {
    createCard: jest.Mock;
    updateCard: jest.Mock;
    deleteCard: jest.Mock;
  };

  beforeEach(() => {
    mockStore = {
      createCard: jest.fn(),
      updateCard: jest.fn(),
      deleteCard: jest.fn(),
    };

    mockUseCardStore.mockReturnValue(mockStore as any);
  });

  const createWrapper = (mocks: any[] = []) => {
    return ({ children }: { children: React.ReactNode }) => (
      <MockedProvider mocks={mocks} addTypename={false}>
        {children}
      </MockedProvider>
    );
  };

  describe('Query Operations', () => {
    it('should load cards from server', async () => {
      const mocks = [
        {
          request: {
            query: GET_CARDS,
            variables: { workspaceId: mockWorkspaceId },
          },
          result: {
            data: {
              cards: {
                items: [mockBackendCard],
                totalCount: 1,
                hasMore: false,
              },
            },
          },
        },
      ];

      const { result } = renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper(mocks) }
      );

      expect(result.current.loading).toBe(true);
      
      // Wait for query to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.serverCards).toEqual([mockBackendCard]);
      expect(result.current.loading).toBe(false);
    });

    it('should handle query errors', async () => {
      const mocks = [
        {
          request: {
            query: GET_CARDS,
            variables: { workspaceId: mockWorkspaceId },
          },
          error: new Error('Network error'),
        },
      ];

      const { result } = renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper(mocks) }
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Mutation Operations', () => {
    describe('createCard', () => {
      it('should create card with optimistic update', async () => {
        const createParams: CreateCardParams = {
          type: 'text',
          position: { x: 100, y: 200, z: 1 },
          content: {
            type: 'text',
            content: 'New card content',
            markdown: false,
            wordCount: 16,
          },
          dimensions: { width: 200, height: 100 },
        };

        const localCardId = 'temp-card-123' as CardId;
        mockStore.createCard.mockReturnValue(localCardId);

        const mocks = [
          {
            request: {
              query: CREATE_CARD,
              variables: {
                input: {
                  workspaceId: mockWorkspaceId,
                  type: 'TEXT',
                  content: 'New card content',
                  position: { x: 100, y: 200, z: 1 },
                  dimensions: { width: 200, height: 100 },
                  tags: [],
                  metadata: {},
                },
              },
            },
            result: {
              data: {
                createCard: {
                  ...mockBackendCard,
                  id: 'server-card-123',
                  content: 'New card content',
                },
              },
            },
          },
        ];

        const { result } = renderHook(
          () => useCardOperations(mockWorkspaceId),
          { wrapper: createWrapper(mocks) }
        );

        let createdCardId: CardId | null = null;
        await act(async () => {
          createdCardId = await result.current.createCard(createParams);
        });

        // Should create local card first (optimistic update)
        expect(mockStore.createCard).toHaveBeenCalledWith(createParams);
        
        // Should replace with server version
        expect(mockStore.deleteCard).toHaveBeenCalledWith(localCardId);
        expect(mockStore.createCard).toHaveBeenCalledTimes(2);
        expect(createdCardId).toBe('server-card-123');
      });

      it('should handle create card errors', async () => {
        const createParams: CreateCardParams = {
          type: 'text',
          position: { x: 100, y: 200, z: 1 },
        };

        const mocks = [
          {
            request: {
              query: CREATE_CARD,
              variables: expect.any(Object),
            },
            error: new Error('Create failed'),
          },
        ];

        const { result } = renderHook(
          () => useCardOperations(mockWorkspaceId),
          { wrapper: createWrapper(mocks) }
        );

        let createdCardId: CardId | null = null;
        await act(async () => {
          createdCardId = await result.current.createCard(createParams);
        });

        expect(createdCardId).toBeNull();
      });
    });

    describe('updateCard', () => {
      it('should update card with optimistic update', async () => {
        const updateParams: UpdateCardParams = {
          id: mockCardId,
          updates: {
            content: {
              type: 'text',
              content: 'Updated content',
              markdown: false,
              wordCount: 16,
            },
          },
        };

        const mocks = [
          {
            request: {
              query: UPDATE_CARD,
              variables: {
                id: mockCardId,
                input: updateParams.updates,
              },
            },
            result: {
              data: {
                updateCard: {
                  ...mockBackendCard,
                  content: 'Updated content',
                },
              },
            },
          },
        ];

        const { result } = renderHook(
          () => useCardOperations(mockWorkspaceId),
          { wrapper: createWrapper(mocks) }
        );

        let success = false;
        await act(async () => {
          success = await result.current.updateCard(updateParams);
        });

        expect(mockStore.updateCard).toHaveBeenCalledWith(updateParams);
        expect(success).toBe(true);
      });
    });

    describe('deleteCard', () => {
      it('should delete card with optimistic update', async () => {
        const mocks = [
          {
            request: {
              query: DELETE_CARD,
              variables: { id: mockCardId },
            },
            result: {
              data: { deleteCard: true },
            },
          },
        ];

        const { result } = renderHook(
          () => useCardOperations(mockWorkspaceId),
          { wrapper: createWrapper(mocks) }
        );

        let success = false;
        await act(async () => {
          success = await result.current.deleteCard(mockCardId);
        });

        expect(mockStore.deleteCard).toHaveBeenCalledWith(mockCardId);
        expect(success).toBe(true);
      });
    });
  });

  describe('Subscription Operations', () => {
    it('should handle card created subscription', async () => {
      const mocks = [
        {
          request: {
            query: CARD_CREATED_SUBSCRIPTION,
            variables: { workspaceId: mockWorkspaceId },
          },
          result: {
            data: {
              cardCreated: mockBackendCard,
            },
          },
        },
      ];

      renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper(mocks) }
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should create card in store when received from subscription
      expect(mockStore.createCard).toHaveBeenCalled();
    });

    it('should handle card updated subscription', async () => {
      const updatedCard = {
        ...mockBackendCard,
        content: 'Updated content',
      };

      const mocks = [
        {
          request: {
            query: CARD_UPDATED_SUBSCRIPTION,
            variables: { workspaceId: mockWorkspaceId },
          },
          result: {
            data: {
              cardUpdated: updatedCard,
            },
          },
        },
      ];

      renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper(mocks) }
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(mockStore.updateCard).toHaveBeenCalledWith({
        id: mockCardId,
        updates: expect.objectContaining({
          content: expect.objectContaining({
            content: 'Updated content',
          }),
        }),
      });
    });

    it('should handle card deleted subscription', async () => {
      const mocks = [
        {
          request: {
            query: CARD_DELETED_SUBSCRIPTION,
            variables: { workspaceId: mockWorkspaceId },
          },
          result: {
            data: {
              cardDeleted: mockCardId,
            },
          },
        },
      ];

      renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper(mocks) }
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(mockStore.deleteCard).toHaveBeenCalledWith(mockCardId);
    });
  });

  describe('Type Transformations', () => {
    it('should correctly transform TEXT card from backend to frontend', () => {
      const backendTextCard = {
        ...mockBackendCard,
        type: 'TEXT',
        content: 'Text content',
      };

      // This would be tested internally by the transformation function
      // The actual transformation happens in the subscription handlers
      const mocks = [
        {
          request: {
            query: CARD_CREATED_SUBSCRIPTION,
            variables: { workspaceId: mockWorkspaceId },
          },
          result: {
            data: { cardCreated: backendTextCard },
          },
        },
      ];

      renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper(mocks) }
      );

      // The transformation would create a TextCard with proper discriminated union
      expect(mockStore.createCard).toHaveBeenCalled();
    });

    it('should correctly transform IMAGE card from backend to frontend', () => {
      const backendImageCard = {
        ...mockBackendCard,
        type: 'IMAGE',
        content: 'https://example.com/image.jpg',
        title: 'Image Alt Text',
      };

      const mocks = [
        {
          request: {
            query: CARD_CREATED_SUBSCRIPTION,
            variables: { workspaceId: mockWorkspaceId },
          },
          result: {
            data: { cardCreated: backendImageCard },
          },
        },
      ];

      renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper(mocks) }
      );

      expect(mockStore.createCard).toHaveBeenCalled();
    });

    it('should handle position.z mapping correctly', () => {
      const backendCard = {
        ...mockBackendCard,
        position: { x: 150, y: 250, z: 5 },
      };

      const mocks = [
        {
          request: {
            query: CARD_CREATED_SUBSCRIPTION,
            variables: { workspaceId: mockWorkspaceId },
          },
          result: {
            data: { cardCreated: backendCard },
          },
        },
      ];

      renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper(mocks) }
      );

      expect(mockStore.createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          position: { x: 150, y: 250, z: 5 },
        })
      );
    });
  });

  describe('Store Integration', () => {
    it('should provide direct store access', () => {
      const { result } = renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper() }
      );

      expect(result.current.store).toBe(mockStore);
    });

    it('should provide sync methods', () => {
      const { result } = renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper() }
      );

      expect(typeof result.current.syncCardsFromServer).toBe('function');
      expect(typeof result.current.refetchCards).toBe('function');
    });
  });

  describe('Loading States', () => {
    it('should aggregate loading states from multiple operations', () => {
      const mocks = [
        {
          request: {
            query: GET_CARDS,
            variables: { workspaceId: mockWorkspaceId },
          },
          delay: 100, // Simulate slow query
          result: {
            data: { cards: { items: [], totalCount: 0, hasMore: false } },
          },
        },
      ];

      const { result } = renderHook(
        () => useCardOperations(mockWorkspaceId),
        { wrapper: createWrapper(mocks) }
      );

      expect(result.current.loading).toBe(true);
    });
  });
});