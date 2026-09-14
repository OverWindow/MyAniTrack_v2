USE myanitrack_v2;

ALTER TABLE user_anime_stats
ADD COLUMN top_watched_genre_top_anime JSON NULL
  COMMENT '가장 많이 본 장르의 애니 5편, 별점 순 정렬',
ADD COLUMN top_rated_genre_top_anime JSON NULL
  COMMENT '평균 평점이 가장 높은 장르의 애니 5편, 별점 순 정렬';