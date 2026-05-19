import { useState, useEffect } from 'react'
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
      await createTask({
        name: taskName || 'OB → PDB-X',
        mode, source: src, target: tgt,
        filter: { include_tables: [], exclude_tables: [], include_schemas: schemaList },
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

    <div style={{display:'grid',gridTemplateColumns:'1fr 52px 1fr',gap:0}}>
      {/* Left: Source Tree */}
      <div className="card" style={{borderRadius:'var(--radius) 0 0 var(--radius)'}}>
        <div className="card-header" style={{fontSize:14,color:'var(--text)',borderBottom:'1px solid var(--border)',padding:'12px 16px'}}>
          <span style={{display:'flex',alignItems:'center',gap:8}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1" stroke="#64748b" strokeWidth="1.5"/><path d="M1 5h14" stroke="#64748b" strokeWidth="1.5"/></svg>
            源端对象
          </span>
          <span style={{fontSize:12,color:'var(--text-dim)',fontWeight:400}}>{checkedCount} 已选</span>
        </div>
        {loadingSchema ? (
          <div style={{textAlign:'center',padding:60}}><div className="spinner" style={{margin:'0 auto'}}/><div style={{marginTop:8,fontSize:13,color:'var(--text-dim)'}}>加载中...</div></div>
        ) : (
          <div style={{maxHeight:400,overflowY:'auto'}}>
            {schemaTree.map(schema => {
              const tables = schema.tables || []
              const allSelected = tables.length > 0 && tables.every(t => selectedTables[`${schema.name}.${t.name}`])
              return (
                <div key={schema.name}>
                  <div onClick={()=>toggleSchema(schema.name)} style={{
                    display:'flex',alignItems:'center',gap:8,padding:'9px 16px',cursor:'pointer',fontSize:13,fontWeight:600,
                    background:'#fafbfc',borderBottom:'1px solid #f1f5f9',color:'var(--text)',userSelect:'none',
                    transition:'background .15s'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" style={{transform:expandedSchemas[schema.name]?'rotate(90deg)':'rotate(0deg)',transition:'transform .15s',flexShrink:0}}>
                      <path d="M4 2l4 4-4 4" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <input type="checkbox" checked={allSelected} onChange={e=>{e.stopPropagation();toggleAllTables(schema.name,tables)}} 
                      style={{width:15,height:15,accentColor:'var(--primary)',flexShrink:0}}/>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{flexShrink:0}}>
                      <path d="M2 3.5h10v8a1 1 0 01-1 1H3a1 1 0 01-1-1v-8z" fill="#fbbf24" stroke="#d97706" strokeWidth="1"/>
                      <rect x="1" y="1.5" width="12" height="2" rx="0.5" fill="#fcd34d" stroke="#d97706" strokeWidth="0.8"/>
                    </svg>
                    <span style={{flex:1}}>{schema.name}</span>
                    <span style={{fontSize:11,color:'var(--text-dim)',fontWeight:400}}>{tables.length}</span>
                  </div>
                  {expandedSchemas[schema.name] && tables.map(table => {
                    const sel = !!selectedTables[`${schema.name}.${table.name}`]
                    return (
                      <div key={table.name} onClick={()=>toggleTable(schema.name,table.name)} style={{
                        display:'flex',alignItems:'center',gap:8,padding:'7px 16px 7px 44px',cursor:'pointer',fontSize:13,
                        background:sel?'var(--primary-light)':'white',color:sel?'var(--primary)':'var(--text)',
                        borderBottom:'1px solid #f8fafc',userSelect:'none',transition:'background .1s',fontWeight:sel?500:400
                      }}>
                        <input type="checkbox" checked={sel} onChange={()=>{}} 
                          style={{width:14,height:14,accentColor:'var(--primary)',flexShrink:0}}/>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{flexShrink:0}}>
                          <rect x="1" y="1" width="10" height="10" rx="1.5" stroke={sel?'var(--primary)':'#94a3b8'} strokeWidth="1.2"/>
                          <line x1="3" y1="4.5" x2="9" y2="4.5" stroke={sel?'var(--primary)':'#94a3b8'} strokeWidth="0.8"/>
                          <line x1="3" y1="6.5" x2="7" y2="6.5" stroke={sel?'var(--primary)':'#94a3b8'} strokeWidth="0.8"/>
                        </svg>
                        <span style={{flex:1}}>{table.name}</span>
                        <span style={{fontSize:11,color:'var(--text-dim)'}}>{table.rows>0?`${(table.rows/1000).toFixed(1)}k`:''}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Center: Add/Remove buttons */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,padding:'0 4px'}}>
        <button className="btn btn-primary" onClick={()=>{
          const toAdd = []
          schemaTree.forEach(schema => {
            (schema.tables||[]).forEach(table => {
              if (selectedTables[`${schema.name}.${table.name}`] && !selectedItems.find(i=>i.schema===schema.name&&i.table===table.name)) {
                toAdd.push({schema:schema.name, table:table.name, targetName:table.name})
              }
            })
          })
          setSelectedItems(prev => [...prev, ...toAdd])
        }} style={{width:44,height:44,borderRadius:22,padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,lineHeight:1}}>
          ›
        </button>
        <button className="btn btn-outline" onClick={()=>{
          const keys = new Set(selectedItems.map(i=>`${i.schema}.${i.table}`))
          setSelectedItems(prev => prev.filter(i => selectedTables[`${i.schema}.${i.table}`]))
        }} style={{width:36,height:36,borderRadius:18,padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>
          ‹
        </button>
      </div>

      {/* Right: Selected Items */}
      <div className="card" style={{borderRadius:'0 var(--radius) var(--radius) 0'}}>
        <div className="card-header" style={{fontSize:14,color:'var(--text)',borderBottom:'1px solid var(--border)',padding:'12px 16px'}}>
          <span style={{display:'flex',alignItems:'center',gap:8}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1" stroke="#64748b" strokeWidth="1.5"/><path d="M1 5h14" stroke="#64748b" strokeWidth="1.5"/></svg>
            已选对象
          </span>
          <span style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:12,color:'var(--text-dim)',fontWeight:400}}>{selectedItems.length} 个</span>
            {selectedItems.length > 0 && (
              <button className="btn btn-outline btn-sm" onClick={()=>setSelectedItems([])} style={{fontSize:11,padding:'2px 8px'}}>清空</button>
            )}
          </span>
        </div>
        {selectedItems.length === 0 ? (
          <div style={{textAlign:'center',padding:60,color:'var(--text-dim)',fontSize:13,lineHeight:2}}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{margin:'0 auto 12px',opacity:0.3}}>
              <rect x="4" y="6" width="32" height="28" rx="2" stroke="#94a3b8" strokeWidth="2"/>
              <path d="M4 12h32" stroke="#94a3b8" strokeWidth="2"/>
            </svg>
            <div>在左侧勾选对象后</div>
            <div>点击 › 按钮添加</div>
          </div>
        ) : (
          <div style={{maxHeight:400,overflowY:'auto'}}>
            {selectedItems.map((item,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 16px',borderBottom:'1px solid #f1f5f9',fontSize:13,transition:'background .1s'}}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{flexShrink:0}}>
                  <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="var(--primary)" strokeWidth="1.2"/>
                  <line x1="3" y1="4.5" x2="9" y2="4.5" stroke="var(--primary)" strokeWidth="0.8"/>
                  <line x1="3" y1="6.5" x2="7" y2="6.5" stroke="var(--primary)" strokeWidth="0.8"/>
                </svg>
                <span style={{flex:1,display:'flex',alignItems:'center',gap:4}}>
                  <span style={{color:'var(--text-dim)',fontSize:11}}>{item.schema}.</span>
                  {renameItem === i ? (
                    <input autoFocus value={item.targetName} onChange={e=>renameSelected(i,e.target.value)} onBlur={()=>setRenameItem(null)} onKeyDown={e=>e.key==='Enter'&&setRenameItem(null)} 
                      style={{width:130,padding:'3px 6px',fontSize:12,border:'1px solid var(--primary)',borderRadius:4,outline:'none'}}/>
                  ) : (
                    <span style={{fontWeight:500}}>{item.targetName}</span>
                  )}
                  {item.targetName !== item.table && <span style={{fontSize:11,color:'var(--text-dim)'}}>← {item.table}</span>}
                </span>
                <button className="btn btn-outline btn-sm" style={{padding:'1px 7px',fontSize:10,flexShrink:0}} onClick={()=>setRenameItem(i)}>▹</button>
                <button className="btn btn-outline btn-sm" style={{padding:'1px 6px',fontSize:10,color:'var(--error)',flexShrink:0}} onClick={()=>removeSelected(i)}>✕</button>
              </div>
            ))}
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
        {submitting ? '创建中...' : '🚀 启动迁移任务'}
      </button>
    </div>
  </>
}
