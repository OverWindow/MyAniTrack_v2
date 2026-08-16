import 'package:flutter/cupertino.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/screens/analysis_screen.dart';
import 'package:myanitrack_mobile/src/screens/auth_screens.dart';
import 'package:myanitrack_mobile/src/screens/collection_screens.dart';
import 'package:myanitrack_mobile/src/screens/friends_screen.dart';
import 'package:myanitrack_mobile/src/screens/home_screen.dart';
import 'package:myanitrack_mobile/src/screens/profile_screen.dart';
import 'package:myanitrack_mobile/src/theme.dart';
import 'package:myanitrack_mobile/src/widgets.dart';

class MyAniTrackApp extends ConsumerWidget {
  const MyAniTrackApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return CupertinoApp.router(
      title: '마이애니트랙',
      debugShowCheckedModeBanner: false,
      theme: appCupertinoTheme,
      locale: const Locale('ko'),
      supportedLocales: const [Locale('ko'), Locale('en')],
      localizationsDelegates: const [
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      routerConfig: router,
    );
  }
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final session = ref.watch(sessionControllerProvider);
  return GoRouter(
    initialLocation: '/home',
    redirect: (context, state) {
      final path = state.uri.path;
      final isAuthPath =
          path == '/login' || path == '/agreements' || path == '/loading';
      if (session.phase == SessionPhase.bootstrapping ||
          session.phase == SessionPhase.backendLinking) {
        return path == '/loading' ? null : '/loading';
      }
      if (session.phase == SessionPhase.signedOut ||
          session.phase == SessionPhase.googlePending) {
        return path == '/login' ? null : '/login';
      }
      if (session.phase == SessionPhase.agreementsRequired) {
        return path == '/agreements' ? null : '/agreements';
      }
      if (session.isAuthenticated && isAuthPath) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/loading',
        pageBuilder: (_, state) => _page(state, const BootstrapScreen()),
      ),
      GoRoute(
        path: '/login',
        pageBuilder: (_, state) => _page(state, const LoginScreen()),
      ),
      GoRoute(
        path: '/agreements',
        pageBuilder: (_, state) => _page(state, const AgreementsScreen()),
      ),
      ShellRoute(
        builder: (context, state, child) => AppTabShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            pageBuilder: (_, state) => _page(state, const HomeScreen()),
          ),
          GoRoute(
            path: '/collection',
            pageBuilder: (_, state) => _page(state, const CollectionScreen()),
          ),
          GoRoute(
            path: '/search',
            pageBuilder: (_, state) => _page(state, const AnimeSearchScreen()),
          ),
          GoRoute(
            path: '/analysis',
            pageBuilder: (_, state) => _page(state, const AnalysisScreen()),
          ),
          GoRoute(
            path: '/friends',
            pageBuilder: (_, state) => _page(state, const FriendsScreen()),
          ),
        ],
      ),
      GoRoute(
        path: '/profile',
        pageBuilder: (_, state) => _page(state, const ProfileScreen()),
      ),
      GoRoute(
        path: '/anime/:id',
        pageBuilder: (_, state) {
          final animeId = int.tryParse(state.pathParameters['id'] ?? '');
          return _page(
            state,
            animeId == null
                ? const _RouteErrorScreen(message: '잘못된 작품 주소입니다.')
                : AnimeDetailScreen(animeId: animeId),
          );
        },
      ),
      GoRoute(
        path: '/anime/:id/edit',
        pageBuilder: (_, state) {
          final animeId = int.tryParse(state.pathParameters['id'] ?? '');
          return _page(
            state,
            animeId == null
                ? const _RouteErrorScreen(message: '잘못된 작품 주소입니다.')
                : CollectionEditorRouteScreen(animeId: animeId),
          );
        },
      ),
      GoRoute(
        path: '/profile/edit',
        pageBuilder: (_, state) => _page(state, const ProfileEditScreen()),
      ),
      GoRoute(
        path: '/profile/account',
        pageBuilder: (_, state) =>
            _page(state, const AccountManagementScreen()),
      ),
      GoRoute(
        path: '/profile/legal',
        pageBuilder: (_, state) => _page(state, const LegalScreen()),
      ),
      GoRoute(
        path: '/users/:id',
        pageBuilder: (_, state) {
          final userId = int.tryParse(state.pathParameters['id'] ?? '');
          return _page(
            state,
            userId == null
                ? const _RouteErrorScreen(message: '잘못된 사용자 주소입니다.')
                : PublicProfileScreen(userId: userId),
          );
        },
      ),
      GoRoute(
        path: '/users/:id/collection',
        pageBuilder: (_, state) {
          final userId = int.tryParse(state.pathParameters['id'] ?? '');
          return _page(
            state,
            userId == null
                ? const _RouteErrorScreen(message: '잘못된 사용자 주소입니다.')
                : PublicCollectionScreen(userId: userId),
          );
        },
      ),
      GoRoute(
        path: '/users/:id/analysis',
        pageBuilder: (_, state) {
          final userId = int.tryParse(state.pathParameters['id'] ?? '');
          final username = state.uri.queryParameters['name'];
          return _page(
            state,
            userId == null
                ? const _RouteErrorScreen(message: '잘못된 사용자 주소입니다.')
                : AnalysisScreen(
                    userId: userId,
                    title: username == null ? '사용자 분석' : '$username의 분석',
                  ),
          );
        },
      ),
    ],
    errorPageBuilder: (_, state) => _page(
      state,
      _RouteErrorScreen(message: state.error?.toString() ?? '페이지를 찾을 수 없습니다.'),
    ),
  );
});

