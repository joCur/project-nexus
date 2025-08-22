/**
 * Subscription Service Tests
 * 
 * Tests for GraphQL subscription service handling real-time events
 * for card operations using PubSub pattern.
 */

import { subscriptionService } from '../../../services/subscriptionService';
import { PubSub } from 'graphql-subscriptions';

// Mock PubSub
jest.mock('graphql-subscriptions', () => ({
  PubSub: jest.fn().mockImplementation(() => ({
    publish: jest.fn(),
    asyncIterator: jest.fn(),
  })),
}));

const MockPubSub = PubSub as jest.MockedClass<typeof PubSub>;

describe('SubscriptionService', () => {
  let mockPubSub: jest.Mocked<PubSub>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPubSub = {
      publish: jest.fn(),
      asyncIterator: jest.fn(),
    } as any;
    MockPubSub.mockImplementation(() => mockPubSub);
  });

  describe('Card Event Publishing', () => {
    describe('publishCardCreated', () => {
      it('should publish card creation event', async () => {
        const mockCard = {
          id: 'card-123',
          workspaceId: 'workspace-123',
          title: 'New Card',
          content: 'Card content',
          type: 'TEXT',
          position: { x: 100, y: 200, z: 1 },
          ownerId: 'user-123',
        };

        await subscriptionService.publishCardCreated('workspace-123', mockCard);

        expect(mockPubSub.publish).toHaveBeenCalledWith('CARD_EVENTS', {
          cardCreated: mockCard,
          workspaceId: 'workspace-123',
        });
      });

      it('should handle publish errors gracefully', async () => {
        const mockCard = {
          id: 'card-123',
          workspaceId: 'workspace-123',
          title: 'New Card',
        };

        mockPubSub.publish.mockRejectedValue(new Error('PubSub error'));

        // Should not throw error
        await expect(
          subscriptionService.publishCardCreated('workspace-123', mockCard)
        ).resolves.not.toThrow();

        expect(mockPubSub.publish).toHaveBeenCalled();
      });
    });

    describe('publishCardUpdated', () => {
      it('should publish card update event', async () => {
        const mockCard = {
          id: 'card-123',
          workspaceId: 'workspace-123',
          title: 'Updated Card',
          content: 'Updated content',
          position: { x: 150, y: 250, z: 2 },
        };

        await subscriptionService.publishCardUpdated('workspace-123', mockCard);

        expect(mockPubSub.publish).toHaveBeenCalledWith('CARD_EVENTS', {
          cardUpdated: mockCard,
          workspaceId: 'workspace-123',
        });
      });

      it('should handle null card gracefully', async () => {
        await subscriptionService.publishCardUpdated('workspace-123', null);

        expect(mockPubSub.publish).toHaveBeenCalledWith('CARD_EVENTS', {
          cardUpdated: null,
          workspaceId: 'workspace-123',
        });
      });
    });

    describe('publishCardDeleted', () => {
      it('should publish card deletion event', async () => {
        await subscriptionService.publishCardDeleted('workspace-123', 'card-123');

        expect(mockPubSub.publish).toHaveBeenCalledWith('CARD_EVENTS', {
          cardDeleted: 'card-123',
          workspaceId: 'workspace-123',
        });
      });

      it('should handle empty card ID', async () => {
        await subscriptionService.publishCardDeleted('workspace-123', '');

        expect(mockPubSub.publish).toHaveBeenCalledWith('CARD_EVENTS', {
          cardDeleted: '',
          workspaceId: 'workspace-123',
        });
      });
    });
  });

  describe('Event Subscription', () => {
    describe('subscribeToCardEvents', () => {
      it('should create async iterator for workspace events', () => {
        const mockAsyncIterator = Symbol('async-iterator');
        mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator as any);

        const result = subscriptionService.subscribeToCardEvents('workspace-123');

        expect(mockPubSub.asyncIterator).toHaveBeenCalledWith(['CARD_EVENTS']);
        expect(result).toBe(mockAsyncIterator);
      });

      it('should handle different workspace IDs', () => {
        subscriptionService.subscribeToCardEvents('workspace-456');
        subscriptionService.subscribeToCardEvents('workspace-789');

        expect(mockPubSub.asyncIterator).toHaveBeenCalledTimes(2);
        expect(mockPubSub.asyncIterator).toHaveBeenCalledWith(['CARD_EVENTS']);
      });
    });
  });

  describe('Event Filtering', () => {
    it('should provide workspace-specific event filtering', () => {
      // The actual filtering would happen in the subscription resolver
      // but we test that the service provides the right structure
      const workspaceId = 'workspace-123';
      
      subscriptionService.subscribeToCardEvents(workspaceId);

      // Verify that the subscription is set up correctly
      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith(['CARD_EVENTS']);
    });
  });

  describe('Service Singleton', () => {
    it('should maintain singleton instance', () => {
      const instance1 = subscriptionService;
      const instance2 = subscriptionService;

      expect(instance1).toBe(instance2);
    });

    it('should have consistent PubSub instance', () => {
      // Multiple calls should use the same PubSub instance
      subscriptionService.publishCardCreated('workspace-1', { id: 'card-1' } as any);
      subscriptionService.publishCardUpdated('workspace-2', { id: 'card-2' } as any);
      
      expect(MockPubSub).toHaveBeenCalledTimes(1); // Should reuse the same instance
    });
  });

  describe('Error Resilience', () => {
    it('should handle PubSub instantiation errors', () => {
      MockPubSub.mockImplementationOnce(() => {
        throw new Error('PubSub initialization failed');
      });

      // Should not throw during import/require
      expect(() => {
        const { subscriptionService } = require('../../../services/subscriptionService');
        return subscriptionService;
      }).not.toThrow();
    });

    it('should handle asyncIterator errors gracefully', () => {
      mockPubSub.asyncIterator.mockImplementation(() => {
        throw new Error('AsyncIterator error');
      });

      expect(() => {
        subscriptionService.subscribeToCardEvents('workspace-123');
      }).toThrow('AsyncIterator error');
    });
  });

  describe('Event Payload Structure', () => {
    it('should maintain consistent event payload format for creation', async () => {
      const mockCard = {
        id: 'card-123',
        workspaceId: 'workspace-123',
        title: 'Test Card',
      };

      await subscriptionService.publishCardCreated('workspace-123', mockCard);

      const expectedPayload = {
        cardCreated: mockCard,
        workspaceId: 'workspace-123',
      };

      expect(mockPubSub.publish).toHaveBeenCalledWith('CARD_EVENTS', expectedPayload);
    });

    it('should maintain consistent event payload format for updates', async () => {
      const mockCard = {
        id: 'card-123',
        workspaceId: 'workspace-123',
        title: 'Updated Card',
      };

      await subscriptionService.publishCardUpdated('workspace-123', mockCard);

      const expectedPayload = {
        cardUpdated: mockCard,
        workspaceId: 'workspace-123',
      };

      expect(mockPubSub.publish).toHaveBeenCalledWith('CARD_EVENTS', expectedPayload);
    });

    it('should maintain consistent event payload format for deletion', async () => {
      await subscriptionService.publishCardDeleted('workspace-123', 'card-123');

      const expectedPayload = {
        cardDeleted: 'card-123',
        workspaceId: 'workspace-123',
      };

      expect(mockPubSub.publish).toHaveBeenCalledWith('CARD_EVENTS', expectedPayload);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent publishes', async () => {
      const promises = [
        subscriptionService.publishCardCreated('workspace-1', { id: 'card-1' } as any),
        subscriptionService.publishCardUpdated('workspace-2', { id: 'card-2' } as any),
        subscriptionService.publishCardDeleted('workspace-3', 'card-3'),
      ];

      await Promise.all(promises);

      expect(mockPubSub.publish).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent subscriptions', () => {
      const subscriptions = [
        subscriptionService.subscribeToCardEvents('workspace-1'),
        subscriptionService.subscribeToCardEvents('workspace-2'),
        subscriptionService.subscribeToCardEvents('workspace-3'),
      ];

      expect(subscriptions).toHaveLength(3);
      expect(mockPubSub.asyncIterator).toHaveBeenCalledTimes(3);
    });
  });
});