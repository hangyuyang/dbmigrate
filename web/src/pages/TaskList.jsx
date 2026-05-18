import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTasks, deleteTask } from '../api/client'
import StatusBadge from '../components/StatusBadge'

export default function TaskList() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    try { setLoading(true); const d = await listTasks(); setTasks(Array.isArray(d)?d:[]); setError(null) }
    catch(err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handleDelete(id, e) { e.stopPropagation(); if(!confirm('确认删除？'))return; try{await deleteTask(id);loadTasks()}catch(err){alert('删除失败:'+err.message)} }

  const formatTime = ts => ts ? new Date(ts).toLocaleString('zh-CN') : '-'

  const modeLabel = (mode) => {
    if (!mode) return '-'
    if (mode.includes('schema') && mode.includes('full') && mode.includes('cdc')) return '对象+全量+增量'
    if (mode.includes('full') && mode.includes('cdc')) return '全量+增量'
    if (mode.includes('schema') && mode.includes('full')) return '对象+全量'
    if (mode === 'full') return '全量'
    if (mode === 'schema-only') return '仅对象'
    if (mode === 'cdc-only') return '仅增量'
    return mode
  }

  if (loading) return <div className="empty-state"><div className="spinner" style={{margin:'0 auto 16px'}}/><p>加载中...</p></div>
  if (error) return <div className="empty-state"><p style={{color:'var(--error)'}}>{error}</p><button className="btn btn-primary" onClick={loadTasks}>重试</button></div>

  return (
    <>
      <div className="header">
        <h1>迁移任务</h1>
        <button className="btn btn-primary" onClick={()=>navigate('/create')}>+ 创建任务</button>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📦</div>
          <p>还没有迁移任务</p>
          <button className="btn btn-primary" onClick={()=>navigate('/create')}>创建第一个任务</button>
        </div>
      ) : (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <table className="table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>状态</th>
                <th>迁移模式</th>
                <th>源 → 目标</th>
                <th>进度</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                const p = task.progress || {}
                const pct = p.total_rows ? Math.round(p.done_rows/p.total_rows*100) : 0
                return (
                  <tr key={task.id} className="clickable" onClick={()=>navigate(`/tasks/${task.id}`)}>
                    <td>
                      <strong>{task.name}</strong>
                      <div className="mono">{task.id}</div>
                    </td>
                    <td><StatusBadge status={task.status}/></td>
                    <td style={{fontSize:12}}>{modeLabel(task.mode)}</td>
                    <td style={{fontSize:13}}>
                      <span style={{color:'var(--info)'}}>{task.source?.type}</span>{' '}
                      {task.source?.host}:{task.source?.port}
                      <br/><span style={{color:'var(--text-dim)'}}>→</span>{' '}
                      <span style={{color:'var(--success)'}}>{task.target?.type}</span>{' '}
                      {task.target?.host}:{task.target?.port}
                    </td>
                    <td>
                      {task.status === 'COMPLETED' ? (
                        <span style={{color:'var(--success)',fontWeight:600}}>✓ 完成 ({p.done_rows?.toLocaleString()} 行)</span>
                      ) : task.status === 'ERROR' ? (
                        <span style={{color:'var(--error)',fontSize:12}}>{task.error?.substring(0,60)}</span>
                      ) : p.done_rows > 0 ? (
                        <>
                          <div style={{fontSize:13}}>{p.done_rows?.toLocaleString()}/{p.total_rows?.toLocaleString()} ({pct}%)</div>
                          <div className="progress-bar"><div className="progress-bar-fill" style={{width:`${pct}%`}}/></div>
                        </>
                      ) : (
                        <span className="help-text">-</span>
                      )}
                    </td>
                    <td className="help-text">{formatTime(task.created_at)}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={e=>handleDelete(task.id,e)}>删除</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
