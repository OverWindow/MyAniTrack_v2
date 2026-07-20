import 'package:crop_your_image/crop_your_image.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image/image.dart' as image_lib;
import 'package:image_picker/image_picker.dart';

import 'package:myanitrack_mobile/src/api.dart';
import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/theme.dart';
import 'package:myanitrack_mobile/src/widgets.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionControllerProvider);
    final user = session.user;
    if (user == null) {
      return const CupertinoPageScaffold(
        child: AppBackground(
          child: Center(child: CupertinoActivityIndicator()),
        ),
      );
    }
    return CupertinoPageScaffold(
      child: AppBackground(
        child: CustomScrollView(
          slivers: [
            const AppCompactSliverHeader(title: '프로필'),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              sliver: SliverList.list(
                children: [
                  AppCard(
                    child: Column(
                      children: [
                        ClipOval(
                          child: SizedBox.square(
                            dimension: 92,
                            child: AppNetworkImage(
                              url: user.profileImageUrl,
                              profile: true,
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(user.displayName, style: appTitleStyle(size: 24)),
                        const SizedBox(height: 4),
                        Text(
                          user.email,
                          style: const TextStyle(
                            fontFamily: 'Pretendard',
                            fontSize: 14,
                            color: AppColors.mutedText,
                          ),
                        ),
                        const SizedBox(height: 14),
                        AppSecondaryButton(
                          label: '프로필 수정',
                          icon: CupertinoIcons.pencil,
                          onPressed: () => context.push('/profile/edit'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  AppCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        _ProfileMenuRow(
                          icon: CupertinoIcons.doc_text,
                          title: '약관 및 개인정보',
                          onTap: () => context.push('/profile/legal'),
                        ),
                        const _MenuDivider(),
                        _ProfileMenuRow(
                          icon: CupertinoIcons.arrow_clockwise,
                          title: '계정 정보 새로고침',
                          onTap: _refreshUser,
                        ),
                        const _MenuDivider(),
                        _ProfileMenuRow(
                          icon: CupertinoIcons.person_crop_circle_badge_minus,
                          title: '계정 관리',
                          onTap: () => context.push('/profile/account'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    '마이애니트랙 · user #${user.id}',
                    textAlign: TextAlign.center,
                    style: appLabelStyle(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _refreshUser() async {
    try {
      await ref.read(sessionControllerProvider.notifier).refreshUser();
      if (mounted) showAppToast(context, '계정 정보를 새로고침했습니다.');
    } on ApiFailure catch (error) {
      if (mounted) showAppToast(context, error.message, error: true);
    }
  }
}

class _ProfileMenuRow extends StatelessWidget {
  const _ProfileMenuRow({
    required this.icon,
    required this.title,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      onPressed: onTap,
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: AppColors.pointSoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 19, color: AppColors.pointPressed),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontFamily: 'Pretendard',
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.text,
              ),
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

class _MenuDivider extends StatelessWidget {
  const _MenuDivider();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(left: 62),
      child: SizedBox(height: 1, child: ColoredBox(color: AppColors.border)),
    );
  }
}

class AccountManagementScreen extends ConsumerStatefulWidget {
  const AccountManagementScreen({super.key});

  @override
  ConsumerState<AccountManagementScreen> createState() =>
      _AccountManagementScreenState();
}

class _AccountManagementScreenState
    extends ConsumerState<AccountManagementScreen> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('계정 관리'),
        previousPageTitle: '프로필',
      ),
      child: AppBackground(
        child: SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 22, 16, 28),
            children: [
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('로그아웃', style: appTitleStyle(size: 18)),
                    const SizedBox(height: 7),
                    const Text(
                      '이 기기에서 백엔드와 Google 로그인 세션을 함께 종료합니다.',
                      style: TextStyle(
                        fontFamily: 'Pretendard',
                        fontSize: 13,
                        height: 1.5,
                        color: AppColors.secondaryText,
                      ),
                    ),
                    const SizedBox(height: 14),
                    AppSecondaryButton(
                      label: '로그아웃',
                      icon: CupertinoIcons.square_arrow_right,
                      onPressed: _busy ? null : _signOut,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              AppCard(
                color: AppColors.errorSoft,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '계정 영구 삭제',
                      style: appTitleStyle(size: 18, color: AppColors.error),
                    ),
                    const SizedBox(height: 7),
                    const Text(
                      '컬렉션과 분석 데이터가 영구 삭제되며 복구할 수 없습니다.',
                      style: TextStyle(
                        fontFamily: 'Pretendard',
                        fontSize: 13,
                        height: 1.5,
                        color: AppColors.secondaryText,
                      ),
                    ),
                    const SizedBox(height: 14),
                    AppSecondaryButton(
                      label: '계정 삭제 요청',
                      icon: CupertinoIcons.delete,
                      destructive: true,
                      onPressed: _busy ? null : _deleteAccount,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _signOut() async {
    final confirmed = await showAppConfirmation(
      context,
      title: '로그아웃할까요?',
      message: '이 기기에서 마이애니트랙 세션을 종료합니다.',
      confirmLabel: '로그아웃',
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    await ref.read(sessionControllerProvider.notifier).signOut();
  }

  Future<void> _deleteAccount() async {
    final confirmed = await showAppConfirmation(
      context,
      title: '계정을 영구 삭제할까요?',
      message: '모든 기록과 분석 데이터가 삭제되며 되돌릴 수 없습니다.',
      confirmLabel: '영구 삭제',
      destructive: true,
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(sessionControllerProvider.notifier).deleteAccount();
    } on ApiFailure catch (error) {
      if (mounted) {
        showAppToast(context, error.message, error: true);
        setState(() => _busy = false);
      }
    }
  }
}

class ProfileEditScreen extends ConsumerStatefulWidget {
  const ProfileEditScreen({super.key});

  @override
  ConsumerState<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends ConsumerState<ProfileEditScreen> {
  late final TextEditingController _username = TextEditingController(
    text: ref.read(sessionControllerProvider).user?.username,
  );
  XFile? _image;
  Uint8List? _preview;
  bool _removeImage = false;
  bool _saving = false;

  @override
  void dispose() {
    _username.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionControllerProvider).user;
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('프로필 수정'),
        previousPageTitle: '프로필',
      ),
      child: AppBackground(
        child: SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 22, 16, 28),
            children: [
              Center(
                child: Stack(
                  children: [
                    ClipOval(
                      child: SizedBox.square(
                        dimension: 112,
                        child: _preview != null
                            ? Image.memory(_preview!, fit: BoxFit.cover)
                            : AppNetworkImage(
                                url: _removeImage
                                    ? null
                                    : user?.profileImageUrl,
                                profile: true,
                              ),
                      ),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: CupertinoButton(
                        padding: EdgeInsets.zero,
                        minimumSize: const Size.square(38),
                        borderRadius: BorderRadius.circular(99),
                        color: AppColors.point,
                        onPressed: _pickImage,
                        child: const Icon(
                          CupertinoIcons.camera_fill,
                          size: 18,
                          color: AppColors.card,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (user?.profileImageUrl != null || _image != null) ...[
                const SizedBox(height: 8),
                CupertinoButton(
                  onPressed: () => setState(() {
                    _image = null;
                    _preview = null;
                    _removeImage = true;
                  }),
                  child: const Text('프로필 이미지 제거'),
                ),
              ],
              const SizedBox(height: 18),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('사용자명', style: appLabelStyle()),
                    const SizedBox(height: 8),
                    CupertinoTextField(
                      controller: _username,
                      maxLength: 20,
                      placeholder: '3~20자 영문, 숫자, 밑줄',
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.neutral,
                        borderRadius: BorderRadius.circular(AppRadii.input),
                        border: Border.all(color: AppColors.border),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '현재 백엔드가 지원하는 사용자명과 프로필 이미지만 변경할 수 있습니다.',
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
              const SizedBox(height: 18),
              AppPrimaryButton(
                label: '변경사항 저장',
                loading: _saving,
                onPressed: _save,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickImage() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 2048,
      requestFullMetadata: false,
    );
    if (image == null) return;
    final bytes = await image.readAsBytes();
    if (!mounted) return;
    final cropped = await Navigator.of(context).push<Uint8List>(
      CupertinoPageRoute(
        fullscreenDialog: true,
        builder: (_) => _ProfileCropScreen(image: bytes),
      ),
    );
    if (!mounted || cropped == null) return;
    if (cropped.lengthInBytes > 5 * 1024 * 1024) {
      showAppToast(context, '프로필 이미지는 5MB 이하여야 합니다.', error: true);
      return;
    }
    setState(() {
      _image = XFile.fromData(
        cropped,
        mimeType: 'image/jpeg',
        name: 'myanitrack-profile.jpg',
      );
      _preview = cropped;
      _removeImage = false;
    });
  }

  Future<void> _save() async {
    final username = _username.text.trim();
    if (!RegExp(r'^[A-Za-z0-9_]{3,20}$').hasMatch(username)) {
      showAppToast(context, '사용자명은 3~20자 영문, 숫자, 밑줄만 사용할 수 있습니다.', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await ref
          .read(profileRepositoryProvider)
          .update(
            username: username,
            profileImage: _image,
            removeProfileImage: _removeImage,
          );
      await ref.read(sessionControllerProvider.notifier).refreshUser();
      if (!mounted) return;
      showAppToast(context, '프로필을 수정했습니다.');
      Navigator.of(context).pop();
    } on ApiFailure catch (error) {
      if (mounted) showAppToast(context, error.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _ProfileCropScreen extends StatefulWidget {
  const _ProfileCropScreen({required this.image});

  final Uint8List image;

  @override
  State<_ProfileCropScreen> createState() => _ProfileCropScreenState();
}

class _ProfileCropScreenState extends State<_ProfileCropScreen> {
  final CropController _controller = CropController();
  bool _ready = false;
  bool _cropping = false;

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: const Text('사진 위치 조정'),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _cropping ? null : () => Navigator.of(context).pop(),
          child: const Text('취소'),
        ),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: !_ready || _cropping ? null : _crop,
          child: _cropping
              ? const CupertinoActivityIndicator(radius: 9)
              : const Text('완료'),
        ),
      ),
      child: SafeArea(
        top: false,
        child: ColoredBox(
          color: const Color(0xFF17130F),
          child: Column(
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 18, 20, 12),
                child: Text(
                  '두 손가락으로 확대하고 드래그해 원 안에 맞춰주세요.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Pretendard',
                    fontSize: 14,
                    color: CupertinoColors.systemGrey4,
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Crop(
                    image: widget.image,
                    controller: _controller,
                    withCircleUi: true,
                    interactive: true,
                    fixCropRect: true,
                    baseColor: const Color(0xFF17130F),
                    maskColor: const Color(0xAA000000),
                    radius: 999,
                    progressIndicator: const Center(
                      child: CupertinoActivityIndicator(color: AppColors.card),
                    ),
                    cornerDotBuilder: (_, _) => const SizedBox.shrink(),
                    initialRectBuilder: InitialRectBuilder.withBuilder((
                      viewport,
                      _,
                    ) {
                      final side =
                          mathMin(viewport.width, viewport.height) * 0.82;
                      return Rect.fromCenter(
                        center: viewport.center,
                        width: side,
                        height: side,
                      );
                    }),
                    onStatusChanged: (status) {
                      if (mounted) {
                        setState(() => _ready = status == CropStatus.ready);
                      }
                    },
                    onCropped: _onCropped,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _crop() {
    setState(() => _cropping = true);
    _controller.crop();
  }

  Future<void> _onCropped(CropResult result) async {
    switch (result) {
      case CropSuccess(:final croppedImage):
        final normalized = await compute(_normalizeProfileImage, croppedImage);
        if (mounted) Navigator.of(context).pop(normalized);
      case CropFailure():
        if (!mounted) return;
        setState(() => _cropping = false);
        showAppToast(context, '사진을 자르지 못했습니다. 다시 시도해주세요.', error: true);
    }
  }
}

double mathMin(double left, double right) => left < right ? left : right;

Uint8List _normalizeProfileImage(Uint8List source) {
  final decoded = image_lib.decodeImage(source);
  if (decoded == null) return source;
  final oriented = image_lib.bakeOrientation(decoded);
  final resized = oriented.width > 1024 || oriented.height > 1024
      ? image_lib.copyResize(
          oriented,
          width: oriented.width >= oriented.height ? 1024 : null,
          height: oriented.height > oriented.width ? 1024 : null,
          interpolation: image_lib.Interpolation.cubic,
        )
      : oriented;
  return Uint8List.fromList(image_lib.encodeJpg(resized, quality: 88));
}

class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('약관 및 개인정보'),
        previousPageTitle: '프로필',
      ),
      child: AppBackground(
        child: SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
            children: const [
              _LegalCard(
                title: '서비스 이용약관 v1.0',
                body:
                    '마이애니트랙은 애니메이션 기록, 평점과 개인 분석 기능을 제공합니다. 계정 도용, 서비스 운영 방해와 자동화된 데이터 수집은 금지됩니다. 운영상 또는 기술상의 필요에 따라 기능이 변경될 수 있으며 추천 및 분석 결과는 참고 정보입니다.',
              ),
              SizedBox(height: 14),
              _LegalCard(
                title: '개인정보처리방침 v1.0',
                body:
                    'Google 계정 이메일과 사용자명, 시청 기록과 평점 정보를 서비스 제공 목적으로 처리합니다. 개인정보는 회원 탈퇴 시까지 보관되고 탈퇴 시 삭제됩니다. 법령상 요구를 제외하고 개인정보를 외부에 제공하지 않습니다.',
              ),
              SizedBox(height: 14),
              _LegalCard(
                title: '데이터 출처 및 고지',
                body:
                    '애니메이션 정보는 AniList 등 외부 공개 API를 기반으로 하며 저작권은 각 제공자와 권리자에게 있습니다. 분석 결과는 내 기록을 바탕으로 생성되는 참고 정보입니다.',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LegalCard extends StatelessWidget {
  const _LegalCard({required this.title, required this.body});
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: appTitleStyle(size: 18)),
          const SizedBox(height: 10),
          Text(
            body,
            style: const TextStyle(
              fontFamily: 'Pretendard',
              fontSize: 13.5,
              height: 1.65,
              color: AppColors.secondaryText,
            ),
          ),
        ],
      ),
    );
  }
}
