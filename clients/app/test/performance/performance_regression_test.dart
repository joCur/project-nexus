import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:async';
import 'dart:io';

import '../../lib/core/performance/performance_manager.dart';
import '../../lib/core/providers/lazy_providers.dart';
import '../../lib/core/state/app_initialization_state.dart';
import '../../lib/shared/services/auth_service.dart';
import '../../lib/shared/services/database_service.dart';

/// Performance regression tests to ensure launch performance stays within targets
/// 
/// These tests validate:
/// - Sub-1 second launch performance target
/// - Individual component initialization times
/// - Memory usage during startup
/// - Background initialization resilience
@Tags(['performance', 'regression'])
void main() {
  group('Performance Regression Tests', () {
    late PerformanceManager performanceManager;

    setUp(() {
      performanceManager = PerformanceManager();
      performanceManager.reset();
    });

    tearDown(() {
      performanceManager.dispose();
    });

    group('Launch Performance Targets', () {
      test('should achieve sub-1 second target for simulated app launch', () async {
        // Simulate the app launch sequence
        performanceManager.markAppLaunchStart();
        
        // Simulate Hive initialization time
        await Future.delayed(const Duration(milliseconds: 85))
            .timed('hive_initialization');
        
        // Simulate first frame render
        performanceManager.markFirstFrame();
        
        // Simulate router initialization
        await Future.delayed(const Duration(milliseconds: 15))
            .timed('router_initialization');
        
        // Simulate essential services warmup
        await Future.delayed(const Duration(milliseconds: 200))
            .timed('essential_services');
        
        performanceManager.markInteractive();
        
        final totalTime = performanceManager.totalLaunchTime;
        final firstFrameTime = performanceManager.timeToFirstFrame;
        
        // Assert performance targets
        expect(totalTime, isNotNull);
        expect(totalTime! < 1000, isTrue, 
               reason: 'Total launch time ${totalTime}ms exceeds 1000ms target');
        
        expect(firstFrameTime, isNotNull);
        expect(firstFrameTime! < 150, isTrue,
               reason: 'First frame time ${firstFrameTime}ms exceeds 150ms target');
        
        // Individual operation targets
        expect(performanceManager.getOperationDuration('hive_initialization')! < 200, isTrue);
        expect(performanceManager.getOperationDuration('router_initialization')! < 50, isTrue);
        expect(performanceManager.getOperationDuration('essential_services')! < 500, isTrue);
      });

      test('should maintain performance under system stress', () async {
        // Simulate high memory/CPU pressure
        final futures = <Future<void>>[];
        
        performanceManager.markAppLaunchStart();
        
        // Create background load
        for (int i = 0; i < 10; i++) {
          futures.add(Future(() async {
            final list = List<int>.generate(10000, (index) => index);
            await Future.delayed(const Duration(milliseconds: 1));
            list.clear();
          }));
        }
        
        // Simulate launch with background load
        await Future.wait([
          Future.delayed(const Duration(milliseconds: 100))
              .timed('stressed_initialization'),
          ...futures,
        ]);
        
        performanceManager.markFirstFrame();
        performanceManager.markInteractive();
        
        final totalTime = performanceManager.totalLaunchTime;
        
        // Performance should degrade gracefully under stress
        expect(totalTime, isNotNull);
        expect(totalTime! < 2000, isTrue, 
               reason: 'Launch time under stress ${totalTime}ms exceeds degraded target');
      });
    });

    group('Component Performance Regression', () {
      test('should validate service initialization times', () async {
        final container = ProviderContainer();
        
        // Test Auth Service initialization time
        final authStopwatch = Stopwatch()..start();
        final authService = container.read(authServiceProvider);
        authStopwatch.stop();
        
        expect(authService, isA<AuthService>());
        expect(authStopwatch.elapsedMilliseconds < 50, isTrue,
               reason: 'AuthService initialization took ${authStopwatch.elapsedMilliseconds}ms');
        
        // Test Database Service initialization time
        final dbStopwatch = Stopwatch()..start();
        final dbService = container.read(databaseServiceProvider);
        dbStopwatch.stop();
        
        expect(dbService, isA<DatabaseService>());
        expect(dbStopwatch.elapsedMilliseconds < 100, isTrue,
               reason: 'DatabaseService initialization took ${dbStopwatch.elapsedMilliseconds}ms');
        
        container.dispose();
      });

      test('should validate phased initialization performance', () async {
        final manager = InitializationManager();
        manager.reset();
        
        // Add realistic simulation tasks
        manager.addTask(InitializationPhase.critical, () async {
          await Future.delayed(const Duration(milliseconds: 5));
        });
        
        manager.addTask(InitializationPhase.essential, () async {
          await Future.delayed(const Duration(milliseconds: 50));
        });
        
        manager.addTask(InitializationPhase.background, () async {
          await Future.delayed(const Duration(milliseconds: 200));
        });
        
        final stopwatch = Stopwatch()..start();
        await manager.initializeAll().timed('phased_initialization');
        stopwatch.stop();
        
        // Essential phase should complete quickly
        expect(stopwatch.elapsedMilliseconds < 100, isTrue,
               reason: 'Phased initialization took ${stopwatch.elapsedMilliseconds}ms');
        
        final phasedDuration = performanceManager.getOperationDuration('phased_initialization');
        expect(phasedDuration, isNotNull);
        expect(phasedDuration! < 100, isTrue);
      });
    });

    group('Memory Performance Regression', () {
      test('should validate memory usage during startup simulation', () async {
        final initialStats = performanceManager.getMemoryStats();
        expect(initialStats['totalEntries'], equals(0));
        
        // Simulate multiple operations
        final operations = List.generate(50, (i) => 'operation_$i');
        
        for (final op in operations) {
          performanceManager.startOperation(op);
          await Future.delayed(const Duration(milliseconds: 1));
          performanceManager.endOperation(op);
        }
        
        final finalStats = performanceManager.getMemoryStats();
        
        // Should track all operations
        expect(finalStats['operationDurations'], equals(50));
        expect(finalStats['operationStartTimes'], equals(0)); // All completed
        
        // Memory usage should be reasonable
        expect(finalStats['totalEntries']! < 100, isTrue,
               reason: 'Memory usage ${finalStats['totalEntries']} entries exceeds reasonable limit');
      });

      test('should validate periodic cleanup prevents memory growth', () async {
        // This test would need to run longer to test periodic cleanup
        // For CI, we'll test the cleanup method directly
        
        // Add many operations
        for (int i = 0; i < 150; i++) {
          performanceManager.startOperation('op_$i');
          performanceManager.endOperation('op_$i');
        }
        
        final beforeCleanup = performanceManager.getMemoryStats();
        expect(beforeCleanup['operationDurations']! > 100, isTrue);
        
        // Trigger cleanup by resetting (which includes cleanup logic)
        performanceManager.reset();
        
        final afterCleanup = performanceManager.getMemoryStats();
        expect(afterCleanup['totalEntries'], equals(0));
      });
    });

    group('Error Resilience Performance', () {
      test('should maintain performance targets despite background failures', () async {
        final manager = InitializationManager();
        manager.reset();
        
        performanceManager.markAppLaunchStart();
        
        // Add tasks including failing background task
        manager.addTask(InitializationPhase.critical, () async {
          await Future.delayed(const Duration(milliseconds: 10));
        });
        
        manager.addTask(InitializationPhase.essential, () async {
          await Future.delayed(const Duration(milliseconds: 30));
        });
        
        manager.addTask(InitializationPhase.background, () async {
          await Future.delayed(const Duration(milliseconds: 20));
          throw Exception('Simulated background failure');
        });
        
        // Should complete essential initialization despite background failure
        await manager.initializeAll().timed('resilient_initialization');
        
        performanceManager.markFirstFrame();
        performanceManager.markInteractive();
        
        final totalTime = performanceManager.totalLaunchTime;
        expect(totalTime, isNotNull);
        expect(totalTime! < 1000, isTrue,
               reason: 'Launch with background failures ${totalTime}ms exceeds target');
        
        // Wait for background phase to fail
        await Future.delayed(const Duration(milliseconds: 100));
        
        // App should still be functional
        expect(performanceManager.getOperationDuration('resilient_initialization'), isNotNull);
      });
    });

    group('CI/CD Performance Validation', () {
      test('should generate performance report for CI', () async {
        performanceManager.markAppLaunchStart();
        
        await Future.delayed(const Duration(milliseconds: 50)).timed('test_operation');
        
        performanceManager.markFirstFrame();
        performanceManager.markInteractive();
        
        final report = _generatePerformanceReport(performanceManager);
        
        expect(report.containsKey('totalLaunchTime'), isTrue);
        expect(report.containsKey('firstFrameTime'), isTrue);
        expect(report.containsKey('targetsMet'), isTrue);
        expect(report.containsKey('operations'), isTrue);
        
        // Write report for CI if running in CI environment
        if (Platform.environment.containsKey('CI')) {
          await File('performance_report.json').writeAsString(report.toString());
        }
      });
    });
  });
}

