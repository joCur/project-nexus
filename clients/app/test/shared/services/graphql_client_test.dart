import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../../lib/shared/services/auth_service.dart';
import '../../../lib/shared/services/graphql_client.dart';
import '../../../lib/shared/services/api_client.dart';

// Mock classes
class MockAuthService extends Mock implements AuthService {}

void main() {
  group('GraphQLClientService - Unit Tests', () {
    late MockAuthService mockAuthService;

    setUp(() {
      mockAuthService = MockAuthService();
      when(() => mockAuthService.getAccessToken()).thenAnswer((_) async => 'test-token');
    });

    group('Mock Service Tests', () {
      test('should mock auth service correctly', () async {
        expect(await mockAuthService.getAccessToken(), equals('test-token'));
        verify(() => mockAuthService.getAccessToken()).called(1);
      });
    });

    group('GraphQL Options Tests', () {
      test('should create query options successfully', () {
        const testQuery = '''
          query TestQuery {
            viewer {
              id
            }
          }
        ''';
        
        final options = QueryOptions(
          document: gql(testQuery),
        );

        expect(options, isNotNull);
        expect(options.document, isNotNull);
      });

      test('should create mutation options successfully', () {
        const testMutation = '''
          mutation TestMutation(\$input: String!) {
            test(input: \$input) {
              success
            }
          }
        ''';
        
        final options = MutationOptions(
          document: gql(testMutation),
          variables: {'input': 'test'},
        );

        expect(options, isNotNull);
        expect(options.document, isNotNull);
        expect(options.variables, equals({'input': 'test'}));
      });
    });

    group('GraphQL Links Tests', () {
      test('should create HttpLink successfully', () {
        final httpLink = HttpLink('https://test.com/graphql');
        expect(httpLink, isNotNull);
      });

      test('should create AuthLink successfully', () {
        final authLink = AuthLink(
          getToken: () async => 'Bearer test-token',
        );
        expect(authLink, isNotNull);
      });
    });
  });
}