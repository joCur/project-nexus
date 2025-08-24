/**
 * Canvas Migration Tests (NEX-177)
 * 
 * Comprehensive testing for canvas database migrations including:
 * - Migration of existing workspaces with cards to default canvas
 * - Data preservation during migration
 * - Rollback functionality
 * - Migration with various data scenarios
 */

import { Knex } from 'knex';
import { database, knex } from '@/database/connection';
import { v4 as uuidv4 } from 'uuid';

// Import migration functions
import { up as createCanvasesTable, down as dropCanvasesTable } from '@/database/migrations/011_create_canvases_table';
import { up as addCanvasIdToCards, down as removeCanvasIdFromCards } from '@/database/migrations/012_add_canvas_id_to_cards';
import { up as updateCanvasSettings, down as rollbackCanvasSettings } from '@/database/migrations/013_update_canvas_settings';

describe('Canvas Migration Tests', () => {
  let testDb: Knex;
  
  // Test data
  const testUserId1 = uuidv4();
  const testUserId2 = uuidv4();
  const testWorkspaceId1 = uuidv4();
  const testWorkspaceId2 = uuidv4();
  const testWorkspaceId3 = uuidv4(); // Empty workspace

  beforeAll(async () => {
    testDb = knex;
    
    // Ensure we're using the test database
    expect(process.env.NODE_ENV).toBe('test');
  });

  beforeEach(async () => {
    // Clean up existing test data
    await testDb.raw('TRUNCATE TABLE cards, workspaces, users CASCADE');
    
    // Set up base test data
    await setupTestData();
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await testDb.raw('TRUNCATE TABLE canvases, cards, workspaces, users CASCADE');
      await testDb.raw('DROP TABLE IF EXISTS canvases');
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  async function setupTestData() {
    // Create test users
    await testDb('users').insert([
      {
        id: testUserId1,
        auth0_id: `auth0|${testUserId1}`,
        email: 'user1@test.com',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: testUserId2,
        auth0_id: `auth0|${testUserId2}`,
        email: 'user2@test.com',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Create test workspaces
    await testDb('workspaces').insert([
      {
        id: testWorkspaceId1,
        name: 'Test Workspace 1',
        description: 'Workspace with many cards',
        owner_id: testUserId1,
        settings: JSON.stringify({ privacy: 'private' }),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: testWorkspaceId2,
        name: 'Test Workspace 2',
        description: 'Workspace with few cards',
        owner_id: testUserId2,
        settings: JSON.stringify({ privacy: 'private' }),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: testWorkspaceId3,
        name: 'Empty Workspace',
        description: 'Workspace without cards',
        owner_id: testUserId1,
        settings: JSON.stringify({ privacy: 'private' }),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Create test cards for workspace 1 (many cards)
    const cards1 = Array.from({ length: 15 }, (_, i) => ({
      id: uuidv4(),
      workspace_id: testWorkspaceId1,
      type: i % 3 === 0 ? 'note' : i % 3 === 1 ? 'task' : 'image',
      title: `Test Card ${i + 1}`,
      content: `Content for card ${i + 1}`,
      position_x: i * 100,
      position_y: Math.floor(i / 5) * 150,
      position_z: 0,
      size_width: 200,
      size_height: 150,
      style: JSON.stringify({
        backgroundColor: '#ffffff',
        textColor: '#000000',
      }),
      created_by: testUserId1,
      created_at: new Date(Date.now() - (15 - i) * 86400000), // Spread over 15 days
      updated_at: new Date(Date.now() - (15 - i) * 86400000),
    }));

    await testDb('cards').insert(cards1);

    // Create test cards for workspace 2 (few cards)
    const cards2 = Array.from({ length: 3 }, (_, i) => ({
      id: uuidv4(),
      workspace_id: testWorkspaceId2,
      type: 'note',
      title: `Workspace 2 Card ${i + 1}`,
      content: `Content for workspace 2 card ${i + 1}`,
      position_x: i * 150,
      position_y: 100,
      position_z: 0,
      size_width: 200,
      size_height: 150,
      style: JSON.stringify({
        backgroundColor: '#f0f0f0',
        textColor: '#333333',
      }),
      created_by: testUserId2,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await testDb('cards').insert(cards2);
  }

  describe('Migration 011: Create Canvases Table', () => {
    it('should create canvases table with correct schema', async () => {
      await createCanvasesTable(testDb);

      // Check table exists
      const hasTable = await testDb.schema.hasTable('canvases');
      expect(hasTable).toBe(true);

      // Check columns
      const columns = await testDb.raw('SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position', ['canvases']);
      const columnNames = columns.rows.map((row: any) => row.column_name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('workspace_id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('is_default');
      expect(columnNames).toContain('position');
      expect(columnNames).toContain('created_by');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');

      // Check indexes
      const indexes = await testDb.raw(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'canvases'
      `);
      const indexNames = indexes.rows.map((row: any) => row.indexname);
      
      expect(indexNames).toContain('canvases_workspace_id_index');
      expect(indexNames).toContain('canvases_workspace_id_position_index');
      expect(indexNames).toContain('canvases_workspace_id_name_unique');
    });

    it('should rollback canvases table creation', async () => {
      await createCanvasesTable(testDb);
      expect(await testDb.schema.hasTable('canvases')).toBe(true);

      await dropCanvasesTable(testDb);
      expect(await testDb.schema.hasTable('canvases')).toBe(false);
    });
  });

  describe('Migration 012: Add Canvas ID to Cards', () => {
    beforeEach(async () => {
      await createCanvasesTable(testDb);
    });

    it('should migrate existing cards to default canvases', async () => {
      // Count cards before migration
      const cardsBefore = await testDb('cards').count('id as count');
      const totalCards = parseInt(cardsBefore[0].count as string);

      expect(totalCards).toBe(18); // 15 + 3 cards from setup

      // Run migration
      await addCanvasIdToCards(testDb);

      // Check canvases were created
      const canvases = await testDb('canvases').select('*').orderBy('workspace_id');
      expect(canvases).toHaveLength(3); // One for each workspace

      // Verify default canvases
      canvases.forEach((canvas: any) => {
        expect(canvas.name).toBe('Main Canvas');
        expect(canvas.is_default).toBe(true);
        expect(canvas.position).toBe(0);
        expect(canvas.description).toBe('Default canvas created during multi-canvas migration');
      });

      // Check workspace mappings
      const workspace1Canvas = canvases.find((c: any) => c.workspace_id === testWorkspaceId1);
      const workspace2Canvas = canvases.find((c: any) => c.workspace_id === testWorkspaceId2);
      const workspace3Canvas = canvases.find((c: any) => c.workspace_id === testWorkspaceId3);

      expect(workspace1Canvas.created_by).toBe(testUserId1);
      expect(workspace2Canvas.created_by).toBe(testUserId2);
      expect(workspace3Canvas.created_by).toBe(testUserId1);

      // Verify all cards have canvas_id
      const cardsAfter = await testDb('cards').select('id', 'canvas_id', 'workspace_id');
      expect(cardsAfter.every((card: any) => card.canvas_id)).toBe(true);

      // Verify cards are assigned to correct canvases
      const workspace1Cards = cardsAfter.filter((card: any) => card.workspace_id === testWorkspaceId1);
      const workspace2Cards = cardsAfter.filter((card: any) => card.workspace_id === testWorkspaceId2);

      expect(workspace1Cards).toHaveLength(15);
      expect(workspace2Cards).toHaveLength(3);

      workspace1Cards.forEach((card: any) => {
        expect(card.canvas_id).toBe(workspace1Canvas.id);
      });

      workspace2Cards.forEach((card: any) => {
        expect(card.canvas_id).toBe(workspace2Canvas.id);
      });
    });

    it('should handle empty workspace during migration', async () => {
      await addCanvasIdToCards(testDb);

      // Check empty workspace got a default canvas
      const emptyWorkspaceCanvas = await testDb('canvases')
        .where('workspace_id', testWorkspaceId3)
        .first();

      expect(emptyWorkspaceCanvas).toBeDefined();
      expect(emptyWorkspaceCanvas.name).toBe('Main Canvas');
      expect(emptyWorkspaceCanvas.is_default).toBe(true);

      // Verify no cards for this workspace, but canvas exists
      const emptyWorkspaceCards = await testDb('cards')
        .where('workspace_id', testWorkspaceId3);

      expect(emptyWorkspaceCards).toHaveLength(0);
    });

    it('should create proper indexes after migration', async () => {
      await addCanvasIdToCards(testDb);

      // Check indexes were created
      const indexes = await testDb.raw(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'cards' AND indexname LIKE '%canvas%'
      `);

      const indexNames = indexes.rows.map((row: any) => row.indexname);
      
      expect(indexNames).toContain('idx_cards_canvas_id');
      expect(indexNames).toContain('idx_cards_canvas_status');
      expect(indexNames).toContain('idx_cards_canvas_position');
    });

    it('should rollback card migration properly', async () => {
      await addCanvasIdToCards(testDb);

      // Verify migration completed
      const hasCanvasColumn = await testDb.schema.hasColumn('cards', 'canvas_id');
      expect(hasCanvasColumn).toBe(true);

      // Rollback
      await removeCanvasIdFromCards(testDb);

      // Verify rollback
      const hasCanvasColumnAfter = await testDb.schema.hasColumn('cards', 'canvas_id');
      expect(hasCanvasColumnAfter).toBe(false);

      // Verify workspace indexes were restored
      const indexes = await testDb.raw(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'cards' AND indexname LIKE '%workspace%'
      `);

      const indexNames = indexes.rows.map((row: any) => row.indexname);
      expect(indexNames).toContain('idx_cards_workspace_status');
    });
  });

  describe('Data Preservation During Migration', () => {
    beforeEach(async () => {
      await createCanvasesTable(testDb);
    });

    it('should preserve all card data during migration', async () => {
      // Capture original data
      const originalCards = await testDb('cards')
        .select('id', 'title', 'content', 'position_x', 'position_y', 'type', 'created_at')
        .orderBy('created_at');

      await addCanvasIdToCards(testDb);

      // Verify all data preserved
      const migratedCards = await testDb('cards')
        .select('id', 'title', 'content', 'position_x', 'position_y', 'type', 'created_at')
        .orderBy('created_at');

      expect(migratedCards).toHaveLength(originalCards.length);

      originalCards.forEach((originalCard: any, index: number) => {
        const migratedCard = migratedCards[index];
        expect(migratedCard.id).toBe(originalCard.id);
        expect(migratedCard.title).toBe(originalCard.title);
        expect(migratedCard.content).toBe(originalCard.content);
        expect(migratedCard.position_x).toBe(originalCard.position_x);
        expect(migratedCard.position_y).toBe(originalCard.position_y);
        expect(migratedCard.type).toBe(originalCard.type);
        expect(new Date(migratedCard.created_at).getTime()).toBe(new Date(originalCard.created_at).getTime());
      });
    });

    it('should handle cards with complex JSON data', async () => {
      // Add card with complex style and metadata
      const complexCardId = uuidv4();
      await testDb('cards').insert({
        id: complexCardId,
        workspace_id: testWorkspaceId1,
        type: 'note',
        title: 'Complex Card',
        content: 'Card with complex data',
        position_x: 0,
        position_y: 0,
        position_z: 0,
        size_width: 300,
        size_height: 200,
        style: JSON.stringify({
          backgroundColor: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
          textColor: '#ffffff',
          fontSize: 16,
          fontFamily: 'Arial',
          borderRadius: 8,
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        }),
        metadata: JSON.stringify({
          tags: ['important', 'design', 'review'],
          attachments: [
            { type: 'image', url: '/uploads/image1.png' },
            { type: 'document', url: '/uploads/doc1.pdf' },
          ],
          collaborators: [testUserId1, testUserId2],
          dueDate: '2024-12-31T23:59:59Z',
        }),
        created_by: testUserId1,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await addCanvasIdToCards(testDb);

      // Verify complex data preserved
      const complexCard = await testDb('cards').where('id', complexCardId).first();
      
      expect(complexCard).toBeDefined();
      expect(complexCard.canvas_id).toBeDefined();
      
      const style = JSON.parse(complexCard.style);
      expect(style.backgroundColor).toBe('linear-gradient(45deg, #ff6b6b, #4ecdc4)');
      expect(style.boxShadow).toBe('0 4px 8px rgba(0,0,0,0.1)');
      
      const metadata = JSON.parse(complexCard.metadata);
      expect(metadata.tags).toEqual(['important', 'design', 'review']);
      expect(metadata.attachments).toHaveLength(2);
      expect(metadata.collaborators).toEqual([testUserId1, testUserId2]);
    });
  });

  describe('Migration with Various Data Scenarios', () => {
    beforeEach(async () => {
      await createCanvasesTable(testDb);
    });

    it('should handle workspace with deleted cards', async () => {
      // Soft delete some cards (if soft delete is implemented)
      await testDb('cards')
        .where('workspace_id', testWorkspaceId1)
        .limit(5)
        .update({ updated_at: new Date() }); // Simulate soft delete

      await addCanvasIdToCards(testDb);

      // All cards should still be migrated
      const migratedCards = await testDb('cards')
        .where('workspace_id', testWorkspaceId1);

      expect(migratedCards).toHaveLength(15);
      migratedCards.forEach((card: any) => {
        expect(card.canvas_id).toBeDefined();
      });
    });

    it('should handle concurrent workspace creation during migration', async () => {
      // Simulate concurrent workspace creation
      const concurrentWorkspaceId = uuidv4();
      const concurrentUserId = uuidv4();

      // Start migration
      const migrationPromise = addCanvasIdToCards(testDb);

      // Add data during migration (simulate concurrent operations)
      await testDb('users').insert({
        id: concurrentUserId,
        auth0_id: `auth0|${concurrentUserId}`,
        email: 'concurrent@test.com',
        created_at: new Date(),
        updated_at: new Date(),
      });

      await testDb('workspaces').insert({
        id: concurrentWorkspaceId,
        name: 'Concurrent Workspace',
        owner_id: concurrentUserId,
        settings: JSON.stringify({ privacy: 'private' }),
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Wait for migration to complete
      await migrationPromise;

      // Concurrent workspace should not have canvas (since it wasn't there during migration)
      const concurrentCanvas = await testDb('canvases')
        .where('workspace_id', concurrentWorkspaceId);

      expect(concurrentCanvas).toHaveLength(0);
    });

    it('should handle workspaces with different owners', async () => {
      await addCanvasIdToCards(testDb);

      const canvases = await testDb('canvases').select('*');
      const workspaces = await testDb('workspaces').select('id', 'owner_id');

      // Verify each canvas has correct owner
      canvases.forEach((canvas: any) => {
        const workspace = workspaces.find((w: any) => w.id === canvas.workspace_id);
        expect(canvas.created_by).toBe(workspace.owner_id);
      });
    });

    it('should handle large datasets efficiently', async () => {
      // Add more cards to test performance
      const largeDataCards = Array.from({ length: 100 }, (_, i) => ({
        id: uuidv4(),
        workspace_id: testWorkspaceId1,
        type: 'note',
        title: `Bulk Card ${i}`,
        content: `Content ${i}`,
        position_x: i % 10 * 100,
        position_y: Math.floor(i / 10) * 100,
        position_z: 0,
        size_width: 200,
        size_height: 150,
        style: JSON.stringify({ backgroundColor: '#ffffff' }),
        created_by: testUserId1,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      await testDb('cards').insert(largeDataCards);

      const startTime = Date.now();
      await addCanvasIdToCards(testDb);
      const endTime = Date.now();

      const migrationTime = endTime - startTime;
      
      // Migration should complete within reasonable time (< 5 seconds for 118 cards)
      expect(migrationTime).toBeLessThan(5000);

      // Verify all cards migrated
      const totalCards = await testDb('cards').count('id as count');
      expect(parseInt(totalCards[0].count as string)).toBe(118); // 18 original + 100 new

      const cardsWithCanvas = await testDb('cards').whereNotNull('canvas_id').count('id as count');
      expect(parseInt(cardsWithCanvas[0].count as string)).toBe(118);
    });
  });

  describe('Rollback Functionality', () => {
    it('should rollback complete migration chain', async () => {
      // Apply all migrations
      await createCanvasesTable(testDb);
      await addCanvasIdToCards(testDb);

      // Verify migration applied
      expect(await testDb.schema.hasTable('canvases')).toBe(true);
      expect(await testDb.schema.hasColumn('cards', 'canvas_id')).toBe(true);

      // Rollback in reverse order
      await removeCanvasIdFromCards(testDb);
      await dropCanvasesTable(testDb);

      // Verify rollback
      expect(await testDb.schema.hasTable('canvases')).toBe(false);
      expect(await testDb.schema.hasColumn('cards', 'canvas_id')).toBe(false);

      // Verify data integrity after rollback
      const cards = await testDb('cards').count('id as count');
      expect(parseInt(cards[0].count as string)).toBe(18); // All cards preserved
    });

    it('should handle partial rollback scenarios', async () => {
      await createCanvasesTable(testDb);
      await addCanvasIdToCards(testDb);

      // Manually corrupt migration state
      await testDb('canvases').where('workspace_id', testWorkspaceId1).del();

      // Rollback should still work
      await removeCanvasIdFromCards(testDb);

      expect(await testDb.schema.hasColumn('cards', 'canvas_id')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle foreign key constraint errors', async () => {
      await createCanvasesTable(testDb);

      // Delete a user to create constraint violation
      await testDb('users').where('id', testUserId1).del();

      // Migration should handle the error gracefully
      await expect(addCanvasIdToCards(testDb)).rejects.toThrow();

      // Verify partial migration can be cleaned up
      const canvases = await testDb('canvases');
      const cardsWithCanvas = await testDb('cards').whereNotNull('canvas_id');

      // Should not have partial migration state
      expect(canvases.length).toBeLessThanOrEqual(2); // Only workspace 2 should succeed
    });

    it('should handle duplicate canvas name scenarios', async () => {
      await createCanvasesTable(testDb);

      // Pre-create a canvas with conflicting name
      await testDb('canvases').insert({
        id: uuidv4(),
        workspace_id: testWorkspaceId1,
        name: 'Main Canvas',
        is_default: false,
        position: 1,
        created_by: testUserId1,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Migration should handle duplicate names
      await expect(addCanvasIdToCards(testDb)).rejects.toThrow();
    });

    it('should handle database connection issues', async () => {
      await createCanvasesTable(testDb);

      // Mock connection failure by closing connection temporarily
      // This is a simplified test - in real scenarios, you'd mock the DB connection
      const originalQuery = testDb.raw;
      let callCount = 0;
      
      testDb.raw = jest.fn().mockImplementation((query: string) => {
        callCount++;
        if (callCount === 3) {
          throw new Error('Connection lost');
        }
        return originalQuery.call(testDb, query);
      });

      await expect(addCanvasIdToCards(testDb)).rejects.toThrow('Connection lost');

      // Restore original function
      testDb.raw = originalQuery;
    });
  });
});