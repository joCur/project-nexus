// Knex configuration for database migrations and seeds
const path = require('path');
const dotenv = require('dotenv');

// Register ts-node for TypeScript support
require('ts-node').register({
  project: path.join(__dirname, 'tsconfig.json'),
  require: ['tsconfig-paths/register']
});

// Load environment variables from root directory .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Determine database host based on environment
const getDatabaseHost = () => {
  if (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV) {
    return 'postgres';
  }
  return 'localhost';
};

module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: getDatabaseHost(),
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DB || 'nexus_db',
      user: process.env.POSTGRES_USER || 'nexus',
      password: process.env.POSTGRES_PASSWORD || 'nexus_secure_2024',
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: path.join(__dirname, 'src', 'database', 'migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
    },
    seeds: {
      directory: path.join(__dirname, 'src', 'database', 'seeds'),
      extension: 'ts',
    },
  },

  production: {
    client: 'postgresql',
    connection: {
      host: getDatabaseHost(),
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 20,
    },
    migrations: {
      directory: path.join(__dirname, 'dist', 'database', 'migrations'),
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: path.join(__dirname, 'dist', 'database', 'seeds'),
    },
  },

  test: {
    client: 'postgresql',
    connection: {
      host: 'localhost', // Tests always run locally
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DB || process.env.TEST_POSTGRES_DB || 'nexus_test_db',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'test_password',
    },
    pool: {
      min: 1,
      max: 5,
    },
    migrations: {
      directory: path.join(__dirname, 'src', 'database', 'migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
    },
    seeds: {
      directory: path.join(__dirname, 'src', 'database', 'seeds'),
      extension: 'ts',
    },
  },
};