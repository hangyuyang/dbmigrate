# DBMigrate 测试用例

## 测试环境

| 环境 | 类型 | 连接信息 |
|------|------|----------|
| OB yyhtenant | 源端 | mysql -h10.10.180.227 -P2883 -uroot@yyhtenant#obcp -p'DBA@#1234' |
| OB tgdbc_backup | 源端 | mysql -h10.10.180.227 -P2883 -uroot@tgdbc_backup#obcp -p'Cljslrl0620!' |
| PDB-X | 目标端 | mysql -h10.10.180.142 -P4886 -uroot -p'DBAdba@#123' |
| DBMigrate | 迁移工具 | http://10.10.180.219:9090 |

## 测试用例清单

### TC001 — 功能验证：10表小规模全量迁移
- **源**: OB yyhtenant.testdb (10表, ~7000行)
- **目标**: PDB-X yyhdb
- **类型**: 全量迁移 (schema+full)
- **验证**: 行数一致
- **脚本**: `tc001_functional_test.sh`
- **状态**: ✅ 已验证 (6487行完全匹配)

### TC002 — 性能验证：22表大规模全量迁移
- **源**: OB tgdbc_backup.tgdbc (22 sysbench表, ~2.5GB)
- **目标**: PDB-X (新建库)
- **类型**: 全量迁移 (schema+full)
- **验证**: 行数一致 + spot checksum
- **脚本**: `tc002_performance_test.sh`
- **状态**: ⏳ 待验证

### TC003 — 全对象/全类型覆盖测试 ✅
- **源**: OB yyhtenant.testdb_comprehensive (14表+2视图, ~7500行)
- **目标**: PDB-X
- **覆盖**: 
  - 数值: TINYINT/SMALLINT/MEDIUMINT/INT/BIGINT/FLOAT/DOUBLE/DECIMAL(65,30)/BIT/BOOLEAN
  - 字符串: CHAR/VARCHAR(65535)/BINARY/VARBINARY/TEXT/MEDIUMTEXT/LONGTEXT/BLOB/TINYTEXT/TINYBLOB
  - 特殊: ENUM/SET/JSON/DATE/TIME/DATETIME(6)/TIMESTAMP(6)/YEAR
  - 分区: RANGE/HASH/LIST/KEY+子分区
  - 约束: UNIQUE/CHECK/NOT NULL/DEFAULT/ON UPDATE
  - 索引: BTREE/UNIQUE/复合/前缀
  - 视图: 简单视图+聚合视图
- **脚本**: `testdata/tc003_comprehensive_schema.sql`, `testdata/tc003_generate_data.py`

### TC004 — 增量同步验证
- **源**: OB yyhtenant.testdb
- **目标**: PDB-X
- **类型**: 全量+增量 (schema+full+cdc)
- **验证**: 全量完成后写入增量数据, 确认同步
- **状态**: 🔜 CDC功能开发后

### TC005 — TiDB 源端迁移
- **源**: TiDB (待准备环境)
- **目标**: PDB-X
- **状态**: 🔜 待 TiDB 环境

### TC006 — 大数据量压力测试
- **源**: OB tgdbc_backup (可放大至千万行)
- **目标**: PDB-X
- **状态**: 🔜

## 测试数据生成

```bash
# OB yyhtenant - 功能测试数据 (10表 ~7000行)
python3 testdata/generate_data.py

# OB yyhtenant - 仅建表
mysql ... < testdata/schema.sql

# 验证数据完整性
python3 testdata/verify_data.py
```
