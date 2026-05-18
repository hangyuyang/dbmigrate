import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTask, startTask, pauseTask, resumeTask, stopTask } from '../api/client'
import StatusBadge from '../components/StatusBadge'

export default function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    loadTask()
    const timer = setInterval(loadTask, 3000)
    return () => clearInterval(timer)
  }, [id])

  async function loadTask() {
    try {
      const data = await getTask(id)
      setTask(data)
      setError(null)
      // simulate log entries based on progress
      if (data.progress) {
        const entries = []
        if (data.progress.done_rows > 0) {
          entries.push({
            time: new Date().toISOString(),
            level: 'success',
            msg: `已迁移 ${data.progress.done_rows.toLocaleString()} 行 / ${data.progress.total_rows?.toLocaleString() || '?'} 行`
          })
        }
        if (data.error) {
          entries.push({ time: new Date().toISOString(), level: 'error', msg: data.error })
        }
        setLogs(entries)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action) {
    try {
      switch (action) {
        case 'start': await startTask(id); break
        case 'pause': await pauseTask(id); break
        case 'resume': await resumeTask(id); break
        case 'stop': await stopTask(id); break
      }
      loadTask()
    } catch (err) {
      alert('操作失败: ' + err.message)
    }
  }

  function formatTime(ts) {
    if (!ts) return '-'
    return new Date(ts).toLocaleString('zh-CN')
  }

  function progressPercent() {
    if (!task?.progress?.total_rows || task.progress.total_rows === 0) return 0
    return Math.round(task.progress.done_rows / task.progress.total_rows * 100)
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p>加载中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty-state">
        <p style={{ color: 'var(--error)' }}>加载失败: {error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>返回列表</button>
      </div>
    )
  }

  if (!task) return null

  const canStart = task.status === 'DRAFT' || task.status === 'PAUSED' || task.status === 'ERROR'
  const canPause = task.status === 'FULL_SYNC' || task.status === 'CDC_SYNC'
  const canResume = task.status === 'PAUSED'
  const canStop = task.status === 'FULL_SYNC' || task.status === 'CDC_SYNC' || task.status === 'VERIFYING'

  return (
    <>
      <div className="header">
        <div>
          <button className="btn btn-outline btn-sm" style={{ marginRight: 12, marginBottom: 8 }} onClick={() => navigate('/')}>
            ← 返回列表
          </button>
          <h1>{task.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canStart && <button className="btn btn-primary btn-sm" onClick={() => handleAction('start')}>▶ 启动</button>}
          {canPause && <button className="btn btn-outline btn-sm" onClick={() => handleAction('pause')}>⏸ 暂停</button>}
          {canResume && <button className="btn btn-primary btn-sm" onClick={() => handleAction('resume')}>▶ 继续</button>}
          {canStop && <button className="btn btn-danger btn-sm" onClick={() => handleAction('stop')}>⏹ 停止</button>}
        </div>
      </div>

      {/* Stats */}
      {task.progress?.total_rows > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">进度</div>
            <div className="stat-value large">{progressPercent()}%</div>
            <div className="progress-bar" style={{ marginTop: 8 }}>
              <div className="progress-bar-fill" style={{ width: `${progressPercent()}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">已迁移行数</div>
            <div className="stat-value large">{task.progress.done_rows?.toLocaleString() || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">总行数</div>
            <div className="stat-value large">{task.progress.total_rows?.toLocaleString() || '-'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">CDC 延迟</div>
            <div className="stat-value large">{task.progress.cdc_lag_seconds || 0}s</div>
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div>
          {/* Config */}
          <div className="card">
            <div className="card-header">
              <span>任务信息</span>
              <StatusBadge status={task.status} />
            </div>
            <table style={{ width: '100%', fontSize: 14 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-dim)', width: 100 }}>任务 ID</td>
                  <td className="mono">{task.id}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-dim)' }}>模式</td>
                  <td>{task.mode}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-dim)' }}>分块大小</td>
                  <td>{task.chunk_size?.toLocaleString()} 行</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-dim)' }}>并发数</td>
                  <td>{task.parallel}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-dim)' }}>创建时间</td>
                  <td>{formatTime(task.created_at)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', color: 'var(--text-dim)' }}>更新时间</td>
                  <td>{formatTime(task.updated_at)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Source/Target */}
          <div className="form-row" style={{ marginBottom: 0 }}>
            <div className="card">
              <div className="card-header">源数据库</div>
              <div style={{ fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>{task.source?.type}</strong></div>
                <div className="help-text">{task.source?.host}:{task.source?.port}</div>
                <div className="help-text">{task.source?.user} / {task.source?.database}</div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">目标数据库</div>
              <div style={{ fontSize: 14 }}>
                <div style={{ marginBottom: 4 }}><strong>{task.target?.type}</strong></div>
                <div className="help-text">{task.target?.host}:{task.target?.port}</div>
                <div className="help-text">{task.target?.user} / {task.target?.database}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Event Log */}
        <div>
          <div className="card">
            <div className="card-header">事件日志</div>
            <div className="event-log">
              {logs.length === 0 ? (
                <div className="help-text">暂无日志，启动任务后将显示实时日志</div>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className="log-line">
                    <span className="log-time">{new Date(entry.time).toLocaleTimeString('zh-CN')}</span>{' '}
                    <span className={`log-${entry.level}`}>{entry.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
