import 'package:myanitrack_mobile/src/agreements.dart';

typedef JsonMap = Map<String, dynamic>;

JsonMap asJsonMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.map((key, item) => MapEntry('$key', item));
  return const <String, dynamic>{};
}

List<JsonMap> asJsonList(Object? value) {
  if (value is! List) return const [];
  return value.map(asJsonMap).where((item) => item.isNotEmpty).toList();
}

int? readInt(Object? value) {
  if (value is num) return value.toInt();
  return int.tryParse('$value');
}

double? readDouble(Object? value) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value');
}

bool readBool(Object? value, {bool fallback = false}) {
  if (value is bool) return value;
  return fallback;
}

String? readString(Object? value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty || text == 'null' ? null : text;
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.username,
    required this.role,
    required this.emailVerified,
    this.profileImageUrl,
    this.bio,
  });

  final int id;
  final String email;
  final String username;
  final String role;
  final bool emailVerified;
  final String? profileImageUrl;
  final String? bio;

  String get displayName {
    if (username.trim().isNotEmpty) return username.trim();
    return email.split('@').first;
  }

  factory AuthUser.fromJson(JsonMap json) {
    final data = asJsonMap(json['data']);
    final root = data.isEmpty ? json : data;
    final nested = asJsonMap(root['user']);
    final user = nested.isEmpty ? root : nested;
    return AuthUser(
      id: readInt(user['id']) ?? 0,
      email: readString(user['email']) ?? '',
      username: readString(user['username']) ?? '',
      role: readString(user['role']) ?? 'USER',
      emailVerified: readBool(user['emailVerified']),
      profileImageUrl: readString(user['profileImageUrl']),
      bio: readString(user['bio']),
    );
  }
}

class AgreementStatus {
  const AgreementStatus({
    required this.termsAgreed,
    required this.privacyAgreed,
    this.termsVersion,
    this.privacyVersion,
    this.serverHasRequiredAgreements,
  });

  final bool termsAgreed;
  final bool privacyAgreed;
  final String? termsVersion;
  final String? privacyVersion;
  final bool? serverHasRequiredAgreements;

  bool get hasRequiredAgreements =>
      serverHasRequiredAgreements ??
      (termsAgreed &&
          privacyAgreed &&
          termsVersion == AppAgreements.termsVersion &&
          privacyVersion == AppAgreements.privacyVersion);

  factory AgreementStatus.fromJson(JsonMap json) {
    final data = asJsonMap(json['data']);
    final item = asJsonMap(json['item']);
    final root = data.isNotEmpty ? data : (item.isNotEmpty ? item : json);
    return AgreementStatus(
      termsAgreed: readBool(root['termsAgreed']),
      privacyAgreed: readBool(root['privacyAgreed']),
      termsVersion: readString(root['termsVersion']),
      privacyVersion: readString(root['privacyVersion']),
      serverHasRequiredAgreements: root.containsKey('hasRequiredAgreements')
          ? readBool(root['hasRequiredAgreements'])
          : null,
    );
  }
}

class Anime {
  const Anime({
    required this.id,
    required this.title,
    this.anilistId,
    this.coverImageUrl,
    this.bannerImageUrl,
    this.episodes,
    this.duration,
    this.seasonYear,
    this.format,
    this.averageScore,
    this.description,
    this.genres = const [],
  });

  final int id;
  final int? anilistId;
  final String title;
  final String? coverImageUrl;
  final String? bannerImageUrl;
  final int? episodes;
  final int? duration;
  final int? seasonYear;
  final String? format;
  final double? averageScore;
  final String? description;
  final List<String> genres;

