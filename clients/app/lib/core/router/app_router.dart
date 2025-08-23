import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/screens/auth_screen.dart';
import '../../features/capture/presentation/screens/capture_screen.dart';
import '../../features/sync/presentation/screens/sync_screen.dart';
import '../../shared/widgets/app_shell.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/capture',
  routes: [
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