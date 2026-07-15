import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_badge.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_state_message.dart';
import '../../../data/analysis/analysis_data_service.dart';
import '../../../data/api/api_access_issue.dart';
import '../../../data/auth/auth_session_service.dart';
import '../../../data/models/analysis_models.dart';
import '../../profile/presentation/agreements_page.dart';

class AnalysisPage extends StatefulWidget {
  const AnalysisPage({super.key});

  @override
  State<AnalysisPage> createState() => _AnalysisPageState();
}

class _AnalysisPageState extends State<AnalysisPage> {
  static const _authSessionService = AuthSessionService();

  late Future<AnalysisData> _analysisFuture = _loadAnalysis();
  ApiAccessIssue? _accessIssue;

  Future<AnalysisData> _loadAnalysis() async {
    _accessIssue = null;
    if (!_authSessionService.isSignedIn) {
      return AnalysisData.empty();
    }

    try {
      return await AnalysisDataService().fetchMyAnalysis();
    } on Object catch (error) {
      _accessIssue = ApiAccessIssue.from(error);
      return AnalysisData.empty();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<AnalysisData>(
      future: _analysisFuture,
      builder: (context, snapshot) {
        final analysis = snapshot.data ?? AnalysisData.empty();
        final overview = analysis.overview;
        final isSignedIn = _authSessionService.isSignedIn;

        return RefreshIndicator(
          onRefresh: _refreshAnalysis,
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                sliver: SliverList.list(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '분석',
                            style: Theme.of(context).textTheme.headlineLarge,
                          ),
                        ),
                        AppBadge(
                          label: '내 분석',
                        ),
                      ],
                    ),
                    if (snapshot.connectionState == ConnectionState.waiting) ...[
                      const SizedBox(height: 10),
                      const LinearProgressIndicator(minHeight: 3),
                    ],
                    const SizedBox(height: 16),
                    if (_accessIssue != null) ...[
                      _AnalysisAccessIssueMessage(
                        issue: _accessIssue!,
                        onAgreementsTap: _openAgreements,
                      ),
                      const SizedBox(height: 18),
                    ],
                    if (!isSignedIn) ...[
                      const AppStateMessage(
                        icon: Icons.lock_outline_rounded,
                        title: '로그인 후 분석을 사용할 수 있습니다.',
                        body: '비로그인 상태에서는 탐색 페이지만 볼 수 있습니다.',
                      ),
                      const SizedBox(height: 18),
                    ] else ...[
                      GridView(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 1.28,
                        ),
                        children: [
                          _MetricCard(
                            label: '기록 작품',
                            value: '${overview.totalCount}',
                          ),
                          _MetricCard(
                            label: '시청 에피소드',
                            value: '${overview.totalWatchedEpisodes}',
                          ),
                          _MetricCard(
                            label: '평균 평점',
                            value: overview.avgScore.toStringAsFixed(1),
                          ),
                          _MetricCard(
                            label: '선호 장르',
                            value: overview.favoriteGenre,
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      _GenrePanel(items: analysis.genres),
                      const SizedBox(height: 18),
                      _FormatPanel(items: analysis.formats),
                      const SizedBox(height: 18),
                      _YearlyScorePanel(items: analysis.yearlyScores),
                      const SizedBox(height: 18),
                      _StudioPanel(items: analysis.studios),
                      const SizedBox(height: 18),
                      _VoiceActorPanel(items: analysis.voiceActors),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _refreshAnalysis() async {
    setState(() {
      _analysisFuture = _loadAnalysis();
    });
    await _analysisFuture;
  }

  void _openAgreements() {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (context) => const AgreementsPage()))
        .then((_) {
      if (mounted) {
        setState(() {
          _analysisFuture = _loadAnalysis();
        });
      }
    });
  }
}

class _AnalysisAccessIssueMessage extends StatelessWidget {
  const _AnalysisAccessIssueMessage({
    required this.issue,
    required this.onAgreementsTap,
  });

  final ApiAccessIssue issue;
  final VoidCallback onAgreementsTap;

  @override
  Widget build(BuildContext context) {
    return AppStateMessage(
      icon: issue.needsAgreements
          ? Icons.assignment_turned_in_outlined
          : Icons.login_rounded,
      title: issue.title,
      body: issue.message,
      action: issue.needsAgreements
          ? FilledButton.icon(
              onPressed: onAgreementsTap,
              icon: const Icon(Icons.assignment_turned_in_outlined),
              label: const Text('약관 동의하기'),
            )
          : null,
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 10),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontSize: 30,
                  letterSpacing: 0,
                ),
          ),
        ],
      ),
    );
  }
}

