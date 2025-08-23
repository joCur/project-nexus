import 'package:flutter_riverpod/flutter_riverpod.dart';

class CaptureState {
  const CaptureState({
    this.isCapturing = false,
    this.currentCapture,
    this.recentCaptures = const [],
  });

  final bool isCapturing;
  final String? currentCapture;
  final List<String> recentCaptures;

  CaptureState copyWith({
    bool? isCapturing,
    String? currentCapture,
    List<String>? recentCaptures,
  }) {
    return CaptureState(
      isCapturing: isCapturing ?? this.isCapturing,
      currentCapture: currentCapture ?? this.currentCapture,
      recentCaptures: recentCaptures ?? this.recentCaptures,
    );
  }
}

class CaptureNotifier extends StateNotifier<CaptureState> {
  CaptureNotifier() : super(const CaptureState());

  Future<void> startCapture() async {
    state = state.copyWith(isCapturing: true);
    // TODO: Implement actual capture logic
    await Future.delayed(const Duration(seconds: 2));
    state = state.copyWith(isCapturing: false);
  }

  void addCapture(String capture) {
    final updatedCaptures = [capture, ...state.recentCaptures];
    state = state.copyWith(recentCaptures: updatedCaptures);
  }
}

final captureProvider = StateNotifierProvider<CaptureNotifier, CaptureState>(
  (ref) => CaptureNotifier(),
);