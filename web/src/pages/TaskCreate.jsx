import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTask, testConnection } from '../api/client'

const STEPS = ['基础配置', '迁移内容', '高级选项', '确认提交']

export default function TaskCreate() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Step 1: 基础配置
  const [name, setName] = useState('')
  const [source, setSource] = useState({ type:'oceanbase', host:'', port:2883, user:'', password:'', database:'' })
  const [target, setTarget] = useState({ type:'polardbx', host:'', port:4886, user:'', password:'', database:'' })

  // Step 2: 迁移内容
  const [migrateSchema, setMigrateSchema] = useState(true)
  const [migrateFull, setMigrateFull] = useState(true)
  const [migrateCDC, setMigrateCDC] = useState(false)
  const [enableVerify, setEnableVerify] = useState(true)
  const [objects, setObjects] = useState({ tables:true, views:false, indexes:true, procedures:false, functions:false, triggers:false })
  const [includeTables, setIncludeTables] = useState('')
  const [excludeTables, setExcludeTables] = useState('')

  // Step 3: 高级
  const [chunkSize, setChunkSize] = useState(10000)
  const [parallel, setParallel] = useState(4)
  const [batchSize, setBatchSize] = useState(500)
  const [rateLimit, setRateLimit] = useState(0)
  const [errorPolicy, setErrorPolicy] = useState('abort')
  const [verifyMethod, setVerifyMethod] = useState('checksum')
  const [verifyChunks, setVerifyChunks] = useState(100)

  // Step 4: 汇总
  const getModeLabel = () => {
    const parts = []
    if (migrateSchema) parts.push('对象迁移')
    if (migrateFull) parts.push('全量同步')
    if (migrateCDC) parts.push('增量同步')
    return parts.join(' + ')
  }

  const getObjectLabel = () => {
    const items = []
    if (objects.tables) items.push('表')
    if (objects.views) items.push('视图')
    if (objects.indexes) items.push('索引')
    if (objects.procedures) items.push('存储过程')
    if (objects.functions) items.push('函数')
    if (objects.triggers) items.push('触发器')
    return items.join(', ') || '无'
  }

  const updateField = (setter, field, value) => setter(prev => ({ ...prev, [field]: value }))

  // Test connection state
  const [testingSrc, setTestingSrc] = useState(false)
  const [testingTgt, setTestingTgt] = useState(false)
  const [srcResult, setSrcResult] = useState(null)
  const [tgtResult, setTgtResult] = useState(null)

  async function handleTestSource() {
    setTestingSrc(true); setSrcResult(null)
    try {
      const r = await testConnection(source)
      setSrcResult(r)
    } catch(e) {
      setSrcResult({ success: false, error: e.message })
    } finally { setTestingSrc(false) }
  }

  async function handleTestTarget() {
    setTestingTgt(true); setTgtResult(null)
    try {
      const r = await testConnection(target)
      setTgtResult(r)
    } catch(e) {
      setTgtResult({ success: false, error: e.message })
    } finally { setTestingTgt(false) }
  }

  async function handleSubmit() {
    if (!name.trim()) { alert('请输入任务名称'); return }
    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        mode: [migrateSchema && 'schema', migrateFull && 'full', migrateCDC && 'cdc'].filter(Boolean).join('+'),
        source: { ...source, port: parseInt(source.port) || 2883 },
        target: { ...target, port: parseInt(target.port) || 4886 },
        filter: {
          include_tables: includeTables ? includeTables.split(/[,\s]+/).filter(Boolean) : [],
          exclude_tables: excludeTables ? excludeTables.split(/[,\s]+/).filter(Boolean) : [],
          include_schemas: [],
        },
        migrate_objects: objects,
        chunk_size: chunkSize,
        parallel,
        batch_size: batchSize,
        rate_limit: rateLimit,
        error_policy: errorPolicy,
        enable_verify: enableVerify,
        verify_method: verifyMethod,
        verify_chunks: verifyChunks,
      }
      await createTask(payload)
      navigate('/')
    } catch (err) {
      alert('创建失败: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="header">
        <h1>创建迁移任务</h1>
        <button className="btn btn-outline" onClick={() => navigate('/')}>取消</button>
      </div>

      {/* Step indicator */}
      <div style={{ display:'flex', gap:0, marginBottom:24, background:'var(--bg-card)', borderRadius:'var(--radius)', overflow:'hidden' }}>
        {STEPS.map((s, i) => (
          <div key={i} onClick={() => setStep(i)} style={{
            flex:1, textAlign:'center', padding:'12px 8px', cursor:'pointer', fontSize:13, fontWeight:600,
            background: i === step ? 'var(--primary)' : 'transparent',
            color: i === step ? '#fff' : 'var(--text-dim)',
            transition:'all .2s'
          }}>
            <div style={{ fontSize:18, marginBottom:2 }}>{i+1}</div>
            {s}
          </div>
        ))}
      </div>

      {/* Step 1: 基础配置 */}
      {step === 0 && (
        <div>
          <div className="card">
            <div className="card-header">任务信息</div>
            <div className="form-group">
              <label>任务名称 *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例如：生产库 OceanBase → PolarDB-X" />
            </div>
          </div>

          <div className="form-row">
            <div className="card">
              <div className="card-header">
                <span>源数据库</span>
                <button className="btn btn-outline btn-sm" onClick={handleTestSource} disabled={testingSrc}>
                  {testingSrc ? '测试中...' : '🔗 测试连接'}
                </button>
              </div>
              <div className="form-group">
                <label>类型</label>
                <select value={source.type} onChange={e => updateField(setSource, 'type', e.target.value)}>
                  <option value="mysql">MySQL</option>
                  <option value="oceanbase">OceanBase</option>
                  <option value="tidb">TiDB</option>
                  <option value="oracle">Oracle</option>
                  <option value="postgresql">PostgreSQL</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>主机</label>
                  <input value={source.host} onChange={e => updateField(setSource, 'host', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>端口</label>
                  <input type="number" value={source.port} onChange={e => updateField(setSource, 'port', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>用户名</label>
                  <input value={source.user} onChange={e => updateField(setSource, 'user', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>密码</label>
                  <input type="password" value={source.password} onChange={e => updateField(setSource, 'password', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>数据库</label>
                <input value={source.database} onChange={e => updateField(setSource, 'database', e.target.value)} placeholder="源库名" />
              </div>
              {srcResult && (
                <div style={{marginTop:8, padding:'8px 12px', borderRadius:4, fontSize:12,
                  background: srcResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${srcResult.success ? 'var(--success)' : 'var(--error)'}` }}>
                  {srcResult.success
                    ? <>✅ 连接成功 — {srcResult.version} — {srcResult.latency_ms}ms</>
                    : <>❌ 连接失败 — {srcResult.error}</>}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <span>目标数据库</span>
                <button className="btn btn-outline btn-sm" onClick={handleTestTarget} disabled={testingTgt}>
                  {testingTgt ? '测试中...' : '🔗 测试连接'}
                </button>
              </div>
              <div className="form-group">
                <label>类型</label>
                <select value={target.type} onChange={e => updateField(setTarget, 'type', e.target.value)}>
                  <option value="mysql">MySQL</option>
                  <option value="polardbx">PolarDB-X</option>
                  <option value="tidb">TiDB</option>
                  <option value="oceanbase">OceanBase</option>
                  <option value="oracle">Oracle</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>主机</label>
                  <input value={target.host} onChange={e => updateField(setTarget, 'host', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>端口</label>
                  <input type="number" value={target.port} onChange={e => updateField(setTarget, 'port', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>用户名</label>
                  <input value={target.user} onChange={e => updateField(setTarget, 'user', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>密码</label>
                  <input type="password" value={target.password} onChange={e => updateField(setTarget, 'password', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>数据库</label>
                <input value={target.database} onChange={e => updateField(setTarget, 'database', e.target.value)} placeholder="目标库名" />
              </div>
              {tgtResult && (
                <div style={{marginTop:8, padding:'8px 12px', borderRadius:4, fontSize:12,
                  background: tgtResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${tgtResult.success ? 'var(--success)' : 'var(--error)'}` }}>
                  {tgtResult.success
                    ? <>✅ 连接成功 — {tgtResult.version} — {tgtResult.latency_ms}ms</>
                    : <>❌ 连接失败 — {tgtResult.error}</>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: 迁移内容 */}
      {step === 1 && (
        <div>
          <div className="card">
            <div className="card-header">迁移模式</div>
            <div style={{ display:'flex', gap:20 }}>
              {[
                { key:'schema', label:'对象迁移', desc:'表结构、索引、视图等', checked:migrateSchema, set:setMigrateSchema },
                { key:'full', label:'全量迁移', desc:'所有存量数据', checked:migrateFull, set:setMigrateFull },
                { key:'cdc', label:'增量同步', desc:'实时变更数据捕获', checked:migrateCDC, set:setMigrateCDC },
              ].map(m => (
                <label key={m.key} style={{ display:'flex', gap:8, padding:'12px 16px', background:m.checked ? 'rgba(59,130,246,0.1)' : 'var(--bg)', border:`1px solid ${m.checked ? 'var(--primary)' : 'var(--border)'}`, borderRadius:8, cursor:'pointer', flex:1 }}>
                  <input type="checkbox" checked={m.checked} onChange={e => m.set(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>{m.label}</div>
                    <div style={{ fontSize:12, color:'var(--text-dim)' }}>{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">迁移对象</div>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              {[
                { key:'tables', label:'表', icon:'📊' },
                { key:'views', label:'视图', icon:'👁' },
                { key:'indexes', label:'索引', icon:'📑' },
                { key:'procedures', label:'存储过程', icon:'⚙' },
                { key:'functions', label:'函数', icon:'𝑓' },
                { key:'triggers', label:'触发器', icon:'⚡' },
              ].map(obj => (
                <label key={obj.key} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:objects[obj.key] ? 'rgba(59,130,246,0.1)' : 'var(--bg)', border:`1px solid ${objects[obj.key] ? 'var(--primary)' : 'var(--border)'}`, borderRadius:6, cursor:'pointer' }}>
                  <input type="checkbox" checked={objects[obj.key]} onChange={e => setObjects(prev => ({...prev, [obj.key]: e.target.checked}))} />
                  <span>{obj.icon}</span>
                  <span style={{ fontSize:13 }}>{obj.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">数据校验</div>
            <label style={{ display:'flex', gap:8, alignItems:'center', cursor:'pointer' }}>
              <input type="checkbox" checked={enableVerify} onChange={e => setEnableVerify(e.target.checked)} />
              <span>迁移完成后自动进行数据校验</span>
            </label>
            {enableVerify && (
              <div style={{ marginTop:12, paddingLeft:24 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>校验方式</label>
                    <select value={verifyMethod} onChange={e => setVerifyMethod(e.target.value)}>
                      <option value="checksum">CRC32 分块校验</option>
                      <option value="rowcount">仅行数校验</option>
                      <option value="full">逐行全量校验</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>校验分块大小（行）</label>
                    <input type="number" value={verifyChunks} onChange={e => setVerifyChunks(parseInt(e.target.value)||100)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">表过滤</div>
            <div className="form-row">
              <div className="form-group">
                <label>包含表</label>
                <textarea value={includeTables} onChange={e => setIncludeTables(e.target.value)} placeholder="逗号分隔，留空=全部" rows={3} />
              </div>
              <div className="form-group">
                <label>排除表</label>
                <textarea value={excludeTables} onChange={e => setExcludeTables(e.target.value)} placeholder="逗号分隔" rows={3} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 高级选项 */}
      {step === 2 && (
        <div>
          <div className="card">
            <div className="card-header">性能配置</div>
            <div className="form-row">
              <div className="form-group">
                <label>全量分块大小（行）</label>
                <input type="number" value={chunkSize} onChange={e => setChunkSize(parseInt(e.target.value)||10000)} />
                <div className="help-text">每批次从源库读取的行数</div>
              </div>
              <div className="form-group">
                <label>全量并发数</label>
                <input type="number" value={parallel} onChange={e => setParallel(parseInt(e.target.value)||4)} min="1" max="32" />
                <div className="help-text">同时迁移的线程数</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>写入批次大小（行）</label>
                <input type="number" value={batchSize} onChange={e => setBatchSize(parseInt(e.target.value)||500)} />
                <div className="help-text">每批写入目标库的行数</div>
              </div>
              <div className="form-group">
                <label>源库限速（MB/s，0=不限）</label>
                <input type="number" value={rateLimit} onChange={e => setRateLimit(parseInt(e.target.value)||0)} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">错误处理</div>
            <div className="form-group">
              <label>错误策略</label>
              <select value={errorPolicy} onChange={e => setErrorPolicy(e.target.value)}>
                <option value="abort">遇到错误立即终止</option>
                <option value="skip">跳过错误行继续</option>
                <option value="retry">自动重试 3 次后跳过</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: 确认 */}
      {step === 3 && (
        <div>
          <div className="card">
            <div className="card-header">任务概览</div>
            <table style={{ width:'100%', fontSize:14 }}>
              <tbody>
                <tr><td style={{ padding:'6px 0', color:'var(--text-dim)', width:120 }}>任务名称</td><td><strong>{name || '-'}</strong></td></tr>
                <tr><td style={{ padding:'6px 0', color:'var(--text-dim)' }}>迁移模式</td><td><span className="badge badge-full_sync">{getModeLabel()}</span></td></tr>
                <tr><td style={{ padding:'6px 0', color:'var(--text-dim)' }}>迁移对象</td><td>{getObjectLabel()}</td></tr>
                <tr><td style={{ padding:'6px 0', color:'var(--text-dim)' }}>数据校验</td><td>{enableVerify ? `${verifyMethod === 'checksum' ? 'CRC32分块校验' : verifyMethod === 'rowcount' ? '仅行数' : '逐行全量'}` : '不校验'}</td></tr>
                <tr><td style={{ padding:'6px 0', color:'var(--text-dim)' }}>源库</td><td>{source.type} // {source.host}:{source.port} / {source.database}</td></tr>
                <tr><td style={{ padding:'6px 0', color:'var(--text-dim)' }}>目标库</td><td>{target.type} // {target.host}:{target.port} / {target.database}</td></tr>
                <tr><td style={{ padding:'6px 0', color:'var(--text-dim)' }}>性能</td><td>分块 {chunkSize?.toLocaleString()} 行, {parallel} 线程, 写入批次 {batchSize}</td></tr>
                <tr><td style={{ padding:'6px 0', color:'var(--text-dim)' }}>错误策略</td><td>{errorPolicy === 'abort' ? '遇到错误终止' : errorPolicy === 'skip' ? '跳过错误行' : '自动重试3次后跳过'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:20 }}>
        <div>
          {step > 0 && <button className="btn btn-outline" onClick={() => setStep(step-1)}>← 上一步</button>}
        </div>
        <div style={{ display:'flex', gap:12 }}>
          {step < 3 && (
            <button className="btn btn-primary" onClick={() => setStep(step+1)}>下一步 →</button>
          )}
          {step === 3 && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '创建中...' : '✓ 创建迁移任务'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
