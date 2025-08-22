import { Knex } from 'knex';

/**
 * Migration to align cards table with frontend type definitions
 * 
 * Critical changes:
 * - Convert enum values from UPPERCASE to lowercase to match frontend
 * - Add missing fields for full canvas support
 * - Ensure field naming consistency
 */
export async function up(knex: Knex): Promise<void> {
  // First, we need to handle the enum conversion carefully
  // We'll create new enums and migrate the data
  
  await knex.raw(`
    -- Create new enum types with lowercase values matching frontend
    CREATE TYPE card_type_new AS ENUM ('text', 'image', 'link', 'code', 'file', 'drawing');
    CREATE TYPE card_status_new AS ENUM ('draft', 'active', 'archived', 'deleted');
    CREATE TYPE card_priority AS ENUM ('low', 'normal', 'high', 'urgent');
  `);

  // Convert existing data to new enum values
  await knex.raw(`
    -- Add temporary columns with new types
    ALTER TABLE cards 
    ADD COLUMN type_new card_type_new,
    ADD COLUMN status_new card_status_new,
    ADD COLUMN priority card_priority DEFAULT 'normal';

    -- Migrate existing data with case conversion
    UPDATE cards SET 
      type_new = LOWER(type::text)::card_type_new,
      status_new = CASE 
        WHEN status = 'ACTIVE' THEN 'active'
        WHEN status = 'ARCHIVED' THEN 'archived'
        WHEN status = 'DELETED' THEN 'deleted'
        ELSE 'active'
      END::card_status_new;

    -- Drop old columns and rename new ones
    ALTER TABLE cards 
    DROP COLUMN type,
    DROP COLUMN status;

    ALTER TABLE cards 
    RENAME COLUMN type_new TO type;
    ALTER TABLE cards 
    RENAME COLUMN status_new TO status;

    -- Drop old enum types
    DROP TYPE IF EXISTS card_type CASCADE;
    DROP TYPE IF EXISTS card_status CASCADE;

    -- Rename new enum types to standard names
    ALTER TYPE card_type_new RENAME TO card_type;
    ALTER TYPE card_status_new RENAME TO card_status;
  `);

  // Add missing canvas-specific fields
  await knex.schema.alterTable('cards', (table) => {
    // Style fields (stored as JSON for flexibility)
    table.json('style').defaultTo(JSON.stringify({
      backgroundColor: '#FFFFFF',
      borderColor: '#E5E7EB',
      textColor: '#1F2937',
      borderWidth: 1,
      borderRadius: 8,
      opacity: 1,
      shadow: true
    }));

    // Interaction states
    table.boolean('is_locked').defaultTo(false);
    table.boolean('is_hidden').defaultTo(false);
    table.boolean('is_minimized').defaultTo(false);
    table.boolean('is_selected').defaultTo(false);

    // Animation state (stored as JSON)
    table.json('animation').defaultTo(JSON.stringify({
      isAnimating: false
    }));

    // Canvas-specific metadata
    table.decimal('rotation', 10, 2).defaultTo(0); // Rotation angle in degrees
    
    // Rename position_z to z_index for clarity
    table.renameColumn('position_z', 'z_index');
  });

  // Add indexes for new fields
  await knex.raw(`
    CREATE INDEX idx_cards_priority ON cards(priority);
    CREATE INDEX idx_cards_is_locked ON cards(is_locked);
    CREATE INDEX idx_cards_is_hidden ON cards(is_hidden);
    CREATE INDEX idx_cards_z_index ON cards(z_index);
  `);

  // Add composite indexes for common queries
  await knex.raw(`
    CREATE INDEX idx_cards_workspace_priority ON cards(workspace_id, priority);
    CREATE INDEX idx_cards_workspace_hidden ON cards(workspace_id, is_hidden) WHERE is_hidden = false;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Revert enum types back to uppercase
  await knex.raw(`
    -- Create old enum types
    CREATE TYPE card_type_old AS ENUM ('TEXT', 'IMAGE', 'LINK', 'CODE', 'FILE', 'DRAWING');
    CREATE TYPE card_status_old AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');
  `);

  await knex.raw(`
    -- Add temporary columns
    ALTER TABLE cards 
    ADD COLUMN type_old card_type_old,
    ADD COLUMN status_old card_status_old;

    -- Migrate data back to uppercase
    UPDATE cards SET 
      type_old = UPPER(type::text)::card_type_old,
      status_old = CASE 
        WHEN status = 'active' THEN 'ACTIVE'
        WHEN status = 'archived' THEN 'ARCHIVED'
        WHEN status = 'deleted' THEN 'DELETED'
        WHEN status = 'draft' THEN 'ACTIVE'
        ELSE 'ACTIVE'
      END::card_status_old;

    -- Drop new columns
    ALTER TABLE cards 
    DROP COLUMN type,
    DROP COLUMN status,
    DROP COLUMN priority;

    -- Rename old columns back
    ALTER TABLE cards 
    RENAME COLUMN type_old TO type;
    ALTER TABLE cards 
    RENAME COLUMN status_old TO status;

    -- Drop new enum types
    DROP TYPE IF EXISTS card_type CASCADE;
    DROP TYPE IF EXISTS card_status CASCADE;
    DROP TYPE IF EXISTS card_priority CASCADE;

    -- Rename old enum types back
    ALTER TYPE card_type_old RENAME TO card_type;
    ALTER TYPE card_status_old RENAME TO card_status;
  `);

  // Remove added fields
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('style');
    table.dropColumn('is_locked');
    table.dropColumn('is_hidden');
    table.dropColumn('is_minimized');
    table.dropColumn('is_selected');
    table.dropColumn('animation');
    table.dropColumn('rotation');
    table.renameColumn('z_index', 'position_z');
  });

  // Drop added indexes
  await knex.raw(`
    DROP INDEX IF EXISTS idx_cards_priority;
    DROP INDEX IF EXISTS idx_cards_is_locked;
    DROP INDEX IF EXISTS idx_cards_is_hidden;
    DROP INDEX IF EXISTS idx_cards_z_index;
    DROP INDEX IF EXISTS idx_cards_workspace_priority;
    DROP INDEX IF EXISTS idx_cards_workspace_hidden;
  `);
}