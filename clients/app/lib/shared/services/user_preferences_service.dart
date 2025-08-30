import 'dart:developer' as dev;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';

import '../database/database_constants.dart';
import '../models/user_preferences.dart';
import 'database_service.dart';

part 'user_preferences_service.g.dart';

@riverpod
UserPreferencesService userPreferencesService(Ref ref) {
  final databaseService = ref.watch(databaseServiceProvider);
  return UserPreferencesService(databaseService);
}

/// Service for managing user preferences and application settings
/// 
/// Provides persistent storage for user preferences with:
/// - Type-safe preference accessors
/// - Default value support
/// - Bulk operations for efficiency
/// - Change notifications
/// - Migration support for preference updates
class UserPreferencesService {
  final DatabaseService _databaseService;
  final Uuid _uuid = const Uuid();

  UserPreferencesService(this._databaseService);

  /// Get a user preference by key
  Future<UserPreference?> getPreference(String key, String userId) async {
    try {
      dev.log('Getting preference: $key for user $userId', name: 'UserPreferencesService');

      final results = await _databaseService.query(
        UserPreferencesTable.tableName,
        where: '${UserPreferencesTable.key} = ? AND ${UserPreferencesTable.userId} = ?',
        whereArgs: [key, userId],
        limit: 1,
      );

      if (results.isEmpty) {
        dev.log('Preference not found: $key', name: 'UserPreferencesService');
        return null;
      }

      final preference = UserPreference.fromDbMap(results.first);
      dev.log('Preference retrieved: $key', name: 'UserPreferencesService');
      return preference;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get preference $key: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Set a user preference
  Future<void> setPreference(String key, dynamic value, String userId) async {
    try {
      dev.log('Setting preference: $key for user $userId', name: 'UserPreferencesService');

      final existing = await getPreference(key, userId);
      
      if (existing != null) {
        // Update existing preference
        final updatedPreference = existing.updateValue(value);
        
        await _databaseService.update(
          UserPreferencesTable.tableName,
          updatedPreference.toDbMap(),
          where: '${UserPreferencesTable.key} = ? AND ${UserPreferencesTable.userId} = ?',
          whereArgs: [key, userId],
        );
      } else {
        // Create new preference
        final newPreference = UserPreference.create(
          id: _uuid.v4(),
          key: key,
          value: value,
          userId: userId,
        );
        
        await _databaseService.insert(
          UserPreferencesTable.tableName,
          newPreference.toDbMap(),
        );
      }

      dev.log('Preference set: $key', name: 'UserPreferencesService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to set preference $key: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Remove a user preference
  Future<bool> removePreference(String key, String userId) async {
    try {
      dev.log('Removing preference: $key for user $userId', name: 'UserPreferencesService');

      final rowsAffected = await _databaseService.delete(
        UserPreferencesTable.tableName,
        where: '${UserPreferencesTable.key} = ? AND ${UserPreferencesTable.userId} = ?',
        whereArgs: [key, userId],
      );

      final success = rowsAffected > 0;
      
      if (success) {
        dev.log('Preference removed: $key', name: 'UserPreferencesService');
      } else {
        dev.log('Preference not found for removal: $key', name: 'UserPreferencesService');
      }

      return success;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to remove preference $key: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get all preferences for a user
  Future<UserPreferences> getAllPreferences(String userId) async {
    try {
      dev.log('Getting all preferences for user $userId', name: 'UserPreferencesService');

      final results = await _databaseService.query(
        UserPreferencesTable.tableName,
        where: '${UserPreferencesTable.userId} = ?',
        whereArgs: [userId],
        orderBy: '${UserPreferencesTable.key} ASC',
      );

      final preferencesMap = <String, UserPreference>{};
      for (final row in results) {
        final preference = UserPreference.fromDbMap(row);
        preferencesMap[preference.key] = preference;
      }

      final userPreferences = UserPreferences(preferences: preferencesMap);
      
      dev.log('Retrieved ${preferencesMap.length} preferences', name: 'UserPreferencesService');
      return userPreferences;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get all preferences for user $userId: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Set multiple preferences in a transaction
  Future<void> setMultiplePreferences(
    Map<String, dynamic> preferences,
    String userId,
  ) async {
    try {
      dev.log(
        'Setting ${preferences.length} preferences for user $userId',
        name: 'UserPreferencesService',
      );

      await _databaseService.transaction((txn) async {
        for (final entry in preferences.entries) {
          final key = entry.key;
          final value = entry.value;

          // Check if preference exists
          final existingResults = await txn.query(
            UserPreferencesTable.tableName,
            where: '${UserPreferencesTable.key} = ? AND ${UserPreferencesTable.userId} = ?',
            whereArgs: [key, userId],
            limit: 1,
          );

          if (existingResults.isNotEmpty) {
            // Update existing
            final existing = UserPreference.fromDbMap(existingResults.first);
            final updated = existing.updateValue(value);
            
            await txn.update(
              UserPreferencesTable.tableName,
              updated.toDbMap(),
              where: '${UserPreferencesTable.key} = ? AND ${UserPreferencesTable.userId} = ?',
              whereArgs: [key, userId],
            );
          } else {
            // Create new
            final newPreference = UserPreference.create(
              id: _uuid.v4(),
              key: key,
              value: value,
              userId: userId,
            );
            
            await txn.insert(
              UserPreferencesTable.tableName,
              newPreference.toDbMap(),
            );
          }
        }
      });

      dev.log('Multiple preferences set successfully', name: 'UserPreferencesService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to set multiple preferences: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get a string preference with default value
  Future<String> getString(
    String key,
    String userId, {
    String? defaultValue,
  }) async {
    final preference = await getPreference(key, userId);
    if (preference?.type == PreferenceType.string) {
      return preference!.value as String;
    }
    
    // Return default from DefaultPreferences or provided default
    return defaultValue ?? 
           (DefaultPreferences.defaults[key] as String?) ?? 
           '';
  }

  /// Set a string preference
  Future<void> setString(String key, String value, String userId) async {
    await setPreference(key, value, userId);
  }

  /// Get a boolean preference with default value
  Future<bool> getBool(
    String key,
    String userId, {
    bool? defaultValue,
  }) async {
    final preference = await getPreference(key, userId);
    if (preference?.type == PreferenceType.boolean) {
      return preference!.value as bool;
    }
    
    // Return default from DefaultPreferences or provided default
    return defaultValue ?? 
           (DefaultPreferences.defaults[key] as bool?) ?? 
           false;
  }

  /// Set a boolean preference
  Future<void> setBool(String key, bool value, String userId) async {
    await setPreference(key, value, userId);
  }

  /// Get a number preference with default value
  Future<num> getNumber(
    String key,
    String userId, {
    num? defaultValue,
  }) async {
    final preference = await getPreference(key, userId);
    if (preference?.type == PreferenceType.number) {
      return preference!.value as num;
    }
    
    // Return default from DefaultPreferences or provided default
    return defaultValue ?? 
           (DefaultPreferences.defaults[key] as num?) ?? 
           0;
  }

  /// Set a number preference
  Future<void> setNumber(String key, num value, String userId) async {
    await setPreference(key, value, userId);
  }

  /// Get an object preference with default value
  Future<Map<String, dynamic>> getObject(
    String key,
    String userId, {
    Map<String, dynamic>? defaultValue,
  }) async {
    final preference = await getPreference(key, userId);
    if (preference?.type == PreferenceType.object) {
      return preference!.value as Map<String, dynamic>;
    }
    
    // Return default from DefaultPreferences or provided default
    return defaultValue ?? 
           (DefaultPreferences.defaults[key] as Map<String, dynamic>?) ?? 
           <String, dynamic>{};
  }

  /// Set an object preference
  Future<void> setObject(String key, Map<String, dynamic> value, String userId) async {
    await setPreference(key, value, userId);
  }

  /// Get an array preference with default value
  Future<List<dynamic>> getArray(
    String key,
    String userId, {
    List<dynamic>? defaultValue,
  }) async {
    final preference = await getPreference(key, userId);
    if (preference?.type == PreferenceType.array) {
      return preference!.value as List<dynamic>;
    }
    
    // Return default from DefaultPreferences or provided default
    return defaultValue ?? 
           (DefaultPreferences.defaults[key] as List<dynamic>?) ?? 
           <dynamic>[];
  }

  /// Set an array preference
  Future<void> setArray(String key, List<dynamic> value, String userId) async {
    await setPreference(key, value, userId);
  }

  /// Reset all preferences to defaults for a user
  Future<void> resetToDefaults(String userId) async {
    try {
      dev.log('Resetting preferences to defaults for user $userId', 
              name: 'UserPreferencesService');

      await _databaseService.transaction((txn) async {
        // Clear existing preferences
        await txn.delete(
          UserPreferencesTable.tableName,
          where: '${UserPreferencesTable.userId} = ?',
          whereArgs: [userId],
        );

        // Insert default preferences
        for (final entry in DefaultPreferences.defaults.entries) {
          final preference = UserPreference.create(
            id: _uuid.v4(),
            key: entry.key,
            value: entry.value,
            userId: userId,
          );
          
          await txn.insert(
            UserPreferencesTable.tableName,
            preference.toDbMap(),
          );
        }
      });

      dev.log('Preferences reset to defaults', name: 'UserPreferencesService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to reset preferences to defaults: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Initialize default preferences for a new user
  Future<void> initializeDefaults(String userId) async {
    try {
      dev.log('Initializing default preferences for user $userId', 
              name: 'UserPreferencesService');

      // Check if user already has preferences
      final existingCount = await _getPreferenceCount(userId);
      if (existingCount > 0) {
        dev.log('User already has preferences, skipping initialization', 
                name: 'UserPreferencesService');
        return;
      }

      await _databaseService.transaction((txn) async {
        // Insert default preferences
        for (final entry in DefaultPreferences.defaults.entries) {
          final preference = UserPreference.create(
            id: _uuid.v4(),
            key: entry.key,
            value: entry.value,
            userId: userId,
          );
          
          await txn.insert(
            UserPreferencesTable.tableName,
            preference.toDbMap(),
          );
        }
      });

      dev.log('Default preferences initialized', name: 'UserPreferencesService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to initialize default preferences: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Export user preferences as JSON
  Future<Map<String, dynamic>> exportPreferences(String userId) async {
    try {
      dev.log('Exporting preferences for user $userId', name: 'UserPreferencesService');

      final userPreferences = await getAllPreferences(userId);
      final exportData = <String, dynamic>{
        'userId': userId,
        'exportedAt': DateTime.now().toIso8601String(),
        'preferences': <String, dynamic>{},
      };

      for (final entry in userPreferences.preferences.entries) {
        exportData['preferences'][entry.key] = entry.value.value;
      }

      dev.log('Preferences exported: ${exportData['preferences'].length} items', 
              name: 'UserPreferencesService');
      return exportData;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to export preferences: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Import user preferences from JSON
  Future<void> importPreferences(String userId, Map<String, dynamic> data) async {
    try {
      dev.log('Importing preferences for user $userId', name: 'UserPreferencesService');

      final preferences = data['preferences'] as Map<String, dynamic>?;
      if (preferences == null || preferences.isEmpty) {
        dev.log('No preferences to import', name: 'UserPreferencesService');
        return;
      }

      await setMultiplePreferences(preferences, userId);

      dev.log('Preferences imported: ${preferences.length} items', 
              name: 'UserPreferencesService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to import preferences: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Clear all preferences for a user
  Future<int> clearUserPreferences(String userId) async {
    try {
      dev.log('Clearing all preferences for user $userId', name: 'UserPreferencesService');

      final deletedCount = await _databaseService.delete(
        UserPreferencesTable.tableName,
        where: '${UserPreferencesTable.userId} = ?',
        whereArgs: [userId],
      );

      dev.log('Cleared $deletedCount preferences', name: 'UserPreferencesService');
      return deletedCount;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to clear user preferences: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get preference count for a user
  Future<int> _getPreferenceCount(String userId) async {
    final result = await _databaseService.rawQuery(
      'SELECT COUNT(*) as count FROM ${UserPreferencesTable.tableName} WHERE ${UserPreferencesTable.userId} = ?',
      [userId],
    );
    return result.first['count'] as int;
  }

  /// Get preferences statistics
  Future<PreferencesStats> getStats({String? userId}) async {
    try {
      dev.log('Getting preferences statistics', name: 'UserPreferencesService');

      String? whereClause;
      List<dynamic>? whereArgs;

      if (userId != null) {
        whereClause = '${UserPreferencesTable.userId} = ?';
        whereArgs = [userId];
      }

      // Get total count
      final totalResult = await _databaseService.rawQuery(
        'SELECT COUNT(*) as count FROM ${UserPreferencesTable.tableName}'
        '${whereClause != null ? ' WHERE $whereClause' : ''}',
        whereArgs,
      );
      final totalCount = totalResult.first['count'] as int;

      // Get counts by type
      final typeResults = await _databaseService.rawQuery(
        'SELECT ${UserPreferencesTable.type}, COUNT(*) as count FROM ${UserPreferencesTable.tableName}'
        '${whereClause != null ? ' WHERE $whereClause' : ''} '
        'GROUP BY ${UserPreferencesTable.type}',
        whereArgs,
      );
      
      final typeCounts = <PreferenceType, int>{};
      for (final row in typeResults) {
        final type = PreferenceType.fromString(row['type'] as String);
        typeCounts[type] = row['count'] as int;
      }

      // Get user count (if not filtered by user)
      int? userCount;
      if (userId == null) {
        final userResult = await _databaseService.rawQuery(
          'SELECT COUNT(DISTINCT ${UserPreferencesTable.userId}) as count FROM ${UserPreferencesTable.tableName}',
        );
        userCount = userResult.first['count'] as int;
      }

      final stats = PreferencesStats(
        totalPreferences: totalCount,
        typeDistribution: typeCounts,
        userCount: userCount,
        userId: userId,
      );

      dev.log('Preferences stats: $stats', name: 'UserPreferencesService');
      return stats;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get preferences stats: $error',
        name: 'UserPreferencesService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }
}

/// Preferences service statistics
class PreferencesStats {
  final int totalPreferences;
  final Map<PreferenceType, int> typeDistribution;
  final int? userCount;
  final String? userId;

  const PreferencesStats({
    required this.totalPreferences,
    required this.typeDistribution,
    this.userCount,
    this.userId,
  });

  @override
  String toString() {
    return 'PreferencesStats('
        'total: $totalPreferences, '
        'types: ${typeDistribution.length}, '
        '${userCount != null ? 'users: $userCount, ' : ''}'
        '${userId != null ? 'userId: $userId' : ''}'
        ')';
  }
}