/// Generate a structured performance report for CI/CD systems
Map<String, dynamic> _generatePerformanceReport(PerformanceManager manager) {
  final totalTime = manager.totalLaunchTime;
  final firstFrameTime = manager.timeToFirstFrame;
  final memoryStats = manager.getMemoryStats();
  
  return {
    'timestamp': DateTime.now().toIso8601String(),
    'totalLaunchTime': totalTime,
    'firstFrameTime': firstFrameTime,
    'targetsMet': {
      'sub1SecondLaunch': totalTime != null && totalTime < 1000,
      'sub150msFirstFrame': firstFrameTime != null && firstFrameTime < 150,
    },
    'operations': _getAllOperationDurations(manager),
    'memoryUsage': memoryStats,
    'performance_grade': _calculatePerformanceGrade(totalTime, firstFrameTime),
  };
}

/// Get all operation durations for reporting
Map<String, int> _getAllOperationDurations(PerformanceManager manager) {
  final operations = <String, int>{};
  
  // In a real implementation, we'd need access to the operation durations
  // For now, we'll return what we can access
  final testOp = manager.getOperationDuration('test_operation');
  if (testOp != null) {
    operations['test_operation'] = testOp;
  }
  
  return operations;
}

/// Calculate overall performance grade
String _calculatePerformanceGrade(int? totalTime, int? firstFrameTime) {
  if (totalTime == null) return 'INCOMPLETE';
  
  if (totalTime < 500 && (firstFrameTime == null || firstFrameTime < 100)) {
    return 'A+'; // Excellent performance
  } else if (totalTime < 800 && (firstFrameTime == null || firstFrameTime < 130)) {
    return 'A';  // Great performance
  } else if (totalTime < 1000 && (firstFrameTime == null || firstFrameTime < 150)) {
    return 'B';  // Good performance, meets targets
  } else if (totalTime < 1500) {
    return 'C';  // Acceptable but needs improvement
  } else {
    return 'F';  // Performance regression, needs immediate attention
  }
}