  factory Anime.fromJson(JsonMap json) {
    final anime = asJsonMap(json['anime']);
    final root = anime.isEmpty ? json : anime;
    final titles = asJsonMap(root['titles']);
    final rawTitle = root['title'];
    String? title;
    if (rawTitle is String) {
      title = readString(rawTitle);
    } else {
      final titleMap = asJsonMap(rawTitle);
      title =
          readString(titleMap['ko']) ??
          readString(titleMap['korean']) ??
          readString(titleMap['userPreferred']) ??
          readString(titleMap['romaji']) ??
          readString(titleMap['english']) ??
          readString(titleMap['native']);
    }
    title ??=
        readString(titles['korean']) ??
        readString(titles['userPreferred']) ??
        readString(titles['romaji']) ??
        readString(titles['english']) ??
        readString(titles['native']) ??
        '제목 정보 없음';

    final cover = asJsonMap(root['coverImage']);
    final image = asJsonMap(root['image']);
    final genres = root['genres'] is List
        ? (root['genres'] as List).map(readString).whereType<String>().toList()
        : const <String>[];

    return Anime(
      id: readInt(root['id']) ?? 0,
      anilistId: readInt(root['anilistId']),
      title: title,
      coverImageUrl:
          readString(root['coverImageExtraLarge']) ??
          readString(root['coverImageLarge']) ??
          readString(cover['extraLarge']) ??
          readString(cover['large']) ??
          readString(image['large']),
      bannerImageUrl: readString(root['bannerImage']),
      episodes: readInt(root['episodes']),
      duration: readInt(root['duration']),
      seasonYear: readInt(root['seasonYear']),
      format: readString(root['format']),
      averageScore: readDouble(root['averageScore']),
      description: readString(root['description']),
      genres: genres,
    );
  }
}

enum CollectionStatus {
  planned('planned', '볼 예정'),
  watching('watching', '보는 중'),
  completed('completed', '완료'),
  paused('paused', '잠시 멈춤'),
  dropped('dropped', '중단');

  const CollectionStatus(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static CollectionStatus fromApi(String? value) {
    return values.firstWhere(
      (status) => status.apiValue == value,
      orElse: () => planned,
    );
  }
}

class CollectionEntry {
  const CollectionEntry({
    required this.entryId,
    required this.userId,
    required this.animeId,
    required this.status,
    required this.anime,
    this.score,
    this.progress,
    this.startedAt,
    this.completedAt,
    this.notes,
    this.createdAt,
    this.updatedAt,
  });

  final int entryId;
  final int userId;
  final int animeId;
  final CollectionStatus status;
  final double? score;
  final int? progress;
  final String? startedAt;
  final String? completedAt;
  final String? notes;
  final String? createdAt;
  final String? updatedAt;
  final Anime anime;

  factory CollectionEntry.fromJson(JsonMap json) {
    final anime = Anime.fromJson(json);
    return CollectionEntry(
      entryId: readInt(json['id']) ?? 0,
      userId: readInt(json['userId']) ?? 0,
      animeId: readInt(json['animeId']) ?? anime.id,
      status: CollectionStatus.fromApi(readString(json['status'])),
      score: readDouble(json['score']),
      progress: readInt(json['progress']),
      startedAt: readString(json['startedAt']),
      completedAt: readString(json['completedAt']),
      notes: readString(json['notes']),
      createdAt: readString(json['createdAt']),
      updatedAt: readString(json['updatedAt']),
      anime: anime,
    );
  }
}

class MyCollectionState {
  const MyCollectionState({
    required this.exists,
    this.status,
    this.score,
    this.progress,
  });

  final bool exists;
  final CollectionStatus? status;
  final double? score;
  final int? progress;

  factory MyCollectionState.fromJson(JsonMap json) {
    return MyCollectionState(
      exists: readBool(json['exists']),
      status: readString(json['status']) == null
          ? null
          : CollectionStatus.fromApi(readString(json['status'])),
      score: readDouble(json['score']),
      progress: readInt(json['progress']),
    );
  }
}

class AnimeSearchResult {
  const AnimeSearchResult({required this.anime, this.myCollection});
  final Anime anime;
  final MyCollectionState? myCollection;

  factory AnimeSearchResult.fromJson(JsonMap json) {
    final myCollection = asJsonMap(json['myCollection']);
    return AnimeSearchResult(
      anime: Anime.fromJson(json),
      myCollection: myCollection.isEmpty
          ? null
          : MyCollectionState.fromJson(myCollection),
    );
  }
}

class CollectionDraft {
  const CollectionDraft({
    required this.status,
    required this.progress,
    this.score,
    this.startedAt,
    this.completedAt,
    this.notes,
  });

  final CollectionStatus status;
  final double? score;
  final int progress;
  final String? startedAt;
  final String? completedAt;
  final String? notes;

