import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthUser;

import 'package:myanitrack_mobile/src/api.dart';
import 'package:myanitrack_mobile/src/config.dart';
import 'package:myanitrack_mobile/src/models.dart';
import 'package:myanitrack_mobile/src/native_google_auth.dart';

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
final googleAuthGatewayProvider = Provider<GoogleAuthGateway>(
  (_) => NativeGoogleAuthGateway(),
);
final authConfigurationReadyProvider = Provider<bool>(
  (_) => AppConfig.hasSupabaseConfig,
);
final collectionRepositoryProvider = Provider<CollectionRepository>(
  (ref) => CollectionRepository(ref.watch(apiClientProvider)),
);
final homeRepositoryProvider = Provider<HomeRepository>(
  (ref) => HomeRepository(ref.watch(apiClientProvider)),
);
final friendsRepositoryProvider = Provider<FriendsRepository>(
  (ref) => FriendsRepository(ref.watch(apiClientProvider)),
);
final analysisRepositoryProvider = Provider.autoDispose
    .family<AnalysisRepository, int?>((ref, userId) {
      ref.watch(activeUserIdProvider);
      return AnalysisRepository(ref.watch(apiClientProvider), userId: userId);
    });
final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(ref.watch(apiClientProvider)),
);

enum SessionPhase {
  bootstrapping,
  signedOut,
  googlePending,
  backendLinking,
  agreementsRequired,
  authenticated,
}

class SessionState {
  const SessionState({
    required this.phase,
    this.user,
    this.message,
    this.profileImageRevision = 0,
    this.profileImagePreview,
    this.profileImageRemoved = false,
  });
  const SessionState.bootstrapping() : this(phase: SessionPhase.bootstrapping);

  final SessionPhase phase;
  final AuthUser? user;
  final String? message;
  final int profileImageRevision;
  final Uint8List? profileImagePreview;
  final bool profileImageRemoved;

  bool get isAuthenticated => phase == SessionPhase.authenticated;
  bool get isBusy =>
      phase == SessionPhase.bootstrapping ||
      phase == SessionPhase.googlePending ||
      phase == SessionPhase.backendLinking;
}

final sessionControllerProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

final activeUserIdProvider = Provider<int?>((ref) {
  return ref.watch(
    sessionControllerProvider.select((session) => session.user?.id),
  );
});

class SessionController extends Notifier<SessionState> {
  StreamSubscription<AuthState>? _subscription;
  bool _bootstrapping = false;
  bool _handlingSessionFailure = false;

  @override
  SessionState build() {
    ref.onDispose(() {
      _subscription?.cancel();
    });
    Future<void>.microtask(_start);
    return const SessionState.bootstrapping();
  }

