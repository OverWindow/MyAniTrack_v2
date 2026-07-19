import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:myanitrack_mobile/src/app.dart';
import 'package:myanitrack_mobile/src/providers.dart';
import 'package:myanitrack_mobile/src/theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const goldenKey = ValueKey('login-golden');

  setUpAll(() async {
    final bytes = await File(
      'test/fonts/Pretendard-Regular.ttf',
    ).readAsBytes();
    final pretendard = FontLoader('Pretendard')
      ..addFont(Future.value(ByteData.sublistView(bytes)));
    await pretendard.load();
  });

  Future<void> pumpLogin(
    WidgetTester tester, {
    required Size surfaceSize,
  }) async {
    tester.view.physicalSize = surfaceSize;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionControllerProvider.overrideWith(
            _SignedOutSessionController.new,
          ),
        ],
        child: const RepaintBoundary(
          key: goldenKey,
          child: MyAniTrackApp(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('세션이 없으면 Android 소형 화면에서 바로 로그인 화면을 연다', (
    tester,
  ) async {
    await pumpLogin(tester, surfaceSize: const Size(360, 800));

    expect(find.text('Google로 계속하기'), findsOneWidget);
    expect(find.text('둘러보기'), findsNothing);
    expect(find.text('내 컬렉션'), findsNothing);
  });

  testWidgets('iPhone 화면에서도 로그인 UI가 넘치지 않는다', (tester) async {
    await pumpLogin(tester, surfaceSize: const Size(390, 844));

    expect(find.text('Google로 계속하기'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byKey(goldenKey),
      matchesGoldenFile('goldens/login_390x844.png'),
    );
  });

  testWidgets('430×932 화면에서 핵심 4탭을 전환한다', (tester) async {
    tester.view.physicalSize = const Size(430, 932);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    late final GoRouter router;
    router = GoRouter(
      initialLocation: '/collection',
      routes: [
        ShellRoute(
          builder: (_, _, child) => AppTabShell(child: child),
          routes: [
            for (final route in const {
              '/collection': '컬렉션 화면',
              '/search': '검색 화면',
              '/analysis': '분석 화면',
              '/profile': '프로필 화면',
            }.entries)
              GoRoute(
                path: route.key,
                builder: (_, _) => Center(child: Text(route.value)),
              ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      CupertinoApp.router(
        theme: appCupertinoTheme,
        routerConfig: router,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('컬렉션'), findsOneWidget);
    expect(find.text('검색'), findsOneWidget);
    expect(find.text('분석'), findsOneWidget);
    expect(find.text('프로필'), findsOneWidget);

    await tester.tap(find.text('분석'));
    await tester.pumpAndSettle();
    expect(find.text('분석 화면'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _SignedOutSessionController extends SessionController {
  @override
  SessionState build() => const SessionState(phase: SessionPhase.signedOut);
}
