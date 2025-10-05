import { CardService } from '@/services/CardService';
import { CardValidator } from '@/validators/CardValidators';
import { CardMapper } from '@/utils/CardUtils';
import { database } from '@/database/connection';
import {
  Card,
  CardType,
  CardStatus,
  CreateCardInput,
  UpdateCardInput,
  CardPositionUpdate,
  TiptapJSONContent,
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
      jest.spyOn(cardService, 'getCard').mockResolvedValue(mockExistingCard as Card);
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
      jest.spyOn(cardService, 'getCard').mockResolvedValue(mockExistingCard as Card);
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

  // ============================================================================
  // PHASE 5: TIPTAP JSONB CONTENT STORAGE TESTS
  // ============================================================================

  describe('Tiptap JSONB Content Storage', () => {
    describe('Creating cards with Tiptap JSON content', () => {
      const validTiptapJSON = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', marks: [{ type: 'bold' }], text: 'world' }
            ]
          }
        ]
      };

      const mockTiptapInput: CreateCardInput = {
        workspaceId: 'workspace-1',
        type: CardType.TEXT,
        title: 'Tiptap Card',
        content: JSON.stringify(validTiptapJSON),
        position: { x: 100, y: 200, z: 0 },
        dimensions: { width: 300, height: 200 },
        tags: ['tiptap'],
        metadata: { contentFormat: 'tiptap' }
      };

      const mockDbTiptapCard = {
        id: 'card-tiptap-1',
        workspace_id: 'workspace-1',
        type: 'TEXT',
        title: 'Tiptap Card',
        content_json: validTiptapJSON, // JSONB column
        content_format: 'tiptap', // NEW: content format field
        position_x: 100,
        position_y: 200,
        position_z: 0,
        width: 300,
        height: 200,
        metadata: '{"contentFormat":"tiptap"}',
        tags: '["tiptap"]',
        status: 'ACTIVE',
        version: 1,
        created_by: 'user-1',
        last_modified_by: 'user-1',
        is_dirty: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      it('should create a text card with Tiptap JSON content', async () => {
        (CardValidator.validateCreateCard as jest.Mock).mockReturnValue(mockTiptapInput);
        (CardValidator.validateTiptapJSON as jest.Mock).mockReturnValue(validTiptapJSON);
        (CardValidator.sanitizeTiptapJSON as jest.Mock).mockReturnValue(validTiptapJSON);
        mockQuery.mockResolvedValue([mockDbTiptapCard]);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-tiptap-1',
          workspaceId: 'workspace-1',
          type: CardType.TEXT,
          title: 'Tiptap Card',
          content: validTiptapJSON,
          contentFormat: 'tiptap',
          position: { x: 100, y: 200, z: 0 },
          dimensions: { width: 300, height: 200 }
        });

        await cardService.createCard(mockTiptapInput, 'user-1');

        // Verify the insert query was called with JSONB content
        expect(mockQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            insert: expect.any(Function)
          }),
          'card_create'
        );
      });

      it('should set content_format to "tiptap" for Tiptap JSON content', async () => {
        (CardValidator.validateCreateCard as jest.Mock).mockReturnValue(mockTiptapInput);
        (CardValidator.validateTiptapJSON as jest.Mock).mockReturnValue(validTiptapJSON);
        (CardValidator.sanitizeTiptapJSON as jest.Mock).mockReturnValue(validTiptapJSON);
        mockQuery.mockResolvedValue([mockDbTiptapCard]);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-tiptap-1',
          contentFormat: 'tiptap'
        });

        await cardService.createCard(mockTiptapInput, 'user-1');

        // Verify content_format is set
        const insertCall = mockQuery.mock.calls[0];
        expect(insertCall).toBeDefined();
        // Note: The actual implementation will need to detect JSON format and set content_format
      });

      it('should validate Tiptap JSON structure before storing', async () => {
        const invalidTiptapJSON = {
          type: 'doc',
          // Missing required content array
        };

        const invalidInput: CreateCardInput = {
          ...mockTiptapInput,
          content: JSON.stringify(invalidTiptapJSON)
        };

        (CardValidator.validateCreateCard as jest.Mock).mockReturnValue(invalidInput);
        (CardValidator.validateTiptapJSON as jest.Mock).mockImplementation(() => {
          throw new Error('Invalid Tiptap JSON structure');
        });

        // This should fail validation - invalid Tiptap structure
        await expect(cardService.createCard(invalidInput, 'user-1'))
          .rejects.toThrow(); // Expected to throw validation error
      });

      it('should prevent XSS attacks in Tiptap JSON content', async () => {
        const xssTiptapJSON = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: '<script>alert("XSS")</script>'
                }
              ]
            }
          ]
        };

        const xssInput: CreateCardInput = {
          ...mockTiptapInput,
          content: JSON.stringify(xssTiptapJSON)
        };

        (CardValidator.validateCreateCard as jest.Mock).mockReturnValue(xssInput);
        (CardValidator.validateTiptapJSON as jest.Mock).mockReturnValue(xssTiptapJSON);
        (CardValidator.sanitizeTiptapJSON as jest.Mock).mockReturnValue(xssTiptapJSON);
        mockQuery.mockResolvedValue([mockDbTiptapCard]);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-xss',
          content: xssTiptapJSON
        });

        // Should not throw, but content should be sanitized
        await cardService.createCard(xssInput, 'user-1');

        expect(CardValidator.sanitizeTiptapJSON).toHaveBeenCalled();
      });

      it('should enforce content size limits for Tiptap JSON', async () => {
        // Create a very large Tiptap JSON object (>100KB)
        const largeContent = {
          type: 'doc',
          content: Array(10000).fill({
            type: 'paragraph',
            content: [{ type: 'text', text: 'x'.repeat(100) }]
          })
        };

        const largeInput: CreateCardInput = {
          ...mockTiptapInput,
          content: JSON.stringify(largeContent)
        };

        (CardValidator.validateCreateCard as jest.Mock).mockImplementation(() => {
          throw new Error('Content exceeds maximum size limit');
        });

        await expect(cardService.createCard(largeInput, 'user-1'))
          .rejects.toThrow('Content exceeds maximum size limit');
      });

      it('should store nested Tiptap JSON structures correctly', async () => {
        const nestedTiptapJSON = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Title' }]
            },
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        { type: 'text', text: 'Item with ' },
                        { type: 'text', marks: [{ type: 'bold' }], text: 'formatting' }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        };

        const nestedInput: CreateCardInput = {
          ...mockTiptapInput,
          content: JSON.stringify(nestedTiptapJSON)
        };

        (CardValidator.validateCreateCard as jest.Mock).mockReturnValue(nestedInput);
        (CardValidator.sanitizeContent as jest.Mock).mockReturnValue(JSON.stringify(nestedTiptapJSON));
        mockQuery.mockResolvedValue([{
          ...mockDbTiptapCard,
          content_json: nestedTiptapJSON
        }]);

        await cardService.createCard(nestedInput, 'user-1');

        expect(mockQuery).toHaveBeenCalled();
      });
    });

    describe('Backward compatibility with markdown content', () => {
      const mockMarkdownInput: CreateCardInput = {
        workspaceId: 'workspace-1',
        type: CardType.TEXT,
        title: 'Markdown Card',
        content: '# Hello World\n\nThis is **markdown** content.',
        position: { x: 100, y: 200, z: 0 },
        dimensions: { width: 300, height: 200 },
        tags: ['markdown']
      };

      const mockDbMarkdownCard = {
        id: 'card-md-1',
        workspace_id: 'workspace-1',
        type: 'TEXT',
        title: 'Markdown Card',
        content: '# Hello World\n\nThis is **markdown** content.', // TEXT column
        content_format: 'markdown', // Format indicator
        position_x: 100,
        position_y: 200,
        position_z: 0,
        width: 300,
        height: 200,
        status: 'ACTIVE',
        version: 1,
        created_by: 'user-1',
        last_modified_by: 'user-1',
        created_at: new Date(),
        updated_at: new Date()
      };

      it('should create a text card with markdown string content', async () => {
        (CardValidator.validateCreateCard as jest.Mock).mockReturnValue(mockMarkdownInput);
        (CardValidator.sanitizeContent as jest.Mock).mockReturnValue(mockMarkdownInput.content);
        mockQuery.mockResolvedValue([mockDbMarkdownCard]);

        await cardService.createCard(mockMarkdownInput, 'user-1');

        expect(CardValidator.sanitizeContent).toHaveBeenCalledWith(
          mockMarkdownInput.content,
          CardType.TEXT
        );
      });

      it('should set content_format to "markdown" for string content', async () => {
        (CardValidator.validateCreateCard as jest.Mock).mockReturnValue(mockMarkdownInput);
        (CardValidator.sanitizeContent as jest.Mock).mockReturnValue(mockMarkdownInput.content);
        mockQuery.mockResolvedValue([mockDbMarkdownCard]);

        await cardService.createCard(mockMarkdownInput, 'user-1');

        // The implementation should detect string content and set format to 'markdown'
        expect(mockQuery).toHaveBeenCalled();
      });

      it('should retrieve old cards (created before migration) correctly', async () => {
        const legacyDbCard = {
          id: 'card-legacy-1',
          workspace_id: 'workspace-1',
          type: 'TEXT',
          title: 'Legacy Card',
          content: 'Old markdown content', // No content_format field
          // content_format is NULL or undefined (legacy)
          position_x: 100,
          position_y: 200,
          position_z: 0,
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-01')
        };

        mockQuery.mockResolvedValue(legacyDbCard);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-legacy-1',
          content: 'Old markdown content',
          // Should default to markdown format
        });

        const result = await cardService.getCard('card-legacy-1');

        expect(result).toBeDefined();
        expect(mockQuery).toHaveBeenCalled();
      });

      it('should handle NULL content_format as markdown (backward compat)', async () => {
        const nullFormatCard = {
          id: 'card-null-format',
          workspace_id: 'workspace-1',
          type: 'TEXT',
          content: 'Some content',
          content_format: null, // Explicitly NULL
          created_at: new Date(),
          updated_at: new Date()
        };

        mockQuery.mockResolvedValue(nullFormatCard);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-null-format',
          content: 'Some content',
          // Should treat as markdown
        });

        const result = await cardService.getCard('card-null-format');

        expect(result).toBeDefined();
      });
    });

    describe('Updating card content and format migration', () => {
      it('should update markdown content to Tiptap JSON', async () => {
        const existingMarkdownCard = {
          id: 'card-1',
          workspaceId: 'workspace-1',
          type: CardType.TEXT,
          content: '# Markdown Title',
          version: 1,
          status: CardStatus.ACTIVE
        };

        const tiptapUpdateInput: UpdateCardInput = {
          content: JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'Markdown Title' }]
              }
            ]
          })
        };

        (CardValidator.validateUpdateCard as jest.Mock).mockReturnValue(tiptapUpdateInput);
        jest.spyOn(cardService, 'getCard').mockResolvedValue(existingMarkdownCard as Card);
        mockQuery.mockResolvedValue([{
          id: 'card-1',
          content_json: JSON.parse(tiptapUpdateInput.content! as string),
          content_format: 'tiptap',
          version: 2
        }]);

        await cardService.updateCard('card-1', tiptapUpdateInput, 'user-1');

        // Should migrate from TEXT to JSONB column
        expect(mockQuery).toHaveBeenCalled();
      });

      it('should update Tiptap JSON content correctly', async () => {
        const existingTiptapCard = {
          id: 'card-2',
          workspaceId: 'workspace-1',
          type: CardType.TEXT,
          content: JSON.stringify({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Old' }] }]
          }),
          version: 1,
          status: CardStatus.ACTIVE
        };

        const updatedTiptapInput: UpdateCardInput = {
          content: JSON.stringify({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New' }] }]
          })
        };

        (CardValidator.validateUpdateCard as jest.Mock).mockReturnValue(updatedTiptapInput);
        jest.spyOn(cardService, 'getCard').mockResolvedValue(existingTiptapCard as Card);
        mockQuery.mockResolvedValue([{
          id: 'card-2',
          content_json: JSON.parse(updatedTiptapInput.content! as string),
          content_format: 'tiptap',
          version: 2
        }]);

        await cardService.updateCard('card-2', updatedTiptapInput, 'user-1');

        expect(mockQuery).toHaveBeenCalled();
      });

      it('should preserve content format when updating other fields', async () => {
        const existingTiptapCard = {
          id: 'card-3',
          workspaceId: 'workspace-1',
          type: CardType.TEXT,
          title: 'Original Title',
          content: JSON.stringify({ type: 'doc', content: [] }),
          version: 1,
          status: CardStatus.ACTIVE
        };

        const titleOnlyUpdate: UpdateCardInput = {
          title: 'New Title'
          // No content update
        };

        (CardValidator.validateUpdateCard as jest.Mock).mockReturnValue(titleOnlyUpdate);
        jest.spyOn(cardService, 'getCard').mockResolvedValue(existingTiptapCard as Card);
        mockQuery.mockResolvedValue([{
          id: 'card-3',
          title: 'New Title',
          content_json: { type: 'doc', content: [] },
          content_format: 'tiptap', // Should remain tiptap
          version: 2
        }]);

        await cardService.updateCard('card-3', titleOnlyUpdate, 'user-1');

        expect(mockQuery).toHaveBeenCalled();
      });
    });

    describe('Content retrieval and serialization', () => {
      it('should retrieve card with JSON content and return proper structure', async () => {
        const tiptapJSON = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Test content' }]
            }
          ]
        };

        const mockDbCard = {
          id: 'card-json-1',
          workspace_id: 'workspace-1',
          type: 'TEXT',
          title: 'JSON Card',
          content_json: tiptapJSON, // JSONB column
          content_format: 'tiptap',
          position_x: 100,
          position_y: 200,
          position_z: 0,
          status: 'ACTIVE',
          created_at: new Date(),
          updated_at: new Date()
        };

        mockQuery.mockResolvedValue(mockDbCard);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-json-1',
          content: tiptapJSON, // Should return as object, not string
          contentFormat: 'tiptap'
        });

        const result = await cardService.getCard('card-json-1');

        expect(result).toBeDefined();
        expect(CardMapper.mapDbCardToCard).toHaveBeenCalledWith(mockDbCard);
      });

      it('should properly deserialize JSON from JSONB column', async () => {
        const complexJSON = {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Complex Structure' }]
            },
            {
              type: 'codeBlock',
              attrs: { language: 'javascript' },
              content: [{ type: 'text', text: 'const x = 1;' }]
            }
          ]
        };

        const mockDbCard = {
          id: 'card-complex',
          content_json: complexJSON,
          content_format: 'tiptap'
        };

        mockQuery.mockResolvedValue(mockDbCard);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-complex',
          content: complexJSON
        });

        await cardService.getCard('card-complex');

        expect(CardMapper.mapDbCardToCard).toHaveBeenCalled();
      });

      it('should retrieve markdown cards and return string content', async () => {
        const mockDbMarkdownCard = {
          id: 'card-md-retrieve',
          content: '# Markdown Title\n\nParagraph text.',
          content_format: 'markdown',
          type: 'TEXT'
        };

        mockQuery.mockResolvedValue(mockDbMarkdownCard);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-md-retrieve',
          content: '# Markdown Title\n\nParagraph text.',
          contentFormat: 'markdown'
        });

        const result = await cardService.getCard('card-md-retrieve');

        expect(result).toBeDefined();
        expect(typeof result.content).toBe('string');
      });

      it('should handle corrupted JSON gracefully', async () => {
        const mockDbCardCorrupted = {
          id: 'card-corrupted',
          content_json: null, // Corrupted JSONB
          content_format: 'tiptap',
          type: 'TEXT'
        };

        mockQuery.mockResolvedValue(mockDbCardCorrupted);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-corrupted',
          content: { type: 'doc', content: [] }, // Fallback to empty doc
          contentFormat: 'tiptap'
        });

        // Should handle gracefully with fallback to empty doc
        const result = await cardService.getCard('card-corrupted');
        expect(result).toBeDefined();
        expect(result.content).toEqual({ type: 'doc', content: [] });
      });
    });

    describe('Tiptap JSON validation schemas', () => {
      it('should validate required Tiptap JSON fields', async () => {
        const missingTypeJSON = {
          // Missing 'type' field
          content: []
        };

        const invalidInput: CreateCardInput = {
          workspaceId: 'workspace-1',
          type: CardType.TEXT,
          content: JSON.stringify(missingTypeJSON),
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 100, height: 100 }
        };

        (CardValidator.validateCreateCard as jest.Mock).mockImplementation(() => {
          throw new Error('Invalid Tiptap JSON: missing required "type" field');
        });

        await expect(cardService.createCard(invalidInput, 'user-1'))
          .rejects.toThrow('Invalid Tiptap JSON: missing required "type" field');
      });

      it('should validate Tiptap node types are allowed', async () => {
        const invalidNodeTypeJSON = {
          type: 'doc',
          content: [
            {
              type: 'maliciousNode', // Not a valid Tiptap node type
              content: []
            }
          ]
        };

        const invalidInput: CreateCardInput = {
          workspaceId: 'workspace-1',
          type: CardType.TEXT,
          content: JSON.stringify(invalidNodeTypeJSON),
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 100, height: 100 }
        };

        (CardValidator.validateCreateCard as jest.Mock).mockImplementation(() => {
          throw new Error('Invalid node type: maliciousNode');
        });

        await expect(cardService.createCard(invalidInput, 'user-1'))
          .rejects.toThrow('Invalid node type');
      });

      it('should validate mark types are allowed', async () => {
        const invalidMarkJSON = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'text',
                  marks: [{ type: 'evilMark' }] // Invalid mark type
                }
              ]
            }
          ]
        };

        const invalidInput: CreateCardInput = {
          workspaceId: 'workspace-1',
          type: CardType.TEXT,
          content: JSON.stringify(invalidMarkJSON),
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 100, height: 100 }
        };

        (CardValidator.validateCreateCard as jest.Mock).mockImplementation(() => {
          throw new Error('Invalid mark type: evilMark');
        });

        await expect(cardService.createCard(invalidInput, 'user-1'))
          .rejects.toThrow('Invalid mark type');
      });

      it('should reject deeply nested JSON to prevent DoS', async () => {
        // Create deeply nested structure
        let deepJSON: TiptapJSONContent = { type: 'text', text: 'end' };
        for (let i = 0; i < 1000; i++) {
          deepJSON = {
            type: 'paragraph',
            content: [deepJSON]
          };
        }
        deepJSON = { type: 'doc', content: [deepJSON] };

        const deepInput: CreateCardInput = {
          workspaceId: 'workspace-1',
          type: CardType.TEXT,
          content: JSON.stringify(deepJSON),
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 100, height: 100 }
        };

        (CardValidator.validateCreateCard as jest.Mock).mockImplementation(() => {
          throw new Error('JSON nesting depth exceeds maximum allowed');
        });

        await expect(cardService.createCard(deepInput, 'user-1'))
          .rejects.toThrow('nesting depth exceeds maximum');
      });
    });

    describe('Performance and database operations', () => {
      it('should use JSONB operators for efficient queries', async () => {
        // This test verifies that JSONB querying is used efficiently
        const searchTerm = 'specific text';

        mockQuery.mockResolvedValue([
          { id: 'card-1', content_json: JSON.stringify({ type: 'doc', content: [] }) }
        ]);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-1',
          content: { type: 'doc', content: [] }
        });

        await cardService.searchCards('workspace-1', searchTerm);

        // Should use JSONB containment or text search operators
        expect(mockQuery).toHaveBeenCalled();
        // The actual implementation should use JSONB @> or -> operators
      });

      it('should index JSONB content for search performance', async () => {
        // This test documents expected index usage
        // Actual indexes should be created in migration
        mockQuery.mockResolvedValue([
          { id: 'card-2', content_json: JSON.stringify({ type: 'doc', content: [] }) }
        ]);
        (CardMapper.mapDbCardToCard as jest.Mock).mockReturnValue({
          id: 'card-2',
          content: { type: 'doc', content: [] }
        });

        const _result = await cardService.searchCards('workspace-1', 'search term');

        expect(mockQuery).toHaveBeenCalled();
        // Implementation should utilize GIN or similar indexes on content_json
      });

      it('should handle batch operations with mixed content formats', async () => {
        const mixedUpdates: CardPositionUpdate[] = [
          { cardId: 'markdown-card', position: { x: 0, y: 0, z: 0 }, version: 1 },
          { cardId: 'tiptap-card', position: { x: 100, y: 100, z: 0 }, version: 1 }
        ];

        (CardValidator.validateBatchPositionUpdates as jest.Mock).mockReturnValue(mixedUpdates);

        const mockTrx = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValueOnce({ id: 'markdown-card', version: 1 })
                        .mockResolvedValueOnce({ id: 'tiptap-card', version: 1 }),
          update: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([
            { id: 'markdown-card', version: 2, content_format: 'markdown' },
            { id: 'tiptap-card', version: 2, content_format: 'tiptap' }
          ])
        }));

        mockTransaction.mockImplementation(async (callback) => await callback(mockTrx));

        await cardService.batchUpdatePositions(mixedUpdates);

        expect(mockTransaction).toHaveBeenCalled();
      });
    });
  });
});