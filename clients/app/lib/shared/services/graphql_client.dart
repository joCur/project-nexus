import 'dart:async';
import 'dart:developer' as dev;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gql/ast.dart';
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

/// Represents a queued offline operation
class QueuedOperation {
  final String type; // 'query' or 'mutation'
  final DocumentNode document;
  final Map<String, dynamic>? variables;
  final DateTime timestamp;
  final int retryCount;

  const QueuedOperation({
    required this.type,
    required this.document,
    this.variables,
    required this.timestamp,
    this.retryCount = 0,
  });

  QueuedOperation copyWith({
    String? type,
    DocumentNode? document,
    Map<String, dynamic>? variables,
    DateTime? timestamp,
    int? retryCount,
  }) {
    return QueuedOperation(
      type: type ?? this.type,
      document: document ?? this.document,
      variables: variables ?? this.variables,
      timestamp: timestamp ?? this.timestamp,
      retryCount: retryCount ?? this.retryCount,
    );
  }
}

/// GraphQL client with Auth0 integration and error handling
class GraphQLClientService {
  late final GraphQLClient _client;
  final AuthService _authService;
  final List<QueuedOperation> _offlineQueue = [];
  bool _isOnline = true;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;

  GraphQLClientService(this._authService) {
    _client = _createClient();
    _initializeConnectivityListener();
  }

  GraphQLClient get client => _client;
  bool get isOnline => _isOnline;
  List<QueuedOperation> get offlineQueue => List.unmodifiable(_offlineQueue);

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

    // Error Link with retry logic and token refresh
    final errorLink = ErrorLink(
      onException: (request, forward, exception) async* {
        dev.log('GraphQL Error: ${exception.toString()}', 
               name: 'GraphQLClient');
        
        // Handle network errors with retry logic
        if (exception is NetworkException) {
          dev.log('Network error encountered, retrying in 2 seconds...', 
                 name: 'GraphQLClient');
          await Future.delayed(const Duration(seconds: 2));
          yield* forward(request);
          return;
        }
        
        // Handle server exceptions (401, 403, 500, etc.)
        if (exception is ServerException) {
          // Note: ServerException in graphql_flutter may not have response property
          // We'll handle this with basic retry logic for server errors
          dev.log('Server error encountered', name: 'GraphQLClient');
          
          // Basic retry for server errors (without specific status code access)
          for (int attempt = 1; attempt <= 2; attempt++) {
            final delay = Duration(seconds: attempt * 2); // 2s, 4s
            dev.log('Server error, retry attempt $attempt/2 in ${delay.inSeconds}s...', 
                   name: 'GraphQLClient');
            await Future.delayed(delay);
            yield* forward(request);
          }
          return;
        }
        
        // For other errors, don't retry
        return;
      },
    );

    // Combine links
    final link = Link.from([
      errorLink,
      authLink,
      httpLink,
    ]);