  Future<void> _start() async {
    if (!ref.read(authConfigurationReadyProvider)) {
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
    if (!ref.read(authConfigurationReadyProvider)) {
      state = const SessionState(
        phase: SessionPhase.signedOut,
        message: 'SUPABASE_URL과 publishable key를 설정해주세요.',
      );
      return;
    }
    state = const SessionState(phase: SessionPhase.googlePending);
    try {
      await ref.read(googleAuthGatewayProvider).signIn();
      await bootstrap();
    } on NativeGoogleAuthFailure catch (error) {
      state = SessionState(
        phase: SessionPhase.signedOut,
        message: error.message,
      );
    } on Object {
      state = const SessionState(
        phase: SessionPhase.signedOut,
        message: 'Google 로그인을 완료하지 못했습니다.',
      );
    }
  }

  Future<void> bootstrap() async {
    if (_bootstrapping || !ref.read(authConfigurationReadyProvider)) return;
    _bootstrapping = true;
    try {
      var recoveryAttempted = false;
      while (true) {
        if (Supabase.instance.client.auth.currentSession == null) {
          if (recoveryAttempted || !await _restoreGoogleSession()) {
            state = const SessionState(phase: SessionPhase.signedOut);
            return;
          }
          recoveryAttempted = true;
        }

        state = SessionState(
          phase: SessionPhase.backendLinking,
          profileImageRevision: state.profileImageRevision,
          profileImagePreview: state.profileImagePreview,
          profileImageRemoved: state.profileImageRemoved,
        );
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
            profileImageRevision: state.profileImageRevision,
            profileImagePreview: state.profileImagePreview,
            profileImageRemoved: state.profileImageRemoved,
          );
          return;
        } on ApiFailure catch (error) {
          if (error.needsAgreements) {
            state = SessionState(
              phase: SessionPhase.agreementsRequired,
              user: user,
              message: error.message,
              profileImageRevision: state.profileImageRevision,
              profileImagePreview: state.profileImagePreview,
              profileImageRemoved: state.profileImageRemoved,
            );
            return;
          }
          if (!error.isUnauthorized || recoveryAttempted) {
            if (error.isUnauthorized) await _clearSupabaseSession();
            state = SessionState(
              phase: SessionPhase.signedOut,
              message: error.message,
            );
            return;
          }
          recoveryAttempted = true;
          if (!await _refreshOrRestoreSession()) {
            state = SessionState(
              phase: SessionPhase.signedOut,
              message: error.message,
            );
            return;
          }
        } on Object {
          state = const SessionState(
            phase: SessionPhase.signedOut,
            message: '계정 정보를 확인하지 못했습니다. 다시 시도해주세요.',
          );
          return;
        }
      }
    } finally {
      _bootstrapping = false;
    }
  }

  Future<void> acceptAgreements() async {
    final user = state.user;
    final profileImageRevision = state.profileImageRevision;
    final profileImagePreview = state.profileImagePreview;
    final profileImageRemoved = state.profileImageRemoved;
    state = SessionState(
      phase: SessionPhase.backendLinking,
      user: user,
      profileImageRevision: profileImageRevision,
      profileImagePreview: profileImagePreview,
      profileImageRemoved: profileImageRemoved,
    );
    try {
      final agreements = await ref
          .read(authRepositoryProvider)
          .acceptAgreements();
      if (!agreements.hasRequiredAgreements) {
        state = SessionState(
          phase: SessionPhase.agreementsRequired,
          user: user,
          message: '약관 동의가 서버에 저장되지 않았습니다. 잠시 후 다시 시도해주세요.',
          profileImageRevision: profileImageRevision,
          profileImagePreview: profileImagePreview,
          profileImageRemoved: profileImageRemoved,
        );
        return;
      }
      state = SessionState(
        phase: SessionPhase.authenticated,
        user: user,
        profileImageRevision: profileImageRevision,
        profileImagePreview: profileImagePreview,
        profileImageRemoved: profileImageRemoved,
      );
    } on ApiFailure catch (error) {
      state = SessionState(
        phase: SessionPhase.agreementsRequired,
        user: user,
        message: error.message,
        profileImageRevision: profileImageRevision,
        profileImagePreview: profileImagePreview,
        profileImageRemoved: profileImageRemoved,
      );
    }
  }

  Future<void> refreshUser() async {
    final user = await ref.read(authRepositoryProvider).me();
    applyUpdatedUser(user);
  }

  void applyUpdatedUser(
    AuthUser user, {
    bool profileImageChanged = false,
    Uint8List? profileImagePreview,
    bool profileImageRemoved = false,
  }) {
    state = SessionState(
      phase: SessionPhase.authenticated,
      user: user,
      profileImageRevision:
          state.profileImageRevision + (profileImageChanged ? 1 : 0),
      profileImagePreview: profileImageChanged
          ? profileImagePreview
          : state.profileImagePreview,
      profileImageRemoved: profileImageChanged
          ? profileImageRemoved
          : state.profileImageRemoved,
    );
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
    if (!ref.read(authConfigurationReadyProvider)) return;
    try {
      await Supabase.instance.client.auth.signOut();
    } on Object {
      // The local state still moves to signed out when the remote call fails.
    }
    await ref.read(googleAuthGatewayProvider).signOut();
  }

  Future<void> handleApiFailure(ApiFailure failure) async {
    if (failure.needsAgreements) {
      state = SessionState(
        phase: SessionPhase.agreementsRequired,
        user: state.user,
        message: failure.message,
        profileImageRevision: state.profileImageRevision,
        profileImagePreview: state.profileImagePreview,
        profileImageRemoved: state.profileImageRemoved,
      );
      return;
    }
    if (!failure.isUnauthorized) return;
    if (_bootstrapping || _handlingSessionFailure) return;
    _handlingSessionFailure = true;
    try {
      await bootstrap();
      if (!state.isAuthenticated &&
          state.phase != SessionPhase.agreementsRequired) {
        state = const SessionState(
          phase: SessionPhase.signedOut,
          message: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
        );
      }
    } finally {
      _handlingSessionFailure = false;
    }
  }

  Future<bool> _refreshOrRestoreSession() async {
    try {
      final response = await Supabase.instance.client.auth.refreshSession();
      if (response.session != null) return true;
    } on Object {
      // Fall through to the non-interactive Google restoration path.
    }
    await _clearSupabaseSession();
    return _restoreGoogleSession();
  }

  Future<bool> _restoreGoogleSession() async {
    try {
      return await ref.read(googleAuthGatewayProvider).restorePreviousSession();
    } on Object {
      return false;
    }
  }

  Future<void> _clearSupabaseSession() async {
    if (!ref.read(authConfigurationReadyProvider)) return;
    try {
      await Supabase.instance.client.auth.signOut();
    } on Object {
      // Clearing local app state is sufficient when the auth service is offline.
    }
  }
}