  JsonMap toCreateJson(int animeId) => <String, dynamic>{
    'animeId': animeId,
    'status': status.apiValue,
    'score': score,
    'progress': progress,
    'startedAt': startedAt,
    'completedAt': completedAt,
    'notes': notes,
  };

  JsonMap toPatchJson() => <String, dynamic>{
    'status': status.apiValue,
    'score': score,
    'progress': progress,
    'startedAt': startedAt,
    'completedAt': completedAt,
    'notes': notes,
  };
}

class PageInfo {
  const PageInfo({required this.hasNext, this.nextCursor, this.limit = 20});
  final bool hasNext;
  final String? nextCursor;
  final int limit;

  factory PageInfo.fromJson(JsonMap json) => PageInfo(
    hasNext: readBool(json['hasNext']),
    nextCursor: readString(json['nextCursor']),
    limit: readInt(json['limit']) ?? 20,
  );
}

class CursorPage<T> {
  const CursorPage({
    required this.items,
    required this.pageInfo,
    this.totalCount,
  });
  final List<T> items;
  final PageInfo pageInfo;
  final int? totalCount;
}

class AnimeCastMember {
  const AnimeCastMember({
    required this.id,
    required this.characterName,
    required this.voiceActorName,
    this.characterImageUrl,
    this.voiceActorImageUrl,
  });
  final int id;
  final String characterName;
  final String voiceActorName;
  final String? characterImageUrl;
  final String? voiceActorImageUrl;

  static List<AnimeCastMember> listFromJson(JsonMap json) {
    final voiceActors = asJsonList(json['voiceActors']);
    if (voiceActors.isNotEmpty) {
      final characterImage = asJsonMap(json['image']);
      return voiceActors.map((actor) {
        final actorImage = asJsonMap(actor['image']);
        return AnimeCastMember(
          id: readInt(actor['id']) ?? readInt(json['id']) ?? 0,
          characterName: _personName(json),
          voiceActorName: _personName(actor),
          characterImageUrl:
              readString(characterImage['large']) ??
              readString(characterImage['medium']),
          voiceActorImageUrl:
              readString(actorImage['large']) ??
              readString(actorImage['medium']),
        );
      }).toList();
    }
    return [AnimeCastMember.fromJson(json)];
  }

  static String _personName(JsonMap root) {
    final name = asJsonMap(root['name']);
    return readString(name['userPreferred']) ??
        readString(name['full']) ??
        readString(name['native']) ??
        readString(root['name']) ??
        '이름 정보 없음';
  }

  factory AnimeCastMember.fromJson(JsonMap json) {
    final character = asJsonMap(json['character']);
    final actor = asJsonMap(json['voiceActor']);
    final person = asJsonMap(json['person']);
    final actorRoot = actor.isEmpty ? person : actor;
    final characterImage = asJsonMap(character['image']);
    final actorImage = asJsonMap(actorRoot['image']);
    return AnimeCastMember(
      id: readInt(json['id']) ?? readInt(character['id']) ?? 0,
      characterName: _personName(character),
      voiceActorName: _personName(actorRoot),
      characterImageUrl:
          readString(characterImage['large']) ??
          readString(characterImage['medium']),
      voiceActorImageUrl:
          readString(actorImage['large']) ?? readString(actorImage['medium']),
    );
  }
}

class BadgeProgress {
  const BadgeProgress({
    required this.percent,
    required this.isComplete,
    this.current,
    this.target,
  });

  final Object? current;
  final Object? target;
  final double percent;
  final bool isComplete;

  factory BadgeProgress.fromJson(JsonMap json) => BadgeProgress(
    current: json['current'],
    target: json['target'],
    percent: (readDouble(json['percent']) ?? 0).clamp(0, 100).toDouble(),
    isComplete: readBool(json['isComplete']),
  );
}

class UserBadge {
  const UserBadge({
    required this.id,
    required this.code,
    required this.name,
    required this.description,
    required this.rarity,
    required this.earned,
    this.imageUrl,
    this.earnedAt,
    this.progress,
  });

  final int id;
  final String code;
  final String name;
  final String description;
  final String rarity;
  final bool earned;
  final String? imageUrl;
  final String? earnedAt;
  final BadgeProgress? progress;

