import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_badge.dart';
import '../../../core/widgets/app_card.dart';
import '../../../data/api/api_client.dart';
import '../../../data/api/auth_repository.dart';

class AgreementsPage extends StatefulWidget {
  const AgreementsPage({super.key});

  @override
  State<AgreementsPage> createState() => _AgreementsPageState();
}

class _AgreementsPageState extends State<AgreementsPage> {
  bool _termsAgreed = false;
  bool _privacyAgreed = false;
  bool _saving = false;

  bool get _canSubmit => _termsAgreed && _privacyAgreed && !_saving;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPage,
      appBar: AppBar(
        title: const Text('약관 동의'),
        backgroundColor: AppColors.bgPage,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '필수 동의',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 10),
                const Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    AppBadge(label: 'terms v1.0'),
                    AppBadge(label: 'privacy v1.0'),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Google 로그인 후 백엔드의 /me/agreements 상태가 false이면 이 화면을 보여줍니다.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _termsAgreed,
                  onChanged: (value) {
                    setState(() => _termsAgreed = value ?? false);
                  },
                  title: const Text('서비스 이용약관 v1.0에 동의합니다.'),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _privacyAgreed,
                  onChanged: (value) {
                    setState(() => _privacyAgreed = value ?? false);
                  },
                  title: const Text('개인정보 처리방침 v1.0에 동의합니다.'),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: _canSubmit ? _submit : null,
                  icon: _saving
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check_rounded),
                  label: Text(_saving ? '저장 중' : '동의 저장'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    setState(() => _saving = true);

    try {
      await AuthRepository(ApiClient()).acceptRequiredAgreements();
      if (!mounted) {
        return;
      }
      navigator.pop();
      messenger.showSnackBar(
        const SnackBar(content: Text('필수 약관 동의를 저장했습니다.')),
      );
    } on Object {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('로그인 세션이 준비되면 약관 동의를 저장할 수 있습니다.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }
}
