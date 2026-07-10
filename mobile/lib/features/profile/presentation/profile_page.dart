import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_badge.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_state_message.dart';
import '../../../core/widgets/sample_banner.dart';
import '../../../data/auth/auth_onboarding_service.dart';
import '../../../data/auth/auth_session_service.dart';
import 'agreements_page.dart';
import 'profile_settings_page.dart';
import 'public_profile_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  static const _authSessionService = AuthSessionService();
  bool _connectingBackend = false;

  @override
  Widget build(BuildContext context) {
    final user = _authSessionService.currentUser;
    final isSignedIn = user != null;

    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          sliver: SliverList.list(
            children: [
              Text(
                '프로필',
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 16),
              const SampleBanner(),
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const CircleAvatar(
                          radius: 28,
                          backgroundColor: AppColors.pointSoft,
                          foregroundColor: AppColors.textOnPointSoft,
                          child: Icon(Icons.person_outline, size: 30),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                isSignedIn
                                    ? user.email ?? '로그인 사용자'
                                    : '샘플 사용자',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                isSignedIn
                                    ? '실제 컬렉션과 분석 API를 사용할 준비가 되었습니다.'
                                    : '로그인하면 실제 컬렉션과 분석이 저장됩니다.',
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    if (isSignedIn)
                      OutlinedButton.icon(
                        onPressed: () => _signOut(context),
                        icon: const Icon(Icons.logout_rounded),
                        label: const Text('로그아웃'),
                      )
                    else
                      FilledButton.icon(
                        onPressed: () => _startGoogleLogin(context),
                        icon: const Icon(Icons.login_rounded),
                        label: const Text('Google로 시작하기'),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (!AppConfig.hasSupabaseConfig) ...[
                const AppStateMessage(
                  icon: Icons.key_off_outlined,
                  title: 'Supabase 설정이 필요합니다.',
                  body:
                      'SUPABASE_URL과 SUPABASE_ANON_KEY를 dart-define으로 넘기면 Google 로그인을 사용할 수 있습니다.',
                ),
                const SizedBox(height: 16),
              ],
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('계정 준비', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 12),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(
                        backgroundColor: AppColors.infoSoft,
                        foregroundColor: AppColors.info,
                        child: Icon(Icons.link_rounded),
                      ),
                      title: const Text('백엔드 계정 연결'),
                      subtitle: const Text('POST /auth/supabase로 내부 사용자 연결'),
                      trailing: _connectingBackend
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.chevron_right_rounded),
                      onTap: isSignedIn && !_connectingBackend
                          ? _connectBackendAccount
                          : null,
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(
                        backgroundColor: AppColors.successSoft,
                        foregroundColor: AppColors.success,
                        child: Icon(Icons.assignment_turned_in_outlined),
                      ),
                      title: const Text('필수 약관 동의'),
                      subtitle: const Text('termsVersion/privacyVersion v1.0 저장'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => const AgreementsPage(),
                          ),
                        );
                      },
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(
                        backgroundColor: AppColors.pointSoft,
                        foregroundColor: AppColors.textOnPointSoft,
                        child: Icon(Icons.settings_outlined),
                      ),
                      title: const Text('프로필 설정'),
                      subtitle: const Text('공개 프로필 수정과 계정 삭제'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => const ProfileSettingsPage(),
                          ),
                        );
                      },
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(
                        backgroundColor: AppColors.infoSoft,
                        foregroundColor: AppColors.info,
                        child: Icon(Icons.public_rounded),
                      ),
                      title: const Text('공개 프로필 탐색'),
                      subtitle: const Text('/users/:userId 공개 컬렉션과 통계 조회'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => const PublicProfilePage(),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('앱 흐름', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 12),
                    const _ProfileFlowItem(
                      icon: Icons.verified_user_outlined,
                      title: 'Supabase Google 로그인',
                      body: 'access token을 백엔드 /auth/supabase에 연결합니다.',
                    ),
                    const _ProfileFlowItem(
                      icon: Icons.assignment_turned_in_outlined,
                      title: '필수 약관 확인',
                      body: '/me/agreements 결과에 따라 약관 화면을 표시합니다.',
                    ),
                    const _ProfileFlowItem(
                      icon: Icons.analytics_outlined,
                      title: '내 컬렉션 분석',
                      body: '/me/anime-list와 /me/anime-stats/*를 사용합니다.',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppBadge(label: 'API Base', icon: Icons.cloud_outlined),
                    SizedBox(height: 10),
                    Text(
                      AppConfig.apiBaseUrl,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _startGoogleLogin(BuildContext context) async {
    try {
      await _authSessionService.signInWithGoogle(
        redirectTo: AppConfig.authRedirectUrl,
      );
      if (context.mounted) {
        setState(() {});
      }
    } on Object {
      if (!context.mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('SUPABASE_URL과 SUPABASE_ANON_KEY 설정 후 사용할 수 있습니다.'),
        ),
      );
    }
  }

  Future<void> _signOut(BuildContext context) async {
    try {
      await _authSessionService.signOut();
      if (!context.mounted) {
        return;
      }
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('로그아웃되었습니다.')),
      );
    } on Object {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('로그아웃 중 문제가 발생했습니다.')),
      );
    }
  }

  Future<void> _connectBackendAccount() async {
    setState(() => _connectingBackend = true);

    try {
      final result = await AuthOnboardingService().connectAndCheckAgreements();
      if (!mounted) {
        return;
      }
      if (result.needsAgreements) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('백엔드 계정을 연결했습니다. 약관 동의가 필요합니다.')),
        );
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (context) => const AgreementsPage()),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('백엔드 계정과 약관 상태를 확인했습니다.')),
        );
      }
    } on Object {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('백엔드 계정 연결에 실패했습니다.')),
      );
    } finally {
      if (mounted) {
        setState(() => _connectingBackend = false);
      }
    }
  }
}

class _ProfileFlowItem extends StatelessWidget {
  const _ProfileFlowItem({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.bgSoftBeige,
            foregroundColor: AppColors.pointHover,
            child: Icon(icon, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(body, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
