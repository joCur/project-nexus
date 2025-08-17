import { Knex } from 'knex';

/**
 * Create user_profiles table for onboarding data
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_profiles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.string('full_name', 255).notNullable();
    table.string('display_name', 100);
    table.string('timezone', 100);
    table.enu('role', ['student', 'researcher', 'creative', 'business', 'other']);
    table.json('preferences').defaultTo('{}');
    table.timestamps(true, true); // created_at, updated_at

    // Indexes for performance
    table.index('user_id');
    table.index('full_name');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('user_profiles');
}