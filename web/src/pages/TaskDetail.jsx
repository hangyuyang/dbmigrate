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

  useEffect(() => { loadTask(); const t = setInterval(loadTask, 3000); return () => clearInterval(t) }, [id])

  async function loadTask() {
    try { const d = await getTask(id); setTask(d); setError(null) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handleAction(action) {
    try {
      const fn = { start:startTask, pause:pauseTask, resume:resumeTask, stop:stopTask }[action]
      if (fn) { await fn(id); loadTask() }
    } catch (err) { alert('操作失败: ' + err.message) }
  }

  const formatTime = ts => ts ? new Date(ts).toLocaleString('zh-CN') : '-'
  const pct = () => task?.progress?.total_rows ? Math.round(task.progress.done_rows/task.progress.total_rows*100) : 0

  if (loading) return <div className="empty-state"><div className="spinner" style={{margin:'0 auto 16px'}}/><p>加载中...</p></div>
  if (error) return <div className="empty-state"><p style={{color:'var(--error)'}}>{error}</p><button className="btn btn-primary" onClick={()=>navigate('/')}>返回列表</button></div>
  if (!task) return null

  const canStart = ['DRAFT','PAUSED','ERROR'].includes(task.status)
  const canPause = ['FULL_SYNC','CDC_SYNC','VERIFYING'].includes(task.status)
  const canStop = ['FULL_SYNC','CDC_SYNC','VERIFYING'].includes(task.status)

  // Phase stages
  const stages = [
    { key:'schema', label:'对象迁移', icon:'📋' },
    { key:'full', label:'全量迁移', icon:'📦' },
    { key:'cdc', label:'增量同步', icon:'🔄' },
    { key:'verify', label:'数据校验', icon:'✅' },
  ]

  const getStageStatus = (stageKey) => {
    const s = task.status
    if (s === 'ERROR' || s === 'DRAFT') return 'pending'
    if (s === 'COMPLETED') return 'done'
    switch (stageKey) {
      case 'schema': return s === 'SCHEMA_MIGRATE' ? 'active' : (['FULL_SYNC','CDC_SYNC','VERIFYING','COMPLETED'].includes(s) ? 'done' : 'pending')
      case 'full': return s === 'FULL_SYNC' ? 'active' : (['CDC_SYNC','VERIFYING','COMPLETED'].includes(s) ? 'done' : 'pending')
      case 'cdc': return s === 'CDC_SYNC' ? 'active' : (['VERIFYING','COMPLETED'].includes(s) ? 'done' : 'pending')
      case 'verify': return s === 'VERIFYING' ? 'active' : (s === 'COMPLETED' ? 'done' : 'pending')
      default: return 'pending'
    }
  }

  return (
    <>
      <div className="header">
        <div>
          <button className="btn btn-outline btn-sm" style={{marginRight:12,marginBottom:8}} onClick={()=>navigate('/')}>← 返回列表</button>
          <h1>{task.name}</h1>
          <div style={{fontSize:12,color:'var(--text-dim)',marginTop:4}}>ID: {task.id}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {canStart && <button className="btn btn-primary btn-sm" onClick={()=>handleAction('start')}>▶ 启动</button>}
          {canPause && <button className="btn btn-outline btn-sm" onClick={()=>handleAction('pause')}>⏸ 暂停</button>}
          {canStop && <button className="btn btn-danger btn-sm" onClick={()=>handleAction('stop')}>⏹ 停止</button>}
        </div>
      </div>

      {/* Stage Timeline */}
      <div style={{display:'flex',gap:0,marginBottom:24,background:'var(--bg-card)',borderRadius:'var(--radius)',overflow:'hidden'}}>
        {stages.map((st,i) => {
          const stat = getStageStatus(st.key)
          let bg = 'transparent', color = 'var(--text-dim)'
          if (stat === 'active') { bg = 'var(--primary)'; color = '#fff' }
          else if (stat === 'done') { bg = 'rgba(34,197,94,0.15)'; color = 'var(--success)' }
          return (
            <div key={st.key} style={{flex:1,textAlign:'center',padding:'14px 8px',background:bg,color,transition:'all .3s',borderRight:i<3?'1px solid var(--border)':'none'}}>
              <div style={{fontSize:20}}>{st.icon}</div>
              <div style={{fontSize:12,fontWeight:600,marginTop:4}}>{st.label}</div>
              <div style={{fontSize:10,marginTop:2}}>{stat==='active'?'进行中':stat==='done'?'✓ 完成':'等待中'}</div>
            </div>
          )
        })}
      </div>

      {/* Task status + Actions */}
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
        <StatusBadge status={task.status} />
        {task.error && <span style={{color:'var(--error)',fontSize:13,flex:1}}>{task.error}</span>}
      </div>

      {/* Progress Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">整体进度</div>
          <div className="stat-value large">{pct()}%</div>
          <div className="progress-bar" style={{marginTop:8}}><div className="progress-bar-fill" style={{width:`${pct()}%`}}/></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已迁移行数</div>
          <div className="stat-value large">{(task.progress?.done_rows||0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">总行数</div>
          <div className="stat-value large">{(task.progress?.total_rows||0).toLocaleString() || '-'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">完成表数</div>
          <div className="stat-value large">{task.progress?.done_tables||0}/{task.progress?.total_tables||0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CDC 延迟</div>
          <div className="stat-value large">{task.progress?.cdc_lag_seconds||0}s</div>
        </div>
        {task.progress?.done_bytes > 0 && (
          <div className="stat-card">
            <div className="stat-label">已迁移数据量</div>
            <div className="stat-value large">{task.progress.done_bytes > 1048576 ? (task.progress.done_bytes/1048576).toFixed(1)+' MB' : (task.progress.done_bytes/1024).toFixed(1)+' KB'}</div>
          </div>
        )}
      </div>

      {/* Config details */}
      <div className="form-row" style={{marginBottom:0}}>
        <div className="card" style={{flex:1}}>
          <div className="card-header">任务配置</div>
          <table style={{width:'100%',fontSize:13}}>
            <tbody>
              <tr><td style={{padding:'4px 0',color:'var(--text-dim)',width:100}}>模式</td><td>{task.mode}</td></tr>
              <tr><td style={{padding:'4px 0',color:'var(--text-dim)'}}>分块大小</td><td>{task.chunk_size?.toLocaleString()} 行</td></tr>
              <tr><td style={{padding:'4px 0',color:'var(--text-dim)'}}>并发数</td><td>{task.parallel}</td></tr>
              <tr><td style={{padding:'4px 0',color:'var(--text-dim)'}}>创建时间</td><td>{formatTime(task.created_at)}</td></tr>
              <tr><td style={{padding:'4px 0',color:'var(--text-dim)'}}>更新时间</td><td>{formatTime(task.updated_at)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card" style={{flex:1}}>
          <div className="card-header">源数据库</div>
          <div style={{fontSize:13}}>
            <div style={{marginBottom:4}}><strong>{task.source?.type}</strong></div>
            <div className="help-text">{task.source?.host}:{task.source?.port}</div>
            <div className="help-text">{task.source?.user} / {task.source?.database}</div>
          </div>
        </div>

        <div className="card" style={{flex:1}}>
          <div className="card-header">目标数据库</div>
          <div style={{fontSize:13}}>
            <div style={{marginBottom:4}}><strong>{task.target?.type}</strong></div>
            <div className="help-text">{task.target?.host}:{task.target?.port}</div>
            <div className="help-text">{task.target?.user} / {task.target?.database}</div>
          </div>
        </div>
      </div>
    </>
  )
}
