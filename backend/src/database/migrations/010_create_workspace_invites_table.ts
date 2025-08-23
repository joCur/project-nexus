import { Knex } from 'knex';

/**
 * Create workspace_invites table for managing workspace invitations
 * Tracks pending invitations with secure tokens and expiration
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('workspace_invites', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Foreign keys
    table.uuid('workspace_id')
      .references('id')
      .inTable('workspaces')
      .onDelete('CASCADE')
      .notNullable();
    
    table.uuid('invited_by')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .notNullable();
    
    // Invitation details
    table.string('email', 255)
      .notNullable()
      .comment('Email address of the invitee');
    
    table.uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .nullable()
      .comment('User ID if invitee already has an account');
    
    table.enu('role', ['admin', 'editor', 'viewer'])
      .notNullable()
      .defaultTo('viewer')
      .comment('Role to grant upon acceptance');
    
    table.specificType('permissions', 'text[]')
      .defaultTo('{}')
      .comment('Additional permissions to grant');
    
    // Security
    table.string('token', 64)
      .notNullable()
      .unique()
      .comment('Secure token for invitation link');
    
    table.timestamp('expires_at')
      .notNullable()
      .comment('Invitation expiration timestamp');
    
    // Status tracking
    table.enu('status', ['pending', 'accepted', 'rejected', 'expired', 'cancelled'])
      .notNullable()
      .defaultTo('pending');
    
    table.timestamp('accepted_at').nullable();
    table.timestamp('rejected_at').nullable();
    table.timestamp('cancelled_at').nullable();
    
    // Optional message
    table.text('message')
      .nullable()
      .comment('Optional invitation message from inviter');
    
    // Metadata
    table.json('metadata')
      .defaultTo('{}')
      .comment('Additional metadata for the invitation');
    
    table.timestamps(true, true);
    
    // Constraints
    table.unique(['workspace_id', 'email'], 'unique_pending_invite');
    
    // Indexes for performance
    table.index('workspace_id');
    table.index('email');
    table.index('token');
    table.index('status');
    table.index('expires_at');
    table.index(['workspace_id', 'status']);
    table.index(['email', 'status']);
  });

  // Add function to automatically expire old invitations
  await knex.raw(`
    CREATE OR REPLACE FUNCTION expire_old_invitations()
    RETURNS void AS $$
    BEGIN
      UPDATE workspace_invites
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending' 
      AND expires_at < NOW();
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop function
  await knex.raw(`
    DROP FUNCTION IF EXISTS expire_old_invitations();
  `);
  
  return knex.schema.dropTable('workspace_invites');
}