-- Project Nexus Database Initialization
-- Enable required PostgreSQL extensions for vector embeddings and full-text search

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Enable auto_explain for query plan logging
CREATE EXTENSION IF NOT EXISTS auto_explain;

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify extensions are installed
SELECT 
    extname as "Extension Name",
    extversion as "Version"
FROM pg_extension 
WHERE extname IN ('vector', 'pg_trgm', 'uuid-ossp', 'pg_stat_statements', 'auto_explain', 'pgcrypto')
ORDER BY extname;