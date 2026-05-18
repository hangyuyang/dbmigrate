-- ============================================================
-- DBMigrate TC003 — OceanBase 全对象/全类型覆盖测试
-- 租户: yyhtenant  数据库: testdb_comprehensive
-- 每表 ≤1000 行，覆盖完整数据类型和 DDL 对象
-- ============================================================

CREATE DATABASE IF NOT EXISTS testdb_comprehensive DEFAULT CHARSET=utf8mb4;
USE testdb_comprehensive;

-- ============================================================
-- Part 1: 数值类型覆盖
-- ============================================================

-- 1. 整数类型全集
DROP TABLE IF EXISTS t_numeric_int;
CREATE TABLE t_numeric_int (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    col_tinyint TINYINT COMMENT '范围: -128~127',
    col_tinyint_u TINYINT UNSIGNED COMMENT '0~255',
    col_smallint SMALLINT COMMENT '-32768~32767',
    col_smallint_u SMALLINT UNSIGNED,
    col_mediumint MEDIUMINT,
    col_mediumint_u MEDIUMINT UNSIGNED,
    col_int INT,
    col_int_u INT UNSIGNED,
    col_bigint BIGINT,
    col_bigint_u BIGINT UNSIGNED,
    col_bit1 BIT(1),
    col_bit8 BIT(8),
    col_bit64 BIT(64),
    col_bool BOOLEAN,
    INDEX idx_tinyint(col_tinyint),
    INDEX idx_bigint(col_bigint)
) DEFAULT CHARSET=utf8mb4 COMMENT='整数类型全集';

-- 2. 浮点/定点类型全集
DROP TABLE IF EXISTS t_numeric_float;
CREATE TABLE t_numeric_float (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    col_float FLOAT COMMENT '单精度',
    col_float_u FLOAT UNSIGNED,
    col_double DOUBLE,
    col_double_u DOUBLE UNSIGNED,
    col_real REAL,
    col_decimal_10_2 DECIMAL(10,2),
    col_decimal_20_6 DECIMAL(20,6),
    col_decimal_65_30 DECIMAL(65,30) COMMENT 'OB max precision 65',
    col_numeric_15_4 NUMERIC(15,4),
    INDEX idx_decimal(col_decimal_10_2)
) DEFAULT CHARSET=utf8mb4 COMMENT='浮点/定点类型全集';

-- ============================================================
-- Part 2: 字符串类型覆盖
-- ============================================================

-- 3. CHAR/VARCHAR 全集（含超长 VARCHAR）
DROP TABLE IF EXISTS t_string_char;
CREATE TABLE t_string_char (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    col_char CHAR(1),
    col_char_32 CHAR(32),
    col_char_255 CHAR(255),
    col_varchar_32 VARCHAR(32),
    col_varchar_255 VARCHAR(255),
    col_varchar_4096 VARCHAR(4096),
    col_varchar_16383 VARCHAR(16383),
    col_varchar_max VARCHAR(65535) COMMENT 'PDB-X max VARCHAR',
    col_binary_16 BINARY(16),
    col_varbinary_256 VARBINARY(256),
    col_varbinary_4096 VARBINARY(4096),
    UNIQUE KEY uk_char32(col_char_32),
    INDEX idx_varchar(col_varchar_255)
) DEFAULT CHARSET=utf8mb4 COMMENT='CHAR/VARCHAR/BINARY全集';

-- 4. TEXT/BLOB 全集
DROP TABLE IF EXISTS t_string_text;
CREATE TABLE t_string_text (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    col_tinytext TINYTEXT,
    col_text TEXT,
    col_mediumtext MEDIUMTEXT,
    col_longtext LONGTEXT,
    col_tinyblob TINYBLOB,
    col_blob BLOB,
    col_mediumblob MEDIUMBLOB,
    col_longblob LONGBLOB,
    INDEX idx_id(id)
) DEFAULT CHARSET=utf8mb4 COMMENT='TEXT/BLOB全集';

-- 5. ENUM/SET 类型
DROP TABLE IF EXISTS t_string_enum;
CREATE TABLE t_string_enum (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    col_enum1 ENUM('active','inactive','pending','deleted'),
    col_enum2 ENUM('small','medium','large','xlarge','xxlarge'),
    col_set1 SET('read','write','delete','admin'),
    col_set2 SET('morning','afternoon','evening','night'),
    col_status VARCHAR(32) DEFAULT 'normal',
    INDEX idx_enum(col_enum1)
) DEFAULT CHARSET=utf8mb4 COMMENT='ENUM/SET全集';

-- ============================================================
-- Part 3: 日期时间类型覆盖
-- ============================================================

-- 6. 日期时间类型全集
DROP TABLE IF EXISTS t_datetime_all;
CREATE TABLE t_datetime_all (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    col_date DATE,
    col_time TIME,
    col_time6 TIME(6),
    col_datetime DATETIME,
    col_datetime0 DATETIME(0),
    col_datetime3 DATETIME(3),
    col_datetime6 DATETIME(6),
    col_timestamp TIMESTAMP NULL DEFAULT NULL,
    col_timestamp0 TIMESTAMP(0) NULL DEFAULT NULL,
    col_timestamp3 TIMESTAMP(3) NULL DEFAULT NULL,
    col_timestamp6 TIMESTAMP(6) NULL DEFAULT NULL,
    col_year YEAR,
    col_default_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    col_default_dt DATETIME DEFAULT CURRENT_TIMESTAMP,
    col_onupdate_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date(col_date),
    INDEX idx_datetime(col_datetime),
    INDEX idx_timestamp(col_timestamp)
) DEFAULT CHARSET=utf8mb4 COMMENT='日期时间类型全集';

-- ============================================================
-- Part 4: JSON 与特殊类型
-- ============================================================

