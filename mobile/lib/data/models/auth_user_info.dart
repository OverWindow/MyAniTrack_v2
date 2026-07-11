class AuthUserInfo {
  const AuthUserInfo({
    required this.id,
    required this.email,
    required this.username,
    required this.role,
    required this.isAdmin,
    required this.emailVerified,
  });

  final int id;
  final String email;
  final String username;
  final String role;
  final bool isAdmin;
  final bool emailVerified;

  factory AuthUserInfo.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final root = data is Map<String, dynamic> ? data : json;
    final user = root['user'] is Map<String, dynamic>
        ? root['user'] as Map<String, dynamic>
        : root;

    return AuthUserInfo(
      id: (user['id'] as num?)?.toInt() ?? 0,
      email: user['email']?.toString() ?? '',
      username: user['username']?.toString() ?? '',
      role: user['role']?.toString() ?? 'USER',
      isAdmin: user['isAdmin'] is bool ? user['isAdmin'] as bool : false,
      emailVerified: user['emailVerified'] is bool
          ? user['emailVerified'] as bool
          : false,
    );
  }
}
