export default function Monitor() {
  return (
    <>
      <div className="header"><h1>监控运维</h1></div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Server 状态</div><div className="stat-value" style={{fontSize:18,color:'var(--success)'}}>● 运行中</div></div>
        <div className="stat-card"><div className="stat-label">Worker 数量</div><div className="stat-value">1</div></div>
        <div className="stat-card"><div className="stat-label">活跃任务</div><div className="stat-value">-</div></div>
        <div className="stat-card"><div className="stat-label">总吞吐量</div><div className="stat-value" style={{fontSize:18}}>-</div></div>
      </div>
      <div className="card">
        <div className="card-header">系统资源</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
          {[
            {label:'CPU 使用率',val:'-',unit:'%'},
            {label:'内存使用',val:'-',unit:'MB'},
            {label:'磁盘使用',val:'-',unit:'%'}
          ].map(m=>(
            <div key={m.label} style={{padding:'16px',border:'1px solid var(--border)',borderRadius:8,textAlign:'center'}}>
              <div style={{fontSize:12,color:'var(--text-dim)',marginBottom:8}}>{m.label}</div>
              <div style={{fontSize:28,fontWeight:700}}>{m.val}<span style={{fontSize:14,color:'var(--text-dim)',marginLeft:4}}>{m.unit}</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-header">告警与日志</div>
        <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-dim)'}}>功能开发中，敬请期待</div>
      </div>
    </>
  )
}