  factory UserBadge.fromJson(JsonMap json) {
    final progressJson = asJsonMap(json['progress']);
    final progress = progressJson.isEmpty
        ? null
        : BadgeProgress.fromJson(progressJson);
    final earnedAt = readString(json['earnedAt']);
    return UserBadge(
      id: readInt(json['id']) ?? 0,
      code: readString(json['code']) ?? '',
      name: readString(json['name']) ?? '배지',
      description: readString(json['description']) ?? '',
      rarity: readString(json['rarity']) ?? 'COMMON',
      earned:
          readBool(json['earned']) ||
          earnedAt != null ||
          (progress?.isComplete ?? false),
      imageUrl: readString(json['imageUrl']),
      earnedAt: earnedAt,
      progress: progress,
    );
  }
}

class BadgeOverview {
  const BadgeOverview({
    required this.items,
    required this.earnedCount,
    required this.totalCount,
  });

  final List<UserBadge> items;
  final int earnedCount;
  final int totalCount;

  factory BadgeOverview.fromJson(JsonMap json) {
    final items = asJsonList(json['items']).map(UserBadge.fromJson).toList();
    return BadgeOverview(
      items: items,
      earnedCount:
          readInt(json['earnedCount']) ??
          items.where((item) => item.earned).length,
      totalCount: readInt(json['totalCount']) ?? items.length,
    );
  }
}

class StatsOverview {
  const StatsOverview({
    required this.totalCount,
    required this.completedCount,
    required this.watchingCount,
    required this.droppedCount,
    required this.totalWatchedEpisodes,
    required this.totalWatchMinutes,
    required this.genreDistribution,
    required this.genreWatchMinutes,
    required this.genreAverageScore,
    required this.releaseYearDistribution,
    required this.scoreDistribution,
    this.averageScore,
    this.favoriteGenre,
    this.averageReleaseYear,
    this.favoriteReleasePeriod,
    this.preferenceSummary,
    this.topWatchedGenreAnime = const [],
    this.topRatedGenreAnime = const [],
    this.seriesStats = const SeriesStats(),
  });

  final int totalCount;
  final int completedCount;
  final int watchingCount;
  final int droppedCount;
  final int totalWatchedEpisodes;
  final int totalWatchMinutes;
  final double? averageScore;
  final String? favoriteGenre;
  final double? averageReleaseYear;
  final String? favoriteReleasePeriod;
  final String? preferenceSummary;
  final List<AnalysisAnimeInsight> topWatchedGenreAnime;
  final List<AnalysisAnimeInsight> topRatedGenreAnime;
  final SeriesStats seriesStats;
  final Map<String, double> genreDistribution;
  final Map<String, double> genreWatchMinutes;
  final Map<String, double> genreAverageScore;
  final Map<String, double> releaseYearDistribution;
  final Map<String, double> scoreDistribution;

  factory StatsOverview.fromJson(JsonMap json) {
    final item = asJsonMap(json['item']);
    final root = item.isEmpty ? json : item;
    Map<String, double> numberMap(Object? value) => asJsonMap(
      value,
    ).map((key, item) => MapEntry(key, readDouble(item) ?? 0));
    return StatsOverview(
      totalCount: readInt(root['totalCount']) ?? 0,
      completedCount: readInt(root['completedCount']) ?? 0,
      watchingCount: readInt(root['watchingCount']) ?? 0,
      droppedCount: readInt(root['droppedCount']) ?? 0,
      totalWatchedEpisodes: readInt(root['totalWatchedEpisodes']) ?? 0,
      totalWatchMinutes: readInt(root['totalWatchMinutes']) ?? 0,
      averageScore: readDouble(root['avgScore']),
      favoriteGenre: readString(root['favoriteGenre']),
      averageReleaseYear: readDouble(root['avgReleaseYear']),
      favoriteReleasePeriod: readString(root['favoriteReleasePeriod']),
      preferenceSummary: readString(root['preferenceSummary']),
      topWatchedGenreAnime: asJsonList(
        root['topWatchedGenreTopAnime'],
      ).map(AnalysisAnimeInsight.fromJson).toList(),
      topRatedGenreAnime: asJsonList(
        root['topRatedGenreTopAnime'],
      ).map(AnalysisAnimeInsight.fromJson).toList(),
      seriesStats: SeriesStats.fromJson(asJsonMap(root['seriesStats'])),
      genreDistribution: numberMap(root['genreDistribution']),
      genreWatchMinutes: numberMap(root['genreWatchMinutes']),
      genreAverageScore: numberMap(root['genreAvgScore']),
      releaseYearDistribution: numberMap(root['releaseYearDistribution']),
      scoreDistribution: numberMap(root['scoreDistribution']),
    );
  }
}

class AnalysisAnimeInsight {
  const AnalysisAnimeInsight({
    required this.animeId,
    required this.title,
    this.coverImageUrl,
    this.score,
    this.genre,
  });