-- 7. JSON 类型
DROP TABLE IF EXISTS t_json;
CREATE TABLE t_json (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    col_json JSON,
    col_json_array JSON COMMENT '数组格式',
    col_json_object JSON COMMENT '对象格式',
    col_json_nested JSON COMMENT '嵌套结构',
    col_label VARCHAR(64),
    INDEX idx_label(col_label)
) DEFAULT CHARSET=utf8mb4 COMMENT='JSON类型';

-- ============================================================
-- Part 5: 分区表
-- ============================================================

-- 8. RANGE 分区表
DROP TABLE IF EXISTS t_partition_range;
CREATE TABLE t_partition_range (
    id BIGINT AUTO_INCREMENT,
    order_date DATE NOT NULL,
    amount DECIMAL(12,2),
    status VARCHAR(16),
    PRIMARY KEY (id, order_date)
) PARTITION BY RANGE (YEAR(order_date)) (
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION p_future VALUES LESS THAN MAXVALUE
) DEFAULT CHARSET=utf8mb4 COMMENT='RANGE分区';

-- 9. HASH 分区表
DROP TABLE IF EXISTS t_partition_hash;
CREATE TABLE t_partition_hash (
    id BIGINT AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    data VARCHAR(256),
    PRIMARY KEY (id, user_id)
) PARTITION BY HASH(user_id) PARTITIONS 8
  DEFAULT CHARSET=utf8mb4 COMMENT='HASH分区';

-- 10. LIST 分区表
DROP TABLE IF EXISTS t_partition_list;
CREATE TABLE t_partition_list (
    id BIGINT AUTO_INCREMENT,
    region VARCHAR(16) NOT NULL,
    revenue DECIMAL(15,2),
    PRIMARY KEY (id, region)
) PARTITION BY LIST COLUMNS(region) (
    PARTITION p_east VALUES IN ('bj','sh','hz','nj'),
    PARTITION p_south VALUES IN ('gz','sz','cd','cq'),
    PARTITION p_north VALUES IN ('heb','tj','dl','sy'),
    PARTITION p_other VALUES IN ('hk','tw','mc','sg')
) DEFAULT CHARSET=utf8mb4 COMMENT='LIST分区';

-- 11. KEY 分区 + 子分区
DROP TABLE IF EXISTS t_partition_key_sub;
CREATE TABLE t_partition_key_sub (
    id BIGINT AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    created_at DATE NOT NULL,
    payload TEXT,
    PRIMARY KEY (id, tenant_id, created_at)
) PARTITION BY KEY(tenant_id)
  SUBPARTITION BY HASH(MONTH(created_at)) SUBPARTITIONS 4
  PARTITIONS 4
  DEFAULT CHARSET=utf8mb4 COMMENT='KEY分区+子分区';

-- ============================================================
-- Part 6: 索引类型
-- ============================================================

-- 12. 多类型索引
DROP TABLE IF EXISTS t_index_types;
CREATE TABLE t_index_types (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    col_btree VARCHAR(128),
    col_hash VARCHAR(128),
    col_unique VARCHAR(64),
    col_composite1 VARCHAR(32),
    col_composite2 INT,
    col_prefix VARCHAR(256),
    col_filtered INT DEFAULT 0,
    UNIQUE KEY uk_unique(col_unique),
    INDEX idx_btree(col_btree),
    INDEX idx_composite(col_composite1, col_composite2),
    INDEX idx_prefix(col_prefix(20)),
    INDEX idx_filtered(col_filtered)
) DEFAULT CHARSET=utf8mb4 COMMENT='多类型索引';

-- ============================================================
-- Part 7: 约束类型
-- ============================================================

-- 13. 各种约束
DROP TABLE IF EXISTS t_constraints;
CREATE TABLE t_constraints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(128) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    age INT DEFAULT 18,
    score DECIMAL(5,2) DEFAULT 0.00,
    is_active TINYINT DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_email(email),
    CONSTRAINT chk_age CHECK (age >= 0 AND age <= 150),
    CONSTRAINT chk_score CHECK (score >= 0 AND score <= 100),
    INDEX idx_active(is_active)
) DEFAULT CHARSET=utf8mb4 COMMENT='约束类型';

-- ============================================================
-- Part 8: 自增/序列
-- ============================================================

-- 14. 不同自增模式
DROP TABLE IF EXISTS t_auto_inc_modes;
CREATE TABLE t_auto_inc_modes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_num BIGINT NOT NULL DEFAULT 0,
    code VARCHAR(32) NOT NULL,
    seq_no INT DEFAULT 0,
    UNIQUE KEY uk_order(order_num),
    INDEX idx_code(code)
) DEFAULT CHARSET=utf8mb4 COMMENT='自增模式';

-- ============================================================
-- Part 9: 视图
-- ============================================================

-- 15. 视图（基于用户表）
DROP VIEW IF EXISTS v_active_users;
CREATE VIEW v_active_users AS
  SELECT id, email, age, score, created_at
  FROM t_constraints
  WHERE is_active = 1 AND age > 0;

-- 16. 聚合视图
DROP VIEW IF EXISTS v_score_stats;
CREATE VIEW v_score_stats AS
  SELECT 
    CASE WHEN age < 25 THEN '青年' WHEN age < 45 THEN '中年' ELSE '老年' END AS age_group,
    COUNT(*) AS cnt,
    ROUND(AVG(score), 2) AS avg_score
  FROM t_constraints
  WHERE age > 0
  GROUP BY age_group;

-- ============================================================
-- 数据生成验证
-- ============================================================
SELECT 'Tables:' AS info, COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA='testdb_comprehensive' AND TABLE_TYPE='BASE TABLE'
UNION ALL
SELECT 'Views:', COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA='testdb_comprehensive';
