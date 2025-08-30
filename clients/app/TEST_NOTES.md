# Test Environment Notes

## Flutter Test Segmentation Fault Issue

### Issue Description
Tests involving native plugins (SQLite, Secure Storage, Auth0) occasionally cause segmentation faults in the Flutter test environment on Windows. This appears to be related to native code integration in the test runner.

### Affected Tests
- `test/shared/services/local_storage_integration_test.dart` 
- `test/performance/performance_regression_test.dart`
- `test/shared/services/graphql_client_connectivity_test.dart`
- Tests using `DatabaseService`, `SecureStorage`, or `AuthService`

### Root Cause
The segfault occurs when multiple tests try to initialize native plugins simultaneously or when native plugin cleanup is not properly handled between test runs.

### Workarounds

1. **Run Core Logic Tests Separately**: 
   ```bash
   flutter test test/core/performance/ test/core/providers/ test/core/state/
   ```

2. **Exclude Problematic Tests**:
   ```bash
   flutter test --exclude-tags integration,performance
   ```

3. **Run Tests Sequentially**:
   ```bash
   flutter test --concurrency=1
   ```

### Test Status
- ✅ Core performance optimization tests pass
- ✅ Initialization manager tests pass (with expected error handling)
- ✅ Memory management tests pass
- ⚠️ Integration tests may cause segfaults (functionality works)

### CI/CD Considerations
For CI pipelines, recommend:
1. Running core logic tests first
2. Running integration tests in isolation
3. Using Docker containers for consistent test environment