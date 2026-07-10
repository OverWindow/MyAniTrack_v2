import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/app_config.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient({
    http.Client? httpClient,
    this.baseUrl = AppConfig.apiBaseUrl,
  }) : _httpClient = httpClient ?? http.Client();

  final http.Client _httpClient;
  final String baseUrl;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, String>? query,
    bool authenticated = false,
  }) {
    return _requestJson(
      'GET',
      path,
      query: query,
      authenticated: authenticated,
    );
  }

  Future<Map<String, dynamic>> postJson(
    String path, {
    Object? body,
    bool authenticated = false,
  }) {
    return _requestJson(
      'POST',
      path,
      body: body,
      authenticated: authenticated,
    );
  }

  Future<Map<String, dynamic>> patchJson(
    String path, {
    Object? body,
    bool authenticated = true,
  }) {
    return _requestJson(
      'PATCH',
      path,
      body: body,
      authenticated: authenticated,
    );
  }

  Future<Map<String, dynamic>> deleteJson(String path) {
    return _requestJson('DELETE', path, authenticated: true);
  }

  Future<Map<String, dynamic>> _requestJson(
    String method,
    String path, {
    Map<String, String>? query,
    Object? body,
    bool authenticated = false,
  }) async {
    final uri = _buildUri(path, query);
    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
    };

    if (authenticated) {
      final token = _currentAccessToken();
      if (token == null) {
        throw const ApiException(
          statusCode: 401,
          message: 'Login session is required.',
        );
      }
      headers['Authorization'] = 'Bearer $token';
    }

    final response = switch (method) {
      'GET' => await _httpClient.get(uri, headers: headers),
      'POST' => await _httpClient.post(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        ),
      'PATCH' => await _httpClient.patch(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        ),
      'DELETE' => await _httpClient.delete(uri, headers: headers),
      _ => throw ArgumentError.value(method, 'method'),
    };

    final decoded = _decodeBody(response.body);
    final json = decoded is Map<String, dynamic>
        ? decoded
        : <String, dynamic>{'data': decoded};

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        statusCode: response.statusCode,
        message: json['message']?.toString() ?? 'Request failed',
      );
    }

    return json;
  }

  Uri _buildUri(String path, Map<String, String>? query) {
    final normalizedBaseUrl = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    final normalizedPath = path.startsWith('/') ? path : '/$path';

    return Uri.parse('$normalizedBaseUrl$normalizedPath').replace(
      queryParameters: query,
    );
  }

  Object? _decodeBody(String body) {
    if (body.trim().isEmpty) {
      return <String, dynamic>{'success': true};
    }

    try {
      return jsonDecode(body);
    } on FormatException {
      return <String, dynamic>{
        'success': false,
        'message': body,
      };
    }
  }

  String? _currentAccessToken() {
    try {
      return Supabase.instance.client.auth.currentSession?.accessToken;
    } on Object {
      return null;
    }
  }
}
