import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_badge.dart';
import '../../core/widgets/app_card.dart';
import '../../core/widgets/app_state_message.dart';
import '../../data/api/anime_repository.dart';
import '../../data/api/api_client.dart';
import '../../data/api/collection_repository.dart';
import '../../data/auth/auth_session_service.dart';
import '../../data/models/anime_cast_member.dart';
import '../../data/models/anime_entry.dart';
import '../../data/models/collection_status.dart';

class AnimeDetailPage extends StatefulWidget {
  const AnimeDetailPage({required this.entry, super.key});

  final AnimeEntry entry;

  @override
  State<AnimeDetailPage> createState() => _AnimeDetailPageState();
}

class _AnimeDetailPageState extends State<AnimeDetailPage> {
  static const _authSessionService = AuthSessionService();

  late CollectionStatus _status;
  late double _score;
  late int _progress;
  late Future<List<AnimeCastMember>> _castFuture;
  bool _saving = false;
  bool _deleting = false;
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    _status = widget.entry.collectionStatus;
    _score = widget.entry.score;
    _progress = widget.entry.progress;
    _castFuture = AnimeRepository(ApiClient()).fetchAnimeCastItems(
      widget.entry.id,
      role: 'MAIN',
      voiceLanguage: 'Japanese',
      limit: 12,
    );
  }

  @override
  Widget build(BuildContext context) {
    final entry = widget.entry;
    final totalEpisodes = entry.totalEpisodes <= 0 ? 1 : entry.totalEpisodes;

    return WillPopScope(
      onWillPop: () async {
        Navigator.of(context).pop(_changed);
        return false;
      },
      child: Scaffold(
        backgroundColor: AppColors.bgPage,
        body: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 280,
              pinned: true,
              foregroundColor: AppColors.textInverse,
              backgroundColor: AppColors.darkEspresso,
              flexibleSpace: FlexibleSpaceBar(
                title: Text(
                  entry.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                background: _DetailHero(entry: entry),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList.list(
                children: [
                  Row(
                    children: [
                      AppBadge(
                        label: _authSessionService.isSignedIn ? '내 기록' : '샘플',
                        sample: !_authSessionService.isSignedIn,
                      ),
                      const SizedBox(width: 8),
                      AppBadge(label: _status.label),
                    ],
                  ),
                  const SizedBox(height: 16),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '내 기록',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 16),
                        _DetailMetricRow(
                          icon: Icons.star_rounded,
                          label: '평점',
                          value: _score.toStringAsFixed(1),
                          color: AppColors.point,
                        ),
                        const SizedBox(height: 12),
                        _DetailMetricRow(
                          icon: Icons.play_circle_outline,
                          label: '진행도',
                          value: '$_progress/$totalEpisodes화',
                          color: AppColors.sample,
                        ),
                        const SizedBox(height: 12),
                        _DetailMetricRow(
                          icon: Icons.calendar_month_outlined,
                          label: '방영 연도',
                          value: '${entry.year}',
                          color: AppColors.info,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  _CastPanel(future: _castFuture),
                  const SizedBox(height: 16),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '컬렉션 편집',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final status in CollectionStatus.values)
                              ChoiceChip(
                                label: Text(status.label),
                                selected: _status == status,
                                onSelected: (_) {
                                  setState(() => _status = status);
                                },
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '평점 ${_score.toStringAsFixed(1)}',
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                        Slider(
                          min: 0,
                          max: 10,
                          divisions: 20,
                          value: _score.clamp(0.0, 10.0).toDouble(),
                          label: _score.toStringAsFixed(1),
                          onChanged: (value) {
                            setState(() => _score = value);
                          },
                        ),
                        Text(
                          '진행도 $_progress/$totalEpisodes화',
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                        Slider(
                          min: 0,
                          max: totalEpisodes.toDouble(),
                          divisions: totalEpisodes,
                          value: _progress.clamp(0, totalEpisodes).toDouble(),
                          label: '$_progress화',
                          onChanged: (value) {
                            setState(() => _progress = value.round());
                          },
                        ),
                        const SizedBox(height: 8),
                        FilledButton.icon(
                          onPressed: _saving ? null : _saveCollectionEntry,
                          icon: _saving
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.save_outlined),
                          label: Text(_saving ? '저장 중' : '기록 저장'),
                        ),
                        const SizedBox(height: 10),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.error,
                            side: const BorderSide(color: AppColors.error),
                          ),
                          onPressed: _deleting ? null : _confirmDeleteEntry,
                          icon: _deleting
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.delete_outline),
                          label: Text(_deleting ? '삭제 중' : '컬렉션에서 삭제'),
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
    );
  }

  Future<void> _saveCollectionEntry() async {
    if (!_authSessionService.isSignedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('로그인 후 내 컬렉션에 저장할 수 있습니다.')),
      );
      return;
    }

    setState(() => _saving = true);

    try {
      await CollectionRepository(ApiClient()).updateAnime(
        widget.entry.id,
        status: _status.apiValue,
        score: _score,
        progress: _progress,
      );
      if (!mounted) {
        return;
      }
      _changed = true;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('기록을 저장했습니다.')),
      );
    } on Object {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('저장에 실패했습니다.')),
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _confirmDeleteEntry() async {
    if (!_authSessionService.isSignedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('로그인 후 내 컬렉션에서 삭제할 수 있습니다.')),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('컬렉션에서 삭제할까요?'),
          content: Text('${widget.entry.title} 기록을 내 컬렉션에서 삭제합니다.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('취소'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.error),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('삭제'),
            ),
          ],
        );
      },
    );

    if (confirmed == true) {
      await _deleteCollectionEntry();
    }
  }

  Future<void> _deleteCollectionEntry() async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    setState(() => _deleting = true);

    try {
      await CollectionRepository(ApiClient()).removeAnime(widget.entry.id);
      if (!mounted) {
        return;
      }
      navigator.pop(true);
      messenger.showSnackBar(
        const SnackBar(content: Text('컬렉션에서 삭제했습니다.')),
      );
      return;
    } on Object {
      if (!mounted) {
        return;
      }
      messenger.showSnackBar(
        const SnackBar(content: Text('삭제에 실패했습니다.')),
      );
    } finally {
      if (mounted) {
        setState(() => _deleting = false);
      }
    }
  }
}

