import 'dart:convert';
import 'dart:developer' as dev;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../database/database_constants.dart';
import 'database_service.dart';

part 'cache_manager_service.g.dart';

@riverpod
CacheManagerService cacheManagerService(Ref ref) {
  final databaseService = ref.watch(databaseServiceProvider);
  return CacheManagerService(databaseService);
}

/// Service for managing application cache with size limits and expiration
/// 
/// Provides efficient caching mechanism for:
/// - API responses and data
/// - Image and file caching
/// - Temporary data storage
/// - Automatic size management
/// - TTL-based expiration
/// - LRU eviction policy
class CacheManagerService {
  final DatabaseService _databaseService;

  CacheManagerService(this._databaseService);

  /// Store data in cache with optional expiration
  Future<void> put(
    String key,
    dynamic data, {
    String type = 'DATA',
    Duration? ttl,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      dev.log('Caching data for key: $key', name: 'CacheManagerService');

      final jsonData = jsonEncode(data);
      final size = jsonData.length;
      final now = DateTime.now();
      final expiresAt = ttl != null ? now.add(ttl) : null;

      // Check if we need to make space
      await _ensureSpace(size);

      // Remove existing entry if present
      await _databaseService.delete(
        CacheTable.tableName,
        where: '${CacheTable.key} = ?',
        whereArgs: [key],
      );

      // Insert new cache entry
      await _databaseService.insert(
        CacheTable.tableName,
        {
          CacheTable.key: key,
          CacheTable.data: jsonData,
          CacheTable.size: size,
          CacheTable.createdAt: now.millisecondsSinceEpoch,
          CacheTable.lastAccessed: now.millisecondsSinceEpoch,
          CacheTable.expiresAt: expiresAt?.millisecondsSinceEpoch,
          CacheTable.type: type,
          CacheTable.metadata: metadata != null ? jsonEncode(metadata) : null,
        },
      );

      dev.log('Data cached successfully: $key (${_formatBytes(size)})', 
              name: 'CacheManagerService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to cache data for key $key: $error',
        name: 'CacheManagerService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get data from cache
  Future<T?> get<T>(String key, {bool updateAccessTime = true}) async {
    try {
      dev.log('Retrieving cached data for key: $key', name: 'CacheManagerService');

      final results = await _databaseService.query(
        CacheTable.tableName,
        where: '${CacheTable.key} = ?',
        whereArgs: [key],
        limit: 1,
      );

      if (results.isEmpty) {
        dev.log('Cache miss: $key', name: 'CacheManagerService');
        return null;
      }

      final row = results.first;
      
      // Check if expired
      final expiresAt = row[CacheTable.expiresAt] as int?;
      if (expiresAt != null && DateTime.now().millisecondsSinceEpoch > expiresAt) {
        dev.log('Cache expired: $key', name: 'CacheManagerService');
        await remove(key);
        return null;
      }

      // Update last accessed time
      if (updateAccessTime) {
        await _databaseService.update(
          CacheTable.tableName,
          {CacheTable.lastAccessed: DateTime.now().millisecondsSinceEpoch},
          where: '${CacheTable.key} = ?',
          whereArgs: [key],
        );
      }

      final jsonData = row[CacheTable.data] as String;
      final data = jsonDecode(jsonData);
      
      dev.log('Cache hit: $key', name: 'CacheManagerService');
      return data as T;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get cached data for key $key: $error',
        name: 'CacheManagerService',
        error: error,
        stackTrace: stackTrace,
      );
      return null; // Return null on error rather than throwing
    }
  }

  /// Check if key exists in cache and is not expired
  Future<bool> containsKey(String key) async {
    try {
      final results = await _databaseService.query(
        CacheTable.tableName,
        columns: [CacheTable.key, CacheTable.expiresAt],
        where: '${CacheTable.key} = ?',
        whereArgs: [key],
        limit: 1,
      );

      if (results.isEmpty) {
        return false;
      }

      // Check if expired
      final expiresAt = results.first[CacheTable.expiresAt] as int?;
      if (expiresAt != null && DateTime.now().millisecondsSinceEpoch > expiresAt) {
        await remove(key); // Clean up expired entry
        return false;
      }

      return true;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to check cache key $key: $error',
        name: 'CacheManagerService',
        error: error,
        stackTrace: stackTrace,
      );
      return false;
    }
  }

  /// Remove data from cache
  Future<bool> remove(String key) async {
    try {
      dev.log('Removing cached data: $key', name: 'CacheManagerService');

      final rowsAffected = await _databaseService.delete(
        CacheTable.tableName,
        where: '${CacheTable.key} = ?',
        whereArgs: [key],
      );

      final success = rowsAffected > 0;
      
      if (success) {
        dev.log('Cache entry removed: $key', name: 'CacheManagerService');
      } else {
        dev.log('Cache entry not found: $key', name: 'CacheManagerService');
      }

      return success;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to remove cache entry $key: $error',
        name: 'CacheManagerService',
        error: error,
        stackTrace: stackTrace,
      );
      return false;
    }
  }

