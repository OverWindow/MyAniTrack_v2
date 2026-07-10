import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/anime_poster.dart';
import '../../../core/widgets/app_badge.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_state_message.dart';
import '../../../data/api/api_client.dart';
import '../../../data/api/profile_repository.dart';
import '../../../data/api/voice_actor_repository.dart';
import '../../../data/models/analysis_models.dart';
import '../../../data/models/anime_entry.dart';
import '../../../data/models/public_badge_info.dart';
import '../../../data/models/stats_overview.dart';

class PublicProfilePage extends StatefulWidget {
  const PublicProfilePage({super.key});

  @override
  State<PublicProfilePage> createState() => _PublicProfilePageState();
}

class _PublicProfilePageState extends State<PublicProfilePage> {
  final _userIdController = TextEditingController();
  PublicProfileSnapshot? _snapshot;
  bool _loading = false;

  @override
  void dispose() {
    _userIdController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPage,
      appBar: AppBar(
        title: const Text('공개 프로필'),
        backgroundColor: AppColors.bgPage,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('사용자 조회', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                TextField(
                  controller: _userIdController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: '공개 user id',
                    hintText: '예: 1',
                  ),
                  onSubmitted: (_) => _loadPublicProfile(),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: _loading ? null : _loadPublicProfile,
                  icon: _loading
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.travel_explore_rounded),
                  label: Text(_loading ? '조회 중' : '공개 프로필 보기'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (_snapshot == null)
            const AppStateMessage(
              icon: Icons.public_rounded,
              title: '공개 컬렉션을 찾아보세요.',
              body: '공개 user id를 입력하면 프로필, 컬렉션, 통계, 성우 랭킹을 확인합니다.',
            )
          else ...[
            _PublicProfileHeader(snapshot: _snapshot!),
            const SizedBox(height: 16),
            _PublicStatsCard(overview: _snapshot!.overview),
            const SizedBox(height: 16),
            _PublicAnimeListCard(entries: _snapshot!.animeList),
            const SizedBox(height: 16),
            _PublicRankingCard(
              title: '공개 성우 랭킹',
              icon: Icons.record_voice_over_outlined,
              items: _snapshot!.voiceActors,
            ),
            const SizedBox(height: 16),
            _PublicBadgesCard(badges: _snapshot!.badges),
          ],
        ],
      ),
    );
  }

  Future<void> _loadPublicProfile() async {
    final userId = int.tryParse(_userIdController.text.trim());
    if (userId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('숫자 user id를 입력해주세요.')),
      );
      return;
    }

    setState(() => _loading = true);

    try {
      final profileRepository = ProfileRepository(ApiClient());
      final voiceActorRepository = VoiceActorRepository(ApiClient());
      final profile = await profileRepository.fetchPublicProfile(userId);
      final stats = await profileRepository.fetchPublicStats(userId);
      final animeList = await profileRepository.fetchPublicAnimeListItems(userId);
      final badges = await profileRepository.fetchPublicBadgeItems(userId);
      final voiceActorsJson =
          await voiceActorRepository.fetchPublicRanking(userId, limit: 8);
      final voiceActors = _readItems(voiceActorsJson)
          .whereType<Map<String, dynamic>>()
          .map(RankingItem.fromJson)
          .toList();

      if (!mounted) {
        return;
      }
      setState(() {
        _snapshot = PublicProfileSnapshot(
          profile: _readProfile(profile),
          overview: StatsOverview.fromJson(stats),
          animeList: animeList,
          badges: badges,
          voiceActors: voiceActors,
        );
      });
    } on Object {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('공개 프로필을 불러오지 못했습니다.')),
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  PublicProfileInfo _readProfile(Map<String, dynamic> json) {
    final data = json['data'];
    final root = data is Map<String, dynamic> ? data : json;
    final user = root['user'] is Map<String, dynamic>
        ? root['user'] as Map<String, dynamic>
        : root;

    return PublicProfileInfo(
      username: (user['username'] ?? user['email'] ?? '공개 사용자').toString(),
      bio: user['bio']?.toString(),
      profileImageUrl: user['profileImageUrl']?.toString(),
      isPublic: user['isPublic'] is bool ? user['isPublic'] as bool : true,
    );
  }

  List<Object?> _readItems(Map<String, dynamic> json) {
    final data = json['data'];
    if (data is Map<String, dynamic>) {
      return _readItems(data);
    }
    final value = json['items'] ??
        data ??
        json['results'] ??
        json['ranking'] ??
        json['voiceActors'] ??
        const [];
    return value is List ? value : const [];
  }
}

