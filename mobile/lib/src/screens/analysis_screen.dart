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
  const AnalysisScreen({this.title = '내 분석', super.key});

  final String title;

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
                    0 => const _OverviewSegment(),
                    1 => const _TasteSegment(),
                    _ => _RankingSegment(
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
    ref.invalidate(statsOverviewProvider);
    if (_segment == 0) {
      ref.invalidate(formatDistributionProvider);
      ref.invalidate(viewingDnaProvider);
    }
    if (_segment == 1) {
      ref.invalidate(genreBubbleProvider);
      ref.invalidate(yearlyScoreProvider);
    }
    if (_segment == 2) {
      ref.invalidate(studioRankingProvider(_rankingSort));
      ref.invalidate(voiceActorRankingProvider(_rankingSort));
    }
    await ref.read(statsOverviewProvider.future);
  }
}

class _OverviewSegment extends ConsumerWidget {
  const _OverviewSegment();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(statsOverviewProvider);
    final formats = ref.watch(formatDistributionProvider);
    final dna = ref.watch(viewingDnaProvider);
    return Column(
      children: [
        overview.when(
          loading: () => const AppSkeleton(height: 300),
          error: (error, _) => _AsyncErrorCard(
            title: '기본 통계를 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(statsOverviewProvider),
          ),
          data: (item) => Column(
            children: [
              _MetricGrid(item: item),
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
            onRetry: () => ref.invalidate(viewingDnaProvider),
          ),
          data: (data) => _ViewingDnaCard(data: data),
        ),
        const SizedBox(height: 16),
        formats.when(
          loading: () => const AppSkeleton(height: 320),
          error: (error, _) => _AsyncErrorCard(
            title: '포맷 분석을 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(formatDistributionProvider),
          ),
          data: (data) => _FormatCard(data: data),
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
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: values.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.75,
      ),
      itemBuilder: (context, index) => AppCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(values[index].$1, style: appLabelStyle()),
            const SizedBox(height: 6),
            Text(values[index].$2, style: appTitleStyle(size: 21)),
          ],
        ),
      ),
    );
  }
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
                ? '감상 기록을 여섯 가지 축으로 분석했습니다.'
                : '가장 뚜렷한 성향은 ${strongest.label}입니다.',
            trailing: AppBadge(label: _confidenceLabel(data.confidence)),
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
                getTitle: (index, angle) =>
                    RadarChartTitle(text: axes[index].label, angle: angle),
              ),
            ),
          ),
          const SizedBox(height: 8),
          for (final axis in axes)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 96,
                    child: Text(
                      '${axis.label} ${axis.score.toStringAsFixed(0)}',
                      style: appLabelStyle(color: AppColors.pointPressed),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      axis.description,
                      style: const TextStyle(
                        color: AppColors.mutedText,
                        fontSize: 12,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
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
  final ValueChanged<String> onTap;

  @override
  State<_MapDonutCard> createState() => _MapDonutCardState();
}

class _MapDonutCardState extends State<_MapDonutCard> {
  int? touched;

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
              height: 210,
              child: PieChart(
                PieChartData(
                  centerSpaceRadius: 46,
                  sectionsSpace: 2,
                  pieTouchData: PieTouchData(
                    touchCallback: (event, response) {
                      final index = event.isInterestedForInteractions
                          ? response?.touchedSection?.touchedSectionIndex
                          : null;
                      setState(() => touched = index);
                      if (index != null &&
                          index >= 0 &&
                          index < visible.length) {
                        widget.onTap(visible[index].key);
                      }
                    },
                  ),
                  sections: [
                    for (final indexed in visible.indexed)
                      PieChartSectionData(
                        value: indexed.$2.value,
                        color: AppColors
                            .chart[indexed.$1 % AppColors.chart.length],
                        radius: touched == indexed.$1 ? 54 : 46,
                        showTitle: false,
                      ),
                  ],
                ),
              ),
            ),
            Wrap(
              spacing: 10,
              runSpacing: 8,
              children: [
                for (final indexed in visible.indexed)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: AppColors
                              .chart[indexed.$1 % AppColors.chart.length],
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        '${widget.keyLabel(indexed.$2.key)} ${widget.valueLabel(indexed.$2.value)}',
                        style: appLabelStyle(),
                      ),
                    ],
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _InsightAnimeCard extends StatelessWidget {
  const _InsightAnimeCard({required this.item});
  final StatsOverview item;

  @override
  Widget build(BuildContext context) {
    final insights = <(String, List<AnalysisAnimeInsight>)>[
      ('가장 많이 본 장르의 작품', item.topWatchedGenreAnime),
      ('가장 높게 평가한 장르의 작품', item.topRatedGenreAnime),
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
}

class _FormatCard extends StatefulWidget {
  const _FormatCard({required this.data});
  final FormatDistribution data;

  @override
  State<_FormatCard> createState() => _FormatCardState();
}

class _FormatCardState extends State<_FormatCard> {
  int? touched;
  bool watchTime = false;

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
                  touchCallback: (event, response) => setState(() {
                    touched = event.isInterestedForInteractions
                        ? response?.touchedSection?.touchedSectionIndex
                        : null;
                  }),
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
                Row(
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
            ],
          ),
        ],
      ),
    );
  }
}

