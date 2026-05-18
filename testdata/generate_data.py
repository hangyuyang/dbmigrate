#!/usr/bin/env python3
"""
DBMigrate 测试数据生成器
向 OceanBase yyhtenant > testdb 写入 10 张表约 7000 行测试数据

用法:
  python3 generate_data.py
"""
import subprocess, random, string, json
from datetime import datetime, timedelta

HOST = "10.10.180.227"
PORT = "2883"
USER = "root@yyhtenant#obcp"
PASSWORD = "DBA@#1234"
N = 1000

def run(sql, db="testdb"):
    cmd = ["mysql", f"-h{HOST}", f"-P{PORT}", f"-u{USER}", f"-p{PASSWORD}", "-A", db]
    r = subprocess.run(cmd, input=sql, capture_output=True, text=True, timeout=60)
    if r.returncode != 0 and "Warning" not in r.stderr and "Duplicate" not in r.stderr:
        print(f"  ERR: {r.stderr[:150]}")
    return r.returncode == 0

now = datetime.now()
statuses = ['pending','paid','shipped','done','cancel']
levels = ['DEBUG','INFO','WARN','ERROR']
modules = ['auth','order','product','payment','report','gateway','admin']
families = ['张','李','王','赵','陈','刘','杨','黄','周','吴']

def rs(n): return ''.join(random.choices(string.ascii_lowercase, k=n))
def rd(d=365): return (now - timedelta(days=random.randint(0,d))).strftime('%Y-%m-%d %H:%M:%S')

# 1. t_users
print("1. t_users...")
vals = [f"({i},'{rs(8)}','{rs(6)}@test.com',{random.randint(18,65)},{random.randint(0,1)},'{rd()}','{rd()}')" for i in range(1,N+1)]
run(f"INSERT INTO t_users VALUES {','.join(vals)};")
print(f"  ✓ {N}")

# 2. t_orders
print("2. t_orders...")
vals = [f"({i},{random.randint(1,N)},'ORD{now:%Y%m%d}{i:06d}',{round(random.uniform(10,9999),2)},'{random.choice(statuses)}','{rd()}')" for i in range(1,N+1)]
run(f"INSERT INTO t_orders VALUES {','.join(vals)};")
print(f"  ✓ {N}")

# 3. t_products
print("3. t_products...")
vals = []
for i in range(1,N+1):
    tag = json.dumps({"cat": random.choice(['book','elec','food','cloth','sport'])})
    vals.append(f"({i},'Product_{i:04d}',{round(random.uniform(1,999),2)},'Product desc {i}. ' * {random.randint(1,5)},'{tag}',{random.randint(0,5000)},'{rd()}')")
run(f"INSERT INTO t_products VALUES {','.join(vals)};")
print(f"  ✓ {N}")

# 4. t_order_items
print("4. t_order_items...")
vals = [f"({i},{random.randint(1,N)},{random.randint(1,N)},{random.randint(1,5)},{round(random.uniform(1,500),2)})" for i in range(1,N+1)]
run(f"INSERT INTO t_order_items VALUES {','.join(vals)};")
print(f"  ✓ {N}")

# 5. t_logs
print("5. t_logs...")
vals = [f"({i},'{random.choice(levels)}','{random.choice(modules)}','{rs(20)} ok {rs(30)}','trace-{random.randint(10000,99999)}','{rd(30)}')" for i in range(1,N+1)]
run(f"INSERT INTO t_logs VALUES {','.join(vals)};")
print(f"  ✓ {N}")

# 6. t_config
print("6. t_config...")
cfgs = ['app.name','app.version','db.host','db.port','cache.ttl','log.level','api.timeout','max.conn','session.timeout','upload.limit']
vals = [f"('{k}','{rs(16)}','string','Config for {k}','{rd()}')" for k in cfgs]
run(f"INSERT INTO t_config VALUES {','.join(vals)};")
print(f"  ✓ {len(cfgs)}")

# 7. t_departments
print("7. t_departments...")
depts = [('技术部',0),('产品部',0),('市场部',0),('人事部',0),('前端组',1),('后端组',1),('运维组',1),('设计组',2),('测试组',2),('销售组',3)]
vals = [f"({i+1},{p},'{n}',{i})" for i,(n,p) in enumerate(depts)]
run(f"INSERT INTO t_departments VALUES {','.join(vals)};")
print(f"  ✓ {len(depts)}")

# 8. t_employees
print("8. t_employees...")
vals = [f"({i},{random.randint(1,10)},'{random.choice(families)}{rs(2)}','{random.choice(['M','F'])}',{round(random.uniform(5000,50000),2)},'{rd(1500)[:10]}','138{random.randint(10000000,99999999)}')" for i in range(1,N+1)]
run(f"INSERT INTO t_employees VALUES {','.join(vals)};")
print(f"  ✓ {N}")

# 9. t_tags
print("9. t_tags...")
tnames = ['VIP','新用户','活跃','沉睡','高价值','批发','零售','企业','个人','试用','体验','付费','免费','黑名单','白名单','内部','外部','合作伙伴','供应商','分销']
vals = [f"({i+1},'{n}','#{random.randint(0,16777215):06x}',{random.randint(0,100)})" for i,n in enumerate(tnames)]
run(f"INSERT INTO t_tags VALUES {','.join(vals)};")
print(f"  ✓ {len(tnames)}")

# 10. t_stats
print("10. t_stats...")
types = ['pv','uv','orders','revenue','users','sessions']
used, vals = set(), []
for i in range(1, N+1):
    d = now - timedelta(days=random.randint(0,90))
    t = random.choice(types)
    k = (d.strftime('%Y-%m-%d'), t)
    if k not in used:
        used.add(k); vals.append(f"({i},'{k[0]}','{t}',{random.randint(0,1000000)},{round(random.uniform(0,99999),6)})")
run(f"INSERT INTO t_stats VALUES {','.join(vals)};")
print(f"  ✓ {len(vals)} (unique date+type)")

# =====================================================
print("\n=== 数据统计 ===")
run("SELECT TABLE_NAME, COUNT(*) AS rows FROM t_users GROUP BY TABLE_NAME \
UNION ALL SELECT 't_orders',COUNT(*) FROM t_orders \
UNION ALL SELECT 't_products',COUNT(*) FROM t_products \
UNION ALL SELECT 't_order_items',COUNT(*) FROM t_order_items \
UNION ALL SELECT 't_logs',COUNT(*) FROM t_logs \
UNION ALL SELECT 't_config',COUNT(*) FROM t_config \
UNION ALL SELECT 't_departments',COUNT(*) FROM t_departments \
UNION ALL SELECT 't_employees',COUNT(*) FROM t_employees \
UNION ALL SELECT 't_tags',COUNT(*) FROM t_tags \
UNION ALL SELECT 't_stats',COUNT(*) FROM t_stats;")
