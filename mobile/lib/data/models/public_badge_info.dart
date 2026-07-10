class PublicBadgeInfo {
  const PublicBadgeInfo({
    required this.label,
    this.description,
  });

  final String label;
  final String? description;

  factory PublicBadgeInfo.fromJson(Map<String, dynamic> json) {
    return PublicBadgeInfo(
      label: (json['name'] ?? json['label'] ?? json['title'] ?? 'Badge')
          .toString(),
      description: json['description']?.toString(),
    );
  }
}
