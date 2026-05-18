export default function Dashboard() {
  return (
    <>
      <div className="header"><h1>概览</h1></div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">迁移任务总数</div><div className="stat-value">-</div></div>
        <div className="stat-card"><div className="stat-label">运行中</div><div className="stat-value" style={{color:'var(--primary)'}}>-</div></div>
        <div className="stat-card"><div className="stat-label">已完成</div><div className="stat-value" style={{color:'var(--success)'}}>-</div></div>
        <div className="stat-card"><div className="stat-label">失败</div><div className="stat-value" style={{color:'var(--error)'}}>-</div></div>
        <div className="stat-card"><div className="stat-label">已迁移行数</div><div className="stat-value">-</div></div>
        <div className="stat-card"><div className="stat-label">已迁移数据量</div><div className="stat-value">-</div></div>
      </div>
      <div className="card">
        <div className="card-header">近期任务</div>
        <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-dim)'}}>功能开发中，敬请期待</div>
      </div>
    </>
  )
}
