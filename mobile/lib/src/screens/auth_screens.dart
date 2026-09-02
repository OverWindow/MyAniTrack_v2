import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:myanitrack_mobile/src/agreements.dart';
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
    final isWaiting = session.phase == SessionPhase.googlePending;

    return CupertinoPageScaffold(
      child: AppBackground(
        child: AppContentWidth(
          maxWidth: AppLayout.formMaxWidth,
          child: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 20,
                ),
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
                                                  ? 'Google 계정을 확인하는 중'
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
                      const _LoginAgreementNotice(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginAgreementNotice extends StatelessWidget {
  const _LoginAgreementNotice();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text(
          'Google로 계속하면 가입 또는 로그인하며,\n아래 필수 약관에 동의합니다.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Pretendard',
            fontSize: 12,
            height: 1.45,
            color: AppColors.mutedText,
          ),
        ),
        const SizedBox(height: 4),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 4,
          children: [
            _AgreementLink(
              key: const ValueKey('terms-link'),
              label: AppAgreements.termsTitle,
              onPressed: () => _showAgreement(
                context,
                title: AppAgreements.termsTitle,
                paragraphs: AppAgreements.termsParagraphs,
              ),
            ),
            const Text(
              '및',
              style: TextStyle(
                fontFamily: 'Pretendard',
                fontSize: 12,
                color: AppColors.mutedText,
              ),
            ),
            _AgreementLink(
              key: const ValueKey('privacy-link'),
              label: AppAgreements.privacyTitle,
              onPressed: () => _showAgreement(
                context,
                title: AppAgreements.privacyTitle,
                paragraphs: AppAgreements.privacyParagraphs,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _AgreementLink extends StatelessWidget {
  const _AgreementLink({
    required this.label,
    required this.onPressed,
    super.key,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      minimumSize: const Size(44, 32),
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
      onPressed: onPressed,
      child: Text(
        label,
        style: const TextStyle(
          fontFamily: 'Pretendard',
          fontSize: 12,
          fontWeight: FontWeight.w600,
          decoration: TextDecoration.underline,
          color: AppColors.pointPressed,
        ),
      ),
    );
  }
}

Future<void> _showAgreement(
  BuildContext context, {
  required String title,
  required List<String> paragraphs,
}) {
  return showCupertinoModalPopup<void>(
    context: context,
    builder: (context) => Align(
      alignment: Alignment.bottomCenter,
      child: CupertinoPopupSurface(
        child: SizedBox(
          key: const ValueKey('agreement-modal'),
          width: double.infinity,
          height: MediaQuery.sizeOf(context).height * 0.82,
          child: SafeArea(
            top: false,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 8, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(title, style: appTitleStyle(size: 19)),
                      ),
                      CupertinoButton(
                        minimumSize: const Size.square(44),
                        padding: EdgeInsets.zero,
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Icon(CupertinoIcons.xmark_circle_fill),
                      ),
                    ],
                  ),
                ),
                Container(height: 1, color: AppColors.border),
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
                    itemCount: paragraphs.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (_, index) => Text(
                      paragraphs[index],
                      style: const TextStyle(
                        fontFamily: 'Pretendard',
                        fontSize: 13.5,
                        height: 1.65,
                        color: AppColors.secondaryText,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
