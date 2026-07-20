import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:myanitrack_mobile/src/config.dart';
import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/theme.dart';
import 'package:myanitrack_mobile/src/widgets.dart';

class BootstrapScreen extends StatefulWidget {
  const BootstrapScreen({super.key});

  @override
  State<BootstrapScreen> createState() => _BootstrapScreenState();
}

class _BootstrapScreenState extends State<BootstrapScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    return CupertinoPageScaffold(
      child: AppBackground(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedBuilder(
                animation: _controller,
                builder: (_, child) => Transform.scale(
                  scale: reduceMotion ? 1 : 0.97 + (_controller.value * 0.04),
                  child: Opacity(
                    opacity: reduceMotion
                        ? 1
                        : 0.78 + (_controller.value * 0.22),
                    child: child,
                  ),
                ),
                child: const SizedBox(
                  width: 124,
                  child: Image(image: AssetImage(AppAssets.logo)),
                ),
              ),
              const SizedBox(height: 20),
              const CupertinoActivityIndicator(
                radius: 12,
                color: AppColors.pointPressed,
              ),
              const SizedBox(height: 12),
              Text('마이애니트랙을 준비하고 있어요', style: appLabelStyle()),
            ],
          ),
        ),
      ),
    );
  }
}

class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider);
    final isWaiting = session.phase == SessionPhase.oauthPending;

    return CupertinoPageScaffold(
      child: AppBackground(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - 40,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 184,
                      height: 96,
                      child: Image.asset(AppAssets.logo, fit: BoxFit.contain),
                    ),
                    const SizedBox(height: 26),
                    Text(
                      '좋아한 작품을 기록하고\n내 취향을 더 선명하게',
                      textAlign: TextAlign.center,
                      style: appTitleStyle(size: 27),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      '마이애니트랙은 애니 감상 기록과 분석을\n한곳에서 관리하는 개인 라이브러리입니다.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Pretendard',
                        fontSize: 15,
                        height: 1.55,
                        color: AppColors.mutedText,
                      ),
                    ),
                    const SizedBox(height: 38),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(AppRadii.card),
                          border: Border.all(color: AppColors.border),
                          boxShadow: appCardShadow,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            children: [
                              SizedBox(
                                width: double.infinity,
                                height: 50,
                                child: CupertinoButton(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 18,
                                  ),
                                  borderRadius: BorderRadius.circular(
                                    AppRadii.pill,
                                  ),
                                  color: AppColors.card,
                                  onPressed: isWaiting
                                      ? null
                                      : () => ref
                                            .read(
                                              sessionControllerProvider
                                                  .notifier,
                                            )
                                            .signInWithGoogle(),
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      border: Border.all(
                                        color: AppColors.border,
                                      ),
                                      borderRadius: BorderRadius.circular(
                                        AppRadii.pill,
                                      ),
                                    ),
                                    child: SizedBox.expand(
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          if (isWaiting)
                                            const CupertinoActivityIndicator()
                                          else
                                            const GoogleMark(),
                                          const SizedBox(width: 10),
                                          Text(
                                            isWaiting
                                                ? 'Google 응답을 기다리는 중'
                                                : 'Google로 계속하기',
                                            style: const TextStyle(
                                              fontFamily: 'Pretendard',
                                              fontSize: 15,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.text,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              if (session.message != null) ...[
                                const SizedBox(height: 12),
                                Text(
                                  session.message!,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontFamily: 'Pretendard',
                                    fontSize: 13,
                                    color: AppColors.error,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 22),
                    const Text(
                      '계속하면 서비스 이용약관과 개인정보처리방침에 동의하게 됩니다.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Pretendard',
                        fontSize: 12,
                        height: 1.45,
                        color: AppColors.mutedText,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AgreementsScreen extends ConsumerStatefulWidget {
  const AgreementsScreen({super.key});

  @override
  ConsumerState<AgreementsScreen> createState() => _AgreementsScreenState();
}

class _AgreementsScreenState extends ConsumerState<AgreementsScreen> {
  bool _terms = false;
  bool _privacy = false;

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionControllerProvider);
    final saving = session.phase == SessionPhase.backendLinking;
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('필수 약관 동의'),
        automaticallyImplyLeading: false,
      ),
      child: AppBackground(
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
                  children: [
                    Text('시작하기 전에 확인해주세요', style: appTitleStyle(size: 25)),
                    const SizedBox(height: 8),
                    const Text(
                      '필수 항목에 동의하면 바로 내 컬렉션을 만들 수 있습니다.',
                      style: TextStyle(
                        fontFamily: 'Pretendard',
                        fontSize: 14,
                        color: AppColors.mutedText,
                      ),
                    ),
                    const SizedBox(height: 20),
                    _AgreementCard(
                      title: '이용약관 v1.0',
                      paragraphs: _termsParagraphs,
                      value: _terms,
                      onChanged: (value) => setState(() => _terms = value),
                    ),
                    const SizedBox(height: 14),
                    _AgreementCard(
                      title: '개인정보처리방침 v1.0',
                      paragraphs: _privacyParagraphs,
                      value: _privacy,
                      onChanged: (value) => setState(() => _privacy = value),
                    ),
                    const SizedBox(height: 14),
                    const AppCard(
                      color: AppColors.neutral,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AppBadge(label: '데이터 출처'),
                          SizedBox(height: 10),
                          Text(
                            '애니메이션 정보는 AniList 등 외부 공개 API를 기반으로 제공됩니다. 추천과 분석은 내 기록을 바탕으로 만든 참고 정보이며 정확성을 보장하지 않습니다.',
                            style: TextStyle(
                              fontFamily: 'Pretendard',
                              fontSize: 13,
                              height: 1.55,
                              color: AppColors.secondaryText,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (session.message != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        session.message!,
                        style: const TextStyle(
                          fontFamily: 'Pretendard',
                          color: AppColors.error,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              DecoratedBox(
                decoration: const BoxDecoration(
                  color: Color(0xF7FFFFFF),
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: SafeArea(
                  top: false,
                  minimum: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: AppPrimaryButton(
                    label: '동의하고 시작하기',
                    loading: saving,
                    onPressed: _terms && _privacy
                        ? () => ref
                              .read(sessionControllerProvider.notifier)
                              .acceptAgreements()
                        : null,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AgreementCard extends StatefulWidget {
  const _AgreementCard({
    required this.title,
    required this.paragraphs,
    required this.value,
    required this.onChanged,
  });
  final String title;
  final List<String> paragraphs;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  State<_AgreementCard> createState() => _AgreementCardState();
}

class _AgreementCardState extends State<_AgreementCard> {
  bool expanded = false;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CupertinoButton(
            padding: EdgeInsets.zero,
            onPressed: () => widget.onChanged(!widget.value),
            child: Row(
              children: [
                Icon(
                  widget.value
                      ? CupertinoIcons.check_mark_circled_solid
                      : CupertinoIcons.circle,
                  color: widget.value
                      ? AppColors.pointPressed
                      : AppColors.mutedText,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(widget.title, style: appTitleStyle(size: 17)),
                ),
                const AppBadge(label: '필수'),
              ],
            ),
          ),
          const SizedBox(height: 8),
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 180),
            crossFadeState: expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: const SizedBox.shrink(),
            secondChild: Column(
              children: [
                for (final paragraph in widget.paragraphs)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 9),
                    child: Text(
                      paragraph,
                      style: const TextStyle(
                        fontFamily: 'Pretendard',
                        fontSize: 12.5,
                        height: 1.55,
                        color: AppColors.secondaryText,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          CupertinoButton(
            padding: const EdgeInsets.symmetric(vertical: 6),
            onPressed: () => setState(() => expanded = !expanded),
            child: Text(expanded ? '내용 접기' : '내용 보기'),
          ),
        ],
      ),
    );
  }
}

const _termsParagraphs = <String>[
  '제1조 (목적) 본 약관은 마이애니트랙이 제공하는 애니메이션 기록 및 분석 서비스의 이용과 관련한 권리와 의무를 정합니다.',
  '제2조 (서비스의 내용) 서비스는 시청 기록 관리, 평점 등록, 맞춤 분석 기능을 제공합니다.',
  '제3조 (계정 및 이용자 책임) 이용자는 계정 정보를 안전하게 관리할 책임이 있습니다.',
  '제4조 (금지 행위) 계정 도용, 서비스 운영 방해, 부적절한 콘텐츠 작성과 자동화된 데이터 수집을 금지합니다.',
  '제5조 (서비스 변경 및 중단) 운영상 또는 기술상의 필요에 따라 일부 기능을 변경하거나 중단할 수 있습니다.',
  '제6조 (책임 제한) 추천 및 분석 결과의 정확성이나 완전성을 보장하지 않습니다.',
];

const _privacyParagraphs = <String>[
  '제1조 (수집 항목) Google 계정 이메일과 사용자명, 서비스 이용 중 생성되는 시청 기록과 평점 정보를 수집합니다.',
  '제2조 (이용 목적) 수집된 정보는 시청 기록 관리, 통계 분석과 서비스 개선에 사용됩니다.',
  '제3조 (보관 기간) 개인정보는 회원 탈퇴 시까지 보관되며 탈퇴 시 지체 없이 삭제됩니다.',
  '제4조 (제3자 제공) 법령에 의해 요구되는 경우를 제외하고 개인정보를 외부에 제공하지 않습니다.',
  '제5조 (이용자 권리) 이용자는 언제든지 개인정보를 조회·수정하거나 계정 삭제를 요청할 수 있습니다.',
  '제6조 (데이터 보안) 서비스는 개인정보 보호를 위한 합리적인 보안 조치를 적용합니다.',
];
