-- DBMigrate 测试数据生成脚本
-- 目标: OceanBase yyhtenant > testdb
-- 连接: mysql -h10.10.180.227 -P2883 -uroot@yyhtenant#obcp -p'DBA@#1234' -A

-- =====================================================
-- 创建数据库
-- =====================================================
CREATE DATABASE IF NOT EXISTS testdb DEFAULT CHARSET=utf8mb4;
USE testdb;

-- =====================================================
-- 1. 用户表 (VARCHAR, DATETIME, 多索引, 自增)
-- =====================================================
DROP TABLE IF EXISTS t_users;
CREATE TABLE t_users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    email VARCHAR(128) DEFAULT NULL,
    age INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username(username),
    INDEX idx_status(status),
    INDEX idx_created(created_at)
) DEFAULT CHARSET=utf8mb4;

-- 2. 订单表 (DECIMAL, ENUM, 唯一键)
DROP TABLE IF EXISTS t_orders;
CREATE TABLE t_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    order_no VARCHAR(32) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status ENUM('pending','paid','shipped','done','cancel') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_order_no(order_no),
    INDEX idx_user_id(user_id)
) DEFAULT CHARSET=utf8mb4;

-- 3. 商品表 (TEXT, JSON)
DROP TABLE IF EXISTS t_products;
CREATE TABLE t_products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    tags JSON,
    stock INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name(name(20)),
    INDEX idx_price(price)
) DEFAULT CHARSET=utf8mb4;

-- 4. 订单明细 (关联查询)
DROP TABLE IF EXISTS t_order_items;
CREATE TABLE t_order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    INDEX idx_order_id(order_id),
    INDEX idx_product_id(product_id)
) DEFAULT CHARSET=utf8mb4;

-- 5. 日志表 (大 VARCHAR, 时间索引)
DROP TABLE IF EXISTS t_logs;
CREATE TABLE t_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    level VARCHAR(16) NOT NULL,
    module VARCHAR(64) DEFAULT NULL,
    message VARCHAR(4096),
    trace_id VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_level(level),
    INDEX idx_trace(trace_id),
    INDEX idx_created(created_at)
) DEFAULT CHARSET=utf8mb4;

-- 6. 配置表 (VARCHAR 主键, 无自增)
DROP TABLE IF EXISTS t_config;
CREATE TABLE t_config (
    cfg_key VARCHAR(128) PRIMARY KEY,
    cfg_value VARCHAR(2048),
    cfg_type VARCHAR(32) DEFAULT 'string',
    description VARCHAR(512),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4;

-- 7. 部门表 (自关联树)
DROP TABLE IF EXISTS t_departments;
CREATE TABLE t_departments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    parent_id BIGINT DEFAULT 0,
    name VARCHAR(128) NOT NULL,
    sort_order INT DEFAULT 0,
    INDEX idx_parent(parent_id)
) DEFAULT CHARSET=utf8mb4;

-- 8. 员工表 (多列组合索引)
DROP TABLE IF EXISTS t_employees;
CREATE TABLE t_employees (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    dept_id BIGINT DEFAULT 0,
    name VARCHAR(64) NOT NULL,
    gender CHAR(1) DEFAULT 'M',
    salary DECIMAL(10,2) DEFAULT 0.00,
    hire_date DATE,
    phone VARCHAR(20),
    INDEX idx_dept(dept_id),
    INDEX idx_gender(gender),
    INDEX idx_salary(salary),
    INDEX idx_hire(hire_date)
) DEFAULT CHARSET=utf8mb4;

-- 9. 标签表 (唯一键)
DROP TABLE IF EXISTS t_tags;
CREATE TABLE t_tags (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    color VARCHAR(16) DEFAULT '#000000',
    weight INT DEFAULT 0,
    UNIQUE KEY uk_name(name)
) DEFAULT CHARSET=utf8mb4;

-- 10. 统计表 (联合唯一键, 日期, 非自增主键)
DROP TABLE IF EXISTS t_stats;
CREATE TABLE t_stats (
    id BIGINT PRIMARY KEY,
    stat_date DATE NOT NULL,
    stat_type VARCHAR(32) NOT NULL,
    stat_value BIGINT DEFAULT 0,
    stat_value2 DECIMAL(18,6) DEFAULT 0,
    INDEX idx_date(stat_date),
    INDEX idx_type(stat_type),
    UNIQUE KEY uk_date_type(stat_date, stat_type)
) DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 验证
-- =====================================================
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='testdb' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;
