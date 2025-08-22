import { Knex } from 'knex';

/**
 * Create canvas settings tables for workspace and user preferences
 * 
 * Stores canvas configuration, viewport state, and user preferences
 * Aligns with frontend canvas state management expectations
 */
export async function up(knex: Knex): Promise<void> {
  // Create workspace canvas settings table
  await knex.schema.createTable('workspace_canvas_settings', (table) => {
    // Primary key is workspace_id (one-to-one with workspaces)
    table.uuid('workspace_id')
      .primary()
      .references('id')
      .inTable('workspaces')
      .onDelete('CASCADE');
    
    // Canvas configuration
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
        boundary: 'elastic' // 'none' | 'hard' | 'elastic'
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
      mode: 'light', // 'light' | 'dark' | 'auto'
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

  // Create user canvas preferences table
  await knex.schema.createTable('user_canvas_preferences', (table) => {
    // Composite primary key
    table.uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    
    table.uuid('workspace_id')
      .references('id')
      .inTable('workspaces')
      .onDelete('CASCADE');
    
    // Last viewport state for this user in this workspace
    table.json('last_viewport').defaultTo(JSON.stringify({
      x: 0,
      y: 0,
      zoom: 1
    }));
    
    // User's personal preferences (overrides workspace defaults)
    table.json('preferences').defaultTo(JSON.stringify({
      // UI preferences
      showMinimap: true,
      showToolbar: true,
      showSidebar: true,
      sidebarPosition: 'right', // 'left' | 'right'
      
      // Interaction preferences
      scrollDirection: 'normal', // 'normal' | 'inverted'
      clickBehavior: 'select', // 'select' | 'pan'
      doubleClickAction: 'edit', // 'edit' | 'expand' | 'none'
      
      // Visual preferences
      connectionStyle: 'curved', // 'straight' | 'curved' | 'stepped'
      cardShadows: true,
      animations: true,
      reducedMotion: false,
      
      // Accessibility
      highContrast: false,
      fontSize: 'normal', // 'small' | 'normal' | 'large'
      colorBlindMode: 'none' // 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
    }));
    
    // Recently used items
    table.json('recent_cards').defaultTo('[]'); // Array of card IDs
    table.json('recent_colors').defaultTo('[]'); // Array of color hex values
    table.json('recent_tags').defaultTo('[]'); // Array of tag strings
    
    // Custom shortcuts and tools
    table.json('custom_shortcuts').defaultTo('{}');
    table.json('favorite_tools').defaultTo('[]');
    
    // Canvas state flags
    table.boolean('tutorial_completed').defaultTo(false);
    table.boolean('tips_enabled').defaultTo(true);
    
    // Last activity timestamp
    table.timestamp('last_accessed_at').defaultTo(knex.fn.now());
    
    // Timestamps
    table.timestamps(true, true);
    
    // Composite primary key
    table.primary(['user_id', 'workspace_id']);
  });

  // Create canvas sessions table for temporary state
  await knex.schema.createTable('canvas_sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    table.uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .notNullable();
    
    table.uuid('workspace_id')
      .references('id')
      .inTable('workspaces')
      .onDelete('CASCADE')
      .notNullable();
    
    // Session state
    table.json('viewport_state').notNullable();
    table.json('selection_state').defaultTo('{}');
    table.json('clipboard_state').defaultTo('[]');
    table.json('undo_stack').defaultTo('[]');
    table.json('redo_stack').defaultTo('[]');
    
    // Session metadata
    table.string('session_token').unique().notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_activity_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    
    // Timestamps
    table.timestamps(true, true);
  });

  // Create indexes
  await knex.raw(`
    -- Workspace settings index
    CREATE INDEX idx_workspace_canvas_settings_updated ON workspace_canvas_settings(updated_at);
    
    -- User preferences indexes
    CREATE INDEX idx_user_canvas_preferences_user ON user_canvas_preferences(user_id);
    CREATE INDEX idx_user_canvas_preferences_workspace ON user_canvas_preferences(workspace_id);
    CREATE INDEX idx_user_canvas_preferences_accessed ON user_canvas_preferences(last_accessed_at);
    
    -- Session indexes
    CREATE INDEX idx_canvas_sessions_user ON canvas_sessions(user_id);
    CREATE INDEX idx_canvas_sessions_workspace ON canvas_sessions(workspace_id);
    CREATE INDEX idx_canvas_sessions_token ON canvas_sessions(session_token);
    CREATE INDEX idx_canvas_sessions_active ON canvas_sessions(is_active) WHERE is_active = true;
    CREATE INDEX idx_canvas_sessions_expires ON canvas_sessions(expires_at);
  `);

  // Create function to clean up expired sessions
  await knex.raw(`
    CREATE OR REPLACE FUNCTION cleanup_expired_canvas_sessions()
    RETURNS void AS $$
    BEGIN
      DELETE FROM canvas_sessions 
      WHERE expires_at < NOW() OR is_active = false;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop function
  await knex.raw('DROP FUNCTION IF EXISTS cleanup_expired_canvas_sessions();');
  
  // Drop tables in reverse order
  await knex.schema.dropTable('canvas_sessions');
  await knex.schema.dropTable('user_canvas_preferences');
  await knex.schema.dropTable('workspace_canvas_settings');
}