  /// Clear cache by type
  Future<int> clearByType(String type) async {
    try {
      dev.log('Clearing cache by type: $type', name: 'CacheManagerService');

      final deletedCount = await _databaseService.delete(
        CacheTable.tableName,
        where: '${CacheTable.type} = ?',
        whereArgs: [type],
      );

      dev.log('Cleared $deletedCount cache entries of type: $type', 
              name: 'CacheManagerService');
      return deletedCount;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to clear cache by type $type: $error',
        name: 'CacheManagerService',
        error: error,
        stackTrace: stackTrace,
      );
      return 0;
    }
  }

  /// Clear all expired entries
  Future<int> clearExpired() async {
    try {
      dev.log('Clearing expired cache entries', name: 'CacheManagerService');

      final now = DateTime.now().millisecondsSinceEpoch;
      final deletedCount = await _databaseService.delete(
        CacheTable.tableName,
        where: '${CacheTable.expiresAt} IS NOT NULL AND ${CacheTable.expiresAt} < ?',
        whereArgs: [now],
      );

      dev.log('Cleared $deletedCount expired cache entries', 
              name: 'CacheManagerService');
      return deletedCount;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to clear expired cache entries: $error',
        name: 'CacheManagerService',
        error: error,
        stackTrace: stackTrace,
      );
      return 0;
    }
  }

  /// Clear all cache entries
  Future<void> clearAll() async {
    try {
      dev.log('Clearing all cache entries', name: 'CacheManagerService');

      await _databaseService.delete(CacheTable.tableName);

      dev.log('All cache entries cleared', name: 'CacheManagerService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to clear all cache entries: $error',
        name: 'CacheManagerService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get cache statistics
  Future<CacheStats> getStats() async {
    try {
      dev.log('Getting cache statistics', name: 'CacheManagerService');

      // Get total count and size
      final totalResult = await _databaseService.rawQuery(
        'SELECT COUNT(*) as count, SUM(${CacheTable.size}) as total_size FROM ${CacheTable.tableName}',
      );
      
      final totalCount = totalResult.first['count'] as int;
      final totalSize = totalResult.first['total_size'] as int? ?? 0;

      // Get counts by type
      final typeResults = await _databaseService.rawQuery(
        'SELECT ${CacheTable.type}, COUNT(*) as count, SUM(${CacheTable.size}) as size '
        'FROM ${CacheTable.tableName} GROUP BY ${CacheTable.type}',
      );
      
      final typeCounts = <String, int>{};
      final typeSizes = <String, int>{};
      for (final row in typeResults) {
        final type = row['type'] as String;
        typeCounts[type] = row['count'] as int;
        typeSizes[type] = row['size'] as int? ?? 0;
      }

      // Get expired count
      final now = DateTime.now().millisecondsSinceEpoch;
      final expiredResult = await _databaseService.rawQuery(
        'SELECT COUNT(*) as count FROM ${CacheTable.tableName} '
        'WHERE ${CacheTable.expiresAt} IS NOT NULL AND ${CacheTable.expiresAt} < ?',
        [now],
      );
      final expiredCount = expiredResult.first['count'] as int;

      // Get oldest and newest entries
      final oldestResult = await _databaseService.query(
        CacheTable.tableName,
        columns: [CacheTable.createdAt],
        orderBy: '${CacheTable.createdAt} ASC',
        limit: 1,
      );
      
      DateTime? oldestEntry;
      if (oldestResult.isNotEmpty) {
        oldestEntry = DateTime.fromMillisecondsSinceEpoch(
          oldestResult.first[CacheTable.createdAt] as int,
        );
      }

      final stats = CacheStats(
        totalEntries: totalCount,
        totalSize: totalSize,
        typeBreakdown: typeCounts,
        typeSizes: typeSizes,
        expiredEntries: expiredCount,
        oldestEntry: oldestEntry,
      );

      dev.log('Cache stats: $stats', name: 'CacheManagerService');
      return stats;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get cache stats: $error',
        name: 'CacheManagerService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get cache entries with pagination
  Future<List<CacheEntry>> getEntries({
    String? type,
    int? limit,
    int? offset,
    String orderBy = 'last_accessed DESC',
  }) async {
    try {
      dev.log('Getting cache entries', name: 'CacheManagerService');

      String? where;
      List<dynamic>? whereArgs;

      if (type != null) {
        where = '${CacheTable.type} = ?';
        whereArgs = [type];
      }

      final results = await _databaseService.query(
        CacheTable.tableName,
        where: where,
        whereArgs: whereArgs,
        orderBy: orderBy,
        limit: limit,
        offset: offset,
      );

      final entries = results.map((row) => CacheEntry(
        key: row[CacheTable.key] as String,
        type: row[CacheTable.type] as String,
        size: row[CacheTable.size] as int,
        createdAt: DateTime.fromMillisecondsSinceEpoch(row[CacheTable.createdAt] as int),
        lastAccessed: DateTime.fromMillisecondsSinceEpoch(row[CacheTable.lastAccessed] as int),
        expiresAt: row[CacheTable.expiresAt] != null 
            ? DateTime.fromMillisecondsSinceEpoch(row[CacheTable.expiresAt] as int)
            : null,
        metadata: row[CacheTable.metadata] != null 
            ? jsonDecode(row[CacheTable.metadata] as String) as Map<String, dynamic>
            : null,
      )).toList();

      dev.log('Retrieved ${entries.length} cache entries', name: 'CacheManagerService');
      return entries;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get cache entries: $error',
        name: 'CacheManagerService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Ensure there's enough space for new data
  Future<void> _ensureSpace(int requiredSize) async {
    final stats = await getStats();
    final currentSize = stats.totalSize;
    final availableSpace = DatabaseConstants.maxCacheSize - currentSize;

    if (requiredSize <= availableSpace) {
      return; // Enough space available
    }

    dev.log(
      'Cache cleanup needed: current ${_formatBytes(currentSize)}, '
      'required ${_formatBytes(requiredSize)}, '
      'max ${_formatBytes(DatabaseConstants.maxCacheSize)}',
      name: 'CacheManagerService',
    );

    // First, clear expired entries
    await clearExpired();

    // Check if we have enough space now
    final updatedStats = await getStats();
    final updatedSize = updatedStats.totalSize;
    final updatedAvailableSpace = DatabaseConstants.maxCacheSize - updatedSize;

    if (requiredSize <= updatedAvailableSpace) {
      dev.log('Space freed by clearing expired entries', name: 'CacheManagerService');
      return;
    }

    // Need to evict LRU entries
    final spaceToFree = requiredSize - updatedAvailableSpace;
    await _evictLRU(spaceToFree);
  }

  /// Evict least recently used entries to free up space
  Future<void> _evictLRU(int spaceToFree) async {
    dev.log('Evicting LRU entries to free ${_formatBytes(spaceToFree)}', 
            name: 'CacheManagerService');

    var freedSpace = 0;
    var entriesEvicted = 0;

    // Get entries ordered by last accessed time (oldest first)
    final results = await _databaseService.query(
      CacheTable.tableName,
      columns: [CacheTable.key, CacheTable.size],
      orderBy: '${CacheTable.lastAccessed} ASC',
    );

    for (final row in results) {
      final key = row[CacheTable.key] as String;
      final size = row[CacheTable.size] as int;

      await remove(key);
      freedSpace += size;
      entriesEvicted++;

      if (freedSpace >= spaceToFree) {
        break;
      }
    }

    dev.log(
      'Evicted $entriesEvicted entries, freed ${_formatBytes(freedSpace)}',
      name: 'CacheManagerService',
    );
  }

  /// Format bytes for human-readable output
  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }
}

/// Cache entry model
class CacheEntry {
  final String key;
  final String type;
  final int size;
  final DateTime createdAt;
  final DateTime lastAccessed;
  final DateTime? expiresAt;
  final Map<String, dynamic>? metadata;

  const CacheEntry({
    required this.key,
    required this.type,
    required this.size,
    required this.createdAt,
    required this.lastAccessed,
    this.expiresAt,
    this.metadata,
  });

  /// Check if the entry is expired
  bool get isExpired {
    return expiresAt != null && DateTime.now().isAfter(expiresAt!);
  }

  /// Get formatted size
  String get formattedSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    if (size < 1024 * 1024 * 1024) return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(size / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  @override
  String toString() {
    return 'CacheEntry(key: $key, type: $type, size: $formattedSize, '
           'created: $createdAt, accessed: $lastAccessed'
           '${expiresAt != null ? ', expires: $expiresAt' : ''})';
  }
}

/// Cache statistics model
class CacheStats {
  final int totalEntries;
  final int totalSize;
  final Map<String, int> typeBreakdown;
  final Map<String, int> typeSizes;
  final int expiredEntries;
  final DateTime? oldestEntry;

  const CacheStats({
    required this.totalEntries,
    required this.totalSize,
    required this.typeBreakdown,
    required this.typeSizes,
    required this.expiredEntries,
    this.oldestEntry,
  });

  /// Get formatted total size
  String get formattedSize {
    if (totalSize < 1024) return '$totalSize B';
    if (totalSize < 1024 * 1024) return '${(totalSize / 1024).toStringAsFixed(1)} KB';
    if (totalSize < 1024 * 1024 * 1024) return '${(totalSize / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(totalSize / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  /// Get cache utilization percentage
  double get utilization {
    return (totalSize / DatabaseConstants.maxCacheSize) * 100;
  }

  @override
  String toString() {
    return 'CacheStats(entries: $totalEntries, size: $formattedSize, '
           'utilization: ${utilization.toStringAsFixed(1)}%, expired: $expiredEntries)';
  }
}