import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthUser;

import 'package:myanitrack_mobile/src/api.dart';
import 'package:myanitrack_mobile/src/config.dart';
import 'package:myanitrack_mobile/src/models.dart';

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(
    onSessionFailure: (failure) => unawaited(
      ref.read(sessionControllerProvider.notifier).handleApiFailure(failure),
    ),
  ),
);
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider)),
);
final collectionRepositoryProvider = Provider<CollectionRepository>(
  (ref) => CollectionRepository(ref.watch(apiClientProvider)),
);
final analysisRepositoryProvider = Provider<AnalysisRepository>(
  (ref) => AnalysisRepository(ref.watch(apiClientProvider)),
);
final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(ref.watch(apiClientProvider)),
);

enum SessionPhase {
  bootstrapping,
  signedOut,
  oauthPending,
  backendLinking,
  agreementsRequired,
  authenticated,
}

class SessionState {
  const SessionState({required this.phase, this.user, this.message});
  const SessionState.bootstrapping() : this(phase: SessionPhase.bootstrapping);

  final SessionPhase phase;
  final AuthUser? user;
  final String? message;

  bool get isAuthenticated => phase == SessionPhase.authenticated;
  bool get isBusy =>
      phase == SessionPhase.bootstrapping ||
      phase == SessionPhase.oauthPending ||
      phase == SessionPhase.backendLinking;
}

final sessionControllerProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

class SessionController extends Notifier<SessionState> {
  StreamSubscription<AuthState>? _subscription;
  AppLifecycleListener? _lifecycleListener;
  Timer? _oauthResumeTimer;
  bool _bootstrapping = false;

  @override
  SessionState build() {
    _lifecycleListener ??= AppLifecycleListener(onResume: _onAppResumed);
    ref.onDispose(() {
      _subscription?.cancel();
      _lifecycleListener?.dispose();
      _oauthResumeTimer?.cancel();
    });
    Future<void>.microtask(_start);
    return const SessionState.bootstrapping();
  }

  Future<void> _start() async {
    if (!AppConfig.hasSupabaseConfig) {
      state = const SessionState(
        phase: SessionPhase.signedOut,
        message: 'Supabase 환경 설정이 필요합니다.',
      );
      return;
    }
    _subscription ??= Supabase.instance.client.auth.onAuthStateChange.listen((
      event,
    ) {
      if (event.session == null) {
        if (event.event == AuthChangeEvent.signedOut) {
          state = const SessionState(phase: SessionPhase.signedOut);
        }
        return;
      }
      if (event.event == AuthChangeEvent.signedIn ||
          event.event == AuthChangeEvent.tokenRefreshed ||
          event.event == AuthChangeEvent.initialSession) {
        unawaited(bootstrap());
      }
    });
    await bootstrap();
  }