  final int animeId;
  final String title;
  final String? coverImageUrl;
  final double? score;
  final String? genre;

  factory AnalysisAnimeInsight.fromJson(JsonMap json) => AnalysisAnimeInsight(
    animeId: readInt(json['animeId']) ?? readInt(json['id']) ?? 0,
    title: readString(json['title']) ?? '제목 정보 없음',
    coverImageUrl:
        readString(json['coverImageLarge']) ??
        readString(json['coverImageUrl']),
    score: readDouble(json['score']),
    genre: readString(json['genre']),
  );
}

class SeriesStats {
  const SeriesStats({
    this.watchedSeriesCount = 0,
    this.completedSeriesCount = 0,
    this.seriesCompletionRate = 0,
  });

  final int watchedSeriesCount;
  final int completedSeriesCount;
  final double seriesCompletionRate;

  factory SeriesStats.fromJson(JsonMap json) => SeriesStats(
    watchedSeriesCount: readInt(json['watchedSeriesCount']) ?? 0,
    completedSeriesCount: readInt(json['completedSeriesCount']) ?? 0,
    seriesCompletionRate: readDouble(json['seriesCompletionRate']) ?? 0,
  );
}

class FormatStat {
  const FormatStat({
    required this.format,
    required this.label,
    required this.animeCount,
    required this.percentage,
    this.averageScore,
    this.watchMinutes = 0,
  });
  final String format;
  final String label;
  final int animeCount;
  final double percentage;
  final double? averageScore;
  final int watchMinutes;

  factory FormatStat.fromJson(JsonMap json) => FormatStat(
    format: readString(json['format']) ?? 'UNKNOWN',
    label: readString(json['label']) ?? readString(json['format']) ?? '기타',
    animeCount: readInt(json['animeCount']) ?? 0,
    percentage: readDouble(json['percentage']) ?? 0,
    averageScore: readDouble(json['averageScore']),
    watchMinutes: readInt(json['watchMinutes']) ?? 0,
  );
}

class FormatDistribution {
  const FormatDistribution({
    required this.items,
    required this.totalAnimeCount,
    this.totalWatchMinutes = 0,
  });
  final List<FormatStat> items;
  final int totalAnimeCount;
  final int totalWatchMinutes;

  factory FormatDistribution.fromJson(JsonMap json) {
    final item = asJsonMap(json['item']);
    final root = item.isEmpty ? json : item;
    return FormatDistribution(
      items: asJsonList(root['items']).map(FormatStat.fromJson).toList(),
      totalAnimeCount: readInt(root['totalAnimeCount']) ?? 0,
      totalWatchMinutes: readInt(root['totalWatchMinutes']) ?? 0,
    );
  }
}

class GenreBubble {
  const GenreBubble({
    required this.genre,
    required this.animeCount,
    required this.myAverageScore,
    required this.communityAverageScore,
    required this.preferenceScore,
    required this.bubbleSize,
  });
  final String genre;
  final int animeCount;
  final double myAverageScore;
  final double communityAverageScore;
  final double preferenceScore;
  final double bubbleSize;