class _CastPanel extends StatelessWidget {
  const _CastPanel({required this.future});

  final Future<List<AnimeCastMember>> future;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AnimeCastMember>>(
      future: future,
      builder: (context, snapshot) {
        final cast = snapshot.data ?? const <AnimeCastMember>[];
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppBadge(
                  label: '일본어 주요 성우',
                  icon: Icons.record_voice_over_outlined,
                ),
                SizedBox(height: 14),
                LinearProgressIndicator(minHeight: 3),
              ],
            ),
          );
        }

        if (cast.isEmpty) {
          return const AppStateMessage(
            icon: Icons.record_voice_over_outlined,
            title: '캐스트 정보가 없습니다.',
            body: '일본어 MAIN 캐스트가 제공되면 이곳에 표시됩니다.',
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
                      '일본어 주요 성우',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  const AppBadge(label: 'MAIN'),
                ],
              ),
              const SizedBox(height: 12),
              for (final member in cast.take(8))
                _CastMemberTile(member: member),
            ],
          ),
        );
      },
    );
  }
}

class _CastMemberTile extends StatelessWidget {
  const _CastMemberTile({required this.member});

  final AnimeCastMember member;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: AppColors.infoSoft,
        foregroundColor: AppColors.info,
        backgroundImage: _imageProvider(member.voiceActorImageUrl),
        child: member.voiceActorImageUrl == null
            ? const Icon(Icons.record_voice_over_outlined)
            : null,
      ),
      title: Text(
        member.voiceActorName,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
      subtitle: Text(
        member.characterName,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: member.role == null
          ? null
          : AppBadge(label: member.role!.toUpperCase()),
    );
  }

  ImageProvider? _imageProvider(String? url) {
    if (url == null || url.isEmpty) {
      return null;
    }
    return NetworkImage(url);
  }
}

class _DetailHero extends StatelessWidget {
  const _DetailHero({required this.entry});

  final AnimeEntry entry;

  @override
  Widget build(BuildContext context) {
    final imageUrl = entry.coverImageUrl;

    return Stack(
      fit: StackFit.expand,
      children: [
        if (imageUrl == null || imageUrl.isEmpty)
          DecoratedBox(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.darkEspresso,
                  AppColors.darkCocoa,
                  AppColors.pointPressed,
                ],
              ),
            ),
            child: Center(
              child: Icon(
                Icons.movie_creation_outlined,
                size: 92,
                color: AppColors.pointSoft.withOpacity(0.72),
              ),
            ),
          )
        else
          Image.network(
            imageUrl,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) {
              return const ColoredBox(color: AppColors.darkEspresso);
            },
          ),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Color(0xCC1C1917)],
            ),
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 72,
          child: Text(
            '${entry.year} · ${entry.format} · ${entry.genre}',
            style: const TextStyle(
              color: AppColors.pointSoftStrong,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}

class _DetailMetricRow extends StatelessWidget {
  const _DetailMetricRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          backgroundColor: color.withOpacity(0.14),
          foregroundColor: color,
          child: Icon(icon),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}
