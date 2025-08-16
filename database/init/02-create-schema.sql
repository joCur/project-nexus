-- Project Nexus Database Schema
-- Core tables for users, workspaces, cards, and AI embeddings

-- Users table with Auth0 integration
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    auth0_user_id VARCHAR(255) UNIQUE NOT NULL, -- Auth0 'sub' field
    email_verified BOOLEAN DEFAULT FALSE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    last_login TIMESTAMP,
    auth0_updated_at TIMESTAMP, -- From Auth0 'updated_at'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Auth0 metadata cache (for performance)
    roles TEXT[], -- Cached from Auth0 app_metadata.roles
    permissions TEXT[], -- Cached from Auth0 app_metadata.permissions
    metadata_synced_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Auth0 user lookup
CREATE INDEX IF NOT EXISTS idx_users_auth0_user_id ON users(auth0_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Workspace indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_is_public ON workspaces(is_public);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON workspaces(created_at);

-- Cards table with vector embeddings
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Content fields
    title VARCHAR(500) NOT NULL,
    content TEXT,
    card_type VARCHAR(50) DEFAULT 'note',
    
    -- Position and visual properties
    position_x NUMERIC(10,2) DEFAULT 0,
    position_y NUMERIC(10,2) DEFAULT 0,
    width NUMERIC(8,2) DEFAULT 300,
    height NUMERIC(8,2) DEFAULT 200,
    z_index INTEGER DEFAULT 0,
    
    -- Visual styling
    background_color VARCHAR(7) DEFAULT '#ffffff',
    text_color VARCHAR(7) DEFAULT '#000000',
    border_color VARCHAR(7) DEFAULT '#e1e5e9',
    font_size INTEGER DEFAULT 14,
    
    -- Metadata
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    
    -- Vector embedding fields
    embedding vector(1536), -- OpenAI text-embedding-ada-002 dimensions
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',
    content_hash VARCHAR(64), -- SHA-256 hash of content for change detection
    embedding_updated_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Version control
    version INTEGER DEFAULT 1
);

-- Card indexes
CREATE INDEX IF NOT EXISTS idx_cards_workspace_id ON cards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cards_owner_id ON cards(owner_id);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at);
CREATE INDEX IF NOT EXISTS idx_cards_updated_at ON cards(updated_at);
CREATE INDEX IF NOT EXISTS idx_cards_card_type ON cards(card_type);
CREATE INDEX IF NOT EXISTS idx_cards_tags ON cards USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_cards_content_hash ON cards(content_hash);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_cards_embedding ON cards USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_cards_content_search ON cards USING GIN(to_tsvector('english', title || ' ' || COALESCE(content, '')));

-- Trigram index for fuzzy search
CREATE INDEX IF NOT EXISTS idx_cards_title_trgm ON cards USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cards_content_trgm ON cards USING GIN(content gin_trgm_ops);

-- Card connections table for AI-detected relationships
CREATE TABLE IF NOT EXISTS card_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    
    -- Connection properties
    connection_type VARCHAR(50) DEFAULT 'ai_detected', -- 'ai_detected', 'manual', 'reference'
    confidence_score NUMERIC(3,2), -- 0.00 to 1.00 for AI confidence
    connection_reason TEXT, -- AI explanation of why cards are connected
    
    -- Bidirectional constraint
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(source_card_id, target_card_id)
);

-- Connection indexes
CREATE INDEX IF NOT EXISTS idx_connections_source_card ON card_connections(source_card_id);
CREATE INDEX IF NOT EXISTS idx_connections_target_card ON card_connections(target_card_id);
CREATE INDEX IF NOT EXISTS idx_connections_type ON card_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_connections_confidence ON card_connections(confidence_score);

-- Workspace members table
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
    permissions TEXT[] DEFAULT ARRAY['read'],
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP DEFAULT NOW(),
    joined_at TIMESTAMP,
    
    UNIQUE(workspace_id, user_id)
);

-- Workspace member indexes
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(role);

-- Activity log table for audit trail
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'card', 'workspace', 'user'
    entity_id UUID,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'share'
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Activity log indexes
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_workspace_id ON activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at);

-- Update triggers for timestamp maintenance
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();