  factory GenreBubble.fromJson(JsonMap json) => GenreBubble(
    genre: readString(json['genre']) ?? '기타',
    animeCount: readInt(json['animeCount']) ?? 0,
    myAverageScore: readDouble(json['myAverageScore']) ?? 0,
    communityAverageScore: readDouble(json['communityAverageScore']) ?? 0,
    preferenceScore: readDouble(json['preferenceScore']) ?? 0,
    bubbleSize: readDouble(json['bubbleSize']) ?? 0,
  );
}

class YearlyScore {
  const YearlyScore({
    required this.year,
    required this.animeCount,
    required this.ratedAnimeCount,
    this.averageScore,
    this.communityAverageScore,
    this.preferenceDelta,
  });
  final int year;
  final int animeCount;
  final int ratedAnimeCount;
  final double? averageScore;
  final double? communityAverageScore;
  final double? preferenceDelta;

  factory YearlyScore.fromJson(JsonMap json) => YearlyScore(
    year: readInt(json['year']) ?? 0,
    animeCount: readInt(json['animeCount']) ?? 0,
    ratedAnimeCount: readInt(json['ratedAnimeCount']) ?? 0,
    averageScore: readDouble(json['averageScore']),
    communityAverageScore: readDouble(json['communityAverageScore']),
    preferenceDelta: readDouble(json['preferenceDelta']),
  );
}

class ViewingDnaAxis {
  const ViewingDnaAxis({
    required this.key,
    required this.label,
    required this.score,
    required this.available,
    required this.description,
  });

  final String key;
  final String label;
  final double score;
  final bool available;
  final String description;

  factory ViewingDnaAxis.fromJson(JsonMap json) => ViewingDnaAxis(
    key: readString(json['key']) ?? '',
    label: readString(json['label']) ?? '',
    score: readDouble(json['score']) ?? 0,
    available: readBool(json['available']),
    description: readString(json['description']) ?? '',
  );
}

class ViewingDna {
  const ViewingDna({
    required this.axes,
    required this.confidence,
    this.strongestAxis,
  });

  final List<ViewingDnaAxis> axes;
  final String confidence;
  final String? strongestAxis;

  factory ViewingDna.fromJson(JsonMap json) {
    final item = asJsonMap(json['item']);
    final root = item.isEmpty ? json : item;
    return ViewingDna(
      axes: asJsonList(root['axes']).map(ViewingDnaAxis.fromJson).toList(),
      confidence: readString(root['confidence']) ?? 'none',
      strongestAxis: readString(root['strongestAxis']),
    );
  }
}

class StudioRanking {
  const StudioRanking({
    required this.id,
    required this.name,
    required this.animeCount,
    required this.totalWatchMinutes,
    this.averageScore,
  });
  final int id;
  final String name;
  final int animeCount;
  final int totalWatchMinutes;
  final double? averageScore;

  factory StudioRanking.fromJson(JsonMap json) {
    final studio = asJsonMap(json['studio']);
    return StudioRanking(
      id: readInt(studio['id']) ?? readInt(json['studioId']) ?? 0,
      name: readString(studio['name']) ?? readString(json['name']) ?? '스튜디오',
      animeCount: readInt(json['animeCount']) ?? 0,
      totalWatchMinutes: readInt(json['totalWatchMinutes']) ?? 0,
      averageScore: readDouble(json['averageScore']),
    );
  }
}

class VoiceActorRanking {
  const VoiceActorRanking({
    required this.id,
    required this.name,
    required this.animeCount,
    required this.characterCount,
    this.averageScore,
    this.imageUrl,
    this.totalWatchMinutes = 0,
  });
  final int id;
  final String name;
  final int animeCount;
  final int characterCount;
  final double? averageScore;
  final String? imageUrl;
  final int totalWatchMinutes;

  factory VoiceActorRanking.fromJson(JsonMap json) {
    final actor = asJsonMap(json['voiceActor']);
    final name = asJsonMap(actor['name']);
    final image = asJsonMap(actor['image']);
    return VoiceActorRanking(
      id: readInt(actor['id']) ?? readInt(json['voiceActorId']) ?? 0,
      name:
          readString(name['userPreferred']) ??
          readString(name['full']) ??
          readString(name['native']) ??
          readString(json['name']) ??
          '성우',
      animeCount: readInt(json['animeCount']) ?? 0,
      characterCount: readInt(json['characterCount']) ?? 0,
      averageScore: readDouble(json['averageScore']),
      imageUrl: readString(image['large']) ?? readString(image['medium']),
      totalWatchMinutes: readInt(json['totalWatchMinutes']) ?? 0,
    );
  }
}

class VoiceActorCharacter {
  const VoiceActorCharacter({
    required this.id,
    required this.name,
    this.imageUrl,
    this.role,
  });

