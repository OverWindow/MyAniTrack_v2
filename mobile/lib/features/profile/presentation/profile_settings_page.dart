import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../data/api/api_client.dart';
import '../../../data/api/auth_repository.dart';
import '../../../data/api/profile_repository.dart';
import '../../../data/auth/auth_session_service.dart';

class ProfileSettingsPage extends StatefulWidget {
  const ProfileSettingsPage({super.key});

  @override
  State<ProfileSettingsPage> createState() => _ProfileSettingsPageState();
}

class _ProfileSettingsPageState extends State<ProfileSettingsPage> {
  static const _authSessionService = AuthSessionService();

  final _usernameController = TextEditingController();
  final _bioController = TextEditingController();
  final _profileImageUrlController = TextEditingController();
  bool _isPublic = true;
  bool _loadingProfile = false;
  bool _saving = false;
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    _loadCurrentProfile();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _bioController.dispose();
    _profileImageUrlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isSignedIn = _authSessionService.isSignedIn;

    return Scaffold(
      backgroundColor: AppColors.bgPage,
      appBar: AppBar(
        title: const Text('프로필 설정'),
        backgroundColor: AppColors.bgPage,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('공개 프로필', style: Theme.of(context).textTheme.titleMedium),
                if (_loadingProfile) ...[
                  const SizedBox(height: 12),
                  const LinearProgressIndicator(minHeight: 3),
                ],
                const SizedBox(height: 14),
                TextField(
                  controller: _usernameController,
                  decoration: const InputDecoration(
                    labelText: '사용자명',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _bioController,
                  minLines: 3,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    labelText: '소개',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _profileImageUrlController,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    labelText: '프로필 이미지 URL',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _isPublic,
                  onChanged: (value) => setState(() => _isPublic = value),
                  title: const Text('공개 프로필 사용'),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: isSignedIn && !_saving ? _saveProfile : null,
                  icon: _saving
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_outlined),
                  label: Text(_saving ? '저장 중' : '프로필 저장'),
                ),
                if (!isSignedIn) ...[
                  const SizedBox(height: 10),
                  Text(
                    '로그인 후 프로필을 저장할 수 있습니다.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            borderColor: AppColors.error.withOpacity(0.28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '위험 구역',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.error,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  '계정 삭제는 내부 사용자, 컬렉션, 분석 데이터 삭제를 요청합니다.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.error,
                  ),
                  onPressed: isSignedIn && !_deleting ? _confirmDelete : null,
                  icon: _deleting
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.delete_outline),
                  label: Text(_deleting ? '삭제 중' : '계정 삭제'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _loadCurrentProfile() async {
    if (!_authSessionService.isSignedIn) {
      return;
    }

    setState(() => _loadingProfile = true);

    try {
      final user = await AuthRepository(ApiClient()).fetchMeInfo();
      if (!mounted) {
        return;
      }
      setState(() {
        _usernameController.text = user.username;
        _bioController.text = user.bio ?? '';
        _profileImageUrlController.text = user.profileImageUrl ?? '';
        _isPublic = user.isPublic;
      });
    } on Object {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('현재 프로필을 불러오지 못했습니다.')),
      );
    } finally {
      if (mounted) {
        setState(() => _loadingProfile = false);
      }
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _saving = true);

    try {
      await ProfileRepository(ApiClient()).updateMyProfile(
        username: _usernameController.text.trim().isEmpty
            ? null
            : _usernameController.text.trim(),
        bio: _bioController.text.trim().isEmpty ? null : _bioController.text.trim(),
        profileImageUrl: _profileImageUrlController.text.trim().isEmpty
            ? null
            : _profileImageUrlController.text.trim(),
        isPublic: _isPublic,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('프로필을 저장했습니다.')),
      );
    } on Object {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('프로필 저장에 실패했습니다.')),
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('계정을 삭제할까요?'),
          content: const Text('삭제 후 컬렉션과 분석 데이터는 복구할 수 없습니다.'),
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
      await _deleteAccount();
    }
  }

  Future<void> _deleteAccount() async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    setState(() => _deleting = true);

    try {
      await AuthRepository(ApiClient()).deleteAccount();
      await _authSessionService.signOut();
      if (!mounted) {
        return;
      }
      navigator.pop();
      messenger.showSnackBar(
        const SnackBar(content: Text('계정 삭제를 요청했습니다.')),
      );
    } on Object {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('계정 삭제에 실패했습니다.')),
      );
    } finally {
      if (mounted) {
        setState(() => _deleting = false);
      }
    }
  }
}
