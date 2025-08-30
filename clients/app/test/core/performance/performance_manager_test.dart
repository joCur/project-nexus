import 'package:flutter_test/flutter_test.dart';
import 'dart:async';

import '../../../lib/core/performance/performance_manager.dart';

void main() {
  group('PerformanceManager', () {
    late PerformanceManager performanceManager;

    setUp(() {
      performanceManager = PerformanceManager();
      performanceManager.reset(); // Reset for each test
    });

    tearDown(() {
      performanceManager.dispose(); // Clean up after each test
    });

    group('Launch Time Tracking', () {
      test('should track app launch timing correctly', () {
        // Mark app launch start
        performanceManager.markAppLaunchStart();
        expect(performanceManager.totalLaunchTime, isNull);
        expect(performanceManager.timeToFirstFrame, isNull);

        // Mark first frame
        performanceManager.markFirstFrame();
        expect(performanceManager.timeToFirstFrame, isNotNull);
        expect(performanceManager.timeToFirstFrame! >= 0, isTrue);
        expect(performanceManager.totalLaunchTime, isNull);

        // Mark interactive
        performanceManager.markInteractive();
        expect(performanceManager.totalLaunchTime, isNotNull);
        expect(performanceManager.totalLaunchTime! >= 0, isTrue);
        expect(performanceManager.totalLaunchTime! >= performanceManager.timeToFirstFrame!, isTrue);
      });

      test('should handle marking times out of order gracefully', () {
        // Mark interactive before first frame
        performanceManager.markInteractive();
        expect(performanceManager.totalLaunchTime, isNull);

        // Mark launch start
        performanceManager.markAppLaunchStart();
        
        // Mark first frame
        performanceManager.markFirstFrame();
        expect(performanceManager.timeToFirstFrame, isNotNull);
        expect(performanceManager.timeToFirstFrame! >= 0, isTrue);
      });
    });

    group('Operation Timing', () {
      test('should track individual operations correctly', () {
        const operationName = 'test_operation';
        
        // Start operation
        performanceManager.startOperation(operationName);
        expect(performanceManager.getOperationDuration(operationName), isNull);

        // End operation
        performanceManager.endOperation(operationName);
        final duration = performanceManager.getOperationDuration(operationName);
        
        expect(duration, isNotNull);
        expect(duration! >= 0, isTrue);
      });

      test('should handle multiple concurrent operations', () {
        const operations = ['op1', 'op2', 'op3'];
        
        // Start all operations
        for (final op in operations) {
          performanceManager.startOperation(op);
        }

        // End operations in different order
        performanceManager.endOperation('op2');
        performanceManager.endOperation('op1');
        performanceManager.endOperation('op3');

        // All should have durations
        for (final op in operations) {
          final duration = performanceManager.getOperationDuration(op);
          expect(duration, isNotNull);
          expect(duration! >= 0, isTrue);
        }
      });

      test('should handle ending non-existent operation gracefully', () {
        performanceManager.endOperation('non_existent_operation');
        expect(performanceManager.getOperationDuration('non_existent_operation'), isNull);
      });
    });

    group('Memory Management', () {
      test('should provide memory statistics', () {
        performanceManager.startOperation('test_op');
        performanceManager.endOperation('test_op');

        final stats = performanceManager.getMemoryStats();
        expect(stats, isA<Map<String, int>>());
        expect(stats.containsKey('operationStartTimes'), isTrue);
        expect(stats.containsKey('operationDurations'), isTrue);
        expect(stats.containsKey('totalEntries'), isTrue);
        expect(stats['operationDurations'], equals(1));
      });

      test('should reset all tracking data', () {
        // Add some tracking data
        performanceManager.markAppLaunchStart();
        performanceManager.startOperation('test_op');
        performanceManager.endOperation('test_op');
        performanceManager.markFirstFrame();
        performanceManager.markInteractive();

        expect(performanceManager.totalLaunchTime, isNotNull);
        expect(performanceManager.getOperationDuration('test_op'), isNotNull);

        // Reset
        performanceManager.reset();

        expect(performanceManager.totalLaunchTime, isNull);
        expect(performanceManager.timeToFirstFrame, isNull);
        expect(performanceManager.getOperationDuration('test_op'), isNull);
        
        final stats = performanceManager.getMemoryStats();
        expect(stats['totalEntries'], equals(0));
      });

      test('should handle disposal correctly', () {
        performanceManager.startOperation('test_op');
        expect(performanceManager.getMemoryStats()['totalEntries'], equals(1));

        performanceManager.dispose();
        expect(performanceManager.getMemoryStats()['totalEntries'], equals(0));
      });
    });

    group('.timed() Extension', () {
      test('should time async operations correctly', () async {
        Future<String> slowOperation() async {
          await Future.delayed(const Duration(milliseconds: 10));
          return 'completed';
        }

        final result = await slowOperation().timed('slow_operation');
        
        expect(result, equals('completed'));
        final duration = performanceManager.getOperationDuration('slow_operation');
        expect(duration, isNotNull);
        expect(duration! >= 10, isTrue); // Should be at least 10ms
      });

      test('should handle operation failures correctly', () async {
        Future<String> failingOperation() async {
          await Future.delayed(const Duration(milliseconds: 5));
          throw Exception('Test error');
        }

        expect(
          () async => await failingOperation().timed('failing_operation'),
          throwsException,
        );
        
        // Should still record the duration even if operation failed
        final duration = performanceManager.getOperationDuration('failing_operation');
        expect(duration, isNotNull);
        expect(duration! >= 5, isTrue);
      });
    });

    group('Error Handling', () {
      test('should handle null values gracefully', () {
        expect(performanceManager.totalLaunchTime, isNull);
        expect(performanceManager.timeToFirstFrame, isNull);
        expect(performanceManager.getOperationDuration('non_existent'), isNull);
      });

      test('should not crash on multiple resets', () {
        performanceManager.reset();
        performanceManager.reset();
        performanceManager.reset();
        
        expect(performanceManager.getMemoryStats()['totalEntries'], equals(0));
      });

      test('should not crash on multiple disposes', () {
        performanceManager.dispose();
        performanceManager.dispose();
        
        expect(performanceManager.getMemoryStats()['totalEntries'], equals(0));
      });
    });

    group('Performance Validation', () {
      test('should validate sub-1 second target in summary', () {
        performanceManager.markAppLaunchStart();
        
        // Simulate very fast launch
        performanceManager.markFirstFrame();
        performanceManager.markInteractive();
        
        final totalTime = performanceManager.totalLaunchTime;
        expect(totalTime, isNotNull);
        
        // Should meet sub-1 second target for this test
        expect(totalTime! < 1000, isTrue);
      });
    });
  });
}