class _TasteSegment extends ConsumerWidget {
  const _TasteSegment();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overview = ref.watch(statsOverviewProvider);
    final genres = ref.watch(genreBubbleProvider);
    final yearly = ref.watch(yearlyScoreProvider);
    return Column(
      children: [
        genres.when(
          loading: () => const AppSkeleton(height: 340),
          error: (error, _) => _AsyncErrorCard(
            title: '장르 분석을 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(genreBubbleProvider),
          ),
          data: (items) => _GenreBubbleCard(items: items),
        ),
        const SizedBox(height: 16),
        overview.when(
          loading: () => const AppSkeleton(height: 310),
          error: (error, _) => _AsyncErrorCard(
            title: '취향 분포를 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(statsOverviewProvider),
          ),
          data: (item) => Column(
            children: [
              _DistributionCard(
                title: '장르별 작품 수',
                eyebrow: 'Genre',
                values: item.genreDistribution,
                onTap: (key) => _showFilteredCollection(
                  context,
                  ref,
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
                  title: '${genreLabel(key)} 작품',
                  genre: key,
                ),
              ),
              const SizedBox(height: 16),
              _DistributionCard(
                title: '장르별 평균 점수',
                eyebrow: 'Genre',
                values: item.genreAverageScore,
                onTap: (key) => _showFilteredCollection(
                  context,
                  ref,
                  title: '${genreLabel(key)} 작품',
                  genre: key,
                ),
              ),
              const SizedBox(height: 16),
              _DistributionCard(
                title: '방영 연도 분포',
                eyebrow: 'Release year',
                values: item.releaseYearDistribution,
                limit: 12,
                onTap: (key) {
                  final year = int.tryParse(key);
                  if (year != null) {
                    _showFilteredCollection(
                      context,
                      ref,
                      title: '$year년 작품',
                      year: year,
                    );
                  }
                },
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
                limit: 10,
                onTap: (key) {
                  final score = int.tryParse(
                    key.replaceAll(RegExp('[^0-9]'), ''),
                  );
                  if (score != null && score > 0) {
                    _showFilteredCollection(
                      context,
                      ref,
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
            onRetry: () => ref.invalidate(yearlyScoreProvider),
          ),
          data: (items) => _YearlyScoreCard(items: items),
        ),
      ],
    );
  }
}

class _GenreBubbleCard extends StatelessWidget {
  const _GenreBubbleCard({required this.items});
  final List<GenreBubble> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const AppStateView(
        title: '장르 데이터가 없습니다',
        message: '작품을 기록하면 장르 취향을 분석합니다.',
      );
    }
    final maxSize = items
        .map((item) => item.bubbleSize)
        .fold<double>(1, math.max);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: '장르 취향 버블',
            eyebrow: 'Preference',
            description: '크기는 기록량, 숫자는 내 평균 점수입니다.',
          ),
          const SizedBox(height: 16),
          Center(
            child: Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final indexed in items.take(12).indexed)
                  Container(
                    width: 70 + 34 * (indexed.$2.bubbleSize / maxSize),
                    height: 70 + 34 * (indexed.$2.bubbleSize / maxSize),
                    decoration: BoxDecoration(
                      color: AppColors
                          .chart[indexed.$1 % AppColors.chart.length]
                          .withValues(alpha: 0.14),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors
                            .chart[indexed.$1 % AppColors.chart.length]
                            .withValues(alpha: 0.45),
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          genreLabel(indexed.$2.genre),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'Pretendard',
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.text,
                          ),
                        ),
                        Text(
                          indexed.$2.myAverageScore.toStringAsFixed(1),
                          style: appTitleStyle(size: 16),
                        ),
                      ],
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

class _DistributionCard extends StatelessWidget {
  const _DistributionCard({
    required this.title,
    required this.eyebrow,
    required this.values,
    required this.onTap,
    this.limit = 8,
  });
  final String title;
  final String eyebrow;
  final Map<String, double> values;
  final ValueChanged<String> onTap;
  final int limit;

  @override
  Widget build(BuildContext context) {
    final entries = values.entries.toList()
      ..sort((left, right) => right.value.compareTo(left.value));
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
                                color: AppColors
                                    .chart[indexed.$1 % AppColors.chart.length],
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
                            indexed.$2.communityAverageScore! / 10,
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
  const _RankingSegment({required this.sort, required this.onSortChanged});
  final String sort;
  final ValueChanged<String> onSortChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studios = ref.watch(studioRankingProvider(sort));
    final actors = ref.watch(voiceActorRankingProvider(sort));
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
            onRetry: () => ref.invalidate(studioRankingProvider(sort)),
          ),
          data: (items) => _StudioRankingCard(items: items, sort: sort),
        ),
        const SizedBox(height: 16),
        actors.when(
          loading: () => const AppSkeleton(height: 420),
          error: (error, _) => _AsyncErrorCard(
            title: '성우 랭킹을 불러오지 못했습니다',
            error: error,
            onRetry: () => ref.invalidate(voiceActorRankingProvider(sort)),
          ),
          data: (items) => _VoiceActorRankingCard(items: items, sort: sort),
        ),
      ],
    );
  }
}

