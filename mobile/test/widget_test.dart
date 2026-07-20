import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:myanitrack_mobile/src/app.dart';
import 'package:myanitrack_mobile/src/models.dart';
import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/screens/collection_screens.dart';
import 'package:myanitrack_mobile/src/theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const goldenKey = ValueKey('login-golden');

  setUpAll(() async {
    final bytes = await File('test/fonts/Pretendard-Regular.ttf').readAsBytes();
    final pretendard = FontLoader('Pretendard')
      ..addFont(Future.value(ByteData.sublistView(bytes)));
    await pretendard.load();
  });

  Future<void> pumpLogin(
    WidgetTester tester, {
    required Size surfaceSize,
  }) async {
    tester.view.physicalSize = surfaceSize;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionControllerProvider.overrideWith(
            _SignedOutSessionController.new,
          ),
        ],
        child: const RepaintBoundary(key: goldenKey, child: MyAniTrackApp()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('세션이 없으면 Android 소형 화면에서 바로 로그인 화면을 연다', (tester) async {
    await pumpLogin(tester, surfaceSize: const Size(360, 800));

    expect(find.text('Google로 계속하기'), findsOneWidget);
    expect(find.text('둘러보기'), findsNothing);
    expect(find.text('내 컬렉션'), findsNothing);
  });

  testWidgets('iPhone 화면에서도 로그인 UI가 넘치지 않는다', (tester) async {
    await pumpLogin(tester, surfaceSize: const Size(390, 844));

    expect(find.text('Google로 계속하기'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byKey(goldenKey),
      matchesGoldenFile('goldens/login_390x844.png'),
    );
  });

  testWidgets('430×932 화면에서 핵심 5탭을 전환한다', (tester) async {
    tester.view.physicalSize = const Size(430, 932);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    late final GoRouter router;
    router = GoRouter(
      initialLocation: '/home',
      routes: [
        ShellRoute(
          builder: (_, _, child) => AppTabShell(child: child),
          routes: [
            for (final route in const {
              '/home': '홈 화면',
              '/collection': '컬렉션 화면',
              '/search': '검색 화면',
              '/analysis': '분석 화면',
              '/profile': '프로필 화면',
            }.entries)
              GoRoute(
                path: route.key,
                builder: (_, _) => Center(child: Text(route.value)),
              ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      CupertinoApp.router(theme: appCupertinoTheme, routerConfig: router),
    );
    await tester.pumpAndSettle();

    expect(find.text('컬렉션'), findsOneWidget);
    expect(find.text('홈'), findsOneWidget);
    expect(find.text('검색'), findsOneWidget);
    expect(find.text('분석'), findsOneWidget);
    expect(find.text('프로필'), findsOneWidget);

    await tester.tap(find.text('분석'));
    await tester.pumpAndSettle();
    expect(find.text('분석 화면'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('홈에 프로필·최애 애니·배지를 독립적으로 표시한다', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionControllerProvider.overrideWith(
            _AuthenticatedSessionController.new,
          ),
          favoriteAnimeProvider.overrideWith((_) async => const []),
          badgeOverviewProvider.overrideWith(
            (_) async =>
                const BadgeOverview(items: [], earnedCount: 0, totalCount: 0),
          ),
        ],
        child: const MyAniTrackApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('반가워요,'), findsOneWidget);
    expect(find.text('최애 애니'), findsOneWidget);
    expect(find.text('내 배지'), findsOneWidget);
    expect(find.text('홈'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('컬렉션 상단은 전체 작품 수만 표시한다', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          collectionControllerProvider.overrideWith(
            _CollectionFixtureController.new,
          ),
        ],
        child: const CupertinoApp(home: CollectionScreen()),
      ),
    );
    await tester.pump();

    expect(find.text('전체'), findsOneWidget);
    expect(find.text('148편'), findsOneWidget);
    expect(find.text('현재 불러온 기록'), findsNothing);
  });

  testWidgets('작품 검색 결과를 2열로 배치하고 포스터 위에 추가 버튼을 둔다', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final router = GoRouter(
      initialLocation: '/search',
      routes: [
        GoRoute(path: '/search', builder: (_, _) => const AnimeSearchScreen()),
        GoRoute(path: '/anime/:id', builder: (_, _) => const SizedBox()),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          searchControllerProvider.overrideWith(_SearchFixtureController.new),
        ],
        child: CupertinoApp.router(routerConfig: router),
      ),
    );
    await tester.pump();

    final first = tester.getTopLeft(find.text('작품 A'));
    final second = tester.getTopLeft(find.text('작품 B'));
    expect((first.dy - second.dy).abs(), lessThan(2));
    expect(find.byIcon(CupertinoIcons.add), findsNWidgets(2));
    expect(tester.takeException(), isNull);
  });
}

class _SignedOutSessionController extends SessionController {
  @override
  SessionState build() => const SessionState(phase: SessionPhase.signedOut);
}

class _AuthenticatedSessionController extends SessionController {
  @override
  SessionState build() => const SessionState(
    phase: SessionPhase.authenticated,
    user: AuthUser(
      id: 7,
      email: 'user@example.com',
      username: '후라이',
      role: 'USER',
      emailVerified: true,
    ),
  );
}

class _CollectionFixtureController extends CollectionController {
  @override
  CollectionViewState build() => const CollectionViewState(totalCount: 148);
}

class _SearchFixtureController extends SearchController {
  @override
  SearchViewState build() => const SearchViewState(
    query: '작품',
    items: [
      AnimeSearchResult(anime: Anime(id: 1, title: '작품 A')),
      AnimeSearchResult(anime: Anime(id: 2, title: '작품 B')),
    ],
  );
}