    // Create client with appropriate store for caching
    return GraphQLClient(
      link: link,
      cache: GraphQLCache(
        // Use HiveStore for production, InMemoryStore for testing
        store: HiveStore(),
      ),
      // Basic configuration - can be extended with policies later
    );
  }

  /// Initialize connectivity listener for offline detection
  void _initializeConnectivityListener() {
    // Check initial connectivity status
    Connectivity().checkConnectivity().then((results) {
      _updateConnectivityStatus(results);
    });

    // Listen for connectivity changes
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((results) {
      _updateConnectivityStatus(results);
    });
  }

  /// Update connectivity status and process queue if back online
  void _updateConnectivityStatus(List<ConnectivityResult> results) {
    final wasOffline = !_isOnline;
    _isOnline = results.any((result) => 
      result == ConnectivityResult.mobile || 
      result == ConnectivityResult.wifi || 
      result == ConnectivityResult.ethernet ||
      result == ConnectivityResult.vpn
    );

    dev.log('Connectivity status: ${_isOnline ? "Online" : "Offline"}', 
           name: 'GraphQLClient');

    // If we just came back online, process the offline queue
    if (wasOffline && _isOnline && _offlineQueue.isNotEmpty) {
      dev.log('Back online! Processing ${_offlineQueue.length} queued operations...', 
             name: 'GraphQLClient');
      _processOfflineQueue();
    }
  }

  /// Add operation to offline queue when network is unavailable
  void _queueOfflineOperation(String type, DocumentNode document, [Map<String, dynamic>? variables]) {
    final operation = QueuedOperation(
      type: type,
      document: document,
      variables: variables,
      timestamp: DateTime.now(),
    );
    _offlineQueue.add(operation);
    dev.log('Added $type operation to offline queue. Queue size: ${_offlineQueue.length}', 
           name: 'GraphQLClient');
  }

  /// Process offline queue when connection is restored
  Future<void> _processOfflineQueue() async {
    if (_offlineQueue.isEmpty || !_isOnline) return;
    
    dev.log('Processing ${_offlineQueue.length} queued operations...', 
           name: 'GraphQLClient');
    
    final operations = List<QueuedOperation>.from(_offlineQueue);
    _offlineQueue.clear();
    
    for (final operation in operations) {
      try {
        QueryResult result;
        
        if (operation.type == 'query') {
          final options = QueryOptions(
            document: operation.document,
            variables: operation.variables ?? {},
          );
          result = await _client.query(options);
        } else if (operation.type == 'mutation') {
          final options = MutationOptions(
            document: operation.document,
            variables: operation.variables ?? {},
          );
          result = await _client.mutate(options);
        } else {
          dev.log('Unknown operation type: ${operation.type}', name: 'GraphQLClient');
          continue;
        }
        
        if (result.hasException) {
          dev.log('Queued ${operation.type} operation completed with errors: ${result.exception}', 
                 name: 'GraphQLClient');
        } else {
          dev.log('Successfully processed queued ${operation.type} operation', 
                 name: 'GraphQLClient');
        }
      } catch (error) {
        dev.log('Failed to process queued ${operation.type} operation: $error', 
               name: 'GraphQLClient');
        
        // Re-queue failed operations with retry limit
        if (operation.retryCount < 3) {
          final retryOperation = operation.copyWith(retryCount: operation.retryCount + 1);
          _offlineQueue.add(retryOperation);
          dev.log('Re-queued operation for retry (attempt ${retryOperation.retryCount})', 
                 name: 'GraphQLClient');
        } else {
          dev.log('Dropping operation after 3 retry attempts', 
                 name: 'GraphQLClient');
        }
      }
    }
  }

  /// Clear all queued offline operations
  void clearOfflineQueue() {
    final count = _offlineQueue.length;
    _offlineQueue.clear();
    dev.log('Cleared $count operations from offline queue', 
           name: 'GraphQLClient');
  }

  /// Map GraphQL exceptions to existing ApiException pattern
  ApiException _mapToApiException(OperationException exception) {
    final linkException = exception.linkException;
    if (linkException != null) {
      if (linkException is NetworkException) {
        return const ApiException(
          'Network error: Please check your internet connection',
          statusCode: null,
        );
      }
      
      if (linkException is ServerException) {
        // Use generic server error message since we can't reliably access status code
        return const ApiException(
          'Server error. Please try again later.',
          statusCode: 500,
        );
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

  /// Execute a GraphQL query with error handling and offline support
  Future<QueryResult<Object?>> query(QueryOptions options) async {
    try {
      final result = await _client.query(options);
      _logResult('Query', result);
      
      // Process offline queue if we're back online
      if (_isOnline && _offlineQueue.isNotEmpty) {
        await _processOfflineQueue();
      }
      
      // Handle exceptions in results
      if (result.hasException && result.exception != null) {
        throw _mapToApiException(result.exception!);
      }
      
      return result;
    } catch (error) {
      dev.log('Query execution failed: $error', name: 'GraphQLClient');
      
      // Check if it's a network error and we should queue the operation
      if (error is ApiException && error.statusCode == null) {
        // Network error - queue if offline
        if (!_isOnline) {
          _queueOfflineOperation('query', options.document, options.variables);
          // Return cached data if available - create new options for cache-only fetch
          final cacheOptions = QueryOptions(
            document: options.document,
            variables: options.variables,
            fetchPolicy: FetchPolicy.cacheOnly,
          );
          final cachedResult = await _client.query(cacheOptions);
          if (!cachedResult.hasException) {
            return cachedResult;
          }
        }
      }
      
      if (error is OperationException) {
        throw _mapToApiException(error);
      }
      rethrow;
    }
  }

  /// Execute a GraphQL mutation with error handling and offline support
  Future<QueryResult<Object?>> mutate(MutationOptions options) async {
    try {
      final result = await _client.mutate(options);
      _logResult('Mutation', result);
      
      // Process offline queue if we're back online
      if (_isOnline && _offlineQueue.isNotEmpty) {
        await _processOfflineQueue();
      }
      
      // Handle exceptions in results
      if (result.hasException && result.exception != null) {
        throw _mapToApiException(result.exception!);
      }
      
      return result;
    } catch (error) {
      dev.log('Mutation execution failed: $error', name: 'GraphQLClient');
      
      // Check if it's a network error and we should queue the operation
      if (error is ApiException && error.statusCode == null) {
        // Network error - queue mutation for later
        if (!_isOnline) {
          _queueOfflineOperation('mutation', options.document, options.variables);
          throw const ApiException(
            'Operation queued for when connection is restored',
            statusCode: null,
          );
        }
      }
      
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
    _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
    clearOfflineQueue();
  }
}