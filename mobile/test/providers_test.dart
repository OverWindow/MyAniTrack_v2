import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';

import 'package:myanitrack_mobile/src/api.dart';
import 'package:myanitrack_mobile/src/models.dart';
import 'package:myanitrack_mobile/src/providers.dart';

void main() {
  test('공개 분석 repository는 모든 요약·랭킹·작품 경로에 userId를 사용한다', () async {
    final api = _RecordingApiClient();
    final repository = AnalysisRepository(api, userId: 42);

    await repository.overview();
    await repository.studios();
    await repository.studioAnime(7);
    await repository.voiceActors(sort: 'watchTime');
    await repository.voiceActorAnime(9);

    expect(api.paths, [
      '/users/42/anime-stats',
      '/users/42/anime-stats/studios',
      '/users/42/anime-stats/studios/7/anime',
      '/users/42/voice-actors/ranking',
      '/users/42/voice-actors/9/anime',
    ]);
    expect(api.queries[3]?['sort'], 'watchTime');
  });

  test('로그인 사용자 ID가 바뀌면 홈과 친구 데이터를 다시 요청한다', () async {
    final home = _CountingHomeRepository();
    final friends = _CountingFriendsRepository();
    final container = ProviderContainer(
      overrides: [
        sessionControllerProvider.overrideWith(
          _SwitchableSessionController.new,
        ),
        homeRepositoryProvider.overrideWithValue(home),
        friendsRepositoryProvider.overrideWithValue(friends),
      ],
    );
    addTearDown(container.dispose);

    final favoriteSubscription = container.listen(
      favoriteAnimeProvider,
      (_, _) {},
      fireImmediately: true,
    );
    final badgeSubscription = container.listen(
      badgeOverviewProvider,
      (_, _) {},
      fireImmediately: true,
    );
    final friendSubscription = container.listen(
      friendSnapshotProvider,
      (_, _) {},
      fireImmediately: true,
    );
    addTearDown(favoriteSubscription.close);
    addTearDown(badgeSubscription.close);
    addTearDown(friendSubscription.close);

    await Future.wait([
      container.read(favoriteAnimeProvider.future),
      container.read(badgeOverviewProvider.future),
      container.read(friendSnapshotProvider.future),
    ]);
    expect(home.favoriteCalls, 1);
    expect(home.badgeCalls, 1);
    expect(friends.snapshotCalls, 1);

    final session =
        container.read(sessionControllerProvider.notifier)
            as _SwitchableSessionController;
    session.switchTo(2);

    await Future.wait([
      container.read(favoriteAnimeProvider.future),
      container.read(badgeOverviewProvider.future),
      container.read(friendSnapshotProvider.future),
    ]);
    expect(home.favoriteCalls, 2);
    expect(home.badgeCalls, 2);
    expect(friends.snapshotCalls, 2);
  });
}

class _RecordingApiClient extends ApiClient {
  final List<String> paths = [];
  final List<Map<String, dynamic>?> queries = [];

  @override
  Future<JsonMap> get(
    String path, {
    Map<String, dynamic>? query,
    bool authenticated = true,
    CancelToken? cancelToken,
  }) async {
    paths.add(path);
    queries.add(query);
    return const {'items': <Object>[]};
  }
}

class _SwitchableSessionController extends SessionController {
  @override
  SessionState build() => _session(1);

  void switchTo(int id) => state = _session(id);

  static SessionState _session(int id) => SessionState(
    phase: SessionPhase.authenticated,
    user: AuthUser(
      id: id,
      email: 'user$id@example.com',
      username: '사용자$id',
      role: 'USER',
      emailVerified: true,
    ),
  );
}

class _CountingHomeRepository extends HomeRepository {
  _CountingHomeRepository() : super(ApiClient());

  int favoriteCalls = 0;
  int badgeCalls = 0;

  @override
  Future<List<CollectionEntry>> favorites() async {
    favoriteCalls += 1;
    return const [];
  }

  @override
  Future<BadgeOverview> badges() async {
    badgeCalls += 1;
    return const BadgeOverview(items: [], earnedCount: 0, totalCount: 0);
  }
}

class _CountingFriendsRepository extends FriendsRepository {
  _CountingFriendsRepository() : super(ApiClient());

  int snapshotCalls = 0;

  @override
  Future<FriendSnapshot> snapshot() async {
    snapshotCalls += 1;
    return const FriendSnapshot(friends: [], incoming: [], outgoing: []);
  }
}
