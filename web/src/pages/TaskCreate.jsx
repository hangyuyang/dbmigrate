import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTask } from '../api/client'

const DEFAULT_SOURCE = {
  type: 'mysql', host: '127.0.0.1', port: 3306,
  user: 'root', password: '', database: ''
}

const DEFAULT_TARGET = {
  type: 'mysql', host: '127.0.0.1', port: 3307,
  user: 'root', password: '', database: ''
}

export default function TaskCreate() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [mode, setMode] = useState('full')
  const [source, setSource] = useState(DEFAULT_SOURCE)
  const [target, setTarget] = useState(DEFAULT_TARGET)
  const [includeTables, setIncludeTables] = useState('')
  const [excludeTables, setExcludeTables] = useState('')
  const [chunkSize, setChunkSize] = useState(50000)
  const [parallel, setParallel] = useState(4)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { alert('请输入任务名称'); return }
    if (!source.database || !target.database) { alert('请填写源和目标数据库名'); return }

    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        mode,
        source: { ...source, port: parseInt(source.port) || 3306 },
        target: { ...target, port: parseInt(target.port) || 3307 },
        filter: {
          include_tables: includeTables ? includeTables.split(',').map(s => s.trim()).filter(Boolean) : [],
          exclude_tables: excludeTables ? excludeTables.split(',').map(s => s.trim()).filter(Boolean) : [],
          include_schemas: [],
        },
        chunk_size: chunkSize,
        parallel,
      }
      await createTask(payload)
      navigate('/')
    } catch (err) {
      alert('创建失败: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function updateSource(field, value) {
    setSource(prev => ({ ...prev, [field]: value }))
  }

  function updateTarget(field, value) {
    setTarget(prev => ({ ...prev, [field]: value }))
  }

  return (
    <>
      <div className="header">
        <h1>创建迁移任务</h1>
        <button className="btn btn-outline" onClick={() => navigate('/')}>取消</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="form-group">
            <label>任务名称 *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：生产库 OB → PolarDB-X"
            />
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label>迁移模式</label>
              <select value={mode} onChange={e => setMode(e.target.value)}>
                <option value="full">全量迁移</option>
                <option value="full+cdc">全量 + 增量</option>
                <option value="cdc-only">仅增量</option>
                <option value="schema-only">仅 Schema</option>
              </select>
            </div>
            <div className="form-group">
              <label>分块大小（行）</label>
              <input type="number" value={chunkSize} onChange={e => setChunkSize(parseInt(e.target.value) || 50000)} />
              <div className="help-text">每个批次读取的行数</div>
            </div>
            <div className="form-group">
              <label>并发数</label>
              <input type="number" value={parallel} onChange={e => setParallel(parseInt(e.target.value) || 4)} min="1" max="32" />
              <div className="help-text">同时迁移的线程数</div>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="card">
            <div className="form-section">
              <h3>源数据库</h3>
              <div className="form-group">
                <label>类型</label>
                <select value={source.type} onChange={e => updateSource('type', e.target.value)}>
                  <option value="mysql">MySQL</option>
                  <option value="oceanbase">OceanBase</option>
                  <option value="tidb">TiDB</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>主机</label>
                  <input type="text" value={source.host} onChange={e => updateSource('host', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>端口</label>
                  <input type="number" value={source.port} onChange={e => updateSource('port', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>用户名</label>
                  <input type="text" value={source.user} onChange={e => updateSource('user', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>密码</label>
                  <input type="password" value={source.password} onChange={e => updateSource('password', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>数据库</label>
                <input type="text" value={source.database} onChange={e => updateSource('database', e.target.value)} placeholder="源库名" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="form-section">
              <h3>目标数据库</h3>
              <div className="form-group">
                <label>类型</label>
                <select value={target.type} onChange={e => updateTarget('type', e.target.value)}>
                  <option value="mysql">MySQL</option>
                  <option value="polardbx">PolarDB-X</option>
                  <option value="tidb">TiDB</option>
                  <option value="oceanbase">OceanBase</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>主机</label>
                  <input type="text" value={target.host} onChange={e => updateTarget('host', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>端口</label>
                  <input type="number" value={target.port} onChange={e => updateTarget('port', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>用户名</label>
                  <input type="text" value={target.user} onChange={e => updateTarget('user', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>密码</label>
                  <input type="password" value={target.password} onChange={e => updateTarget('password', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>数据库</label>
                <input type="text" value={target.database} onChange={e => updateTarget('database', e.target.value)} placeholder="目标库名" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="form-section">
            <h3>表过滤（可选）</h3>
            <div className="form-row">
              <div className="form-group">
                <label>包含表</label>
                <textarea
                  value={includeTables}
                  onChange={e => setIncludeTables(e.target.value)}
                  placeholder="用逗号分隔表名，留空表示全部&#10;例如：users, orders, products"
                />
              </div>
              <div className="form-group">
                <label>排除表</label>
                <textarea
                  value={excludeTables}
                  onChange={e => setExcludeTables(e.target.value)}
                  placeholder="用逗号分隔表名&#10;例如：tmp_*, logs"
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button type="button" className="btn btn-outline" style={{ marginRight: 12 }} onClick={() => navigate('/')}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '创建中...' : '创建任务'}
          </button>
        </div>
      </form>
    </>
  )
}
