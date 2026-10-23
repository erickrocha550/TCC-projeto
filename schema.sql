CREATE DATABASE IF NOT EXISTS ecofila
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ecofila;

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(100) PRIMARY KEY,
  category VARCHAR(40) NOT NULL,
  category_name VARCHAR(120) NOT NULL,
  category_icon VARCHAR(20) NOT NULL,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(1500) NOT NULL,
  neighborhood VARCHAR(120) NOT NULL,
  address VARCHAR(240) NOT NULL,
  urgency VARCHAR(20) NOT NULL,
  status VARCHAR(40) NOT NULL,
  supports INT UNSIGNED NOT NULL DEFAULT 0,
  report_date VARCHAR(80) NOT NULL,
  lat DOUBLE NOT NULL,
  lng DOUBLE NOT NULL,
  image MEDIUMTEXT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_reports_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_supporters (
  report_id VARCHAR(100) NOT NULL,
  client_id VARCHAR(100) NOT NULL,
  PRIMARY KEY (report_id, client_id),
  CONSTRAINT fk_support_report
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_metadata (
  meta_key VARCHAR(100) PRIMARY KEY,
  meta_value VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;