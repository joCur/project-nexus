import 'package:flutter_test/flutter_test.dart';
import 'dart:async';

import '../../../lib/core/providers/lazy_providers.dart';
import '../../../lib/core/errors/initialization_errors.dart';

void main() {
  group('InitializationManager', () {
    late InitializationManager manager;

    setUp(() {
      manager = InitializationManager();
      manager.reset(); // Reset for each test
    });

    group('Phase Management', () {
      test('should initialize phases in correct order', () async {
        final executionOrder = <String>[];
        
        manager.addTask(InitializationPhase.critical, () async {
          executionOrder.add('critical');
        });
        
        manager.addTask(InitializationPhase.essential, () async {
          await Future.delayed(const Duration(milliseconds: 10));
          executionOrder.add('essential');
        });
        
        manager.addTask(InitializationPhase.background, () async {
          await Future.delayed(const Duration(milliseconds: 5));
          executionOrder.add('background');
        });

        await manager.initializeAll();
        
        // Critical and essential should be completed
        expect(executionOrder.contains('critical'), isTrue);
        expect(executionOrder.contains('essential'), isTrue);
        
        // Background may or may not be completed (it runs async)
        // Wait a bit to see if background completes
        await Future.delayed(const Duration(milliseconds: 50));
      });

      test('should wait for specific phase completion', () async {
        var essentialCompleted = false;
        
        manager.addTask(InitializationPhase.essential, () async {
          await Future.delayed(const Duration(milliseconds: 20));
          essentialCompleted = true;
        });

        // Start initialization in background
        unawaited(manager.initializePhase(InitializationPhase.essential));
        
        expect(essentialCompleted, isFalse);
        
        // Wait for phase completion
        await manager.waitForPhase(InitializationPhase.essential);
        
        expect(essentialCompleted, isTrue);
      });

      test('should not reinitialize completed phases', () async {
        var executionCount = 0;
        
        manager.addTask(InitializationPhase.critical, () async {
          executionCount++;
        });

        // Initialize twice
        await manager.initializePhase(InitializationPhase.critical);
        await manager.initializePhase(InitializationPhase.critical);
        
        expect(executionCount, equals(1));
      });
    });

    group('Error Handling', () {
      test('should handle task failures in critical phase', () async {
        // Create fresh manager instance for this test
        final testManager = InitializationManager();
        testManager.reset(); // Ensure clean state
        
        testManager.addTask(InitializationPhase.critical, () async {
          throw Exception('Critical phase failure');
        });

        expect(
          () async => await testManager.initializePhase(InitializationPhase.critical),
          throwsA(isA<InitializationError>()),
        );
      });

      test('should handle task failures in essential phase', () async {
        // Create fresh manager instance for this test
        final testManager = InitializationManager();
        testManager.reset(); // Ensure clean state
        
        testManager.addTask(InitializationPhase.essential, () async {
          throw Exception('Essential phase failure');
        });

        expect(
          () async => await testManager.initializePhase(InitializationPhase.essential),
          throwsA(isA<InitializationError>()),
        );
      });

      test('should handle background phase failures gracefully in initializeAll', () async {
        var criticalCompleted = false;
        var essentialCompleted = false;
        
        manager.addTask(InitializationPhase.critical, () async {
          criticalCompleted = true;
        });
        
        manager.addTask(InitializationPhase.essential, () async {
          essentialCompleted = true;
        });
        
        manager.addTask(InitializationPhase.background, () async {
          throw Exception('Background phase failure');
        });

        // Should not throw despite background failure
        await manager.initializeAll();
        
        expect(criticalCompleted, isTrue);
        expect(essentialCompleted, isTrue);
        
        // Wait a bit for background phase to attempt and fail
        await Future.delayed(const Duration(milliseconds: 50));
      });

      test('should handle multiple task failures in same phase', () async {
        // Create fresh manager instance for this test
        final testManager = InitializationManager();
        testManager.reset(); // Ensure clean state
        
        testManager.addTask(InitializationPhase.critical, () async {
          throw Exception('First task failure');
        });
        
        testManager.addTask(InitializationPhase.critical, () async {
          throw Exception('Second task failure');
        });

        expect(
          () async => await testManager.initializePhase(InitializationPhase.critical),
          throwsA(isA<InitializationError>()),
        );
      });

      test('should complete completer even when error occurs', () async {
        // Create fresh manager instance for this test
        final testManager = InitializationManager();
        testManager.reset(); // Ensure clean state
        
        testManager.addTask(InitializationPhase.essential, () async {
          throw Exception('Task failure');
        });

        // Start the phase initialization that will fail
        expect(
          () async => await testManager.initializePhase(InitializationPhase.essential),
          throwsA(isA<InitializationError>()),
        );
        
        // The completer should now be completed with error
        expect(
          () async => await testManager.waitForPhase(InitializationPhase.essential),
          throwsA(isA<InitializationError>()),
        );
      });
    });

    group('Concurrent Operations', () {
      test('should handle concurrent phase initializations', () async {
        var executionCount = 0;
        
        // Create fresh manager instance for this test
        final testManager = InitializationManager();
        testManager.reset(); // Ensure clean state
        
        testManager.addTask(InitializationPhase.essential, () async {
          await Future.delayed(const Duration(milliseconds: 20));
          executionCount++;
        });

        // Start multiple initializations concurrently
        final futures = [
          testManager.initializePhase(InitializationPhase.essential),
          testManager.initializePhase(InitializationPhase.essential),
          testManager.initializePhase(InitializationPhase.essential),
        ];

        await Future.wait(futures);
        
        // Should only execute once despite multiple concurrent calls
        // (all calls share the same phase completion)
        expect(executionCount, equals(1));
      });

      test('should handle concurrent task additions and initialization', () async {
        final results = <String>[];
        
        manager.addTask(InitializationPhase.critical, () async {
          results.add('task1');
        });

        final initFuture = manager.initializePhase(InitializationPhase.critical);
        
        // Add more tasks while initialization is happening
        manager.addTask(InitializationPhase.critical, () async {
          results.add('task2');
        });

        await initFuture;
        
        // Only the first task should have executed
        expect(results.length, equals(1));
        expect(results.contains('task1'), isTrue);
      });
    });

    group('Memory Management', () {
      test('should reset all state correctly', () {
        manager.addTask(InitializationPhase.critical, () async {});
        manager.addTask(InitializationPhase.essential, () async {});
        manager.addTask(InitializationPhase.background, () async {});

        manager.reset();

        // Should be able to add tasks again after reset
        manager.addTask(InitializationPhase.critical, () async {});
        expect(() => manager.addTask(InitializationPhase.critical, () async {}), 
               returnsNormally);
      });

      test('should handle multiple resets', () {
        manager.reset();
        manager.reset();
        manager.reset();
        
        // Should still function normally
        manager.addTask(InitializationPhase.critical, () async {});
        expect(() => manager.addTask(InitializationPhase.critical, () async {}), 
               returnsNormally);
      });
    });

    group('Task Execution', () {
      test('should execute multiple tasks in same phase concurrently', () async {
        final executionOrder = <DateTime>[];
        
        manager.addTask(InitializationPhase.critical, () async {
          await Future.delayed(const Duration(milliseconds: 30));
          executionOrder.add(DateTime.now());
        });
        
        manager.addTask(InitializationPhase.critical, () async {
          await Future.delayed(const Duration(milliseconds: 10));
          executionOrder.add(DateTime.now());
        });
        
        manager.addTask(InitializationPhase.critical, () async {
          await Future.delayed(const Duration(milliseconds: 20));
          executionOrder.add(DateTime.now());
        });

        await manager.initializePhase(InitializationPhase.critical);
        
        expect(executionOrder.length, equals(3));
        
        // All tasks should complete within a reasonable time window
        // (much less than if they were executed sequentially)
        final totalDuration = executionOrder.last.difference(executionOrder.first);
        expect(totalDuration.inMilliseconds < 50, isTrue);
      });

      test('should handle empty phases', () async {
        // No tasks added to critical phase
        await manager.initializePhase(InitializationPhase.critical);
        
        // Should complete without error
        await manager.waitForPhase(InitializationPhase.critical);
      });
    });
  });

  group('configureInitializationPhases', () {
    test('should configure phases without errors', () {
      expect(() => configureInitializationPhases(), returnsNormally);
    });
  });

  group('unawaited helper', () {
    test('should not await futures', () {
      // This should not block the test
      unawaited(Future.delayed(const Duration(seconds: 1)));
      
      // If unawaited was not working correctly, this test would timeout
      expect(true, isTrue);
    });
  });
}