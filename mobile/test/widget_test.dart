import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:myanitrack_mobile/src/app.dart';
import 'package:myanitrack_mobile/src/models.dart';
import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/screens/analysis_screen.dart';
import 'package:myanitrack_mobile/src/screens/collection_screens.dart';
import 'package:myanitrack_mobile/src/screens/friends_screen.dart';
import 'package:myanitrack_mobile/src/theme.dart';
import 'package:myanitrack_mobile/src/widgets.dart';

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
              '/friends': '친구 화면',
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
    expect(find.text('친구'), findsOneWidget);

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
    expect(find.textContaining('0 / 0'), findsNothing);
    expect(find.textContaining('0/0'), findsNothing);
    expect(find.text('홈'), findsWidgets);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('후라이'));
    await tester.pumpAndSettle();
    expect(find.text('프로필'), findsOneWidget);
    expect(find.byIcon(CupertinoIcons.back), findsOneWidget);
    expect(find.text('아직 획득한 배지가 없어요'), findsOneWidget);

    await tester.tap(find.byIcon(CupertinoIcons.back));
    await tester.pumpAndSettle();
    expect(find.text('반가워요,'), findsOneWidget);
  });

  testWidgets('공개 프로필은 earned 필드가 없는 공개 배지도 표시한다', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          publicUserProvider(9).overrideWith(
            (_) async =>
                const PublicUser(id: 9, username: '공개 사용자', animeListCount: 12),
          ),
          publicFavoriteAnimeProvider(9).overrideWith((_) async => const []),
          publicBadgeOverviewProvider(9).overrideWith(
            (_) async => const BadgeOverview(
              earnedCount: 1,
              totalCount: 1,
              items: [
                UserBadge(
                  id: 1,
                  code: 'PUBLIC_BADGE',
                  name: '공개 배지',
                  description: '공개 프로필 배지',
                  rarity: 'COMMON',
                  earned: false,
                  earnedAt: '2026-07-20T12:00:00Z',
                ),
              ],
            ),
          ),
          friendSnapshotProvider.overrideWith(
            (_) async =>
                const FriendSnapshot(friends: [], incoming: [], outgoing: []),
          ),
        ],
        child: const CupertinoApp(home: PublicProfileScreen(userId: 9)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('공개 배지'), findsOneWidget);
    expect(find.text('아직 획득한 배지가 없어요'), findsNothing);
    await tester.tap(find.text('공개 배지'));
    await tester.pumpAndSettle();
    expect(find.text('공개 프로필 배지'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('분석 분포는 장르 소수점과 최신 연도·높은 평점을 먼저 표시한다', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    const stats = StatsOverview(
      totalCount: 9,
      completedCount: 8,
      watchingCount: 1,
      droppedCount: 0,
      totalWatchedEpisodes: 96,
      totalWatchMinutes: 2300,
      genreDistribution: {'Action': 5, 'Drama': 4},
      genreWatchMinutes: {'Action': 1200, 'Drama': 1100},
      genreAverageScore: {'Action': 7.5, 'Drama': 8.2},
      releaseYearDistribution: {'2020': 3, '2025': 1, '2023': 5},
      scoreDistribution: {'1점': 2, '10점': 1, '7점': 6},
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          statsOverviewProvider.overrideWith((_, _) async => stats),
          formatDistributionProvider.overrideWith(
            (_, _) async =>
                const FormatDistribution(items: [], totalAnimeCount: 0),
          ),
          viewingDnaProvider.overrideWith(
            (_, _) async => const ViewingDna(axes: [], confidence: 'none'),
          ),
          genreBubbleProvider.overrideWith((_, _) async => const []),
          yearlyScoreProvider.overrideWith((_, _) async => const []),
        ],
        child: const CupertinoApp(home: AnalysisScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('취향'));
    await tester.pumpAndSettle();

    expect(find.text('7.5'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('2020')).dx,
      lessThan(tester.getTopLeft(find.text('2025')).dx),
    );
    expect(
      tester.getTopLeft(find.text('10점')).dy,
      lessThan(tester.getTopLeft(find.text('1점')).dy),
    );
    expect(appGenreColor('Action'), appGenreColor('Action'));
    expect(appGenreColor('새 장르'), appGenreColor('새 장르'));
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

  testWidgets('내 컬렉션에서 작품과 시리즈 보기를 전환한다', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          collectionControllerProvider.overrideWith(
            _CollectionFixtureController.new,
          ),
          seriesCollectionControllerProvider.overrideWith(
            _SeriesCollectionFixtureController.new,
          ),
        ],
        child: const CupertinoApp(home: CollectionScreen()),
      ),
    );
    await tester.pump();
    await tester.tap(find.text('시리즈').first);
    await tester.pump();

    expect(find.text('테스트 시리즈'), findsOneWidget);
    expect(find.text('필수 작품 1/1 · 내 컬렉션 2편'), findsOneWidget);
    expect(find.text('완주율 100%'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('랭킹 작품 모달은 카드 없는 포스터에 선택 평점을 표시한다', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          statsOverviewProvider.overrideWith(
            (_, _) async => const StatsOverview(
              totalCount: 0,
              completedCount: 0,
              watchingCount: 0,
              droppedCount: 0,
              totalWatchedEpisodes: 0,
              totalWatchMinutes: 0,
              genreDistribution: {},
              genreWatchMinutes: {},
              genreAverageScore: {},
              releaseYearDistribution: {},
              scoreDistribution: {},
            ),
          ),
          formatDistributionProvider.overrideWith(
            (_, _) async =>
                const FormatDistribution(items: [], totalAnimeCount: 0),
          ),
          viewingDnaProvider.overrideWith(
            (_, _) async => const ViewingDna(axes: [], confidence: 'none'),
          ),
          studioRankingProvider.overrideWith(
            (_, key) async => const [
              StudioRanking(
                id: 3,
                name: '테스트 스튜디오',
                animeCount: 1,
                totalWatchMinutes: 120,
                averageScore: 9,
              ),
            ],
          ),
          voiceActorRankingProvider.overrideWith((_, key) async => const []),
          studioAnimeProvider.overrideWith(
            (_, key) async => const [
              AnalysisAnimeWork(
                anime: Anime(id: 31, title: '모달 작품', duration: 24),
                score: 9,
                progress: 12,
              ),
            ],
          ),
        ],
        child: const CupertinoApp(home: AnalysisScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('랭킹'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('평균 점수').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('테스트 스튜디오'));
    await tester.pumpAndSettle();

    expect(find.text('모달 작품'), findsOneWidget);
    expect(find.text('★ 9.0'), findsOneWidget);
    expect(
      find.ancestor(of: find.text('모달 작품'), matching: find.byType(AppCard)),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
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
    expect(find.text('인기순'), findsOneWidget);
    expect(find.text('전체 장르'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('검색 포스터를 길게 누르면 반쪽 별 5개를 표시한다', (tester) async {
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

    await tester.longPress(find.text('작품 A'));
    await tester.pump();

    expect(find.byIcon(CupertinoIcons.star_fill), findsNWidgets(10));
    expect(tester.takeException(), isNull);
  });

  testWidgets('애니 상세 화면의 모든 viewport 자식은 sliver로 구성된다', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          animeDetailProvider.overrideWith(
            (_, animeId) async => Anime(
              id: animeId,
              title: '상세 화면 테스트 작품',
              seasonYear: 2025,
              genres: const ['Drama'],
            ),
          ),
          animeCastProvider.overrideWith((_, _) async => const []),
          collectionEntryProvider.overrideWith((_, _) async => null),
        ],
        child: const CupertinoApp(home: AnimeDetailScreen(animeId: 77)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('상세 화면 테스트 작품'), findsWidgets);
    expect(find.text('작품 정보'), findsOneWidget);
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

class _SeriesCollectionFixtureController extends SeriesCollectionController {
  @override
  SeriesCollectionViewState build() => const SeriesCollectionViewState(
    items: [
      SeriesCollectionItem(
        seriesId: 1,
        scope: AnimeSeriesScope.mainline,
        title: '테스트 시리즈',
        memberCount: 2,
        requiredMemberCount: 1,
        collectedMemberCount: 2,
        completedRequiredMemberCount: 1,
        completionRate: 100,
        completed: true,
        items: [],
      ),
    ],
  );

  @override
  void ensureLoaded() {}
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
