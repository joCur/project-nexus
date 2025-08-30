import 'dart:developer' as dev;
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../database/database_constants.dart';
import '../models/card.dart';
import '../models/card_enums.dart';
import 'database_service.dart';

part 'card_storage_service.g.dart';

@riverpod
CardStorageService cardStorageService(Ref ref) {
  final databaseService = ref.watch(databaseServiceProvider);
  return CardStorageService(databaseService);
}

/// Service for managing card storage and retrieval operations
/// 
/// Provides comprehensive CRUD operations for cards including:
/// - Create, read, update, delete operations
/// - Batch operations for performance
/// - Search and filtering capabilities
/// - Content hash generation for change detection
/// - Dirty state management for auto-save
/// - Transaction support for data consistency
class CardStorageService {
  final DatabaseService _databaseService;

  CardStorageService(this._databaseService);

  /// Create a new card
  Future<Card> createCard(Card card) async {
    try {
      dev.log('Creating card: ${card.id}', name: 'CardStorageService');

      // Generate content hash
      final cardWithHash = card.copyWith(
        contentHash: _generateContentHash(card.content),
        isDirty: false, // New cards start clean
        lastSavedAt: DateTime.now(),
      );

      await _databaseService.insert(
        CardTable.tableName,
        cardWithHash.toDbMap(),
      );

      dev.log('Card created successfully: ${card.id}', name: 'CardStorageService');
      return cardWithHash;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to create card ${card.id}: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get a card by ID
  Future<Card?> getCard(String cardId) async {
    try {
      dev.log('Retrieving card: $cardId', name: 'CardStorageService');

      final results = await _databaseService.query(
        CardTable.tableName,
        where: '${CardTable.id} = ?',
        whereArgs: [cardId],
        limit: 1,
      );

      if (results.isEmpty) {
        dev.log('Card not found: $cardId', name: 'CardStorageService');
        return null;
      }

      final card = Card.fromDbMap(results.first);
      dev.log('Card retrieved: $cardId', name: 'CardStorageService');
      return card;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get card $cardId: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Update an existing card
  Future<Card> updateCard(Card card, {required String lastModifiedBy}) async {
    try {
      dev.log('Updating card: ${card.id}', name: 'CardStorageService');

      // Generate new content hash and mark as dirty
      final updatedCard = card.copyWith(
        contentHash: _generateContentHash(card.content),
        isDirty: true,
        updatedAt: DateTime.now(),
        lastModifiedBy: lastModifiedBy,
        version: card.version + 1, // Increment version for optimistic locking
      );

      final rowsAffected = await _databaseService.update(
        CardTable.tableName,
        updatedCard.toDbMap(),
        where: '${CardTable.id} = ? AND ${CardTable.version} = ?',
        whereArgs: [card.id, card.version], // Optimistic locking
      );

      if (rowsAffected == 0) {
        throw CardStorageException(
          'Card update failed - version conflict or card not found',
          CardStorageError.versionConflict,
          cardId: card.id,
          expectedVersion: card.version,
        );
      }

      dev.log('Card updated successfully: ${card.id}', name: 'CardStorageService');
      return updatedCard;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to update card ${card.id}: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Delete a card (soft delete by changing status)
  Future<bool> deleteCard(String cardId, {bool hardDelete = false}) async {
    try {
      dev.log('Deleting card: $cardId (hard: $hardDelete)', name: 'CardStorageService');

      int rowsAffected;
      
      if (hardDelete) {
        rowsAffected = await _databaseService.delete(
          CardTable.tableName,
          where: '${CardTable.id} = ?',
          whereArgs: [cardId],
        );
      } else {
        // Soft delete - mark as deleted
        rowsAffected = await _databaseService.update(
          CardTable.tableName,
          {
            CardTable.status: CardStatus.deleted.value,
            CardTable.updatedAt: DateTime.now().millisecondsSinceEpoch,
            CardTable.isDirty: 1,
          },
          where: '${CardTable.id} = ?',
          whereArgs: [cardId],
        );
      }

      final success = rowsAffected > 0;
      
      if (success) {
        dev.log('Card deleted successfully: $cardId', name: 'CardStorageService');
      } else {
        dev.log('Card not found for deletion: $cardId', name: 'CardStorageService');
      }

      return success;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to delete card $cardId: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get all cards for a workspace
  Future<List<Card>> getWorkspaceCards(
    String workspaceId, {
    List<CardStatus>? statusFilter,
    List<CardType>? typeFilter,
    String? canvasId,
    int? limit,
    int? offset,
    String? orderBy,
  }) async {
    try {
      dev.log('Getting workspace cards: $workspaceId', name: 'CardStorageService');

      // Build WHERE clause
      final whereConditions = <String>['${CardTable.workspaceId} = ?'];
      final whereArgs = <dynamic>[workspaceId];

      if (canvasId != null) {
        whereConditions.add('${CardTable.canvasId} = ?');
        whereArgs.add(canvasId);
      }

      if (statusFilter != null && statusFilter.isNotEmpty) {
        final statusPlaceholders = statusFilter.map((_) => '?').join(',');
        whereConditions.add('${CardTable.status} IN ($statusPlaceholders)');
        whereArgs.addAll(statusFilter.map((s) => s.value));
      }

      if (typeFilter != null && typeFilter.isNotEmpty) {
        final typePlaceholders = typeFilter.map((_) => '?').join(',');
        whereConditions.add('${CardTable.type} IN ($typePlaceholders)');
        whereArgs.addAll(typeFilter.map((t) => t.value));
      }

      final results = await _databaseService.query(
        CardTable.tableName,
        where: whereConditions.join(' AND '),
        whereArgs: whereArgs,
        orderBy: orderBy ?? '${CardTable.updatedAt} DESC',
        limit: limit,
        offset: offset,
      );

      final cards = results.map(Card.fromDbMap).toList();
      
      dev.log('Retrieved ${cards.length} workspace cards', name: 'CardStorageService');
      return cards;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get workspace cards for $workspaceId: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get all dirty cards (cards with unsaved changes)
  Future<List<Card>> getDirtyCards({String? userId}) async {
    try {
      dev.log('Getting dirty cards', name: 'CardStorageService');

      String where = '${CardTable.isDirty} = 1';
      List<dynamic> whereArgs = [];

      if (userId != null) {
        where += ' AND ${CardTable.lastModifiedBy} = ?';
        whereArgs.add(userId);
      }

      final results = await _databaseService.query(
        CardTable.tableName,
        where: where,
        whereArgs: whereArgs.isEmpty ? null : whereArgs,
        orderBy: '${CardTable.updatedAt} ASC', // Oldest changes first
      );

      final cards = results.map(Card.fromDbMap).toList();
      
      dev.log('Retrieved ${cards.length} dirty cards', name: 'CardStorageService');
      return cards;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get dirty cards: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Mark a card as clean (saved)
  Future<void> markCardClean(String cardId) async {
    try {
      dev.log('Marking card clean: $cardId', name: 'CardStorageService');

      await _databaseService.update(
        CardTable.tableName,
        {
          CardTable.isDirty: 0,
          CardTable.lastSavedAt: DateTime.now().millisecondsSinceEpoch,
        },
        where: '${CardTable.id} = ?',
        whereArgs: [cardId],
      );

      dev.log('Card marked clean: $cardId', name: 'CardStorageService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to mark card clean $cardId: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Search cards by content
  Future<List<Card>> searchCards(
    String workspaceId,
    String searchTerm, {
    int? limit,
    int? offset,
  }) async {
    try {
      dev.log('Searching cards: "$searchTerm"', name: 'CardStorageService');

      final results = await _databaseService.query(
        CardTable.tableName,
        where: '''${CardTable.workspaceId} = ? AND 
                  (${CardTable.title} LIKE ? OR 
                   ${CardTable.content} LIKE ? OR 
                   ${CardTable.tags} LIKE ?)''',
        whereArgs: [
          workspaceId,
          '%$searchTerm%',
          '%$searchTerm%',
          '%$searchTerm%',
        ],
        orderBy: '${CardTable.updatedAt} DESC',
        limit: limit,
        offset: offset,
      );

      final cards = results.map(Card.fromDbMap).toList();
      
      dev.log('Search found ${cards.length} cards', name: 'CardStorageService');
      return cards;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to search cards: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get cards within a bounding box
  Future<List<Card>> getCardsInBounds(
    String workspaceId, {
    required double minX,
    required double minY,
    required double maxX,
    required double maxY,
    String? canvasId,
  }) async {
    try {
      dev.log('Getting cards in bounds: ($minX,$minY) to ($maxX,$maxY)', name: 'CardStorageService');

      String where = '''${CardTable.workspaceId} = ? AND 
                        ${CardTable.positionX} >= ? AND 
                        ${CardTable.positionX} <= ? AND 
                        ${CardTable.positionY} >= ? AND 
                        ${CardTable.positionY} <= ?''';
      List<dynamic> whereArgs = [workspaceId, minX, maxX, minY, maxY];

      if (canvasId != null) {
        where += ' AND ${CardTable.canvasId} = ?';
        whereArgs.add(canvasId);
      }

      final results = await _databaseService.query(
        CardTable.tableName,
        where: where,
        whereArgs: whereArgs,
        orderBy: '${CardTable.positionZ} ASC', // Order by z-index
      );

      final cards = results.map(Card.fromDbMap).toList();
      
      dev.log('Retrieved ${cards.length} cards in bounds', name: 'CardStorageService');
      return cards;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get cards in bounds: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Batch create cards
  Future<List<Card>> batchCreateCards(List<Card> cards) async {
    try {
      dev.log('Batch creating ${cards.length} cards', name: 'CardStorageService');

      final results = <Card>[];
      
      await _databaseService.transaction((txn) async {
        for (final card in cards) {
          final cardWithHash = card.copyWith(
            contentHash: _generateContentHash(card.content),
            isDirty: false,
            lastSavedAt: DateTime.now(),
          );

          await txn.insert(CardTable.tableName, cardWithHash.toDbMap());
          results.add(cardWithHash);
        }
      });

      dev.log('Batch created ${results.length} cards', name: 'CardStorageService');
      return results;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to batch create cards: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Batch update card positions
  Future<void> batchUpdatePositions(List<CardPositionUpdate> updates) async {
    try {
      dev.log('Batch updating ${updates.length} card positions', name: 'CardStorageService');

      await _databaseService.transaction((txn) async {
        for (final update in updates) {
          await txn.update(
            CardTable.tableName,
            {
              CardTable.positionX: update.position.x,
              CardTable.positionY: update.position.y,
              CardTable.positionZ: update.position.z,
              CardTable.updatedAt: DateTime.now().millisecondsSinceEpoch,
              CardTable.isDirty: 1,
              CardTable.version: update.version + 1,
            },
            where: '${CardTable.id} = ? AND ${CardTable.version} = ?',
            whereArgs: [update.cardId, update.version],
          );
        }
      });

      dev.log('Batch position update completed', name: 'CardStorageService');
    } catch (error, stackTrace) {
      dev.log(
        'Failed to batch update positions: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Get storage statistics
  Future<CardStorageStats> getStorageStats({String? workspaceId}) async {
    try {
      dev.log('Getting storage statistics', name: 'CardStorageService');

      String? where;
      List<dynamic>? whereArgs;

      if (workspaceId != null) {
        where = '${CardTable.workspaceId} = ?';
        whereArgs = [workspaceId];
      }

      // Get total count
      final totalResult = await _databaseService.rawQuery(
        'SELECT COUNT(*) as count FROM ${CardTable.tableName}${where != null ? ' WHERE $where' : ''}',
        whereArgs,
      );
      final totalCount = totalResult.first['count'] as int;

      // Get counts by type
      final typeResults = await _databaseService.rawQuery(
        'SELECT ${CardTable.type}, COUNT(*) as count FROM ${CardTable.tableName}${where != null ? ' WHERE $where' : ''} GROUP BY ${CardTable.type}',
        whereArgs,
      );
      
      final typeStats = <CardType, int>{};
      for (final row in typeResults) {
        final type = CardType.fromString(row['type'] as String);
        typeStats[type] = row['count'] as int;
      }

      // Get counts by status
      final statusResults = await _databaseService.rawQuery(
        'SELECT ${CardTable.status}, COUNT(*) as count FROM ${CardTable.tableName}${where != null ? ' WHERE $where' : ''} GROUP BY ${CardTable.status}',
        whereArgs,
      );
      
      final statusStats = <CardStatus, int>{};
      for (final row in statusResults) {
        final status = CardStatus.fromString(row['status'] as String);
        statusStats[status] = row['count'] as int;
      }

      // Get dirty count
      final dirtyResult = await _databaseService.rawQuery(
        'SELECT COUNT(*) as count FROM ${CardTable.tableName} WHERE ${CardTable.isDirty} = 1${where != null ? ' AND $where' : ''}',
        where != null ? whereArgs : null,
      );
      final dirtyCount = dirtyResult.first['count'] as int;

      final stats = CardStorageStats(
        totalCards: totalCount,
        cardsByType: typeStats,
        cardsByStatus: statusStats,
        dirtyCards: dirtyCount,
        workspaceId: workspaceId,
      );

      dev.log('Storage stats: $stats', name: 'CardStorageService');
      return stats;
    } catch (error, stackTrace) {
      dev.log(
        'Failed to get storage stats: $error',
        name: 'CardStorageService',
        error: error,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Generate content hash for change detection
  String _generateContentHash(String content) {
    final bytes = utf8.encode(content);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }
}

/// Card position update model for batch operations
class CardPositionUpdate {
  final String cardId;
  final CardPosition position;
  final int version;

  const CardPositionUpdate({
    required this.cardId,
    required this.position,
    required this.version,
  });

  @override
  String toString() => 'CardPositionUpdate(id: $cardId, pos: $position, v: $version)';
}

/// Card storage statistics
class CardStorageStats {
  final int totalCards;
  final Map<CardType, int> cardsByType;
  final Map<CardStatus, int> cardsByStatus;
  final int dirtyCards;
  final String? workspaceId;

  const CardStorageStats({
    required this.totalCards,
    required this.cardsByType,
    required this.cardsByStatus,
    required this.dirtyCards,
    this.workspaceId,
  });

  @override
  String toString() {
    return 'CardStorageStats('
        'total: $totalCards, '
        'dirty: $dirtyCards, '
        'workspace: $workspaceId'
        ')';
  }
}

/// Card storage service errors
enum CardStorageError {
  cardNotFound,
  versionConflict,
  validationFailed,
  databaseError,
  unknownError,
}

/// Card storage exception
class CardStorageException implements Exception {
  final String message;
  final CardStorageError errorType;
  final String? cardId;
  final int? expectedVersion;
  final Object? cause;

  const CardStorageException(
    this.message,
    this.errorType, {
    this.cardId,
    this.expectedVersion,
    this.cause,
  });

  @override
  String toString() {
    return 'CardStorageException: $message'
        '${cardId != null ? ' (cardId: $cardId)' : ''}'
        '${expectedVersion != null ? ' (expectedVersion: $expectedVersion)' : ''}'
        '${cause != null ? ' - Caused by: $cause' : ''}';
  }
}