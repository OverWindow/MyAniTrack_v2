import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart'
    hide AuthUser, MultipartFile;

import 'package:myanitrack_mobile/src/config.dart';
import 'package:myanitrack_mobile/src/models.dart';

enum ApiFailureKind {
  unauthorized,
  agreements,
  validation,
  conflict,
  notFound,
  network,
  server,
  unknown,
}

class ApiFailure implements Exception {
  const ApiFailure({
    required this.kind,
    required this.message,
    this.statusCode,
  });

  final ApiFailureKind kind;
  final String message;
  final int? statusCode;

  bool get isUnauthorized => kind == ApiFailureKind.unauthorized;
  bool get needsAgreements => kind == ApiFailureKind.agreements;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({Dio? dio, this.onSessionFailure})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              connectTimeout: const Duration(seconds: 12),
              sendTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 20),
              headers: const {'Accept': 'application/json'},
            ),
          ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.extra['authenticated'] == true) {
            final token = _currentAccessToken();
            if (token == null) {
              return handler.reject(
                DioException(
                  requestOptions: options,
                  response: Response<dynamic>(
                    requestOptions: options,
                    statusCode: 401,
                    data: const {'success': false, 'message': '로그인 세션이 필요합니다.'},
                  ),
                  type: DioExceptionType.badResponse,
                ),
              );
            }
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;
  final void Function(ApiFailure failure)? onSessionFailure;

  Future<JsonMap> get(
    String path, {
    Map<String, dynamic>? query,
    bool authenticated = true,
    CancelToken? cancelToken,
  }) {
    return _request(
      path,
      method: 'GET',
      query: query,
      authenticated: authenticated,
      cancelToken: cancelToken,
    );
  }

  Future<JsonMap> post(String path, {Object? data, bool authenticated = true}) {
    return _request(
      path,
      method: 'POST',
      data: data,
      authenticated: authenticated,
    );
  }

  Future<JsonMap> patch(
    String path, {
    Object? data,
    bool authenticated = true,
  }) {
    return _request(
      path,
      method: 'PATCH',
      data: data,
      authenticated: authenticated,
    );
  }

  Future<JsonMap> delete(String path, {bool authenticated = true}) {
    return _request(path, method: 'DELETE', authenticated: authenticated);
  }

  Future<JsonMap> _request(
    String path, {
    required String method,
    Object? data,
    Map<String, dynamic>? query,
    required bool authenticated,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _dio.request<dynamic>(
        path,
        data: data,
        queryParameters: query,
        cancelToken: cancelToken,
        options: Options(
          method: method,
          extra: {'authenticated': authenticated},
        ),
      );
      return _normalize(response.data);
    } on DioException catch (error) {
      if (CancelToken.isCancel(error)) rethrow;
      final failure = _failureFrom(error);
      if (failure.isUnauthorized || failure.needsAgreements) {
        onSessionFailure?.call(failure);
      }
      throw failure;
    }
  }

  JsonMap _normalize(Object? data) {
    if (data == null || data == '') return const {'success': true};
    final json = asJsonMap(data);
    if (json.isNotEmpty) return json;
    return <String, dynamic>{'data': data};
  }

  ApiFailure _failureFrom(DioException error) {
    final status = error.response?.statusCode;
    final json = asJsonMap(error.response?.data);
    final serverMessage = readString(json['message']);
    final message =
        serverMessage ??
        switch (error.type) {
          DioExceptionType.connectionTimeout ||
          DioExceptionType.sendTimeout ||
          DioExceptionType.receiveTimeout =>
            '서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.',
          DioExceptionType.connectionError =>
            '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.',
          _ => '요청을 처리하지 못했습니다.',
        };
    final lower = message.toLowerCase();
    final kind = switch (status ?? 0) {
      400 => ApiFailureKind.validation,
      401 => ApiFailureKind.unauthorized,
      403
          when lower.contains('agreement') ||
              lower.contains('terms') ||
              lower.contains('privacy') =>
        ApiFailureKind.agreements,
      403 => ApiFailureKind.unknown,
      404 => ApiFailureKind.notFound,
      409 => ApiFailureKind.conflict,
      >= 500 => ApiFailureKind.server,
      _
          when error.type == DioExceptionType.connectionError ||
              error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.receiveTimeout ||
              error.type == DioExceptionType.sendTimeout =>
        ApiFailureKind.network,
      _ => ApiFailureKind.unknown,
    };
    return ApiFailure(kind: kind, message: message, statusCode: status);
  }

  String? _currentAccessToken() {
    try {
      return Supabase.instance.client.auth.currentSession?.accessToken;
    } on Object {
      return null;
    }
  }
}

class AuthRepository {
  const AuthRepository(this.api);
  final ApiClient api;

  Future<AuthUser> connectSupabase() async {
    final json = await api.post('/auth/supabase');
    return AuthUser.fromJson(json);
  }

  Future<AuthUser> me() async => AuthUser.fromJson(await api.get('/auth/me'));

  Future<AgreementStatus> agreements() async {
    return AgreementStatus.fromJson(await api.get('/me/agreements'));
  }

