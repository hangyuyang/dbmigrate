import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTask, testConnection } from '../api/client'

const STEPS = ['选择数据库', '连接配置', '迁移阶段', '迁移对象', '性能配置']

const DB_CAPABILITY = {
  sources: [{ key:'oceanbase', name:'OceanBase', icon:'🌊', desc:'OB 3.x / 4.x MySQL 模式' }],
  targets: [{ key:'polardbx', name:'PolarDB-X', icon:'☁️', desc:'集中式 / 分布式' }]
}

const DEFAULT_SRC = { host:'', port:2883, user:'root', password:'', cluster_name:'', tenant_name:'', database:'' }
const DEFAULT_TGT = { host:'', port:4886, user:'root', password:'' }

export default function TaskCreate() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [srcType, setSrcType] = useState('oceanbase')
  const [tgtType, setTgtType] = useState('polardbx')

  const [source, setSource] = useState({...DEFAULT_SRC})
  const [target, setTarget] = useState({...DEFAULT_TGT})
  const [testingSrc, setTestingSrc] = useState(false)
  const [testingTgt, setTestingTgt] = useState(false)
  const [srcOK, setSrcOK] = useState(null)
  const [tgtOK, setTgtOK] = useState(null)

  const [migrateSchema, setMigrateSchema] = useState(true)
  const [migrateFull, setMigrateFull] = useState(true)
  const [migrateCDC, setMigrateCDC] = useState(false)
  const [enableVerify, setEnableVerify] = useState(true)

  const [selectedDB, setSelectedDB] = useState('')
  const [includeTables, setIncludeTables] = useState('')
  const [excludeTables, setExcludeTables] = useState('')
  const [objects, setObjects] = useState({ tables:true, views:false, indexes:true })

  const [taskCount, setTaskCount] = useState(1)
  const [taskCPU, setTaskCPU] = useState(2)
  const [taskMem, setTaskMem] = useState(4096)
  const [parallel, setParallel] = useState(4)
  const [chunkSize, setChunkSize] = useState(10000)
  const [batchSize, setBatchSize] = useState(500)
  const [errorPolicy, setErrorPolicy] = useState('abort')

  const update = (setter, k, v) => setter(p => ({...p, [k]:v}))

  // 解析连接串
  const [cmdStrSrc, setCmdStrSrc] = useState('')
  const [cmdStrTgt, setCmdStrTgt] = useState('')
  const [showCmdSrc, setShowCmdSrc] = useState(false)
  const [showCmdTgt, setShowCmdTgt] = useState(false)

  function parseConnStr(str) {
    const result = { host:'', port:'', user:'root', password:'', cluster_name:'', tenant_name:'' }
    if (!str.trim()) return result

    // 匹配 -h / --host
    const h = str.match(/-h\s*(\S+)/)
    if (h) result.host = h[1]

    // 匹配 -P / --port
    const p = str.match(/-P\s*(\d+)/)
    if (p) result.port = p[1]

    // 匹配 -u / --user
    const u = str.match(/-u\s*(\S+)/)
    if (u) {
      const user = u[1]
      result.user = user
      // 解析 OB 格式: root@tenant#cluster
      const ob = user.match(/^(\w+)@(\w+)#(\w+)$/)
      if (ob) {
        result.user = ob[1]
        result.tenant_name = ob[2]
        result.cluster_name = ob[3]
      }
    }

    // 匹配 -p / --password (可能紧贴或空格分隔)
    const pw = str.match(/-p\s*(\S+)/)
    if (pw && pw[1].charAt(0) !== '-') result.password = pw[1]

    return result
  }

  function handleParseSrc() {
    const r = parseConnStr(cmdStrSrc)
    setSource(p => ({...p, host:r.host||p.host, port:parseInt(r.port)||p.port, user:r.user||p.user, password:r.password||p.password, tenant_name:r.tenant_name||p.tenant_name, cluster_name:r.cluster_name||p.cluster_name}))
    setCmdStrSrc('')
  }
  function handleParseTgt() {
    const r = parseConnStr(cmdStrTgt)
    setTarget(p => ({...p, host:r.host||p.host, port:parseInt(r.port)||p.port, user:r.user||p.user, password:r.password||p.password}))
    setCmdStrTgt('')
  }

  async function handleTest(dir) {
    const isSrc = dir === 'src'
    const s = isSrc ? setTestingSrc : setTestingTgt
    const r = isSrc ? setSrcOK : setTgtOK
    const cfg = isSrc ? {...source} : {...target, type: tgtType}
    if (cfg.cluster_name && cfg.tenant_name) cfg.user = `root@${cfg.tenant_name}#${cfg.cluster_name}`
    s(true); r(null)
    try { r(await testConnection(cfg)) }
    catch(e) { r({success:false, error:e.message}) }
    finally { s(false) }
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const src = {...source, type: srcType}
      const tgt = {...target, type: tgtType}
      if (src.cluster_name && src.tenant_name) src.user = `root@${src.tenant_name}#${src.cluster_name}`
      const mode = [migrateSchema&&'schema',migrateFull&&'full',migrateCDC&&'cdc'].filter(Boolean).join('+')
      await createTask({
        name: `OB → PDB-X`,
        mode, source: src, target: tgt,
        filter: { include_tables: includeTables?includeTables.split(/[,\s]+/).filter(Boolean):[], exclude_tables: excludeTables?excludeTables.split(/[,\s]+/).filter(Boolean):[], include_schemas: selectedDB?[selectedDB]:[] },
        migrate_objects: objects,
        chunk_size: chunkSize, parallel, batch_size: batchSize,
        error_policy: errorPolicy, enable_verify: enableVerify, verify_method: 'checksum',
      })
      navigate('/')
    } catch(e) { alert('创建失败: '+e.message) }
    finally { setSubmitting(false) }
  }

  const modeLabel = [migrateSchema&&'结构',migrateFull&&'全量',migrateCDC&&'增量'].filter(Boolean).join('+')
  const canNext2 = srcType && tgtType
  const canNext3 = srcOK?.success && tgtOK?.success
  const canNext4 = migrateSchema || migrateFull || migrateCDC

  // Step indicator
  const StepBar = () => (
    <div className="step-indicator">
      {STEPS.map((s,i) => (
        <div key={i} onClick={() => i < step && setStep(i)} className={`step-item ${i === step ? 'active' : i < step ? 'done' : ''}`}>
          <div className="step-num">{i < step ? '✓' : i+1}</div>
          <div>{s}</div>
        </div>
      ))}
    </div>
  )

  // ============ STEP 1 ============
  if (step === 0) return <>
    <div className="header"><h1>创建迁移任务</h1></div>
    <StepBar/>
    <div className="card" style={{textAlign:'center',padding:'32px'}}>
      <div style={{fontSize:13,color:'var(--text-dim)',marginBottom:16}}>当前支持：OceanBase → PolarDB-X</div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:24}}>
        {DB_CAPABILITY.sources.map(db => (
          <div key={db.key} onClick={()=>setSrcType(db.key)} style={{
            width:160,padding:'24px 16px',borderRadius:12,cursor:'pointer',textAlign:'center',
            background: 'var(--primary-light)', border: '2px solid var(--primary)',
            boxShadow: '0 2px 8px rgba(37,99,235,0.12)'
          }}>
            <div style={{fontSize:36}}>{db.icon}</div>
            <div style={{fontSize:16,fontWeight:700,marginTop:8,color:'var(--primary)'}}>{db.name}</div>
            <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4}}>{db.desc}</div>
          </div>
        ))}
        <div style={{fontSize:28,color:'var(--text-dim)',fontWeight:300}}>→</div>
        {DB_CAPABILITY.targets.map(db => (
          <div key={db.key} onClick={()=>setTgtType(db.key)} style={{
            width:160,padding:'24px 16px',borderRadius:12,cursor:'pointer',textAlign:'center',
            background: 'var(--success-light)', border: '2px solid var(--success)',
            boxShadow: '0 2px 8px rgba(22,163,74,0.12)'
          }}>
            <div style={{fontSize:36}}>{db.icon}</div>
            <div style={{fontSize:16,fontWeight:700,marginTop:8,color:'var(--success)'}}>{db.name}</div>
            <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4}}>{db.desc}</div>
          </div>
        ))}
      </div>
    </div>
    <div style={{display:'flex',justifyContent:'flex-end'}}>
      <button className="btn btn-primary" onClick={()=>setStep(1)}>下一步 →</button>
    </div>
  </>

  // ============ STEP 2 ============
  if (step === 1) return <>
    <div className="header"><h1>配置连接信息</h1></div>
    <StepBar/>

    <div className="form-row">

      <div className="card" style={{flex:1}}>
        <div className="card-header">
          <span>🌊 源端 — OceanBase</span>
          <button className="btn btn-outline btn-sm" onClick={()=>handleTest('src')} disabled={testingSrc}>
            {testingSrc?'测试中...':'🔗 测试连接'}
          </button>
        </div>

        {/* 源端解析连接串 */}
        <div style={{background:'var(--primary-light)',border:'1px dashed var(--primary)',borderRadius:6,padding:'10px 14px',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:showCmdSrc?8:0,cursor:'pointer',fontSize:12}} onClick={()=>setShowCmdSrc(!showCmdSrc)}>
            <span style={{fontWeight:600,color:'var(--primary)'}}>📋 粘贴命令解析 {showCmdSrc ? '▲' : '▼'}</span>
          </div>
          {showCmdSrc && (
            <div style={{display:'flex',gap:6}}>
              <input value={cmdStrSrc} onChange={e=>setCmdStrSrc(e.target.value)} 
                placeholder='mysql -h10.10.180.227 -P2883 -uroot@yyhtenant#obcp -pDBA@#1234'
                style={{flex:1,fontFamily:'SF Mono,monospace',fontSize:11,padding:'6px 8px'}}/>
              <button className="btn btn-primary btn-sm" onClick={handleParseSrc} disabled={!cmdStrSrc.trim()}>解析</button>
            </div>
          )}
        </div>

        <div className="form-group"><label>IP 地址</label><input placeholder="10.10.180.227" value={source.host} onChange={e=>update(setSource,'host',e.target.value)}/></div>
        <div className="form-group"><label>端口</label><input type="number" value={source.port} onChange={e=>update(setSource,'port',parseInt(e.target.value)||2883)}/></div>
        <div className="form-row">
          <div className="form-group"><label>集群名称</label><input placeholder="obcp" value={source.cluster_name} onChange={e=>update(setSource,'cluster_name',e.target.value)}/></div>
          <div className="form-group"><label>租户名称</label><input placeholder="yyhtenant" value={source.tenant_name} onChange={e=>update(setSource,'tenant_name',e.target.value)}/></div>
        </div>
        <div className="form-group"><label>账号</label><input placeholder={source.cluster_name&&source.tenant_name?'自动生成 root@租户#集群':'root'} value={source.user} onChange={e=>update(setSource,'user',e.target.value)}/></div>
        <div className="form-group"><label>密码</label><input type="password" value={source.password} onChange={e=>update(setSource,'password',e.target.value)}/></div>
        {source.cluster_name && source.tenant_name && (
          <div className="help-text" style={{color:'var(--primary)'}}>将连接为: root@{source.tenant_name}#{source.cluster_name}</div>
        )}
        {srcOK && (
          <div style={{marginTop:12,padding:'10px 14px',borderRadius:6,fontSize:13,
            background:srcOK.success?'var(--success-light)':'var(--error-light)',
            border:`1px solid ${srcOK.success?'var(--success)':'var(--error)'}`}}>
            {srcOK.success ? <>✅ 连接成功 — {srcOK.version} — {srcOK.latency_ms}ms</> : <>❌ {srcOK.error}</>}
          </div>
        )}
      </div>
      <div className="card" style={{flex:1}}>
        <div className="card-header">
          <span>☁️ 目标端 — PolarDB-X</span>
          <button className="btn btn-outline btn-sm" onClick={()=>handleTest('tgt')} disabled={testingTgt}>
            {testingTgt?'测试中...':'🔗 测试连接'}
          </button>
        </div>

        {/* 目标端解析连接串 */}
        <div style={{background:'var(--success-light)',border:'1px dashed var(--success)',borderRadius:6,padding:'10px 14px',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:showCmdTgt?8:0,cursor:'pointer',fontSize:12}} onClick={()=>setShowCmdTgt(!showCmdTgt)}>
            <span style={{fontWeight:600,color:'var(--success)'}}>📋 粘贴命令解析 {showCmdTgt ? '▲' : '▼'}</span>
          </div>
          {showCmdTgt && (
            <div style={{display:'flex',gap:6}}>
              <input value={cmdStrTgt} onChange={e=>setCmdStrTgt(e.target.value)} 
                placeholder='mysql -h10.10.180.142 -P4886 -uroot -pDBAdba@#123'
                style={{flex:1,fontFamily:'SF Mono,monospace',fontSize:11,padding:'6px 8px'}}/>
              <button className="btn btn-primary btn-sm" onClick={handleParseTgt} disabled={!cmdStrTgt.trim()}>解析</button>
            </div>
          )}
        </div>

        <div className="form-group"><label>IP 地址</label><input placeholder="10.10.180.142" value={target.host} onChange={e=>update(setTarget,'host',e.target.value)}/></div>
        <div className="form-group"><label>端口</label><input type="number" value={target.port} onChange={e=>update(setTarget,'port',parseInt(e.target.value)||4886)}/></div>
        <div className="form-group"><label>账号</label><input placeholder="root" value={target.user} onChange={e=>update(setTarget,'user',e.target.value)}/></div>
        <div className="form-group"><label>密码</label><input type="password" value={target.password} onChange={e=>update(setTarget,'password',e.target.value)}/></div>
        {tgtOK && (
          <div style={{marginTop:12,padding:'10px 14px',borderRadius:6,fontSize:13,
            background:tgtOK.success?'var(--success-light)':'var(--error-light)',
            border:`1px solid ${tgtOK.success?'var(--success)':'var(--error)'}`}}>
            {tgtOK.success ? <>✅ 连接成功 — {tgtOK.version} — {tgtOK.latency_ms}ms</> : <>❌ {tgtOK.error}</>}
          </div>
        )}
      </div>
    </div>
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:8,gap:8}}>
      <button className="btn btn-outline" onClick={()=>setStep(0)}>←</button>
      <button className="btn btn-primary" disabled={!canNext3} onClick={()=>setStep(2)}>下一步 →</button>
    </div>
  </>

  // ============ STEP 3 ============
  if (step === 2) return <>
    <div className="header"><h1>选择迁移阶段</h1></div>
    <StepBar/>
    <div className="card">
      <div style={{display:'flex',gap:16}}>
        {[
          {k:'schema',label:'结构迁移',desc:'表结构、索引、视图等 DDL 对象',c:migrateSchema,s:setMigrateSchema},
          {k:'full',label:'全量迁移',desc:'所有存量数据的完整同步',c:migrateFull,s:setMigrateFull},
          {k:'cdc',label:'增量同步',desc:'实时捕获源端变更并同步',c:migrateCDC,s:setMigrateCDC},
        ].map(m=>(
          <label key={m.k} style={{flex:1,display:'flex',gap:12,padding:'20px',borderRadius:10,cursor:'pointer',
            background:m.c?'var(--primary-light)':'var(--bg)',border:`2px solid ${m.c?'var(--primary)':'var(--border)'}`}}>
            <input type="checkbox" checked={m.c} onChange={e=>m.s(e.target.checked)} style={{width:18,height:18}}/>
            <div><div style={{fontWeight:600,fontSize:15}}>{m.label}</div><div style={{fontSize:12,color:'var(--text-dim)',marginTop:4}}>{m.desc}</div></div>
          </label>
        ))}
      </div>
      <div style={{marginTop:16,borderTop:'1px solid var(--border)',paddingTop:14}}>
        <label style={{display:'flex',gap:8,alignItems:'center',cursor:'pointer',fontSize:14}}>
          <input type="checkbox" checked={enableVerify} onChange={e=>setEnableVerify(e.target.checked)}/>
          迁移完成后自动进行数据校验
        </label>
      </div>
    </div>
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:8,gap:8}}>
      <button className="btn btn-outline" onClick={()=>setStep(1)}>←</button>
      <button className="btn btn-primary" disabled={!canNext4} onClick={()=>setStep(3)}>下一步 →</button>
    </div>
  </>

  // ============ STEP 4 ============
  if (step === 3) return <>
    <div className="header"><h1>选择迁移对象</h1></div>
    <StepBar/>
    <div className="card">
      <div className="card-header">目标数据库</div>
      <div className="form-group">
        <select value={selectedDB} onChange={e=>setSelectedDB(e.target.value)} style={{fontSize:14,padding:'10px 12px'}}>
          <option value="">请选择目标数据库</option>
          <option value="yyhdb">yyhdb</option>
          <option value="shou">shou</option>
          <option value="db1">db1</option>
        </select>
        <div className="help-text">选择 PolarDB-X 中已有的数据库，或输入新库名</div>
        <input style={{marginTop:8}} value={selectedDB} onChange={e=>setSelectedDB(e.target.value)} placeholder="或手动输入数据库名"/>
      </div>
    </div>
    <div className="card">
      <div className="card-header">迁移对象类型</div>
      <div style={{display:'flex',gap:12}}>
        {[{k:'tables',label:'📊 表'},{k:'views',label:'👁 视图'},{k:'indexes',label:'📑 索引'}].map(o=>(
          <label key={o.k} style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer',padding:'8px 16px',borderRadius:8,
            background:objects[o.k]?'var(--primary-light)':'white',border:`1px solid ${objects[o.k]?'var(--primary)':'var(--border)'}`}}>
            <input type="checkbox" checked={objects[o.k]} onChange={e=>setObjects(p=>({...p,[o.k]:e.target.checked}))}/>
            {o.label}
          </label>
        ))}
      </div>
    </div>
    <div className="card">
      <div className="card-header">表过滤（可选）</div>
      <div className="form-row">
        <div className="form-group"><label>包含表</label><textarea value={includeTables} onChange={e=>setIncludeTables(e.target.value)} placeholder="逗号分隔表名，留空表示全部" rows={3}/></div>
        <div className="form-group"><label>排除表</label><textarea value={excludeTables} onChange={e=>setExcludeTables(e.target.value)} placeholder="逗号分隔表名" rows={3}/></div>
      </div>
    </div>
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:8,gap:8}}>
      <button className="btn btn-outline" onClick={()=>setStep(2)}>←</button>
      <button className="btn btn-primary" onClick={()=>setStep(4)}>下一步 →</button>
    </div>
  </>

  // ============ STEP 5 ============
  return <>
    <div className="header"><h1>性能配置</h1></div>
    <StepBar/>
    <div className="card">
      <div className="card-header">资源分配</div>
      <div className="form-row-3">
        <div className="form-group"><label>任务数量</label><input type="number" value={taskCount} onChange={e=>setTaskCount(parseInt(e.target.value)||1)} min="1"/></div>
        <div className="form-group"><label>CPU（核）</label><input type="number" value={taskCPU} onChange={e=>setTaskCPU(parseInt(e.target.value)||1)}/></div>
        <div className="form-group"><label>内存（MB）</label><input type="number" value={taskMem} onChange={e=>setTaskMem(parseInt(e.target.value)||1024)}/></div>
      </div>
    </div>
    <div className="card">
      <div className="card-header">迁移参数</div>
      <div className="form-row">
        <div className="form-group"><label>全量分块大小（行）</label><input type="number" value={chunkSize} onChange={e=>setChunkSize(parseInt(e.target.value)||10000)}/></div>
        <div className="form-group"><label>并发数</label><input type="number" value={parallel} onChange={e=>setParallel(parseInt(e.target.value)||4)} min="1" max="64"/></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>写入批次大小（行）</label><input type="number" value={batchSize} onChange={e=>setBatchSize(parseInt(e.target.value)||500)}/></div>
        <div className="form-group">
          <label>错误策略</label>
          <select value={errorPolicy} onChange={e=>setErrorPolicy(e.target.value)}>
            <option value="abort">遇错终止</option>
            <option value="skip">跳过继续</option>
            <option value="retry">重试 3 次后跳过</option>
          </select>
        </div>
      </div>
    </div>
    <div className="card" style={{background:'var(--primary-light)',border:'1px solid rgba(37,99,235,0.2)'}}>
      <div className="card-header" style={{color:'var(--primary)'}}>任务概览</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 24px',fontSize:13}}>
        <div><span style={{color:'var(--text-dim)'}}>源:</span> OceanBase @ {source.host}:{source.port} {source.cluster_name&&`/ ${source.tenant_name}@${source.cluster_name}`}</div>
        <div><span style={{color:'var(--text-dim)'}}>目标:</span> PolarDB-X @ {target.host}:{target.port} / {selectedDB||'(未选)'}</div>
        <div><span style={{color:'var(--text-dim)'}}>迁移:</span> {modeLabel}</div>
        <div><span style={{color:'var(--text-dim)'}}>校验:</span> {enableVerify?'CRC32 分块校验':'不校验'}</div>
        <div><span style={{color:'var(--text-dim)'}}>分块/并发:</span> {chunkSize.toLocaleString()} 行 / {parallel} 线程</div>
        <div><span style={{color:'var(--text-dim)'}}>资源:</span> {taskCount} 任务 × {taskCPU} 核 / {taskMem}MB</div>
      </div>
    </div>
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:16,gap:8}}>
      <button className="btn btn-outline" onClick={()=>setStep(3)}>←</button>
      <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{padding:'10px 28px',fontSize:15}}>
        {submitting ? '创建中...' : '🚀 启动迁移任务'}
      </button>
    </div>
  </>
}