class CollectionQuery {
  const CollectionQuery({
    this.sort = 'latest',
    this.genre,
    this.year,
    this.score,
    this.searchQuery,
  });
  final String sort;
  final String? genre;
  final int? year;
  final int? score;
  final String? searchQuery;

  CollectionQuery copyWith({
    String? sort,
    String? genre,
    int? year,
    int? score,
    String? searchQuery,
    bool clearGenre = false,
    bool clearYear = false,
    bool clearScore = false,
    bool clearSearch = false,
  }) => CollectionQuery(
    sort: sort ?? this.sort,
    genre: clearGenre ? null : (genre ?? this.genre),
    year: clearYear ? null : (year ?? this.year),
    score: clearScore ? null : (score ?? this.score),
    searchQuery: clearSearch ? null : (searchQuery ?? this.searchQuery),
  );
}

class CollectionViewState {
  const CollectionViewState({
    this.items = const [],
    this.query = const CollectionQuery(),
    this.pageInfo = const PageInfo(hasNext: false),
    this.loading = false,
    this.loadingMore = false,
    this.totalCount = 0,
    this.failure,
  });
  final List<CollectionEntry> items;
  final CollectionQuery query;
  final PageInfo pageInfo;
  final bool loading;
  final bool loadingMore;
  final int totalCount;
  final ApiFailure? failure;

  CollectionViewState copyWith({
    List<CollectionEntry>? items,
    CollectionQuery? query,
    PageInfo? pageInfo,
    bool? loading,
    bool? loadingMore,
    int? totalCount,
    ApiFailure? failure,
    bool clearFailure = false,
  }) {
    return CollectionViewState(
      items: items ?? this.items,
      query: query ?? this.query,
      pageInfo: pageInfo ?? this.pageInfo,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      totalCount: totalCount ?? this.totalCount,
      failure: clearFailure ? null : (failure ?? this.failure),
    );
  }
}

final collectionControllerProvider =
    NotifierProvider<CollectionController, CollectionViewState>(
      CollectionController.new,
    );

