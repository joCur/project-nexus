import 'dart:async';
import 'dart:developer' as dev;

/// Performance monitoring and timing utilities with automatic memory management
class PerformanceManager {
  static final PerformanceManager _instance = PerformanceManager._internal();
  factory PerformanceManager() => _instance;
  PerformanceManager._internal() {
    _schedulePeriodicCleanup();
  }

  final Map<String, DateTime> _operationStartTimes = {};
  final Map<String, int> _operationDurations = {};
  
  DateTime? _appLaunchStart;
  DateTime? _firstFrameTime;
  DateTime? _interactiveTime;
  
  Timer? _cleanupTimer;
  
  // Memory management configuration
  static const int maxOperationEntries = 100;
  static const Duration cleanupInterval = Duration(minutes: 5);

  /// Mark the start of app launch timing
  void markAppLaunchStart() {
    _appLaunchStart = DateTime.now();
    dev.log('🚀 App launch started', name: 'Performance');
  }

  /// Mark when first frame is rendered
  void markFirstFrame() {
    _firstFrameTime = DateTime.now();
    if (_appLaunchStart != null) {
      final duration = _firstFrameTime!.difference(_appLaunchStart!).inMilliseconds;
      dev.log('⚡ First frame rendered: ${duration}ms', name: 'Performance');
    }
  }

  /// Mark when app becomes fully interactive
  void markInteractive() {
    _interactiveTime = DateTime.now();
    if (_appLaunchStart != null) {
      final duration = _interactiveTime!.difference(_appLaunchStart!).inMilliseconds;
      dev.log('✅ App interactive: ${duration}ms', name: 'Performance');
      _logPerformanceSummary();
    }
  }

  /// Start timing a specific operation
  void startOperation(String operationName) {
    _operationStartTimes[operationName] = DateTime.now();
  }

  /// End timing a specific operation
  void endOperation(String operationName) {
    final startTime = _operationStartTimes[operationName];
    if (startTime != null) {
      final duration = DateTime.now().difference(startTime).inMilliseconds;
      _operationDurations[operationName] = duration;
      dev.log('⏱️  $operationName: ${duration}ms', name: 'Performance');
      _operationStartTimes.remove(operationName);
    }
  }

  /// Get the duration of a completed operation
  int? getOperationDuration(String operationName) {
    return _operationDurations[operationName];
  }

  /// Get total launch time
  int? get totalLaunchTime {
    if (_appLaunchStart != null && _interactiveTime != null) {
      return _interactiveTime!.difference(_appLaunchStart!).inMilliseconds;
    }
    return null;
  }

  /// Get time to first frame
  int? get timeToFirstFrame {
    if (_appLaunchStart != null && _firstFrameTime != null) {
      return _firstFrameTime!.difference(_appLaunchStart!).inMilliseconds;
    }
    return null;
  }

  /// Log comprehensive performance summary
  void _logPerformanceSummary() {
    final totalTime = totalLaunchTime;
    final firstFrame = timeToFirstFrame;
    
    if (totalTime == null) return;

    final targetMet = totalTime < 1000;
    final buffer = StringBuffer();
    
    buffer.writeln('=== PERFORMANCE SUMMARY ===');
    buffer.writeln('Total Launch Time: ${totalTime}ms');
    buffer.writeln('Target Met (< 1000ms): ${targetMet ? '✅ YES' : '❌ NO'}');
    
    if (firstFrame != null) {
      buffer.writeln('Time to First Frame: ${firstFrame}ms');
    }
    
    if (_operationDurations.isNotEmpty) {
      buffer.writeln('Individual Operations:');
      _operationDurations.forEach((name, duration) {
        final status = duration < 200 ? '✅' : duration < 500 ? '⚠️' : '❌';
        buffer.writeln('  $status $name: ${duration}ms');
      });
    }
    
    buffer.writeln('========================');
    dev.log(buffer.toString(), name: 'Performance');
  }

  /// Schedule periodic cleanup to prevent memory growth
  void _schedulePeriodicCleanup() {
    _cleanupTimer = Timer.periodic(cleanupInterval, (_) {
      _performPeriodicCleanup();
    });
  }

  /// Perform periodic cleanup of performance tracking data
  void _performPeriodicCleanup() {
    // Clean up old operation start times (orphaned operations)
    final now = DateTime.now();
    final staleThreshold = now.subtract(const Duration(minutes: 10));
    
    _operationStartTimes.removeWhere((key, startTime) {
      final isStale = startTime.isBefore(staleThreshold);
      if (isStale) {
        dev.log('🧹 Cleaned up stale operation: $key', name: 'Performance');
      }
      return isStale;
    });
    
    // Limit operation durations to prevent unbounded growth
    if (_operationDurations.length > maxOperationEntries) {
      final excess = _operationDurations.length - maxOperationEntries;
      final keysToRemove = _operationDurations.keys.take(excess).toList();
      
      for (final key in keysToRemove) {
        _operationDurations.remove(key);
      }
      
      dev.log('🧹 Cleaned up $excess old operation duration entries', name: 'Performance');
    }
  }

  /// Get current memory usage statistics
  Map<String, int> getMemoryStats() {
    return {
      'operationStartTimes': _operationStartTimes.length,
      'operationDurations': _operationDurations.length,
      'totalEntries': _operationStartTimes.length + _operationDurations.length,
    };
  }

  /// Reset all performance tracking and cleanup timer
  void reset() {
    _cleanupTimer?.cancel();
    _operationStartTimes.clear();
    _operationDurations.clear();
    _appLaunchStart = null;
    _firstFrameTime = null;
    _interactiveTime = null;
    _schedulePeriodicCleanup();
  }

  /// Dispose of the performance manager and cleanup resources
  void dispose() {
    _cleanupTimer?.cancel();
    _operationStartTimes.clear();
    _operationDurations.clear();
  }
}

/// Extension to easily time async operations
extension TimedOperation<T> on Future<T> {
  /// Time this future operation with a given name
  Future<T> timed(String operationName) async {
    final performance = PerformanceManager();
    performance.startOperation(operationName);
    try {
      final result = await this;
      performance.endOperation(operationName);
      return result;
    } catch (e) {
      performance.endOperation(operationName);
      rethrow;
    }
  }
}