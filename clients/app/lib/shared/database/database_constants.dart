/// Database constants for Project Nexus local storage
/// 
/// This file defines all database-related constants including:
/// - Database and table names
/// - Column definitions
/// - Schema versions
/// - Storage limits and constraints

class DatabaseConstants {
  // Database configuration
  static const String databaseName = 'nexus_local.db';
  static const int databaseVersion = 1;
  
  // Storage limits
  static const int maxCacheSize = 100 * 1024 * 1024; // 100MB
  static const int maxCardContentLength = 100000; // 100KB per card
  static const int maxTagsPerCard = 20;
  static const int maxTagLength = 50;
  static const int maxTitleLength = 200;
  static const int maxMetadataSize = 10000; // 10KB
  
  // Auto-save configuration
  static const int autoSaveDebounceMs = 5000; // 5 seconds
  static const int maxAutoSaveRetries = 3;
  static const int autoSaveRetryDelayMs = 1000;
  
  // Sync configuration
  static const int maxSyncQueueSize = 1000;
  static const int syncBatchSize = 50;
  static const int syncRetryDelayMs = 5000;
}

/// Table and column definitions for Cards
class CardTable {
  static const String tableName = 'cards';
  
  // Primary key and identifiers
  static const String id = 'id';
  static const String workspaceId = 'workspace_id';
  static const String canvasId = 'canvas_id';
  
  // Card content
  static const String type = 'type';
  static const String title = 'title';
  static const String content = 'content';
  static const String tags = 'tags'; // JSON array
  
  // Position and dimensions
  static const String positionX = 'position_x';
  static const String positionY = 'position_y';
  static const String positionZ = 'position_z';
  static const String width = 'width';
  static const String height = 'height';
  static const String rotation = 'rotation';
  
  // Metadata and style
  static const String metadata = 'metadata'; // JSON object
  static const String style = 'style'; // JSON object
  static const String animation = 'animation'; // JSON object
  
  // Status and priority
  static const String status = 'status';
  static const String priority = 'priority';
  
  // Versioning and tracking
  static const String version = 'version';
  static const String createdAt = 'created_at';
  static const String updatedAt = 'updated_at';
  static const String createdBy = 'created_by';
  static const String lastModifiedBy = 'last_modified_by';
  static const String lastSavedAt = 'last_saved_at';
  static const String isDirty = 'is_dirty';
  
  // Canvas state
  static const String isLocked = 'is_locked';
  static const String isHidden = 'is_hidden';
  static const String isMinimized = 'is_minimized';
  static const String isSelected = 'is_selected';
  
  // AI and analysis
  static const String embeddings = 'embeddings'; // JSON array
  static const String analysisResults = 'analysis_results'; // JSON object
  static const String contentHash = 'content_hash';
  
  // Encryption
  static const String isEncrypted = 'is_encrypted';
}

/// Table and column definitions for Sync Queue
class SyncQueueTable {
  static const String tableName = 'sync_queue';
  
  static const String id = 'id';
  static const String operation = 'operation'; // CREATE, UPDATE, DELETE
  static const String entityType = 'entity_type'; // CARD, WORKSPACE, etc.
  static const String entityId = 'entity_id';
  static const String data = 'data'; // JSON payload
  static const String createdAt = 'created_at';
  static const String attempts = 'attempts';
  static const String lastAttempt = 'last_attempt';
  static const String status = 'status'; // PENDING, IN_PROGRESS, COMPLETED, FAILED
  static const String errorMessage = 'error_message';
  static const String priority = 'priority';
  static const String userId = 'user_id';
}

/// Table and column definitions for User Preferences
class UserPreferencesTable {
  static const String tableName = 'user_preferences';
  
  static const String id = 'id';
  static const String key = 'key';
  static const String value = 'value'; // JSON value
  static const String type = 'type'; // STRING, NUMBER, BOOLEAN, OBJECT, ARRAY
  static const String userId = 'user_id';
  static const String createdAt = 'created_at';
  static const String updatedAt = 'updated_at';
}

/// Table and column definitions for Cache Management
class CacheTable {
  static const String tableName = 'cache';
  
  static const String key = 'key';
  static const String data = 'data'; // JSON or binary data
  static const String size = 'size'; // Size in bytes
  static const String createdAt = 'created_at';
  static const String lastAccessed = 'last_accessed';
  static const String expiresAt = 'expires_at';
  static const String type = 'type'; // API_RESPONSE, IMAGE, FILE, etc.
  static const String metadata = 'metadata'; // JSON metadata
}

/// Table and column definitions for Auto-save tracking
class AutoSaveTable {
  static const String tableName = 'auto_save_queue';
  
  static const String id = 'id';
  static const String cardId = 'card_id';
  static const String changes = 'changes'; // JSON diff
  static const String createdAt = 'created_at';
  static const String attempts = 'attempts';
  static const String lastAttempt = 'last_attempt';
  static const String status = 'status'; // PENDING, PROCESSING, COMPLETED, FAILED
  static const String userId = 'user_id';
}

