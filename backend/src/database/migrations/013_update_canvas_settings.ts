import { Knex } from 'knex';

/**
 * Update canvas settings structure to support per-canvas configuration
 * 
 * This migration:
 * 1. Creates a new canvas_canvas_settings table for per-canvas settings
 * 2. Migrates existing workspace_canvas_settings to default canvases
 * 3. Updates user_canvas_preferences to reference specific canvases
 * 4. Updates canvas_sessions to be canvas-specific
 * 5. Maintains backward compatibility during transition
 */
export async function up(knex: Knex): Promise<void> {
  // Step 1: Create new canvas_canvas_settings table
  await knex.schema.createTable('canvas_canvas_settings', (table) => {
    // Primary key is canvas_id (one-to-one with canvases)
    table.uuid('canvas_id')
      .primary()
      .references('id')
      .inTable('canvases')
      .onDelete('CASCADE');
    
    // Canvas configuration (same structure as workspace settings)
    table.json('canvas_config').defaultTo(JSON.stringify({
      // Grid settings
      grid: {
        enabled: true,
        size: 20,
        color: '#E5E7EB',
        opacity: 0.5,
        snap: true,
        snapThreshold: 10
      },
      // Zoom settings
      zoom: {
        min: 0.25,
        max: 4.0,
        wheelSensitivity: 0.001,
        smoothing: true
      },
      // Pan settings
      pan: {
        enabled: true,
        momentum: true,
        friction: 0.92,
        boundary: 'elastic'
      },
      // Selection settings
      selection: {
        multiSelect: true,
        boxSelect: true,
        showOutline: true,
        color: '#3B82F6'
      },
      // Performance settings
      performance: {
        culling: true,
        cullingPadding: 100,
        lodEnabled: true,
        lodThreshold: 0.5,
        animationsEnabled: true
      }
    }));
    
    // Default card settings for new cards
    table.json('default_card_settings').defaultTo(JSON.stringify({
      dimensions: {
        text: { width: 250, height: 150 },
        image: { width: 300, height: 200 },
        link: { width: 280, height: 120 },
        code: { width: 400, height: 250 }
      },
      style: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        textColor: '#1F2937',
        borderWidth: 1,
        borderRadius: 8,
        opacity: 1,
        shadow: true
      }
    }));
    
    // Canvas boundaries and constraints
    table.json('canvas_bounds').defaultTo(JSON.stringify({
      minX: -10000,
      maxX: 10000,
      minY: -10000,
      maxY: 10000,
      padding: 500
    }));
    
    // Theme and appearance
    table.json('theme').defaultTo(JSON.stringify({
      mode: 'light',
      background: '#F9FAFB',
      accent: '#3B82F6',
      customColors: {}
    }));
    
    // Feature flags for experimental features
    table.json('features').defaultTo(JSON.stringify({
      aiSuggestions: false,
      autoLayout: false,
      collaboration: false,
      versionHistory: false
    }));
    
    // Timestamps
    table.timestamps(true, true);
  });

  // Step 2: Migrate existing workspace canvas settings to default canvases
  const workspaceSettings = await knex('workspace_canvas_settings')
    .select('*')
    .orderBy('created_at');

  for (const settings of workspaceSettings) {
    // Find the default canvas for this workspace
    const defaultCanvas = await knex('canvases')
      .select('id')
      .where('workspace_id', settings.workspace_id)
      .where('is_default', true)
      .first();

    if (defaultCanvas) {
      await knex('canvas_canvas_settings').insert({
        canvas_id: defaultCanvas.id,
        canvas_config: settings.canvas_config,
        default_card_settings: settings.default_card_settings,
        canvas_bounds: settings.canvas_bounds,
        theme: settings.theme,
        features: settings.features,
        created_at: settings.created_at,
        updated_at: settings.updated_at
      });
    }
  }

  // Step 3: Add canvas_id to user_canvas_preferences
  await knex.schema.alterTable('user_canvas_preferences', (table) => {
    table.uuid('canvas_id').nullable();
  });

  // Migrate existing user preferences to default canvases
  const userPreferences = await knex('user_canvas_preferences')
    .select('*')
    .orderBy('created_at');

  for (const pref of userPreferences) {
    // Find the default canvas for this workspace
    const defaultCanvas = await knex('canvases')
      .select('id')
      .where('workspace_id', pref.workspace_id)
      .where('is_default', true)
      .first();

    if (defaultCanvas) {
      await knex('user_canvas_preferences')
        .where('user_id', pref.user_id)
        .where('workspace_id', pref.workspace_id)
        .update('canvas_id', defaultCanvas.id);
    }
  }

  // Make canvas_id NOT NULL and add foreign key
  await knex.schema.alterTable('user_canvas_preferences', (table) => {
    table.uuid('canvas_id').notNullable().alter();
    table.foreign('canvas_id')
      .references('id')
      .inTable('canvases')
      .onDelete('CASCADE');
  });

  // Update primary key to include canvas_id instead of workspace_id
  await knex.raw(`
    ALTER TABLE user_canvas_preferences DROP CONSTRAINT user_canvas_preferences_pkey;
    ALTER TABLE user_canvas_preferences ADD CONSTRAINT user_canvas_preferences_pkey 
    PRIMARY KEY (user_id, canvas_id);
  `);

  // Step 4: Add canvas_id to canvas_sessions
  await knex.schema.alterTable('canvas_sessions', (table) => {
    table.uuid('canvas_id').nullable();
  });

  // Migrate existing sessions to default canvases
  const sessions = await knex('canvas_sessions')
    .select('*')
    .where('is_active', true);

  for (const session of sessions) {
    const defaultCanvas = await knex('canvases')
      .select('id')
      .where('workspace_id', session.workspace_id)
      .where('is_default', true)
      .first();

    if (defaultCanvas) {
      await knex('canvas_sessions')
        .where('id', session.id)
        .update('canvas_id', defaultCanvas.id);
    }
  }

  // Make canvas_id NOT NULL and add foreign key
  await knex.schema.alterTable('canvas_sessions', (table) => {
    table.uuid('canvas_id').notNullable().alter();
    table.foreign('canvas_id')
      .references('id')
      .inTable('canvases')
      .onDelete('CASCADE');
  });

  // Step 5: Create indexes for new structure
  await knex.raw(`
    -- Canvas settings index
    CREATE INDEX idx_canvas_canvas_settings_updated ON canvas_canvas_settings(updated_at);
    
    -- User preferences indexes (updated for canvas_id)
    CREATE INDEX idx_user_canvas_preferences_canvas ON user_canvas_preferences(canvas_id);
    CREATE INDEX idx_user_canvas_preferences_user_canvas ON user_canvas_preferences(user_id, canvas_id);
    
    -- Session indexes (updated for canvas_id)
    CREATE INDEX idx_canvas_sessions_canvas ON canvas_sessions(canvas_id);
    CREATE INDEX idx_canvas_sessions_canvas_active ON canvas_sessions(canvas_id, is_active) WHERE is_active = true;
  `);

  // Step 6: Drop old workspace-based indexes that are now redundant
  await knex.raw(`
    DROP INDEX IF EXISTS idx_user_canvas_preferences_workspace;
    DROP INDEX IF EXISTS idx_canvas_sessions_workspace;
  `);
}