class CollectionController extends Notifier<CollectionViewState> {
  Timer? _searchDebounce;
  CancelToken? _cancelToken;

  @override
  CollectionViewState build() {
    ref.watch(activeUserIdProvider);
    ref.onDispose(() {
      _searchDebounce?.cancel();
      _cancelToken?.cancel();
    });
    Future<void>.microtask(refresh);
    return const CollectionViewState(loading: true);
  }

  Future<void> refresh() async {
    _cancelToken?.cancel();
    _cancelToken = CancelToken();
    state = state.copyWith(loading: true, clearFailure: true);
    try {
      final page = await _fetch(cancelToken: _cancelToken);
      state = state.copyWith(
        items: page.items,
        pageInfo: page.pageInfo,
        totalCount: page.totalCount ?? state.totalCount,
        loading: false,
        clearFailure: true,
      );
    } on DioException catch (error) {
      if (!CancelToken.isCancel(error)) rethrow;
    } on ApiFailure catch (error) {
      state = state.copyWith(loading: false, failure: error);
    }
  }

  Future<void> setQuery(CollectionQuery query) async {
    state = CollectionViewState(
      query: query,
      loading: true,
      totalCount: state.totalCount,
    );
    await refresh();
  }

  void setSearchQuery(String value) {
    final searchQuery = value.trim();
    _searchDebounce?.cancel();
    _cancelToken?.cancel();
    state = CollectionViewState(
      query: state.query.copyWith(
        searchQuery: searchQuery,
        clearSearch: searchQuery.isEmpty,
      ),
      loading: true,
      totalCount: state.totalCount,
    );
    _searchDebounce = Timer(const Duration(milliseconds: 300), refresh);
  }

  Future<void> loadMore() async {
    if (!state.pageInfo.hasNext || state.loadingMore) return;
    _cancelToken?.cancel();
    _cancelToken = CancelToken();
    final requestedQuery = state.query;
    state = state.copyWith(loadingMore: true, clearFailure: true);
    try {
      final page = await _fetch(
        cursor: state.pageInfo.nextCursor,
        cancelToken: _cancelToken,
      );
      if (state.query != requestedQuery) return;
      state = state.copyWith(
        items: [...state.items, ...page.items],
        pageInfo: page.pageInfo,
        loadingMore: false,
      );
    } on DioException catch (error) {
      if (!CancelToken.isCancel(error)) rethrow;
    } on ApiFailure catch (error) {
      state = state.copyWith(loadingMore: false, failure: error);
    }
  }

  Future<CursorPage<CollectionEntry>> _fetch({
    String? cursor,
    CancelToken? cancelToken,
  }) {
    final query = state.query;
    return ref
        .read(collectionRepositoryProvider)
        .list(
          sort: query.sort,
          genre: query.genre,
          year: query.year,
          score: query.score,
          searchQuery: query.searchQuery,
          cursor: cursor,
          cancelToken: cancelToken,
        );
  }
}

class SeriesCollectionQuery {
  const SeriesCollectionQuery({
    this.scope = AnimeSeriesScope.mainline,
    this.status = UserSeriesStatus.all,
    this.searchQuery,
  });

  final AnimeSeriesScope scope;
  final UserSeriesStatus status;
  final String? searchQuery;

  SeriesCollectionQuery copyWith({
    AnimeSeriesScope? scope,
    UserSeriesStatus? status,
    String? searchQuery,
    bool clearSearch = false,
  }) => SeriesCollectionQuery(
    scope: scope ?? this.scope,
    status: status ?? this.status,
    searchQuery: clearSearch ? null : (searchQuery ?? this.searchQuery),
  );
}

class SeriesCollectionViewState {
  const SeriesCollectionViewState({
    this.items = const [],
    this.query = const SeriesCollectionQuery(),
    this.pageInfo = const PageInfo(hasNext: false),
    this.loading = false,
    this.loadingMore = false,
    this.failure,
  });

