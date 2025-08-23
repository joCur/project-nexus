import 'package:auth0_flutter/auth0_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/errors/failures.dart';
import '../../../../shared/services/auth_service.dart';
import '../../../../core/utils/result.dart';

part 'auth_providers.g.dart';

/// User model adapted from Auth0 UserProfile
class User {
  const User({
    required this.id,
    required this.name,
    required this.email,
    this.avatarUrl,
    this.emailVerified = false,
    this.sub,
  });

  final String id;
  final String name;
  final String email;
  final String? avatarUrl;
  final bool emailVerified;
  final String? sub;

  factory User.fromAuth0Profile(UserProfile profile) {
    return User(
      id: profile.sub,
      name: profile.name ?? profile.email ?? 'Unknown User',
      email: profile.email ?? '',
      avatarUrl: profile.pictureUrl?.toString(),
      emailVerified: profile.isEmailVerified ?? false,
      sub: profile.sub,
    );
  }

  User copyWith({
    String? id,
    String? name,
    String? email,
    String? avatarUrl,
    bool? emailVerified,
    String? sub,
  }) {
    return User(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      emailVerified: emailVerified ?? this.emailVerified,
      sub: sub ?? this.sub,
    );
  }
}

/// Authentication state
class AuthState {
  const AuthState({
    this.isAuthenticated = false,
    this.user,
    this.isLoading = false,
    this.error,
  });

  final bool isAuthenticated;
  final User? user;
  final bool isLoading;
  final String? error;

  AuthState copyWith({
    bool? isAuthenticated,
    User? user,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}

/// Authentication state notifier
@riverpod
class AuthNotifier extends _$AuthNotifier {
  late final AuthService _authService;

  @override
  AuthState build() {
    _authService = ref.watch(authServiceProvider);
    _checkAuthStatus();
    return const AuthState();
  }

  /// Check current authentication status
  Future<void> _checkAuthStatus() async {
    state = state.copyWith(isLoading: true);

    try {
      final isAuthenticated = await _authService.isAuthenticated();
      if (isAuthenticated) {
        final userProfile = await _authService.getUserProfile();
        if (userProfile != null) {
          final user = User.fromAuth0Profile(userProfile);
          state = state.copyWith(
            isAuthenticated: true,
            user: user,
            isLoading: false,
          );
          return;
        }
      }
      
      state = state.copyWith(
        isAuthenticated: false,
        user: null,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  /// Login using Auth0
  Future<void> login() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final result = await _authService.login();
      
      switch (result) {
        case Success(data: final userProfile):
          final user = User.fromAuth0Profile(userProfile);
          state = state.copyWith(
            isAuthenticated: true,
            user: user,
            isLoading: false,
          );
        case Error(failure: final failure):
          final authFailure = failure as AuthFailure;
          if (authFailure.code == 'login_cancelled') {
            // User cancelled login, don't show error
            state = state.copyWith(isLoading: false);
          } else {
            state = state.copyWith(
              isLoading: false,
              error: authFailure.message,
            );
          }
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Unexpected error during login: ${e.toString()}',
      );
    }
  }

  /// Logout
  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    
    try {
      final result = await _authService.logout();
      
      switch (result) {
        case Success():
          state = const AuthState();
        case Error(failure: final failure):
          final authFailure = failure as AuthFailure;
          // Even if logout fails, clear the local state
          state = AuthState(
            error: 'Logout warning: ${authFailure.message}',
          );
      }
    } catch (e) {
      // Even if logout fails, clear the local state
      state = AuthState(
        error: 'Logout completed with warning: ${e.toString()}',
      );
    }
  }

  /// Clear error state
  void clearError() {
    state = state.copyWith(error: null);
  }

  /// Refresh authentication status
  Future<void> refresh() async {
    await _checkAuthStatus();
  }
}

/// Current authentication state provider
@riverpod
AuthState authState(Ref ref) {
  return ref.watch(authNotifierProvider);
}

/// Current authenticated user provider
@riverpod
User? currentUser(Ref ref) {
  final authState = ref.watch(authNotifierProvider);
  return authState.user;
}

/// Authentication status provider
@riverpod
bool isAuthenticated(Ref ref) {
  final authState = ref.watch(authNotifierProvider);
  return authState.isAuthenticated;
}

/// Loading state provider
@riverpod
bool isAuthLoading(Ref ref) {
  final authState = ref.watch(authNotifierProvider);
  return authState.isLoading;
}

/// Access token provider for API calls
@riverpod
Future<String?> accessToken(Ref ref) async {
  final authService = ref.watch(authServiceProvider);
  return await authService.getAccessToken();
}