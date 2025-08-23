// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:nexus_mobile/main.dart';

void main() {
  testWidgets('App launches and shows capture screen', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: NexusApp()));

    // Wait for the app to fully load
    await tester.pumpAndSettle();

    // Verify that we start on the capture screen
    expect(find.text('Capture'), findsWidgets);
    expect(find.text('Quick Capture'), findsOneWidget);
    expect(find.text('Capture thoughts, images, and ideas instantly'), findsOneWidget);

    // Verify that the bottom navigation is visible
    expect(find.byType(BottomNavigationBar), findsOneWidget);
    
    // Verify navigation tabs exist
    expect(find.text('Sync'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);
  });

  testWidgets('Navigation between screens works', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: NexusApp()));
    await tester.pumpAndSettle();

    // Tap on Sync tab
    await tester.tap(find.text('Sync'));
    await tester.pumpAndSettle();

    // Verify we're on sync screen
    expect(find.text('Sync Status'), findsOneWidget);

    // Tap on Profile tab
    await tester.tap(find.text('Profile'));
    await tester.pumpAndSettle();

    // Verify we're on profile/auth screen
    expect(find.text('Profile'), findsWidgets);
  });
}
