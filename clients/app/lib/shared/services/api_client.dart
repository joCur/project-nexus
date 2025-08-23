import 'dart:developer' as dev;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/platform/environment.dart';
import 'auth_service.dart';

part 'api_client.g.dart';

@riverpod
ApiClient apiClient(Ref ref) {
  final authService = ref.watch(authServiceProvider);
  return ApiClient(authService);
}

/// HTTP client with Auth0 integration
class ApiClient {
  late final Dio _dio;
  final AuthService _authService;

  ApiClient(this._authService) {
    _dio = Dio(BaseOptions(
      baseUrl: AppEnvironment.baseUrl,
      connectTimeout: AppEnvironment.networkTimeout,
      receiveTimeout: AppEnvironment.networkTimeout,
      sendTimeout: AppEnvironment.networkTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    _setupInterceptors();
  }

  Dio get dio => _dio;

  void _setupInterceptors() {
    // Request interceptor for adding auth tokens and development headers
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        await _addAuthHeaders(options);
        _logRequest(options);
        handler.next(options);
      },
      onResponse: (response, handler) {
        _logResponse(response);
        handler.next(response);
      },
      onError: (error, handler) async {
        _logError(error);
        
        // Handle token refresh on 401 errors
        if (error.response?.statusCode == 401) {
          final refreshed = await _handleTokenRefresh(error);
          if (refreshed) {
            // Retry the original request with the new token
            try {
              final clonedRequest = await _dio.request(
                error.requestOptions.path,
                options: Options(
                  method: error.requestOptions.method,
                  headers: error.requestOptions.headers,
                ),
                data: error.requestOptions.data,
                queryParameters: error.requestOptions.queryParameters,
              );
              handler.resolve(clonedRequest);
              return;
            } catch (retryError) {
              dev.log('Retry after token refresh failed: $retryError', 
                     name: 'ApiClient');
            }
          }
        }
        
        handler.next(error);
      },
    ));

    // Logging interceptor (only in debug mode)
    if (AppEnvironment.isDevelopment) {
      _dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
        requestHeader: true,
        responseHeader: true,
        error: true,
        logPrint: (object) => dev.log(object.toString(), name: 'Dio'),
      ));
    }
  }

  Future<void> _addAuthHeaders(RequestOptions options) async {
    try {
      // Add development headers if in development mode
      if (AppEnvironment.enableDevelopmentAuth) {
        final devHeaders = _authService.getDevelopmentHeaders();
        options.headers.addAll(devHeaders);
        dev.log('Added development headers: $devHeaders', name: 'ApiClient');
        return;
      }

      // Add Auth0 access token
      final accessToken = await _authService.getAccessToken();
      if (accessToken != null) {
        options.headers['Authorization'] = 'Bearer $accessToken';
        dev.log('Added Auth0 access token to request', name: 'ApiClient');
      } else {
        dev.log('No access token available for request', name: 'ApiClient');
      }
    } catch (error) {
      dev.log('Failed to add auth headers: $error', name: 'ApiClient');
    }
  }

  Future<bool> _handleTokenRefresh(DioException error) async {
    try {
      dev.log('Attempting token refresh due to 401 error', name: 'ApiClient');
      
      final newToken = await _authService.getAccessToken();
      if (newToken != null) {
        dev.log('Token refresh successful', name: 'ApiClient');
        return true;
      }
      
      dev.log('Token refresh failed - no new token available', name: 'ApiClient');
      return false;
    } catch (refreshError) {
      dev.log('Token refresh error: $refreshError', name: 'ApiClient');
      return false;
    }
  }

  void _logRequest(RequestOptions options) {
    dev.log(
      'HTTP Request: ${options.method} ${options.uri}',
      name: 'ApiClient',
    );
  }

  void _logResponse(Response response) {
    dev.log(
      'HTTP Response: ${response.statusCode} ${response.requestOptions.method} ${response.requestOptions.uri}',
      name: 'ApiClient',
    );
  }

  void _logError(DioException error) {
    dev.log(
      'HTTP Error: ${error.response?.statusCode} ${error.requestOptions.method} ${error.requestOptions.uri} - ${error.message}',
      name: 'ApiClient',
    );
  }

  // Convenience methods for common HTTP operations

  /// GET request
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await _dio.get<T>(
      path,
      queryParameters: queryParameters,
      options: options,
    );
  }

  /// POST request
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await _dio.post<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  /// PUT request
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await _dio.put<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  /// DELETE request
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await _dio.delete<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  /// PATCH request
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await _dio.patch<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }
}

/// API response wrapper
class ApiResponse<T> {
  final T? data;
  final String? message;
  final bool success;
  final int? statusCode;

  const ApiResponse({
    this.data,
    this.message,
    required this.success,
    this.statusCode,
  });

  factory ApiResponse.success(T data, {String? message, int? statusCode}) {
    return ApiResponse(
      data: data,
      message: message,
      success: true,
      statusCode: statusCode,
    );
  }

  factory ApiResponse.failure(String message, {int? statusCode}) {
    return ApiResponse(
      message: message,
      success: false,
      statusCode: statusCode,
    );
  }
}

/// API exception for handling API-specific errors
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic data;

  const ApiException(this.message, {this.statusCode, this.data});

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Extension methods for easier Dio response handling
extension DioResponseExtension on Response {
  ApiResponse<T> toApiResponse<T>() {
    if (statusCode != null && statusCode! >= 200 && statusCode! < 300) {
      return ApiResponse.success(
        data as T,
        statusCode: statusCode,
      );
    } else {
      return ApiResponse.failure(
        statusMessage ?? 'Unknown error',
        statusCode: statusCode,
      );
    }
  }
}