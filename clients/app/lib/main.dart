import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'features/auth/domain/providers/auth_providers.dart';
import 'features/auth/presentation/screens/auth_loading_screen.dart';
import 'shared/theme/app_theme.dart';

void main() {
  final container = ProviderContainer();
  initializeRouter(container);
  runApp(UncontrolledProviderScope(
    container: container,
    child: const NexusApp(),
  ));
}

class NexusApp extends ConsumerWidget {
  const NexusApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    
    // Show loading screen during initial auth check
    if (authState.isLoading && authState.user == null) {
      return MaterialApp(
        title: 'Nexus Mobile',
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.system,
        home: const AuthLoadingScreen(),
      );
    }
    
    return MaterialApp.router(
      title: 'Nexus Mobile',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      routerConfig: appRouter,
    );
  }
}