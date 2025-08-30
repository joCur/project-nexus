import 'package:flutter/foundation.dart';

import '../providers/lazy_providers.dart';

/// Base class for initialization-related errors
abstract class InitializationError extends Error {
  final String message;
  final InitializationPhase phase;
  final Object? originalError;
  final StackTrace? originalStackTrace;

  InitializationError({
    required this.message,
    required this.phase,
    this.originalError,
    this.originalStackTrace,
  });

  @override
  String toString() {
    final buffer = StringBuffer();
    buffer.write('${runtimeType}: $message');
    buffer.write(' (Phase: ${phase.name})');
    
    if (originalError != null) {
      buffer.write('\nCaused by: $originalError');
    }
    
    if (originalStackTrace != null && kDebugMode) {
      buffer.write('\nOriginal stack trace:\n$originalStackTrace');
    }
    
    return buffer.toString();
  }
}

/// Error thrown when a critical initialization phase fails
class CriticalInitializationError extends InitializationError {
  CriticalInitializationError({
    required String message,
    Object? originalError,
    StackTrace? originalStackTrace,
  }) : super(
          message: message,
          phase: InitializationPhase.critical,
          originalError: originalError,
          originalStackTrace: originalStackTrace,
        );
}

/// Error thrown when an essential initialization phase fails
class EssentialInitializationError extends InitializationError {
  EssentialInitializationError({
    required String message,
    Object? originalError,
    StackTrace? originalStackTrace,
  }) : super(
          message: message,
          phase: InitializationPhase.essential,
          originalError: originalError,
          originalStackTrace: originalStackTrace,
        );
}

/// Error thrown when a background initialization phase fails
/// This is typically non-fatal and should not prevent app functionality
class BackgroundInitializationError extends InitializationError {
  BackgroundInitializationError({
    required String message,
    Object? originalError,
    StackTrace? originalStackTrace,
  }) : super(
          message: message,
          phase: InitializationPhase.background,
          originalError: originalError,
          originalStackTrace: originalStackTrace,
        );
}

/// Error thrown when task execution fails within an initialization phase
class TaskExecutionError extends InitializationError {
  final String taskName;
  final int taskIndex;
  final int totalTasks;

  TaskExecutionError({
    required this.taskName,
    required this.taskIndex,
    required this.totalTasks,
    required InitializationPhase phase,
    required String message,
    Object? originalError,
    StackTrace? originalStackTrace,
  }) : super(
          message: message,
          phase: phase,
          originalError: originalError,
          originalStackTrace: originalStackTrace,
        );

  @override
  String toString() {
    final buffer = StringBuffer();
    buffer.write('TaskExecutionError: Task "$taskName" failed ');
    buffer.write('(${taskIndex + 1}/$totalTasks in ${phase.name} phase)');
    buffer.write('\n$message');
    
    if (originalError != null) {
      buffer.write('\nCaused by: $originalError');
    }
    
    if (originalStackTrace != null && kDebugMode) {
      buffer.write('\nOriginal stack trace:\n$originalStackTrace');
    }
    
    return buffer.toString();
  }
}

/// Error thrown when initialization times out
class InitializationTimeoutError extends InitializationError {
  final Duration timeout;
  final Duration elapsed;

  InitializationTimeoutError({
    required InitializationPhase phase,
    required this.timeout,
    required this.elapsed,
  }) : super(
          message: 'Initialization timed out after ${elapsed.inMilliseconds}ms '
                  '(timeout: ${timeout.inMilliseconds}ms)',
          phase: phase,
        );
}

/// Error thrown when dependencies are not met for initialization
class DependencyError extends InitializationError {
  final List<String> missingDependencies;
  final String dependentService;

  DependencyError({
    required this.dependentService,
    required this.missingDependencies,
    required InitializationPhase phase,
  }) : super(
          message: '$dependentService requires dependencies: ${missingDependencies.join(", ")}',
          phase: phase,
        );
}

/// Utility class for wrapping and categorizing initialization errors
class InitializationErrorHandler {
  /// Wrap a generic error into an appropriate InitializationError
  static InitializationError wrapError({
    required Object error,
    required StackTrace stackTrace,
    required InitializationPhase phase,
    String? taskName,
    int? taskIndex,
    int? totalTasks,
  }) {
    final message = error.toString();
    
    // If it's already an InitializationError, return as-is
    if (error is InitializationError) {
      return error;
    }
    
    // If we have task details, create a TaskExecutionError
    if (taskName != null && taskIndex != null && totalTasks != null) {
      return TaskExecutionError(
        taskName: taskName,
        taskIndex: taskIndex,
        totalTasks: totalTasks,
        phase: phase,
        message: message,
        originalError: error,
        originalStackTrace: stackTrace,
      );
    }
    
    // Create phase-appropriate error
    switch (phase) {
      case InitializationPhase.critical:
        return CriticalInitializationError(
          message: message,
          originalError: error,
          originalStackTrace: stackTrace,
        );
      case InitializationPhase.essential:
        return EssentialInitializationError(
          message: message,
          originalError: error,
          originalStackTrace: stackTrace,
        );
      case InitializationPhase.background:
        return BackgroundInitializationError(
          message: message,
          originalError: error,
          originalStackTrace: stackTrace,
        );
    }
  }

  /// Check if an error is recoverable (app can continue functioning)
  static bool isRecoverable(InitializationError error) {
    return error is BackgroundInitializationError;
  }

  /// Get appropriate log level for an error
  static String getLogLevel(InitializationError error) {
    if (error is CriticalInitializationError) {
      return 'CRITICAL';
    } else if (error is EssentialInitializationError) {
      return 'ERROR';
    } else if (error is BackgroundInitializationError) {
      return 'WARNING';
    } else {
      return 'ERROR';
    }
  }

  /// Format error for logging
  static String formatForLogging(InitializationError error) {
    final level = getLogLevel(error);
    final recoverable = isRecoverable(error) ? '[RECOVERABLE]' : '[FATAL]';
    
    return '[$level] $recoverable Initialization failure in ${error.phase.name} phase: ${error.message}';
  }
}