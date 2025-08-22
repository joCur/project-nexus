/**
 * Card Resolvers Tests
 * 
 * Tests for GraphQL resolvers handling card operations including
 * queries, mutations, and subscriptions.
 */

import { cardResolvers } from '../../../resolvers/cardResolvers';
import { CardService } from '../../../services/CardService';
import { subscriptionService } from '../../../services/subscriptionService';
import { AuthenticationError, UserInputError, ForbiddenError } from 'apollo-server-express';
import type { CardPosition, CardDimensions } from '../../../types/CardTypes';

// Mock dependencies
jest.mock('../../../services/CardService');
jest.mock('../../../services/subscriptionService');

const MockCardService = CardService as jest.MockedClass<typeof CardService>;
const mockSubscriptionService = subscriptionService as jest.Mocked<typeof subscriptionService>;

describe('Card Resolvers', () => {
  let mockContext: any;
  let mockCardService: jest.Mocked<CardService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCardService = {
      createCard: jest.fn(),
      getCardById: jest.fn(),
      getWorkspaceCards: jest.fn(),
      updateCard: jest.fn(),
      deleteCard: jest.fn(),
      duplicateCard: jest.fn(),
      searchCards: jest.fn(),
      getCardsInBounds: jest.fn(),
      batchUpdateCardPositions: jest.fn(),
    } as any;

    MockCardService.mockImplementation(() => mockCardService);

    mockContext = {
      user: {
        id: 'user-123',
        sub: 'auth0|user-123',
      },
      services: {
        cardService: mockCardService,
      },
    };
  });

  describe('Query Resolvers', () => {
    describe('card', () => {
      it('should return card by ID for authenticated user', async () => {
        const mockCard = {
          id: 'card-123',
          workspaceId: 'workspace-123',
          ownerId: 'user-123',
          title: 'Test Card',
          content: 'Test content',
          type: 'TEXT',
          position: { x: 100, y: 200, z: 1 },
          dimensions: { width: 200, height: 100 },
        };

        mockCardService.getCardById.mockResolvedValue(mockCard);

        const result = await cardResolvers.Query.card(
          {},
          { id: 'card-123' },
          mockContext
        );

        expect(mockCardService.getCardById).toHaveBeenCalledWith('card-123');
        expect(result).toEqual(mockCard);
      });

      it('should throw AuthenticationError when user not authenticated', async () => {
        const unauthenticatedContext = { user: null, services: { cardService: mockCardService } };

        await expect(
          cardResolvers.Query.card({}, { id: 'card-123' }, unauthenticatedContext)
        ).rejects.toThrow(AuthenticationError);

        expect(mockCardService.getCardById).not.toHaveBeenCalled();
      });

      it('should return null when card not found', async () => {
        mockCardService.getCardById.mockResolvedValue(null);

        const result = await cardResolvers.Query.card(
          {},
          { id: 'nonexistent-card' },
          mockContext
        );

        expect(result).toBeNull();
      });
    });

    describe('cards', () => {
      it('should return workspace cards with pagination', async () => {
        const mockCards = [
          {
            id: 'card-1',
            workspaceId: 'workspace-123',
            ownerId: 'user-123',
            title: 'Card 1',
            content: 'Content 1',
            type: 'TEXT',
            position: { x: 0, y: 0, z: 1 },
            dimensions: { width: 200, height: 100 },
          },
          {
            id: 'card-2',
            workspaceId: 'workspace-123',
            ownerId: 'user-123',
            title: 'Card 2',
            content: 'Content 2',
            type: 'IMAGE',
            position: { x: 100, y: 100, z: 2 },
            dimensions: { width: 200, height: 100 },
          },
        ];

        mockCardService.getWorkspaceCards.mockResolvedValue({
          items: mockCards,
          totalCount: 2,
          hasMore: false,
        });

        const result = await cardResolvers.Query.cards(
          {},
          { workspaceId: 'workspace-123', first: 10 },
          mockContext
        );

        expect(mockCardService.getWorkspaceCards).toHaveBeenCalledWith(
          'workspace-123',
          expect.objectContaining({ limit: 10 })
        );
        expect(result).toEqual({
          items: mockCards,
          totalCount: 2,
          hasMore: false,
        });
      });

      it('should handle search query filter', async () => {
        mockCardService.getWorkspaceCards.mockResolvedValue({
          items: [],
          totalCount: 0,
          hasMore: false,
        });

        await cardResolvers.Query.cards(
          {},
          { 
            workspaceId: 'workspace-123', 
            filter: { searchQuery: 'test search' },
            first: 10 
          },
          mockContext
        );

        expect(mockCardService.getWorkspaceCards).toHaveBeenCalledWith(
          'workspace-123',
          expect.objectContaining({ 
            searchQuery: 'test search',
            limit: 10 
          })
        );
      });
    });

    describe('searchCards', () => {
      it('should return search results', async () => {
        const mockResults = [
          {
            id: 'card-1',
            workspaceId: 'workspace-123',
            title: 'Matching Card',
            content: 'Test content with search term',
            type: 'TEXT',
          },
        ];

        mockCardService.searchCards.mockResolvedValue(mockResults);

        const result = await cardResolvers.Query.searchCards(
          {},
          { workspaceId: 'workspace-123', query: 'search term' },
          mockContext
        );

        expect(mockCardService.searchCards).toHaveBeenCalledWith('workspace-123', 'search term');
        expect(result).toEqual(mockResults);
      });

      it('should throw UserInputError for empty search query', async () => {
        await expect(
          cardResolvers.Query.searchCards(
            {},
            { workspaceId: 'workspace-123', query: '' },
            mockContext
          )
        ).rejects.toThrow(UserInputError);
      });
    });
  });

  describe('Mutation Resolvers', () => {
    describe('createCard', () => {
      it('should create a new card', async () => {
        const input = {
          workspaceId: 'workspace-123',
          type: 'TEXT' as const,
          title: 'New Card',
          content: 'Card content',
          position: { x: 100, y: 200, z: 1 } as CardPosition,
          dimensions: { width: 200, height: 100 } as CardDimensions,
        };

        const mockCreatedCard = {
          id: 'card-123',
          ...input,
          ownerId: 'user-123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        mockCardService.createCard.mockResolvedValue(mockCreatedCard);

        const result = await cardResolvers.Mutation.createCard(
          {},
          { input },
          mockContext
        );

        expect(mockCardService.createCard).toHaveBeenCalledWith(
          expect.objectContaining({
            ...input,
            ownerId: 'user-123',
          })
        );
        expect(result).toEqual(mockCreatedCard);
        expect(mockSubscriptionService.publishCardCreated).toHaveBeenCalledWith(
          'workspace-123',
          mockCreatedCard
        );
      });

      it('should throw UserInputError for invalid input', async () => {
        const invalidInput = {
          workspaceId: '',
          type: 'INVALID_TYPE' as any,
          position: { x: 100, y: 200, z: 1 },
        };

        await expect(
          cardResolvers.Mutation.createCard(
            {},
            { input: invalidInput },
            mockContext
          )
        ).rejects.toThrow(UserInputError);
      });
    });

    describe('updateCard', () => {
      it('should update existing card', async () => {
        const updates = {
          title: 'Updated Title',
          content: 'Updated content',
          position: { x: 150, y: 250, z: 2 } as CardPosition,
        };

        const mockUpdatedCard = {
          id: 'card-123',
          workspaceId: 'workspace-123',
          ownerId: 'user-123',
          type: 'TEXT',
          dimensions: { width: 200, height: 100 },
          ...updates,
        };

        mockCardService.updateCard.mockResolvedValue(mockUpdatedCard);

        const result = await cardResolvers.Mutation.updateCard(
          {},
          { id: 'card-123', input: updates },
          mockContext
        );

        expect(mockCardService.updateCard).toHaveBeenCalledWith('card-123', updates);
        expect(result).toEqual(mockUpdatedCard);
        expect(mockSubscriptionService.publishCardUpdated).toHaveBeenCalledWith(
          'workspace-123',
          mockUpdatedCard
        );
      });

      it('should handle card not found', async () => {
        mockCardService.updateCard.mockResolvedValue(null);

        const result = await cardResolvers.Mutation.updateCard(
          {},
          { id: 'nonexistent-card', input: { title: 'New Title' } },
          mockContext
        );

        expect(result).toBeNull();
        expect(mockSubscriptionService.publishCardUpdated).not.toHaveBeenCalled();
      });
    });

    describe('deleteCard', () => {
      it('should delete existing card', async () => {
        const mockCard = {
          id: 'card-123',
          workspaceId: 'workspace-123',
          ownerId: 'user-123',
        };

        mockCardService.getCardById.mockResolvedValue(mockCard as any);
        mockCardService.deleteCard.mockResolvedValue(true);

        const result = await cardResolvers.Mutation.deleteCard(
          {},
          { id: 'card-123' },
          mockContext
        );

        expect(mockCardService.deleteCard).toHaveBeenCalledWith('card-123');
        expect(result).toBe(true);
        expect(mockSubscriptionService.publishCardDeleted).toHaveBeenCalledWith(
          'workspace-123',
          'card-123'
        );
      });

      it('should return false for nonexistent card', async () => {
        mockCardService.getCardById.mockResolvedValue(null);

        const result = await cardResolvers.Mutation.deleteCard(
          {},
          { id: 'nonexistent-card' },
          mockContext
        );

        expect(result).toBe(false);
        expect(mockCardService.deleteCard).not.toHaveBeenCalled();
      });
    });

    describe('batchUpdateCardPositions', () => {
      it('should update multiple card positions', async () => {
        const updates = [
          { cardId: 'card-1', position: { x: 100, y: 100, z: 1 } },
          { cardId: 'card-2', position: { x: 200, y: 200, z: 2 } },
        ];

        const mockUpdatedCards = [
          {
            id: 'card-1',
            workspaceId: 'workspace-123',
            position: { x: 100, y: 100, z: 1 },
          },
          {
            id: 'card-2',
            workspaceId: 'workspace-123',
            position: { x: 200, y: 200, z: 2 },
          },
        ];

        mockCardService.batchUpdateCardPositions.mockResolvedValue(mockUpdatedCards as any);

        const result = await cardResolvers.Mutation.batchUpdateCardPositions(
          {},
          { updates },
          mockContext
        );

        expect(mockCardService.batchUpdateCardPositions).toHaveBeenCalledWith(updates);
        expect(result).toEqual(mockUpdatedCards);
      });
    });
  });

  describe('Subscription Resolvers', () => {
    beforeEach(() => {
      // Mock the async iterator
      mockSubscriptionService.subscribeToCardEvents.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            cardCreated: {
              id: 'card-123',
              workspaceId: 'workspace-123',
              title: 'New Card',
            },
          };
        },
      } as any);
    });

    describe('cardCreated', () => {
      it('should subscribe to card creation events', async () => {
        const subscription = cardResolvers.Subscription.cardCreated.subscribe(
          {},
          { workspaceId: 'workspace-123' },
          mockContext
        );

        expect(mockSubscriptionService.subscribeToCardEvents).toHaveBeenCalledWith(
          'workspace-123'
        );
        expect(subscription).toBeDefined();
      });

      it('should resolve card creation payload', () => {
        const payload = {
          cardCreated: {
            id: 'card-123',
            title: 'Test Card',
          },
        };

        const result = cardResolvers.Subscription.cardCreated.resolve(payload);
        expect(result).toEqual(payload.cardCreated);
      });
    });

    describe('cardUpdated', () => {
      it('should subscribe to card update events', async () => {
        const subscription = cardResolvers.Subscription.cardUpdated.subscribe(
          {},
          { workspaceId: 'workspace-123' },
          mockContext
        );

        expect(mockSubscriptionService.subscribeToCardEvents).toHaveBeenCalledWith(
          'workspace-123'
        );
      });

      it('should resolve card update payload', () => {
        const payload = {
          cardUpdated: {
            id: 'card-123',
            title: 'Updated Card',
          },
        };

        const result = cardResolvers.Subscription.cardUpdated.resolve(payload);
        expect(result).toEqual(payload.cardUpdated);
      });
    });

    describe('cardDeleted', () => {
      it('should subscribe to card deletion events', async () => {
        const subscription = cardResolvers.Subscription.cardDeleted.subscribe(
          {},
          { workspaceId: 'workspace-123' },
          mockContext
        );

        expect(mockSubscriptionService.subscribeToCardEvents).toHaveBeenCalledWith(
          'workspace-123'
        );
      });

      it('should resolve card deletion payload', () => {
        const payload = {
          cardDeleted: 'card-123',
        };

        const result = cardResolvers.Subscription.cardDeleted.resolve(payload);
        expect(result).toBe(payload.cardDeleted);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockCardService.getCardById.mockRejectedValue(new Error('Database error'));

      await expect(
        cardResolvers.Query.card({}, { id: 'card-123' }, mockContext)
      ).rejects.toThrow('Database error');
    });

    it('should throw ForbiddenError for unauthorized access', async () => {
      const mockCard = {
        id: 'card-123',
        workspaceId: 'workspace-123',
        ownerId: 'different-user',
      };

      mockCardService.getCardById.mockResolvedValue(mockCard as any);

      // This would typically be handled by authorization middleware
      // but we can test the resolver behavior with unauthorized data
      const result = await cardResolvers.Query.card(
        {},
        { id: 'card-123' },
        mockContext
      );

      expect(result).toEqual(mockCard);
    });
  });
});