  final int id;
  final String name;
  final String? imageUrl;
  final String? role;

  factory VoiceActorCharacter.fromJson(JsonMap json) {
    final name = asJsonMap(json['name']);
    final image = asJsonMap(json['image']);
    return VoiceActorCharacter(
      id: readInt(json['id']) ?? 0,
      name:
          readString(name['userPreferred']) ??
          readString(name['full']) ??
          readString(name['native']) ??
          '캐릭터',
      imageUrl: readString(image['large']) ?? readString(image['medium']),
      role: readString(json['role']),
    );
  }
}

class AnalysisAnimeWork {
  const AnalysisAnimeWork({
    required this.anime,
    this.characters = const [],
    this.score,
    this.status,
    this.progress,
  });

  final Anime anime;
  final List<VoiceActorCharacter> characters;
  final double? score;
  final CollectionStatus? status;
  final int? progress;

  int? get watchMinutes {
    final duration = anime.duration;
    if (duration == null || duration <= 0) return null;
    final recordedProgress = progress ?? 0;
    final episodes = anime.episodes;
    final watchedEpisodes =
        status == CollectionStatus.completed && episodes != null
        ? episodes
        : episodes == null
        ? recordedProgress
        : recordedProgress.clamp(0, episodes);
    return watchedEpisodes * duration;
  }

  factory AnalysisAnimeWork.fromJson(JsonMap json) {
    final userList = asJsonMap(json['userList']);
    return AnalysisAnimeWork(
      anime: Anime.fromJson(json),
      characters: asJsonList(
        json['characters'],
      ).map(VoiceActorCharacter.fromJson).toList(),
      score: readDouble(userList['score']),
      status: userList.isEmpty
          ? null
          : CollectionStatus.fromApi(readString(userList['status'])),
      progress: readInt(userList['progress']),
    );
  }

  factory AnalysisAnimeWork.fromCollectionEntry(CollectionEntry entry) {
    return AnalysisAnimeWork(
      anime: entry.anime,
      score: entry.score,
      status: entry.status,
      progress: entry.progress,
    );
  }
}

enum AnimeSeriesScope {
  mainline('mainline', '본편 시리즈'),
  franchise('franchise', '관련 작품 전체');

