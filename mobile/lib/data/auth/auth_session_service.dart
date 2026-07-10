import 'package:supabase_flutter/supabase_flutter.dart';

class AuthSessionService {
  const AuthSessionService();

  bool get isConfigured {
    try {
      Supabase.instance.client;
      return true;
    } on Object {
      return false;
    }
  }

  Session? get currentSession {
    try {
      return Supabase.instance.client.auth.currentSession;
    } on Object {
      return null;
    }
  }

  User? get currentUser => currentSession?.user;

  bool get isSignedIn => currentSession != null;

  Stream<AuthState> get authStateChanges {
    try {
      return Supabase.instance.client.auth.onAuthStateChange;
    } on Object {
      return const Stream<AuthState>.empty();
    }
  }

  Future<void> signInWithGoogle({required String redirectTo}) async {
    await Supabase.instance.client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: redirectTo,
    );
  }

  Future<void> signOut() async {
    await Supabase.instance.client.auth.signOut();
  }
}
