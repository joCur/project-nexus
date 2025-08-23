import '../errors/failures.dart';

sealed class Result<T> {
  const Result();
}

class Success<T> extends Result<T> {
  const Success(this.data);
  final T data;
}

class Error<T> extends Result<T> {
  const Error(this.failure);
  final Failure failure;
}

extension ResultExtensions<T> on Result<T> {
  bool get isSuccess => this is Success<T>;
  bool get isError => this is Error<T>;

  T? get data => switch (this) {
    Success(data: final data) => data,
    Error() => null,
  };

  Failure? get failure => switch (this) {
    Success() => null,
    Error(failure: final failure) => failure,
  };

  Result<U> map<U>(U Function(T) transform) {
    return switch (this) {
      Success(data: final data) => Success(transform(data)),
      Error(failure: final failure) => Error(failure),
    };
  }

  Result<U> flatMap<U>(Result<U> Function(T) transform) {
    return switch (this) {
      Success(data: final data) => transform(data),
      Error(failure: final failure) => Error(failure),
    };
  }
}