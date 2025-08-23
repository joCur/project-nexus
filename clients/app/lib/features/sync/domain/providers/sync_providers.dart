import 'package:flutter_riverpod/flutter_riverpod.dart';

enum SyncStatus { idle, syncing, success, error }

class SyncState {
  const SyncState({
    this.status = SyncStatus.idle,
    this.lastSyncTime,
    this.error,
    this.pendingItems = 0,
  });

  final SyncStatus status;
  final DateTime? lastSyncTime;
  final String? error;
  final int pendingItems;

  SyncState copyWith({
    SyncStatus? status,
    DateTime? lastSyncTime,
    String? error,
    int? pendingItems,
  }) {
    return SyncState(
      status: status ?? this.status,
      lastSyncTime: lastSyncTime ?? this.lastSyncTime,
      error: error ?? this.error,
      pendingItems: pendingItems ?? this.pendingItems,
    );
  }
}

class SyncNotifier extends StateNotifier<SyncState> {
  SyncNotifier() : super(const SyncState());

  Future<void> performSync() async {
    state = state.copyWith(status: SyncStatus.syncing);
    
    try {
      // TODO: Implement actual sync logic
      await Future.delayed(const Duration(seconds: 3));
      
      state = state.copyWith(
        status: SyncStatus.success,
        lastSyncTime: DateTime.now(),
        pendingItems: 0,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(
        status: SyncStatus.error,
        error: e.toString(),
      );
    }
  }

  void addPendingItem() {
    state = state.copyWith(pendingItems: state.pendingItems + 1);
  }
}

final syncProvider = StateNotifierProvider<SyncNotifier, SyncState>(
  (ref) => SyncNotifier(),
);