-- Project Nexus Database Initialization Script
-- This script sets up the PostgreSQL database with required extensions for the AI-powered visual knowledge workspace

-- Enable pgvector extension for AI embeddings and similarity search
-- This extension is required for storing and querying vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp for UUID generation
-- Used throughout the application for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for cryptographic functions
-- Used for secure password hashing and other cryptographic operations
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable btree_gin for advanced indexing
-- Improves performance for complex queries with multiple conditions
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Enable pg_trgm for fuzzy text search
-- Enables similarity search and fuzzy matching for text content
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify extensions are properly installed
SELECT
    extname as "Extension",
    extversion as "Version"
FROM pg_extension
WHERE extname IN ('vector', 'uuid-ossp', 'pgcrypto', 'btree_gin', 'pg_trgm')
ORDER BY extname;

-- Log successful initialization
\echo 'Project Nexus database extensions initialized successfully'
\echo 'Available extensions:'
\echo '  - vector: AI embeddings and similarity search'
\echo '  - uuid-ossp: UUID generation functions'
\echo '  - pgcrypto: Cryptographic functions'
\echo '  - btree_gin: Advanced indexing'
\echo '  - pg_trgm: Fuzzy text search'