CupertinoPage<void> _page(GoRouterState state, Widget child) {
  return CupertinoPage<void>(key: state.pageKey, child: child);
}

class AppTabShell extends StatelessWidget {
  const AppTabShell({required this.child, super.key});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final index = path.startsWith('/collection')
        ? 1
        : path.startsWith('/search')
        ? 2
        : path.startsWith('/analysis')
        ? 3
        : path.startsWith('/friends')
        ? 4
        : 0;
    const paths = ['/home', '/collection', '/search', '/analysis', '/friends'];
    return Column(
      children: [
        Expanded(child: child),
        CupertinoTabBar(
          currentIndex: index,
          activeColor: AppColors.pointPressed,
          inactiveColor: AppColors.mutedText,
          backgroundColor: const Color(0xF2FFFFFF),
          border: const Border(top: BorderSide(color: AppColors.border)),
          iconSize: 24,
          height: 56,
          onTap: (next) => context.go(paths[next]),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(CupertinoIcons.house),
              activeIcon: Icon(CupertinoIcons.house_fill),
              label: '홈',
            ),
            BottomNavigationBarItem(
              icon: Icon(CupertinoIcons.square_grid_2x2),
              activeIcon: Icon(CupertinoIcons.square_grid_2x2_fill),
              label: '컬렉션',
            ),
            BottomNavigationBarItem(
              icon: Icon(CupertinoIcons.search),
              activeIcon: Icon(CupertinoIcons.search_circle_fill),
              label: '탐색',
            ),
            BottomNavigationBarItem(
              icon: Icon(CupertinoIcons.chart_bar),
              activeIcon: Icon(CupertinoIcons.chart_bar_fill),
              label: '분석',
            ),
            BottomNavigationBarItem(
              icon: Icon(CupertinoIcons.person_2),
              activeIcon: Icon(CupertinoIcons.person_2_fill),
              label: '친구',
            ),
          ],
        ),
      ],
    );
  }
}

class _RouteErrorScreen extends StatelessWidget {
  const _RouteErrorScreen({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(middle: Text('오류')),
      child: AppBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: AppStateView(
              title: '화면을 열 수 없습니다',
              message: message,
              actionLabel: '컬렉션으로',
              onAction: () => context.go('/home'),
            ),
          ),
        ),
      ),
    );
  }
}
