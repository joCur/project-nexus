import { Knex } from 'knex';

/**
 * Create users table for Auth0 integration
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).unique().notNullable();
    table.string('auth0_user_id', 255).unique().notNullable();
    table.boolean('email_verified').defaultTo(false);
    table.string('display_name', 100);
    table.text('avatar_url');
    table.timestamp('last_login');
    table.timestamp('auth0_updated_at');
    table.json('roles').defaultTo('[]');
    table.json('permissions').defaultTo('[]');
    table.timestamp('metadata_synced_at').defaultTo(knex.fn.now());
    table.timestamps(true, true); // created_at, updated_at

    // Indexes for performance
    table.index('auth0_user_id');
    table.index('email');
    table.index('last_login');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users');
}