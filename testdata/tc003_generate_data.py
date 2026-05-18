#!/usr/bin/env python3
"""
DBMigrate TC003 — OB 全对象/全类型覆盖测试数据生成
每表 ≤1000 行，覆盖复杂边界值
"""
import subprocess, random, string, json, uuid
from datetime import datetime, timedelta

HOST, PORT = "10.10.180.227", "2883"
USER, PASS = "root@yyhtenant#obcp", "DBA@#1234"
DB = "testdb_comprehensive"
now = datetime.now()

def run(sql):
    r = subprocess.run(["mysql", f"-h{HOST}", f"-P{PORT}", f"-u{USER}", f"-p{PASS}", "-A", DB],
                       input=sql, capture_output=True, text=True, timeout=60)
    ok = r.returncode == 0
    if not ok: print(f"  ERR: {r.stderr[:120]}")
    return ok

def bulk_insert(table, cols, rows, chunk=200):
    """批量插入，每 chunk 行一批"""
    total = 0
    for i in range(0, len(rows), chunk):
        batch = rows[i:i+chunk]
        sql = f"INSERT INTO {table} ({','.join(cols)}) VALUES {','.join(batch)};"
        if not run(sql): return False
        total += len(batch)
    return total

N = 500
print(f"Generating data to {DB}...\n")

# ============================================================
# 1. t_numeric_int — 整数边界值
# ============================================================
print("1. t_numeric_int")
rows = []
for i in range(1, N+1):
    rows.append(f"({i},{-128 + (i % 257)},{(i % 256)},{-32768 + i*60},{i*50},{(-8388608+i*16000)%8388608},{i*80},{(-2147483648+i*4000000)%2147483648},{i*300},{pow(-2,63)+i*8000000000000000},{i*700},{b'1' if i%2==0 else b'0'},{bin(i%256)[2:].zfill(8).encode()},{bin(i)[2:].zfill(64)[:64].encode()},{i%2==0})")
bulk_insert("t_numeric_int", ["id","col_tinyint","col_tinyint_u","col_smallint","col_smallint_u","col_mediumint","col_mediumint_u","col_int","col_int_u","col_bigint","col_bigint_u","col_bit1","col_bit8","col_bit64","col_bool"], rows)
print(f"  ✓ {N}")

# 2. t_numeric_float — 浮点边界值
print("2. t_numeric_float")
rows = []
for i in range(1, N+1):
    rows.append(f"({i},{random.uniform(-3e38,3e38):.6f},{random.uniform(0,3e38):.6f},{random.uniform(-1e308,1e308):.12f},{random.uniform(0,1e308):.12f},{round(random.uniform(-1e37,1e37),5)},{round(random.uniform(-9999999,9999999),2)},{round(random.uniform(-999999999,999999999),6)},{round(random.uniform(-1e30,1e30),30)},{round(random.uniform(-9999999,9999999),4)})")
bulk_insert("t_numeric_float", ["id","col_float","col_float_u","col_double","col_double_u","col_real","col_decimal_10_2","col_decimal_20_6","col_decimal_65_30","col_numeric_15_4"], rows)
print(f"  ✓ {N}")

# 3. t_string_char — 字符串边界值
print("3. t_string_char")
rows = []
for i in range(1, N+1):
    c1 = chr(random.randint(65,90)) if random.random()>.05 else ''
    c32 = (string.ascii_letters+string.digits)[:min(32,i)] + ' '*(32-min(32,i))
    c255 = ('测试' + str(i)).ljust(255,'-')[:255]
    v32 = 'user_'+str(i).zfill(5)
    v255 = f"description_{i:05d}_" + ''.join(random.choices(string.ascii_letters,k=200))
    v4k = 'data:' + ''.join(random.choices(string.ascii_letters+string.digits,k=4000))
    v16k = 'bulk:' + ''.join(random.choices(string.ascii_letters,k=16000))
    vmax = 'maxvarchar:' + ''.join(random.choices(string.ascii_letters,k=65000))
    rows.append(f"({i},'{c1}','{c32}','{c255}','{v32}','{v255}','{v4k}','{v16k}','{vmax}',UNHEX('{uuid.uuid4().hex[:32]}'),REPEAT(CHAR(65),200),REPEAT(CHAR(66),4000))")
