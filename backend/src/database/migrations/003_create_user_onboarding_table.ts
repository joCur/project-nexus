import { Knex } from 'knex';

/**
 * Create user_onboarding table for tracking onboarding progress
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('user_onboarding', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.boolean('completed').defaultTo(false);
    table.timestamp('completed_at');
    table.integer('current_step').defaultTo(1);
    table.integer('final_step');
    table.json('tutorial_progress').defaultTo('{}');
    table.timestamps(true, true); // created_at, updated_at

    // Indexes for performance
    table.index('user_id');
    table.index('completed');
    table.index('current_step');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('user_onboarding');
}