class _GenrePanel extends StatelessWidget {
  const _GenrePanel({required this.items});

  final List<GenreStatItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const AppStateMessage(
        icon: Icons.bar_chart_rounded,
        title: '장르 데이터가 없습니다.',
        body: '컬렉션에 작품을 추가하면 장르 분포가 표시됩니다.',
      );
    }

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('장르 분포', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 16),
          for (final indexed in items.indexed) ...[
            Row(
              children: [
                SizedBox(
                  width: 72,
                  child: Text(
                    indexed.$2.label,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: indexed.$2.ratio.clamp(0.0, 1.0).toDouble(),
                      minHeight: 12,
                      backgroundColor: AppColors.bgSoftBeige,
                      valueColor: AlwaysStoppedAnimation(
                        AppColors.chartPalette[
                            indexed.$1 % AppColors.chartPalette.length],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _FormatPanel extends StatelessWidget {
  const _FormatPanel({required this.items});

  final List<FormatStatItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const AppStateMessage(
        icon: Icons.donut_large_rounded,
        title: '포맷 분포 데이터가 없습니다.',
        body: 'TV, Movie, OVA 같은 형식 정보가 쌓이면 표시됩니다.',
      );
    }

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('포맷 분포', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 14),
          for (final indexed in items.indexed) ...[
            Row(
              children: [
                SizedBox(
                  width: 76,
                  child: Text(
                    indexed.$2.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: indexed.$2.ratio.clamp(0.0, 1.0).toDouble(),
                      minHeight: 12,
                      backgroundColor: AppColors.bgSoftBeige,
                      valueColor: AlwaysStoppedAnimation(
                        AppColors.chartPalette[
                            (indexed.$1 + 2) % AppColors.chartPalette.length],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  '${indexed.$2.count}',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _YearlyScorePanel extends StatelessWidget {
  const _YearlyScorePanel({required this.items});

  final List<YearlyScoreItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const AppStateMessage(
        icon: Icons.stacked_bar_chart_rounded,
        title: '연도별 평점 데이터가 없습니다.',
        body: '평점을 저장한 작품이 생기면 연도별 추이가 표시됩니다.',
      );
    }

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('연도별 평균 평점', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 18),
          SizedBox(
            height: 150,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final bar in items)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Align(
                              alignment: Alignment.bottomCenter,
                              child: FractionallySizedBox(
                                heightFactor: bar.ratio,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: AppColors.point,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${bar.year}',
                            style: Theme.of(context).textTheme.labelMedium,
                          ),
                        ],
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
}

class _StudioPanel extends StatelessWidget {
  const _StudioPanel({required this.items});

  final List<RankingItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const AppStateMessage(
        icon: Icons.apartment_rounded,
        title: '스튜디오 랭킹 데이터가 없습니다.',
        body: '컬렉션이 쌓이면 자주 본 제작사가 표시됩니다.',
      );
    }

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('스튜디오 랭킹', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          for (final studio in items)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                backgroundColor: AppColors.pointSoft,
                foregroundColor: AppColors.textOnPointSoft,
                child: Icon(Icons.apartment_rounded),
              ),
              title: Text(
                studio.label,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(studio.detail),
            ),
        ],
      ),
    );
  }
}

class _VoiceActorPanel extends StatelessWidget {
  const _VoiceActorPanel({required this.items});

  final List<RankingItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const AppStateMessage(
        icon: Icons.record_voice_over_outlined,
        title: '성우 랭킹 데이터가 없습니다.',
        body: '작품과 성우 정보가 연결되면 선호 성우가 표시됩니다.',
      );
    }

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '성우 랭킹',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              const AppBadge(label: 'count'),
            ],
          ),
          const SizedBox(height: 12),
          for (final actor in items)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                backgroundColor: AppColors.infoSoft,
                foregroundColor: AppColors.info,
                child: Icon(Icons.record_voice_over_outlined),
              ),
              title: Text(
                actor.label,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(actor.detail),
            ),
        ],
      ),
    );
  }
}
