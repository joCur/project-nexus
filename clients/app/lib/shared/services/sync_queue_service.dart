import 'dart:developer' as dev;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';

import '../database/database_constants.dart';
import '../models/card_enums.dart';
import '../models/sync_operation.dart';
import 'database_service.dart';

part 'sync_queue_service.g.dart';

@riverpod
SyncQueueService syncQueueService(Ref ref) {
  final databaseService = ref.watch(databaseServiceProvider);
  return SyncQueueService(databaseService);
}

/// Service for managing offline operations sync queue
/// 
/// Handles queuing and processing of operations that need to be 
/// synchronized with the server when connectivity is restored.
/// Supports:
/// - Operation queuing with priority
/// - Retry logic with exponential backoff
/// - Batch processing for efficiency
/// - Conflict detection and resolution
/// - Progress tracking and error handling
class SyncQueueService {
  final DatabaseService _databaseService;
  final Uuid _uuid = const Uuid();

  SyncQueueService(this._databaseService);

  /// Add an operation to the sync queue
  Future<String> enqueueOperation({
    required SyncOperationType operation,
    required EntityType entityType,
    required String entityId,
    required Map<String, dynamic> data,
    required String userId,
    int priority = 0,
  }) async {
    try {
      final operationId = _uuid.v4();
      
      dev.log(
        'Enqueuing sync operation: $operation $entityType:$entityId',
        name: 'SyncQueueService',
      );

      final syncOperation = SyncOperation.create(
        id: operationId,
        operation: operation,
        entityType: entityType,
        entityId: entityId,
        data: data,
        userId: userId,
        priority: priority,
      );

      await _databaseService.insert(
        SyncQueueTable.tableName,
        syncOperation.toDbMap(),
      );

      dev.log('Operation enqueued: $operationId', name: 'SyncQueueService');
      return operationId;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to enqueue operation: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get pending operations from the queue
  Future<List<SyncOperation>> getPendingOperations({
    int? limit,
    String? userId,
  }) async {
    try {
      dev.log('Getting pending sync operations', name: 'SyncQueueService');

      String where = '${SyncQueueTable.status} = ?';
      List<dynamic> whereArgs = [SyncStatus.pending.value];

      if (userId != null) {
        where += ' AND ${SyncQueueTable.userId} = ?';
        whereArgs.add(userId);
      }

      final results = await _databaseService.query(
        SyncQueueTable.tableName,
        where: where,
        whereArgs: whereArgs,
        orderBy: '${SyncQueueTable.priority} DESC, ${SyncQueueTable.createdAt} ASC',
        limit: limit ?? DatabaseConstants.syncBatchSize,
      );

      final operations = results.map(SyncOperation.fromDbMap).toList();
      
      dev.log('Retrieved ${operations.length} pending operations', name: 'SyncQueueService');
      return operations;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get pending operations: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get failed operations that can be retried
  Future<List<SyncOperation>> getRetriableOperations({
    int? limit,
    String? userId,
  }) async {
    try {
      dev.log('Getting retriable sync operations', name: 'SyncQueueService');

      String where = '${SyncQueueTable.status} = ? AND ${SyncQueueTable.attempts} < ?';
      List<dynamic> whereArgs = [SyncStatus.failed.value, DatabaseConstants.maxAutoSaveRetries];

      if (userId != null) {
        where += ' AND ${SyncQueueTable.userId} = ?';
        whereArgs.add(userId);
      }

      final results = await _databaseService.query(
        SyncQueueTable.tableName,
        where: where,
        whereArgs: whereArgs,
        orderBy: '${SyncQueueTable.priority} DESC, ${SyncQueueTable.lastAttempt} ASC',
        limit: limit ?? DatabaseConstants.syncBatchSize,
      );

      final operations = results.map(SyncOperation.fromDbMap).toList();
      
      dev.log('Retrieved ${operations.length} retriable operations', name: 'SyncQueueService');
      return operations;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get retriable operations: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Mark an operation as in progress
  Future<void> markOperationInProgress(String operationId) async {
    try {
      dev.log('Marking operation in progress: $operationId', name: 'SyncQueueService');

      await _databaseService.update(
        SyncQueueTable.tableName,
        {
          SyncQueueTable.status: SyncStatus.inProgress.value,
          SyncQueueTable.lastAttempt: DateTime.now().millisecondsSinceEpoch,
        },
        where: '${SyncQueueTable.id} = ?',
        whereArgs: [operationId],
      );

      dev.log('Operation marked in progress: $operationId', name: 'SyncQueueService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to mark operation in progress $operationId: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Mark an operation as completed
  Future<void> markOperationCompleted(String operationId) async {
    try {
      dev.log('Marking operation completed: $operationId', name: 'SyncQueueService');

      await _databaseService.update(
        SyncQueueTable.tableName,
        {
          SyncQueueTable.status: SyncStatus.completed.value,
          SyncQueueTable.errorMessage: null,
        },
        where: '${SyncQueueTable.id} = ?',
        whereArgs: [operationId],
      );

      dev.log('Operation marked completed: $operationId', name: 'SyncQueueService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to mark operation completed $operationId: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Mark an operation as failed
  Future<void> markOperationFailed(String operationId, String errorMessage) async {
    try {
      dev.log('Marking operation failed: $operationId', name: 'SyncQueueService');

      // Get current operation to increment attempts
      final operation = await getOperation(operationId);
      if (operation == null) {
        dev.log('Operation not found: $operationId', name: 'SyncQueueService');
        return;
      }

      await _databaseService.update(
        SyncQueueTable.tableName,
        {
          SyncQueueTable.status: SyncStatus.failed.value,
          SyncQueueTable.errorMessage: errorMessage,
          SyncQueueTable.attempts: operation.attempts + 1,
          SyncQueueTable.lastAttempt: DateTime.now().millisecondsSinceEpoch,
        },
        where: '${SyncQueueTable.id} = ?',
        whereArgs: [operationId],
      );

      dev.log('Operation marked failed: $operationId (attempt ${operation.attempts + 1})', 
              name: 'SyncQueueService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to mark operation failed $operationId: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get a specific operation by ID
  Future<SyncOperation?> getOperation(String operationId) async {
    try {
      dev.log('Getting operation: $operationId', name: 'SyncQueueService');

      final results = await _databaseService.query(
        SyncQueueTable.tableName,
        where: '${SyncQueueTable.id} = ?',
        whereArgs: [operationId],
        limit: 1,
      );

      if (results.isEmpty) {
        dev.log('Operation not found: $operationId', name: 'SyncQueueService');
        return null;
      }

      final operation = SyncOperation.fromDbMap(results.first);
      dev.log('Operation retrieved: $operationId', name: 'SyncQueueService');
      return operation;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get operation $operationId: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Remove completed operations older than specified days
  Future<int> cleanupCompletedOperations({int olderThanDays = 7}) async {
    try {
      dev.log('Cleaning up completed operations older than $olderThanDays days', 
              name: 'SyncQueueService');

      final cutoffTime = DateTime.now().subtract(Duration(days: olderThanDays));
      
      final deletedCount = await _databaseService.delete(
        SyncQueueTable.tableName,
        where: '${SyncQueueTable.status} = ? AND ${SyncQueueTable.createdAt} < ?',
        whereArgs: [SyncStatus.completed.value, cutoffTime.millisecondsSinceEpoch],
      );

      dev.log('Cleaned up $deletedCount completed operations', name: 'SyncQueueService');
      return deletedCount;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to cleanup completed operations: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get operations for a specific entity
  Future<List<SyncOperation>> getEntityOperations(
    EntityType entityType,
    String entityId, {
    List<SyncStatus>? statusFilter,
  }) async {
    try {
      dev.log('Getting operations for entity: $entityType:$entityId', 
              name: 'SyncQueueService');

      String where = '${SyncQueueTable.entityType} = ? AND ${SyncQueueTable.entityId} = ?';
      List<dynamic> whereArgs = [entityType.value, entityId];

      if (statusFilter != null && statusFilter.isNotEmpty) {
        final statusPlaceholders = statusFilter.map((_) => '?').join(',');
        where += ' AND ${SyncQueueTable.status} IN ($statusPlaceholders)';
        whereArgs.addAll(statusFilter.map((s) => s.value));
      }

      final results = await _databaseService.query(
        SyncQueueTable.tableName,
        where: where,
        whereArgs: whereArgs,
        orderBy: '${SyncQueueTable.createdAt} DESC',
      );

      final operations = results.map(SyncOperation.fromDbMap).toList();
      
      dev.log('Retrieved ${operations.length} operations for entity', 
              name: 'SyncQueueService');
      return operations;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get entity operations: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Cancel pending operations for an entity
  Future<int> cancelEntityOperations(EntityType entityType, String entityId) async {
    try {
      dev.log('Cancelling operations for entity: $entityType:$entityId', 
              name: 'SyncQueueService');

      final cancelledCount = await _databaseService.delete(
        SyncQueueTable.tableName,
        where: '${SyncQueueTable.entityType} = ? AND ${SyncQueueTable.entityId} = ? AND ${SyncQueueTable.status} = ?',
        whereArgs: [entityType.value, entityId, SyncStatus.pending.value],
      );

      dev.log('Cancelled $cancelledCount operations for entity', name: 'SyncQueueService');
      return cancelledCount;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to cancel entity operations: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get sync queue statistics
  Future<SyncQueueStats> getQueueStats({String? userId}) async {
    try {
      dev.log('Getting sync queue statistics', name: 'SyncQueueService');

      String? whereClause;
      List<dynamic>? whereArgs;

      if (userId != null) {
        whereClause = '${SyncQueueTable.userId} = ?';
        whereArgs = [userId];
      }

      // Get counts by status
      final statusResults = await _databaseService.rawQuery(
        'SELECT ${SyncQueueTable.status}, COUNT(*) as count FROM ${SyncQueueTable.tableName}'
        '${whereClause != null ? ' WHERE $whereClause' : ''} '
        'GROUP BY ${SyncQueueTable.status}',
        whereArgs,
      );
      
      final statusStats = <SyncStatus, int>{};
      for (final row in statusResults) {
        final status = SyncStatus.fromString(row['status'] as String);
        statusStats[status] = row['count'] as int;
      }

      // Get counts by operation type
      final operationResults = await _databaseService.rawQuery(
        'SELECT ${SyncQueueTable.operation}, COUNT(*) as count FROM ${SyncQueueTable.tableName}'
        '${whereClause != null ? ' WHERE $whereClause' : ''} '
        'GROUP BY ${SyncQueueTable.operation}',
        whereArgs,
      );
      
      final operationStats = <SyncOperationType, int>{};
      for (final row in operationResults) {
        final operation = SyncOperationType.fromString(row['operation'] as String);
        operationStats[operation] = row['count'] as int;
      }

      // Get oldest pending operation
      final oldestResult = await _databaseService.query(
        SyncQueueTable.tableName,
        where: '${SyncQueueTable.status} = ?${whereClause != null ? ' AND $whereClause' : ''}',
        whereArgs: [SyncStatus.pending.value, if (whereArgs != null) ...whereArgs],
        orderBy: '${SyncQueueTable.createdAt} ASC',
        limit: 1,
      );

      DateTime? oldestPending;
      if (oldestResult.isNotEmpty) {
        oldestPending = DateTime.fromMillisecondsSinceEpoch(
          oldestResult.first['created_at'] as int,
        );
      }

      final stats = SyncQueueStats(
        statusCounts: statusStats,
        operationCounts: operationStats,
        oldestPendingOperation: oldestPending,
        userId: userId,
      );

      dev.log('Queue stats: $stats', name: 'SyncQueueService');
      return stats;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get queue stats: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Clear all operations (for testing or reset)
  Future<void> clearQueue({String? userId}) async {
    try {
      dev.log('Clearing sync queue${userId != null ? ' for user $userId' : ''}', 
              name: 'SyncQueueService');

      if (userId != null) {
        await _databaseService.delete(
          SyncQueueTable.tableName,
          where: '${SyncQueueTable.userId} = ?',
          whereArgs: [userId],
        );
      } else {
        await _databaseService.delete(SyncQueueTable.tableName);
      }

      dev.log('Sync queue cleared', name: 'SyncQueueService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to clear sync queue: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Reset failed operations to pending for retry
  Future<int> resetFailedOperations({String? userId, int? maxAttempts}) async {
    try {
      dev.log('Resetting failed operations to pending', name: 'SyncQueueService');

      String where = '${SyncQueueTable.status} = ?';
      List<dynamic> whereArgs = [SyncStatus.failed.value];

      if (userId != null) {
        where += ' AND ${SyncQueueTable.userId} = ?';
        whereArgs.add(userId);
      }

      if (maxAttempts != null) {
        where += ' AND ${SyncQueueTable.attempts} < ?';
        whereArgs.add(maxAttempts);
      }

      final resetCount = await _databaseService.update(
        SyncQueueTable.tableName,
        {
          SyncQueueTable.status: SyncStatus.pending.value,
          SyncQueueTable.errorMessage: null,
        },
        where: where,
        whereArgs: whereArgs,
      );

      dev.log('Reset $resetCount failed operations', name: 'SyncQueueService');
      return resetCount;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to reset failed operations: $error',
        name: 'SyncQueueService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }
}

/// Sync queue statistics
class SyncQueueStats {
  final Map<SyncStatus, int> statusCounts;
  final Map<SyncOperationType, int> operationCounts;
  final DateTime? oldestPendingOperation;
  final String? userId;

  const SyncQueueStats({
    required this.statusCounts,
    required this.operationCounts,
    this.oldestPendingOperation,
    this.userId,
  });

  /// Get total count of operations
  int get totalOperations {
    return statusCounts.values.fold(0, (sum, count) => sum + count);
  }

  /// Get count of pending operations
  int get pendingCount {
    return statusCounts[SyncStatus.pending] ?? 0;
  }

  /// Get count of failed operations
  int get failedCount {
    return statusCounts[SyncStatus.failed] ?? 0;
  }

  /// Get count of completed operations
  int get completedCount {
    return statusCounts[SyncStatus.completed] ?? 0;
  }

  /// Get count of in-progress operations
  int get inProgressCount {
    return statusCounts[SyncStatus.inProgress] ?? 0;
  }

  @override
  String toString() {
    return 'SyncQueueStats('
        'total: $totalOperations, '
        'pending: $pendingCount, '
        'failed: $failedCount, '
        'completed: $completedCount, '
        'inProgress: $inProgressCount'
        '${userId != null ? ', user: $userId' : ''}'
        ')';
  }
}