import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_badge.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/anime_poster.dart';
import '../../../core/widgets/sample_banner.dart';
import '../../../data/api/api_client.dart';
import '../../../data/api/platform_repository.dart';
import '../../../data/api/sample_repository.dart';
import '../../../data/auth/auth_session_service.dart';
import '../../../data/models/anime_entry.dart';
import '../../../data/models/sample_data.dart';
import '../../../data/models/stats_overview.dart';
import '../../anime_search/presentation/anime_search_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late Future<StatsOverview> _sampleOverviewFuture =
      SampleRepository(ApiClient()).fetchSampleOverviewStats();
  late Future<List<AnimeEntry>> _sampleEntriesFuture =
      SampleRepository(ApiClient()).fetchSampleCollection();
  late Future<Map<String, dynamic>> _platformStatsFuture =
      PlatformRepository(ApiClient()).fetchPlatformStats();
  late Future<List<AnimeEntry>> _popularAnimeFuture =
      PlatformRepository(ApiClient()).fetchPopularAnimeItems();

  Future<void> _refreshHome() async {
    setState(() {
      _sampleOverviewFuture =
          SampleRepository(ApiClient()).fetchSampleOverviewStats();
      _sampleEntriesFuture =
          SampleRepository(ApiClient()).fetchSampleCollection();
      _platformStatsFuture = PlatformRepository(ApiClient()).fetchPlatformStats();
      _popularAnimeFuture =
          PlatformRepository(ApiClient()).fetchPopularAnimeItems();
    });

    await Future.wait([
      _sampleOverviewFuture,
      _sampleEntriesFuture,
      _platformStatsFuture,
      _popularAnimeFuture,
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AnimeEntry>>(
      future: _sampleEntriesFuture,
      builder: (context, snapshot) {
        final entries = snapshot.data == null || snapshot.data!.isEmpty
            ? sampleEntries
            : snapshot.data!;
        final fallbackOverview = StatsOverview.fromEntries(entries);

        return RefreshIndicator(
          onRefresh: _refreshHome,
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                sliver: SliverList.list(
                  children: [
                    const _HomeHeader(),
                    const SizedBox(height: 18),
                    const SampleBanner(),
                    const SizedBox(height: 18),
                    _HeroPanel(
                      overviewFuture: _sampleOverviewFuture,
                      fallbackOverview: fallbackOverview,
                      collectionLoading:
                          snapshot.connectionState == ConnectionState.waiting,
                    ),
                    const SizedBox(height: 18),
                    Text(
                      '최근 샘플 기록',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 12),
                    ...entries.take(3).map(
                          (entry) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _RecentAnimeCard(entry: entry),
                          ),
                        ),
                    const SizedBox(height: 6),
                    _PlatformStatsPanel(future: _platformStatsFuture),
                    const SizedBox(height: 18),
                    _PopularAnimePanel(future: _popularAnimeFuture),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

}

class _PopularAnimePanel extends StatelessWidget {
  const _PopularAnimePanel({required this.future});

  final Future<List<AnimeEntry>> future;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AnimeEntry>>(
      future: future,
      builder: (context, snapshot) {
        final items = snapshot.data == null || snapshot.data!.isEmpty
            ? sampleEntries
            : snapshot.data!;

        return AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '인기 애니',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  const AppBadge(label: 'public API'),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                height: 148,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemBuilder: (context, index) {
                    final entry = items[index];
                    return SizedBox(
                      width: 92,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AnimePoster(
                            title: entry.title,
                            imageUrl: entry.coverImageUrl,
                            width: 82,
                            height: 112,
                            radius: 14,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            entry.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                  separatorBuilder: (context, index) => const SizedBox(width: 12),
                  itemCount: items.length > 10 ? 10 : items.length,
                ),
              ),
              if (snapshot.connectionState == ConnectionState.waiting) ...[
                const SizedBox(height: 12),
                const LinearProgressIndicator(minHeight: 3),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _PlatformStatsPanel extends StatelessWidget {
  const _PlatformStatsPanel({required this.future});

  final Future<Map<String, dynamic>> future;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: future,
      builder: (context, snapshot) {
        final data = _readSource(snapshot.data ?? const <String, dynamic>{});
        final userCount = _readStat(
          data,
          ['userCount', 'users', 'totalUsers', 'memberCount'],
        );
        final animeCount =
            _readStat(data, ['animeCount', 'anime', 'totalAnime', 'titles']);
        final collectionCount = _readStat(
          data,
          ['collectionCount', 'entries', 'totalCollections', 'records'],
        );

        return AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '플랫폼 통계',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  const AppBadge(label: 'public API'),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  _PlatformStat(label: '사용자', value: userCount),
                  const SizedBox(width: 10),
                  _PlatformStat(label: '애니', value: animeCount),
                  const SizedBox(width: 10),
                  _PlatformStat(label: '기록', value: collectionCount),
                ],
              ),
              if (snapshot.connectionState == ConnectionState.waiting) ...[
                const SizedBox(height: 14),
                const LinearProgressIndicator(minHeight: 3),
              ],
            ],
          ),
        );
      },
    );
  }

  String _readStat(Map<String, dynamic> data, List<String> keys) {
    for (final key in keys) {
      final value = data[key];
      if (value != null) {
        return value.toString();
      }
    }
    return '-';
  }

  Map<String, dynamic> _readSource(Map<String, dynamic> data) {
    for (final key in const ['stats', 'summary', 'data']) {
      final value = data[key];
      if (value is Map<String, dynamic>) {
        return value;
      }
    }

    return data;
  }
}

class _PlatformStat extends StatelessWidget {
  const _PlatformStat({
    required this.label,
    required this.value,
  });

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
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentAnimeCard extends StatelessWidget {
  const _RecentAnimeCard({required this.entry});

  final AnimeEntry entry;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          AnimePoster(
            title: entry.title,
            imageUrl: entry.coverImageUrl,
            width: 62,
            height: 86,
            radius: 14,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  '${entry.year} · ${entry.format} · ${entry.genre}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Icon(
                      Icons.star_rounded,
                      color: AppColors.pointBorder,
                      size: 18,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      entry.score.toStringAsFixed(1),
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(width: 12),
                    AppBadge(
                      label: '${entry.progress}/${entry.totalEpisodes}',
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'MyAniTrack',
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      fontSize: 34,
                      letterSpacing: 0,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                '애니 시청 기록을 모으고 취향을 분석하세요.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ],
          ),
        ),
        IconButton.filled(
          onPressed: () => _startGoogleLogin(context),
          icon: const Icon(Icons.person_outline),
          tooltip: '로그인',
        ),
      ],
    );
  }

  Future<void> _startGoogleLogin(BuildContext context) async {
    try {
      await const AuthSessionService().signInWithGoogle(
        redirectTo: AppConfig.authRedirectUrl,
      );
    } on Object {
      if (!context.mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Supabase 설정 후 Google 로그인을 사용할 수 있습니다.'),
        ),
      );
    }
  }
}

class _HeroPanel extends StatelessWidget {
  const _HeroPanel({
    required this.overviewFuture,
    required this.fallbackOverview,
    required this.collectionLoading,
  });

  final Future<StatsOverview> overviewFuture;
  final StatsOverview fallbackOverview;
  final bool collectionLoading;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<StatsOverview>(
      future: overviewFuture,
      builder: (context, snapshot) {
        final overview = snapshot.data ?? fallbackOverview;
        final loading = collectionLoading ||
            snapshot.connectionState == ConnectionState.waiting;

        return Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.darkEspresso,
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(
                color: Color(0x221C1917),
                blurRadius: 28,
                offset: Offset(0, 16),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AppBadge(
                label: '샘플 컬렉션',
                sample: true,
                icon: Icons.visibility_outlined,
              ),
              if (loading) ...[
                const SizedBox(height: 10),
                const LinearProgressIndicator(
                  minHeight: 3,
                  backgroundColor: AppColors.darkBorder,
                  valueColor: AlwaysStoppedAnimation(AppColors.pointBorder),
                ),
              ],
              const SizedBox(height: 18),
              Text(
                '이번 분기와 지난 명작을 한 곳에 기록하고, 점수와 장르 흐름을 바로 확인합니다.',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: AppColors.bgIvory,
                      fontSize: 22,
                      height: 1.3,
                    ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  _HeroMetric(
                    label: '완료',
                    value: '${overview.completedCount}편',
                  ),
                  const SizedBox(width: 12),
                  _HeroMetric(
                    label: '평균',
                    value: overview.avgScore.toStringAsFixed(1),
                  ),
                  const SizedBox(width: 12),
                  _HeroMetric(
                    label: '최애 장르',
                    value: overview.favoriteGenre,
                  ),
                ],
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => const AnimeSearchPage(),
                    ),
                  );
                },
                icon: const Icon(Icons.add_rounded),
                label: const Text('내 기록으로 시작하기'),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _HeroMetric extends StatelessWidget {
  const _HeroMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: AppColors.pointSoftStrong,
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.textInverse,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}
