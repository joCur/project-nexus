import 'dart:async';
import 'dart:developer' as dev;

/// Performance monitoring and timing utilities
class PerformanceManager {
  static final PerformanceManager _instance = PerformanceManager._internal();
  factory PerformanceManager() => _instance;
  PerformanceManager._internal();

  final Map<String, DateTime> _operationStartTimes = {};
  final Map<String, int> _operationDurations = {};
  
  DateTime? _appLaunchStart;
  DateTime? _firstFrameTime;
  DateTime? _interactiveTime;

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

  /// Reset all performance tracking
  void reset() {
    _operationStartTimes.clear();
    _operationDurations.clear();
    _appLaunchStart = null;
    _firstFrameTime = null;
    _interactiveTime = null;
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