  final List<SeriesCollectionItem> items;
  final SeriesCollectionQuery query;
  final PageInfo pageInfo;
  final bool loading;
  final bool loadingMore;
  final ApiFailure? failure;

  SeriesCollectionViewState copyWith({
    List<SeriesCollectionItem>? items,
    SeriesCollectionQuery? query,
    PageInfo? pageInfo,
    bool? loading,
    bool? loadingMore,
    ApiFailure? failure,
    bool clearFailure = false,
  }) => SeriesCollectionViewState(
    items: items ?? this.items,
    query: query ?? this.query,
    pageInfo: pageInfo ?? this.pageInfo,
    loading: loading ?? this.loading,
    loadingMore: loadingMore ?? this.loadingMore,
    failure: clearFailure ? null : (failure ?? this.failure),
  );
}

final seriesCollectionControllerProvider =
    NotifierProvider<SeriesCollectionController, SeriesCollectionViewState>(
      SeriesCollectionController.new,
    );

class SeriesCollectionController extends Notifier<SeriesCollectionViewState> {
  Timer? _searchDebounce;
  CancelToken? _cancelToken;
  int _requestGeneration = 0;
  bool _loaded = false;

  @override
  SeriesCollectionViewState build() {
    ref.watch(activeUserIdProvider);
    _loaded = false;
    _requestGeneration++;
    _cancelToken?.cancel();
    ref.onDispose(() {
      _searchDebounce?.cancel();
      _cancelToken?.cancel();
    });
    return const SeriesCollectionViewState();
  }

  void ensureLoaded() {
    if (_loaded) return;
    _loaded = true;
    unawaited(refresh());
  }

  Future<void> refresh() async {
    _loaded = true;
    final generation = ++_requestGeneration;
    _cancelToken?.cancel();
    _cancelToken = CancelToken();
    state = state.copyWith(loading: true, clearFailure: true);
    try {
      final page = await _fetch(cancelToken: _cancelToken);
      if (generation != _requestGeneration) return;
      state = state.copyWith(
        items: page.items,
        pageInfo: page.pageInfo,
        loading: false,
        clearFailure: true,
      );
    } on DioException catch (error) {
      if (!CancelToken.isCancel(error)) rethrow;
    } on ApiFailure catch (error) {
      if (generation == _requestGeneration) {
        state = state.copyWith(loading: false, failure: error);
      }
    }
  }

  Future<void> setQuery(SeriesCollectionQuery query) async {
    state = SeriesCollectionViewState(query: query, loading: true);
    await refresh();
  }

  void setSearchQuery(String value) {
    final query = value.trim();
    _searchDebounce?.cancel();
    _cancelToken?.cancel();
    _requestGeneration++;
    state = SeriesCollectionViewState(
      query: state.query.copyWith(
        searchQuery: query,
        clearSearch: query.isEmpty,
      ),
      loading: true,
    );
    _searchDebounce = Timer(const Duration(milliseconds: 300), refresh);
  }

  Future<void> loadMore() async {
    if (!state.pageInfo.hasNext || state.loadingMore) return;
    final generation = ++_requestGeneration;
    _cancelToken?.cancel();
    _cancelToken = CancelToken();
    state = state.copyWith(loadingMore: true, clearFailure: true);
    try {
      final page = await _fetch(
        cursor: state.pageInfo.nextCursor,
        cancelToken: _cancelToken,
      );
      if (generation != _requestGeneration) return;
      state = state.copyWith(
        items: [...state.items, ...page.items],
        pageInfo: page.pageInfo,
        loadingMore: false,
      );
    } on DioException catch (error) {
      if (!CancelToken.isCancel(error)) rethrow;
    } on ApiFailure catch (error) {
      if (generation == _requestGeneration) {
        state = state.copyWith(loadingMore: false, failure: error);
      }
    }
  }

