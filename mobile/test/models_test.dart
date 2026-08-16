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

    test('earnedAt 또는 완료 진행률이 있으면 획득 배지로 판정한다', () {
      final badges = BadgeOverview.fromJson({
        'items': [
          {
            'id': 1,
            'code': 'PUBLIC_BADGE',
            'name': '공개 배지',
            'earnedAt': '2026-07-20T12:00:00Z',
          },
          {
            'id': 2,
            'code': 'COMPLETED_BADGE',
            'name': '완료 배지',
            'earned': false,
            'progress': {'percent': 100, 'isComplete': true},
          },
          {
            'id': 3,
            'code': 'LOCKED_BADGE',
            'name': '미획득 배지',
            'earned': false,
            'progress': {'percent': 50, 'isComplete': false},
          },
        ],
      });

      expect(badges.items[0].earned, isTrue);
      expect(badges.items[1].earned, isTrue);
      expect(badges.items[2].earned, isFalse);
      expect(badges.earnedCount, 2);
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
        'communityAverageScore': 7.9,
        'preferenceScore': 0.82,
        'bubbleSize': 32,
      });
      final year = YearlyScore.fromJson({
        'year': 2024,
        'animeCount': 3,
        'ratedAnimeCount': 0,
        'averageScore': null,
        'communityAverageScore': 8.1,
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
      expect(year.communityAverageScore, 8.1);
      expect(studio.id, 9);
      expect(studio.averageScore, isNull);
      expect(actor.name, '타네자키 아츠미');
      expect(actor.imageUrl, isNull);
    });

    test('성우 작품 응답의 애니와 복수 캐릭터를 함께 보존한다', () {
      final work = AnalysisAnimeWork.fromJson({
        'anime': {
          'id': 123,
          'title': '장송의 프리렌',
          'coverImageLarge': 'anime.jpg',
          'episodes': 28,
          'duration': 24,
        },
        'userList': {'score': 9.5, 'status': 'completed', 'progress': 20},
        'characters': [
          {
            'id': 7,
            'role': 'MAIN',
            'name': {'userPreferred': '프리렌'},
            'image': {'large': 'frieren.jpg'},
          },
          {
            'id': 8,
            'role': 'SUPPORT',
            'name': {'full': '다른 캐릭터'},
            'image': {'medium': 'other.jpg'},
          },
        ],
      });

      expect(work.anime.id, 123);
      expect(work.score, 9.5);
      expect(work.characters, hasLength(2));
      expect(work.characters.first.name, '프리렌');
      expect(work.characters.first.role, 'MAIN');
      expect(work.characters.last.imageUrl, 'other.jpg');
      expect(work.watchMinutes, 672);
    });

    test('시리즈 컬렉션의 완주율과 멤버 상태를 보존한다', () {
      final item = SeriesCollectionItem.fromJson({
        'seriesId': 4,
        'scope': 'franchise',
        'title': '테스트 시리즈',
        'canonicalAnimeId': 11,
        'memberCount': 2,
        'requiredMemberCount': 1,
        'collectedMemberCount': 2,
        'completedRequiredMemberCount': 1,
        'completionRate': 100,
        'completed': true,
        'items': [
          {
            'completionRequired': true,
            'anime': {'id': 11, 'title': '본편'},
            'userList': {'status': 'completed', 'score': 8, 'progress': 12},
          },
          {
            'completionRequired': false,
            'anime': {'id': 12, 'title': '외전'},
          },
        ],
      });

      expect(item.scope, AnimeSeriesScope.franchise);
      expect(item.completionRate, 100);
      expect(item.items, hasLength(2));
      expect(item.items.first.userList?.status, CollectionStatus.completed);
      expect(item.items.last.userList, isNull);
    });

    test('화면에 100%로 반올림되는 시리즈 완주율은 바도 완전히 채운다', () {
      SeriesCollectionItem item(double rate) => SeriesCollectionItem(
        seriesId: 1,
        scope: AnimeSeriesScope.mainline,
        title: '시리즈',
        memberCount: 1,
        requiredMemberCount: 1,
        collectedMemberCount: 1,
        completedRequiredMemberCount: 1,
        completionRate: rate,
        completed: true,
        items: const [],
      );

      for (final rate in const [1.0, .999, 99.9, 100.0]) {
        expect(item(rate).completionFraction, 1, reason: 'rate=$rate');
      }
      expect(item(.75).completionFraction, .75);
      expect(item(42).completionFraction, .42);
    });

    test('Viewing DNA와 확장 통계 응답을 읽는다', () {
      final dna = ViewingDna.fromJson({
        'item': {
          'confidence': 'high',
          'strongestAxis': 'completion',
          'axes': [
            {
              'key': 'completion',
              'label': '작품 완주력',
              'score': 82.5,
              'available': true,
              'description': '완주 비율',
            },
          ],
        },
      });
      final stats = StatsOverview.fromJson({
        'item': {
          'totalCount': 12,
          'preferenceSummary': '드라마를 선호합니다.',
          'seriesStats': {
            'watchedSeriesCount': 4,
            'completedSeriesCount': 3,
            'seriesCompletionRate': 75,
          },
          'topRatedGenreTopAnime': [
            {'animeId': 7, 'title': '작품', 'coverImageLarge': null, 'score': 10},
          ],
        },
      });

      expect(dna.axes.single.score, 82.5);
      expect(dna.strongestAxis, 'completion');
      expect(stats.seriesStats.completedSeriesCount, 3);
      expect(stats.topRatedGenreAnime.single.animeId, 7);
    });
  });

  group('친구 DTO', () {
    test('검색 결과의 관계와 공개 프로필을 보존한다', () {
      final result = UserSearchResult.fromJson({
        'relationship': 'incoming',
        'requestId': 31,
        'user': {
          'id': 9,
          'username': 'friend_user',
          'profileImageUrl': null,
          'animeListCount': 44,
        },
      });

      expect(result.relationship, UserRelationship.incoming);
      expect(result.requestId, 31);
      expect(result.user.animeListCount, 44);
      expect(result.user.profileImageUrl, isNull);
    });
  });
}
