USE myanitrack_v2;

-- relation 그래프에서 계산된 시리즈 그룹입니다.
-- scope:
--   mainline  = PREQUEL, SEQUEL
--   franchise = 본편 + 외전, 총집편, 대체 버전 등
CREATE TABLE IF NOT EXISTS anime_series (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  scope VARCHAR(20) NOT NULL COMMENT 'mainline, franchise',
  group_key_anime_id BIGINT NOT NULL COMMENT '그룹에서 가장 작은 내부 anime.id',
  canonical_anime_id BIGINT NULL COMMENT '대표 작품. 최초 계산 시 group_key와 동일',
  title VARCHAR(255) NULL COMMENT '관리자가 지정하는 시리즈 표시명',
  member_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_anime_series_scope_group (scope, group_key_anime_id),
  KEY idx_anime_series_canonical (canonical_anime_id),

  CONSTRAINT fk_anime_series_group_key
    FOREIGN KEY (group_key_anime_id) REFERENCES anime(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_anime_series_canonical
    FOREIGN KEY (canonical_anime_id) REFERENCES anime(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS anime_series_members (
  series_id BIGINT NOT NULL,
  anime_id BIGINT NOT NULL,
  is_completion_required BOOLEAN NOT NULL DEFAULT TRUE
    COMMENT '시리즈 완주 계산에 포함되는 작품인지 여부',
  completion_exclusion_reason VARCHAR(30) NULL
    COMMENT 'MUSIC, RECAP, COMPILATION, NOT_YET_RELEASED, CANCELLED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (series_id, anime_id),
  KEY idx_anime_series_members_anime (anime_id, series_id),

  CONSTRAINT fk_anime_series_members_series
    FOREIGN KEY (series_id) REFERENCES anime_series(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_anime_series_members_anime
    FOREIGN KEY (anime_id) REFERENCES anime(id)
    ON DELETE CASCADE
);

-- 기존 테이블에도 완주 판정 컬럼을 추가합니다. MySQL 버전에 따라
-- ADD COLUMN IF NOT EXISTS를 지원하지 않을 수 있어 information_schema를 사용합니다.
SET @has_completion_required = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'anime_series_members'
    AND COLUMN_NAME = 'is_completion_required'
);
SET @add_completion_required_sql = IF(
  @has_completion_required = 0,
  'ALTER TABLE anime_series_members ADD COLUMN is_completion_required BOOLEAN NOT NULL DEFAULT TRUE COMMENT ''시리즈 완주 계산에 포함되는 작품인지 여부'' AFTER anime_id',
  'SELECT 1'
);
PREPARE add_completion_required_stmt FROM @add_completion_required_sql;
EXECUTE add_completion_required_stmt;
DEALLOCATE PREPARE add_completion_required_stmt;

SET @has_completion_exclusion_reason = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'anime_series_members'
    AND COLUMN_NAME = 'completion_exclusion_reason'
);
SET @add_completion_exclusion_reason_sql = IF(
  @has_completion_exclusion_reason = 0,
  'ALTER TABLE anime_series_members ADD COLUMN completion_exclusion_reason VARCHAR(30) NULL COMMENT ''MUSIC, RECAP, COMPILATION, NOT_YET_RELEASED, CANCELLED'' AFTER is_completion_required',
  'SELECT 1'
);
PREPARE add_completion_exclusion_reason_stmt FROM @add_completion_exclusion_reason_sql;
EXECUTE add_completion_exclusion_reason_stmt;
DEALLOCATE PREPARE add_completion_exclusion_reason_stmt;

DROP PROCEDURE IF EXISTS rebuild_anime_series;

DELIMITER $$

CREATE PROCEDURE rebuild_anime_series(IN p_scope VARCHAR(20))
BEGIN
  DECLARE v_changed INT DEFAULT 1;
  DECLARE v_sql_safe_updates INT DEFAULT 0;

  -- 오류가 발생해도 현재 DB 세션의 Safe Update 설정을 원래 값으로 복원합니다.
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET @@SESSION.SQL_SAFE_UPDATES = v_sql_safe_updates;
    DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_next;
    DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_neighbor_nodes;
    DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_nodes;
    DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_edges;
    RESIGNAL;
  END;

  SET v_sql_safe_updates = @@SESSION.SQL_SAFE_UPDATES;

  IF p_scope IS NULL OR p_scope NOT IN ('mainline', 'franchise') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'scope must be one of mainline, franchise';
  END IF;

  -- 파생 테이블 전체 재계산에 필요한 UPDATE/DELETE만 현재 프로시저 실행 중 허용합니다.
  SET @@SESSION.SQL_SAFE_UPDATES = 0;

  DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_edges;
  DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_nodes;
  DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_neighbor_nodes;
  DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_next;

  CREATE TEMPORARY TABLE tmp_anime_series_edges (
    source_anime_id BIGINT NOT NULL,
    target_anime_id BIGINT NOT NULL,
    PRIMARY KEY (source_anime_id, target_anime_id),
    KEY idx_tmp_anime_series_edges_target (target_anime_id)
  ) ENGINE=InnoDB;

  -- 시리즈 소속 판정에서는 방향을 제거하지만 원본 anime_relations의 방향은 유지됩니다.
  IF p_scope = 'mainline' THEN
    INSERT IGNORE INTO tmp_anime_series_edges (source_anime_id, target_anime_id)
    SELECT ar.source_anime_id, ar.target_anime_id
    FROM anime_relations ar
    WHERE ar.target_anime_id IS NOT NULL
      AND ar.relation_type IN ('PREQUEL', 'SEQUEL');
  ELSE
    INSERT IGNORE INTO tmp_anime_series_edges (source_anime_id, target_anime_id)
    SELECT ar.source_anime_id, ar.target_anime_id
    FROM anime_relations ar
    WHERE ar.target_anime_id IS NOT NULL
      AND ar.relation_type IN (
        'PREQUEL',
        'SEQUEL',
        'PARENT',
        'SIDE_STORY',
        'SPIN_OFF',
        'ALTERNATIVE',
        'SUMMARY',
        'COMPILATION',
        'CONTAINS'
      );
  END IF;

  -- 연결 요소 계산을 위해 역방향 edge도 임시 테이블에 추가합니다.
  INSERT IGNORE INTO tmp_anime_series_edges (source_anime_id, target_anime_id)
  SELECT target_anime_id, source_anime_id
  FROM anime_relations ar
  WHERE ar.target_anime_id IS NOT NULL
    AND (
      (p_scope = 'mainline' AND ar.relation_type IN ('PREQUEL', 'SEQUEL'))
      OR
      (p_scope = 'franchise' AND ar.relation_type IN (
        'PREQUEL',
        'SEQUEL',
        'PARENT',
        'SIDE_STORY',
        'SPIN_OFF',
        'ALTERNATIVE',
        'SUMMARY',
        'COMPILATION',
        'CONTAINS'
      ))
    );

  CREATE TEMPORARY TABLE tmp_anime_series_nodes (
    anime_id BIGINT NOT NULL PRIMARY KEY,
    group_key_anime_id BIGINT NOT NULL,
    KEY idx_tmp_anime_series_nodes_group (group_key_anime_id)
  ) ENGINE=InnoDB;

  INSERT IGNORE INTO tmp_anime_series_nodes (anime_id, group_key_anime_id)
  SELECT source_anime_id, source_anime_id
  FROM tmp_anime_series_edges;

  INSERT IGNORE INTO tmp_anime_series_nodes (anime_id, group_key_anime_id)
  SELECT target_anime_id, target_anime_id
  FROM tmp_anime_series_edges;

  -- 각 노드에 연결된 가장 작은 그룹 키를 반복 전파해 connected component를 계산합니다.
  WHILE v_changed > 0 DO
    DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_next;
    DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_neighbor_nodes;

    -- MySQL은 하나의 쿼리에서 같은 TEMPORARY TABLE을 두 번 열 수 없으므로
    -- 이웃 노드 조회용 스냅샷을 별도 임시 테이블로 만듭니다.
    CREATE TEMPORARY TABLE tmp_anime_series_neighbor_nodes (
      anime_id BIGINT NOT NULL PRIMARY KEY,
      group_key_anime_id BIGINT NOT NULL,
      KEY idx_tmp_anime_series_neighbor_group (group_key_anime_id)
    ) ENGINE=InnoDB;

    INSERT INTO tmp_anime_series_neighbor_nodes (anime_id, group_key_anime_id)
    SELECT anime_id, group_key_anime_id
    FROM tmp_anime_series_nodes;

    CREATE TEMPORARY TABLE tmp_anime_series_next (
      anime_id BIGINT NOT NULL PRIMARY KEY,
      group_key_anime_id BIGINT NOT NULL,
      KEY idx_tmp_anime_series_next_group (group_key_anime_id)
    ) ENGINE=InnoDB;

    INSERT INTO tmp_anime_series_next (anime_id, group_key_anime_id)
    SELECT
      node.anime_id,
      LEAST(
        node.group_key_anime_id,
        COALESCE(MIN(neighbor.group_key_anime_id), node.group_key_anime_id)
      ) AS group_key_anime_id
    FROM tmp_anime_series_nodes node
    LEFT JOIN tmp_anime_series_edges edge_row
      ON edge_row.source_anime_id = node.anime_id
    LEFT JOIN tmp_anime_series_neighbor_nodes neighbor
      ON neighbor.anime_id = edge_row.target_anime_id
    GROUP BY node.anime_id, node.group_key_anime_id;

    SELECT COUNT(*)
    INTO v_changed
    FROM tmp_anime_series_nodes current_node
    INNER JOIN tmp_anime_series_next next_node
      ON next_node.anime_id = current_node.anime_id
    WHERE next_node.group_key_anime_id <> current_node.group_key_anime_id;

    TRUNCATE TABLE tmp_anime_series_nodes;

    INSERT INTO tmp_anime_series_nodes (anime_id, group_key_anime_id)
    SELECT anime_id, group_key_anime_id
    FROM tmp_anime_series_next;
  END WHILE;

  START TRANSACTION;

  -- 기존 ID와 관리자가 입력한 title은 같은 group key가 유지되는 동안 보존합니다.
  INSERT INTO anime_series (
    scope,
    group_key_anime_id,
    canonical_anime_id,
    member_count
  )
  SELECT
    p_scope,
    node.group_key_anime_id,
    node.group_key_anime_id,
    COUNT(*)
  FROM tmp_anime_series_nodes node
  GROUP BY node.group_key_anime_id
  ON DUPLICATE KEY UPDATE
    member_count = VALUES(member_count),
    updated_at = CURRENT_TIMESTAMP;

  DELETE member_row
  FROM anime_series_members member_row
  INNER JOIN anime_series series_row
    ON series_row.id = member_row.series_id
  WHERE series_row.scope = p_scope;

  INSERT INTO anime_series_members (
    series_id,
    anime_id,
    is_completion_required,
    completion_exclusion_reason
  )
  SELECT
    series_row.id,
    node.anime_id,
    CASE
      WHEN anime_row.format = 'MUSIC' THEN FALSE
      WHEN anime_row.status = 'NOT_YET_RELEASED' THEN FALSE
      WHEN anime_row.status = 'CANCELLED' THEN FALSE
      WHEN EXISTS (
        SELECT 1
        FROM anime_relations relation_row
        WHERE relation_row.target_anime_id = anime_row.id
          AND relation_row.relation_type IN ('SUMMARY', 'COMPILATION')
      ) THEN FALSE
      ELSE TRUE
    END,
    CASE
      WHEN anime_row.format = 'MUSIC' THEN 'MUSIC'
      WHEN anime_row.status = 'NOT_YET_RELEASED' THEN 'NOT_YET_RELEASED'
      WHEN anime_row.status = 'CANCELLED' THEN 'CANCELLED'
      WHEN EXISTS (
        SELECT 1
        FROM anime_relations relation_row
        WHERE relation_row.target_anime_id = anime_row.id
          AND relation_row.relation_type = 'SUMMARY'
      ) THEN 'RECAP'
      WHEN EXISTS (
        SELECT 1
        FROM anime_relations relation_row
        WHERE relation_row.target_anime_id = anime_row.id
          AND relation_row.relation_type = 'COMPILATION'
      ) THEN 'COMPILATION'
      ELSE NULL
    END
  FROM tmp_anime_series_nodes node
  INNER JOIN anime_series series_row
    ON series_row.scope = p_scope
    AND series_row.group_key_anime_id = node.group_key_anime_id
  INNER JOIN anime anime_row
    ON anime_row.id = node.anime_id;

  -- 분리된 그룹에서 기존 대표 작품이 더 이상 멤버가 아니면 그룹 키 작품으로 복구합니다.
  UPDATE anime_series series_row
  LEFT JOIN anime_series_members canonical_member
    ON canonical_member.series_id = series_row.id
    AND canonical_member.anime_id = series_row.canonical_anime_id
  SET series_row.canonical_anime_id = series_row.group_key_anime_id
  WHERE series_row.scope = p_scope
    AND canonical_member.anime_id IS NULL;

  -- relation 변경으로 사라지거나 다른 그룹에 합쳐진 이전 그룹을 제거합니다.
  DELETE series_row
  FROM anime_series series_row
  LEFT JOIN (
    SELECT DISTINCT group_key_anime_id
    FROM tmp_anime_series_nodes
  ) active_group
    ON active_group.group_key_anime_id = series_row.group_key_anime_id
  WHERE series_row.scope = p_scope
    AND active_group.group_key_anime_id IS NULL;

  COMMIT;

  DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_next;
  DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_neighbor_nodes;
  DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_nodes;
  DROP TEMPORARY TABLE IF EXISTS tmp_anime_series_edges;

  SET @@SESSION.SQL_SAFE_UPDATES = v_sql_safe_updates;
END$$

DELIMITER ;

-- 최초 구축 및 relation 동기화 이후 재계산할 때 실행합니다.
CALL rebuild_anime_series('mainline');
CALL rebuild_anime_series('franchise');

-- 결과 확인
SELECT
  series_row.id,
  series_row.scope,
  series_row.group_key_anime_id,
  series_row.canonical_anime_id,
  series_row.title,
  series_row.member_count
FROM anime_series series_row
ORDER BY series_row.scope, series_row.member_count DESC, series_row.id ASC;

-- 특정 애니의 시리즈 멤버 조회 예시입니다.
-- SET @anime_id = 123;
-- SET @scope = 'franchise';
--
-- SELECT
--   series_row.id AS series_id,
--   series_row.scope,
--   series_row.canonical_anime_id,
--   series_row.title AS series_title,
--   member_anime.id AS anime_id,
--   member_anime.anilist_id,
--   member_anime.title_romaji,
--   member_anime.title_english,
--   member_anime.title_native,
--   member_anime.season,
--   member_anime.season_year,
--   member_anime.format,
--   member_anime.cover_image_large,
--   member_anime.cover_image_extra_large
-- FROM anime_series_members requested_member
-- INNER JOIN anime_series series_row
--   ON series_row.id = requested_member.series_id
-- INNER JOIN anime_series_members series_member
--   ON series_member.series_id = series_row.id
-- INNER JOIN anime member_anime
--   ON member_anime.id = series_member.anime_id
-- WHERE requested_member.anime_id = @anime_id
--   AND series_row.scope = @scope
-- ORDER BY
--   member_anime.season_year IS NULL,
--   member_anime.season_year ASC,
--   CASE member_anime.season
--     WHEN 'WINTER' THEN 1
--     WHEN 'SPRING' THEN 2
--     WHEN 'SUMMER' THEN 3
--     WHEN 'FALL' THEN 4
--     ELSE 5
--   END,
--   member_anime.id ASC;
