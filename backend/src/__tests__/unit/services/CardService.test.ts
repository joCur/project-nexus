import { CardService } from '@/services/CardService';
import { CardValidator } from '@/validators/CardValidators';
import { CardMapper } from '@/utils/CardUtils';
import { database } from '@/database/connection';
import { 
  CardType, 
  CardStatus, 
  CreateCardInput, 
  UpdateCardInput,
  CardPositionUpdate,
 
} from '@/types/CardTypes';
import { NotFoundError } from '@/utils/errors';

// Mock dependencies
jest.mock('@/database/connection', () => {
  const mockQueryBuilder = {
    insert: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereILike: jest.fn().mockReturnThis(),
    orWhereILike: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    first: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    toString: jest.fn().mockReturnValue('SELECT * FROM cards'),
  };

  const mockKnex = jest.fn(() => mockQueryBuilder);
  
  const mockDatabase = {
    query: jest.fn(),
    transaction: jest.fn(),
  };

  return {
    database: mockDatabase,
    knex: mockKnex,
  };
});

jest.mock('@/validators/CardValidators');
jest.mock('@/utils/CardUtils');
jest.mock('@/utils/logger', () => ({
  createContextLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('CardService', () => {
  let cardService: CardService;
  let mockDatabase: jest.Mocked<typeof database>;
  let mockQuery: jest.Mock;
  let mockTransaction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup database mocks
    mockDatabase = database as jest.Mocked<typeof database>;
    mockQuery = mockDatabase.query as jest.Mock;
    mockTransaction = mockDatabase.transaction as jest.Mock;

    cardService = new CardService();
  });

  describe('createCard', () => {
    const mockCreateInput: CreateCardInput = {
      workspaceId: 'workspace-1',
      type: CardType.TEXT,
      title: 'Test Card',
      content: 'Test content',
      position: { x: 100, y: 200, z: 0 },
      dimensions: { width: 300, height: 200 },
      tags: ['test'],
      metadata: { color: 'blue' }
    };

    const mockDbCard = {
      id: 'card-1',
      workspace_id: 'workspace-1',
      type: 'TEXT',
      title: 'Test Card',
      content: 'Test content',
      position_x: 100,
      position_y: 200,
      position_z: 0,
      width: 300,
      height: 200,
      metadata: '{"color":"blue"}',
      tags: '["test"]',
      status: 'ACTIVE',
      version: 1,
      created_by: 'user-1',
      last_modified_by: 'user-1',
      is_dirty: false,
      last_saved_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    const mockCard = {
      id: 'card-1',
      workspaceId: 'workspace-1',
      type: CardType.TEXT,
      title: 'Test Card',
      content: 'Test content',
      position: { x: 100, y: 200, z: 0 },
      dimensions: { width: 300, height: 200 },
      metadata: { color: 'blue' },
      status: CardStatus.ACTIVE,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
      lastModifiedBy: 'user-1',
      tags: ['test'],
      lastSavedAt: new Date(),
      isDirty: false
    };

    beforeEach(() => {
      (CardValidator.validateCreateCard as jest.Mock).mockReturnValue(mockCreateInput);
      (CardValidator.sanitizeContent as jest.Mock).mockReturnValue('Test content');
      (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue(mockCard);
      mockQuery.mockResolvedValue([mockDbCard]);
    });

    it('should create a card successfully', async () => {
      const result = await cardService.createCard(mockCreateInput, 'user-1');

      expect(CardValidator.validateCreateCard).toHaveBeenCalledWith(mockCreateInput);
      expect(CardValidator.sanitizeContent).toHaveBeenCalledWith('Test content', CardType.TEXT);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          insert: expect.any(Function)
        }),
        'card_create'
      );
      expect(CardMapper.mapDbCardToCard).toHaveBeenCalledWith(mockDbCard);
      expect(result).toEqual(mockCard);
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid input');
      (CardValidator.validateCreateCard as jest.Mock).mockImplementation(() => {
        throw validationError;
      });

      await expect(cardService.createCard(mockCreateInput, 'user-1'))
        .rejects.toThrow(validationError);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockQuery.mockRejectedValue(dbError);

      await expect(cardService.createCard(mockCreateInput, 'user-1'))
        .rejects.toThrow(dbError);
    });
  });

  describe('getCard', () => {
    const mockDbCard = {
      id: 'card-1',
      workspace_id: 'workspace-1',
      type: 'TEXT',
      title: 'Test Card',
      content: 'Test content',
      status: 'ACTIVE'
    };

    const mockCard = {
      id: 'card-1',
      workspaceId: 'workspace-1',
      type: CardType.TEXT,
      title: 'Test Card',
      content: 'Test content',
      status: CardStatus.ACTIVE
    };

    it('should return card when found', async () => {
      mockQuery.mockResolvedValue(mockDbCard);
      (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue(mockCard);

      const result = await cardService.getCard('card-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          first: expect.any(Function)
        }),
        'card_get'
      );
      expect(result).toEqual(mockCard);
    });

    it('should return null when card not found', async () => {
      mockQuery.mockResolvedValue(null);

      const result = await cardService.getCard('card-1');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockQuery.mockRejectedValue(dbError);

      await expect(cardService.getCard('card-1'))
        .rejects.toThrow(dbError);
    });
  });

  describe('updateCard', () => {
    const mockUpdateInput: UpdateCardInput = {
      title: 'Updated Card',
      content: 'Updated content'
    };

    const mockExistingCard = {
      id: 'card-1',
      workspaceId: 'workspace-1',
      type: CardType.TEXT,
      title: 'Test Card',
      content: 'Test content',
      version: 1,
      status: CardStatus.ACTIVE
    };

    const mockUpdatedDbCard = {
      id: 'card-1',
      title: 'Updated Card',
      content: 'Updated content',
      version: 2
    };

    const mockUpdatedCard = {
      id: 'card-1',
      title: 'Updated Card',
      content: 'Updated content',
      version: 2
    };

    beforeEach(() => {
      (CardValidator.validateUpdateCard as jest.Mock).mockReturnValue(mockUpdateInput);
      (CardValidator.sanitizeContent as jest.Mock).mockReturnValue('Updated content');
      jest.spyOn(cardService, 'getCard').mockResolvedValue(mockExistingCard as any);
      (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue(mockUpdatedCard);
      mockQuery.mockResolvedValue([mockUpdatedDbCard]);
    });

    it('should update card successfully', async () => {
      const result = await cardService.updateCard('card-1', mockUpdateInput, 'user-1');

      expect(CardValidator.validateUpdateCard).toHaveBeenCalledWith(mockUpdateInput);
      expect(cardService.getCard).toHaveBeenCalledWith('card-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.any(Function)
        }),
        'card_update'
      );
      expect(result).toEqual(mockUpdatedCard);
    });

    it('should throw NotFoundError when card does not exist', async () => {
      jest.spyOn(cardService, 'getCard').mockResolvedValue(null);

      await expect(cardService.updateCard('card-1', mockUpdateInput, 'user-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid input');
      (CardValidator.validateUpdateCard as jest.Mock).mockImplementation(() => {
        throw validationError;
      });

      await expect(cardService.updateCard('card-1', mockUpdateInput, 'user-1'))
        .rejects.toThrow(validationError);
    });
  });

  describe('deleteCard', () => {
    const mockExistingCard = {
      id: 'card-1',
      version: 1,
      status: CardStatus.ACTIVE
    };

    beforeEach(() => {
      jest.spyOn(cardService, 'getCard').mockResolvedValue(mockExistingCard as any);
      mockQuery.mockResolvedValue(undefined);
    });

    it('should delete card successfully', async () => {
      const result = await cardService.deleteCard('card-1', 'user-1');

      expect(cardService.getCard).toHaveBeenCalledWith('card-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.any(Function)
        }),
        'card_delete'
      );
      expect(result).toBe(true);
    });

    it('should throw NotFoundError when card does not exist', async () => {
      jest.spyOn(cardService, 'getCard').mockResolvedValue(null);

      await expect(cardService.deleteCard('card-1', 'user-1'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('batchUpdatePositions', () => {
    const mockUpdates: CardPositionUpdate[] = [
      {
        cardId: 'card-1',
        position: { x: 100, y: 200, z: 0 },
        version: 1
      },
      {
        cardId: 'card-2',
        position: { x: 300, y: 400, z: 1 },
        version: 1
      }
    ];

    const mockExistingCards = [
      { id: 'card-1', version: 1 },
      { id: 'card-2', version: 1 }
    ];

    const mockUpdatedCards = [
      { id: 'card-1', version: 2 },
      { id: 'card-2', version: 2 }
    ];

    beforeEach(() => {
      (CardValidator.validateBatchPositionUpdates as jest.Mock).mockReturnValue(mockUpdates);
      
      const mockTrx = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockImplementation(() => {
          return Promise.resolve(mockExistingCards[0]); // Return first existing card for simplicity
        }),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockImplementation(() => {
          return Promise.resolve(mockUpdatedCards);
        })
      }));

      mockTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx);
      });

      (CardMapper.mapDbCardToCard as jest.Mock).mockImplementation((dbCard) => dbCard);
    });

    it('should update positions successfully', async () => {
      const result = await cardService.batchUpdatePositions(mockUpdates);

      expect(CardValidator.validateBatchPositionUpdates).toHaveBeenCalledWith(mockUpdates);
      expect(mockTransaction).toHaveBeenCalled();
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.totalProcessed).toBe(2);
    });

    it('should handle version conflicts', async () => {
      const conflictUpdates = [{
        cardId: 'card-1',
        position: { x: 100, y: 200, z: 0 },
        version: 2 // Higher version than existing
      }];

      (CardValidator.validateBatchPositionUpdates as jest.Mock).mockReturnValue(conflictUpdates);

      const result = await cardService.batchUpdatePositions(conflictUpdates);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Version conflict');
    });
  });

  describe('getWorkspaceCards', () => {
    const mockDbCards = [
      { id: 'card-1', title: 'Card 1' },
      { id: 'card-2', title: 'Card 2' }
    ];

    const mockCards = [
      { id: 'card-1', title: 'Card 1' },
      { id: 'card-2', title: 'Card 2' }
    ];

    beforeEach(() => {
      mockQuery
        .mockResolvedValueOnce([{ count: '2' }]) // Count query
        .mockResolvedValueOnce(mockDbCards); // Cards query
      
      (CardMapper.mapDbCardToCard as jest.Mock).mockImplementation((dbCard) => 
        mockCards.find(card => card.id === dbCard.id)
      );
    });

    it('should return cards with total count', async () => {
      const result = await cardService.getWorkspaceCards('workspace-1');

      expect(result.cards).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should apply filters correctly', async () => {
      const filter = {
        type: CardType.TEXT,
        tags: ['important']
      };

      await cardService.getWorkspaceCards('workspace-1', filter);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          count: expect.any(Function)
        }),
        'cards_count'
      );
    });
  });

  describe('searchCards', () => {
    const mockDbCards = [
      { id: 'card-1', title: 'Test Card', content: 'Test content' }
    ];

    const mockCards = [
      { id: 'card-1', title: 'Test Card', content: 'Test content' }
    ];

    beforeEach(() => {
      mockQuery.mockResolvedValue(mockDbCards);
      (CardMapper.mapDbCardToCard as jest.Mock).mockImplementation((dbCard) => 
        mockCards.find(card => card.id === dbCard.id)
      );
    });

    it('should search cards by query', async () => {
      const result = await cardService.searchCards('workspace-1', 'test');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Card');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: expect.any(Function)
        }),
        'cards_search'
      );
    });

    it('should limit search results', async () => {
      await cardService.searchCards('workspace-1', 'test', 10);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: expect.any(Function)
        }),
        'cards_search'
      );
    });
  });

  describe('autoSaveCards', () => {
    const mockCardIds = ['card-1', 'card-2'];
    const mockUpdatedDbCards = [
      { id: 'card-1', is_dirty: false },
      { id: 'card-2', is_dirty: false }
    ];

    const mockUpdatedCards = [
      { id: 'card-1', isDirty: false },
      { id: 'card-2', isDirty: false }
    ];

    beforeEach(() => {
      mockQuery.mockResolvedValue(mockUpdatedDbCards);
      (CardMapper.mapDbCardToCard as jest.Mock).mockImplementation((dbCard) => 
        mockUpdatedCards.find(card => card.id === dbCard.id)
      );
    });

    it('should auto-save dirty cards', async () => {
      const result = await cardService.autoSaveCards(mockCardIds);

      expect(result).toHaveLength(2);
      expect(result[0].isDirty).toBe(false);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.any(Function)
        }),
        'cards_auto_save'
      );
    });
  });

  describe('getDirtyCards', () => {
    const mockDbCards = [
      { id: 'card-1', is_dirty: true },
      { id: 'card-2', is_dirty: true }
    ];

    const mockCards = [
      { id: 'card-1', isDirty: true },
      { id: 'card-2', isDirty: true }
    ];

    beforeEach(() => {
      mockQuery.mockResolvedValue(mockDbCards);
      (CardMapper.mapDbCardToCard as jest.Mock).mockImplementation((dbCard) => 
        mockCards.find(card => card.id === dbCard.id)
      );
    });

    it('should return dirty cards', async () => {
      const result = await cardService.getDirtyCards('workspace-1');

      expect(result).toHaveLength(2);
      expect(result[0].isDirty).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.any(Function)
        }),
        'cards_get_dirty'
      );
    });
  });
});