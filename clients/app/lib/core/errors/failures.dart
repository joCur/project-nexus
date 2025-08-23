abstract class Failure {
  const Failure();
}

class ServerFailure extends Failure {
  const ServerFailure({
    required this.message,
    this.statusCode,
  });

  final String message;
  final int? statusCode;

  @override
  String toString() => 'ServerFailure(message: $message, statusCode: $statusCode)';
}

class NetworkFailure extends Failure {
  const NetworkFailure({
    required this.message,
  });

  final String message;

  @override
  String toString() => 'NetworkFailure(message: $message)';
}

class CacheFailure extends Failure {
  const CacheFailure({
    required this.message,
  });

  final String message;

  @override
  String toString() => 'CacheFailure(message: $message)';
}

class ValidationFailure extends Failure {
  const ValidationFailure({
    required this.message,
  });

  final String message;

  @override
  String toString() => 'ValidationFailure(message: $message)';
}

class AuthFailure extends Failure {
  const AuthFailure({
    required this.message,
    required this.code,
  });

  final String message;
  final String code;

  factory AuthFailure.loginFailed(String message) =>
      AuthFailure(message: 'Login failed: $message', code: 'login_failed');

  factory AuthFailure.loginCancelled() =>
      const AuthFailure(message: 'Login was cancelled by user', code: 'login_cancelled');

  factory AuthFailure.logoutFailed(String message) =>
      AuthFailure(message: 'Logout failed: $message', code: 'logout_failed');

  @override
  String toString() => 'AuthFailure($code): $message';
}