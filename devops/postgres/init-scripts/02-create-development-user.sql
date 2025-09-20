-- Create development user with appropriate permissions
-- This script is only run during initial database setup

DO $$
BEGIN
    -- Create development user if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nexus_dev') THEN
        CREATE ROLE nexus_dev WITH LOGIN PASSWORD 'nexus_dev_2024';
        RAISE NOTICE 'Created development user: nexus_dev';
    ELSE
        RAISE NOTICE 'Development user nexus_dev already exists';
    END IF;
END
$$;

-- Grant necessary permissions to development user
GRANT CONNECT ON DATABASE nexus_db TO nexus_dev;
GRANT USAGE ON SCHEMA public TO nexus_dev;
GRANT CREATE ON SCHEMA public TO nexus_dev;

-- Grant permissions on all current and future tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nexus_dev;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nexus_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO nexus_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO nexus_dev;

-- Create a read-only user for analytics and reporting
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nexus_readonly') THEN
        CREATE ROLE nexus_readonly WITH LOGIN PASSWORD 'nexus_readonly_2024';
        RAISE NOTICE 'Created read-only user: nexus_readonly';
    ELSE
        RAISE NOTICE 'Read-only user nexus_readonly already exists';
    END IF;
END
$$;

-- Grant read-only permissions
GRANT CONNECT ON DATABASE nexus_db TO nexus_readonly;
GRANT USAGE ON SCHEMA public TO nexus_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nexus_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO nexus_readonly;

-- Database users configured for development environment