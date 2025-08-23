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