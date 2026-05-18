-- ============================================================
-- Part 5: 分区表 (DEFAULT CHARSET + COMMENT before PARTITION BY)
-- ============================================================

-- 8. RANGE 分区表
DROP TABLE IF EXISTS t_partition_range;
CREATE TABLE t_partition_range (
    id BIGINT AUTO_INCREMENT,
    order_date DATE NOT NULL,
    amount DECIMAL(12,2),
    status VARCHAR(16),
    PRIMARY KEY (id, order_date)
) DEFAULT CHARSET=utf8mb4 COMMENT='RANGE分区'
  PARTITION BY RANGE (YEAR(order_date)) (
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 9. HASH 分区表
DROP TABLE IF EXISTS t_partition_hash;
CREATE TABLE t_partition_hash (
    id BIGINT AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    data VARCHAR(256),
    PRIMARY KEY (id, user_id)
) DEFAULT CHARSET=utf8mb4 COMMENT='HASH分区'
  PARTITION BY HASH(user_id) PARTITIONS 8;

-- 10. LIST 分区表
DROP TABLE IF EXISTS t_partition_list;
CREATE TABLE t_partition_list (
    id BIGINT AUTO_INCREMENT,
    region VARCHAR(16) NOT NULL,
    revenue DECIMAL(15,2),
    PRIMARY KEY (id, region)
) DEFAULT CHARSET=utf8mb4 COMMENT='LIST分区'
  PARTITION BY LIST COLUMNS(region) (
    PARTITION p_east VALUES IN ('bj','sh','hz','nj'),
    PARTITION p_south VALUES IN ('gz','sz','cd','cq'),
    PARTITION p_north VALUES IN ('heb','tj','dl','sy'),
    PARTITION p_other VALUES IN ('hk','tw','mc','sg')
);

-- 11. KEY 分区 + 子分区
DROP TABLE IF EXISTS t_partition_key_sub;
CREATE TABLE t_partition_key_sub (
    id BIGINT AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    created_at DATE NOT NULL,
    payload TEXT,
    PRIMARY KEY (id, tenant_id, created_at)
) DEFAULT CHARSET=utf8mb4 COMMENT='KEY分区+子分区'
  PARTITION BY KEY(tenant_id)
  SUBPARTITION BY HASH(MONTH(created_at)) SUBPARTITIONS 4
  PARTITIONS 4;
