import { useState, useEffect } from 'react'

function CategoryHeader({label, count, defaultOpen, children}) {
  const [open, setOpen] = useState(defaultOpen !== false)
  return <>
    <div onClick={()=>setOpen(!open)} style={{padding:'4px 14px 2px 28px',fontSize:11,color:count>0?'var(--text-dim)':'#cbd5e1',fontWeight:600,display:'flex',alignItems:'center',gap:6,cursor:'pointer',userSelect:'none'}}>
      <svg width="8" height="8" viewBox="0 0 8 8" style={{transform:open?'rotate(90deg)':'rotate(0deg)',transition:'transform .15s',flexShrink:0}}>
        <path d="M3 1l3 3-3 3" stroke={count>0?'#94a3b8':'#cbd5e1'} strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      </svg>
      <span>{label} ({count})</span>
    </div>
    {open && children}
  </>
}
import { useNavigate } from 'react-router-dom'
import { createTask, testConnection, discoverSchema } from '../api/client'

const STEPS = ['选择数据库', '连接配置', '迁移阶段', '对象选择', '性能配置']

const DB_CAPABILITY = {
  sources: [
    { key:'oceanbase', name:'OceanBase', icon:'🌊', desc:'OB 3.x / 4.x MySQL 模式' },
    { key:'tidb', name:'TiDB', icon:'⚡', desc:'TiDB 5.x / 6.x / 7.x' },
  ],
  targets: [
    { key:'polardbx-distributed', name:'PolarDB-X 分布式', icon:'☁️', desc:'分布式集群' },
    { key:'polardbx-centralized', name:'PolarDB-X 集中式', icon:'☁️', desc:'集中式实例' },
  ]
}

const DEFAULT_SRC = { host:'', port:2883, user:'root', password:'', cluster_name:'', tenant_name:'', database:'' }
const DEFAULT_TGT = { host:'', port:4886, user:'root', password:'' }

