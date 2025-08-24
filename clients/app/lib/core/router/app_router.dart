import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/domain/providers/auth_providers.dart';
import '../../features/auth/presentation/screens/auth_callback_screen.dart';
import '../../features/auth/presentation/screens/auth_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/capture/presentation/screens/capture_screen.dart';
import '../../features/sync/presentation/screens/sync_screen.dart';
import '../../shared/widgets/app_shell.dart';

// Provider ref holder for accessing auth state in router
ProviderContainer? _routerContainer;

final GoRouter appRouter = GoRouter(
  initialLocation: '/capture',
  redirect: _guardRoutes,
  refreshListenable: _AuthStateNotifier(),
  routes: [
    // Public routes (no authentication required)
    GoRoute(
      path: '/login',
      name: 'login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/auth-callback',
      name: 'auth-callback',
      builder: (context, state) => const AuthCallbackScreen(),
    ),
    
    // Protected routes wrapped in AppShell
    ShellRoute(
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        GoRoute(
          path: '/capture',
          name: 'capture',
          builder: (context, state) => const CaptureScreen(),
        ),
        GoRoute(
          path: '/sync',
          name: 'sync',
          builder: (context, state) => const SyncScreen(),
        ),
        GoRoute(
          path: '/profile',
          name: 'profile',
          builder: (context, state) => const AuthScreen(),
        ),
      ],
    ),
  ],
);

/// Initialize router with provider container
void initializeRouter(ProviderContainer container) {
  _routerContainer = container;
}

/// Route guard that handles authentication redirects
String? _guardRoutes(BuildContext context, GoRouterState state) {
  // If router container is not initialized yet, allow navigation
  if (_routerContainer == null) {
    return null;
  }

  final authState = _routerContainer!.read(authNotifierProvider);
  final currentLocation = state.uri.path;
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/auth-callback'];
  final isPublicRoute = publicRoutes.contains(currentLocation);
  
  // If still loading auth state, let the app handle loading properly
  if (authState.isLoading && !isPublicRoute) {
    return null; // Let the main app show the loading screen
  }
  
  // If user is authenticated
  if (authState.isAuthenticated) {
    // Redirect authenticated users away from login page
    if (currentLocation == '/login') {
      return '/capture';
    }
    // Allow access to all other routes
    return null;
  }
  
  // If user is not authenticated and trying to access protected route
  if (!isPublicRoute) {
    // Store the intended destination for after login
    if (currentLocation != '/' && currentLocation != '/capture') {
      return '/login?redirect_to=${Uri.encodeComponent(currentLocation)}';
    }
    return '/login';
  }
  
  // Allow access to public routes
  return null;
}

/// Custom listenable for auth state changes to trigger router refreshes
class _AuthStateNotifier extends ChangeNotifier {
  _AuthStateNotifier() {
    // Wait for the router container to be initialized before listening
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_routerContainer != null) {
        // Listen to auth state changes and notify router to refresh
        _routerContainer!.listen<AuthState>(
          authNotifierProvider,
          (previous, next) {
            // Only notify if authentication status or loading state changed
            if (previous?.isAuthenticated != next.isAuthenticated ||
                previous?.isLoading != next.isLoading) {
              notifyListeners();
            }
          },
        );
      }
    });
  }
}