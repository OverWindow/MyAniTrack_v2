import 'page_info.dart';

class PaginatedResult<T> {
  const PaginatedResult({
    required this.items,
    required this.pageInfo,
  });

  final List<T> items;
  final PageInfo pageInfo;
}
