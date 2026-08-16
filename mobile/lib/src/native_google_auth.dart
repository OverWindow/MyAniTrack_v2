import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:myanitrack_mobile/src/config.dart';

const _googleAuthScopes = <String>['openid'];

abstract interface class GoogleAuthGateway {
  Future<void> signIn();
  Future<bool> restorePreviousSession();
  Future<void> signOut();
}

class NativeGoogleAuthFailure implements Exception {
  const NativeGoogleAuthFailure(this.message);
  final String message;

  @override
  String toString() => message;
}

class NativeGoogleAuthGateway implements GoogleAuthGateway {
  NativeGoogleAuthGateway({GoogleSignIn? googleSignIn})
    : _googleSignIn = googleSignIn ?? GoogleSignIn.instance;

  final GoogleSignIn _googleSignIn;
  Future<void>? _initializing;

  Future<void> _initialize() {
    final existing = _initializing;
    if (existing != null) return existing;

    if (AppConfig.googleWebClientId.isEmpty) {
      throw const NativeGoogleAuthFailure('Google Web Client ID가 설정되지 않았습니다.');
    }
    if (defaultTargetPlatform == TargetPlatform.iOS &&
        AppConfig.googleIosClientId.isEmpty) {
      throw const NativeGoogleAuthFailure('iOS Google Client ID가 설정되지 않았습니다.');
    }

    return _initializing = _googleSignIn.initialize(
      clientId: defaultTargetPlatform == TargetPlatform.iOS
          ? AppConfig.googleIosClientId
          : null,
      serverClientId: AppConfig.googleWebClientId,
    );
  }

  @override
  Future<void> signIn() async {
    await _initialize();
    try {
      final account = await _googleSignIn.authenticate(
        scopeHint: _googleAuthScopes,
      );
      await _exchangeAccount(account, allowAuthorizationPrompt: true);
    } on GoogleSignInException catch (error) {
      if (kDebugMode) {
        debugPrint(
          'Google Sign-In failed: code=${error.code}, '
          'description=${error.description}',
        );
      }
      throw NativeGoogleAuthFailure(_messageForGoogleError(error));
    } on AuthException catch (error) {
      throw NativeGoogleAuthFailure(
        error.message.isEmpty ? 'Google 계정을 연결하지 못했습니다.' : error.message,
      );
    }
  }

  @override
  Future<bool> restorePreviousSession() async {
    await _initialize();
    try {
      final attempt = _googleSignIn.attemptLightweightAuthentication();
      if (attempt == null) return false;
      final account = await attempt;
      if (account == null) return false;
      return _exchangeAccount(account, allowAuthorizationPrompt: false);
    } on GoogleSignInException catch (error) {
      if (kDebugMode) {
        debugPrint(
          'Google lightweight authentication failed: code=${error.code}, '
          'description=${error.description}',
        );
      }
      return false;
    } on AuthException catch (_) {
      return false;
    } on NativeGoogleAuthFailure catch (_) {
      return false;
    }
  }

  Future<bool> _exchangeAccount(
    GoogleSignInAccount account, {
    required bool allowAuthorizationPrompt,
  }) async {
    final idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      if (allowAuthorizationPrompt) {
        throw const NativeGoogleAuthFailure('Google ID 토큰을 받지 못했습니다.');
      }
      return false;
    }

    final authorization =
        await account.authorizationClient.authorizationForScopes(
          _googleAuthScopes,
        ) ??
        (allowAuthorizationPrompt
            ? await account.authorizationClient.authorizeScopes(
                _googleAuthScopes,
              )
            : null);
    if (authorization == null || authorization.accessToken.isEmpty) {
      if (allowAuthorizationPrompt) {
        throw const NativeGoogleAuthFailure('Google 접근 토큰을 받지 못했습니다.');
      }
      return false;
    }

    await Supabase.instance.client.auth.signInWithIdToken(
      provider: OAuthProvider.google,
      idToken: idToken,
      accessToken: authorization.accessToken,
    );
    return true;
  }

  @override
  Future<void> signOut() async {
    try {
      await _initialize();
      await _googleSignIn.signOut();
    } on GoogleSignInException catch (_) {
      // Supabase local sign-out remains authoritative when Google is unavailable.
    } on NativeGoogleAuthFailure catch (_) {
      // Supabase local sign-out remains authoritative when Google is unavailable.
    }
  }

  String _messageForGoogleError(GoogleSignInException error) {
    return switch (error.code) {
      GoogleSignInExceptionCode.canceled => 'Google 로그인이 취소되었습니다.',
      GoogleSignInExceptionCode.interrupted =>
        'Google 로그인이 중단되었습니다. 다시 시도해주세요.',
      GoogleSignInExceptionCode.clientConfigurationError =>
        'Google 로그인 설정이 맞지 않습니다. 패키지명·SHA·Client ID를 확인해주세요.',
      GoogleSignInExceptionCode.providerConfigurationError =>
        'Google Play 서비스를 사용할 수 없습니다.',
      GoogleSignInExceptionCode.uiUnavailable => 'Google 계정 선택창을 열지 못했습니다.',
      _ => 'Google 로그인을 완료하지 못했습니다.',
    };
  }
}
