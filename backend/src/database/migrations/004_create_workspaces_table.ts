import { Knex } from 'knex';

/**
 * Create workspaces table for user workspaces
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('workspaces', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.uuid('owner_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.enu('privacy', ['private', 'team', 'public']).defaultTo('private');
    table.json('settings').defaultTo('{}');
    table.boolean('is_default').defaultTo(false);
    table.timestamps(true, true); // created_at, updated_at

    // Indexes for performance
    table.index('owner_id');
    table.index('name');
    table.index('is_default');
    table.index(['owner_id', 'is_default']); // Compound index for finding default workspace
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('workspaces');
}