class PublicProfileSnapshot {
  const PublicProfileSnapshot({
    required this.profile,
    required this.overview,
    required this.animeList,
    required this.badges,
    required this.voiceActors,
  });

  final PublicProfileInfo profile;
  final StatsOverview overview;
  final List<AnimeEntry> animeList;
  final List<PublicBadgeInfo> badges;
  final List<RankingItem> voiceActors;
}

class PublicProfileInfo {
  const PublicProfileInfo({
    required this.username,
    required this.isPublic,
    this.bio,
    this.profileImageUrl,
  });

  final String username;
  final bool isPublic;
  final String? bio;
  final String? profileImageUrl;
}

class _PublicProfileHeader extends StatelessWidget {
  const _PublicProfileHeader({required this.snapshot});

  final PublicProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final profile = snapshot.profile;

    return AppCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: AppColors.pointSoft,
            foregroundColor: AppColors.textOnPointSoft,
            backgroundImage: _imageProvider(profile.profileImageUrl),
            child: profile.profileImageUrl == null
                ? const Icon(Icons.person_outline, size: 30)
                : null,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        profile.username,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    AppBadge(
                      label: profile.isPublic ? 'public' : 'private',
                      sample: profile.isPublic,
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  profile.bio?.isNotEmpty == true
                      ? profile.bio!
                      : '공개된 소개가 없습니다.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  ImageProvider? _imageProvider(String? url) {
    if (url == null || url.isEmpty) {
      return null;
    }
    return NetworkImage(url);
  }
}

class _PublicStatsCard extends StatelessWidget {
  const _PublicStatsCard({required this.overview});

  final StatsOverview overview;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('공개 통계', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          Row(
            children: [
              _MiniStat(label: '작품', value: '${overview.totalCount}'),
              const SizedBox(width: 10),
              _MiniStat(label: '완료', value: '${overview.completedCount}'),
              const SizedBox(width: 10),
              _MiniStat(
                label: '평균',
                value: overview.avgScore.toStringAsFixed(1),
              ),
            ],
          ),
          const SizedBox(height: 10),
          AppBadge(
            label: '선호 장르 ${overview.favoriteGenre}',
            icon: Icons.category_outlined,
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.bgNeutral,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.textMuted.withOpacity(0.12)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: 6),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PublicAnimeListCard extends StatelessWidget {
  const _PublicAnimeListCard({required this.entries});

  final List<AnimeEntry> entries;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('공개 컬렉션', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          if (entries.isEmpty)
            Text('공개된 기록이 없습니다.', style: Theme.of(context).textTheme.bodyMedium)
          else
            for (final entry in entries.take(5))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: AnimePoster(
                  title: entry.title,
                  imageUrl: entry.coverImageUrl,
                  width: 42,
                  height: 58,
                  radius: 10,
                ),
                title: Text(
                  entry.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  '${entry.year} · ${entry.format} · ${entry.genre}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: AppBadge(label: entry.score.toStringAsFixed(1)),
              ),
        ],
      ),
    );
  }
}

class _PublicRankingCard extends StatelessWidget {
  const _PublicRankingCard({
    required this.title,
    required this.icon,
    required this.items,
  });

  final String title;
  final IconData icon;
  final List<RankingItem> items;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          if (items.isEmpty)
            Text('랭킹 데이터가 없습니다.', style: Theme.of(context).textTheme.bodyMedium)
          else
            for (final item in items.take(5))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: AppColors.infoSoft,
                  foregroundColor: AppColors.info,
                  child: Icon(icon),
                ),
                title: Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(item.detail),
              ),
        ],
      ),
    );
  }
}

class _PublicBadgesCard extends StatelessWidget {
  const _PublicBadgesCard({required this.badges});

  final List<PublicBadgeInfo> badges;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('공개 배지', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          if (badges.isEmpty)
            Text('표시할 배지가 없습니다.', style: Theme.of(context).textTheme.bodyMedium)
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final badge in badges.take(12))
                  AppBadge(
                    label: badge.label,
                    icon: Icons.workspace_premium_outlined,
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