  Future<CursorPage<SeriesCollectionItem>> _fetch({
    String? cursor,
    CancelToken? cancelToken,
  }) {
    final query = state.query;
    return ref
        .read(collectionRepositoryProvider)
        .series(
          scope: query.scope,
          status: query.status,
          query: query.searchQuery,
          cursor: cursor,
          cancelToken: cancelToken,
        );
  }
}

final favoriteAnimeProvider = FutureProvider.autoDispose<List<CollectionEntry>>(
  (ref) {
    ref.watch(activeUserIdProvider);
    return ref.watch(homeRepositoryProvider).favorites();
  },
);

final badgeOverviewProvider = FutureProvider.autoDispose<BadgeOverview>((ref) {
  ref.watch(activeUserIdProvider);
  return ref.watch(homeRepositoryProvider).badges();
});

class SearchViewState {
  const SearchViewState({
    this.query = '',
    this.sort = 'popularity',
    this.genre,
    this.items = const [],
    this.pageInfo = const PageInfo(hasNext: false),
    this.loading = false,
    this.loadingMore = false,
    this.ratingAnimeId,
    this.failure,
  });
  final String query;
  final String sort;
  final String? genre;
  final List<AnimeSearchResult> items;
  final PageInfo pageInfo;
  final bool loading;
  final bool loadingMore;
  final int? ratingAnimeId;
  final ApiFailure? failure;

  SearchViewState copyWith({
    String? query,
    String? sort,
    String? genre,
    bool clearGenre = false,
    List<AnimeSearchResult>? items,
    PageInfo? pageInfo,
    bool? loading,
    bool? loadingMore,
    int? ratingAnimeId,
    bool clearRating = false,
    ApiFailure? failure,
    bool clearFailure = false,
  }) => SearchViewState(
    query: query ?? this.query,
    sort: sort ?? this.sort,
    genre: clearGenre ? null : (genre ?? this.genre),
    items: items ?? this.items,
    pageInfo: pageInfo ?? this.pageInfo,
    loading: loading ?? this.loading,
    loadingMore: loadingMore ?? this.loadingMore,
    ratingAnimeId: clearRating ? null : (ratingAnimeId ?? this.ratingAnimeId),
    failure: clearFailure ? null : (failure ?? this.failure),
  );
}

final searchControllerProvider =
    NotifierProvider<SearchController, SearchViewState>(SearchController.new);

class SearchController extends Notifier<SearchViewState> {
  Timer? _debounce;
  CancelToken? _cancelToken;

  @override
  SearchViewState build() {
    ref.watch(activeUserIdProvider);
    ref.onDispose(() {
      _debounce?.cancel();
      _cancelToken?.cancel();
    });
    Future<void>.microtask(refresh);
    return const SearchViewState(loading: true);
  }

  void setQuery(String value) {
    final query = value.trim();
    _debounce?.cancel();
    _cancelToken?.cancel();
    state = state.copyWith(
      query: query,
      loading: true,
      loadingMore: false,
      pageInfo: const PageInfo(hasNext: false),
      clearFailure: true,
    );
    _debounce = Timer(const Duration(milliseconds: 300), _search);
  }

  void setSort(String sort) {
    if (sort == state.sort) return;
    _cancelToken?.cancel();
    state = state.copyWith(
      sort: sort,
      loading: true,
      loadingMore: false,
      pageInfo: const PageInfo(hasNext: false),
      clearFailure: true,
    );
    unawaited(_search());
  }

  void setGenre(String? genre) {
    if (genre == state.genre) return;
    _cancelToken?.cancel();
    state = state.copyWith(
      genre: genre,
      clearGenre: genre == null,
      loading: true,
      loadingMore: false,
      pageInfo: const PageInfo(hasNext: false),
      clearFailure: true,
    );
    unawaited(_search());
  }

  Future<void> refresh() => _search();