/// SQL DDL statements for table creation
class DatabaseSchema {
  // Cards table creation
  static const String createCardsTable = '''
    CREATE TABLE IF NOT EXISTS ${CardTable.tableName} (
      ${CardTable.id} TEXT PRIMARY KEY,
      ${CardTable.workspaceId} TEXT NOT NULL,
      ${CardTable.canvasId} TEXT,
      ${CardTable.type} TEXT NOT NULL,
      ${CardTable.title} TEXT,
      ${CardTable.content} TEXT NOT NULL,
      ${CardTable.tags} TEXT, -- JSON array
      ${CardTable.positionX} REAL NOT NULL,
      ${CardTable.positionY} REAL NOT NULL,
      ${CardTable.positionZ} REAL NOT NULL,
      ${CardTable.width} REAL NOT NULL,
      ${CardTable.height} REAL NOT NULL,
      ${CardTable.rotation} REAL DEFAULT 0,
      ${CardTable.metadata} TEXT, -- JSON object
      ${CardTable.style} TEXT, -- JSON object
      ${CardTable.animation} TEXT, -- JSON object
      ${CardTable.status} TEXT NOT NULL,
      ${CardTable.priority} TEXT NOT NULL,
      ${CardTable.version} INTEGER NOT NULL DEFAULT 1,
      ${CardTable.createdAt} INTEGER NOT NULL,
      ${CardTable.updatedAt} INTEGER NOT NULL,
      ${CardTable.createdBy} TEXT NOT NULL,
      ${CardTable.lastModifiedBy} TEXT NOT NULL,
      ${CardTable.lastSavedAt} INTEGER,
      ${CardTable.isDirty} INTEGER DEFAULT 0,
      ${CardTable.isLocked} INTEGER DEFAULT 0,
      ${CardTable.isHidden} INTEGER DEFAULT 0,
      ${CardTable.isMinimized} INTEGER DEFAULT 0,
      ${CardTable.isSelected} INTEGER DEFAULT 0,
      ${CardTable.embeddings} TEXT, -- JSON array
      ${CardTable.analysisResults} TEXT, -- JSON object
      ${CardTable.contentHash} TEXT,
      ${CardTable.isEncrypted} INTEGER DEFAULT 0,
      CHECK (${CardTable.type} IN ('text', 'image', 'link', 'code', 'file', 'drawing')),
      CHECK (${CardTable.status} IN ('draft', 'active', 'archived', 'deleted')),
      CHECK (${CardTable.priority} IN ('low', 'normal', 'high', 'urgent')),
      CHECK (${CardTable.version} >= 1),
      CHECK (${CardTable.width} > 0 AND ${CardTable.height} > 0),
      CHECK (${CardTable.isEncrypted} IN (0, 1))
    )
  ''';

  // Sync queue table creation  
  static const String createSyncQueueTable = '''
    CREATE TABLE IF NOT EXISTS ${SyncQueueTable.tableName} (
      ${SyncQueueTable.id} TEXT PRIMARY KEY,
      ${SyncQueueTable.operation} TEXT NOT NULL,
      ${SyncQueueTable.entityType} TEXT NOT NULL,
      ${SyncQueueTable.entityId} TEXT NOT NULL,
      ${SyncQueueTable.data} TEXT NOT NULL, -- JSON payload
      ${SyncQueueTable.createdAt} INTEGER NOT NULL,
      ${SyncQueueTable.attempts} INTEGER DEFAULT 0,
      ${SyncQueueTable.lastAttempt} INTEGER,
      ${SyncQueueTable.status} TEXT DEFAULT 'PENDING',
      ${SyncQueueTable.errorMessage} TEXT,
      ${SyncQueueTable.priority} INTEGER DEFAULT 0,
      ${SyncQueueTable.userId} TEXT NOT NULL,
      CHECK (${SyncQueueTable.entityType} IN ('CARD', 'WORKSPACE', 'CANVAS')),
      CHECK (${SyncQueueTable.operation} IN ('CREATE', 'UPDATE', 'DELETE')),
      CHECK (${SyncQueueTable.status} IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'))
    )
  ''';

  // User preferences table creation
  static const String createUserPreferencesTable = '''
    CREATE TABLE IF NOT EXISTS ${UserPreferencesTable.tableName} (
      ${UserPreferencesTable.id} TEXT PRIMARY KEY,
      ${UserPreferencesTable.key} TEXT NOT NULL,
      ${UserPreferencesTable.value} TEXT, -- JSON value
      ${UserPreferencesTable.type} TEXT NOT NULL,
      ${UserPreferencesTable.userId} TEXT NOT NULL,
      ${UserPreferencesTable.createdAt} INTEGER NOT NULL,
      ${UserPreferencesTable.updatedAt} INTEGER NOT NULL,
      UNIQUE(${UserPreferencesTable.key}, ${UserPreferencesTable.userId})
    )
  ''';

