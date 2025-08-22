import { Knex } from 'knex';

/**
 * Create connections table for card relationships
 * 
 * Supports both manual connections and future AI-suggested connections
 * Field names align with frontend expectations (sourceCardId -> source_card_id)
 */
export async function up(knex: Knex): Promise<void> {
  // Create connection type enum
  await knex.raw(`
    CREATE TYPE connection_type AS ENUM (
      'manual',
      'ai_suggested',
      'ai_generated',
      'reference',
      'dependency',
      'similarity',
      'related'
    );
  `);

  // Create connections table
  await knex.schema.createTable('connections', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Foreign keys - aligned with frontend sourceCardId/targetCardId
    table.uuid('source_card_id')
      .references('id')
      .inTable('cards')
      .onDelete('CASCADE')
      .notNullable();
    
    table.uuid('target_card_id')
      .references('id')
      .inTable('cards')
      .onDelete('CASCADE')
      .notNullable();
    
    // Connection properties
    table.specificType('type', 'connection_type').notNullable().defaultTo('manual');
    
    // Confidence score for AI connections (0.0 to 1.0)
    table.decimal('confidence', 3, 2).defaultTo(1.0);
    
    // Visual style (stored as JSON for flexibility)
    table.json('style').defaultTo(JSON.stringify({
      color: '#6B7280',
      width: 2,
      opacity: 0.8,
      curve: 'curved',
      showArrow: true,
      showLabel: false
    }));
    
    // Optional label configuration
    table.json('label').nullable();
    
    // Metadata for additional properties
    table.json('metadata').defaultTo('{}');
    
    // User tracking
    table.uuid('created_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL')
      .notNullable();
    
    // Visibility control
    table.boolean('is_visible').defaultTo(true);
    
    // AI-specific fields
    table.text('ai_reasoning').nullable(); // Explanation for AI connections
    table.specificType('keywords', 'text[]').nullable(); // Keywords that triggered connection
    table.specificType('concepts', 'text[]').nullable(); // Concepts linking the cards
    
    // Timestamps
    table.timestamps(true, true); // created_at, updated_at
    
    // Ensure unique connections between cards
    table.unique(['source_card_id', 'target_card_id', 'type']);
  });

  // Create indexes for performance
  await knex.raw(`
    -- Indexes for querying connections by card
    CREATE INDEX idx_connections_source_card ON connections(source_card_id);
    CREATE INDEX idx_connections_target_card ON connections(target_card_id);
    
    -- Index for filtering by type
    CREATE INDEX idx_connections_type ON connections(type);
    
    -- Index for AI connections with high confidence
    CREATE INDEX idx_connections_confidence ON connections(confidence) 
      WHERE type IN ('ai_suggested', 'ai_generated');
    
    -- Index for visible connections
    CREATE INDEX idx_connections_visible ON connections(is_visible) 
      WHERE is_visible = true;
    
    -- Composite indexes for common queries
    CREATE INDEX idx_connections_source_type ON connections(source_card_id, type);
    CREATE INDEX idx_connections_target_type ON connections(target_card_id, type);
    
    -- Index for user's connections
    CREATE INDEX idx_connections_created_by ON connections(created_by);
    
    -- Index for timestamp-based queries
    CREATE INDEX idx_connections_created_at ON connections(created_at);
    CREATE INDEX idx_connections_updated_at ON connections(updated_at);
  `);

  // Create function to prevent self-connections
  await knex.raw(`
    CREATE OR REPLACE FUNCTION check_no_self_connection()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.source_card_id = NEW.target_card_id THEN
        RAISE EXCEPTION 'Cannot create connection from card to itself';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER prevent_self_connection
    BEFORE INSERT OR UPDATE ON connections
    FOR EACH ROW
    EXECUTE FUNCTION check_no_self_connection();
  `);

  // Create view for bidirectional connections
  await knex.raw(`
    CREATE VIEW bidirectional_connections AS
    SELECT 
      id,
      source_card_id,
      target_card_id,
      type,
      confidence,
      style,
      label,
      metadata,
      created_by,
      is_visible,
      ai_reasoning,
      keywords,
      concepts,
      created_at,
      updated_at,
      'forward' as direction
    FROM connections
    
    UNION ALL
    
    SELECT 
      id,
      target_card_id as source_card_id,
      source_card_id as target_card_id,
      type,
      confidence,
      style,
      label,
      metadata,
      created_by,
      is_visible,
      ai_reasoning,
      keywords,
      concepts,
      created_at,
      updated_at,
      'reverse' as direction
    FROM connections;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop view
  await knex.raw('DROP VIEW IF EXISTS bidirectional_connections;');
  
  // Drop trigger and function
  await knex.raw(`
    DROP TRIGGER IF EXISTS prevent_self_connection ON connections;
    DROP FUNCTION IF EXISTS check_no_self_connection();
  `);
  
  // Drop table
  await knex.schema.dropTable('connections');
  
  // Drop enum type
  await knex.raw('DROP TYPE IF EXISTS connection_type;');
}