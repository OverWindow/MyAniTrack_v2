class PageInfo {
  const PageInfo({
    required this.hasNext,
    this.nextCursor,
    this.limit,
  });

  final bool hasNext;
  final String? nextCursor;
  final int? limit;

  factory PageInfo.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const PageInfo(hasNext: false);
    }

    return PageInfo(
      hasNext: json['hasNext'] == true,
      nextCursor: json['nextCursor']?.toString(),
      limit: (json['limit'] as num?)?.toInt(),
    );
  }
}
