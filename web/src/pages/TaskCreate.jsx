import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTask, testConnection } from '../api/client'

const STEPS = ['选择数据库', '连接配置', '迁移阶段', '迁移对象', '性能配置']

const DB_CAPABILITY = {
  sources: [
    { key:'mysql', name:'MySQL', icon:'🐬', desc:'MySQL 5.7 / 8.0' },
    { key:'oceanbase', name:'OceanBase', icon:'🌊', desc:'OB 3.x / 4.x MySQL模式' },
    { key:'tidb', name:'TiDB', icon:'⚡', desc:'TiDB 5.x / 6.x / 7.x' },
    { key:'oracle', name:'Oracle', icon:'🔴', desc:'Oracle 11g / 12c / 19c' },
    { key:'postgresql', name:'PostgreSQL', icon:'🐘', desc:'PG 12 / 13 / 14 / 15' },
  ],
  targets: [
    { key:'polardbx', name:'PolarDB-X', icon:'☁️', desc:'集中式/分布式' },
    { key:'mysql', name:'MySQL', icon:'🐬', desc:'MySQL 5.7 / 8.0' },
    { key:'oceanbase', name:'OceanBase', icon:'🌊', desc:'OB MySQL模式' },
    { key:'tidb', name:'TiDB', icon:'⚡', desc:'TiDB 5.x+' },
    { key:'oracle', name:'Oracle', icon:'🔴', desc:'Oracle 11g+' },
    { key:'postgresql', name:'PostgreSQL', icon:'🐘', desc:'PG 12+' },
  ]
}

const DEFAULT_CFG = { type:'', host:'', port:3306, user:'root', password:'', database:'', cluster_name:'', tenant_name:'' }

