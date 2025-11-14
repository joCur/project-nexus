import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../performance/performance_manager.dart';
import '../state/app_initialization_state.dart';

/// Performance monitoring dashboard for development/debugging
/// 
/// This provides real-time insights into app performance metrics:
/// - Launch time breakdown
/// - Initialization phase status
/// - Memory usage tracking
/// - Operation timing analysis
/// 
/// Usage: Add as overlay in development mode or as debug screen
class PerformanceDashboard extends ConsumerWidget {
  const PerformanceDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final initState = ref.watch(appInitializationProvider);
    final performanceManager = PerformanceManager();
    
    // TODO: Implement dashboard UI
    // This would include:
    // 1. Real-time performance metrics display
    // 2. Launch time breakdown visualization
    // 3. Memory usage charts
    // 4. Initialization status indicators
    // 5. Performance grading (A+ to F)
    // 6. Historical performance trends
    
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Performance Dashboard',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _buildInitializationStatus(initState),
            const SizedBox(height: 12),
            _buildPerformanceMetrics(performanceManager),
            const SizedBox(height: 12),
            _buildMemoryUsage(performanceManager),
          ],
        ),
      ),
    );
  }

  Widget _buildInitializationStatus(AppInitializationState state) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Initialization Status:'),
        const SizedBox(height: 8),
        Row(
          children: [
            _buildStatusIndicator('Hive', state.hive),
            const SizedBox(width: 16),
            _buildStatusIndicator('Router', state.router),
            const SizedBox(width: 16),
            _buildStatusIndicator('Services', state.services),
          ],
        ),
      ],
    );
  }

  Widget _buildStatusIndicator(String name, InitializationStatus status) {
    Color color;
    IconData icon;
    
    switch (status) {
      case InitializationStatus.completed:
        color = Colors.green;
        icon = Icons.check_circle;
        break;
      case InitializationStatus.inProgress:
        color = Colors.orange;
        icon = Icons.pending;
        break;
      case InitializationStatus.failed:
        color = Colors.red;
        icon = Icons.error;
        break;
      case InitializationStatus.pending:
        color = Colors.grey;
        icon = Icons.pending;
        break;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 16),
        const SizedBox(width: 4),
        Text(name, style: TextStyle(color: color, fontSize: 12)),
      ],
    );
  }

  Widget _buildPerformanceMetrics(PerformanceManager manager) {
    final totalTime = manager.totalLaunchTime;
    final firstFrameTime = manager.timeToFirstFrame;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Performance Metrics:'),
        const SizedBox(height: 8),
        if (totalTime != null)
          Text('Total Launch: ${totalTime}ms'),
        if (firstFrameTime != null)
          Text('First Frame: ${firstFrameTime}ms'),
        // TODO: Add more detailed metrics visualization
      ],
    );
  }

  Widget _buildMemoryUsage(PerformanceManager manager) {
    final memoryStats = manager.getMemoryStats();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Memory Usage:'),
        const SizedBox(height: 8),
        Text('Operation Entries: ${memoryStats['totalEntries']}'),
        Text('Start Times: ${memoryStats['operationStartTimes']}'),
        Text('Durations: ${memoryStats['operationDurations']}'),
        // TODO: Add memory usage visualization
      ],
    );
  }
}

/// Development-only overlay for performance monitoring
/// 
/// This can be used during development to monitor performance in real-time
/// without interfering with the main app UI
class PerformanceDashboardOverlay extends StatelessWidget {
  final Widget child;
  final bool enabled;

  const PerformanceDashboardOverlay({
    super.key,
    required this.child,
    this.enabled = false,
  });

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;

    return Stack(
      children: [
        child,
        Positioned(
          top: 50,
          right: 16,
          child: Container(
            width: 300,
            constraints: const BoxConstraints(maxHeight: 400),
            child: const PerformanceDashboard(),
          ),
        ),
      ],
    );
  }
}

/// Extension to easily enable performance dashboard in development
extension PerformanceDashboardExtension on Widget {
  Widget withPerformanceDashboard({bool enabled = false}) {
    return PerformanceDashboardOverlay(
      enabled: enabled,
      child: this,
    );
  }
}