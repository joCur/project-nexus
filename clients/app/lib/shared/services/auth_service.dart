import 'dart:convert';
import 'dart:developer' as dev;

import 'package:auth0_flutter/auth0_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/errors/failures.dart';
import '../../core/platform/environment.dart';
import '../../core/utils/result.dart';

part 'auth_service.g.dart';

@riverpod
AuthService authService(Ref ref) {
  return AuthService();
}

class AuthService {
  late final Auth0 _auth0;
  late final FlutterSecureStorage _storage;

  AuthService() {
    _auth0 = Auth0(
      AppEnvironment.auth0Domain,
      AppEnvironment.auth0ClientId,
    );
    
    _storage = const FlutterSecureStorage(
      aOptions: AndroidOptions(
        encryptedSharedPreferences: true,
      ),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    );
  }

  static const String _accessTokenKey = 'auth0_access_token';
  static const String _refreshTokenKey = 'auth0_refresh_token';
  static const String _idTokenKey = 'auth0_id_token';
  static const String _userProfileKey = 'auth0_user_profile';

  /// Login using Auth0 Universal Login
  Future<Result<UserProfile>> login() async {
    try {
      // Use real Auth0 authentication by default
      // Development mode is only for UI testing when explicitly enabled
      if (AppEnvironment.enableDevelopmentAuth) {
        dev.log('Development mode authentication enabled - UI testing only', name: 'AuthService');
        return await _handleDevelopmentAuth();
      }

      final credentials = await _auth0.webAuthentication()
          .login(
            audience: AppEnvironment.auth0Audience,
            scopes: {'openid', 'profile', 'email', 'offline_access'},
            redirectUrl: AppEnvironment.auth0RedirectUri,
          );

      await _storeCredentials(credentials);
      
      final user = await _auth0.api.userProfile(accessToken: credentials.accessToken);
      await _storeUserProfile(user);

      dev.log('Auth0 login successful: ${user.email}', name: 'AuthService');
      return Success(user);
    } catch (error) {
      dev.log('Auth0 login failed: $error', name: 'AuthService');
      if (error is WebAuthenticationException) {
        if (error.code == 'a0.authentication_canceled') {
          return Error(AuthFailure.loginCancelled());
        }
      }
      return Error(AuthFailure.loginFailed(error.toString()));
    }
  }

  /// Logout and clear stored credentials
  Future<Result<void>> logout() async {
    try {
      if (AppEnvironment.enableDevelopmentAuth) {
        dev.log('Development mode logout', name: 'AuthService');
        await _clearStoredCredentials();
        return const Success(null);
      }

      await _auth0.webAuthentication()
          .logout(returnTo: AppEnvironment.auth0LogoutUri);
      
      await _clearStoredCredentials();
      
      dev.log('Auth0 logout successful', name: 'AuthService');
      return const Success(null);
    } catch (error) {
      dev.log('Auth0 logout failed: $error', name: 'AuthService');
      // Even if logout fails, clear local credentials
      await _clearStoredCredentials();
      return Error(AuthFailure.logoutFailed(error.toString()));
    }
  }

  /// Get current access token, refreshing if necessary
  Future<String?> getAccessToken() async {
    try {
      final refreshToken = await _storage.read(key: _refreshTokenKey);
      if (refreshToken == null) {
        return null;
      }

      // Try to refresh the token
      final credentials = await _auth0.api.renewCredentials(refreshToken: refreshToken);
      await _storeCredentials(credentials);
      
      return credentials.accessToken;
    } catch (error) {
      dev.log('Failed to refresh access token: $error', name: 'AuthService');
      return await _storage.read(key: _accessTokenKey);
    }
  }

  /// Check if user is authenticated
  Future<bool> isAuthenticated() async {
    if (AppEnvironment.enableDevelopmentAuth) {
      return await _storage.containsKey(key: _userProfileKey);
    }
    
    final accessToken = await _storage.read(key: _accessTokenKey);
    return accessToken != null;
  }

  /// Get stored user profile
  Future<UserProfile?> getUserProfile() async {
    try {
      final profileJson = await _storage.read(key: _userProfileKey);
      if (profileJson == null) return null;
      
      final profileMap = jsonDecode(profileJson) as Map<String, dynamic>;
      return UserProfile.fromMap(profileMap);
    } catch (error) {
      dev.log('Failed to get user profile: $error', name: 'AuthService');
      return null;
    }
  }

  /// Store credentials securely
  Future<void> _storeCredentials(Credentials credentials) async {
    await Future.wait([
      _storage.write(key: _accessTokenKey, value: credentials.accessToken),
      if (credentials.refreshToken != null)
        _storage.write(key: _refreshTokenKey, value: credentials.refreshToken!),
      _storage.write(key: _idTokenKey, value: credentials.idToken),
    ]);
  }

  /// Store user profile securely
  Future<void> _storeUserProfile(UserProfile profile) async {
    final profileJson = jsonEncode(profile.toMap());
    await _storage.write(key: _userProfileKey, value: profileJson);
  }

  /// Clear all stored credentials
  Future<void> _clearStoredCredentials() async {
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
      _storage.delete(key: _idTokenKey),
      _storage.delete(key: _userProfileKey),
    ]);
  }

  /// Handle development mode authentication
  Future<Result<UserProfile>> _handleDevelopmentAuth() async {
    try {
      // Create a mock user for development
      final mockUser = UserProfile.fromMap({
        'sub': 'dev|mock-user-123',
        'email': 'developer@nexus.app',
        'name': 'Development User',
        'picture': 'https://via.placeholder.com/150',
        'email_verified': true,
      });

      await _storeUserProfile(mockUser);
      
      // Store mock tokens (create a simplified mock credentials object)
      final mockCredentials = Credentials(
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        idToken: 'mock-id-token',
        tokenType: 'Bearer',
        expiresAt: DateTime.now().add(const Duration(hours: 24)),
        scopes: {'openid', 'profile', 'email'},
        user: mockUser,
      );
      await _storeCredentials(mockCredentials);

      dev.log('Development authentication successful', name: 'AuthService');
      return Success(mockUser);
    } catch (error) {
      dev.log('Development authentication failed: $error', name: 'AuthService');
      return Error(AuthFailure.loginFailed(error.toString()));
    }
  }

  /// Get development headers for API calls
  Map<String, String> getDevelopmentHeaders() {
    if (!AppEnvironment.enableDevelopmentAuth) {
      return {};
    }

    return {
      'X-User-Sub': 'dev|mock-user-123',
      'X-User-Email': 'developer@nexus.app',
    };
  }
}

