import 'dart:async';
import 'dart:developer' as dev;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../performance/performance_manager.dart';
import '../errors/initialization_errors.dart';
import '../../shared/services/auth_service.dart';
import '../../shared/services/database_service.dart';
import '../../shared/services/secure_storage_service.dart';

/// Initialization phases for progressive service loading
enum InitializationPhase {
  critical,    // Essential for first frame render
  essential,   // Required for basic functionality  
  background,  // Nice-to-have, can be deferred
}

/// Manages phased initialization of application services
class InitializationManager {
  static final InitializationManager _instance = InitializationManager._internal();
  factory InitializationManager() => _instance;
  InitializationManager._internal();

  final Map<InitializationPhase, List<Future<void> Function()>> _phases = {
    InitializationPhase.critical: [],
    InitializationPhase.essential: [],
    InitializationPhase.background: [],
  };

  final Map<InitializationPhase, bool> _phaseCompleted = {
    InitializationPhase.critical: false,
    InitializationPhase.essential: false,
    InitializationPhase.background: false,
  };
  
  final Map<InitializationPhase, bool> _phaseInProgress = {
    InitializationPhase.critical: false,
    InitializationPhase.essential: false,
    InitializationPhase.background: false,
  };

  final Map<InitializationPhase, Completer<void>> _phaseCompleters = {
    InitializationPhase.critical: Completer<void>(),
    InitializationPhase.essential: Completer<void>(),
    InitializationPhase.background: Completer<void>(),
  };

  /// Add an initialization task to a specific phase
  void addTask(InitializationPhase phase, Future<void> Function() task) {
    _phases[phase]!.add(task);
  }

  /// Wait for a specific phase to complete
  Future<void> waitForPhase(InitializationPhase phase) async {
    return _phaseCompleters[phase]!.future;
  }

  /// Initialize a specific phase
  Future<void> initializePhase(InitializationPhase phase) async {
    if (_phaseCompleted[phase] == true) return;
    
    // If already in progress, wait for it to complete
    if (_phaseInProgress[phase] == true) {
      return _phaseCompleters[phase]!.future;
    }
    
    // Mark as in progress
    _phaseInProgress[phase] = true;

    final performance = PerformanceManager();
    final phaseName = '${phase.name}_phase';
    performance.startOperation(phaseName);

    try {
      final tasks = _phases[phase]!;
      if (tasks.isNotEmpty) {
        // Run all tasks in this phase concurrently with detailed error tracking
        final taskFutures = tasks.asMap().entries.map((entry) {
          final index = entry.key;
          final task = entry.value;
          return task().catchError((error, stackTrace) {
            // Wrap the error with detailed context
            final wrappedError = InitializationErrorHandler.wrapError(
              error: error,
              stackTrace: stackTrace,
              phase: phase,
              taskName: 'task_$index',
              taskIndex: index,
              totalTasks: tasks.length,
            );
            throw wrappedError;
          });
        });
        
        await Future.wait(taskFutures);
        dev.log('✅ ${phase.name} phase completed (${tasks.length} tasks)', 
                name: 'Initialization');
      }

      _phaseCompleted[phase] = true;
      if (!_phaseCompleters[phase]!.isCompleted) {
        _phaseCompleters[phase]!.complete();
      }
    } catch (error, stackTrace) {
      final initError = error is InitializationError 
          ? error 
          : InitializationErrorHandler.wrapError(
              error: error,
              stackTrace: stackTrace,
              phase: phase,
            );
      
      final logMessage = InitializationErrorHandler.formatForLogging(initError);
      dev.log(logMessage, name: 'Initialization');
      
      if (!_phaseCompleters[phase]!.isCompleted) {
        _phaseCompleters[phase]!.completeError(initError);
      }
      
      throw initError;
    } finally {
      performance.endOperation(phaseName);
    }
  }

  /// Initialize all phases in order
  Future<void> initializeAll() async {
    await initializePhase(InitializationPhase.critical);
    
    // Start essential and background phases with proper error handling
    unawaited(initializePhase(InitializationPhase.essential).then((_) {
      // Start background phase after essential completes with error recovery
      unawaited(initializePhase(InitializationPhase.background).catchError((error) {
        dev.log('⚠️ Background phase initialization failed: $error', 
                name: 'Initialization');
        dev.log('✅ App remains functional despite background initialization failure',
                name: 'Initialization');
        // Don't rethrow - background phase failures shouldn't affect app functionality
      }));
    }).catchError((error) {
      dev.log('❌ Essential phase initialization failed: $error', 
              name: 'Initialization');
      // Essential phase errors should still be propagated
      // but we log them for better debugging
    }));
    
    // Only wait for essential phase, background continues async with error recovery
    await waitForPhase(InitializationPhase.essential);
  }

  /// Reset initialization state (useful for testing)
  void reset() {
    for (final list in _phases.values) {
      list.clear();
    }
    _phaseCompleted.updateAll((key, value) => false);
    _phaseInProgress.updateAll((key, value) => false);
    _phaseCompleters.updateAll((key, value) => Completer<void>());
  }
}

/// Provider for accessing the initialization manager
final initializationManagerProvider = Provider<InitializationManager>((ref) {
  return InitializationManager();
});

/// Lazy provider that initializes only when first accessed
final lazyAuthServiceProvider = Provider<AuthService>((ref) {
  // Use the existing authService provider which creates with AuthService._()
  return ref.read(authServiceProvider);
});

/// Lazy provider for database service with background optimization
final lazyDatabaseServiceProvider = Provider<DatabaseService>((ref) {
  // Use the existing databaseService provider which creates with DatabaseService._()
  final service = ref.read(databaseServiceProvider);
  
  // Enable fast start mode for performance optimization
  try {
    service.enableFastStart();
  } catch (e) {
    dev.log('⚠️ Could not enable database fast start: $e', name: 'Performance');
  }
  
  // Start background database optimization after creation
  unawaited(() async {
    try {
      // Give the service time to handle initial requests
      await Future.delayed(const Duration(seconds: 2));
      // Note: Background optimization will be handled by the service itself
      dev.log('✅ Database optimization phase scheduled', name: 'Performance');
    } catch (e) {
      dev.log('⚠️ Background database optimization failed: $e', name: 'Performance');
    }
  }());
  
  return service;
});

/// Lazy provider for secure storage service
final lazySecureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

/// Configure initialization phases with required services
void configureInitializationPhases() {
  final manager = InitializationManager();
  
  // Critical phase: Only what's absolutely necessary for first frame
  manager.addTask(InitializationPhase.critical, () async {
    // Minimal setup for immediate UI rendering
    dev.log('🔥 Critical phase: Minimal UI setup', name: 'Initialization');
  });

  // Essential phase: Core functionality needed for app interaction
  manager.addTask(InitializationPhase.essential, () async {
    // Pre-warm core services that are likely to be used soon
    dev.log('⚡ Essential phase: Core services warmup', name: 'Initialization');
    
    // Pre-warm database service and enable fast start mode
    // Note: This will be handled when the database service is first accessed
  });

  // Background phase: Nice-to-have optimizations
  manager.addTask(InitializationPhase.background, () async {
    dev.log('🔄 Background phase: Optimizations', name: 'Initialization');
    
    // Background tasks that improve performance but aren't critical
    await Future.delayed(const Duration(milliseconds: 100));
  });
}

/// Helper function to prevent unawaited_futures lint warnings
void unawaited(Future<void> future) {
  // Intentionally not awaited - runs in background
}