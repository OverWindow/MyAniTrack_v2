CREATE TABLE maintenance_settings (
  id TINYINT UNSIGNED NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  title_ko VARCHAR(120) NOT NULL,
  title_en VARCHAR(120) NOT NULL,
  message_ko VARCHAR(1000) NOT NULL,
  message_en VARCHAR(1000) NOT NULL,
  updated_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_maintenance_settings_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
);

INSERT INTO maintenance_settings (
  id,
  enabled,
  title_ko,
  title_en,
  message_ko,
  message_en
) VALUES (
  1,
  FALSE,
  '서비스 점검 중입니다',
  'We''ll be back soon',
  '더 안정적인 서비스를 위해 잠시 점검하고 있어요. 잠시 후 다시 이용해주세요.',
  'MyAniTrack is temporarily unavailable while we perform maintenance. Please try again shortly.'
);
