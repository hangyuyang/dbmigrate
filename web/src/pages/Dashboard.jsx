import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTasks } from '../api/client'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listTasks().then(d => { setTasks(Array.isArray(d)?d:[]); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const totalTasks = tasks.length
  const runningTasks = tasks.filter(t => ['INIT','SCHEMA_MIGRATE','FULL_SYNC','CDC_SYNC','VERIFYING'].includes(t.status)).length
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length
  const failedTasks = tasks.filter(t => t.status === 'ERROR').length

  const totalRows = tasks.reduce((s,t) => s + (t.progress?.done_rows||0), 0)
  const completedRows = tasks.filter(t=>t.status==='COMPLETED').reduce((s,t)=>s+(t.progress?.done_rows||0), 0)
  const successRate = totalTasks > 0 ? Math.round(completedTasks/totalTasks*100) : 0

  function formatRows(n) {
    if (n > 1e9) return (n/1e9).toFixed(1)+'B'
    if (n > 1e6) return (n/1e6).toFixed(1)+'M'
    if (n > 1e3) return (n/1e3).toFixed(1)+'K'
    return n
  }

  const recentTasks = [...tasks].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10)

  return (
    <>
      {/* Title */}
      <div className="header">
        <h1>概览</h1>
        <span style={{fontSize:13, color:'var(--text-dim)'}}>Auto refresh</span>
      </div>

      {/* Top Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">迁移任务总数</div>
          <div className="stat-value">{loading ? '-' : totalTasks}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">运行中</div>
          <div className="stat-value" style={{color:'var(--primary)'}}>{loading ? '-' : runningTasks}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已完成</div>
          <div className="stat-value" style={{color:'var(--success)'}}>{loading ? '-' : completedTasks}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">失败</div>
          <div className="stat-value" style={{color:'var(--error)'}}>{loading ? '-' : failedTasks}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">历史迁移行数</div>
          <div className="stat-value" style={{fontSize:22}}>{formatRows(totalRows)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">成功率</div>
          <div className="stat-value" style={{fontSize:22}}>{totalTasks > 0 ? successRate+'%' : '-'}</div>
        </div>
      </div>

      {/* Data Sync Overview */}
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:16}}>
        <div className="card">
          <div className="card-header">数据同步总览</div>
          {totalTasks === 0 ? (
            <div style={{textAlign:'center', padding:'40px 0', color:'var(--text-dim)', fontSize:14}}>
              还没有迁移任务，<a href="/create" style={{cursor:'pointer'}} onClick={e=>{e.preventDefault();navigate('/create')}}>创建第一个</a>
            </div>
          ) : (
            <table style={{width:'100%',fontSize:13}}>
              <tbody>
                <tr>
                  <td style={{padding:'8px 0',color:'var(--text-dim)'}}>全量迁移任务</td>
                  <td style={{fontWeight:600}}>{totalTasks}</td>
                  <td style={{padding:'8px 0',color:'var(--text-dim)'}}>已完成行数</td>
                  <td style={{fontWeight:600,color:'var(--success)'}}>{completedRows.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style={{padding:'8px 0',color:'var(--text-dim)'}}>增量同步任务</td>
                  <td style={{fontWeight:600}}>{tasks.filter(t=>t.mode?.includes('cdc')).length}</td>
                  <td style={{padding:'8px 0',color:'var(--text-dim)'}}>历史总行数</td>
                  <td style={{fontWeight:600}}>{totalRows.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style={{padding:'8px 0',color:'var(--text-dim)'}}>结构迁移任务</td>
                  <td style={{fontWeight:600}}>{tasks.filter(t=>t.mode?.includes('schema')).length}</td>
                  <td style={{padding:'8px 0',color:'var(--text-dim)'}}>平均完成时间</td>
                  <td style={{fontWeight:600}}>-</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header">环境状态</div>
          <div style={{fontSize:13}}>
            <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
              <span>🔗 DBMigrate Server</span>
              <span style={{color:'var(--success)', fontWeight:600}}>● 运行中</span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
              <span>🌊 OceanBase</span>
              <span style={{color:'var(--success)', fontWeight:600}}>● 正常</span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
              <span>☁️ PolarDB-X</span>
              <span style={{color:'var(--success)', fontWeight:600}}>● 正常</span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0'}}>
              <span>📋 任务存储</span>
              <span style={{color:'var(--text-dim)'}}>{totalTasks} 条记录</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div className="card-header" style={{padding:'16px 24px', marginBottom:0}}>近期任务</div>
        {recentTasks.length === 0 ? (
          <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-dim)'}}>暂无迁移任务</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>状态</th>
                <th>源 → 目标</th>
                <th>进度</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {recentTasks.map(task => (
                <tr key={task.id} className="clickable" onClick={()=>navigate(`/tasks/${task.id}`)}>
                  <td>
                    <strong>{task.name}</strong>
                    <div className="mono">{task.id}</div>
                  </td>
                  <td><StatusBadge status={task.status}/></td>
                  <td style={{fontSize:13}}>
                    {task.source?.type} → {task.target?.type}
                    <div className="help-text">{task.source?.database} → {task.target?.database}</div>
                  </td>
                  <td>
                    {task.status==='COMPLETED' ? (
                      <span style={{color:'var(--success)',fontWeight:600}}>✓ {task.progress?.done_rows?.toLocaleString()} 行</span>
                    ) : task.status==='ERROR' ? (
                      <span style={{color:'var(--error)',fontSize:12}}>{task.error?.substring(0,50)}</span>
                    ) : task.progress?.done_rows>0 ? (
                      <>{task.progress.done_rows?.toLocaleString()} / {task.progress.total_rows?.toLocaleString()}</>
                    ) : <span className="help-text">-</span>}
                  </td>
                  <td className="help-text">{task.created_at ? new Date(task.created_at).toLocaleString('zh-CN') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
