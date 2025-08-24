import 'dart:developer' as dev;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/platform/environment.dart';
import '../services/api_client.dart';
import 'auth_service.dart';

part 'graphql_client.g.dart';

@riverpod
GraphQLClient graphqlClient(Ref ref) {
  final authService = ref.watch(authServiceProvider);
  return GraphQLClientService(authService).client;
}

/// GraphQL client with Auth0 integration and error handling
class GraphQLClientService {
  late final GraphQLClient _client;
  final AuthService _authService;

  GraphQLClientService(this._authService) {
    _client = _createClient();
  }

  GraphQLClient get client => _client;

  GraphQLClient _createClient() {
    // HTTP Link to GraphQL endpoint
    final httpLink = HttpLink(
      '${AppEnvironment.baseUrl}/graphql',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    );

    // Auth Link for automatic token injection
    final authLink = AuthLink(
      getToken: () async {
        try {
          final token = await _authService.getAccessToken();
          return token != null ? 'Bearer $token' : null;
        } catch (error) {
          dev.log('Failed to get auth token for GraphQL: $error', 
                 name: 'GraphQLClient');
          return null;
        }
      },
    );

    // Error Link for basic error logging
    final errorLink = ErrorLink(
      onException: (request, forward, exception) {
        dev.log('GraphQL Error: ${exception.toString()}', 
               name: 'GraphQLClient');
        
        // For now, just log and forward the exception
        // We'll handle retries and token refresh in the higher level methods
        return null;
      },
    );

    // Combine links
    final link = Link.from([
      errorLink,
      authLink,
      httpLink,
    ]);

    // Create client with Hive store for caching
    return GraphQLClient(
      link: link,
      cache: GraphQLCache(
        store: HiveStore(),
      ),
      // Use basic cache configuration for now
      // Will configure advanced policies when needed
    );
  }

  /// Map GraphQL exceptions to existing ApiException pattern
  ApiException _mapToApiException(OperationException exception) {
    if (exception.linkException != null) {
      final linkException = exception.linkException!;
      
      if (linkException is NetworkException) {
        return const ApiException(
          'Network error: Please check your internet connection',
          statusCode: null,
        );
      }
      
      if (linkException is ServerException) {
        final statusCode = 500; // Default server error code
        String message = 'Server error. Please try again later.';
        
        return ApiException(message, statusCode: statusCode);
      }
    }
    
    if (exception.graphqlErrors.isNotEmpty) {
      final graphqlError = exception.graphqlErrors.first;
      return ApiException(
        'GraphQL error: ${graphqlError.message}',
        data: graphqlError.extensions,
      );
    }
    
    return const ApiException('An unexpected error occurred');
  }

  /// Execute a GraphQL query with error handling
  Future<QueryResult<Object?>> query(QueryOptions options) async {
    try {
      final result = await _client.query(options);
      _logResult('Query', result);
      
      // Handle exceptions in results
      if (result.hasException && result.exception != null) {
        throw _mapToApiException(result.exception!);
      }
      
      return result;
    } catch (error) {
      dev.log('Query execution failed: $error', name: 'GraphQLClient');
      if (error is OperationException) {
        throw _mapToApiException(error);
      }
      rethrow;
    }
  }

  /// Execute a GraphQL mutation with error handling
  Future<QueryResult<Object?>> mutate(MutationOptions options) async {
    try {
      final result = await _client.mutate(options);
      _logResult('Mutation', result);
      
      // Handle exceptions in results
      if (result.hasException && result.exception != null) {
        throw _mapToApiException(result.exception!);
      }
      
      return result;
    } catch (error) {
      dev.log('Mutation execution failed: $error', name: 'GraphQLClient');
      if (error is OperationException) {
        throw _mapToApiException(error);
      }
      rethrow;
    }
  }

  /// Create an observable query for reactive updates
  ObservableQuery<Object?> watchQuery(WatchQueryOptions options) {
    return _client.watchQuery(options);
  }

  void _logResult(String operation, QueryResult result) {
    if (AppEnvironment.isDevelopment) {
      if (result.hasException) {
        dev.log('$operation failed: $result.exception', name: 'GraphQLClient');
      } else {
        dev.log('$operation successful', name: 'GraphQLClient');
      }
    }
  }

  /// Dispose resources
  void dispose() {
    // GraphQLClient doesn't need explicit disposal
    // but we can clear cache if needed
  }
}