bulk_insert("t_string_char", ["id","col_char","col_char_32","col_char_255","col_varchar_32","col_varchar_255","col_varchar_4096","col_varchar_16383","col_varchar_max","col_binary_16","col_varbinary_256","col_varbinary_4096"], rows)
print(f"  ✓ {N}")

# 4. t_string_text — TEXT/BLOB
print("4. t_string_text")
rows = []
for i in range(1, N+1):
    txt = f"Line {i}: " + "The quick brown fox jumps over the lazy dog. 敏捷的棕色狐狸跳过了懒狗。\n" * 3
    mtxt = txt * 50
    lt = txt * 200
    bdata = bytes(random.getrandbits(8) for _ in range(100)).hex()
    rows.append(f"({i},'{txt[:200]}','{txt[:1000]}','{mtxt[:8000]}','{lt[:12000]}',X'{bdata[:50]}',X'{bdata[:200]}',X'{bdata[:400]}',X'{bdata[:100]}')")
bulk_insert("t_string_text", ["id","col_tinytext","col_text","col_mediumtext","col_longtext","col_tinyblob","col_blob","col_mediumblob","col_longblob"], rows)
print(f"  ✓ {N}")

# 5. t_string_enum — ENUM/SET
print("5. t_string_enum")
rows = []
for i in range(1, N+1):
    rows.append(f"({i},{random.randint(1,4)},{random.randint(1,5)},{random.randint(1,4)},{random.randint(1,4)},'status_{i%5}')")
bulk_insert("t_string_enum", ["id","col_enum1","col_enum2","col_set1","col_set2","col_status"], rows)
print(f"  ✓ {N}")

# 6. t_datetime_all — 日期时间全覆盖
print("6. t_datetime_all")
rows = []
for i in range(1, N+1):
    dt = now - timedelta(days=random.randint(0,3650), hours=random.randint(0,23), minutes=random.randint(0,59), seconds=random.randint(0,59))
    ts = dt
    rows.append(f"({i},'{dt:%Y-%m-%d}','{dt:%H:%M:%S}','{dt:%H:%M:%S}.{i:06d}','{dt:%Y-%m-%d %H:%M:%S}','{dt:%Y-%m-%d %H:%M:%S}','{dt:%Y-%m-%d %H:%M:%S}.{i%1000:03d}','{dt:%Y-%m-%d %H:%M:%S}.{i:06d}','{ts:%Y-%m-%d %H:%M:%S}','{ts:%Y-%m-%d %H:%M:%S}','{ts:%Y-%m-%d %H:%M:%S}.{i%1000:03d}','{ts:%Y-%m-%d %H:%M:%S}.{i:06d}','{dt.year}','{now:%Y-%m-%d %H:%M:%S}','{now:%Y-%m-%d %H:%M:%S}','{now:%Y-%m-%d %H:%M:%S}')")
bulk_insert("t_datetime_all", ["id","col_date","col_time","col_time6","col_datetime","col_datetime0","col_datetime3","col_datetime6","col_timestamp","col_timestamp0","col_timestamp3","col_timestamp6","col_year","col_default_ts","col_default_dt","col_onupdate_ts"], rows)
print(f"  ✓ {N}")

# 7. t_json — JSON
print("7. t_json")
rows = []
for i in range(1, N+1):
    obj = json.dumps({"id":i,"name":f"item_{i}","tags":[f"tag_{i%5}",f"tag_{(i+1)%5}"],"meta":{"version":f"{i%10}.{i%100}","active":i%3==0}})
    arr = json.dumps([{"idx":j,"val":f"data_{i}_{j}"} for j in range(3)])
    nested = json.dumps({"user":{"id":i,"profile":{"age":20+i%50,"city":random.choice(['BJ','SH','GZ','SZ','CD','HK'])}},"orders":[f"ORD-{i:05d}-{j}" for j in range(3)]})
    rows.append(f"({i},'{obj}','{arr}','{obj}','{nested}','test_{i%10}')")
bulk_insert("t_json", ["id","col_json","col_json_array","col_json_object","col_json_nested","col_label"], rows)
print(f"  ✓ {N}")

