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
