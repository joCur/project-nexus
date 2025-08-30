import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import 'dart:developer' as dev;

import '../performance/performance_manager.dart';

/// Individual initialization states
enum InitializationStatus {
  pending,
  inProgress,
  completed,
  failed,
}

/// Overall app initialization state
class AppInitializationState {
  final InitializationStatus hive;
  final InitializationStatus router;
  final InitializationStatus services;
  final String? error;
  
  const AppInitializationState({
    this.hive = InitializationStatus.pending,
    this.router = InitializationStatus.pending,
    this.services = InitializationStatus.pending,
    this.error,
  });
  
  AppInitializationState copyWith({
    InitializationStatus? hive,
    InitializationStatus? router,
    InitializationStatus? services,
    String? error,
  }) {
    return AppInitializationState(
      hive: hive ?? this.hive,
      router: router ?? this.router,
      services: services ?? this.services,
      error: error ?? this.error,
    );
  }
  
  /// Check if critical components are initialized
  bool get isCriticalInitialized => 
      hive == InitializationStatus.completed &&
      router == InitializationStatus.completed;
  
  /// Check if all components are initialized
  bool get isFullyInitialized =>
      hive == InitializationStatus.completed &&
      router == InitializationStatus.completed &&
      services == InitializationStatus.completed;
  
  /// Check if any component has failed
  bool get hasFailures =>
      hive == InitializationStatus.failed ||
      router == InitializationStatus.failed ||
      services == InitializationStatus.failed;
}

/// State notifier for managing app initialization
class AppInitializationNotifier extends StateNotifier<AppInitializationState> {
  AppInitializationNotifier() : super(const AppInitializationState());
  
  /// Initialize Hive database
  Future<void> initializeHive() async {
    if (state.hive == InitializationStatus.completed) return;
    
    state = state.copyWith(hive: InitializationStatus.inProgress);
    
    try {
      await initHiveForFlutter().timed('hive_initialization');
      state = state.copyWith(hive: InitializationStatus.completed);
      dev.log('✅ Hive initialization completed', name: 'AppInitialization');
    } catch (error, stackTrace) {
      state = state.copyWith(
        hive: InitializationStatus.failed,
        error: 'Hive initialization failed: $error',
      );
      dev.log('❌ Hive initialization failed: $error', 
              name: 'AppInitialization',
              error: error,
              stackTrace: stackTrace);
      rethrow;
    }
  }
  
  /// Mark router as initialized
  void markRouterInitialized() {
    if (state.router != InitializationStatus.completed) {
      state = state.copyWith(router: InitializationStatus.completed);
      dev.log('✅ Router initialization completed', name: 'AppInitialization');
    }
  }
  
  /// Mark router initialization as starting
  void markRouterInitializing() {
    state = state.copyWith(router: InitializationStatus.inProgress);
    dev.log('⚡ Router initialization started', name: 'AppInitialization');
  }
  
  /// Mark services as initialized
  void markServicesInitialized() {
    if (state.services != InitializationStatus.completed) {
      state = state.copyWith(services: InitializationStatus.completed);
      dev.log('✅ Services initialization completed', name: 'AppInitialization');
    }
  }
  
  /// Mark services initialization as starting
  void markServicesInitializing() {
    state = state.copyWith(services: InitializationStatus.inProgress);
    dev.log('⚡ Services initialization started', name: 'AppInitialization');
  }
  
  /// Handle initialization failure for a specific component
  void markComponentFailed(String component, String error) {
    switch (component.toLowerCase()) {
      case 'hive':
        state = state.copyWith(
          hive: InitializationStatus.failed,
          error: error,
        );
        break;
      case 'router':
        state = state.copyWith(
          router: InitializationStatus.failed,
          error: error,
        );
        break;
      case 'services':
        state = state.copyWith(
          services: InitializationStatus.failed,
          error: error,
        );
        break;
    }
    dev.log('❌ $component initialization failed: $error', name: 'AppInitialization');
  }
  
  /// Reset initialization state (useful for testing)
  void reset() {
    state = const AppInitializationState();
    dev.log('🔄 App initialization state reset', name: 'AppInitialization');
  }
}

/// Provider for app initialization state
final appInitializationProvider = 
    StateNotifierProvider<AppInitializationNotifier, AppInitializationState>(
  (ref) => AppInitializationNotifier(),
);

/// Extension for timed operations that integrates with performance tracking
extension TimedOperation<T> on Future<T> {
  Future<T> timed(String operationName) async {
    final performance = PerformanceManager();
    performance.startOperation(operationName);
    try {
      final result = await this;
      performance.endOperation(operationName);
      return result;
    } catch (error) {
      performance.endOperation(operationName);
      rethrow;
    }
  }
}