  const AnimeSeriesScope(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

enum UserSeriesStatus {
  all('all', '전체 시리즈'),
  started('started', '시작한 시리즈'),
  watched('watched', '본 시리즈'),
  completed('completed', '완주한 시리즈');

  const UserSeriesStatus(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

class SeriesCollectionMember {
  const SeriesCollectionMember({
    required this.anime,
    required this.completionRequired,
    this.completionExclusionReason,
    this.userList,
  });

  final Anime anime;
  final bool completionRequired;
  final String? completionExclusionReason;
  final MyCollectionState? userList;

  factory SeriesCollectionMember.fromJson(JsonMap json) {
    final userList = asJsonMap(json['userList']);
    return SeriesCollectionMember(
      anime: Anime.fromJson(asJsonMap(json['anime'])),
      completionRequired: readBool(json['completionRequired']),
      completionExclusionReason: readString(json['completionExclusionReason']),
      userList: userList.isEmpty
          ? null
          : MyCollectionState(
              exists: true,
              status: CollectionStatus.fromApi(readString(userList['status'])),
              score: readDouble(userList['score']),
              progress: readInt(userList['progress']),
            ),
    );
  }
}

class SeriesCollectionItem {
  const SeriesCollectionItem({
    required this.seriesId,
    required this.scope,
    required this.title,
    required this.memberCount,
    required this.requiredMemberCount,
    required this.collectedMemberCount,
    required this.completedRequiredMemberCount,
    required this.completionRate,
    required this.completed,
    required this.items,
    this.canonicalAnimeId,
    this.coverImageUrl,
  });

  final int seriesId;
  final AnimeSeriesScope scope;
  final String title;
  final int memberCount;
  final int requiredMemberCount;
  final int collectedMemberCount;
  final int completedRequiredMemberCount;
  final double completionRate;
  final bool completed;
  final List<SeriesCollectionMember> items;
  final int? canonicalAnimeId;
  final String? coverImageUrl;

  double get completionPercent {
    final percent = completionRate <= 1 ? completionRate * 100 : completionRate;
    return percent.clamp(0, 100);
  }

  double get completionFraction {
    final percent = completionPercent;
    return percent.toStringAsFixed(0) == '100' ? 1 : percent / 100;
  }

  factory SeriesCollectionItem.fromJson(JsonMap json) => SeriesCollectionItem(
    seriesId: readInt(json['seriesId']) ?? 0,
    scope: readString(json['scope']) == AnimeSeriesScope.franchise.apiValue
        ? AnimeSeriesScope.franchise
        : AnimeSeriesScope.mainline,
    title: readString(json['title']) ?? '이름 없는 시리즈',
    memberCount: readInt(json['memberCount']) ?? 0,
    requiredMemberCount: readInt(json['requiredMemberCount']) ?? 0,
    collectedMemberCount: readInt(json['collectedMemberCount']) ?? 0,
    completedRequiredMemberCount:
        readInt(json['completedRequiredMemberCount']) ?? 0,
    completionRate: readDouble(json['completionRate']) ?? 0,
    completed: readBool(json['completed']),
    canonicalAnimeId: readInt(json['canonicalAnimeId']),
    coverImageUrl:
        readString(json['coverImageExtraLarge']) ??
        readString(json['coverImageLarge']),
    items: asJsonList(
      json['items'],
    ).map(SeriesCollectionMember.fromJson).toList(),
  );
}

enum UserRelationship {
  none,
  incoming,
  outgoing,
  friend;

  static UserRelationship fromApi(String? value) {
    return values.firstWhere(
      (relationship) => relationship.name == value,
      orElse: () => none,
    );
  }
}

class PublicUser {
  const PublicUser({
    required this.id,
    required this.username,
    required this.animeListCount,
    this.profileImageUrl,
    this.bio,
  });

  final int id;
  final String username;
  final int animeListCount;
  final String? profileImageUrl;
  final String? bio;

  factory PublicUser.fromJson(JsonMap json) {
    final nested = asJsonMap(json['user']);
    final root = nested.isEmpty ? json : nested;
    return PublicUser(
      id: readInt(root['id']) ?? 0,
      username: readString(root['username']) ?? '사용자',
      animeListCount: readInt(root['animeListCount']) ?? 0,
      profileImageUrl: readString(root['profileImageUrl']),
      bio: readString(root['bio']),
    );
  }
}

class UserSearchResult {
  const UserSearchResult({
    required this.user,
    required this.relationship,
    this.requestId,
  });

  final PublicUser user;
  final UserRelationship relationship;
  final int? requestId;

  factory UserSearchResult.fromJson(JsonMap json) => UserSearchResult(
    user: PublicUser.fromJson(json),
    relationship: UserRelationship.fromApi(readString(json['relationship'])),
    requestId: readInt(json['requestId']),
  );
}

class FriendRequest {
  const FriendRequest({
    required this.id,
    required this.user,
    required this.status,
    this.createdAt,
  });

  final int id;
  final PublicUser user;
  final String status;
  final String? createdAt;

  factory FriendRequest.fromJson(JsonMap json) => FriendRequest(
    id: readInt(json['id']) ?? 0,
    user: PublicUser.fromJson(json),
    status: readString(json['status']) ?? 'pending',
    createdAt: readString(json['createdAt']),
  );
}

class FriendItem {
  const FriendItem({required this.id, required this.user, this.createdAt});

  final int id;
  final PublicUser user;
  final String? createdAt;

  factory FriendItem.fromJson(JsonMap json) => FriendItem(
    id: readInt(json['id']) ?? 0,
    user: PublicUser.fromJson(json),
    createdAt: readString(json['createdAt']),
  );
}

class FriendSnapshot {
  const FriendSnapshot({
    required this.friends,
    required this.incoming,
    required this.outgoing,
  });

  final List<FriendItem> friends;
  final List<FriendRequest> incoming;
  final List<FriendRequest> outgoing;
}
