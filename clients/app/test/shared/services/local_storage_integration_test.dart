import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:flutter/services.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'dart:io';

import '../../../lib/shared/models/card.dart';
import '../../../lib/shared/models/card_enums.dart';
import '../../../lib/shared/models/user_preferences.dart';
import '../../../lib/shared/services/auto_save_service.dart';
import '../../../lib/shared/services/cache_manager_service.dart';
import '../../../lib/shared/services/card_storage_service.dart';
import '../../../lib/shared/services/database_service.dart';
import '../../../lib/shared/services/sync_queue_service.dart';
import '../../../lib/shared/services/user_preferences_service.dart';

// NOTE: This is an integration test that requires platform channel mocking
// Currently skipped in CI due to MissingPluginException for path_provider
// To run: flutter test test/shared/services/local_storage_integration_test.dart --flavor integration
@Tags(['integration', 'platform'])
void main() {
  // Initialize Flutter binding for tests that use platform channels
  TestWidgetsFlutterBinding.ensureInitialized();

  // Initialize SQLite FFI for testing
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  // Mock path_provider platform channel BEFORE setUpAll
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
    const MethodChannel('plugins.flutter.io/path_provider'),
    (MethodCall methodCall) async {
      if (methodCall.method == 'getApplicationDocumentsDirectory') {
        // Return a temporary directory path for testing
        return Directory.systemTemp.path;
      }
      return null;
    },
  );
  
  group('Local Storage Integration Tests', () {
    late DatabaseService databaseService;
    late CardStorageService cardStorageService;
    late SyncQueueService syncQueueService;
    late UserPreferencesService userPreferencesService;
    late CacheManagerService cacheManagerService;
    late AutoSaveService autoSaveService;
    
    const uuid = Uuid();
    const testUserId = 'test-user-123';
    const testWorkspaceId = 'test-workspace-456';

    setUpAll(() async {
      // Initialize services using provider container
      final container = ProviderContainer();
      databaseService = container.read(databaseServiceProvider);
      cardStorageService = CardStorageService(databaseService);
      syncQueueService = SyncQueueService(databaseService);
      userPreferencesService = UserPreferencesService(databaseService);
      cacheManagerService = CacheManagerService(databaseService);
      autoSaveService = AutoSaveService(databaseService, cardStorageService);
      
      // Initialize database
      await databaseService.database;
      
      // Clear any existing test data
      await databaseService.clearAllData();
      
      // Keep the container alive during tests
      container.dispose();
    });

    tearDownAll(() async {
      // Clean up
      autoSaveService.dispose();
      await databaseService.clearAllData();
      await databaseService.close();
    });

    group('DatabaseService Tests', () {
      test('should initialize database successfully', () async {
        final db = await databaseService.database;
        expect(db.isOpen, isTrue);
      });

      test('should get database statistics', () async {
        final stats = await databaseService.getStats();
        expect(stats.cardCount, equals(0));
        expect(stats.syncQueueCount, equals(0));
        expect(stats.preferencesCount, equals(0));
        expect(stats.cacheCount, equals(0));
      });

      test('should check database integrity', () async {
        final isIntact = await databaseService.checkIntegrity();
        expect(isIntact, isTrue);
      });
    });

    group('CardStorageService Tests', () {
      test('should create and retrieve a card', () async {
        final cardId = uuid.v4();
        final card = Card.create(
          id: cardId,
          workspaceId: testWorkspaceId,
          type: CardType.text,
          title: 'Test Card',
          content: 'This is a test card content',
          position: const CardPosition(x: 100, y: 200, z: 1),
          dimensions: const CardDimensions(width: 300, height: 200),
          createdBy: testUserId,
          tags: ['test', 'integration'],
        );

        // Create card
        final createdCard = await cardStorageService.createCard(card);
        expect(createdCard.id, equals(cardId));
        expect(createdCard.isDirty, isFalse);
        expect(createdCard.contentHash, isNotNull);

        // Retrieve card
        final retrievedCard = await cardStorageService.getCard(cardId);
        expect(retrievedCard, isNotNull);
        expect(retrievedCard!.id, equals(cardId));
        expect(retrievedCard.title, equals('Test Card'));
        expect(retrievedCard.content, equals('This is a test card content'));
        expect(retrievedCard.tags, containsAll(['test', 'integration']));
      });

      test('should update a card and handle version conflicts', () async {
        final cardId = uuid.v4();
        final card = Card.create(
          id: cardId,
          workspaceId: testWorkspaceId,
          type: CardType.text,
          content: 'Original content',
          position: const CardPosition(x: 0, y: 0, z: 1),
          dimensions: const CardDimensions(width: 200, height: 100),
          createdBy: testUserId,
        );

        // Create card
        final createdCard = await cardStorageService.createCard(card);
        
        // Update card
        final updatedCard = createdCard.copyWith(
          content: 'Updated content',
          title: 'Updated Title',
        );
        
        final savedCard = await cardStorageService.updateCard(
          updatedCard,
          lastModifiedBy: testUserId,
        );

        expect(savedCard.content, equals('Updated content'));
        expect(savedCard.title, equals('Updated Title'));
        expect(savedCard.version, equals(createdCard.version + 1));
        expect(savedCard.isDirty, isTrue);

        // Test version conflict
        expect(
          () async => await cardStorageService.updateCard(
            updatedCard, // Still has old version
            lastModifiedBy: testUserId,
          ),
          throwsA(isA<CardStorageException>()),
        );
      });

      test('should get workspace cards with filtering', () async {
        // Create multiple cards
        final cards = <Card>[];
        for (int i = 0; i < 5; i++) {
          final card = Card.create(
            id: uuid.v4(),
            workspaceId: testWorkspaceId,
            type: i % 2 == 0 ? CardType.text : CardType.image,
            content: 'Card content $i',
            position: CardPosition(x: i * 100.0, y: i * 50.0, z: i.toDouble()),
            dimensions: const CardDimensions(width: 200, height: 100),
            createdBy: testUserId,
            status: i < 3 ? CardStatus.active : CardStatus.draft,
          );
          cards.add(card);
        }

        await cardStorageService.batchCreateCards(cards);

        // Get all cards
        final allCards = await cardStorageService.getWorkspaceCards(testWorkspaceId);
        expect(allCards.length, greaterThanOrEqualTo(5));

        // Filter by status
        final activeCards = await cardStorageService.getWorkspaceCards(
          testWorkspaceId,
          statusFilter: [CardStatus.active],
        );
        expect(activeCards.length, greaterThanOrEqualTo(3));
        expect(activeCards.every((c) => c.status == CardStatus.active), isTrue);

        // Filter by type
        final textCards = await cardStorageService.getWorkspaceCards(
          testWorkspaceId,
          typeFilter: [CardType.text],
        );
        expect(textCards.every((c) => c.type == CardType.text), isTrue);
      });

      test('should search cards by content', () async {
        final searchCard = Card.create(
          id: uuid.v4(),
          workspaceId: testWorkspaceId,
          type: CardType.text,
          title: 'Searchable Title',
          content: 'This card contains unique search terms like Flutter and Dart',
          position: const CardPosition(x: 0, y: 0, z: 1),
          dimensions: const CardDimensions(width: 200, height: 100),
          createdBy: testUserId,
          tags: ['flutter', 'dart', 'mobile'],
        );

        await cardStorageService.createCard(searchCard);

        // Search by title
        final titleResults = await cardStorageService.searchCards(
          testWorkspaceId,
          'Searchable',
        );
        expect(titleResults.any((c) => c.id == searchCard.id), isTrue);

        // Search by content
        final contentResults = await cardStorageService.searchCards(
          testWorkspaceId,
          'Flutter',
        );
        expect(contentResults.any((c) => c.id == searchCard.id), isTrue);

        // Search by tag
        final tagResults = await cardStorageService.searchCards(
          testWorkspaceId,
          'flutter',
        );
        expect(tagResults.any((c) => c.id == searchCard.id), isTrue);
      });

      test('should get storage statistics', () async {
        final stats = await cardStorageService.getStorageStats(
          workspaceId: testWorkspaceId,
        );
        
        expect(stats.totalCards, greaterThan(0));
        expect(stats.workspaceId, equals(testWorkspaceId));
        expect(stats.cardsByType.isNotEmpty, isTrue);
        expect(stats.cardsByStatus.isNotEmpty, isTrue);
      });
    });

    group('SyncQueueService Tests', () {
      test('should enqueue and process sync operations', () async {
        final operationId = await syncQueueService.enqueueOperation(
          operation: SyncOperationType.create,
          entityType: EntityType.card,
          entityId: uuid.v4(),
          data: {'test': 'data'},
          userId: testUserId,
          priority: 1,
        );

        expect(operationId, isNotNull);

        // Get pending operations
        final pendingOps = await syncQueueService.getPendingOperations(
          userId: testUserId,
        );
        expect(pendingOps.any((op) => op.id == operationId), isTrue);

        // Mark as in progress
        await syncQueueService.markOperationInProgress(operationId);
        
        // Mark as completed
        await syncQueueService.markOperationCompleted(operationId);

        // Verify completion
        final operation = await syncQueueService.getOperation(operationId);
        expect(operation?.status, equals(SyncStatus.completed));
      });

      test('should handle operation failures and retries', () async {
        final operationId = await syncQueueService.enqueueOperation(
          operation: SyncOperationType.update,
          entityType: EntityType.card,
          entityId: uuid.v4(),
          data: {'test': 'failed data'},
          userId: testUserId,
        );

        // Mark as failed
        await syncQueueService.markOperationFailed(operationId, 'Test error');

        // Get retriable operations
        final retriableOps = await syncQueueService.getRetriableOperations(
          userId: testUserId,
        );
        expect(retriableOps.any((op) => op.id == operationId), isTrue);

        final failedOp = retriableOps.firstWhere((op) => op.id == operationId);
        expect(failedOp.attempts, equals(1));
        expect(failedOp.errorMessage, equals('Test error'));
      });

      test('should get sync queue statistics', () async {
        final stats = await syncQueueService.getQueueStats(userId: testUserId);
        
        expect(stats.totalOperations, greaterThan(0));
        expect(stats.userId, equals(testUserId));
        expect(stats.statusCounts.isNotEmpty, isTrue);
      });
    });

    group('UserPreferencesService Tests', () {
      test('should set and get typed preferences', () async {
        // String preference
        await userPreferencesService.setString('test.string', 'Hello World', testUserId);
        final stringValue = await userPreferencesService.getString('test.string', testUserId);
        expect(stringValue, equals('Hello World'));

        // Boolean preference
        await userPreferencesService.setBool('test.bool', true, testUserId);
        final boolValue = await userPreferencesService.getBool('test.bool', testUserId);
        expect(boolValue, isTrue);

        // Number preference
        await userPreferencesService.setNumber('test.number', 42.5, testUserId);
        final numberValue = await userPreferencesService.getNumber('test.number', testUserId);
        expect(numberValue, equals(42.5));

        // Object preference
        const testObject = {'key1': 'value1', 'key2': 123};
        await userPreferencesService.setObject('test.object', testObject, testUserId);
        final objectValue = await userPreferencesService.getObject('test.object', testUserId);
        expect(objectValue, equals(testObject));

        // Array preference
        const testArray = ['item1', 'item2', 123];
        await userPreferencesService.setArray('test.array', testArray, testUserId);
        final arrayValue = await userPreferencesService.getArray('test.array', testUserId);
        expect(arrayValue, equals(testArray));
      });

      test('should handle multiple preferences in transaction', () async {
        final preferences = {
          'multi.pref1': 'value1',
          'multi.pref2': 42,
          'multi.pref3': true,
        };

        await userPreferencesService.setMultiplePreferences(preferences, testUserId);

        final allPrefs = await userPreferencesService.getAllPreferences(testUserId);
        expect(allPrefs.getString('multi.pref1'), equals('value1'));
        expect(allPrefs.getNumber('multi.pref2'), equals(42));
        expect(allPrefs.getBool('multi.pref3'), isTrue);
      });

      test('should initialize and export/import preferences', () async {
        await userPreferencesService.initializeDefaults(testUserId);
        
        // Export preferences
        final exportData = await userPreferencesService.exportPreferences(testUserId);
        expect(exportData['userId'], equals(testUserId));
        expect(exportData['preferences'], isA<Map<String, dynamic>>());
        expect(exportData['preferences'].isNotEmpty, isTrue);

        // Clear and import
        await userPreferencesService.clearUserPreferences(testUserId);
        await userPreferencesService.importPreferences(testUserId, exportData);

        // Verify import
        final theme = await userPreferencesService.getString(
          PreferenceKeys.theme, 
          testUserId,
        );
        expect(theme, isNotEmpty);
      });
    });

    group('CacheManagerService Tests', () {
      test('should store and retrieve cached data', () async {
        const testData = {'message': 'Hello Cache', 'timestamp': 123456789};
        const cacheKey = 'test.cache.key';

        // Store data
        await cacheManagerService.put(
          cacheKey,
          testData,
          type: 'TEST_DATA',
          ttl: const Duration(minutes: 5),
        );

        // Check existence
        final exists = await cacheManagerService.containsKey(cacheKey);
        expect(exists, isTrue);

        // Retrieve data
        final cachedData = await cacheManagerService.get<Map<String, dynamic>>(cacheKey);
        expect(cachedData, equals(testData));
      });

      test('should handle TTL expiration', () async {
        const expiredData = 'This will expire';
        const expiredKey = 'expired.key';

        // Store with very short TTL
        await cacheManagerService.put(
          expiredKey,
          expiredData,
          ttl: const Duration(milliseconds: 1),
        );

        // Wait for expiration
        await Future.delayed(const Duration(milliseconds: 10));

        // Should be expired
        final exists = await cacheManagerService.containsKey(expiredKey);
        expect(exists, isFalse);

        final cachedData = await cacheManagerService.get<String>(expiredKey);
        expect(cachedData, isNull);
      });

      test('should manage cache size and eviction', () async {
        // Store multiple items
        for (int i = 0; i < 10; i++) {
          await cacheManagerService.put(
            'bulk.key.$i',
            'Data item $i with some content to increase size',
            type: 'BULK_TEST',
          );
        }

        // Get statistics
        final stats = await cacheManagerService.getStats();
        expect(stats.totalEntries, greaterThanOrEqualTo(10));
        expect(stats.totalSize, greaterThan(0));

        // Clear by type
        final clearedCount = await cacheManagerService.clearByType('BULK_TEST');
        expect(clearedCount, equals(10));
      });

      test('should get cache entries and statistics', () async {
        // Add some test data
        await cacheManagerService.put('stats.test1', 'data1', type: 'STATS');
        await cacheManagerService.put('stats.test2', 'data2', type: 'STATS');

        // Get entries
        final entries = await cacheManagerService.getEntries(type: 'STATS');
        expect(entries.length, equals(2));
        expect(entries.every((e) => e.type == 'STATS'), isTrue);

        // Get statistics
        final stats = await cacheManagerService.getStats();
        expect(stats.typeBreakdown.containsKey('STATS'), isTrue);
        expect(stats.typeBreakdown['STATS'], equals(2));
      });
    });

    group('AutoSaveService Tests', () {
      test('should schedule and perform auto-save', () async {
        final testCard = Card.create(
          id: uuid.v4(),
          workspaceId: testWorkspaceId,
          type: CardType.text,
          content: 'Auto-save test content',
          position: const CardPosition(x: 0, y: 0, z: 1),
          dimensions: const CardDimensions(width: 200, height: 100),
          createdBy: testUserId,
        );

        // Create card first
        await cardStorageService.createCard(testCard);

        // Schedule auto-save
        final updatedCard = testCard.copyWith(content: 'Updated auto-save content');
        await autoSaveService.scheduleAutoSave(updatedCard, testUserId);

        // Check pending saves
        expect(autoSaveService.hasPendingSave(testCard.id), isTrue);
        expect(autoSaveService.pendingCards.containsKey(testCard.id), isTrue);

        // Flush pending saves
        await autoSaveService.flushPendingSaves();

        // Verify save completed
        expect(autoSaveService.hasPendingSave(testCard.id), isFalse);

        // Check that card was actually saved
        final savedCard = await cardStorageService.getCard(testCard.id);
        expect(savedCard?.content, equals('Updated auto-save content'));
        expect(savedCard?.isDirty, isFalse); // Should be marked clean after save
      });

      test('should handle immediate saves', () async {
        final immediateCard = Card.create(
          id: uuid.v4(),
          workspaceId: testWorkspaceId,
          type: CardType.text,
          content: 'Immediate save content',
          position: const CardPosition(x: 0, y: 0, z: 1),
          dimensions: const CardDimensions(width: 200, height: 100),
          createdBy: testUserId,
        );

        // Create card first
        await cardStorageService.createCard(immediateCard);

        // Perform immediate save
        final updatedCard = immediateCard.copyWith(content: 'Immediately updated content');
        await autoSaveService.saveImmediately(updatedCard, testUserId);

        // Verify save completed immediately
        final savedCard = await cardStorageService.getCard(immediateCard.id);
        expect(savedCard?.content, equals('Immediately updated content'));
        expect(savedCard?.isDirty, isFalse);
      });

      test('should provide auto-save statistics', () async {
        final stats = await autoSaveService.getStats(userId: testUserId);
        
        expect(stats.isEnabled, isTrue);
        expect(stats.userId, equals(testUserId));
        expect(stats.totalOperations, greaterThanOrEqualTo(0));
      });

      test('should handle enable/disable state', () async {
        expect(autoSaveService.isEnabled, isTrue);

        // Disable auto-save
        autoSaveService.setEnabled(false);
        expect(autoSaveService.isEnabled, isFalse);

        // Re-enable
        autoSaveService.setEnabled(true);
        expect(autoSaveService.isEnabled, isTrue);
      });
    });

    group('Integration Tests', () {
      test('should demonstrate complete workflow', () async {
        // 1. Initialize user preferences
        await userPreferencesService.initializeDefaults(testUserId);
        
        // 2. Create a card
        final workflowCard = Card.create(
          id: uuid.v4(),
          workspaceId: testWorkspaceId,
          type: CardType.text,
          title: 'Integration Workflow Card',
          content: 'This demonstrates the complete local storage workflow',
          position: const CardPosition(x: 100, y: 200, z: 1),
          dimensions: const CardDimensions(width: 400, height: 300),
          createdBy: testUserId,
          tags: ['integration', 'workflow', 'test'],
        );

        final createdCard = await cardStorageService.createCard(workflowCard);
        
        // 3. Queue a sync operation
        await syncQueueService.enqueueOperation(
          operation: SyncOperationType.create,
          entityType: EntityType.card,
          entityId: createdCard.id,
          data: createdCard.toJson(),
          userId: testUserId,
        );

        // 4. Cache some related data
        await cacheManagerService.put(
          'card.${createdCard.id}.metadata',
          {'analyzed': true, 'sentiment': 'positive'},
          type: 'CARD_ANALYSIS',
          ttl: const Duration(hours: 1),
        );

        // 5. Update card and trigger auto-save
        final updatedCard = createdCard.copyWith(
          content: 'Updated content for integration test',
          priority: CardPriority.high,
        );

        await autoSaveService.scheduleAutoSave(updatedCard, testUserId);
        await autoSaveService.flushPendingSaves();

        // 6. Verify everything worked
        final finalCard = await cardStorageService.getCard(createdCard.id);
        expect(finalCard?.content, contains('Updated content'));
        expect(finalCard?.priority, equals(CardPriority.high));
        expect(finalCard?.isDirty, isFalse);

        final cachedMetadata = await cacheManagerService.get<Map<String, dynamic>>(
          'card.${createdCard.id}.metadata',
        );
        expect(cachedMetadata?['analyzed'], isTrue);

        final userTheme = await userPreferencesService.getString(
          PreferenceKeys.theme,
          testUserId,
        );
        expect(userTheme, isNotEmpty);

        // 7. Get comprehensive statistics
        final dbStats = await databaseService.getStats();
        final cardStats = await cardStorageService.getStorageStats();
        final syncStats = await syncQueueService.getQueueStats();
        final cacheStats = await cacheManagerService.getStats();
        final autoSaveStats = await autoSaveService.getStats();

        print('Integration Test Results:');
        print('- Database: $dbStats');
        print('- Cards: $cardStats');
        print('- Sync Queue: $syncStats');
        print('- Cache: $cacheStats');
        print('- Auto-save: $autoSaveStats');

        expect(dbStats.cardCount, greaterThan(0));
        expect(cardStats.totalCards, greaterThan(0));
        expect(cacheStats.totalEntries, greaterThan(0));
      });
    });
  });
}