class _StudioRankingCard extends ConsumerWidget {
  const _StudioRankingCard({required this.items, required this.sort});
  final List<StudioRanking> items;
  final String sort;

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
                  ref,
                  title: indexed.$2.name,
                  provider: studioAnimeProvider(indexed.$2.id),
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
                        ref,
                        title: indexed.$2.name,
                        provider: studioAnimeProvider(indexed.$2.id),
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
  const _VoiceActorRankingCard({required this.items, required this.sort});
  final List<VoiceActorRanking> items;
  final String sort;

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
                detail: sort == 'score'
                    ? (indexed.$2.averageScore == null
                          ? '평점 데이터 없음'
                          : '평균 ${indexed.$2.averageScore!.toStringAsFixed(1)}점')
                    : '${indexed.$2.animeCount}편 · ${indexed.$2.characterCount}역',
                imageUrl: indexed.$2.imageUrl,
                onTap: () => _showProviderAnime(
                  context,
                  ref,
                  title: indexed.$2.name,
                  provider: voiceActorAnimeProvider(indexed.$2.id),
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
                      detail: sort == 'score'
                          ? (indexed.$2.averageScore == null
                                ? '평점 데이터 없음'
                                : '평균 ${indexed.$2.averageScore!.toStringAsFixed(1)}점')
                          : '${indexed.$2.animeCount}편 · ${indexed.$2.characterCount}역',
                      imageUrl: indexed.$2.imageUrl,
                      onTap: () => _showProviderAnime(
                        context,
                        ref,
                        title: indexed.$2.name,
                        provider: voiceActorAnimeProvider(indexed.$2.id),
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
  required String title,
  String? genre,
  int? year,
  int? score,
}) async {
  await showCupertinoModalPopup<void>(
    context: context,
    builder: (context) => _AnimeListSheet(
      title: title,
      loader: () async {
        final userId = ref.read(analysisSubjectProvider);
        final page = userId == null
            ? await ref
                  .read(collectionRepositoryProvider)
                  .list(genre: genre, year: year, score: score, limit: 50)
            : await ref
                  .read(friendsRepositoryProvider)
                  .collection(
                    userId,
                    genre: genre,
                    year: year,
                    score: score,
                    limit: 50,
                  );
        return page.items.map((entry) => entry.anime).toList();
      },
    ),
  );
}

Future<void> _showProviderAnime(
  BuildContext context,
  WidgetRef ref, {
  required String title,
  required FutureProvider<List<Anime>> provider,
}) async {
  await showCupertinoModalPopup<void>(
    context: context,
    builder: (context) =>
        _AnimeListSheet(title: title, loader: () => ref.read(provider.future)),
  );
}

class _AnimeListSheet extends StatefulWidget {
  const _AnimeListSheet({required this.title, required this.loader});
  final String title;
  final Future<List<Anime>> Function() loader;

  @override
  State<_AnimeListSheet> createState() => _AnimeListSheetState();
}

class _AnimeListSheetState extends State<_AnimeListSheet> {
  late Future<List<Anime>> future = widget.loader();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.sizeOf(context).height * 0.9,
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
              child: FutureBuilder<List<Anime>>(
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
                  final items = snapshot.data ?? const <Anime>[];
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
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final anime = items[index];
                      return AppCard(
                        padding: const EdgeInsets.all(10),
                        onTap: () {
                          Navigator.of(context).pop();
                          context.push('/anime/${anime.id}');
                        },
                        child: Row(
                          children: [
                            SizedBox(
                              width: 54,
                              child: AnimePoster(
                                url: anime.coverImageUrl,
                                radius: 9,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    anime.title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: appTitleStyle(size: 15),
                                  ),
                                  const SizedBox(height: 5),
                                  Text(
                                    [
                                      if (anime.seasonYear != null)
                                        '${anime.seasonYear}',
                                      if (anime.format != null) anime.format!,
                                    ].join(' · '),
                                    style: appLabelStyle(),
                                  ),
                                ],
                              ),
                            ),
                          ],
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
