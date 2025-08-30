import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import 'core/router/app_router.dart';
import 'features/auth/domain/providers/auth_providers.dart';
import 'features/auth/presentation/screens/auth_loading_screen.dart';
import 'shared/theme/app_theme.dart';
import 'core/performance/performance_manager.dart';
import 'core/providers/lazy_providers.dart';
import 'core/state/app_initialization_state.dart';

void main() {
  // Start performance monitoring immediately
  final perfManager = PerformanceManager();
  perfManager.markAppLaunchStart();
  
  // Start app immediately without blocking operations
  WidgetsFlutterBinding.ensureInitialized();
  
  // Configure initialization phases
  configureInitializationPhases();
  
  final container = ProviderContainer();
  
  // Defer heavy initialization to after first frame
  WidgetsBinding.instance.addPostFrameCallback((_) {
    _initializeInBackground(container);
  });
  
  runApp(UncontrolledProviderScope(
    container: container,
    child: const NexusApp(),
  ));
}

/// Initialize heavy services after UI is shown with proper state management
Future<void> _initializeInBackground(ProviderContainer container) async {
  final perfManager = PerformanceManager();
  final initManager = InitializationManager();
  final initNotifier = container.read(appInitializationProvider.notifier);
  
  try {
    // Initialize critical services first
    await initNotifier.initializeHive();
    
    // Initialize router after Hive is ready
    initNotifier.markRouterInitializing();
    perfManager.startOperation('router_initialization');
    initializeRouter(container);
    initNotifier.markRouterInitialized();
    perfManager.endOperation('router_initialization');
    
    // Run phased initialization in background
    initNotifier.markServicesInitializing();
    await initManager.initializeAll().timed('phased_initialization');
    initNotifier.markServicesInitialized();
    
    // Mark app as interactive
    perfManager.markInteractive();
    
  } catch (error) {
    debugPrint('Background initialization failed: $error');
    perfManager.markInteractive(); // Still mark as interactive even if some services failed
  }
}

class NexusApp extends ConsumerWidget {
  const NexusApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Record first frame on first build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      PerformanceManager().markFirstFrame();
    });
    
    // Watch initialization state
    final initState = ref.watch(appInitializationProvider);
    
    // Show immediate loading screen while critical services initialize
    if (!initState.isCriticalInitialized) {
      return MaterialApp(
        title: 'Nexus Mobile',
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.system,
        home: const _OptimizedLoadingScreen(),
        debugShowCheckedModeBanner: false,
      );
    }
    
    // Watch auth state only after initialization is complete
    final authState = ref.watch(authNotifierProvider);
    
    // Show auth loading screen during authentication check
    if (authState.isLoading && authState.user == null) {
      return MaterialApp(
        title: 'Nexus Mobile',
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.system,
        home: const AuthLoadingScreen(),
        debugShowCheckedModeBanner: false,
      );
    }
    
    return MaterialApp.router(
      title: 'Nexus Mobile',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      routerConfig: appRouter,
      debugShowCheckedModeBanner: false,
    );
  }
}

/// Ultra-fast loading screen shown during critical path initialization
/// Designed for minimal widget tree and instant rendering
class _OptimizedLoadingScreen extends StatelessWidget {
  const _OptimizedLoadingScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Minimal app branding
            Text(
              'Nexus',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.w300,
                letterSpacing: 2,
              ),
            ),
            SizedBox(height: 24),
            // Lightweight progress indicator
            SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}