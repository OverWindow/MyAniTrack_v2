import 'dart:io';

import 'package:dio/dio.dart';
import 'package:crop_your_image/crop_your_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:myanitrack_mobile/src/app.dart';
import 'package:myanitrack_mobile/src/api.dart';
import 'package:myanitrack_mobile/src/models.dart';
import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/screens/analysis_screen.dart';
import 'package:myanitrack_mobile/src/screens/collection_screens.dart';
import 'package:myanitrack_mobile/src/screens/friends_screen.dart';
import 'package:myanitrack_mobile/src/screens/profile_screen.dart';
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
              '/search': '탐색 화면',
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
    expect(find.text('탐색'), findsOneWidget);
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

  testWidgets('컬렉션 포스터는 제목 길이와 관계없이 같은 2:3 크기를 유지한다', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          collectionControllerProvider.overrideWith(
            _PosterCollectionFixtureController.new,
          ),
          seriesCollectionControllerProvider.overrideWith(
            _SeriesCollectionFixtureController.new,
          ),
        ],
        child: const CupertinoApp(home: CollectionScreen()),
      ),
    );
    await tester.pump();

    final short = tester.getSize(
      find.byKey(const ValueKey('collection-poster-101')),
    );
    final long = tester.getSize(
      find.byKey(const ValueKey('collection-poster-102')),
    );
    expect(short, long);
    expect(short.width / short.height, closeTo(2 / 3, 0.001));
    expect(tester.takeException(), isNull);
  });

  testWidgets('시리즈 완주율 바는 퍼센트만큼 가로로 채워진다', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
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
            _PartialSeriesCollectionFixtureController.new,
          ),
        ],
        child: const CupertinoApp(home: CollectionScreen()),
      ),
    );
    await tester.pump();
    await tester.tap(find.text('시리즈').first);
    await tester.pump();

    final track = tester.getSize(
      find.byKey(const ValueKey('series-completion-track-42')),
    );
    final fill = tester.getSize(
      find.byKey(const ValueKey('series-completion-fill-42')),
    );
    expect(fill.height, track.height);
    expect(fill.width / track.width, closeTo(.42, .01));
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

  testWidgets('작품 탐색 결과를 2열로 배치하고 포스터 위에 추가 버튼을 둔다', (tester) async {
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

  testWidgets('탐색 결과에서 완료한 작품은 수정 버튼 대신 체크로 표시한다', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        key: const ValueKey('search-completion-scope'),
        overrides: [
          searchControllerProvider.overrideWith(
            _SearchCompletionFixtureController.new,
          ),
        ],
        child: const CupertinoApp(home: AnimeSearchScreen()),
      ),
    );
    await tester.pump();

    expect(
      find.byWidgetPredicate(
        (widget) => widget is Semantics && widget.properties.label == '완료한 작품',
      ),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('completed-anime-check')), findsOneWidget);
    expect(find.byIcon(CupertinoIcons.pencil), findsOneWidget);
    expect(find.byIcon(CupertinoIcons.add), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('컬렉션과 탐색은 키보드 고정 배경 없이 스크롤 여유를 제공한다', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    tester.view.viewInsets = const FakeViewPadding(bottom: 280);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);

    await tester.pumpWidget(
      ProviderScope(
        key: const ValueKey('collection-keyboard-scope'),
        overrides: [
          collectionControllerProvider.overrideWith(
            _CollectionFixtureController.new,
          ),
        ],
        child: const CupertinoApp(home: CollectionScreen()),
      ),
    );
    await tester.pump();
    var scaffold = tester.widget<CupertinoPageScaffold>(
      find.byType(CupertinoPageScaffold).first,
    );
    expect(scaffold.resizeToAvoidBottomInset, isFalse);
    expect(
      tester
          .getSize(find.byKey(const ValueKey('collection-keyboard-spacer')))
          .height,
      280,
    );

    await tester.pumpWidget(
      ProviderScope(
        key: const ValueKey('search-keyboard-scope'),
        overrides: [
          searchControllerProvider.overrideWith(_SearchFixtureController.new),
        ],
        child: const CupertinoApp(home: AnimeSearchScreen()),
      ),
    );
    await tester.pump();
    scaffold = tester.widget<CupertinoPageScaffold>(
      find.byType(CupertinoPageScaffold).first,
    );
    expect(scaffold.resizeToAvoidBottomInset, isFalse);
    expect(
      tester
          .getSize(find.byKey(const ValueKey('search-keyboard-spacer')))
          .height,
      280,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('친구 검색과 공개 컬렉션은 키보드 높이를 스크롤 여백으로 제공한다', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    tester.view.viewInsets = const FakeViewPadding(bottom: 280);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);

    await tester.pumpWidget(
      ProviderScope(
        key: const ValueKey('friend-keyboard-scope'),
        overrides: [
          friendSnapshotProvider.overrideWith(
            (_) async =>
                const FriendSnapshot(friends: [], incoming: [], outgoing: []),
          ),
        ],
        child: const CupertinoApp(home: FriendsScreen()),
      ),
    );
    await tester.pumpAndSettle();
    var scaffold = tester.widget<CupertinoPageScaffold>(
      find.byType(CupertinoPageScaffold).first,
    );
    expect(scaffold.resizeToAvoidBottomInset, isFalse);
    expect(
      tester
          .getSize(find.byKey(const ValueKey('friend-search-keyboard-spacer')))
          .height,
      280,
    );

    await tester.pumpWidget(
      ProviderScope(
        key: const ValueKey('public-collection-keyboard-scope'),
        overrides: [
          friendsRepositoryProvider.overrideWithValue(
            _RecordingFriendsRepository(),
          ),
        ],
        child: const CupertinoApp(home: PublicCollectionScreen(userId: 9)),
      ),
    );
    await tester.pumpAndSettle();
    scaffold = tester.widget<CupertinoPageScaffold>(
      find.byType(CupertinoPageScaffold).first,
    );
    expect(scaffold.resizeToAvoidBottomInset, isFalse);
    expect(
      tester
          .getSize(
            find.byKey(const ValueKey('public-collection-keyboard-spacer')),
          )
          .height,
      280,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('프로필 메모리 이미지와 제거 상태를 네트워크보다 우선한다', (tester) async {
    final bytes = File('assets/images/default-profile.jpeg').readAsBytesSync();
    await tester.pumpWidget(
      CupertinoApp(
        home: AppNetworkImage(
          url: 'https://example.com/old.jpg',
          memoryBytes: bytes,
          profile: true,
        ),
      ),
    );
    await tester.pump();
    expect(tester.widget<Image>(find.byType(Image)).image, isA<MemoryImage>());

    await tester.pumpWidget(
      CupertinoApp(
        home: AppNetworkImage(
          url: 'https://example.com/old.jpg',
          memoryBytes: bytes,
          removed: true,
          profile: true,
        ),
      ),
    );
    await tester.pump();
    expect(tester.widget<Image>(find.byType(Image)).image, isA<AssetImage>());
  });

  testWidgets('탐색 포스터를 길게 누르면 반쪽 별 5개를 표시한다', (tester) async {
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
              format: 'TV',
              episodes: 12,
              duration: 24,
              averageScore: 82,
              description: 'This English synopsis must not be rendered.',
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
    expect(find.text('방영 연도'), findsOneWidget);
    expect(find.text('TV 애니메이션'), findsOneWidget);
    expect(find.text('에피소드'), findsOneWidget);
    expect(find.text('커뮤니티 평점'), findsOneWidget);
    expect(find.text('드라마'), findsOneWidget);
    expect(
      find.text('This English synopsis must not be rendered.'),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('성우 출연작은 첫 캐릭터만 보이고 더보기에서 전체를 연다', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
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
          studioRankingProvider.overrideWith((_, _) async => const []),
          voiceActorRankingProvider.overrideWith(
            (_, _) async => const [
              VoiceActorRanking(
                id: 9,
                name: '테스트 성우',
                animeCount: 1,
                characterCount: 2,
              ),
            ],
          ),
          voiceActorAnimeProvider.overrideWith(
            (_, _) async => const [
              AnalysisAnimeWork(
                anime: Anime(id: 77, title: '두 역할 작품'),
                characters: [
                  VoiceActorCharacter(id: 1, name: '첫 캐릭터', role: 'MAIN'),
                  VoiceActorCharacter(id: 2, name: '둘째 캐릭터', role: 'SUPPORT'),
                ],
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
    await tester.tap(find.text('테스트 성우'));
    await tester.pumpAndSettle();

    expect(find.text('첫 캐릭터'), findsOneWidget);
    expect(find.text('둘째 캐릭터'), findsNothing);
    final more = find.byKey(const ValueKey('voice-characters-more-77'));
    expect(more, findsOneWidget);
    final poster = find.byKey(const ValueKey('voice-work-poster-77'));
    expect(tester.getSize(poster).height, greaterThan(300));
    final horizontalList = find
        .byWidgetPredicate(
          (widget) =>
              widget is ListView && widget.scrollDirection == Axis.horizontal,
        )
        .last;
    expect(
      tester.getBottomRight(horizontalList).dy -
          tester.getBottomRight(find.text('첫 캐릭터')).dy,
      lessThan(55),
    );
    await tester.tap(more);
    await tester.pumpAndSettle();

    expect(find.text('첫 캐릭터'), findsWidgets);
    expect(find.text('둘째 캐릭터'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('친구 컬렉션 필터는 검색어를 보존해 정렬 조건과 함께 요청한다', (tester) async {
    final repository = _RecordingFriendsRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [friendsRepositoryProvider.overrideWithValue(repository)],
        child: const CupertinoApp(home: PublicCollectionScreen(userId: 9)),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(CupertinoSearchTextField), '프리렌');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(CupertinoIcons.slider_horizontal_3));
    await tester.pumpAndSettle();
    await tester.tap(find.text('평점↓'));
    await tester.tap(find.text('적용하기'));
    await tester.pumpAndSettle();

    expect(repository.lastQuery, '프리렌');
    expect(repository.lastSort, 'score');
    expect(tester.takeException(), isNull);
  });

  testWidgets('태블릿 세로와 가로에서 포스터 그리드가 3열과 4열로 전환된다', (tester) async {
    tester.view.physicalSize = const Size(768, 1024);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          searchControllerProvider.overrideWith(
            _TabletSearchFixtureController.new,
          ),
        ],
        child: const CupertinoApp(home: AnimeSearchScreen()),
      ),
    );
    await tester.pump();

    final a = tester.getTopLeft(find.text('태블릿 A'));
    final c = tester.getTopLeft(find.text('태블릿 C'));
    final d = tester.getTopLeft(find.text('태블릿 D'));
    expect((a.dy - c.dy).abs(), lessThan(2));
    expect(d.dy, greaterThan(a.dy + 20));

    tester.view.physicalSize = const Size(1024, 768);
    await tester.pump();
    final landscapeA = tester.getTopLeft(find.text('태블릿 A'));
    final landscapeD = tester.getTopLeft(find.text('태블릿 D'));
    expect((landscapeA.dy - landscapeD.dy).abs(), lessThan(2));
    expect(
      tester.getSize(find.byType(CustomScrollView).first).width,
      lessThanOrEqualTo(AppLayout.contentMaxWidth),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('프로필 크롭 화면은 3×3 격자와 확대 슬라이더를 제공한다', (tester) async {
    final bytes = File('assets/images/default-profile.jpeg').readAsBytesSync();
    await tester.pumpWidget(
      CupertinoApp(home: ProfileCropScreen(image: bytes)),
    );
    await tester.pump();

    expect(
      find.byKey(const ValueKey('profile-crop-zoom-slider')),
      findsOneWidget,
    );
    final cropFinder = find.byType(Crop);
    final crop = tester.widget<Crop>(cropFinder);
    expect(crop.overlayBuilder, isNotNull);
    final overlay = crop.overlayBuilder!(
      tester.element(cropFinder),
      const Rect.fromLTWH(0, 0, 240, 240),
    );
    await tester.pumpWidget(CupertinoApp(home: Center(child: overlay)));
    await tester.pump();
    expect(
      find.byKey(const ValueKey('profile-crop-thirds-grid')),
      findsOneWidget,
    );
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

class _PosterCollectionFixtureController extends CollectionController {
  @override
  CollectionViewState build() => const CollectionViewState(
    totalCount: 2,
    items: [
      CollectionEntry(
        entryId: 1,
        userId: 7,
        animeId: 101,
        status: CollectionStatus.completed,
        anime: Anime(id: 101, title: '짧은 제목'),
      ),
      CollectionEntry(
        entryId: 2,
        userId: 7,
        animeId: 102,
        status: CollectionStatus.completed,
        anime: Anime(id: 102, title: '두 줄을 모두 사용하는 긴 애니메이션 제목'),
      ),
    ],
  );
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

class _PartialSeriesCollectionFixtureController
    extends SeriesCollectionController {
  @override
  SeriesCollectionViewState build() => const SeriesCollectionViewState(
    items: [
      SeriesCollectionItem(
        seriesId: 42,
        scope: AnimeSeriesScope.mainline,
        title: '42퍼센트 시리즈',
        memberCount: 10,
        requiredMemberCount: 10,
        collectedMemberCount: 4,
        completedRequiredMemberCount: 4,
        completionRate: 42,
        completed: false,
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

class _SearchCompletionFixtureController extends SearchController {
  @override
  SearchViewState build() => const SearchViewState(
    query: '상태',
    items: [
      AnimeSearchResult(
        anime: Anime(id: 1, title: '완료 작품'),
        myCollection: MyCollectionState(
          exists: true,
          status: CollectionStatus.completed,
        ),
      ),
      AnimeSearchResult(
        anime: Anime(id: 2, title: '보는 중 작품'),
        myCollection: MyCollectionState(
          exists: true,
          status: CollectionStatus.watching,
        ),
      ),
      AnimeSearchResult(anime: Anime(id: 3, title: '미등록 작품')),
    ],
  );
}

class _TabletSearchFixtureController extends SearchController {
  @override
  SearchViewState build() => const SearchViewState(
    query: '태블릿',
    items: [
      AnimeSearchResult(anime: Anime(id: 1, title: '태블릿 A')),
      AnimeSearchResult(anime: Anime(id: 2, title: '태블릿 B')),
      AnimeSearchResult(anime: Anime(id: 3, title: '태블릿 C')),
      AnimeSearchResult(anime: Anime(id: 4, title: '태블릿 D')),
    ],
  );
}

class _RecordingFriendsRepository extends FriendsRepository {
  _RecordingFriendsRepository() : super(ApiClient());

  String? lastQuery;
  String? lastSort;

  @override
  Future<CursorPage<CollectionEntry>> collection(
    int userId, {
    String? query,
    String? genre,
    String? format,
    int? year,
    int? score,
    String sort = 'latest',
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    lastQuery = query;
    lastSort = sort;
    return const CursorPage(
      items: [],
      pageInfo: PageInfo(hasNext: false),
      totalCount: 0,
    );
  }
}
