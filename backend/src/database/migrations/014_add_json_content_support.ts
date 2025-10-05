import { Knex } from 'knex';

/**
 * Migration: Add JSONB content support for Tiptap editor
 *
 * This migration adds support for storing Tiptap JSON content alongside
 * existing markdown string content, enabling:
 * - Rich text editing with Tiptap v3 editor
 * - Backward compatibility with existing markdown content
 * - Efficient JSONB querying and indexing
 *
 * Database changes:
 * 1. Add content_json JSONB column for Tiptap JSON content
 * 2. Add content_format enum column ('markdown' | 'tiptap')
 * 3. Add GIN index on content_json for efficient JSON queries
 * 4. Add index on content_format for filtering
 *
 * Backward compatibility:
 * - Existing cards keep their markdown content in the 'content' TEXT column
 * - content_format defaults to 'markdown' for existing cards
 * - New cards can use either format based on content_format value
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cards', (table) => {
    // Add JSONB column for Tiptap JSON content (nullable for backward compatibility)
    table.jsonb('content_json').nullable();

    // Add content format enum column with default 'markdown' for backward compatibility
    // Valid values: 'markdown' (legacy string content) or 'tiptap' (JSON content)
    table.enu('content_format', ['markdown', 'tiptap'], {
      useNative: true,
      enumName: 'content_format_type'
    }).defaultTo('markdown').notNullable();
  });

  // Set content_format to 'markdown' for all existing cards (backward compatibility)
  // This ensures existing cards continue to work without changes
  await knex.raw(`
    UPDATE cards
    SET content_format = 'markdown'
    WHERE content_format IS NULL;
  `);

  // Create GIN index on content_json for efficient JSONB queries
  // GIN (Generalized Inverted Index) is optimal for JSONB containment and existence queries
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_content_json_gin
    ON cards USING GIN (content_json)
    WHERE content_json IS NOT NULL;
  `);

  // Create index on content_format for efficient filtering by content type
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_content_format
    ON cards (content_format);
  `);

  // Add comment documenting the migration
  await knex.raw(`
    COMMENT ON COLUMN cards.content_json IS
    'Tiptap JSON content structure - used when content_format is "tiptap". NULL when using markdown format.';
  `);

  await knex.raw(`
    COMMENT ON COLUMN cards.content_format IS
    'Content format type: "markdown" for legacy string content, "tiptap" for JSON structure. Defaults to "markdown" for backward compatibility.';
  `);
}

/**
 * Rollback migration
 *
 * WARNING: This will drop the content_json and content_format columns.
 * Any Tiptap JSON content will be lost. Ensure you have backups before rolling back.
 */
export async function down(knex: Knex): Promise<void> {
  // Drop indexes first
  await knex.raw(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_cards_content_json_gin;
  `);

  await knex.raw(`
    DROP INDEX CONCURRENTLY IF EXISTS idx_cards_content_format;
  `);

  // Drop columns
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('content_json');
    table.dropColumn('content_format');
  });

  // Drop the enum type
  await knex.raw(`
    DROP TYPE IF EXISTS content_format_type;
  `);
}
