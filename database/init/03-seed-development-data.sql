-- Development seed data for Project Nexus
-- Only runs in development environment

-- Note: User data will be automatically created when users first authenticate via Auth0
-- No seed user data included - users are created dynamically upon first login
-- 
-- To test with real Auth0 users:
-- 1. Set up Auth0 application 
-- 2. Create test user in Auth0 dashboard
-- 3. Login via the application to auto-create user record

-- Workspaces will be created by users after they authenticate via Auth0
-- No default workspace data included

-- Sample data will be created by users after authentication
-- No seed cards, connections, or activity logs included to avoid orphaned data

-- Create a view for card search with embeddings
CREATE OR REPLACE VIEW card_search_view AS
SELECT 
    c.id,
    c.workspace_id,
    c.title,
    c.content,
    c.card_type,
    c.tags,
    c.position_x,
    c.position_y,
    c.created_at,
    c.updated_at,
    u.display_name as owner_name,
    -- Full-text search vector
    to_tsvector('english', c.title || ' ' || COALESCE(c.content, '')) as search_vector,
    -- Embedding vector for similarity search
    c.embedding,
    c.embedding_model,
    c.embedding_updated_at
FROM cards c
JOIN users u ON c.owner_id = u.id;

-- Create an index on the search view
CREATE INDEX IF NOT EXISTS idx_card_search_vector ON card_search_view USING GIN(search_vector);