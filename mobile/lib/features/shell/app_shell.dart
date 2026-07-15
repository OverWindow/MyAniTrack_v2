import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/widgets/app_background.dart';
import '../../data/auth/auth_session_service.dart';
import '../analysis/presentation/analysis_page.dart';
import '../collection/presentation/collection_page.dart';
import '../home/presentation/home_page.dart';
import '../profile/presentation/profile_page.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  static const _authSessionService = AuthSessionService();

  int _index = 0;
  int _authVersion = 0;
  StreamSubscription<dynamic>? _authSubscription;

  @override
  void initState() {
    super.initState();
    _authSubscription = _authSessionService.authStateChanges.listen((event) {
      if (mounted) {
        setState(() {
          _authVersion += 1;
          if (!_authSessionService.isSignedIn) {
            _index = 0;
          }
        });
      }
    });
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isSignedIn = _authSessionService.isSignedIn;
    final pages = isSignedIn
        ? [
            HomePage(key: ValueKey('home-$_authVersion')),
            CollectionPage(key: ValueKey('collection-$_authVersion')),
            AnalysisPage(key: ValueKey('analysis-$_authVersion')),
            ProfilePage(key: ValueKey('profile-$_authVersion')),
          ]
        : [
            HomePage(key: ValueKey('home-$_authVersion')),
          ];
    final selectedIndex = _index >= pages.length ? 0 : _index;

    return AppBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(child: pages[selectedIndex]),
        bottomNavigationBar: isSignedIn
            ? NavigationBar(
                selectedIndex: selectedIndex,
                onDestinationSelected: (value) => setState(() => _index = value),
                destinations: const [
                  NavigationDestination(
                    icon: Icon(Icons.home_outlined),
                    selectedIcon: Icon(Icons.home),
                    label: '탐색',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.grid_view_outlined),
                    selectedIcon: Icon(Icons.grid_view_rounded),
                    label: '컬렉션',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.analytics_outlined),
                    selectedIcon: Icon(Icons.analytics),
                    label: '분석',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.person_outline),
                    selectedIcon: Icon(Icons.person),
                    label: '프로필',
                  ),
                ],
              )
            : null,
      ),
    );
  }
}