# 8-11. 分区表
for tn, nrows in [("t_partition_range", 600), ("t_partition_hash", 500), ("t_partition_list", 400), ("t_partition_key_sub", 500)]:
    print(f"   {tn}")
    rows = []
    for i in range(1, nrows+1):
        if tn == "t_partition_range":
            d = now - timedelta(days=random.randint(0,1825))
            rows.append(f"({i},'{d:%Y-%m-%d}',{round(random.uniform(10,99999),2)},'{random.choice(['done','pending','cancel'])}')")
        elif tn == "t_partition_hash":
            rows.append(f"({i},{random.randint(1,10000)},'hash_data_{i}_{random.randint(1,100)}')")
        elif tn == "t_partition_list":
            region = random.choice(['bj','sh','hz','nj','gz','sz','cd','cq','heb','tj','dl','sy','hk','tw','mc','sg'])
            rows.append(f"({i},'{region}',{round(random.uniform(100,999999),2)})")
        elif tn == "t_partition_key_sub":
            d = now - timedelta(days=random.randint(0,365))
            rows.append(f"({i},{random.randint(1,10)},'{d:%Y-%m-%d}','payload_for_row_{i}')")
    bulk_insert(tn, ["id"] + [c for c in ["order_date","amount","status","user_id","data","region","revenue","tenant_id","created_at","payload"] if c in str(rows[0])], rows)
    print(f"    ✓ {nrows}")

# 12. t_index_types
print("12. t_index_types")
rows = []
for i in range(1, N+1):
    rows.append(f"({i},'btree_{i}','hash_{i}','unique_{i:05d}','com1_{i%100}',{i%1000},'prefix_data_for_testing_index_{i}',{i%10})")
bulk_insert("t_index_types", ["id","col_btree","col_hash","col_unique","col_composite1","col_composite2","col_prefix","col_filtered"], rows)
print(f"  ✓ {N}")

# 13. t_constraints
print("13. t_constraints")
rows = []
for i in range(1, N+1):
    rows.append(f"({i},'user{i:05d}@test.com','138{random.randint(10000000,99999999)}',{random.randint(0,100)},{round(random.uniform(0,100),2)},{random.randint(0,1)},'{now:%Y-%m-%d %H:%M:%S}','{now:%Y-%m-%d %H:%M:%S}')")
bulk_insert("t_constraints", ["id","email","phone","age","score","is_active","created_at","updated_at"], rows)
print(f"  ✓ {N}")

# 14. t_auto_inc_modes
print("14. t_auto_inc_modes")
rows = []
for i in range(1, N+1):
    rows.append(f"(NULL,NULL,'CODE-{i:06d}',{i})")
run(f"INSERT INTO t_auto_inc_modes (id,order_num,code,seq_no) VALUES {','.join(rows)};")
print(f"  ✓ {N}")

# ============================================================
# Verification
# ============================================================
print("\n=== 数据统计 ===")
run(f"""
SELECT 't_numeric_int',COUNT(1) FROM t_numeric_int UNION ALL
SELECT 't_numeric_float',COUNT(1) FROM t_numeric_float UNION ALL
SELECT 't_string_char',COUNT(1) FROM t_string_char UNION ALL
SELECT 't_string_text',COUNT(1) FROM t_string_text UNION ALL
SELECT 't_string_enum',COUNT(1) FROM t_string_enum UNION ALL
SELECT 't_datetime_all',COUNT(1) FROM t_datetime_all UNION ALL
SELECT 't_json',COUNT(1) FROM t_json UNION ALL
SELECT 't_partition_range',COUNT(1) FROM t_partition_range UNION ALL
SELECT 't_partition_hash',COUNT(1) FROM t_partition_hash UNION ALL
SELECT 't_partition_list',COUNT(1) FROM t_partition_list UNION ALL
SELECT 't_partition_key_sub',COUNT(1) FROM t_partition_key_sub UNION ALL
SELECT 't_index_types',COUNT(1) FROM t_index_types UNION ALL
SELECT 't_constraints',COUNT(1) FROM t_constraints UNION ALL
SELECT 't_auto_inc_modes',COUNT(1) FROM t_auto_inc_modes;
""")
print("\n✓ TC003 data generation complete!")
