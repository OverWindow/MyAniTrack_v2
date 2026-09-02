import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthState;

import 'package:myanitrack_mobile/src/api.dart';
import 'package:myanitrack_mobile/src/models.dart';
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
      final duplicateFuture = container
          .read(sessionControllerProvider.notifier)
          .signInWithGoogle();
      expect(
        container.read(sessionControllerProvider).phase,
        SessionPhase.googlePending,
      );
      expect(gateway.signInCalls, 1);

      gateway.completeWithCancellation();
      await Future.wait([future, duplicateFuture]);

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

  test('a fresh install waits for an explicit Google sign-in', () async {
    final google = _SuccessfulGoogleAuthGateway();
    final session = _FakeSupabaseSessionGateway();
    final container = _authContainer(google: google, session: session);
    addTearDown(container.dispose);

    container.read(sessionControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(
      container.read(sessionControllerProvider).phase,
      SessionPhase.signedOut,
    );
    expect(google.signInCalls, 0);
  });

  test(
    'an explicit Google sign-in creates the account and accepts agreements',
    () async {
      final session = _FakeSupabaseSessionGateway();
      final google = _SuccessfulGoogleAuthGateway(
        onSignIn: () => session.hasSession = true,
      );
      final repository = _FakeAuthRepository(agreementsAccepted: false);
      final container = _authContainer(
        google: google,
        session: session,
        repository: repository,
      );
      addTearDown(container.dispose);

      container.read(sessionControllerProvider);
      await Future<void>.delayed(Duration.zero);
      await container
          .read(sessionControllerProvider.notifier)
          .signInWithGoogle();

      final state = container.read(sessionControllerProvider);
      expect(state.phase, SessionPhase.authenticated);
      expect(state.user?.email, 'google@example.com');
      expect(repository.connectCalls, 1);
      expect(repository.acceptAgreementCalls, 1);
    },
  );

  test('a stored session with outdated agreements returns to login', () async {
    final google = _SuccessfulGoogleAuthGateway();
    final session = _FakeSupabaseSessionGateway(hasSession: true);
    final repository = _FakeAuthRepository(agreementsAccepted: false);
    final container = _authContainer(
      google: google,
      session: session,
      repository: repository,
    );
    addTearDown(container.dispose);

    container.read(sessionControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    final state = container.read(sessionControllerProvider);
    expect(state.phase, SessionPhase.signedOut);
    expect(state.message, contains('약관이 업데이트'));
    expect(repository.acceptAgreementCalls, 0);
    expect(session.signOutCalls, 1);
    expect(google.signOutCalls, 1);
  });
}

ProviderContainer _authContainer({
  required GoogleAuthGateway google,
  required SupabaseSessionGateway session,
  AuthRepository? repository,
}) {
  return ProviderContainer(
    overrides: [
      googleAuthGatewayProvider.overrideWithValue(google),
      supabaseSessionGatewayProvider.overrideWithValue(session),
      authConfigurationReadyProvider.overrideWithValue(true),
      if (repository != null)
        authRepositoryProvider.overrideWithValue(repository),
    ],
  );
}

class _SignedOutSessionController extends SessionController {
  @override
  SessionState build() => const SessionState(phase: SessionPhase.signedOut);
}

class _PendingGoogleAuthGateway implements GoogleAuthGateway {
  final Completer<void> _completer = Completer<void>();
  int signInCalls = 0;

  @override
  Future<void> signIn() {
    signInCalls += 1;
    return _completer.future;
  }

  void completeWithCancellation() {
    _completer.completeError(
      const NativeGoogleAuthFailure('Google 로그인이 취소되었습니다.'),
    );
  }

  @override
  Future<void> signOut() async {}
}

class _SuccessfulGoogleAuthGateway implements GoogleAuthGateway {
  _SuccessfulGoogleAuthGateway({this.onSignIn});

  final void Function()? onSignIn;
  int signInCalls = 0;
  int signOutCalls = 0;

  @override
  Future<void> signIn() async {
    signInCalls += 1;
    onSignIn?.call();
  }

  @override
  Future<void> signOut() async {
    signOutCalls += 1;
  }
}

class _FakeSupabaseSessionGateway implements SupabaseSessionGateway {
  _FakeSupabaseSessionGateway({this.hasSession = false});

  @override
  bool hasSession;
  int signOutCalls = 0;

  @override
  Stream<AuthState> get authStateChanges => const Stream<AuthState>.empty();

  @override
  Future<bool> refreshSession() async => hasSession;

  @override
  Future<void> signOut() async {
    signOutCalls += 1;
    hasSession = false;
  }
}

class _FakeAuthRepository extends AuthRepository {
  _FakeAuthRepository({required this.agreementsAccepted}) : super(ApiClient());

  bool agreementsAccepted;
  int connectCalls = 0;
  int acceptAgreementCalls = 0;

  @override
  Future<AuthUser> connectSupabase() async {
    connectCalls += 1;
    return const AuthUser(
      id: 1,
      email: 'google@example.com',
      username: 'google-user',
      role: 'USER',
      emailVerified: true,
    );
  }

  @override
  Future<AgreementStatus> agreements() async => _agreementStatus();

  @override
  Future<AgreementStatus> acceptAgreements() async {
    acceptAgreementCalls += 1;
    agreementsAccepted = true;
    return _agreementStatus();
  }

  AgreementStatus _agreementStatus() => AgreementStatus(
    termsAgreed: agreementsAccepted,
    privacyAgreed: agreementsAccepted,
    termsVersion: agreementsAccepted ? 'v1.1' : null,
    privacyVersion: agreementsAccepted ? 'v1.0' : null,
    serverHasRequiredAgreements: agreementsAccepted,
  );
}
