import { Knex } from 'knex';

/**
 * Create workspace_members table for workspace collaboration and sharing
 * Enables multiple users to access the same workspace with different roles
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('workspace_members', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Foreign keys
    table.uuid('workspace_id')
      .references('id')
      .inTable('workspaces')
      .onDelete('CASCADE')
      .notNullable();
    
    table.uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .notNullable();
    
    // Role and permissions
    table.enu('role', ['owner', 'admin', 'member', 'viewer'])
      .notNullable()
      .defaultTo('viewer');
    
    table.specificType('permissions', 'text[]')
      .defaultTo('{}')
      .comment('Additional granular permissions beyond role');
    
    // Tracking
    table.uuid('invited_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    
    table.timestamp('joined_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('last_accessed').nullable();
    
    // Settings
    table.json('member_settings')
      .defaultTo('{}')
      .comment('User-specific settings for this workspace');
    
    table.boolean('is_active').defaultTo(true);
    
    table.timestamps(true, true);
    
    // Constraints
    table.unique(['workspace_id', 'user_id'], 'unique_workspace_member');
    
    // Indexes for performance
    table.index('workspace_id');
    table.index('user_id');
    table.index('role');
    table.index(['workspace_id', 'role']);
    table.index(['user_id', 'is_active']);
  });

  // Add check constraint to ensure at least one owner per workspace
  await knex.raw(`
    CREATE OR REPLACE FUNCTION check_workspace_has_owner()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.role != 'owner' OR NOT NEW.is_active THEN
        IF NOT EXISTS (
          SELECT 1 FROM workspace_members 
          WHERE workspace_id = NEW.workspace_id 
          AND role = 'owner' 
          AND is_active = true
          AND id != NEW.id
        ) THEN
          RAISE EXCEPTION 'Workspace must have at least one active owner';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER ensure_workspace_owner
    BEFORE UPDATE ON workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION check_workspace_has_owner();
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop trigger and function
  await knex.raw(`
    DROP TRIGGER IF EXISTS ensure_workspace_owner ON workspace_members;
    DROP FUNCTION IF EXISTS check_workspace_has_owner();
  `);
  
  return knex.schema.dropTable('workspace_members');
}