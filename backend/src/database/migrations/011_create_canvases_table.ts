import { Knex } from 'knex';

/**
 * Create canvases table to support multi-canvas functionality
 * 
 * This introduces an intermediate layer between workspaces and cards,
 * allowing each workspace to have multiple canvases with their own
 * organization and settings.
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('canvases', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Foreign key to workspaces with CASCADE delete
    table.uuid('workspace_id')
      .references('id')
      .inTable('workspaces')
      .onDelete('CASCADE')
      .notNullable();
    
    // Canvas identification and metadata
    table.string('name', 100).notNullable();
    table.text('description').nullable();
    
    // Canvas ordering and default handling
    table.boolean('is_default').defaultTo(false);
    table.integer('position').defaultTo(0);
    
    // User tracking
    table.uuid('created_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL')
      .notNullable();
    
    // Timestamps
    table.timestamps(true, true); // created_at, updated_at

    // Basic indexes for performance
    table.index('workspace_id');
    table.index('position');
    table.index('created_by');
    table.index('created_at');
    
    // Compound indexes
    table.index(['workspace_id', 'position']); // For ordered canvas listing
    table.index(['workspace_id', 'is_default']); // For finding default canvas
    
    // Business rule constraints
    table.unique(['workspace_id', 'name']); // Unique canvas names within workspace
  });
}

/**
 * Add additional constraints and indexes after table creation
 * This ensures exactly one default canvas per workspace using a partial unique index
 */
export async function addCanvasConstraints(knex: Knex): Promise<void> {
  await knex.raw(`
    -- Ensure exactly one default canvas per workspace
    -- Uses partial unique index to allow multiple false values but only one true per workspace_id
    CREATE UNIQUE INDEX idx_canvases_workspace_default_unique 
    ON canvases(workspace_id) 
    WHERE is_default = true;
    
    -- Add check constraint to ensure position is non-negative
    ALTER TABLE canvases 
    ADD CONSTRAINT chk_canvases_position_non_negative 
    CHECK (position >= 0);
    
    -- Add check constraint to ensure name is not empty
    ALTER TABLE canvases 
    ADD CONSTRAINT chk_canvases_name_not_empty 
    CHECK (trim(name) != '');
  `);
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('canvases');
}