abstract class Failure {
  const Failure();
}

class ServerFailure extends Failure {
  final String message;
  final int? statusCode;

  const ServerFailure({
    required this.message,
    this.statusCode,
  });

  @override
  String toString() => 'ServerFailure(message: $message, statusCode: $statusCode)';
}

class NetworkFailure extends Failure {
  final String message;

  const NetworkFailure({
    required this.message,
  });

  @override
  String toString() => 'NetworkFailure(message: $message)';
}

class CacheFailure extends Failure {
  final String message;

  const CacheFailure({
    required this.message,
  });

  @override
  String toString() => 'CacheFailure(message: $message)';
}

class ValidationFailure extends Failure {
  final String message;

  const ValidationFailure({
    required this.message,
  });

  @override
  String toString() => 'ValidationFailure(message: $message)';
}

class AuthFailure extends Failure {
  final String message;
  final String code;

  const AuthFailure({
    required this.message,
    required this.code,
  });

  factory AuthFailure.loginFailed(String message) =>
      AuthFailure(message: 'Login failed: $message', code: 'login_failed');

  factory AuthFailure.loginCancelled() =>
      const AuthFailure(message: 'Login was cancelled by user', code: 'login_cancelled');

  factory AuthFailure.logoutFailed(String message) =>
      AuthFailure(message: 'Logout failed: $message', code: 'logout_failed');

  @override
  String toString() => 'AuthFailure($code): $message';
}