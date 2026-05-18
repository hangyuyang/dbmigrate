import { NavLink, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">⚡ DBMigrate</div>
        <ul className="sidebar-nav">
          <li>
            <NavLink to="/dashboard">
              <span className="icon">📊</span>
              概览
            </NavLink>
          </li>
          <li>
            <NavLink to="/" end>
              <span className="icon">📋</span>
              数据迁移
            </NavLink>
          </li>
          <li>
            <NavLink to="/verify">
              <span className="icon">✅</span>
              数据校验
            </NavLink>
          </li>
          <li>
            <NavLink to="/datasources">
              <span className="icon">🗄</span>
              数据源管理
            </NavLink>
          </li>
          <li>
            <NavLink to="/monitor">
              <span className="icon">📈</span>
              监控运维
            </NavLink>
          </li>
        </ul>
        <div style={{position:'absolute',bottom:20,left:0,right:0,textAlign:'center',fontSize:11,color:'#64748b'}}>
          v0.1.0
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
