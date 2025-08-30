import 'dart:developer' as dev;

import 'package:sqflite/sqflite.dart';

import '../database_constants.dart';
import 'migration_manager.dart';

/// Migration to version 1 - Initial database schema
/// 
/// This migration creates the initial database schema including:
/// - Cards table for storing card data
/// - Sync queue table for offline operations
/// - User preferences table for app settings
/// - Cache table for temporary data
/// - Auto-save queue table for auto-save operations
/// - All necessary indexes for performance
class MigrationV1 extends Migration {
  @override
  int get version => 1;

  @override
  String get description => 'Create initial database schema';

  @override
  Future<void> migrate(Database db) async {
    dev.log('Creating initial database schema (v1)', name: 'MigrationV1');

    try {
      await db.transaction((txn) async {
        // Create all tables
        for (final createStatement in DatabaseSchema.createTables) {
          dev.log('Executing: ${createStatement.substring(0, 50)}...', name: 'MigrationV1');
          await txn.execute(createStatement);
        }
        
        // Create indexes
        for (final indexStatement in DatabaseSchema.indexes) {
          dev.log('Creating index: ${indexStatement.substring(0, 50)}...', name: 'MigrationV1');
          await txn.execute(indexStatement);
        }
      });

      dev.log('Initial database schema created successfully', name: 'MigrationV1');
    } catch (error) {
      throw MigrationException(
        'Failed to create initial database schema',
        version,
        error,
      );
    }
  }

  @override
  Future<bool> validate(Database db) async {
    try {
      dev.log('Validating initial database schema', name: 'MigrationV1');

      // Check that all required tables exist
      final expectedTables = [
        CardTable.tableName,
        SyncQueueTable.tableName,
        UserPreferencesTable.tableName,
        CacheTable.tableName,
        AutoSaveTable.tableName,
      ];

      for (final tableName in expectedTables) {
        final result = await db.rawQuery(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          [tableName],
        );
        
        if (result.isEmpty) {
          dev.log('Missing table: $tableName', name: 'MigrationV1');
          return false;
        }
      }

      // Check that key indexes exist
      final expectedIndexes = [
        'idx_cards_workspace',
        'idx_cards_canvas',
        'idx_cards_type',
        'idx_cards_status',
        'idx_cards_updated',
        'idx_cards_dirty',
        'idx_sync_status',
        'idx_sync_priority',
      ];

      for (final indexName in expectedIndexes) {
        final result = await db.rawQuery(
          "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
          [indexName],
        );
        
        if (result.isEmpty) {
          dev.log('Missing index: $indexName', name: 'MigrationV1');
          return false;
        }
      }

      // Verify table schemas by attempting to insert/query basic data
      await _validateTableSchemas(db);

      dev.log('Database schema validation passed', name: 'MigrationV1');
      return true;
    } catch (error, stackTrace) {
      dev.log(
        'Database schema validation failed: $error',
        name: 'MigrationV1',
        error: error,
        stackTrace: stackTrace,
      );
      return false;
    }
  }

  /// Validate table schemas by checking key columns exist
  Future<void> _validateTableSchemas(Database db) async {
    // Validate Cards table schema
    await db.rawQuery('SELECT ${CardTable.id}, ${CardTable.workspaceId}, ${CardTable.type}, ${CardTable.content} FROM ${CardTable.tableName} LIMIT 0');
    
    // Validate Sync Queue table schema
    await db.rawQuery('SELECT ${SyncQueueTable.id}, ${SyncQueueTable.operation}, ${SyncQueueTable.entityType} FROM ${SyncQueueTable.tableName} LIMIT 0');
    
    // Validate User Preferences table schema
    await db.rawQuery('SELECT ${UserPreferencesTable.id}, ${UserPreferencesTable.key}, ${UserPreferencesTable.value} FROM ${UserPreferencesTable.tableName} LIMIT 0');
    
    // Validate Cache table schema
    await db.rawQuery('SELECT ${CacheTable.key}, ${CacheTable.data}, ${CacheTable.size} FROM ${CacheTable.tableName} LIMIT 0');
    
    // Validate Auto Save table schema
    await db.rawQuery('SELECT ${AutoSaveTable.id}, ${AutoSaveTable.cardId}, ${AutoSaveTable.changes} FROM ${AutoSaveTable.tableName} LIMIT 0');
  }
}