  Future<void> _search() async {
    _cancelToken?.cancel();
    final requestedQuery = state.query;
    final requestedSort = state.sort;
    final requestedGenre = state.genre;
    _cancelToken = CancelToken();
    try {
      final page = await ref
          .read(collectionRepositoryProvider)
          .search(
            query: requestedQuery,
            sort: requestedSort,
            genre: requestedGenre,
            cancelToken: _cancelToken,
          );
      if (requestedQuery != state.query ||
          requestedSort != state.sort ||
          requestedGenre != state.genre) {
        return;
      }
      state = SearchViewState(
        query: requestedQuery,
        sort: requestedSort,
        genre: requestedGenre,
        items: page.items,
        pageInfo: page.pageInfo,
      );
    } on DioException catch (error) {
      if (!CancelToken.isCancel(error)) {
        rethrow;
      }
    } on ApiFailure catch (error) {
      if (requestedQuery == state.query &&
          requestedSort == state.sort &&
          requestedGenre == state.genre) {
        state = SearchViewState(
          query: requestedQuery,
          sort: requestedSort,
          genre: requestedGenre,
          failure: error,
        );
      }
    }
  }

  Future<void> loadMore() async {
    if (!state.pageInfo.hasNext || state.loadingMore) return;
    final requestedQuery = state.query;
    final requestedSort = state.sort;
    final requestedGenre = state.genre;
    final requestedCursor = state.pageInfo.nextCursor;
    state = state.copyWith(loadingMore: true, clearFailure: true);
    try {
      final page = await ref
          .read(collectionRepositoryProvider)
          .search(
            query: requestedQuery,
            sort: requestedSort,
            genre: requestedGenre,
            cursor: requestedCursor,
          );
      if (requestedQuery != state.query ||
          requestedSort != state.sort ||
          requestedGenre != state.genre) {
        return;
      }
      state = SearchViewState(
        query: requestedQuery,
        sort: requestedSort,
        genre: requestedGenre,
        items: [...state.items, ...page.items],
        pageInfo: page.pageInfo,
      );
    } on ApiFailure catch (error) {
      state = state.copyWith(loadingMore: false, failure: error);
    }
  }

