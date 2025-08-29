import 'dart:async';
import 'dart:convert';
import 'dart:developer' as dev;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';

import '../database/database_constants.dart';
import '../models/card.dart';
import 'card_storage_service.dart';
import 'database_service.dart';

part 'auto_save_service.g.dart';

@riverpod
AutoSaveService autoSaveService(Ref ref) {
  final databaseService = ref.watch(databaseServiceProvider);
  final cardStorageService = ref.watch(cardStorageServiceProvider);
  return AutoSaveService(databaseService, cardStorageService);
}

/// Service for automatic saving of card changes with debouncing
/// 
/// Provides intelligent auto-save functionality with:
/// - 5-second debouncing to prevent excessive saves
/// - Dirty state tracking
/// - Conflict detection and resolution
/// - Retry logic with exponential backoff
/// - Background processing
/// - Progress tracking and error handling
class AutoSaveService {
  final DatabaseService _databaseService;
  final CardStorageService _cardStorageService;
  final Uuid _uuid = const Uuid();

  // Auto-save state management
  final Map<String, Timer> _saveTimers = {};
  final Map<String, Card> _pendingCards = {};
  final Map<String, Completer<void>> _saveCompleters = {};
  
  bool _isEnabled = true;
  StreamController<AutoSaveEvent>? _eventController;

  AutoSaveService(this._databaseService, this._cardStorageService) {
    _initializeEventStream();
  }

  /// Initialize event stream for auto-save notifications
  void _initializeEventStream() {
    _eventController = StreamController<AutoSaveEvent>.broadcast();
  }

  /// Stream of auto-save events
  Stream<AutoSaveEvent> get events => _eventController?.stream ?? const Stream.empty();

  /// Check if auto-save is enabled
  bool get isEnabled => _isEnabled;

  /// Enable/disable auto-save
  void setEnabled(bool enabled) {
    dev.log('Auto-save ${enabled ? 'enabled' : 'disabled'}', name: 'AutoSaveService');
    _isEnabled = enabled;
    
    if (!enabled) {
      // Cancel all pending timers
      for (final timer in _saveTimers.values) {
        timer.cancel();
      }
      _saveTimers.clear();
      _pendingCards.clear();
    }

    _notifyEvent(AutoSaveEvent.enabledChanged(_isEnabled));
  }