  Future<void> acceptAgreements() async {
    await api.patch(
      '/me/agreements',
      data: const {
        'termsAgreed': true,
        'termsVersion': 'v1.0',
        'privacyAgreed': true,
        'privacyVersion': 'v1.0',
      },
    );
  }

  Future<void> logout() async => api.post('/auth/logout');
  Future<void> deleteAccount() async => api.delete('/auth/me');
}

class CollectionRepository {
  const CollectionRepository(this.api);
  final ApiClient api;

  Future<CursorPage<CollectionEntry>> list({
    String sort = 'latest',
    String? genre,
    int? year,
    int? score,
    String? searchQuery,
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    final json = await api.get(
      '/me/anime-list',
      query: {
        'sort': sort,
        'titleLanguage': 'ko',
        'limit': limit,
        if (genre != null) 'genre': genre,
        if (year != null) 'year': year,
        if (score != null) 'score': score,
        if (searchQuery != null && searchQuery.isNotEmpty) 'query': searchQuery,
        if (cursor != null) 'cursor': cursor,
      },
      cancelToken: cancelToken,
    );
    return CursorPage(
      items: asJsonList(json['items']).map(CollectionEntry.fromJson).toList(),
      pageInfo: PageInfo.fromJson(asJsonMap(json['pageInfo'])),
      totalCount: readInt(json['totalCount']),
    );
  }

  Future<CursorPage<AnimeSearchResult>> search(
    String query, {
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    final json = await api.get(
      '/me/anime/search',
      query: {
        'query': query,
        'titleLanguage': 'ko',
        'limit': 20,
        if (cursor != null) 'cursor': cursor,
      },
      cancelToken: cancelToken,
    );
    return CursorPage(
      items: asJsonList(json['items']).map(AnimeSearchResult.fromJson).toList(),
      pageInfo: PageInfo.fromJson(asJsonMap(json['pageInfo'])),
    );
  }

  Future<Anime> animeDetail(int animeId) async {
    final json = await api.get('/anime/$animeId', authenticated: false);
    final item = asJsonMap(json['item']);
    final anime = asJsonMap(json['anime']);
    return Anime.fromJson(
      item.isNotEmpty ? item : (anime.isNotEmpty ? anime : json),
    );
  }

  Future<List<AnimeCastMember>> cast(int animeId) async {
    final json = await api.get(
      '/anime/$animeId/cast',
      authenticated: false,
      query: const {'role': 'MAIN', 'voiceLanguage': 'Japanese', 'limit': 20},
    );
    return asJsonList(
      json['items'],
    ).expand(AnimeCastMember.listFromJson).toList();
  }

  Future<CollectionEntry?> entry(int animeId) async {
    try {
      final json = await api.get('/me/anime-list/$animeId');
      final item = asJsonMap(json['item']);
      return item.isEmpty ? null : CollectionEntry.fromJson(item);
    } on ApiFailure catch (error) {
      if (error.kind == ApiFailureKind.notFound) return null;
      rethrow;
    }
  }

  Future<CollectionEntry> add(int animeId, CollectionDraft draft) async {
    final json = await api.post(
      '/me/anime-list',
      data: draft.toCreateJson(animeId),
    );
    return CollectionEntry.fromJson(asJsonMap(json['item']));
  }

  Future<CollectionEntry> update(int animeId, CollectionDraft draft) async {
    final json = await api.patch(
      '/me/anime-list/$animeId',
      data: draft.toPatchJson(),
    );
    return CollectionEntry.fromJson(asJsonMap(json['item']));
  }

  Future<void> remove(int animeId) async =>
      api.delete('/me/anime-list/$animeId');
}

class HomeRepository {
  const HomeRepository(this.api);
  final ApiClient api;

  Future<List<CollectionEntry>> favorites() async {
    final json = await api.get(
      '/me/anime-list',
      query: const {
        'sort': 'score',
        'score': 10,
        'titleLanguage': 'ko',
        'limit': 12,
      },
    );
    return asJsonList(json['items']).map(CollectionEntry.fromJson).toList();
  }

  Future<BadgeOverview> badges() async {
    return BadgeOverview.fromJson(await api.get('/me/badges'));
  }
}

class FriendsRepository {
  const FriendsRepository(this.api);
  final ApiClient api;

  Future<CursorPage<UserSearchResult>> search(
    String query, {
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    final json = await api.get(
      '/users/search',
      query: {
        'query': query,
        'limit': 20,
        if (cursor != null) 'cursor': cursor,
      },
      cancelToken: cancelToken,
    );
    return CursorPage(
      items: asJsonList(json['items']).map(UserSearchResult.fromJson).toList(),
      pageInfo: PageInfo.fromJson(asJsonMap(json['pageInfo'])),
    );
  }

  Future<FriendSnapshot> snapshot() async {
    final responses = await Future.wait([
      api.get('/friends'),
      api.get('/friends/requests'),
    ]);
    final requests = responses[1];
    return FriendSnapshot(
      friends: asJsonList(
        responses[0]['items'],
      ).map(FriendItem.fromJson).toList(),
      incoming: asJsonList(
        requests['incoming'],
      ).map(FriendRequest.fromJson).toList(),
      outgoing: asJsonList(
        requests['outgoing'],
      ).map(FriendRequest.fromJson).toList(),
    );
  }

  Future<void> sendRequest(int userId) async {
    await api.post('/friends/requests', data: {'receiverId': userId});
  }

  Future<void> actOnRequest(int requestId, String action) async {
    await api.patch('/friends/requests/$requestId', data: {'action': action});
  }

  Future<void> removeFriend(int userId) async {
    await api.delete('/friends/$userId');
  }

  Future<PublicUser> profile(int userId) async {
    return PublicUser.fromJson(await api.get('/users/$userId/profile'));
  }

  Future<CursorPage<CollectionEntry>> collection(
    int userId, {
    String? query,
    String? genre,
    int? year,
    int? score,
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    final json = await api.get(
      '/users/$userId/anime-list',
      query: {
        'sort': 'latest',
        'titleLanguage': 'ko',
        'limit': limit,
        if (query != null && query.isNotEmpty) 'query': query,
        if (genre != null) 'genre': genre,
        if (year != null) 'year': year,
        if (score != null) 'score': score,
        if (cursor != null) 'cursor': cursor,
      },
      cancelToken: cancelToken,
    );
    return CursorPage(
      items: asJsonList(json['items']).map(CollectionEntry.fromJson).toList(),
      pageInfo: PageInfo.fromJson(asJsonMap(json['pageInfo'])),
      totalCount: readInt(json['totalCount']),
    );
  }
}

class AnalysisRepository {
  const AnalysisRepository(this.api, {this.userId});
  final ApiClient api;
  final int? userId;

  String get _base =>
      userId == null ? '/me/anime-stats' : '/users/$userId/anime-stats';
  String get _voiceActorBase =>
      userId == null ? '/me/voice-actors' : '/users/$userId/voice-actors';

  Future<StatsOverview> overview() async {
    return StatsOverview.fromJson(await api.get(_base));
  }

  Future<ViewingDna> viewingDna() async {
    return ViewingDna.fromJson(await api.get('$_base/viewing-dna'));
  }

  Future<FormatDistribution> formats() async {
    final json = await api.get(
      '$_base/format-distribution',
      query: const {'status': 'completed', 'minCount': 1},
    );
    return FormatDistribution.fromJson(json);
  }

  Future<List<GenreBubble>> genres() async {
    final json = await api.get(
      '$_base/genre-bubble',
      query: const {
        'titleLanguage': 'ko',
        'minCount': 1,
        'weighting': 'full',
        'status': 'all',
      },
    );
    final item = asJsonMap(json['item']);
    return asJsonList(item['items']).map(GenreBubble.fromJson).toList();
  }

  Future<List<YearlyScore>> yearlyScores() async {
    final json = await api.get(
      '$_base/yearly-scores',
      query: const {'status': 'completed', 'minRatedAnimeCount': 1},
    );
    final item = asJsonMap(json['item']);
    return asJsonList(item['items']).map(YearlyScore.fromJson).toList();
  }

  Future<List<StudioRanking>> studios({String sort = 'count'}) async {
    final json = await api.get(
      '$_base/studios',
      query: {
        'sort': sort,
        'status': 'all',
        'mainOnly': true,
        'minAnimeCount': 1,
        'minRatedAnimeCount': 1,
        'limit': 50,
      },
    );
    return asJsonList(json['items']).map(StudioRanking.fromJson).toList();
  }

  Future<List<VoiceActorRanking>> voiceActors({String sort = 'count'}) async {
    final json = await api.get(
      '$_voiceActorBase/ranking',
      query: {
        'sort': sort == 'watchTime' ? 'count' : sort,
        'limit': 50,
        'minAnimeCount': 1,
        'minRatedAnimeCount': 1,
      },
    );
    return asJsonList(json['items']).map(VoiceActorRanking.fromJson).toList();
  }

  Future<List<Anime>> studioAnime(int studioId) async {
    final json = await api.get(
      '$_base/studios/$studioId/anime',
      query: const {'titleLanguage': 'ko', 'limit': 50, 'status': 'all'},
    );
    return asJsonList(json['items']).map(Anime.fromJson).toList();
  }

  Future<List<Anime>> voiceActorAnime(int voiceActorId) async {
    final json = await api.get(
      '$_voiceActorBase/$voiceActorId/anime',
      query: const {'titleLanguage': 'ko', 'limit': 50},
    );
    return asJsonList(json['items']).map(Anime.fromJson).toList();
  }
}

class ProfileRepository {
  const ProfileRepository(this.api);
  final ApiClient api;

  Future<AuthUser> update({
    String? username,
    XFile? profileImage,
    bool removeProfileImage = false,
  }) async {
    final data = <String, dynamic>{
      if (username != null) 'username': username,
      if (removeProfileImage) 'removeProfileImage': 'true',
      if (profileImage != null)
        'profileImage': MultipartFile.fromBytes(
          await profileImage.readAsBytes(),
          filename: profileImage.name,
        ),
    };
    final json = await api.patch('/me/profile', data: FormData.fromMap(data));
    return AuthUser.fromJson(json);
  }
}