  Future<void> signInWithGoogle() async {
    if (!AppConfig.hasSupabaseConfig) {
      state = const SessionState(
        phase: SessionPhase.signedOut,
        message: 'SUPABASE_URL과 publishable key를 설정해주세요.',
      );
      return;
    }
    state = const SessionState(phase: SessionPhase.oauthPending);
    try {
      final launched = await Supabase.instance.client.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: AppConfig.authRedirectUrl,
      );
      if (!launched) {
        state = const SessionState(
          phase: SessionPhase.signedOut,
          message: 'Google 로그인 창을 열지 못했습니다.',
        );
      }
    } on Object {
      state = const SessionState(
        phase: SessionPhase.signedOut,
        message: 'Google 로그인을 시작하지 못했습니다.',
      );
    }
  }

  Future<void> bootstrap() async {
    if (_bootstrapping || !AppConfig.hasSupabaseConfig) return;
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) {
      state = const SessionState(phase: SessionPhase.signedOut);
      return;
    }

    _bootstrapping = true;
    state = const SessionState(phase: SessionPhase.backendLinking);
    AuthUser? user;
    try {
      final repository = ref.read(authRepositoryProvider);
      await repository.connectSupabase();
      user = await repository.me();
      final agreements = await repository.agreements();
      state = SessionState(
        phase: agreements.hasRequiredAgreements
            ? SessionPhase.authenticated
            : SessionPhase.agreementsRequired,
        user: user,
      );
    } on ApiFailure catch (error) {
      if (error.needsAgreements) {
        state = SessionState(
          phase: SessionPhase.agreementsRequired,
          user: user,
          message: error.message,
        );
        return;
      }
      if (error.isUnauthorized) {
        await _supabaseSignOut();
      }
      state = SessionState(
        phase: SessionPhase.signedOut,
        message: error.message,
      );
    } on Object {
      state = const SessionState(
        phase: SessionPhase.signedOut,
        message: '계정 정보를 확인하지 못했습니다. 다시 시도해주세요.',
      );
    } finally {
      _bootstrapping = false;
    }
  }

  Future<void> acceptAgreements() async {
    final user = state.user;
    state = SessionState(phase: SessionPhase.backendLinking, user: user);
    try {
      await ref.read(authRepositoryProvider).acceptAgreements();
      state = SessionState(phase: SessionPhase.authenticated, user: user);
    } on ApiFailure catch (error) {
      state = SessionState(
        phase: SessionPhase.agreementsRequired,
        user: user,
        message: error.message,
      );
    }
  }

  Future<void> refreshUser() async {
    final user = await ref.read(authRepositoryProvider).me();
    state = SessionState(phase: SessionPhase.authenticated, user: user);
  }

  Future<void> signOut() async {
    try {
      await ref.read(authRepositoryProvider).logout();
    } on Object {
      // Supabase sign-out remains authoritative for the Google-only client.
    }
    await _supabaseSignOut();
    state = const SessionState(phase: SessionPhase.signedOut);
  }

  Future<void> deleteAccount() async {
    await ref.read(authRepositoryProvider).deleteAccount();
    await _supabaseSignOut();
    state = const SessionState(phase: SessionPhase.signedOut);
  }

  Future<void> _supabaseSignOut() async {
    if (!AppConfig.hasSupabaseConfig) return;
    try {
      await Supabase.instance.client.auth.signOut();
    } on Object {
      // The local state still moves to signed out when the remote call fails.
    }
  }

  Future<void> handleApiFailure(ApiFailure failure) async {
    if (failure.needsAgreements) {
      state = SessionState(
        phase: SessionPhase.agreementsRequired,
        user: state.user,
        message: failure.message,
      );
      return;
    }
    if (!failure.isUnauthorized) return;
    await _supabaseSignOut();
    state = const SessionState(
      phase: SessionPhase.signedOut,
      message: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
    );
  }

  void _onAppResumed() {
    if (state.phase != SessionPhase.oauthPending) return;
    _oauthResumeTimer?.cancel();
    _oauthResumeTimer = Timer(const Duration(milliseconds: 600), () {
      if (state.phase != SessionPhase.oauthPending) return;
      final hasSession = Supabase.instance.client.auth.currentSession != null;
      if (!hasSession) {
        state = const SessionState(
          phase: SessionPhase.signedOut,
          message: 'Google 로그인이 취소되었습니다.',
        );
      }
    });
  }
}

class CollectionQuery {
  const CollectionQuery({
    this.sort = 'latest',
    this.genre,
    this.year,
    this.score,
  });
  final String sort;
  final String? genre;
  final int? year;
  final int? score;
}

class CollectionViewState {
  const CollectionViewState({
    this.items = const [],
    this.query = const CollectionQuery(),
    this.pageInfo = const PageInfo(hasNext: false),
    this.loading = false,
    this.loadingMore = false,
    this.failure,
  });
  final List<CollectionEntry> items;
  final CollectionQuery query;
  final PageInfo pageInfo;
  final bool loading;
  final bool loadingMore;
  final ApiFailure? failure;

  CollectionViewState copyWith({
    List<CollectionEntry>? items,
    CollectionQuery? query,
    PageInfo? pageInfo,
    bool? loading,
    bool? loadingMore,
    ApiFailure? failure,
    bool clearFailure = false,
  }) {
    return CollectionViewState(
      items: items ?? this.items,
      query: query ?? this.query,
      pageInfo: pageInfo ?? this.pageInfo,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      failure: clearFailure ? null : (failure ?? this.failure),
    );
  }
}

final collectionControllerProvider =
    NotifierProvider<CollectionController, CollectionViewState>(
      CollectionController.new,
    );

class CollectionController extends Notifier<CollectionViewState> {
  @override
  CollectionViewState build() {
    Future<void>.microtask(refresh);
    return const CollectionViewState(loading: true);
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, clearFailure: true);
    try {
      final page = await _fetch();
      state = state.copyWith(
        items: page.items,
        pageInfo: page.pageInfo,
        loading: false,
        clearFailure: true,
      );
    } on ApiFailure catch (error) {
      state = state.copyWith(loading: false, failure: error);
    }
  }

  Future<void> setQuery(CollectionQuery query) async {
    state = CollectionViewState(query: query, loading: true);
    await refresh();
  }

  Future<void> loadMore() async {
    if (!state.pageInfo.hasNext || state.loadingMore) return;
    state = state.copyWith(loadingMore: true, clearFailure: true);
    try {
      final page = await _fetch(cursor: state.pageInfo.nextCursor);
      state = state.copyWith(
        items: [...state.items, ...page.items],
        pageInfo: page.pageInfo,
        loadingMore: false,
      );
    } on ApiFailure catch (error) {
      state = state.copyWith(loadingMore: false, failure: error);
    }
  }

  Future<CursorPage<CollectionEntry>> _fetch({String? cursor}) {
    final query = state.query;
    return ref
        .read(collectionRepositoryProvider)
        .list(
          sort: query.sort,
          genre: query.genre,
          year: query.year,
          score: query.score,
          cursor: cursor,
        );
  }
}

