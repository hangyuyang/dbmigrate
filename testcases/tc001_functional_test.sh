#!/bin/bash
# DBMigrate 测试用例 TC001 — 功能验证
# 验证 OB yyhtenant.testdb → PDB-X yyhdb 全量迁移

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."

echo "╔════════════════════════════════════════════════╗"
echo "║  TC001: OB testdb → PDB-X yyhdb 全量迁移验证 ║"
echo "╚════════════════════════════════════════════════╝"

DBMIGRATE_URL="http://10.10.180.219:9090"

# Step 1: 清理目标库
echo ""
echo "1. 清理目标库..."
mysql -h10.10.180.142 -P4886 -uroot -p'DBAdba@#123' -A -e "DROP DATABASE IF EXISTS yyhdb; CREATE DATABASE yyhdb;" 2>/dev/null
echo "   ✓ yyhdb 已重建"

# Step 2: 通过 API 创建迁移任务
echo ""
echo "2. 创建迁移任务..."
TASK_ID=$(curl -s -X POST "$DBMIGRATE_URL/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"TC001-功能验证",
    "mode":"schema+full",
    "source":{"type":"oceanbase","host":"10.10.180.227","port":2883,"user":"root@yyhtenant#obcp","password":"DBA@#1234","database":"testdb","cluster_name":"obcp","tenant_name":"yyhtenant"},
    "target":{"type":"polardbx","host":"10.10.180.142","port":4886,"user":"root","password":"DBAdba@#123","database":"yyhdb"},
    "chunk_size":10000,"parallel":4,"batch_size":500,"error_policy":"abort",
    "migrate_objects":{"tables":true,"views":false,"indexes":true},
    "enable_verify":true,"verify_method":"checksum"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "   Task ID: $TASK_ID"

# Step 3: 启动任务
echo ""
echo "3. 启动迁移..."
curl -s -X POST "$DBMIGRATE_URL/api/v1/tasks/$TASK_ID/start" > /dev/null

# Step 4: 等待完成
echo ""
echo "4. 等待迁移完成..."
for i in $(seq 1 30); do
    STATUS=$(curl -s "$DBMIGRATE_URL/api/v1/tasks/$TASK_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
    ROWS=$(curl -s "$DBMIGRATE_URL/api/v1/tasks/$TASK_ID" | python3 -c "import sys,json; p=json.load(sys.stdin)['progress']; print(p['done_rows'])")
    echo "   ${i}s: $STATUS ($ROWS rows)"
    if [ "$STATUS" = "COMPLETED" ] || [ "$STATUS" = "ERROR" ]; then break; fi
    sleep 2
done

# Step 5: 验证数据
echo ""
echo "5. 验证数据一致性..."
python3 "$PROJECT_DIR/testdata/verify_data.py" ob_testdb pdbx_yyhdb

echo ""
echo "════════════════════════════════════════════════"
echo "  TC001 完成!"
echo "════════════════════════════════════════════════"
