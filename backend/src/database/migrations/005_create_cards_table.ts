import { Knex } from 'knex';

/**
 * Create cards table for infinite canvas cards
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('cards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workspace_id').references('id').inTable('workspaces').onDelete('CASCADE').notNullable();
    table.enu('type', ['TEXT', 'IMAGE', 'LINK', 'CODE', 'FILE', 'DRAWING']).notNullable();
    table.string('title', 200).nullable();
    table.text('content').notNullable();
    
    // Position fields
    table.decimal('position_x', 12, 2).notNullable();
    table.decimal('position_y', 12, 2).notNullable();
    table.integer('position_z').defaultTo(0);
    
    // Dimension fields
    table.decimal('width', 10, 2).notNullable();
    table.decimal('height', 10, 2).notNullable();
    
    // Content and metadata
    table.json('metadata').defaultTo('{}');
    table.json('tags').defaultTo('[]');
    
    // Status and versioning
    table.enu('status', ['ACTIVE', 'ARCHIVED', 'DELETED']).defaultTo('ACTIVE');
    table.integer('version').defaultTo(1).notNullable();
    
    // User tracking
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL').notNullable();
    table.uuid('last_modified_by').references('id').inTable('users').onDelete('SET NULL').notNullable();
    
    // Auto-save tracking
    table.timestamp('last_saved_at').nullable();
    table.boolean('is_dirty').defaultTo(false);
    
    // Timestamps
    table.timestamps(true, true); // created_at, updated_at

    // Indexes for performance
    table.index('workspace_id');
    table.index('type');
    table.index('status');
    table.index('created_by');
    table.index('last_modified_by');
    table.index('created_at');
    table.index('updated_at');
    
    // Compound indexes
    table.index(['workspace_id', 'status']); // For listing active cards in workspace
    table.index(['workspace_id', 'type']); // For filtering by type in workspace
    table.index(['workspace_id', 'created_by']); // For user's cards in workspace
    table.index(['position_x', 'position_y']); // For spatial queries
    
    // Text search index on content and title
    table.index('title');
  });
}

/**
 * Add pgvector fields and indexes in a separate raw SQL execution
 * This is done after table creation because Knex doesn't natively support vector types
 */
export async function addVectorFields(knex: Knex): Promise<void> {
  // Add vector embedding columns
  await knex.raw(`
    ALTER TABLE cards 
    ADD COLUMN embedding vector(1536),
    ADD COLUMN embedding_model VARCHAR(50) DEFAULT 'text-embedding-ada-002',
    ADD COLUMN embedding_created_at TIMESTAMP,
    ADD COLUMN content_hash VARCHAR(64)
  `);
  
  // Add indexes for vector operations
  await knex.raw(`
    -- Create HNSW index for high recall vector similarity search
    CREATE INDEX idx_cards_embedding_hnsw ON cards 
    USING hnsw (embedding vector_cosine_ops) 
    WITH (m = 16, ef_construction = 64);
    
    -- Create index for content hash lookups
    CREATE INDEX idx_cards_content_hash ON cards(content_hash);
    
    -- Partial index for cards with embeddings
    CREATE INDEX idx_cards_with_embeddings ON cards(workspace_id, updated_at) 
    WHERE embedding IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('cards');
}