class SearchViewState {
  const SearchViewState({
    this.query = '',
    this.items = const [],
    this.pageInfo = const PageInfo(hasNext: false),
    this.loading = false,
    this.loadingMore = false,
    this.failure,
  });
  final String query;
  final List<AnimeSearchResult> items;
  final PageInfo pageInfo;
  final bool loading;
  final bool loadingMore;
  final ApiFailure? failure;
}

final searchControllerProvider =
    NotifierProvider<SearchController, SearchViewState>(SearchController.new);

class SearchController extends Notifier<SearchViewState> {
  Timer? _debounce;
  CancelToken? _cancelToken;

  @override
  SearchViewState build() {
    ref.onDispose(() {
      _debounce?.cancel();
      _cancelToken?.cancel();
    });
    return const SearchViewState();
  }

  void setQuery(String value) {
    final query = value.trim();
    _debounce?.cancel();
    _cancelToken?.cancel();
    if (query.length < 2) {
      state = SearchViewState(query: query);
      return;
    }
    state = SearchViewState(query: query, loading: true);
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(query));
  }

  Future<void> refresh() async {
    if (state.query.length < 2) return;
    await _search(state.query);
  }

  Future<void> _search(String query) async {
    _cancelToken = CancelToken();
    try {
      final page = await ref
          .read(collectionRepositoryProvider)
          .search(query, cancelToken: _cancelToken);
      if (query != state.query) return;
      state = SearchViewState(
        query: query,
        items: page.items,
        pageInfo: page.pageInfo,
      );
    } on DioException catch (error) {
      if (!CancelToken.isCancel(error)) {
        rethrow;
      }
    } on ApiFailure catch (error) {
      if (query == state.query) {
        state = SearchViewState(query: query, failure: error);
      }
    }
  }

  Future<void> loadMore() async {
    if (!state.pageInfo.hasNext || state.loadingMore) return;
    state = SearchViewState(
      query: state.query,
      items: state.items,
      pageInfo: state.pageInfo,
      loadingMore: true,
    );
    try {
      final page = await ref
          .read(collectionRepositoryProvider)
          .search(state.query, cursor: state.pageInfo.nextCursor);
      state = SearchViewState(
        query: state.query,
        items: [...state.items, ...page.items],
        pageInfo: page.pageInfo,
      );
    } on ApiFailure catch (error) {
      state = SearchViewState(
        query: state.query,
        items: state.items,
        pageInfo: state.pageInfo,
        failure: error,
      );
    }
  }
}

final animeDetailProvider = FutureProvider.family<Anime, int>(
  (ref, animeId) =>
      ref.watch(collectionRepositoryProvider).animeDetail(animeId),
);
final animeCastProvider = FutureProvider.family<List<AnimeCastMember>, int>(
  (ref, animeId) => ref.watch(collectionRepositoryProvider).cast(animeId),
);
final collectionEntryProvider = FutureProvider.family<CollectionEntry?, int>(
  (ref, animeId) => ref.watch(collectionRepositoryProvider).entry(animeId),
);

final statsOverviewProvider = FutureProvider<StatsOverview>(
  (ref) => ref.watch(analysisRepositoryProvider).overview(),
);
final formatDistributionProvider = FutureProvider<FormatDistribution>(
  (ref) => ref.watch(analysisRepositoryProvider).formats(),
);
final genreBubbleProvider = FutureProvider<List<GenreBubble>>(
  (ref) => ref.watch(analysisRepositoryProvider).genres(),
);
final yearlyScoreProvider = FutureProvider<List<YearlyScore>>(
  (ref) => ref.watch(analysisRepositoryProvider).yearlyScores(),
);
final studioRankingProvider =
    FutureProvider.family<List<StudioRanking>, String>(
      (ref, sort) => ref.watch(analysisRepositoryProvider).studios(sort: sort),
    );
final voiceActorRankingProvider =
    FutureProvider.family<List<VoiceActorRanking>, String>(
      (ref, sort) =>
          ref.watch(analysisRepositoryProvider).voiceActors(sort: sort),
    );

final studioAnimeProvider = FutureProvider.family<List<Anime>, int>(
  (ref, id) => ref.watch(analysisRepositoryProvider).studioAnime(id),
);
final voiceActorAnimeProvider = FutureProvider.family<List<Anime>, int>(
  (ref, id) => ref.watch(analysisRepositoryProvider).voiceActorAnime(id),
);

void invalidateUserData(WidgetRef ref) {
  ref.invalidate(collectionControllerProvider);
  ref.invalidate(searchControllerProvider);
  ref.invalidate(statsOverviewProvider);
  ref.invalidate(formatDistributionProvider);
  ref.invalidate(genreBubbleProvider);
  ref.invalidate(yearlyScoreProvider);
  ref.invalidate(studioRankingProvider);
  ref.invalidate(voiceActorRankingProvider);
}
