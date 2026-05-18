import { NavLink, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">⚡ DBMigrate</div>
        <ul className="sidebar-nav">
          <li>
            <NavLink to="/" end>
              <span className="icon">📋</span>
              任务列表
            </NavLink>
          </li>
          <li>
            <NavLink to="/create">
              <span className="icon">＋</span>
              创建任务
            </NavLink>
          </li>
        </ul>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
