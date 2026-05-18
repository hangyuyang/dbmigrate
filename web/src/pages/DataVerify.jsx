export default function DataVerify() {
  const items = ['crc32', 'rowcount', 'full']
  return (
    <>
      <div className="header">
        <h1>数据校验</h1>
        <button className="btn btn-primary btn-sm" disabled>+ 创建校验任务</button>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">校验任务数</div><div className="stat-value">-</div></div>
        <div className="stat-card"><div className="stat-label">校验通过</div><div className="stat-value" style={{color:'var(--success)'}}>-</div></div>
        <div className="stat-card"><div className="stat-label">校验差异</div><div className="stat-value" style={{color:'var(--error)'}}>-</div></div>
      </div>
      <div className="card">
        <div className="card-header">支持的校验方式</div>
        <div style={{display:'flex',gap:16}}>
          {[{icon:'🔢',label:'CRC32 分块校验',desc:'按分块计算 CRC32 校验和比对'},{icon:'📏',label:'行数校验',desc:'快速比对源/目标表行数'},{icon:'🔍',label:'逐行全量校验',desc:'精确比对每行数据'}].map(m=>(
            <div key={m.label} style={{flex:1,padding:'16px',borderRadius:8,border:'1px solid var(--border)',textAlign:'center'}}>
              <div style={{fontSize:24}}>{m.icon}</div>
              <div style={{fontSize:14,fontWeight:600,marginTop:4}}>{m.label}</div>
              <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4}}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-header">校验任务列表</div>
        <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-dim)'}}>功能开发中，敬请期待</div>
      </div>
    </>
  )
}