/**
 * Rollback: Restore workspace-based canvas settings structure
 * 
 * Note: This rollback will consolidate canvas-specific settings back to 
 * workspace level, potentially losing per-canvas customizations.
 */
export async function down(knex: Knex): Promise<void> {
  // Step 1: Restore workspace-based indexes
  await knex.raw(`
    CREATE INDEX idx_user_canvas_preferences_workspace ON user_canvas_preferences(workspace_id);
    CREATE INDEX idx_canvas_sessions_workspace ON canvas_sessions(workspace_id);
  `);

  // Step 2: Drop canvas-specific indexes
  await knex.raw(`
    DROP INDEX IF EXISTS idx_canvas_canvas_settings_updated;
    DROP INDEX IF EXISTS idx_user_canvas_preferences_canvas;
    DROP INDEX IF EXISTS idx_user_canvas_preferences_user_canvas;
    DROP INDEX IF EXISTS idx_canvas_sessions_canvas;
    DROP INDEX IF EXISTS idx_canvas_sessions_canvas_active;
  `);

  // Step 3: Remove canvas_id from canvas_sessions
  await knex.schema.alterTable('canvas_sessions', (table) => {
    table.dropColumn('canvas_id');
  });

  // Step 4: Restore original primary key for user_canvas_preferences
  await knex.raw(`
    ALTER TABLE user_canvas_preferences DROP CONSTRAINT user_canvas_preferences_pkey;
    ALTER TABLE user_canvas_preferences ADD CONSTRAINT user_canvas_preferences_pkey 
    PRIMARY KEY (user_id, workspace_id);
  `);

  // Step 5: Remove canvas_id from user_canvas_preferences
  await knex.schema.alterTable('user_canvas_preferences', (table) => {
    table.dropColumn('canvas_id');
  });

  // Step 6: Drop canvas_canvas_settings table
  await knex.schema.dropTable('canvas_canvas_settings');
}