import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTasks, deleteTask } from '../api/client'
import StatusBadge from '../components/StatusBadge'

export default function TaskList() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadTasks()
  }, [])

  async function loadTasks() {
    try {
      setLoading(true)
      const data = await listTasks()
      setTasks(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('确认删除此任务？')) return
    try {
      await deleteTask(id)
      loadTasks()
    } catch (err) {
      alert('删除失败: ' + err.message)
    }
  }

  function formatTime(ts) {
    if (!ts) return '-'
    return new Date(ts).toLocaleString('zh-CN')
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
        <button className="btn btn-primary" onClick={loadTasks}>重试</button>
      </div>
    )
  }

  return (
    <>
      <div className="header">
        <h1>迁移任务</h1>
        <button className="btn btn-primary" onClick={() => navigate('/create')}>
          + 创建任务
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📦</div>
          <p>还没有迁移任务</p>
          <button className="btn btn-primary" onClick={() => navigate('/create')}>
            创建第一个任务
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>状态</th>
                <th>模式</th>
                <th>源 → 目标</th>
                <th>进度</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id} className="clickable" onClick={() => navigate(`/tasks/${task.id}`)}>
                  <td>
                    <strong>{task.name}</strong>
                    <div className="mono">{task.id}</div>
                  </td>
                  <td><StatusBadge status={task.status} /></td>
                  <td>{task.mode}</td>
                  <td style={{ fontSize: 13 }}>
                    {task.source?.host}:{task.source?.port}
                    <br />
                    <span style={{ color: 'var(--text-dim)' }}>→</span> {task.target?.host}:{task.target?.port}
                  </td>
                  <td>
                    {task.progress?.total_rows > 0 ? (
                      <>
                        <div style={{ fontSize: 13 }}>
                          {task.progress.done_rows?.toLocaleString()} / {task.progress.total_rows?.toLocaleString()}
                        </div>
                        <div className="progress-bar">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${Math.round(task.progress.done_rows / task.progress.total_rows * 100)}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <span className="help-text">-</span>
                    )}
                  </td>
                  <td className="help-text">{formatTime(task.created_at)}</td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={(e) => handleDelete(task.id, e)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
