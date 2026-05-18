#!/usr/bin/env python3
"""
DBMigrate 测试验证脚本
对比源端与目标端数据行数，输出差异报告
"""
import subprocess, sys, json

# =====================================================
# 配置
# =====================================================
SOURCES = {
    "ob_testdb": {
        "host": "10.10.180.227", "port": 2883,
        "user": "root@yyhtenant#obcp", "pass": "DBA@#1234",
        "db": "testdb"
    },
    "ob_tgdbc": {
        "host": "10.10.180.227", "port": 2883,
        "user": "root@tgdbc_backup#obcp", "pass": "Cljslrl0620!",
        "db": "tgdbc"
    }
}

TARGETS = {
    "pdbx_yyhdb": {
        "host": "10.10.180.142", "port": 4886,
        "user": "root", "pass": "DBAdba@#123",
        "db": "yyhdb"
    }
}

def run_mysql(cfg, sql):
    cmd = ["mysql", "-h", cfg["host"], "-P", str(cfg["port"]),
           "-u", cfg["user"], f"-p{cfg['pass']}", "-A", "-N", "-B"]
    r = subprocess.run(cmd, input=sql, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        print(f"  ERR: {r.stderr[:200]}")
        return None
    return r.stdout.strip().split('\n')

def count_rows(cfg, db):
    """统计数据库所有表的行数"""
    # Get tables first
    tables = run_mysql(cfg, f"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='{db}' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
    if not tables: return {}

    counts = {}
    sql = " UNION ALL ".join([f"SELECT '{t}', COUNT(*) FROM `{db}`.`{t}`" for t in tables])
    rows = run_mysql(cfg, sql)
    if rows:
        for line in rows:
            parts = line.split('\t')
            if len(parts) == 2:
                counts[parts[0]] = int(parts[1])
    return counts

def verify(source_key, target_key):
    """验证源端与目标端数据一致性"""
    src = SOURCES[source_key]
    tgt = TARGETS[target_key]

    print(f"\n{'='*60}")
    print(f"验证 {source_key} → {target_key}")
    print(f"{'='*60}")

    src_counts = count_rows(src, src["db"])
    tgt_counts = count_rows(tgt, tgt["db"])

    if not src_counts:
        print("❌ 源端无数据！")
        return False
    if not tgt_counts:
        print("❌ 目标端无数据！")
        return False

    all_ok = True
    total_src = 0
    total_tgt = 0

    for table in sorted(src_counts.keys()):
        s = src_counts.get(table, 0)
        t = tgt_counts.get(table, 0)
        total_src += s
        total_tgt += t
        ok = s == t
        if not ok: all_ok = False
        print(f"  {'✅' if ok else '❌'} {table:30s} src={s:>8d}  tgt={t:>8d}  {'OK' if ok else 'MISMATCH'}")

    print(f"  {'─'*70}")
    print(f"  📊 总计: src={total_src:,d}  tgt={total_tgt:,d}  {'✅ 一致' if total_src==total_tgt else '❌ 不一致'}")

    return all_ok

if __name__ == "__main__":
    if len(sys.argv) > 1:
        source_key = sys.argv[1]
        target_key = sys.argv[2] if len(sys.argv) > 2 else "pdbx_yyhdb"
        ok = verify(source_key, target_key)
    else:
        # 默认: 验证 OB testdb → PDB-X yyhdb
        ok = verify("ob_testdb", "pdbx_yyhdb")

    sys.exit(0 if ok else 1)