export default function TaskCreate() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Step 1
  const [srcType, setSrcType] = useState('')
  const [tgtType, setTgtType] = useState('')

  // Step 2
  const [source, setSource] = useState({...DEFAULT_CFG})
  const [target, setTarget] = useState({...DEFAULT_CFG})
  const [testingSrc, setTestingSrc] = useState(false)
  const [testingTgt, setTestingTgt] = useState(false)
  const [srcOK, setSrcOK] = useState(null)
  const [tgtOK, setTgtOK] = useState(null)

  // Step 3
  const [migrateSchema, setMigrateSchema] = useState(true)
  const [migrateFull, setMigrateFull] = useState(true)
  const [migrateCDC, setMigrateCDC] = useState(false)
  const [enableVerify, setEnableVerify] = useState(true)

  // Step 4
  const [schemas, setSchemas] = useState([])
  const [selectedSchema, setSelectedSchema] = useState('')
  const [includeTables, setIncludeTables] = useState('')
  const [excludeTables, setExcludeTables] = useState('')
  const [objects, setObjects] = useState({ tables:true, views:false, indexes:true })

  // Step 5
  const [taskCount, setTaskCount] = useState(1)
  const [taskCPU, setTaskCPU] = useState(2)
  const [taskMem, setTaskMem] = useState(4096)
  const [parallel, setParallel] = useState(4)
  const [chunkSize, setChunkSize] = useState(10000)
  const [batchSize, setBatchSize] = useState(500)
  const [errorPolicy, setErrorPolicy] = useState('abort')
  const [verifyMethod, setVerifyMethod] = useState('checksum')

  const update = (setter, k, v) => setter(p => ({...p, [k]:v}))

  async function handleTest(direction) {
    const isSrc = direction === 'src'
    const setter = isSrc ? setTestingSrc : setTestingTgt
    const result = isSrc ? setSrcOK : setTgtOK
    const cfg = isSrc ? source : target
    setter(true); result(null)
    try {
      if (cfg.cluster_name && cfg.tenant_name) {
        cfg.user = `root@${cfg.tenant_name}#${cfg.cluster_name}`
      }
      const r = await testConnection(cfg)
      result(r)
    } catch(e) { result({success:false, error:e.message}) }
    finally { setter(false) }
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const s = {...source, type: srcType}
      const t = {...target, type: tgtType}
      if (s.cluster_name && s.tenant_name) s.user = `root@${s.tenant_name}#${s.cluster_name}`
      const mode = [migrateSchema&&'schema',migrateFull&&'full',migrateCDC&&'cdc'].filter(Boolean).join('+')
      await createTask({
        name: `${srcType||'?'} → ${tgtType||'?'}`,
        mode, source:s, target:t,
        filter: { include_tables: includeTables?includeTables.split(/[,\s]+/).filter(Boolean):[], exclude_tables: excludeTables?excludeTables.split(/[,\s]+/).filter(Boolean):[], include_schemas: selectedSchema?[selectedSchema]:[] },
        migrate_objects: objects,
        chunk_size: chunkSize, parallel, batch_size: batchSize,
        error_policy: errorPolicy, enable_verify: enableVerify, verify_method: verifyMethod,
      })
      navigate('/')
    } catch(e) { alert('创建失败: '+e.message) }
    finally { setSubmitting(false) }
  }

  const modeLabel = [migrateSchema&&'结构',migrateFull&&'全量',migrateCDC&&'增量'].filter(Boolean).join('+')
  const canNext2 = srcType && tgtType
  const canNext3 = srcOK?.success && tgtOK?.success
  const canNext4 = migrateSchema || migrateFull || migrateCDC

  // ============ STEP 1 ============
  if (step === 0) return <>
    <div className="header"><h1>选择数据库类型</h1></div>
    <div className="card"><div className="card-header">源端数据库</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
        {DB_CAPABILITY.sources.map(db => (
          <div key={db.key} onClick={()=>setSrcType(db.key)} style={{
            padding:'16px 12px',borderRadius:8,cursor:'pointer',textAlign:'center',
            background:srcType===db.key?'rgba(59,130,246,0.12)':'var(--bg)',
            border:`1px solid ${srcType===db.key?'var(--primary)':'var(--border)'}`
          }}>
            <div style={{fontSize:28}}>{db.icon}</div>
            <div style={{fontSize:14,fontWeight:600,marginTop:4}}>{db.name}</div>
            <div style={{fontSize:11,color:'var(--text-dim)',marginTop:2}}>{db.desc}</div>
          </div>
        ))}
      </div>
    </div>
    <div className="card"><div className="card-header">目标端数据库</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
        {DB_CAPABILITY.targets.map(db => (
          <div key={db.key} onClick={()=>setTgtType(db.key)} style={{
            padding:'16px 12px',borderRadius:8,cursor:'pointer',textAlign:'center',
            background:tgtType===db.key?'rgba(34,197,94,0.12)':'var(--bg)',
            border:`1px solid ${tgtType===db.key?'var(--success)':'var(--border)'}`
          }}>
            <div style={{fontSize:28}}>{db.icon}</div>
            <div style={{fontSize:14,fontWeight:600,marginTop:4}}>{db.name}</div>
            <div style={{fontSize:11,color:'var(--text-dim)',marginTop:2}}>{db.desc}</div>
          </div>
        ))}
      </div>
    </div>
    {srcType && tgtType && <div className="card" style={{textAlign:'center',background:'rgba(59,130,246,0.06)',color:'var(--primary)',fontWeight:600}}>
      {srcType} → {tgtType}
    </div>}
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:16,gap:8}}>
      <button className="btn btn-outline" onClick={()=>navigate('/')}>取消</button>
      <button className="btn btn-primary" disabled={!canNext2} onClick={()=>setStep(1)}>下一步 →</button>
    </div>
  </>

  // ============ STEP 2 ============
  if (step === 1) {
    const showsCluster = srcType === 'oceanbase'
    return <>
      <div className="header"><h1>配置源/目标端连接</h1></div>
      <div className="form-row">
        <div className="card" style={{flex:1}}>
          <div className="card-header"><span>源端 — {srcType?.toUpperCase()}</span>
            <button className="btn btn-outline btn-sm" onClick={()=>handleTest('src')} disabled={testingSrc}>
              {testingSrc?'测试中...':'🔗 测试连接'}
            </button>
          </div>
          <div className="form-group"><label>主机</label><input value={source.host} onChange={e=>update(setSource,'host',e.target.value)}/></div>
          <div className="form-group"><label>端口</label><input type="number" value={source.port} onChange={e=>update(setSource,'port',e.target.value)}/></div>
          {showsCluster && (<>
            <div className="form-row">
              <div className="form-group"><label>集群名称</label><input value={source.cluster_name} onChange={e=>update(setSource,'cluster_name',e.target.value)} placeholder="例如: obcp"/></div>
              <div className="form-group"><label>租户名称</label><input value={source.tenant_name} onChange={e=>update(setSource,'tenant_name',e.target.value)} placeholder="例如: yyhtenant"/></div>
            </div>
          </>)}
          <div className="form-group"><label>用户名</label><input value={source.user} onChange={e=>update(setSource,'user',e.target.value)} placeholder={showsCluster?'填写集群和租户后自动生成':'root'}/></div>
          <div className="form-group"><label>密码</label><input type="password" value={source.password} onChange={e=>update(setSource,'password',e.target.value)}/></div>
          <div className="form-group"><label>数据库</label><input value={source.database} onChange={e=>update(setSource,'database',e.target.value)}/></div>
          {srcOK && (
            <div style={{marginTop:8,padding:'8px 12px',borderRadius:4,fontSize:12,
              background:srcOK.success?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',
              border:`1px solid ${srcOK.success?'var(--success)':'var(--error)'}`}}>
              {srcOK.success ? <>✅ {srcOK.version} — {srcOK.latency_ms}ms</> : <>❌ {srcOK.error}</>}
            </div>
          )}
        </div>
        <div className="card" style={{flex:1}}>
          <div className="card-header"><span>目标端 — {tgtType?.toUpperCase()}</span>
            <button className="btn btn-outline btn-sm" onClick={()=>handleTest('tgt')} disabled={testingTgt}>
              {testingTgt?'测试中...':'🔗 测试连接'}
            </button>
          </div>
          <div className="form-group"><label>主机</label><input value={target.host} onChange={e=>update(setTarget,'host',e.target.value)}/></div>
          <div className="form-group"><label>端口</label><input type="number" value={target.port} onChange={e=>update(setTarget,'port',e.target.value)}/></div>
          <div className="form-group"><label>用户名</label><input value={target.user} onChange={e=>update(setTarget,'user',e.target.value)} placeholder="root"/></div>
          <div className="form-group"><label>密码</label><input type="password" value={target.password} onChange={e=>update(setTarget,'password',e.target.value)}/></div>
          <div className="form-group"><label>数据库</label><input value={target.database} onChange={e=>update(setTarget,'database',e.target.value)}/></div>
          {tgtOK && (
            <div style={{marginTop:8,padding:'8px 12px',borderRadius:4,fontSize:12,
              background:tgtOK.success?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',
              border:`1px solid ${tgtOK.success?'var(--success)':'var(--error)'}`}}>
              {tgtOK.success ? <>✅ {tgtOK.version} — {tgtOK.latency_ms}ms</> : <>❌ {tgtOK.error}</>}
            </div>
          )}
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:16}}>
        <button className="btn btn-outline" onClick={()=>setStep(0)}>← 上一步</button>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-outline" onClick={()=>navigate('/')}>取消</button>
          <button className="btn btn-primary" disabled={!canNext3} onClick={()=>setStep(2)}>下一步 →</button>
        </div>
      </div>
    </>
  }

  // ============ STEP 3 ============
  if (step === 2) return <>
    <div className="header"><h1>选择迁移阶段</h1></div>
    <div className="card">
      <div style={{display:'flex',gap:16}}>
        {[
          {k:'schema',label:'结构迁移',desc:'表结构、索引、视图等DDL对象',c:migrateSchema,s:setMigrateSchema},
          {k:'full',label:'全量迁移',desc:'所有存量数据的全量同步',c:migrateFull,s:setMigrateFull},
          {k:'cdc',label:'增量同步',desc:'实时捕获源端变更并同步到目标',c:migrateCDC,s:setMigrateCDC},
        ].map(m=>(
          <label key={m.k} style={{flex:1,display:'flex',gap:10,padding:'16px',borderRadius:8,cursor:'pointer',
            background:m.c?'rgba(59,130,246,0.08)':'var(--bg)',border:`1px solid ${m.c?'var(--primary)':'var(--border)'}`}}>
            <input type="checkbox" checked={m.c} onChange={e=>m.s(e.target.checked)}/>
            <div><div style={{fontWeight:600,fontSize:14}}>{m.label}</div><div style={{fontSize:12,color:'var(--text-dim)',marginTop:4}}>{m.desc}</div></div>
          </label>
        ))}
      </div>
      <div style={{marginTop:16,borderTop:'1px solid var(--border)',paddingTop:12}}>
        <label style={{display:'flex',gap:8,alignItems:'center',cursor:'pointer'}}>
          <input type="checkbox" checked={enableVerify} onChange={e=>setEnableVerify(e.target.checked)}/>
          <span>迁移完成后自动进行数据校验</span>
        </label>
      </div>
    </div>
    <div style={{display:'flex',justifyContent:'space-between',marginTop:16}}>
      <button className="btn btn-outline" onClick={()=>setStep(1)}>← 上一步</button>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-outline" onClick={()=>navigate('/')}>取消</button>
        <button className="btn btn-primary" disabled={!canNext4} onClick={()=>setStep(3)}>下一步 →</button>
      </div>
    </div>
  </>

  // ============ STEP 4 ============
  if (step === 3) return <>
    <div className="header"><h1>选择迁移对象</h1></div>
    <div className="card">
      <div className="card-header">对象类型</div>
      <div style={{display:'flex',gap:12}}>
        {[{k:'tables',label:'📊 表'},{k:'views',label:'👁 视图'},{k:'indexes',label:'📑 索引'}].map(o=>(
          <label key={o.k} style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer',padding:'6px 12px',borderRadius:6,
            background:objects[o.k]?'rgba(59,130,246,0.08)':'var(--bg)',border:`1px solid ${objects[o.k]?'var(--primary)':'var(--border)'}`}}>
            <input type="checkbox" checked={objects[o.k]} onChange={e=>setObjects(p=>({...p,[o.k]:e.target.checked}))}/>
            {o.label}
          </label>
        ))}
      </div>
    </div>
    <div className="card">
      <div className="card-header">Schema / 数据库筛选</div>
      <div className="form-group">
        <label>选择 Schema</label>
        <select value={selectedSchema} onChange={e=>setSelectedSchema(e.target.value)}>
          <option value="">全部</option>
          <option value={source.database}>{source.database || '(当前库)'}</option>
        </select>
      </div>
    </div>
    <div className="card">
      <div className="card-header">表过滤</div>
      <div className="form-row">
        <div className="form-group"><label>包含表</label><textarea value={includeTables} onChange={e=>setIncludeTables(e.target.value)} placeholder="逗号分隔，留空=全部" rows={3}/></div>
        <div className="form-group"><label>排除表</label><textarea value={excludeTables} onChange={e=>setExcludeTables(e.target.value)} placeholder="逗号分隔" rows={3}/></div>
      </div>
    </div>
    <div style={{display:'flex',justifyContent:'space-between',marginTop:16}}>
      <button className="btn btn-outline" onClick={()=>setStep(2)}>← 上一步</button>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-outline" onClick={()=>navigate('/')}>取消</button>
        <button className="btn btn-primary" onClick={()=>setStep(4)}>下一步 →</button>
      </div>
    </div>
  </>

  // ============ STEP 5 ============
  return <>
    <div className="header"><h1>任务配置</h1></div>
    <div className="card">
      <div className="card-header">资源分配</div>
      <div className="form-row-3">
        <div className="form-group"><label>任务数量</label><input type="number" value={taskCount} onChange={e=>setTaskCount(parseInt(e.target.value)||1)} min="1"/></div>
        <div className="form-group"><label>CPU (核)</label><input type="number" value={taskCPU} onChange={e=>setTaskCPU(parseInt(e.target.value)||1)}/></div>
        <div className="form-group"><label>内存 (MB)</label><input type="number" value={taskMem} onChange={e=>setTaskMem(parseInt(e.target.value)||1024)}/></div>
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
            <option value="retry">重试3次后跳过</option>
          </select>
        </div>
      </div>
    </div>

    {/* Summary */}
    <div className="card" style={{background:'rgba(59,130,246,0.04)'}}>
      <div className="card-header">任务概览</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 20px',fontSize:13}}>
        <div><span style={{color:'var(--text-dim)'}}>源:</span> {srcType} @ {source.host}:{source.port} {source.cluster_name && `/ ${source.tenant_name}@${source.cluster_name}`}</div>
        <div><span style={{color:'var(--text-dim)'}}>目标:</span> {tgtType} @ {target.host}:{target.port}</div>
        <div><span style={{color:'var(--text-dim)'}}>迁移:</span> {modeLabel}</div>
        <div><span style={{color:'var(--text-dim)'}}>校验:</span> {enableVerify ? (verifyMethod==='checksum'?'CRC32分块':'行数校验') : '不校验'}</div>
        <div><span style={{color:'var(--text-dim)'}}>分块/并发:</span> {chunkSize}行 / {parallel}线程</div>
        <div><span style={{color:'var(--text-dim)'}}>资源:</span> {taskCount}任务 × {taskCPU}核 / {taskMem}MB</div>
      </div>
    </div>

    <div style={{display:'flex',justifyContent:'space-between',marginTop:16}}>
      <button className="btn btn-outline" onClick={()=>setStep(3)}>← 上一步</button>
      <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
        {submitting ? '创建中...' : '🚀 启动迁移任务'}
      </button>
    </div>
  </>
}