  // Cache table creation
  static const String createCacheTable = '''
    CREATE TABLE IF NOT EXISTS ${CacheTable.tableName} (
      ${CacheTable.key} TEXT PRIMARY KEY,
      ${CacheTable.data} TEXT, -- JSON or binary data
      ${CacheTable.size} INTEGER NOT NULL,
      ${CacheTable.createdAt} INTEGER NOT NULL,
      ${CacheTable.lastAccessed} INTEGER NOT NULL,
      ${CacheTable.expiresAt} INTEGER,
      ${CacheTable.type} TEXT NOT NULL,
      ${CacheTable.metadata} TEXT -- JSON metadata
    )
  ''';

  // Auto-save queue table creation
  static const String createAutoSaveTable = '''
    CREATE TABLE IF NOT EXISTS ${AutoSaveTable.tableName} (
      ${AutoSaveTable.id} TEXT PRIMARY KEY,
      ${AutoSaveTable.cardId} TEXT NOT NULL,
      ${AutoSaveTable.changes} TEXT NOT NULL, -- JSON diff
      ${AutoSaveTable.createdAt} INTEGER NOT NULL,
      ${AutoSaveTable.attempts} INTEGER DEFAULT 0,
      ${AutoSaveTable.lastAttempt} INTEGER,
      ${AutoSaveTable.status} TEXT DEFAULT 'PENDING',
      ${AutoSaveTable.userId} TEXT NOT NULL,
      FOREIGN KEY (${AutoSaveTable.cardId}) REFERENCES ${CardTable.tableName}(${CardTable.id}) ON DELETE CASCADE
    )
  ''';

  // Indexes for performance optimization
  static const List<String> indexes = [
    'CREATE INDEX IF NOT EXISTS idx_cards_workspace ON ${CardTable.tableName}(${CardTable.workspaceId})',
    'CREATE INDEX IF NOT EXISTS idx_cards_canvas ON ${CardTable.tableName}(${CardTable.canvasId})',
    'CREATE INDEX IF NOT EXISTS idx_cards_type ON ${CardTable.tableName}(${CardTable.type})',
    'CREATE INDEX IF NOT EXISTS idx_cards_status ON ${CardTable.tableName}(${CardTable.status})',
    'CREATE INDEX IF NOT EXISTS idx_cards_updated ON ${CardTable.tableName}(${CardTable.updatedAt})',
    'CREATE INDEX IF NOT EXISTS idx_cards_dirty ON ${CardTable.tableName}(${CardTable.isDirty})',
    'CREATE INDEX IF NOT EXISTS idx_sync_status ON ${SyncQueueTable.tableName}(${SyncQueueTable.status})',
    'CREATE INDEX IF NOT EXISTS idx_sync_priority ON ${SyncQueueTable.tableName}(${SyncQueueTable.priority}, ${SyncQueueTable.createdAt})',
    'CREATE INDEX IF NOT EXISTS idx_sync_entity ON ${SyncQueueTable.tableName}(${SyncQueueTable.entityType}, ${SyncQueueTable.entityId})',
    'CREATE INDEX IF NOT EXISTS idx_prefs_user ON ${UserPreferencesTable.tableName}(${UserPreferencesTable.userId})',
    'CREATE INDEX IF NOT EXISTS idx_cache_type ON ${CacheTable.tableName}(${CacheTable.type})',
    'CREATE INDEX IF NOT EXISTS idx_cache_expires ON ${CacheTable.tableName}(${CacheTable.expiresAt})',
    'CREATE INDEX IF NOT EXISTS idx_autosave_card ON ${AutoSaveTable.tableName}(${AutoSaveTable.cardId})',
    'CREATE INDEX IF NOT EXISTS idx_autosave_status ON ${AutoSaveTable.tableName}(${AutoSaveTable.status})',
  ];

  // All table creation statements
  static const List<String> createTables = [
    createCardsTable,
    createSyncQueueTable,
    createUserPreferencesTable,
    createCacheTable,
    createAutoSaveTable,
  ];
}

/// Enum values mapping for database storage
class DatabaseEnums {
  // Card types
  static const Map<String, String> cardTypes = {
    'TEXT': 'text',
    'IMAGE': 'image',
    'LINK': 'link',
    'CODE': 'code',
    'FILE': 'file',
    'DRAWING': 'drawing',
  };

  // Card statuses
  static const Map<String, String> cardStatuses = {
    'DRAFT': 'draft',
    'ACTIVE': 'active',
    'ARCHIVED': 'archived',
    'DELETED': 'deleted',
  };

  // Card priorities
  static const Map<String, String> cardPriorities = {
    'LOW': 'low',
    'NORMAL': 'normal',
    'HIGH': 'high',
    'URGENT': 'urgent',
  };

  // Sync operations
  static const Map<String, String> syncOperations = {
    'CREATE': 'CREATE',
    'UPDATE': 'UPDATE',
    'DELETE': 'DELETE',
  };

  // Sync statuses
  static const Map<String, String> syncStatuses = {
    'PENDING': 'PENDING',
    'IN_PROGRESS': 'IN_PROGRESS',
    'COMPLETED': 'COMPLETED',
    'FAILED': 'FAILED',
  };

  // Entity types for sync
  static const Map<String, String> entityTypes = {
    'CARD': 'CARD',
    'WORKSPACE': 'WORKSPACE',
    'CANVAS': 'CANVAS',
  };
}