export default function TaskCreate() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [taskName, setTaskName] = useState('')

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
  const [cdcDML, setCdcDML] = useState(true)
  const [cdcDDL, setCdcDDL] = useState(true)
  const [enableVerify, setEnableVerify] = useState(true)
  const [verifyObject, setVerifyObject] = useState(true)
  const [verifyData, setVerifyData] = useState(true)

  const [selectedDB, setSelectedDB] = useState('')
  const [includeTables, setIncludeTables] = useState('')
  const [excludeTables, setExcludeTables] = useState('')
  const [objects, setObjects] = useState({ tables:true, views:false, indexes:true })

  // Step 4: 迁移选型
  const [selectMode, setSelectMode] = useState('specific') // 'specific' or 'pattern'
  const [selectedItems, setSelectedItems] = useState([]) // [{schema, table, targetName}]
  const [renameItem, setRenameItem] = useState(null)
  const [patternInclude, setPatternInclude] = useState('')
  const [patternExclude, setPatternExclude] = useState('')

  function addToSelected(schema, table) {
    const key = `${schema}.${table}`
    if (selectedItems.find(i => i.schema === schema && i.table === table)) return
    setSelectedItems(prev => [...prev, {schema, table, targetName: table}])
  }

  function removeSelected(index) {
    setSelectedItems(prev => prev.filter((_,i) => i !== index))
  }

  function renameSelected(index, newName) {
    setSelectedItems(prev => prev.map((item,i) => i===index ? {...item, targetName: newName} : item))
  }

  const [taskCount, setTaskCount] = useState(1)
  const [taskCPU, setTaskCPU] = useState(2)
  const [taskMem, setTaskMem] = useState(4096)
  const [parallel, setParallel] = useState(4)
  const [chunkSize, setChunkSize] = useState(10000)
  const [batchSize, setBatchSize] = useState(500)
  const [errorPolicy, setErrorPolicy] = useState('abort')

  // Step 4: schema tree
  const [schemaTree, setSchemaTree] = useState([])
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [expandedSchemas, setExpandedSchemas] = useState({})
  const [selectedTables, setSelectedTables] = useState({})

  useEffect(() => {
    if (step === 3 && source.port > 0 && source.host && source.password) {
      setLoadingSchema(true)
      const cfg = {...source, type: srcType}
      if (cfg.cluster_name && cfg.tenant_name) cfg.user = `root@${cfg.tenant_name}#${cfg.cluster_name}`
      discoverSchema(cfg).then(r => {
        setSchemaTree(Array.isArray(r) ? r : [])
        setLoadingSchema(false)
      }).catch(() => setLoadingSchema(false))
    }
  }, [step])

  function toggleSchema(schemaName) {
    setExpandedSchemas(p => ({...p, [schemaName]: !p[schemaName]}))
  }

  function toggleTable(schemaName, tableName) {
    setSelectedTables(p => {
      const key = `${schemaName}.${tableName}`
      const next = {...p}
      if (next[key]) { delete next[key] }
      else { next[key] = true }
      return next
    })
  }

  function toggleAllTables(schemaName, tables) {
    setSelectedTables(p => {
      const allSelected = tables.every(t => p[`${schemaName}.${t.name}`])
      const next = {...p}
      tables.forEach(t => {
        const key = `${schemaName}.${t.name}`
        if (allSelected) delete next[key]
        else next[key] = true
      })
      return next
    })
  }

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
      const tgt = {...target, type: tgtType, database: selectedDB}
      if (src.cluster_name && src.tenant_name) src.user = `root@${src.tenant_name}#${src.cluster_name}`

      // Auto-derive source database from schema tree selection
      const schemas = new Set()
      Object.keys(selectedTables).forEach(k => {
        const parts = k.split('.')
        if (parts.length === 2) schemas.add(parts[0])
      })
      const schemaList = [...schemas]
      if (schemaList.length > 0) src.database = schemaList[0]

      const mode = [migrateSchema&&'schema',migrateFull&&'full',migrateCDC&&'cdc'].filter(Boolean).join('+')
      const created = await createTask({
        name: taskName || 'OB → PDB-X',
        mode, source: src, target: tgt,
        filter: { include_tables: [], exclude_tables: [], include_schemas: schemaList },
        migrate_objects: objects,
        chunk_size: chunkSize, parallel, batch_size: batchSize,
        error_policy: errorPolicy, enable_verify: enableVerify, verify_method: 'checksum',
      })
      // Auto-start the task
      await fetch(`/api/v1/tasks/${created.id}/start`, {method:'POST'})
      navigate(`/tasks/${created.id}`)
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
      <div style={{fontSize:13,color:'var(--text-dim)',marginBottom:20}}>选择源端和目标端数据库类型</div>

      <div style={{maxWidth:400,margin:'0 auto 24px',textAlign:'left'}}>
        <div className="form-group">
          <label>任务名称</label>
          <input value={taskName} onChange={e=>setTaskName(e.target.value)} placeholder="输入任务名称，如：OB生产库→PDB-X迁移" />
        </div>
      </div>

      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'center',gap:24,flexWrap:'wrap'}}>
        <div style={{display:'flex',flexDirection:'column',gap:12,minWidth:300}}>
          <div style={{fontSize:13,fontWeight:600,color:'var(--text-dim)',textAlign:'center',marginBottom:4}}>源端数据库</div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
            {DB_CAPABILITY.sources.map(db => (
              <div key={db.key} onClick={()=>setSrcType(db.key)} style={{
                width:170,padding:'20px 14px',borderRadius:12,cursor:'pointer',textAlign:'center',
                background: srcType===db.key ? 'var(--primary-light)' : 'white',
                border: `2px solid ${srcType===db.key ? 'var(--primary)' : 'var(--border)'}`,
                boxShadow: srcType===db.key ? '0 2px 8px rgba(37,99,235,0.12)' : 'var(--shadow)',
                transition:'all .2s'
              }}>
                <div style={{fontSize:32}}>{db.icon}</div>
                <div style={{fontSize:14,fontWeight:700,marginTop:6,color:srcType===db.key?'var(--primary)':'var(--text)'}}>{db.name}</div>
                <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4}}>{db.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontSize:28,color:'var(--text-dim)',fontWeight:300,alignSelf:'center',paddingTop:20}}>→</div>
        <div style={{display:'flex',flexDirection:'column',gap:12,minWidth:300}}>
          <div style={{fontSize:13,fontWeight:600,color:'var(--text-dim)',textAlign:'center',marginBottom:4}}>目标端数据库</div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
            {DB_CAPABILITY.targets.map(db => (
              <div key={db.key} onClick={()=>setTgtType(db.key)} style={{
                width:170,padding:'20px 14px',borderRadius:12,cursor:'pointer',textAlign:'center',
                background: tgtType===db.key ? 'var(--success-light)' : 'white',
                border: `2px solid ${tgtType===db.key ? 'var(--success)' : 'var(--border)'}`,
                boxShadow: tgtType===db.key ? '0 2px 8px rgba(22,163,74,0.12)' : 'var(--shadow)',
                transition:'all .2s'
              }}>
                <div style={{fontSize:32}}>{db.icon}</div>
                <div style={{fontSize:14,fontWeight:700,marginTop:6,color:tgtType===db.key?'var(--success)':'var(--text)'}}>{db.name}</div>
                <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4}}>{db.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {srcType && tgtType && (
        <div style={{marginTop:16,textAlign:'center',fontSize:14,fontWeight:600,color:'var(--primary)'}}>
          {DB_CAPABILITY.sources.find(d=>d.key===srcType)?.name} → {DB_CAPABILITY.targets.find(d=>d.key===tgtType)?.name}
        </div>
      )}
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
          <span>{srcType==='oceanbase' ? '🌊' : '⚡'} 源端 — {srcType==='oceanbase'?'OceanBase':'TiDB'}</span>
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
          <span>☁️ 目标端 — {tgtType==='polardbx-distributed'?'PolarDB-X 分布式':'PolarDB-X 集中式'}</span>
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
          <div key={m.k} style={{flex:1}}>
            <label style={{gap:12,padding:'20px',borderRadius:10,cursor:'pointer',display:'flex',alignItems:'flex-start',
              background:m.c?'var(--primary-light)':'var(--bg)',border:`2px solid ${m.c?'var(--primary)':'var(--border)'}`}}>
              <input type="checkbox" checked={m.c} onChange={e=>m.s(e.target.checked)} style={{width:18,height:18,marginTop:2}}/>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:15}}>{m.label}</div><div style={{fontSize:12,color:'var(--text-dim)',marginTop:4}}>{m.desc}</div></div>
            </label>
            {/* CDC 子选项 */}
            {m.k === 'cdc' && migrateCDC && (
              <div style={{marginTop:10, marginLeft:34, display:'flex', gap:16}}>
                <label style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer',fontSize:13,
                  padding:'6px 14px',borderRadius:6,background:cdcDML?'var(--primary-light)':'white',border:`1px solid ${cdcDML?'var(--primary)':'var(--border)'}`}}>
                  <input type="checkbox" checked={cdcDML} onChange={e=>setCdcDML(e.target.checked)}/>
                  DML 同步
                </label>
                <label style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer',fontSize:13,
                  padding:'6px 14px',borderRadius:6,background:cdcDDL?'var(--primary-light)':'white',border:`1px solid ${cdcDDL?'var(--primary)':'var(--border)'}`}}>
                  <input type="checkbox" checked={cdcDDL} onChange={e=>setCdcDDL(e.target.checked)}/>
                  DDL 同步
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* 数据校验 */}
    <div className="card" style={{background:enableVerify?'#fffbeb':'white',border:enableVerify?'1px solid #fbbf24':'1px solid var(--border)'}}>
      <div>
        <label style={{display:'flex',gap:8,alignItems:'center',cursor:'pointer',fontSize:16,fontWeight:600,color:'#92400e'}}>
          <input type="checkbox" checked={enableVerify} onChange={e=>setEnableVerify(e.target.checked)} style={{width:18,height:18}}/>
          数据校验
        </label>
        <div style={{fontSize:12,color:'#a16207',marginTop:4,marginLeft:26}}>
          迁移完成后自动校验，确保源端与目标端一致
        </div>
        {enableVerify && (
          <div style={{marginTop:10,marginLeft:26,display:'flex',gap:16}}>
            <label style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer',fontSize:13,
              padding:'6px 14px',borderRadius:6,background:verifyObject?'var(--primary-light)':'white',border:`1px solid ${verifyObject?'var(--primary)':'var(--border)'}`}}>
              <input type="checkbox" checked={verifyObject} onChange={e=>setVerifyObject(e.target.checked)}/>
              对象校验
            </label>
            <label style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer',fontSize:13,
              padding:'6px 14px',borderRadius:6,background:verifyData?'var(--primary-light)':'white',border:`1px solid ${verifyData?'var(--primary)':'var(--border)'}`}}>
              <input type="checkbox" checked={verifyData} onChange={e=>setVerifyData(e.target.checked)}/>
              数据校验
            </label>
          </div>
        )}
      </div>
    </div>

    <div style={{display:'flex',justifyContent:'flex-end',marginTop:8,gap:8}}>
      <button className="btn btn-outline" onClick={()=>setStep(1)}>←</button>
      <button className="btn btn-primary" disabled={!canNext4} onClick={()=>setStep(3)}>下一步 →</button>
    </div>
  </>

  // ============ STEP 4: 对象选择 ============
  if (step === 3) {
    const checkedCount = Object.keys(selectedTables).length
    return <>
    <div className="header"><h1>对象选择</h1></div>
    <StepBar/>

    <div style={{display:'flex',gap:12,alignItems:'stretch'}}>
      {/* ===== LEFT ===== */}
      <div className="card" style={{flex:1,display:'flex',flexDirection:'column'}}>
        <div className="card-header" style={{fontSize:13,borderBottom:'1px solid var(--border)',padding:'10px 14px',flexShrink:0}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="3" rx="6" ry="2" stroke="#64748b" strokeWidth="1.3"/><path d="M2 3v4c0 1.1 2.7 2 6 2s6-.9 6-2V3" stroke="#64748b" strokeWidth="1.3" fill="none"/><path d="M2 7v4c0 1.1 2.7 2 6 2s6-.9 6-2V7" stroke="#64748b" strokeWidth="1.3" fill="none"/></svg>
            源端对象
          </span>
          <span style={{fontSize:11,color:'var(--text-dim)'}}>{checkedCount} 已选</span>
        </div>
        {loadingSchema ? (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><div className="spinner"/></div>
        ) : (
          <div style={{flex:1,overflowY:'auto',maxHeight:420}}>
            {schemaTree.map(schema => {
              const tables = schema.tables || []
              const selCount = tables.filter(t=>selectedTables[`${schema.name}.${t.name}`]).length
              const allSelected = tables.length > 0 && selCount === tables.length
              const someSelected = selCount > 0 && !allSelected
              return (
                <div key={schema.name}>
                  {/* Schema */}
                  <div onClick={()=>toggleSchema(schema.name)} style={{
                    display:'flex',alignItems:'center',gap:6,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:600,
                    background:'#fafbfc',borderBottom:'1px solid #eef2f7',userSelect:'none'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" style={{transform:expandedSchemas[schema.name]?'rotate(90deg)':'rotate(0deg)',transition:'transform .15s',flexShrink:0}}>
                      <path d="M3.5 1.5l4 3.5-4 3.5" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    </svg>
                    <input type="checkbox" checked={allSelected} ref={el=>{if(el)el.indeterminate=someSelected}} onChange={e=>{e.stopPropagation();toggleAllTables(schema.name,tables)}}
                      style={{width:14,height:14,accentColor:'var(--primary)',flexShrink:0}}/>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
                      <ellipse cx="8" cy="3.5" rx="5.5" ry="1.8" stroke="#d97706" strokeWidth="1.2"/>
                      <path d="M2.5 3.5v4c0 .9 2.5 1.7 5.5 1.7s5.5-.8 5.5-1.7v-4" stroke="#d97706" strokeWidth="1.2" fill="none"/>
                      <path d="M2.5 7.5v4c0 .9 2.5 1.7 5.5 1.7s5.5-.8 5.5-1.7v-4" stroke="#d97706" strokeWidth="1.2" fill="none"/>
                    </svg>
                    <span style={{flex:1}}>{schema.name}</span>
                    <span style={{fontSize:11,color:'var(--text-dim)'}}>{tables.length} 表</span>
                  </div>
                  {expandedSchemas[schema.name] && (
                    <div>
                      {/* Category: 表 */}
                      <CategoryHeader label="表" count={tables.length} defaultOpen={true}>
                        {tables.map(table => {
                          const sel = !!selectedTables[`${schema.name}.${table.name}`]
                          return (
                            <div key={table.name} onClick={()=>toggleTable(schema.name,table.name)} style={{
                              display:'flex',alignItems:'center',gap:6,padding:'4px 14px 4px 46px',cursor:'pointer',fontSize:12,
                              background:sel?'var(--primary-light)':'white',borderBottom:'1px solid #f8fafc',userSelect:'none'
                            }}>
                              <input type="checkbox" checked={sel} onChange={()=>{}} style={{width:13,height:13,accentColor:'var(--primary)',flexShrink:0}}/>
                              <span style={{flex:1}}>{table.name}</span>
                              <span style={{fontSize:10,color:'var(--text-dim)'}}>{table.rows>0?`${(table.rows/1000).toFixed(1)}k`:''}</span>
                            </div>
                          )
                        })}
                      </CategoryHeader>
                      {/* Empty categories for future: 视图, 存储过程 */}
                      <div style={{padding:'4px 14px 2px 28px',fontSize:11,color:'#94a3b8',display:'flex',alignItems:'center',gap:6}}>
                        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M3.5 1.5l4 3.5-4 3.5" stroke="#cbd5e1" strokeWidth="1.2" fill="none"/></svg>
                        <svg width="10" height="10" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" stroke="#cbd5e1" strokeWidth="1"/></svg>
                        视图 (0)
                      </div>
                      <div style={{padding:'4px 14px 2px 28px',fontSize:11,color:'#94a3b8',display:'flex',alignItems:'center',gap:6}}>
                        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M3.5 1.5l4 3.5-4 3.5" stroke="#cbd5e1" strokeWidth="1.2" fill="none"/></svg>
                        <svg width="10" height="10" viewBox="0 0 12 12"><rect x="2" y="3" width="8" height="6" rx="1" stroke="#cbd5e1" strokeWidth="1"/><text x="4" y="8" fontSize="5" fill="#cbd5e1">fn</text></svg>
                        函数 (0)
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== CENTER ===== */}
      <div style={{display:'flex',flexDirection:'column',justifyContent:'center',gap:8,flexShrink:0,width:34}}>
        <button className="btn btn-primary" onClick={()=>{
          const toAdd = []
          schemaTree.forEach(schema => {
            (schema.tables||[]).forEach(table => {
              if (selectedTables[`${schema.name}.${table.name}`] && !selectedItems.find(i=>i.schema===schema.name&&i.table===table.name)) {
                toAdd.push({schema:schema.name, table:table.name, targetName:table.name, targetSchema:schema.name})
              }
            })
          })
          setSelectedItems(prev => [...prev, ...toAdd])
        }} style={{width:34,height:34,borderRadius:17,padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,lineHeight:1}} title="添加所选">›</button>
      </div>

      {/* ===== RIGHT ===== */}
      <div className="card" style={{flex:1,display:'flex',flexDirection:'column'}}>
        <div className="card-header" style={{fontSize:13,borderBottom:'1px solid var(--border)',padding:'10px 14px',flexShrink:0}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="3" rx="6" ry="2" stroke="#16a34a" strokeWidth="1.3"/><path d="M2 3v4c0 1.1 2.7 2 6 2s6-.9 6-2V3" stroke="#16a34a" strokeWidth="1.3" fill="none"/><path d="M2 7v4c0 1.1 2.7 2 6 2s6-.9 6-2V7" stroke="#16a34a" strokeWidth="1.3" fill="none"/></svg>
            已选对象
          </span>
          <span style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11,color:'var(--text-dim)'}}>{selectedItems.length} 个</span>
            {selectedItems.length > 0 && <button className="btn btn-outline btn-sm" onClick={()=>setSelectedItems([])} style={{fontSize:10,padding:'1px 6px'}}>清空</button>}
          </span>
        </div>
        {selectedItems.length === 0 ? (
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'var(--text-dim)',fontSize:12,lineHeight:2}}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none" style={{opacity:.2,marginBottom:8}}>
              <ellipse cx="20" cy="9" rx="14" ry="4.5" stroke="#94a3b8" strokeWidth="2"/><path d="M6 9v9c0 2.5 6.3 4.5 14 4.5s14-2 14-4.5V9" stroke="#94a3b8" strokeWidth="2" fill="none"/><path d="M6 18v9c0 2.5 6.3 4.5 14 4.5s14-2 14-4.5v-9" stroke="#94a3b8" strokeWidth="2" fill="none"/>
            </svg>
            <div>在左侧勾选后点击 › 添加</div>
          </div>
        ) : (
          <div style={{flex:1,overflowY:'auto',maxHeight:420}}>
            {(() => {
              const schemas = [...new Set(selectedItems.map(i=>i.targetSchema||i.schema))]
              return schemas.map((schemaName, schemaIdx) => {
                const items = selectedItems.filter(i=>(i.targetSchema||i.schema)===schemaName)
                return (
                  <div key={schemaName}>
                    {/* Schema header with rename */}
                    <div style={{
                      display:'flex',alignItems:'center',gap:6,padding:'8px 14px',fontSize:13,fontWeight:600,
                      background:'#f0fdf4',borderBottom:'1px solid #dcfce7',userSelect:'none'
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M3.5 1.5l4 3.5-4 3.5" stroke="#16a34a" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="3.5" rx="5.5" ry="1.8" stroke="#16a34a" strokeWidth="1.2"/><path d="M2.5 3.5v4c0 .9 2.5 1.7 5.5 1.7s5.5-.8 5.5-1.7v-4" stroke="#16a34a" strokeWidth="1.2" fill="none"/><path d="M2.5 7.5v4c0 .9 2.5 1.7 5.5 1.7s5.5-.8 5.5-1.7v-4" stroke="#16a34a" strokeWidth="1.2" fill="none"/></svg>
                      {renameItem === `schema_${schemaIdx}` ? (
                        <input autoFocus value={schemaName} onChange={e=>{
                          const newName = e.target.value
                          setSelectedItems(prev => prev.map(i=>(i.targetSchema||i.schema)===schemaName?{...i,targetSchema:newName}:i))
                        }} onBlur={()=>setRenameItem(null)} onKeyDown={e=>e.key==='Enter'&&setRenameItem(null)}
                          style={{flex:1,padding:'2px 5px',fontSize:12,border:'1px solid var(--primary)',borderRadius:3,outline:'none'}}/>
                      ) : (
                        <span style={{flex:1}}>{schemaName}</span>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={()=>setRenameItem(`schema_${schemaIdx}`)} style={{padding:'0 5px',fontSize:9,lineHeight:'18px',flexShrink:0}}>✎</button>
                      <span style={{fontSize:11,color:'var(--text-dim)'}}>表 {items.length}</span>
                    </div>
                    <div style={{padding:'2px 14px 2px 46px',fontSize:11,color:'var(--text-dim)',fontWeight:600}}>表</div>
                    {items.map((item,i) => {
                      const globalIdx = selectedItems.indexOf(item)
                      return (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 14px 4px 46px',fontSize:12,borderBottom:'1px solid #f8fafc'}}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><rect x="1" y="1.5" width="10" height="9" rx="1" stroke="#16a34a" strokeWidth="1"/></svg>
                          {renameItem === globalIdx ? (
                            <input autoFocus value={item.targetName} onChange={e=>renameSelected(globalIdx,e.target.value)} onBlur={()=>setRenameItem(null)} onKeyDown={e=>e.key==='Enter'&&setRenameItem(null)}
                              style={{flex:1,padding:'2px 5px',fontSize:11,border:'1px solid var(--primary)',borderRadius:3,outline:'none'}}/>
                          ) : (
                            <span style={{flex:1}}>{item.targetName}</span>
                          )}
                          {item.targetName !== item.table && <span style={{fontSize:10,color:'var(--text-dim)',marginLeft:2}}>←{item.table}</span>}
                          <button className="btn btn-outline btn-sm" onClick={()=>setRenameItem(globalIdx)} style={{padding:'0 5px',fontSize:9,lineHeight:'18px',flexShrink:0}}>✎</button>
                          <button className="btn btn-outline btn-sm" onClick={()=>removeSelected(globalIdx)} style={{padding:'0 5px',fontSize:10,color:'var(--error)',flexShrink:0,lineHeight:'18px'}}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>
    </div>

    <div style={{display:'flex',justifyContent:'flex-end',marginTop:16,gap:8}}>
      <button className="btn btn-outline" onClick={()=>setStep(2)}>←</button>
      <button className="btn btn-primary" onClick={()=>setStep(4)}>下一步 →</button>
    </div>
  </>

  }


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
        {submitting ? '创建中...' : '启动迁移任务'}
      </button>
    </div>
  </>
}
