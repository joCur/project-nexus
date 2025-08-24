import { Knex } from 'knex';

/**
 * Add canvas_id to cards table and migrate existing data
 * 
 * This migration:
 * 1. Adds canvas_id column to cards table (nullable initially)
 * 2. Creates a default canvas for each existing workspace
 * 3. Migrates all existing cards to their workspace's default canvas
 * 4. Makes canvas_id NOT NULL after data migration
 * 5. Adds proper indexes and foreign keys
 * 6. Updates existing constraints
 */
export async function up(knex: Knex): Promise<void> {
  // Step 1: Add canvas_id column (nullable initially for data migration)
  await knex.schema.alterTable('cards', (table) => {
    table.uuid('canvas_id').nullable();
  });

  // Step 2: Create default canvas for each existing workspace
  // First, get all existing workspaces with their owners
  const workspaces = await knex('workspaces')
    .select('id', 'owner_id', 'name')
    .orderBy('created_at');

  // Create default canvases for each workspace
  for (const workspace of workspaces) {
    await knex('canvases').insert({
      workspace_id: workspace.id,
      name: 'Main Canvas',
      description: 'Default canvas created during multi-canvas migration',
      is_default: true,
      position: 0,
      created_by: workspace.owner_id,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });
  }

  // Step 3: Get the default canvas for each workspace and migrate cards
  const defaultCanvases = await knex('canvases')
    .select('id', 'workspace_id')
    .where('is_default', true);

  // Create a map for quick lookup
  const workspaceToCanvasMap = new Map();
  defaultCanvases.forEach(canvas => {
    workspaceToCanvasMap.set(canvas.workspace_id, canvas.id);
  });

  // Update all existing cards to use their workspace's default canvas
  const cards = await knex('cards').select('id', 'workspace_id');
  
  for (const card of cards) {
    const canvasId = workspaceToCanvasMap.get(card.workspace_id);
    if (canvasId) {
      await knex('cards')
        .where('id', card.id)
        .update('canvas_id', canvasId);
    }
  }

  // Step 4: Make canvas_id NOT NULL and add foreign key constraint
  await knex.schema.alterTable('cards', (table) => {
    // First make the column NOT NULL
    table.uuid('canvas_id').notNullable().alter();
    
    // Add foreign key constraint with CASCADE delete
    table.foreign('canvas_id')
      .references('id')
      .inTable('canvases')
      .onDelete('CASCADE');
  });

  // Step 5: Add indexes for performance
  await knex.raw(`
    -- Primary index on canvas_id for JOIN performance
    CREATE INDEX idx_cards_canvas_id ON cards(canvas_id);
    
    -- Compound indexes for common query patterns
    CREATE INDEX idx_cards_canvas_status ON cards(canvas_id, status);
    CREATE INDEX idx_cards_canvas_type ON cards(canvas_id, type);
    CREATE INDEX idx_cards_canvas_created_by ON cards(canvas_id, created_by);
    CREATE INDEX idx_cards_canvas_updated ON cards(canvas_id, updated_at);
    
    -- Spatial index for canvas-specific queries
    CREATE INDEX idx_cards_canvas_position ON cards(canvas_id, position_x, position_y);
  `);

  // Step 6: Update existing workspace-based indexes to be canvas-based
  await knex.raw(`
    -- Drop old workspace-based compound indexes that are now redundant
    DROP INDEX IF EXISTS idx_cards_workspace_status;
    DROP INDEX IF EXISTS idx_cards_workspace_type;
    DROP INDEX IF EXISTS idx_cards_workspace_created_by;
  `);
}

/**
 * Rollback: Remove canvas_id from cards and restore workspace-based structure
 * 
 * Note: This rollback will lose canvas-specific organization and revert
 * all cards to be directly associated with workspaces.
 */
export async function down(knex: Knex): Promise<void> {
  // Step 1: Drop canvas-specific indexes
  await knex.raw(`
    DROP INDEX IF EXISTS idx_cards_canvas_id;
    DROP INDEX IF EXISTS idx_cards_canvas_status;
    DROP INDEX IF EXISTS idx_cards_canvas_type;
    DROP INDEX IF EXISTS idx_cards_canvas_created_by;
    DROP INDEX IF EXISTS idx_cards_canvas_updated;
    DROP INDEX IF EXISTS idx_cards_canvas_position;
  `);

  // Step 2: Restore workspace-based compound indexes
  await knex.raw(`
    CREATE INDEX idx_cards_workspace_status ON cards(workspace_id, status);
    CREATE INDEX idx_cards_workspace_type ON cards(workspace_id, type);
    CREATE INDEX idx_cards_workspace_created_by ON cards(workspace_id, created_by);
  `);

  // Step 3: Remove canvas_id column from cards table
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('canvas_id');
  });
}