const genreLabels = <String, String>{
  'Action': '액션',
  'Adventure': '모험',
  'Comedy': '코미디',
  'Drama': '드라마',
  'Fantasy': '판타지',
  'Horror': '호러',
  'Mahou Shoujo': '마법소녀',
  'Mecha': '메카',
  'Music': '음악',
  'Mystery': '미스터리',
  'Psychological': '심리',
  'Romance': '로맨스',
  'Sci-Fi': 'SF',
  'Slice of Life': '일상',
  'Sports': '스포츠',
  'Supernatural': '초자연',
  'Thriller': '스릴러',
  'Ecchi': '에치',
  'Hentai': '헨타이',
};

String genreLabel(String? genre) {
  if (genre == null || genre.trim().isEmpty) return '정보 없음';
  return genreLabels[genre] ?? genre;
}

String animeFormatLabel(String? format) {
  if (format == null || format.trim().isEmpty) return '정보 없음';
  return switch (format.toUpperCase()) {
    'TV' => 'TV 애니메이션',
    'TV_SHORT' => 'TV 숏',
    'MOVIE' => '극장판',
    'SPECIAL' => '스페셜',
    'OVA' => 'OVA',
    'ONA' => 'ONA',
    'MUSIC' => '뮤직',
    _ => format,
  };
}
