import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:myanitrack_mobile/src/api.dart';
import 'package:myanitrack_mobile/src/localization.dart';
import 'package:myanitrack_mobile/src/models.dart';
import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/theme.dart';
import 'package:myanitrack_mobile/src/widgets.dart';

class AnalysisScreen extends ConsumerStatefulWidget {
  const AnalysisScreen({this.title = '내 분석', this.userId, super.key});

  final String title;
  final int? userId;

  @override
  ConsumerState<AnalysisScreen> createState() => _AnalysisScreenState();
}

class _AnalysisScreenState extends ConsumerState<AnalysisScreen> {
  int _segment = 0;
  String _rankingSort = 'count';

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      child: AppBackground(
        child: CustomScrollView(
          slivers: [
            AppCompactSliverHeader(title: widget.title),
            CupertinoSliverRefreshControl(onRefresh: _refresh),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
              sliver: SliverToBoxAdapter(
                child: CupertinoSlidingSegmentedControl<int>(
                  groupValue: _segment,
                  thumbColor: AppColors.card,
                  backgroundColor: AppColors.softBeige,
                  children: const {
                    0: Padding(
                      padding: EdgeInsets.symmetric(vertical: 9),
                      child: Text('요약'),
                    ),
                    1: Padding(
                      padding: EdgeInsets.symmetric(vertical: 9),
                      child: Text('취향'),
                    ),
                    2: Padding(
                      padding: EdgeInsets.symmetric(vertical: 9),
                      child: Text('랭킹'),
                    ),
                  },
                  onValueChanged: (value) {
                    if (value != null) setState(() => _segment = value);
                  },
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
              sliver: SliverList.list(
                children: [
                  switch (_segment) {
                    0 => _OverviewSegment(userId: widget.userId),
                    1 => _TasteSegment(userId: widget.userId),
                    _ => _RankingSegment(
                      userId: widget.userId,
                      sort: _rankingSort,
                      onSortChanged: (value) =>
                          setState(() => _rankingSort = value),
                    ),
                  },
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _refresh() async {
    final userId = widget.userId;
    ref.invalidate(statsOverviewProvider(userId));
    if (_segment == 0) {
      ref.invalidate(formatDistributionProvider(userId));
      ref.invalidate(viewingDnaProvider(userId));
    }
    if (_segment == 1) {
      ref.invalidate(genreBubbleProvider(userId));
      ref.invalidate(yearlyScoreProvider(userId));
    }
    if (_segment == 2) {
      ref.invalidate(
        studioRankingProvider((userId: userId, sort: _rankingSort)),
      );
      ref.invalidate(
        voiceActorRankingProvider((userId: userId, sort: _rankingSort)),
      );
    }
    await ref.read(statsOverviewProvider(userId).future);
  }
}

class _OverviewSegment extends ConsumerWidget {
  const _OverviewSegment({required this.userId});
  final int? userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(statsOverviewProvider(userId));
    final formats = ref.watch(formatDistributionProvider(userId));
    final dna = ref.watch(viewingDnaProvider(userId));
    return Column(
      children: [
        overview.when(
          loading: () => const AppSkeleton(height: 300),
          error: (error, _) => _AsyncErrorCard(
            title: '기본 통계를 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(statsOverviewProvider(userId)),
          ),
          data: (item) => Column(
            children: [
              _MetricGrid(item: item),
              const SizedBox(height: 14),
              _SeriesStatsCard(stats: item.seriesStats),
              const SizedBox(height: 14),
              AppCard(
                color: AppColors.pointSoftest,
                child: Row(
                  children: [
                    const Icon(
                      CupertinoIcons.heart_fill,
                      color: AppColors.pointPressed,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('가장 선호하는 장르', style: appLabelStyle()),
                          const SizedBox(height: 3),
                          Text(
                            item.favoriteGenre == null
                                ? '아직 데이터가 부족합니다'
                                : genreLabel(item.favoriteGenre),
                            style: appTitleStyle(size: 18),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        dna.when(
          loading: () => const AppSkeleton(height: 360),
          error: (error, _) => _AsyncErrorCard(
            title: 'Viewing DNA를 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(viewingDnaProvider(userId)),
          ),
          data: (data) => _ViewingDnaCard(data: data),
        ),
        const SizedBox(height: 16),
        formats.when(
          loading: () => const AppSkeleton(height: 320),
          error: (error, _) => _AsyncErrorCard(
            title: '포맷 분석을 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(formatDistributionProvider(userId)),
          ),
          data: (data) => _FormatCard(
            data: data,
            onSelected: (format) => _showFilteredCollection(
              context,
              ref,
              userId: userId,
              title: '${_formatLabel(format)} 작품',
              format: format,
            ),
          ),
        ),
      ],
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.item});
  final StatsOverview item;

  @override
  Widget build(BuildContext context) {
    final values = <(String, String)>[
      ('전체 작품', '${item.totalCount}편'),
      ('완주', '${item.completedCount}편'),
      ('보는 중', '${item.watchingCount}편'),
      ('본 에피소드', '${item.totalWatchedEpisodes}화'),
      ('시청 시간', '${(item.totalWatchMinutes / 60).toStringAsFixed(1)}시간'),
      ('평균 점수', item.averageScore?.toStringAsFixed(1) ?? '미평점'),
    ];
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        children: [
          for (var row = 0; row < 3; row++) ...[
            if (row > 0)
              const SizedBox(
                height: 1,
                child: ColoredBox(color: AppColors.border),
              ),
            Row(
              children: [
                for (var column = 0; column < 2; column++) ...[
                  if (column > 0)
                    const SizedBox(
                      width: 1,
                      height: 54,
                      child: ColoredBox(color: AppColors.border),
                    ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 10,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            values[row * 2 + column].$1,
                            style: appLabelStyle(),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            values[row * 2 + column].$2,
                            style: appTitleStyle(size: 19),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SeriesStatsCard extends StatelessWidget {
  const _SeriesStatsCard({required this.stats});
  final SeriesStats stats;

  @override
  Widget build(BuildContext context) => AppCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const AppSectionHeader(
          title: '본 시리즈 분석',
          eyebrow: 'Series',
          description: '본편 계열로 묶인 시리즈의 감상과 완주 현황입니다.',
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            _SeriesMetric(
              label: '본 시리즈',
              value: '${stats.watchedSeriesCount}개',
            ),
            _SeriesMetric(
              label: '완주 시리즈',
              value: '${stats.completedSeriesCount}개',
            ),
            _SeriesMetric(
              label: '완주율',
              value: '${stats.seriesCompletionRate.toStringAsFixed(1)}%',
            ),
          ],
        ),
      ],
    ),
  );
}

class _SeriesMetric extends StatelessWidget {
  const _SeriesMetric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(label, textAlign: TextAlign.center, style: appLabelStyle()),
        const SizedBox(height: 5),
        Text(value, style: appTitleStyle(size: 17)),
      ],
    ),
  );
}

class _ViewingDnaCard extends StatelessWidget {
  const _ViewingDnaCard({required this.data});
  final ViewingDna data;

  @override
  Widget build(BuildContext context) {
    final axes = data.axes.where((axis) => axis.available).toList();
    if (axes.length < 3) {
      return const AppStateView(
        title: 'Viewing DNA 데이터가 부족합니다',
        message: '감상과 평점 기록이 쌓이면 여섯 가지 시청 성향을 보여드립니다.',
      );
    }
    final strongest = data.axes
        .where((axis) => axis.key == data.strongestAxis)
        .firstOrNull;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(
            title: 'Viewing DNA',
            description: strongest == null
                ? '정보 아이콘에서 여섯 축의 설명을 확인할 수 있습니다.'
                : '가장 뚜렷한 성향은 ${strongest.label}입니다.',
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size.square(40),
                  onPressed: () => _showViewingDnaInfo(context, data),
                  child: const Icon(
                    CupertinoIcons.info_circle,
                    color: AppColors.pointPressed,
                  ),
                ),
                AppBadge(label: _confidenceLabel(data.confidence)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 280,
            child: RadarChart(
              RadarChartData(
                dataSets: [
                  RadarDataSet(
                    dataEntries: [
                      for (final axis in axes) RadarEntry(value: axis.score),
                    ],
                    fillColor: AppColors.point.withValues(alpha: .22),
                    borderColor: AppColors.pointPressed,
                    borderWidth: 2.5,
                    entryRadius: 3,
                  ),
                ],
                radarShape: RadarShape.polygon,
                radarBackgroundColor: AppColors.pointSoftest,
                radarBorderData: const BorderSide(color: AppColors.border),
                gridBorderData: const BorderSide(color: AppColors.border),
                tickBorderData: const BorderSide(color: AppColors.border),
                tickCount: 4,
                ticksTextStyle: const TextStyle(
                  color: AppColors.mutedText,
                  fontSize: 9,
                ),
                titleTextStyle: const TextStyle(
                  fontFamily: 'Pretendard',
                  color: AppColors.secondaryText,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
                getTitle: (index, _) =>
                    RadarChartTitle(text: axes[index].label, angle: 0),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _confidenceLabel(String value) => switch (value) {
    'high' => '신뢰도 높음',
    'medium' => '신뢰도 보통',
    'low' => '신뢰도 낮음',
    _ => '데이터 수집 중',
  };
}

Future<void> _showViewingDnaInfo(BuildContext context, ViewingDna data) {
  return showCupertinoModalPopup<void>(
    context: context,
    builder: (context) => Container(
      height: MediaQuery.sizeOf(context).height * .72,
      decoration: const BoxDecoration(
        color: AppColors.ivory,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Viewing DNA 설명',
                      style: appTitleStyle(size: 21),
                    ),
                  ),
                  CupertinoButton(
                    padding: const EdgeInsets.all(8),
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Icon(CupertinoIcons.xmark_circle_fill),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
                itemCount: data.axes.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final axis = data.axes[index];
                  return AppCard(
                    color: axis.key == data.strongestAxis
                        ? AppColors.pointSoftest
                        : AppColors.card,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                axis.label,
                                style: appTitleStyle(size: 16),
                              ),
                            ),
                            Text(
                              axis.available
                                  ? '${axis.score.toStringAsFixed(1)}점'
                                  : '데이터 부족',
                              style: appLabelStyle(
                                color: AppColors.pointPressed,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 5),
                        Text(
                          axis.available ? axis.description : '데이터가 아직 부족합니다.',
                          style: appLabelStyle(),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _MapDonutCard extends StatefulWidget {
  const _MapDonutCard({
    required this.title,
    required this.values,
    required this.valueLabel,
    required this.keyLabel,
    required this.onTap,
  });
  final String title;
  final Map<String, double> values;
  final String Function(double) valueLabel;
  final String Function(String) keyLabel;
  final Future<void> Function(String) onTap;

  @override
  State<_MapDonutCard> createState() => _MapDonutCardState();
}

class _MapDonutCardState extends State<_MapDonutCard> {
  int? touched;
  bool opening = false;

  @override
  Widget build(BuildContext context) {
    final entries = widget.values.entries.toList()
      ..sort((left, right) => right.value.compareTo(left.value));
    final visible = entries.take(9).toList();
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(
            title: widget.title,
            description: '차트 조각을 누르면 해당 작품을 확인할 수 있습니다.',
          ),
          const SizedBox(height: 16),
          if (visible.isEmpty)
            const Text('표시할 데이터가 없습니다.')
          else ...[
            SizedBox(
              height: 230,
              child: Row(
                children: [
                  Expanded(
                    flex: 6,
                    child: PieChart(
                      PieChartData(
                        centerSpaceRadius: 34,
                        sectionsSpace: 2,
                        pieTouchData: PieTouchData(
                          touchCallback: (event, response) {
                            final index =
                                response?.touchedSection?.touchedSectionIndex;
                            if (event is FlTapUpEvent &&
                                index != null &&
                                index >= 0 &&
                                index < visible.length) {
                              _open(visible, index);
                            } else if (!event.isInterestedForInteractions &&
                                mounted) {
                              setState(() => touched = null);
                            }
                          },
                        ),
                        sections: [
                          for (final indexed in visible.indexed)
                            PieChartSectionData(
                              value: indexed.$2.value,
                              color: appGenreColor(indexed.$2.key),
                              radius: touched == indexed.$1 ? 48 : 41,
                              showTitle: false,
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 5,
                    child: ListView.separated(
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: visible.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 5),
                      itemBuilder: (context, index) {
                        final entry = visible[index];
                        return GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => _open(visible, index),
                          child: Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: appGenreColor(entry.key),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Expanded(
                                child: Text(
                                  widget.keyLabel(entry.key),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: appLabelStyle(
                                    color: touched == index
                                        ? AppColors.pointPressed
                                        : AppColors.mutedText,
                                  ),
                                ),
                              ),
                              Text(
                                widget.valueLabel(entry.value),
                                style: appLabelStyle(),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _open(List<MapEntry<String, double>> entries, int index) async {
    if (opening) return;
    setState(() {
      opening = true;
      touched = index;
    });
    try {
      await widget.onTap(entries[index].key);
    } finally {
      if (mounted) {
        setState(() {
          opening = false;
          touched = null;
        });
      }
    }
  }
}

class _InsightAnimeCard extends StatelessWidget {
  const _InsightAnimeCard({required this.item});
  final StatsOverview item;

  @override
  Widget build(BuildContext context) {
    final insights = <(String, List<AnalysisAnimeInsight>)>[
      (
        '가장 많이 본 장르${_insightGenre(item.topWatchedGenreAnime)}의 작품',
        item.topWatchedGenreAnime,
      ),
      (
        '가장 높게 평가한 장르${_insightGenre(item.topRatedGenreAnime)}의 작품',
        item.topRatedGenreAnime,
      ),
    ];
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: '취향을 만든 작품',
            description: '장르 감상량과 평가를 대표하는 작품입니다.',
          ),
          for (final insight in insights)
            if (insight.$2.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(insight.$1, style: appLabelStyle()),
              const SizedBox(height: 9),
              SizedBox(
                height: 154,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: insight.$2.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 10),
                  itemBuilder: (context, index) {
                    final anime = insight.$2[index];
                    return SizedBox(
                      width: 84,
                      child: CupertinoButton(
                        padding: EdgeInsets.zero,
                        onPressed: () =>
                            context.push('/anime/${anime.animeId}'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 84,
                              height: 126,
                              child: AnimePoster(url: anime.coverImageUrl),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              anime.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.text,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
        ],
      ),
    );
  }

  static String _insightGenre(List<AnalysisAnimeInsight> items) {
    final genre = items.firstOrNull?.genre;
    return genre == null ? '' : ' · ${genreLabel(genre)}';
  }
}

class _FormatCard extends StatefulWidget {
  const _FormatCard({required this.data, required this.onSelected});
  final FormatDistribution data;
  final Future<void> Function(String format) onSelected;

  @override
  State<_FormatCard> createState() => _FormatCardState();
}

class _FormatCardState extends State<_FormatCard> {
  int? touched;
  bool watchTime = false;
  bool opening = false;

  Future<void> _open(int index) async {
    if (opening || index < 0 || index >= widget.data.items.length) return;
    setState(() {
      opening = true;
      touched = index;
    });
    try {
      await widget.onSelected(widget.data.items[index].format);
    } finally {
      if (mounted) setState(() => opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.data.items;
    if (items.isEmpty) {
      return const AppStateView(
        title: '포맷 데이터가 없습니다',
        message: '완주 작품이 쌓이면 TV, 영화, OVA 비중이 표시됩니다.',
      );
    }
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: '포맷별 감상 분포',
            eyebrow: 'Format',
            description: 'TV, 영화, OVA 등 작품 형식별 비중입니다.',
          ),
          const SizedBox(height: 12),
          CupertinoSlidingSegmentedControl<bool>(
            groupValue: watchTime,
            children: const {
              false: Padding(
                padding: EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                child: Text('작품 수'),
              ),
              true: Padding(
                padding: EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                child: Text('시청 시간'),
              ),
            },
            onValueChanged: (value) {
              if (value != null) setState(() => watchTime = value);
            },
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 190,
            child: PieChart(
              PieChartData(
                centerSpaceRadius: 48,
                sectionsSpace: 3,
                pieTouchData: PieTouchData(
                  touchCallback: (event, response) {
                    final index = response?.touchedSection?.touchedSectionIndex;
                    if (event is FlTapUpEvent && index != null) {
                      _open(index);
                    } else if (event.isInterestedForInteractions && mounted) {
                      setState(() => touched = index);
                    }
                  },
                ),
                sections: [
                  for (final indexed in items.indexed)
                    PieChartSectionData(
                      value: watchTime
                          ? indexed.$2.watchMinutes.toDouble()
                          : indexed.$2.animeCount.toDouble(),
                      color:
                          AppColors.chart[indexed.$1 % AppColors.chart.length],
                      radius: touched == indexed.$1 ? 52 : 44,
                      showTitle: touched == indexed.$1,
                      title: watchTime
                          ? '${(indexed.$2.watchMinutes / math.max(1, widget.data.totalWatchMinutes) * 100).toStringAsFixed(0)}%'
                          : '${indexed.$2.percentage.toStringAsFixed(0)}%',
                      titleStyle: const TextStyle(
                        fontFamily: 'Pretendard',
                        fontWeight: FontWeight.w700,
                        color: AppColors.card,
                      ),
                    ),
                ],
              ),
            ),
          ),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            children: [
              for (final indexed in items.indexed)
                CupertinoButton(
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  onPressed: () => _open(indexed.$1),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: AppColors
                              .chart[indexed.$1 % AppColors.chart.length],
                          shape: BoxShape.circle,
                        ),
                        child: const SizedBox.square(dimension: 9),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        watchTime
                            ? '${indexed.$2.label} ${(indexed.$2.watchMinutes / 60).toStringAsFixed(1)}시간'
                            : '${indexed.$2.label} ${indexed.$2.animeCount}편',
                        style: appLabelStyle(),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TasteSegment extends ConsumerWidget {
  const _TasteSegment({required this.userId});
  final int? userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(statsOverviewProvider(userId));
    final genres = ref.watch(genreBubbleProvider(userId));
    final yearly = ref.watch(yearlyScoreProvider(userId));
    return Column(
      children: [
        genres.when(
          loading: () => const AppSkeleton(height: 340),
          error: (error, _) => _AsyncErrorCard(
            title: '장르 분석을 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(genreBubbleProvider(userId)),
          ),
          data: (items) => _GenreBubbleCard(items: items, userId: userId),
        ),
        const SizedBox(height: 16),
        overview.when(
          loading: () => const AppSkeleton(height: 310),
          error: (error, _) => _AsyncErrorCard(
            title: '취향 분포를 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(statsOverviewProvider(userId)),
          ),
          data: (item) => Column(
            children: [
              _DistributionCard(
                title: '장르별 작품 수',
                eyebrow: 'Genre',
                values: item.genreDistribution,
                colorForKey: appGenreColor,
                onTap: (key) => _showFilteredCollection(
                  context,
                  ref,
                  userId: userId,
                  title: '${genreLabel(key)} 작품',
                  genre: key,
                ),
              ),
              const SizedBox(height: 16),
              _MapDonutCard(
                title: '장르별 시청 시간',
                values: item.genreWatchMinutes,
                valueLabel: (value) => '${(value / 60).toStringAsFixed(1)}시간',
                keyLabel: genreLabel,
                onTap: (key) => _showFilteredCollection(
                  context,
                  ref,
                  userId: userId,
                  title: '${genreLabel(key)} 작품',
                  genre: key,
                ),
              ),
              const SizedBox(height: 16),
              _DistributionCard(
                title: '장르별 평균 점수',
                eyebrow: 'Genre',
                values: item.genreAverageScore,
                colorForKey: appGenreColor,
                valueLabel: (value) => value.toStringAsFixed(1),
                onTap: (key) => _showFilteredCollection(
                  context,
                  ref,
                  userId: userId,
                  title: '${genreLabel(key)} 작품',
                  genre: key,
                ),
              ),
              const SizedBox(height: 16),
              _ReleaseYearLineCard(
                values: item.releaseYearDistribution,
                onYearTap: (year) => _showFilteredCollection(
                  context,
                  ref,
                  userId: userId,
                  title: '$year년 작품',
                  year: year,
                ),
              ),
              if (item.topWatchedGenreAnime.isNotEmpty ||
                  item.topRatedGenreAnime.isNotEmpty) ...[
                const SizedBox(height: 16),
                _InsightAnimeCard(item: item),
              ],
              const SizedBox(height: 16),
              _DistributionCard(
                title: '내 평점 분포',
                eyebrow: 'Score',
                values: item.scoreDistribution,
                limit: item.scoreDistribution.length,
                sort: (left, right) =>
                    _numericKey(right.key).compareTo(_numericKey(left.key)),
                colorForKey: (_) => AppColors.point,
                onTap: (key) {
                  final score = int.tryParse(
                    key.replaceAll(RegExp('[^0-9]'), ''),
                  );
                  if (score != null && score > 0) {
                    _showFilteredCollection(
                      context,
                      ref,
                      userId: userId,
                      title: '$score점대 작품',
                      score: score,
                    );
                  }
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        yearly.when(
          loading: () => const AppSkeleton(height: 340),
          error: (error, _) => _AsyncErrorCard(
            title: '연도별 점수를 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(yearlyScoreProvider(userId)),
          ),
          data: (items) => _YearlyScoreCard(items: items),
        ),
      ],
    );
  }
}

class _GenreBubbleCard extends ConsumerStatefulWidget {
  const _GenreBubbleCard({required this.items, required this.userId});
  final List<GenreBubble> items;
  final int? userId;

  @override
  ConsumerState<_GenreBubbleCard> createState() => _GenreBubbleCardState();
}

class _GenreBubbleCardState extends ConsumerState<_GenreBubbleCard> {
  int? selected;

  @override
  Widget build(BuildContext context) {
    final items = widget.items.take(12).toList();
    if (items.isEmpty) {
      return const AppStateView(
        title: '장르 데이터가 없습니다',
        message: '작품을 기록하면 장르 취향을 분석합니다.',
      );
    }
    final myBaseline =
        items.map((item) => item.myAverageScore).reduce((a, b) => a + b) /
        items.length;
    final communityBaseline =
        items
            .map((item) => item.communityAverageScore)
            .reduce((a, b) => a + b) /
        items.length;
    final points = [
      for (final item in items)
        (
          item.communityAverageScore - communityBaseline,
          item.myAverageScore - myBaseline,
        ),
    ];
    final maxDelta = math.max(
      .5,
      points
              .expand((point) => [point.$1.abs(), point.$2.abs()])
              .fold<double>(0, math.max) +
          .25,
    );
    final maxSize = items
        .map((item) => item.bubbleSize)
        .fold<double>(1, math.max);
    final chosen = selected == null ? null : items[selected!];
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: '장르 취향 버블',
            eyebrow: 'Preference',
            description: '가로는 커뮤니티 평균 대비, 세로는 내 평균 대비이며 크기는 기록량입니다.',
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 320,
            child: Row(
              children: [
                const RotatedBox(
                  quarterTurns: 3,
                  child: Text(
                    '내 평균 대비',
                    style: TextStyle(
                      fontFamily: 'Pretendard',
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.secondaryText,
                    ),
                  ),
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Column(
                    children: [
                      Expanded(
                        child: Stack(
                          children: [
                            const Positioned.fill(
                              child: IgnorePointer(
                                child: CustomPaint(
                                  painter: _BubbleEqualityPainter(),
                                ),
                              ),
                            ),
                            Positioned.fill(
                              child: ScatterChart(
                                ScatterChartData(
                                  minX: -maxDelta,
                                  maxX: maxDelta,
                                  minY: -maxDelta,
                                  maxY: maxDelta,
                                  borderData: FlBorderData(show: false),
                                  gridData: FlGridData(
                                    getDrawingHorizontalLine: (_) =>
                                        const FlLine(
                                          color: AppColors.border,
                                          strokeWidth: 1,
                                        ),
                                    getDrawingVerticalLine: (_) => const FlLine(
                                      color: AppColors.border,
                                      strokeWidth: 1,
                                    ),
                                  ),
                                  titlesData: const FlTitlesData(show: false),
                                  scatterSpots: [
                                    for (final indexed in items.indexed)
                                      ScatterSpot(
                                        points[indexed.$1].$1,
                                        points[indexed.$1].$2,
                                        renderPriority: indexed.$1,
                                        dotPainter: FlDotCirclePainter(
                                          radius:
                                              9 +
                                              11 *
                                                  (indexed.$2.bubbleSize /
                                                      maxSize),
                                          color: appGenreColor(
                                            indexed.$2.genre,
                                          ).withValues(alpha: .82),
                                          strokeColor: selected == indexed.$1
                                              ? AppColors.text
                                              : AppColors.card,
                                          strokeWidth: selected == indexed.$1
                                              ? 3
                                              : 2,
                                        ),
                                      ),
                                  ],
                                  showingTooltipIndicators: selected == null
                                      ? const []
                                      : [selected!],
                                  scatterTouchData: ScatterTouchData(
                                    handleBuiltInTouches: false,
                                    touchSpotThreshold: 22,
                                    touchCallback: (event, response) {
                                      final index =
                                          response?.touchedSpot?.spotIndex;
                                      if (event is FlTapUpEvent &&
                                          index != null) {
                                        setState(() => selected = index);
                                      }
                                    },
                                    touchTooltipData: ScatterTouchTooltipData(
                                      maxContentWidth: 180,
                                      fitInsideHorizontally: true,
                                      fitInsideVertically: true,
                                      getTooltipColor: (_) => AppColors.text,
                                      getTooltipItems: (spot) {
                                        final index = items.indexWhere((item) {
                                          final itemIndex = items.indexOf(item);
                                          return points[itemIndex].$1 ==
                                                  spot.x &&
                                              points[itemIndex].$2 == spot.y;
                                        });
                                        if (index < 0) return null;
                                        final item = items[index];
                                        return ScatterTooltipItem(
                                          '${genreLabel(item.genre)}\n내 평균 ${item.myAverageScore.toStringAsFixed(1)} · 커뮤니티 ${item.communityAverageScore.toStringAsFixed(1)}\n차이 ${item.preferenceScore >= 0 ? '+' : ''}${item.preferenceScore.toStringAsFixed(1)} · ${item.animeCount}편',
                                          textStyle: const TextStyle(
                                            fontFamily: 'Pretendard',
                                            fontSize: 11,
                                            height: 1.4,
                                            color: AppColors.card,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text('커뮤니티 평균 대비', style: appLabelStyle()),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text('대각선 위는 커뮤니티보다 내가 더 좋아하는 장르입니다.', style: appLabelStyle()),
          if (chosen != null) ...[
            const SizedBox(height: 10),
            AppSecondaryButton(
              label: '${genreLabel(chosen.genre)} 작품 보기',
              icon: CupertinoIcons.square_grid_2x2,
              onPressed: () => _showFilteredCollection(
                context,
                ref,
                userId: widget.userId,
                title: '${genreLabel(chosen.genre)} 작품',
                genre: chosen.genre,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BubbleEqualityPainter extends CustomPainter {
  const _BubbleEqualityPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.secondaryText.withValues(alpha: .45)
      ..strokeWidth = 1.5;
    const dash = 7.0;
    const gap = 5.0;
    final start = Offset(8, size.height - 8);
    final end = Offset(size.width - 8, 8);
    final delta = end - start;
    final length = delta.distance;
    final direction = delta / length;
    for (double current = 0; current < length; current += dash + gap) {
      canvas.drawLine(
        start + direction * current,
        start + direction * math.min(current + dash, length),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ReleaseYearLineCard extends StatefulWidget {
  const _ReleaseYearLineCard({required this.values, required this.onYearTap});

  final Map<String, double> values;
  final Future<void> Function(int year) onYearTap;

  @override
  State<_ReleaseYearLineCard> createState() => _ReleaseYearLineCardState();
}

class _ReleaseYearLineCardState extends State<_ReleaseYearLineCard> {
  int period = 10;
  bool opening = false;

  List<(int, double)> get data {
    final parsed = <int, double>{};
    for (final entry in widget.values.entries) {
      final year = int.tryParse(entry.key);
      if (year != null) parsed[year] = entry.value;
    }
    if (parsed.isEmpty) return const [];
    final maxYear = parsed.keys.reduce(math.max);
    final minRecorded = parsed.keys.reduce(math.min);
    final minYear = period == 0 ? minRecorded : maxYear - period + 1;
    return [
      for (var year = minYear; year <= maxYear; year++)
        (year, parsed[year] ?? 0),
    ];
  }

  Future<void> _open(int year) async {
    if (opening) return;
    opening = true;
    try {
      await widget.onYearTap(year);
    } finally {
      opening = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final values = data;
    final maxValue = values.isEmpty
        ? 1.0
        : math.max(1, values.map((item) => item.$2).reduce(math.max));
    final labelStep = values.length <= 6 ? 1 : (values.length / 5).ceil();
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: '연도별 작품 수',
            eyebrow: 'Release year',
            description: '점을 누르면 해당 연도의 작품을 보여드립니다.',
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: CupertinoSlidingSegmentedControl<int>(
              groupValue: period,
              children: const {
                10: Padding(padding: EdgeInsets.all(7), child: Text('10년')),
                20: Padding(padding: EdgeInsets.all(7), child: Text('20년')),
                30: Padding(padding: EdgeInsets.all(7), child: Text('30년')),
                40: Padding(padding: EdgeInsets.all(7), child: Text('40년')),
                0: Padding(padding: EdgeInsets.all(7), child: Text('전체')),
              },
              onValueChanged: (value) {
                if (value != null) setState(() => period = value);
              },
            ),
          ),
          const SizedBox(height: 18),
          if (values.isEmpty)
            const AppStateView(
              compact: true,
              title: '연도 데이터가 없어요',
              message: '작품을 기록하면 방영 연도 흐름을 보여드려요.',
            )
          else
            SizedBox(
              height: 220,
              child: LineChart(
                LineChartData(
                  minX: values.first.$1.toDouble(),
                  maxX: values.last.$1.toDouble(),
                  minY: 0,
                  maxY: maxValue * 1.2,
                  borderData: FlBorderData(show: false),
                  gridData: FlGridData(
                    drawVerticalLine: false,
                    horizontalInterval: math.max(
                      1,
                      (maxValue / 4).ceilToDouble(),
                    ),
                    getDrawingHorizontalLine: (_) =>
                        const FlLine(color: AppColors.border, strokeWidth: 1),
                  ),
                  titlesData: FlTitlesData(
                    topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    leftTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 28,
                        interval: 1,
                        getTitlesWidget: (value, meta) {
                          final index = value.round() - values.first.$1;
                          if (index < 0 ||
                              index >= values.length ||
                              (index % labelStep != 0 &&
                                  index != values.length - 1)) {
                            return const SizedBox.shrink();
                          }
                          return SideTitleWidget(
                            meta: meta,
                            child: Text(
                              '${value.round()}',
                              style: appLabelStyle(),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  lineTouchData: LineTouchData(
                    touchCallback: (event, response) {
                      final spot = response?.lineBarSpots?.firstOrNull;
                      if (event is FlTapUpEvent && spot != null) {
                        _open(spot.x.round());
                      }
                    },
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipColor: (_) => AppColors.text,
                      getTooltipItems: (spots) => [
                        for (final spot in spots)
                          LineTooltipItem(
                            '${spot.x.round()}년\n${spot.y.round()}편',
                            const TextStyle(
                              color: AppColors.card,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                      ],
                    ),
                  ),
                  lineBarsData: [
                    LineChartBarData(
                      spots: [
                        for (final item in values)
                          FlSpot(item.$1.toDouble(), item.$2),
                      ],
                      color: AppColors.point,
                      barWidth: 3,
                      isCurved: true,
                      dotData: const FlDotData(show: true),
                      belowBarData: BarAreaData(
                        show: true,
                        color: AppColors.pointSoft.withValues(alpha: .45),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DistributionCard extends StatelessWidget {
  const _DistributionCard({
    required this.title,
    required this.eyebrow,
    required this.values,
    required this.onTap,
    this.limit = 8,
    this.sort,
    this.colorForKey,
    this.valueLabel,
  });
  final String title;
  final String eyebrow;
  final Map<String, double> values;
  final ValueChanged<String> onTap;
  final int limit;
  final int Function(
    MapEntry<String, double> left,
    MapEntry<String, double> right,
  )?
  sort;
  final Color Function(String key)? colorForKey;
  final String Function(double value)? valueLabel;

  @override
  Widget build(BuildContext context) {
    final entries = values.entries.toList()
      ..sort(sort ?? (left, right) => right.value.compareTo(left.value));
    final visible = entries.take(limit).toList();
    final maxValue = visible.isEmpty
        ? 1.0
        : visible.map((item) => item.value).reduce(math.max);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(
            title: title,
            eyebrow: eyebrow,
            description: '막대를 누르면 해당 작품을 확인할 수 있습니다.',
          ),
          const SizedBox(height: 15),
          if (visible.isEmpty)
            const Text('표시할 데이터가 없습니다.')
          else
            for (final indexed in visible.indexed)
              CupertinoButton(
                padding: const EdgeInsets.symmetric(vertical: 5),
                onPressed: () => onTap(indexed.$2.key),
                child: Row(
                  children: [
                    SizedBox(
                      width: 82,
                      child: Text(
                        eyebrow == 'Genre'
                            ? genreLabel(indexed.$2.key)
                            : indexed.$2.key,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontFamily: 'Pretendard',
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.secondaryText,
                        ),
                      ),
                    ),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: Stack(
                          children: [
                            const SizedBox(
                              height: 12,
                              child: ColoredBox(color: AppColors.softBeige),
                            ),
                            FractionallySizedBox(
                              widthFactor: (indexed.$2.value / maxValue).clamp(
                                0.03,
                                1,
                              ),
                              child: Container(
                                height: 12,
                                color:
                                    colorForKey?.call(indexed.$2.key) ??
                                    AppColors.point,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 34,
                      child: Text(
                        valueLabel?.call(indexed.$2.value) ??
                            indexed.$2.value.toStringAsFixed(0),
                        textAlign: TextAlign.end,
                        style: appLabelStyle(),
                      ),
                    ),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

double _numericKey(String value) {
  return double.tryParse(value.replaceAll(RegExp(r'[^0-9.]'), '')) ?? -1;
}

class _YearlyScoreCard extends StatelessWidget {
  const _YearlyScoreCard({required this.items});
  final List<YearlyScore> items;

  @override
  Widget build(BuildContext context) {
    final data = items.where((item) => item.averageScore != null).toList()
      ..sort((left, right) => left.year.compareTo(right.year));
    if (data.isEmpty) {
      return const AppStateView(
        title: '연도별 점수 데이터가 없습니다',
        message: '평점을 남긴 완주 작품이 쌓이면 추이를 보여드립니다.',
      );
    }
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: '연도별 평균 점수',
            eyebrow: 'Year score',
            description: '앰버는 내 점수, 파랑은 커뮤니티 점수입니다.',
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 230,
            child: LineChart(
              LineChartData(
                minY: 0,
                maxY: 10,
                gridData: FlGridData(
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) =>
                      const FlLine(color: AppColors.border, strokeWidth: 1),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(),
                  rightTitles: const AxisTitles(),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 26,
                      interval: 2,
                      getTitlesWidget: (value, _) =>
                          Text('${value.toInt()}', style: appLabelStyle()),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 26,
                      interval: math
                          .max(1, (data.length / 4).ceil())
                          .toDouble(),
                      getTitlesWidget: (value, _) {
                        final index = value.toInt();
                        return index >= 0 && index < data.length
                            ? Text(
                                '${data[index].year}',
                                style: appLabelStyle(),
                              )
                            : const SizedBox.shrink();
                      },
                    ),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: [
                      for (final indexed in data.indexed)
                        FlSpot(indexed.$1.toDouble(), indexed.$2.averageScore!),
                    ],
                    color: AppColors.point,
                    barWidth: 3,
                    isCurved: true,
                    dotData: const FlDotData(show: true),
                    belowBarData: BarAreaData(
                      show: true,
                      color: AppColors.pointSoft.withValues(alpha: 0.5),
                    ),
                  ),
                  LineChartBarData(
                    spots: [
                      for (final indexed in data.indexed)
                        if (indexed.$2.communityAverageScore != null)
                          FlSpot(
                            indexed.$1.toDouble(),
                            indexed.$2.communityAverageScore!,
                          ),
                    ],
                    color: AppColors.info,
                    barWidth: 2,
                    isCurved: true,
                    dotData: const FlDotData(show: false),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RankingSegment extends ConsumerWidget {
  const _RankingSegment({
    required this.userId,
    required this.sort,
    required this.onSortChanged,
  });
  final int? userId;
  final String sort;
  final ValueChanged<String> onSortChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studios = ref.watch(
      studioRankingProvider((userId: userId, sort: sort)),
    );
    final actors = ref.watch(
      voiceActorRankingProvider((userId: userId, sort: sort)),
    );
    return Column(
      children: [
        AppCard(
          padding: const EdgeInsets.all(10),
          child: CupertinoSlidingSegmentedControl<String>(
            groupValue: sort,
            thumbColor: AppColors.card,
            backgroundColor: AppColors.softBeige,
            children: const {
              'count': Padding(padding: EdgeInsets.all(8), child: Text('작품 수')),
              'score': Padding(
                padding: EdgeInsets.all(8),
                child: Text('평균 점수'),
              ),
              'watchTime': Padding(
                padding: EdgeInsets.all(8),
                child: Text('시청 시간'),
              ),
            },
            onValueChanged: (value) {
              if (value != null) onSortChanged(value);
            },
          ),
        ),
        const SizedBox(height: 16),
        studios.when(
          loading: () => const AppSkeleton(height: 420),
          error: (error, _) => _AsyncErrorCard(
            title: '스튜디오 랭킹을 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(
              studioRankingProvider((userId: userId, sort: sort)),
            ),
          ),
          data: (items) =>
              _StudioRankingCard(items: items, sort: sort, userId: userId),
        ),
        const SizedBox(height: 16),
        actors.when(
          loading: () => const AppSkeleton(height: 420),
          error: (error, _) => _AsyncErrorCard(
            title: '성우 랭킹을 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(
              voiceActorRankingProvider((userId: userId, sort: sort)),
            ),
          ),
          data: (items) =>
              _VoiceActorRankingCard(items: items, sort: sort, userId: userId),
        ),
      ],
    );
  }
}

class _StudioRankingCard extends ConsumerWidget {
  const _StudioRankingCard({
    required this.items,
    required this.sort,
    required this.userId,
  });
  final List<StudioRanking> items;
  final String sort;
  final int? userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: '스튜디오 랭킹',
            eyebrow: 'Studio',
            description: '항목을 누르면 감상 작품을 보여드립니다.',
          ),
          const SizedBox(height: 12),
          if (items.isEmpty)
            const Text('표시할 스튜디오 데이터가 없습니다.')
          else
            for (final indexed in items.take(5).indexed)
              _RankingRow(
                rank: indexed.$1 + 1,
                title: indexed.$2.name,
                detail: switch (sort) {
                  'score' =>
                    indexed.$2.averageScore == null
                        ? '평점 데이터 없음'
                        : '평균 ${indexed.$2.averageScore!.toStringAsFixed(1)}점',
                  'watchTime' =>
                    '${(indexed.$2.totalWatchMinutes / 60).toStringAsFixed(1)}시간',
                  _ => '${indexed.$2.animeCount}편',
                },
                onTap: () => _showProviderAnime(
                  context,
                  title: indexed.$2.name,
                  metric: _metricForSort(sort),
                  loader: () => ref.read(
                    studioAnimeProvider((
                      userId: userId,
                      id: indexed.$2.id,
                    )).future,
                  ),
                ),
              ),
          if (items.length > 5) ...[
            const SizedBox(height: 8),
            AppSecondaryButton(
              label: '전체 ${items.length}개 보기',
              icon: CupertinoIcons.chevron_down,
              onPressed: () => _showRankingMore(
                context,
                title: '스튜디오 랭킹',
                children: [
                  for (final indexed in items.indexed)
                    _RankingRow(
                      rank: indexed.$1 + 1,
                      title: indexed.$2.name,
                      detail: switch (sort) {
                        'score' =>
                          indexed.$2.averageScore == null
                              ? '평점 데이터 없음'
                              : '평균 ${indexed.$2.averageScore!.toStringAsFixed(1)}점',
                        'watchTime' =>
                          '${(indexed.$2.totalWatchMinutes / 60).toStringAsFixed(1)}시간',
                        _ => '${indexed.$2.animeCount}편',
                      },
                      onTap: () => _showProviderAnime(
                        context,
                        title: indexed.$2.name,
                        metric: _metricForSort(sort),
                        loader: () => ref.read(
                          studioAnimeProvider((
                            userId: userId,
                            id: indexed.$2.id,
                          )).future,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _VoiceActorRankingCard extends ConsumerWidget {
  const _VoiceActorRankingCard({
    required this.items,
    required this.sort,
    required this.userId,
  });
  final List<VoiceActorRanking> items;
  final String sort;
  final int? userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: '성우 랭킹',
            eyebrow: 'Voice actor',
            description: '내 컬렉션에 등장한 일본어 성우 기준입니다.',
          ),
          const SizedBox(height: 12),
          if (items.isEmpty)
            const Text('표시할 성우 데이터가 없습니다.')
          else
            for (final indexed in items.take(5).indexed)
              _RankingRow(
                rank: indexed.$1 + 1,
                title: indexed.$2.name,
                detail: _voiceActorDetail(indexed.$2, sort),
                imageUrl: indexed.$2.imageUrl,
                onTap: () => _showVoiceActorWorks(
                  context,
                  title: indexed.$2.name,
                  metric: _metricForSort(sort),
                  loader: () => ref.read(
                    voiceActorAnimeProvider((
                      userId: userId,
                      id: indexed.$2.id,
                    )).future,
                  ),
                ),
              ),
          if (items.length > 5) ...[
            const SizedBox(height: 8),
            AppSecondaryButton(
              label: '전체 ${items.length}개 보기',
              icon: CupertinoIcons.chevron_down,
              onPressed: () => _showRankingMore(
                context,
                title: '성우 랭킹',
                children: [
                  for (final indexed in items.indexed)
                    _RankingRow(
                      rank: indexed.$1 + 1,
                      title: indexed.$2.name,
                      detail: _voiceActorDetail(indexed.$2, sort),
                      imageUrl: indexed.$2.imageUrl,
                      onTap: () => _showVoiceActorWorks(
                        context,
                        title: indexed.$2.name,
                        metric: _metricForSort(sort),
                        loader: () => ref.read(
                          voiceActorAnimeProvider((
                            userId: userId,
                            id: indexed.$2.id,
                          )).future,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _RankingRow extends StatelessWidget {
  const _RankingRow({
    required this.rank,
    required this.title,
    required this.detail,
    required this.onTap,
    this.imageUrl,
  });
  final int rank;
  final String title;
  final String detail;
  final VoidCallback onTap;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(vertical: 8),
      onPressed: onTap,
      child: Row(
        children: [
          SizedBox(
            width: 32,
            child: Text(
              '$rank',
              textAlign: TextAlign.center,
              style: appTitleStyle(size: 16),
            ),
          ),
          const SizedBox(width: 8),
          ClipOval(
            child: SizedBox.square(
              dimension: 44,
              child: imageUrl == null
                  ? const ColoredBox(
                      color: AppColors.pointSoft,
                      child: Icon(
                        CupertinoIcons.building_2_fill,
                        color: AppColors.pointPressed,
                        size: 20,
                      ),
                    )
                  : AppNetworkImage(url: imageUrl, profile: true),
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: appTitleStyle(size: 15),
                ),
                const SizedBox(height: 3),
                Text(detail, style: appLabelStyle()),
              ],
            ),
          ),
          const Icon(
            CupertinoIcons.chevron_forward,
            size: 16,
            color: AppColors.mutedText,
          ),
        ],
      ),
    );
  }
}

Future<void> _showRankingMore(
  BuildContext context, {
  required String title,
  required List<Widget> children,
}) {
  return showCupertinoModalPopup<void>(
    context: context,
    builder: (sheetContext) => Container(
      height: MediaQuery.sizeOf(sheetContext).height * .88,
      decoration: const BoxDecoration(
        color: AppColors.ivory,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 8, 4),
              child: Row(
                children: [
                  Expanded(child: Text(title, style: appTitleStyle(size: 21))),
                  CupertinoButton(
                    padding: const EdgeInsets.all(10),
                    onPressed: () => Navigator.of(sheetContext).pop(),
                    child: const Icon(
                      CupertinoIcons.xmark_circle_fill,
                      color: AppColors.mutedText,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                children: children,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _AsyncErrorCard extends StatelessWidget {
  const _AsyncErrorCard({
    required this.title,
    required this.error,
    required this.onRetry,
  });
  final String title;
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return AppStateView(
      icon: CupertinoIcons.exclamationmark_triangle,
      title: title,
      message: error is ApiFailure
          ? (error as ApiFailure).message
          : error.toString(),
      actionLabel: '다시 시도',
      onAction: onRetry,
    );
  }
}

Future<void> _showFilteredCollection(
  BuildContext context,
  WidgetRef ref, {
  required int? userId,
  required String title,
  String? genre,
  int? year,
  int? score,
  String? format,
}) async {
  await showCupertinoModalPopup<void>(
    context: context,
    builder: (context) => _AnimeListSheet(
      title: title,
      loader: () async {
        final page = userId == null
            ? await ref
                  .read(collectionRepositoryProvider)
                  .list(
                    genre: genre,
                    year: year,
                    score: score,
                    format: format,
                    limit: 50,
                  )
            : await ref
                  .read(friendsRepositoryProvider)
                  .collection(
                    userId,
                    genre: genre,
                    year: year,
                    score: score,
                    format: format,
                    limit: 50,
                  );
        return page.items.map(AnalysisAnimeWork.fromCollectionEntry).toList();
      },
    ),
  );
}

Future<void> _showProviderAnime(
  BuildContext context, {
  required String title,
  required Future<List<AnalysisAnimeWork>> Function() loader,
  required _WorkMetric metric,
}) async {
  await showCupertinoModalPopup<void>(
    context: context,
    builder: (context) =>
        _AnimeListSheet(title: title, loader: loader, metric: metric),
  );
}

enum _WorkMetric { none, score, watchTime }

_WorkMetric _metricForSort(String sort) => switch (sort) {
  'score' => _WorkMetric.score,
  'watchTime' => _WorkMetric.watchTime,
  _ => _WorkMetric.none,
};

String _voiceActorDetail(VoiceActorRanking item, String sort) => switch (sort) {
  'score' =>
    item.averageScore == null
        ? '평점 데이터 없음'
        : '평균 ${item.averageScore!.toStringAsFixed(1)}점',
  'watchTime' => '${(item.totalWatchMinutes / 60).toStringAsFixed(1)}시간',
  _ => '${item.animeCount}편 · ${item.characterCount}역',
};

String _formatLabel(String format) => switch (format.toUpperCase()) {
  'TV' => 'TV',
  'TV_SHORT' => 'TV 숏',
  'MOVIE' => '극장판',
  'SPECIAL' => '스페셜',
  'OVA' => 'OVA',
  'ONA' => 'ONA',
  'MUSIC' => '뮤직',
  _ => format,
};

Future<void> _showVoiceActorWorks(
  BuildContext context, {
  required String title,
  required Future<List<AnalysisAnimeWork>> Function() loader,
  required _WorkMetric metric,
}) async {
  await showCupertinoModalPopup<void>(
    context: context,
    builder: (context) =>
        _VoiceActorWorkSheet(title: title, loader: loader, metric: metric),
  );
}

class _AnimeListSheet extends StatefulWidget {
  const _AnimeListSheet({
    required this.title,
    required this.loader,
    this.metric = _WorkMetric.none,
  });
  final String title;
  final Future<List<AnalysisAnimeWork>> Function() loader;
  final _WorkMetric metric;

  @override
  State<_AnimeListSheet> createState() => _AnimeListSheetState();
}

class _PosterWork extends StatelessWidget {
  const _PosterWork({required this.work, required this.metric, this.onTap});

  final AnalysisAnimeWork work;
  final _WorkMetric metric;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final metricText = switch (metric) {
      _WorkMetric.score =>
        work.score == null ? '평점 없음' : '★ ${work.score!.toStringAsFixed(1)}',
      _WorkMetric.watchTime =>
        work.watchMinutes == null
            ? '시간 정보 없음'
            : work.watchMinutes! >= 60
            ? '${(work.watchMinutes! / 60).toStringAsFixed(1)}시간'
            : '${work.watchMinutes}분',
      _WorkMetric.none => null,
    };
    return CupertinoButton(
      padding: EdgeInsets.zero,
      onPressed: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            AnimePoster(url: work.anime.coverImageUrl, radius: 0),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x00000000), Color(0xCC000000)],
                  stops: [.48, 1],
                ),
              ),
            ),
            Positioned(
              left: 9,
              right: 9,
              bottom: 9,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    work.anime.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: CupertinoColors.white,
                      fontFamily: 'Pretendard',
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      height: 1.25,
                    ),
                  ),
                  if (metricText != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      metricText,
                      style: const TextStyle(
                        color: Color(0xFFFFE6A7),
                        fontFamily: 'Pretendard',
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnimeListSheetState extends State<_AnimeListSheet> {
  late Future<List<AnalysisAnimeWork>> future = widget.loader();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.sizeOf(context).height * 0.54,
      decoration: const BoxDecoration(
        color: AppColors.ivory,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(widget.title, style: appTitleStyle(size: 21)),
                  ),
                  CupertinoButton(
                    padding: const EdgeInsets.all(10),
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Icon(
                      CupertinoIcons.xmark_circle_fill,
                      color: AppColors.mutedText,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: FutureBuilder<List<AnalysisAnimeWork>>(
                future: future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(
                      child: CupertinoActivityIndicator(radius: 13),
                    );
                  }
                  if (snapshot.hasError) {
                    return Padding(
                      padding: const EdgeInsets.all(16),
                      child: AppStateView(
                        title: '작품을 불러오지 못했습니다',
                        message: snapshot.error.toString(),
                        actionLabel: '다시 시도',
                        onAction: () =>
                            setState(() => future = widget.loader()),
                      ),
                    );
                  }
                  final items = snapshot.data ?? const <AnalysisAnimeWork>[];
                  if (items.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.all(16),
                      child: AppStateView(
                        title: '해당하는 작품이 없습니다',
                        message: '기록이 더 쌓인 뒤 다시 확인해주세요.',
                      ),
                    );
                  }
                  return ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (context, index) {
                      final work = items[index];
                      return SizedBox(
                        width: 138,
                        child: _PosterWork(
                          work: work,
                          metric: widget.metric,
                          onTap: () {
                            Navigator.of(context).pop();
                            context.push('/anime/${work.anime.id}');
                          },
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VoiceActorWorkSheet extends StatefulWidget {
  const _VoiceActorWorkSheet({
    required this.title,
    required this.loader,
    required this.metric,
  });
  final String title;
  final Future<List<AnalysisAnimeWork>> Function() loader;
  final _WorkMetric metric;

  @override
  State<_VoiceActorWorkSheet> createState() => _VoiceActorWorkSheetState();
}

class _VoiceActorWorkSheetState extends State<_VoiceActorWorkSheet> {
  late Future<List<AnalysisAnimeWork>> future = widget.loader();

  @override
  Widget build(BuildContext context) => Container(
    height: MediaQuery.sizeOf(context).height * .72,
    decoration: const BoxDecoration(
      color: AppColors.ivory,
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    child: SafeArea(
      top: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 8, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(widget.title, style: appTitleStyle(size: 21)),
                ),
                CupertinoButton(
                  padding: const EdgeInsets.all(10),
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Icon(CupertinoIcons.xmark_circle_fill),
                ),
              ],
            ),
          ),
          Expanded(
            child: FutureBuilder<List<AnalysisAnimeWork>>(
              future: future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CupertinoActivityIndicator());
                }
                if (snapshot.hasError) {
                  return Padding(
                    padding: const EdgeInsets.all(16),
                    child: AppStateView(
                      title: '작품을 불러오지 못했습니다',
                      message: snapshot.error.toString(),
                      actionLabel: '다시 시도',
                      onAction: () => setState(() => future = widget.loader()),
                    ),
                  );
                }
                final works = snapshot.data ?? const <AnalysisAnimeWork>[];
                if (works.isEmpty) {
                  return const AppStateView(
                    title: '담당 작품이 없습니다',
                    message: '캐릭터 정보가 수집되면 여기에 표시됩니다.',
                  );
                }
                return ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: works.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 12),
                  itemBuilder: (context, index) {
                    final work = works[index];
                    return SizedBox(
                      width: 186,
                      child: CupertinoButton(
                        padding: EdgeInsets.zero,
                        onPressed: () {
                          Navigator.of(context).pop();
                          context.push('/anime/${work.anime.id}');
                        },
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              height: 158,
                              child: _PosterWork(
                                work: work,
                                metric: widget.metric,
                                onTap: null,
                              ),
                            ),
                            const SizedBox(height: 9),
                            Text(
                              '담당 캐릭터',
                              style: appLabelStyle(
                                color: AppColors.pointPressed,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Expanded(
                              child: work.characters.isEmpty
                                  ? Text('캐릭터 정보 없음', style: appLabelStyle())
                                  : ListView.separated(
                                      padding: EdgeInsets.zero,
                                      itemCount: work.characters.length,
                                      separatorBuilder: (_, _) =>
                                          const SizedBox(height: 6),
                                      itemBuilder: (context, characterIndex) {
                                        final character =
                                            work.characters[characterIndex];
                                        return Row(
                                          children: [
                                            ClipOval(
                                              child: SizedBox.square(
                                                dimension: 32,
                                                child: AppNetworkImage(
                                                  url: character.imageUrl,
                                                  profile: true,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                [
                                                  character.name,
                                                  if (character.role != null)
                                                    character.role!,
                                                ].join(' · '),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: appLabelStyle(
                                                  color:
                                                      AppColors.secondaryText,
                                                ),
                                              ),
                                            ),
                                          ],
                                        );
                                      },
                                    ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    ),
  );
}
