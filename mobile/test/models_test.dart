import 'package:flutter_test/flutter_test.dart';

import 'package:myanitrack_mobile/src/models.dart';

void main() {
  group('컬렉션 DTO', () {
    test('entry id와 anime id를 구분하고 nullable 값을 보존한다', () {
      final entry = CollectionEntry.fromJson({
        'id': 42,
        'userId': 7,
        'animeId': 101,
        'status': 'watching',
        'score': null,
        'progress': null,
        'startedAt': null,
        'completedAt': null,
        'notes': null,
        'anime': {
          'id': 101,
          'title': {'ko': '장송의 프리렌', 'romaji': 'Sousou no Frieren'},
          'episodes': null,
          'coverImage': {'large': null},
        },
      });

      expect(entry.entryId, 42);
      expect(entry.animeId, 101);
      expect(entry.anime.title, '장송의 프리렌');
      expect(entry.score, isNull);
      expect(entry.progress, isNull);
      expect(entry.anime.episodes, isNull);
      expect(entry.anime.coverImageUrl, isNull);
    });

    test('PATCH는 지울 필드를 명시적 null로 직렬화한다', () {
      final json = const CollectionDraft(
        status: CollectionStatus.completed,
        score: null,
        progress: 12,
        startedAt: null,
        completedAt: null,
        notes: null,
      ).toPatchJson();

      expect(json, containsPair('score', null));
      expect(json, containsPair('startedAt', null));
      expect(json, containsPair('completedAt', null));
      expect(json, containsPair('notes', null));
      expect(json['progress'], 12);
    });

    test('cursor 페이지 정보를 읽는다', () {
      final pageInfo = PageInfo.fromJson({
        'hasNext': true,
        'nextCursor': 'cursor-2',
        'limit': 20,
      });

      expect(pageInfo.hasNext, isTrue);
      expect(pageInfo.nextCursor, 'cursor-2');
      expect(pageInfo.limit, 20);
    });

    test('실제 캐스트 응답의 복수 성우를 평탄화한다', () {
      final items = AnimeCastMember.listFromJson({
        'id': 3,
        'name': {'userPreferred': '프리렌'},
        'image': {'large': 'character.jpg'},
        'voiceActors': [
          {
            'id': 10,
            'name': {'full': '성우 A'},
            'image': {'medium': 'actor-a.jpg'},
          },
          {
            'id': 11,
            'name': {'native': '성우 B'},
            'image': {'large': null},
          },
        ],
      });

      expect(items, hasLength(2));
      expect(items.first.characterName, '프리렌');
      expect(items.first.voiceActorName, '성우 A');
      expect(items.first.voiceActorImageUrl, 'actor-a.jpg');
      expect(items.last.voiceActorName, '성우 B');
      expect(items.last.voiceActorImageUrl, isNull);
    });

    test('배지 현황과 진행률을 nullable 계약대로 읽는다', () {
      final badges = BadgeOverview.fromJson({
        'earnedCount': 1,
        'totalCount': 2,
        'items': [
          {
            'id': 1,
            'code': 'ANIME_TOTAL_100',
            'name': '100편 시청',
            'earned': false,
            'progress': {'current': 25, 'target': 100, 'percent': 25},
          },
        ],
      });

      expect(badges.earnedCount, 1);
      expect(badges.totalCount, 2);
      expect(badges.items.single.progress?.percent, 25);
    });
  });

  group('분석 DTO', () {
    test('포맷 분포 중첩 응답과 nullable 평균 점수를 읽는다', () {
      final distribution = FormatDistribution.fromJson({
        'item': {
          'totalAnimeCount': 8,
          'items': [
            {
              'format': 'TV',
              'label': 'TV',
              'animeCount': 8,
              'percentage': 100,
              'averageScore': null,
            },
          ],
        },
      });

      expect(distribution.totalAnimeCount, 8);
      expect(distribution.items.single.averageScore, isNull);
    });

    test('장르·연도·스튜디오·성우 응답을 계약대로 읽는다', () {
      final genre = GenreBubble.fromJson({
        'genre': '드라마',
        'animeCount': 4,
        'myAverageScore': 8.5,
        'communityAverageScore': 79,
        'preferenceScore': 0.82,
        'bubbleSize': 32,
      });
      final year = YearlyScore.fromJson({
        'year': 2024,
        'animeCount': 3,
        'ratedAnimeCount': 0,
        'averageScore': null,
        'communityAverageScore': 81,
      });
      final studio = StudioRanking.fromJson({
        'studio': {'id': 9, 'name': 'Madhouse'},
        'animeCount': 5,
        'totalWatchMinutes': 600,
        'averageScore': null,
      });
      final actor = VoiceActorRanking.fromJson({
        'voiceActor': {
          'id': 11,
          'name': {'userPreferred': '타네자키 아츠미'},
          'image': {'large': null},
        },
        'animeCount': 2,
        'characterCount': 3,
        'averageScore': 9,
      });

      expect(genre.genre, '드라마');
      expect(year.averageScore, isNull);
      expect(studio.id, 9);
      expect(studio.averageScore, isNull);
      expect(actor.name, '타네자키 아츠미');
      expect(actor.imageUrl, isNull);
    });
  });
}
