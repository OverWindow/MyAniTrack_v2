enum CollectionStatus {
  planned('planned', '볼 예정'),
  watching('watching', '보는 중'),
  completed('completed', '완료'),
  paused('paused', '일시중지'),
  dropped('dropped', '중단');

  const CollectionStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static CollectionStatus fromApiValue(String? value) {
    for (final status in values) {
      if (status.apiValue == value) {
        return status;
      }
    }
    return planned;
  }
}