  Future<void> quickRate(AnimeSearchResult result, int score) async {
    if (state.ratingAnimeId != null) return;
    final anime = result.anime;
    final progress = anime.episodes ?? result.myCollection?.progress ?? 0;
    state = state.copyWith(ratingAnimeId: anime.id, clearFailure: true);
    try {
      await ref
          .read(collectionRepositoryProvider)
          .quickRate(
            animeId: anime.id,
            score: score.toDouble(),
            exists: result.myCollection?.exists == true,
            progress: progress,
          );
      final updated = AnimeSearchResult(
        anime: anime,
        myCollection: MyCollectionState(
          exists: true,
          status: CollectionStatus.completed,
          score: score.toDouble(),
          progress: progress,
        ),
      );
      state = state.copyWith(
        items: [
          for (final item in state.items)
            if (item.anime.id == anime.id) updated else item,
        ],
        clearRating: true,
      );
    } catch (_) {
      state = state.copyWith(clearRating: true);
      rethrow;
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
final collectionEntryProvider = FutureProvider.family<CollectionEntry?, int>((
  ref,
  animeId,
) {
  ref.watch(activeUserIdProvider);
  return ref.watch(collectionRepositoryProvider).entry(animeId);
});

final friendSnapshotProvider = FutureProvider.autoDispose<FriendSnapshot>((
  ref,
) {
  ref.watch(activeUserIdProvider);
  return ref.watch(friendsRepositoryProvider).snapshot();
});
final userSearchProvider = FutureProvider.autoDispose
    .family<CursorPage<UserSearchResult>, String>((ref, query) async {
      ref.watch(activeUserIdProvider);
      final token = CancelToken();
      ref.onDispose(token.cancel);
      return ref
          .watch(friendsRepositoryProvider)
          .search(query, cancelToken: token);
    });
final publicUserProvider = FutureProvider.autoDispose.family<PublicUser, int>((
  ref,
  userId,
) {
  ref.watch(activeUserIdProvider);
  return ref.watch(friendsRepositoryProvider).profile(userId);
});
final publicBadgeOverviewProvider = FutureProvider.autoDispose
    .family<BadgeOverview, int>((ref, userId) {
      ref.watch(activeUserIdProvider);
      return ref.watch(friendsRepositoryProvider).badges(userId);
    });
final publicFavoriteAnimeProvider = FutureProvider.autoDispose
    .family<List<CollectionEntry>, int>((ref, userId) async {
      ref.watch(activeUserIdProvider);
      final page = await ref
          .watch(friendsRepositoryProvider)
          .collection(userId, sort: 'score', score: 10, limit: 12);
      return page.items;
    });

final statsOverviewProvider = FutureProvider.autoDispose
    .family<StatsOverview, int?>(
      (ref, userId) => ref.watch(analysisRepositoryProvider(userId)).overview(),
    );
final viewingDnaProvider = FutureProvider.autoDispose.family<ViewingDna, int?>(
  (ref, userId) => ref.watch(analysisRepositoryProvider(userId)).viewingDna(),
);
final formatDistributionProvider = FutureProvider.autoDispose
    .family<FormatDistribution, int?>(
      (ref, userId) => ref.watch(analysisRepositoryProvider(userId)).formats(),
    );
final genreBubbleProvider = FutureProvider.autoDispose
    .family<List<GenreBubble>, int?>(
      (ref, userId) => ref.watch(analysisRepositoryProvider(userId)).genres(),
    );
final yearlyScoreProvider = FutureProvider.autoDispose
    .family<List<YearlyScore>, int?>(
      (ref, userId) =>
          ref.watch(analysisRepositoryProvider(userId)).yearlyScores(),
    );
final studioRankingProvider = FutureProvider.autoDispose
    .family<List<StudioRanking>, ({int? userId, String sort})>(
      (ref, key) => ref
          .watch(analysisRepositoryProvider(key.userId))
          .studios(sort: key.sort),
    );
final voiceActorRankingProvider = FutureProvider.autoDispose
    .family<List<VoiceActorRanking>, ({int? userId, String sort})>(
      (ref, key) => ref
          .watch(analysisRepositoryProvider(key.userId))
          .voiceActors(sort: key.sort),
    );

final studioAnimeProvider = FutureProvider.autoDispose
    .family<List<AnalysisAnimeWork>, ({int? userId, int id})>(
      (ref, key) =>
          ref.watch(analysisRepositoryProvider(key.userId)).studioAnime(key.id),
    );
final voiceActorAnimeProvider = FutureProvider.autoDispose
    .family<List<AnalysisAnimeWork>, ({int? userId, int id})>(
      (ref, key) => ref
          .watch(analysisRepositoryProvider(key.userId))
          .voiceActorAnime(key.id),
    );

void invalidateUserData(WidgetRef ref) {
  unawaited(ref.read(collectionControllerProvider.notifier).refresh());
  unawaited(ref.read(seriesCollectionControllerProvider.notifier).refresh());
  unawaited(ref.read(searchControllerProvider.notifier).refresh());
  ref.invalidate(favoriteAnimeProvider);
  ref.invalidate(badgeOverviewProvider);
  ref.invalidate(statsOverviewProvider);
  ref.invalidate(viewingDnaProvider);
  ref.invalidate(formatDistributionProvider);
  ref.invalidate(genreBubbleProvider);
  ref.invalidate(yearlyScoreProvider);
  ref.invalidate(studioRankingProvider);
  ref.invalidate(voiceActorRankingProvider);
  ref.invalidate(studioAnimeProvider);
  ref.invalidate(voiceActorAnimeProvider);
}