  /// Schedule auto-save for a card with debouncing
  Future<void> scheduleAutoSave(Card card, String lastModifiedBy) async {
    if (!_isEnabled) {
      dev.log('Auto-save disabled, skipping: ${card.id}', name: 'AutoSaveService');
      return;
    }

    try {
      dev.log('Scheduling auto-save for card: ${card.id}', name: 'AutoSaveService');

      final cardId = card.id;
      
      // Cancel existing timer if any
      _saveTimers[cardId]?.cancel();
      
      // Update pending card data
      _pendingCards[cardId] = card.markDirty(lastModifiedBy: lastModifiedBy);
      
      // Create debounced timer
      _saveTimers[cardId] = Timer(
        const Duration(milliseconds: DatabaseConstants.autoSaveDebounceMs),
        () => _performAutoSave(cardId, lastModifiedBy),
      );

      _notifyEvent(AutoSaveEvent.scheduled(cardId));
      
      dev.log('Auto-save scheduled: ${card.id}', name: 'AutoSaveService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to schedule auto-save for card ${card.id}: $error',
        name: 'AutoSaveService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Force immediate save for a card (bypasses debouncing)
  Future<void> saveImmediately(Card card, String lastModifiedBy) async {
    if (!_isEnabled) {
      dev.log('Auto-save disabled, skipping immediate save: ${card.id}', 
              name: 'AutoSaveService');
      return;
    }

    try {
      dev.log('Performing immediate save for card: ${card.id}', name: 'AutoSaveService');

      final cardId = card.id;
      
      // Cancel any pending timer
      _saveTimers[cardId]?.cancel();
      _saveTimers.remove(cardId);
      
      // Perform save directly
      await _performAutoSave(cardId, lastModifiedBy, 
                           card.markDirty(lastModifiedBy: lastModifiedBy));
      
      dev.log('Immediate save completed: ${card.id}', name: 'AutoSaveService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed immediate save for card ${card.id}: $error',
        name: 'AutoSaveService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get pending cards awaiting auto-save
  Map<String, Card> get pendingCards => Map.unmodifiable(_pendingCards);

  /// Check if a card has pending auto-save
  bool hasPendingSave(String cardId) {
    return _saveTimers.containsKey(cardId) || _pendingCards.containsKey(cardId);
  }

  /// Wait for all pending saves to complete
  Future<void> flushPendingSaves() async {
    dev.log('Flushing ${_saveTimers.length} pending auto-saves', name: 'AutoSaveService');

    final futures = <Future<void>>[];
    
    // Cancel all timers and perform immediate saves
    for (final entry in _saveTimers.entries) {
      final cardId = entry.key;
      final timer = entry.value;
      
      timer.cancel();
      
      final pendingCard = _pendingCards[cardId];
      if (pendingCard != null) {
        futures.add(_performAutoSave(cardId, pendingCard.lastModifiedBy, pendingCard));
      }
    }
    
    _saveTimers.clear();
    
    // Wait for all saves to complete
    if (futures.isNotEmpty) {
      await Future.wait(futures);
    }
    
    dev.log('All pending auto-saves flushed', name: 'AutoSaveService');
  }

  /// Cancel auto-save for a specific card
  void cancelAutoSave(String cardId) {
    dev.log('Cancelling auto-save for card: $cardId', name: 'AutoSaveService');
    
    _saveTimers[cardId]?.cancel();
    _saveTimers.remove(cardId);
    _pendingCards.remove(cardId);
    _saveCompleters[cardId]?.complete();
    _saveCompleters.remove(cardId);
    
    _notifyEvent(AutoSaveEvent.cancelled(cardId));
    
    dev.log('Auto-save cancelled: $cardId', name: 'AutoSaveService');
  }

  /// Clean up auto-save state for deleted cards
  /// This prevents memory leaks by removing cards from internal maps
  void cleanupDeletedCard(String cardId) {
    dev.log('Cleaning up deleted card: $cardId', name: 'AutoSaveService');
    
    // Cancel any pending timer
    _saveTimers[cardId]?.cancel();
    _saveTimers.remove(cardId);
    
    // Remove from pending cards
    _pendingCards.remove(cardId);
    
    // Complete any waiting operations with error
    final completer = _saveCompleters.remove(cardId);
    if (completer != null && !completer.isCompleted) {
      completer.completeError(StateError('Card was deleted: $cardId'));
    }
    
    dev.log('Cleanup completed for deleted card: $cardId', name: 'AutoSaveService');
  }

  /// Clean up multiple deleted cards at once
  void cleanupDeletedCards(List<String> cardIds) {
    dev.log('Cleaning up ${cardIds.length} deleted cards', name: 'AutoSaveService');
    
    for (final cardId in cardIds) {
      cleanupDeletedCard(cardId);
    }
  }

  /// Perform the actual auto-save operation
  Future<void> _performAutoSave(
    String cardId, 
    String lastModifiedBy, [
    Card? cardOverride,
  ]) async {
    try {
      dev.log('Performing auto-save: $cardId', name: 'AutoSaveService');

      _notifyEvent(AutoSaveEvent.started(cardId));

      // Get the card to save
      final card = cardOverride ?? _pendingCards[cardId];
      if (card == null) {
        dev.log('No pending card data for auto-save: $cardId', name: 'AutoSaveService');
        return;
      }

      // Create auto-save queue entry
      final autoSaveId = await _enqueueAutoSave(card, lastModifiedBy);

      try {
        // Perform the actual save
        final savedCard = await _cardStorageService.updateCard(
          card,
          lastModifiedBy: lastModifiedBy,
        );

        // Mark card as clean
        await _cardStorageService.markCardClean(cardId);

        // Mark auto-save as completed
        await _markAutoSaveCompleted(autoSaveId);

        // Clean up
        _saveTimers.remove(cardId);
        _pendingCards.remove(cardId);
        
        // Complete any waiting operations
        _saveCompleters[cardId]?.complete();
        _saveCompleters.remove(cardId);

        _notifyEvent(AutoSaveEvent.completed(cardId, savedCard));
        
        dev.log('Auto-save completed successfully: $cardId', name: 'AutoSaveService');
      } catch (error) {
        // Mark auto-save as failed
        await _markAutoSaveFailed(autoSaveId, error.toString());
        
        _notifyEvent(AutoSaveEvent.failed(cardId, error));
        
        dev.log('Auto-save failed: $cardId - $error', name: 'AutoSaveService');
        rethrow;
      }
    } catch (error, stackTrace) {
      dev.log(
        'Auto-save operation failed for $cardId: $error',
        name: 'AutoSaveService',
        error: error,
        stackTrace: stackTrace,
      );
      
      // Complete with error
      _saveCompleters[cardId]?.completeError(error);
      _saveCompleters.remove(cardId);
      
      rethrow;
    }
  }

  /// Add auto-save operation to queue
  Future<String> _enqueueAutoSave(Card card, String lastModifiedBy) async {
    final autoSaveId = _uuid.v4();
    final changes = _generateChanges(card);
    
    await _databaseService.insert(
      AutoSaveTable.tableName,
      {
        AutoSaveTable.id: autoSaveId,
        AutoSaveTable.cardId: card.id,
        AutoSaveTable.changes: jsonEncode(changes),
        AutoSaveTable.createdAt: DateTime.now().millisecondsSinceEpoch,
        AutoSaveTable.attempts: 0,
        AutoSaveTable.status: 'PENDING',
        AutoSaveTable.userId: lastModifiedBy,
      },
    );
    
    return autoSaveId;
  }

  /// Mark auto-save operation as completed
  Future<void> _markAutoSaveCompleted(String autoSaveId) async {
    await _databaseService.update(
      AutoSaveTable.tableName,
      {AutoSaveTable.status: 'COMPLETED'},
      where: '${AutoSaveTable.id} = ?',
      whereArgs: [autoSaveId],
    );
  }

  /// Mark auto-save operation as failed with retry logic
  Future<void> _markAutoSaveFailed(String autoSaveId, String errorMessage) async {
    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000]; // Exponential backoff in ms
    
    // Get current attempt count
    final records = await _databaseService.query(
      AutoSaveTable.tableName,
      where: '${AutoSaveTable.id} = ?',
      whereArgs: [autoSaveId],
    );
    
    if (records.isEmpty) return;
    
    final currentAttempts = (records.first[AutoSaveTable.attempts] as int? ?? 0) + 1;
    final shouldRetry = currentAttempts < maxRetries;
    
    await _databaseService.update(
      AutoSaveTable.tableName,
      {
        AutoSaveTable.status: shouldRetry ? 'RETRY' : 'FAILED',
        AutoSaveTable.attempts: currentAttempts,
        AutoSaveTable.lastAttempt: DateTime.now().millisecondsSinceEpoch,
        'error_message': errorMessage,
      },
      where: '${AutoSaveTable.id} = ?',
      whereArgs: [autoSaveId],
    );
    
    // Schedule retry if not exceeded max attempts
    if (shouldRetry && currentAttempts <= retryDelays.length) {
      final delay = Duration(milliseconds: retryDelays[currentAttempts - 1]);
      Timer(delay, () => _retryAutoSave(autoSaveId));
    }
  }

  /// Retry a failed auto-save operation
  Future<void> _retryAutoSave(String autoSaveId) async {
    try {
      // Get the auto-save record
      final records = await _databaseService.query(
        AutoSaveTable.tableName,
        where: '${AutoSaveTable.id} = ? AND ${AutoSaveTable.status} = ?',
        whereArgs: [autoSaveId, 'RETRY'],
      );
      
      if (records.isEmpty) return;
      
      final record = records.first;
      final cardId = record[AutoSaveTable.cardId] as String;
      final userId = record[AutoSaveTable.userId] as String;
      
      dev.log('Retrying auto-save: $cardId (attempt ${record[AutoSaveTable.attempts]})', 
              name: 'AutoSaveService');
      
      // Get current card data
      final card = await _cardStorageService.getCard(cardId);
      if (card == null) {
        dev.log('Card not found for retry: $cardId', name: 'AutoSaveService');
        await _databaseService.update(
          AutoSaveTable.tableName,
          {AutoSaveTable.status: 'FAILED'},
          where: '${AutoSaveTable.id} = ?',
          whereArgs: [autoSaveId],
        );
        return;
      }
      
      // Update status to pending
      await _databaseService.update(
        AutoSaveTable.tableName,
        {AutoSaveTable.status: 'PENDING'},
        where: '${AutoSaveTable.id} = ?',
        whereArgs: [autoSaveId],
      );
      
      // Retry the save operation
      await _cardStorageService.updateCard(card, lastModifiedBy: userId);
      await _cardStorageService.markCardClean(cardId);
      await _markAutoSaveCompleted(autoSaveId);
      
      dev.log('Auto-save retry successful: $cardId', name: 'AutoSaveService');
    } catch (error) {
      dev.log('Auto-save retry failed: $autoSaveId - $error', name: 'AutoSaveService');
      await _markAutoSaveFailed(autoSaveId, error.toString());
    }
  }

  /// Generate changes summary for auto-save record
  Map<String, dynamic> _generateChanges(Card card) {
    return {
      'type': card.type.value,
      'title': card.title,
      'content_length': card.content.length,
      'position': {
        'x': card.position.x,
        'y': card.position.y,
        'z': card.position.z,
      },
      'dimensions': {
        'width': card.dimensions.width,
        'height': card.dimensions.height,
      },
      'status': card.status.value,
      'priority': card.priority.value,
      'version': card.version,
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  /// Get auto-save statistics
  Future<AutoSaveStats> getStats({String? userId}) async {
    try {
      dev.log('Getting auto-save statistics', name: 'AutoSaveService');

      String? whereClause;
      List<dynamic>? whereArgs;

      if (userId != null) {
        whereClause = '${AutoSaveTable.userId} = ?';
        whereArgs = [userId];
      }

      // Get total count
      final totalResult = await _databaseService.rawQuery(
        'SELECT COUNT(*) as count FROM ${AutoSaveTable.tableName}'
        '${whereClause != null ? ' WHERE $whereClause' : ''}',
        whereArgs,
      );
      final totalCount = totalResult.first['count'] as int;

      // Get counts by status
      final statusResults = await _databaseService.rawQuery(
        'SELECT ${AutoSaveTable.status}, COUNT(*) as count FROM ${AutoSaveTable.tableName}'
        '${whereClause != null ? ' WHERE $whereClause' : ''} '
        'GROUP BY ${AutoSaveTable.status}',
        whereArgs,
      );
      
      final statusCounts = <String, int>{};
      for (final row in statusResults) {
        final status = row['status'] as String;
        statusCounts[status] = row['count'] as int;
      }

      final stats = AutoSaveStats(
        totalOperations: totalCount,
        statusBreakdown: statusCounts,
        pendingSaves: _saveTimers.length,
        isEnabled: _isEnabled,
        userId: userId,
      );

      dev.log('Auto-save stats: $stats', name: 'AutoSaveService');
      return stats;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get auto-save stats: $error',
        name: 'AutoSaveService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Clean up old auto-save records
  Future<int> cleanupOldRecords({int olderThanDays = 30}) async {
    try {
      dev.log('Cleaning up auto-save records older than $olderThanDays days', 
              name: 'AutoSaveService');

      final cutoffTime = DateTime.now().subtract(Duration(days: olderThanDays));
      
      final deletedCount = await _databaseService.delete(
        AutoSaveTable.tableName,
        where: '${AutoSaveTable.status} = ? AND ${AutoSaveTable.createdAt} < ?',
        whereArgs: ['COMPLETED', cutoffTime.millisecondsSinceEpoch],
      );

      dev.log('Cleaned up $deletedCount old auto-save records', 
              name: 'AutoSaveService');
      return deletedCount;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to cleanup old auto-save records: $error',
        name: 'AutoSaveService',
        error: error,
        stackTrace: stackTrace,
      );
      return 0;
    }
  }

  /// Notify event listeners
  void _notifyEvent(AutoSaveEvent event) {
    _eventController?.add(event);
  }

  /// Dispose of the service and clean up resources
  void dispose() {
    dev.log('Disposing auto-save service', name: 'AutoSaveService');
    
    // Cancel all timers
    for (final timer in _saveTimers.values) {
      timer.cancel();
    }
    _saveTimers.clear();
    
    // Complete any pending operations
    for (final completer in _saveCompleters.values) {
      if (!completer.isCompleted) {
        completer.completeError(StateError('AutoSaveService disposed'));
      }
    }
    _saveCompleters.clear();
    
    _pendingCards.clear();
    
    // Close event stream
    _eventController?.close();
    _eventController = null;
    
    dev.log('Auto-save service disposed', name: 'AutoSaveService');
  }
}

/// Auto-save event types
abstract class AutoSaveEvent {
  const AutoSaveEvent();

  factory AutoSaveEvent.enabledChanged(bool enabled) = AutoSaveEnabledChangedEvent;
  factory AutoSaveEvent.scheduled(String cardId) = AutoSaveScheduledEvent;
  factory AutoSaveEvent.started(String cardId) = AutoSaveStartedEvent;
  factory AutoSaveEvent.completed(String cardId, Card savedCard) = AutoSaveCompletedEvent;
  factory AutoSaveEvent.failed(String cardId, Object error) = AutoSaveFailedEvent;
  factory AutoSaveEvent.cancelled(String cardId) = AutoSaveCancelledEvent;
}

class AutoSaveEnabledChangedEvent extends AutoSaveEvent {
  final bool enabled;
  const AutoSaveEnabledChangedEvent(this.enabled);
  
  @override
  String toString() => 'AutoSaveEnabledChanged(enabled: $enabled)';
}

class AutoSaveScheduledEvent extends AutoSaveEvent {
  final String cardId;
  const AutoSaveScheduledEvent(this.cardId);
  
  @override
  String toString() => 'AutoSaveScheduled(cardId: $cardId)';
}

class AutoSaveStartedEvent extends AutoSaveEvent {
  final String cardId;
  const AutoSaveStartedEvent(this.cardId);
  
  @override
  String toString() => 'AutoSaveStarted(cardId: $cardId)';
}

class AutoSaveCompletedEvent extends AutoSaveEvent {
  final String cardId;
  final Card savedCard;
  const AutoSaveCompletedEvent(this.cardId, this.savedCard);
  
  @override
  String toString() => 'AutoSaveCompleted(cardId: $cardId)';
}

class AutoSaveFailedEvent extends AutoSaveEvent {
  final String cardId;
  final Object error;
  const AutoSaveFailedEvent(this.cardId, this.error);
  
  @override
  String toString() => 'AutoSaveFailed(cardId: $cardId, error: $error)';
}

class AutoSaveCancelledEvent extends AutoSaveEvent {
  final String cardId;
  const AutoSaveCancelledEvent(this.cardId);
  
  @override
  String toString() => 'AutoSaveCancelled(cardId: $cardId)';
}

/// Auto-save statistics
class AutoSaveStats {
  final int totalOperations;
  final Map<String, int> statusBreakdown;
  final int pendingSaves;
  final bool isEnabled;
  final String? userId;

  const AutoSaveStats({
    required this.totalOperations,
    required this.statusBreakdown,
    required this.pendingSaves,
    required this.isEnabled,
    this.userId,
  });

  /// Get completed operations count
  int get completedCount => statusBreakdown['COMPLETED'] ?? 0;
  
  /// Get failed operations count
  int get failedCount => statusBreakdown['FAILED'] ?? 0;
  
  /// Get pending operations count
  int get pendingCount => statusBreakdown['PENDING'] ?? 0;

  @override
  String toString() {
    return 'AutoSaveStats('
        'total: $totalOperations, '
        'completed: $completedCount, '
        'failed: $failedCount, '
        'pending: $pendingSaves, '
        'enabled: $isEnabled'
        '${userId != null ? ', user: $userId' : ''}'
        ')';
  }
}