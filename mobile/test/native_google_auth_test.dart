import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:myanitrack_mobile/src/native_google_auth.dart';
import 'package:myanitrack_mobile/src/providers.dart';

void main() {
  test(
    'native Google sign-in exposes a pending state and handles cancellation',
    () async {
      final gateway = _PendingGoogleAuthGateway();
      final container = ProviderContainer(
        overrides: [
          googleAuthGatewayProvider.overrideWithValue(gateway),
          authConfigurationReadyProvider.overrideWithValue(true),
          sessionControllerProvider.overrideWith(
            _SignedOutSessionController.new,
          ),
        ],
      );
      addTearDown(container.dispose);

      container.read(sessionControllerProvider);
      final future = container
          .read(sessionControllerProvider.notifier)
          .signInWithGoogle();
      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.googlePending,
      );

      gateway.completeWithCancellation();
      await future;

      final state = container.read(sessionControllerProvider);
      expect(state.phase, SessionPhase.signedOut);
      expect(state.message, 'Google 로그인이 취소되었습니다.');
    },
  );

  test(
    'iOS reports a configuration error until its client ID is supplied',
    () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);

      await expectLater(
        NativeGoogleAuthGateway().signIn(),
        throwsA(
          isA<NativeGoogleAuthFailure>().having(
            (error) => error.message,
            'message',
            contains('iOS Google Client ID'),
          ),
        ),
      );
    },
  );
}

class _SignedOutSessionController extends SessionController {
  @override
  SessionState build() => const SessionState(phase: SessionPhase.signedOut);
}

class _PendingGoogleAuthGateway implements GoogleAuthGateway {
  final Completer<void> _completer = Completer<void>();

  @override
  Future<void> signIn() => _completer.future;

  @override
  Future<bool> restorePreviousSession() async => false;

  void completeWithCancellation() {
    _completer.completeError(
      const NativeGoogleAuthFailure('Google 로그인이 취소되었습니다.'),
    );
  }

  @override
  Future<void> signOut() async {}
}
