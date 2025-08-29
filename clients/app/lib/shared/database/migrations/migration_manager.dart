import 'dart:developer' as dev;

import 'package:sqflite/sqflite.dart';

import 'migration_v1.dart';

/// Manages database migrations for Project Nexus
/// 
/// This class handles the progressive migration of the database schema
/// as new versions are released. Each migration is responsible for 
/// transforming the database from one version to the next.
class MigrationManager {
  /// Available migration implementations
  static final Map<int, Migration> _migrations = {
    1: MigrationV1(),
    // Future migrations will be added here
    // 2: MigrationV2(),
    // 3: MigrationV3(),
  };

  /// Migrate database from old version to new version
  Future<void> migrate(Database db, int oldVersion, int newVersion) async {
    dev.log(
      'Starting migration from version $oldVersion to $newVersion',
      name: 'MigrationManager',
    );

    if (oldVersion == newVersion) {
      dev.log('No migration needed', name: 'MigrationManager');
      return;
    }

    if (oldVersion > newVersion) {
      throw UnsupportedError(
        'Downgrade from version $oldVersion to $newVersion is not supported',
      );
    }

    // Apply migrations sequentially
    for (int version = oldVersion + 1; version <= newVersion; version++) {
      final migration = _migrations[version];
      if (migration == null) {
        throw StateError('No migration found for version $version');
      }

      dev.log('Applying migration to version $version', name: 'MigrationManager');
      
      try {
        await migration.migrate(db);
        dev.log('Migration to version $version completed', name: 'MigrationManager');
      } catch (error, stackTrace) {
        dev.log(
          'Migration to version $version failed: $error',
          name: 'MigrationManager',
          error: error,
          stackTrace: stackTrace,
        );
        rethrow;
      }
    }

    dev.log(
      'All migrations completed successfully',
      name: 'MigrationManager',
    );
  }

  /// Check if migration is available for a specific version
  static bool hasMigration(int version) {
    return _migrations.containsKey(version);
  }

  /// Get all available migration versions
  static List<int> get availableVersions {
    return _migrations.keys.toList()..sort();
  }

  /// Get migration for a specific version
  static Migration? getMigration(int version) {
    return _migrations[version];
  }
}

/// Abstract base class for database migrations
abstract class Migration {
  /// The target version this migration upgrades to
  int get version;

  /// Description of what this migration does
  String get description;

  /// Apply the migration to the database
  Future<void> migrate(Database db);

  /// Validate that the migration was applied correctly
  Future<bool> validate(Database db) async {
    // Default implementation - subclasses can override for specific validation
    return true;
  }

  @override
  String toString() => 'Migration v$version: $description';
}

/// Migration exception for handling migration-specific errors
class MigrationException implements Exception {
  final String message;
  final int version;
  final Object? cause;

  const MigrationException(this.message, this.version, [this.cause]);

  @override
  String toString() {
    return 'MigrationException (v$version): $message${cause != null ? ' - Caused by: $cause' : ''}';
  }
}